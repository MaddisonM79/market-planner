-- =============================================================================
-- Audit Trail Partitioning & Archival System
-- =============================================================================
-- Scalable audit storage with automated maintenance

-- =============================================================================
-- NOTE: Core table definitions have been moved to Prisma Schema.md
-- This file contains the partitioning logic and archival functions
-- =============================================================================

-- =============================================================================
-- PARTITIONED AUDIT LOGS TABLE MANAGEMENT
-- =============================================================================

-- Create partitioned audit logs table (this replaces the standard audit_logs table)
-- Note: This table structure is defined in Prisma Schema but created via raw SQL for partitioning
CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
  id UUID DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  operation VARCHAR(20) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  user_id UUID,
  session_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(255),
  api_endpoint VARCHAR(255),
  http_method VARCHAR(10),
  business_reason TEXT,
  approval_required BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  
  -- Partition key constraints
  PRIMARY KEY (id, created_at, tenant_id)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for current and future months
CREATE OR REPLACE FUNCTION create_audit_partition(partition_date DATE) 
RETURNS TEXT AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate partition boundaries (monthly)
  start_date := DATE_TRUNC('month', partition_date);
  end_date := start_date + INTERVAL '1 month';
  partition_name := 'audit_logs_' || TO_CHAR(start_date, 'YYYY_MM');
  
  -- Create partition
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs_partitioned 
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
  
  -- Create indexes on the partition
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id, created_at DESC)',
    partition_name || '_tenant_date_idx', partition_name
  );
  
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (table_name, record_id, created_at DESC)',
    partition_name || '_record_idx', partition_name
  );
  
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (user_id, created_at DESC) WHERE user_id IS NOT NULL',
    partition_name || '_user_idx', partition_name
  );
  
  -- Add GIN index for JSON columns
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I USING GIN (old_values) WHERE old_values IS NOT NULL',
    partition_name || '_old_values_gin_idx', partition_name
  );
  
  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I USING GIN (new_values) WHERE new_values IS NOT NULL',
    partition_name || '_new_values_gin_idx', partition_name
  );
  
  RETURN partition_name;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-create partitions
CREATE OR REPLACE FUNCTION ensure_audit_partitions() RETURNS VOID AS $$
DECLARE
  current_month DATE;
  i INTEGER;
BEGIN
  current_month := DATE_TRUNC('month', CURRENT_DATE);
  
  -- Create partitions for last 3 months, current month, and next 3 months
  FOR i IN -3..3 LOOP
    PERFORM create_audit_partition(current_month + (i || ' months')::INTERVAL);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create initial partitions
SELECT ensure_audit_partitions();

-- =============================================================================
-- ARCHIVAL SYSTEM FUNCTIONS
-- =============================================================================
-- Note: Archive configuration and job tables are defined in Prisma Schema.md

-- =============================================================================
-- ARCHIVAL FUNCTIONS
-- =============================================================================

-- Function to archive old audit data to warm storage
CREATE OR REPLACE FUNCTION archive_audit_data_to_warm(
  p_tenant_id UUID DEFAULT NULL,
  p_target_date DATE DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  job_id UUID;
  partition_name TEXT;
  archive_config RECORD;
  cutoff_date DATE;
  records_processed INTEGER := 0;
  archive_file_path TEXT;
  start_time TIMESTAMP;
BEGIN
  start_time := clock_timestamp();
  
  -- Get archive configuration
  SELECT * INTO archive_config
  FROM audit_archive_config
  WHERE (tenant_id = p_tenant_id OR (tenant_id IS NULL AND p_tenant_id IS NULL))
  ORDER BY tenant_id NULLS LAST
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No archive configuration found';
  END IF;
  
  -- Calculate cutoff date
  cutoff_date := COALESCE(
    p_target_date,
    CURRENT_DATE - (archive_config.hot_retention_months || ' months')::INTERVAL
  );
  
  -- Determine partition to archive
  partition_name := 'audit_logs_' || TO_CHAR(cutoff_date, 'YYYY_MM');
  
  -- Create archive job record
  INSERT INTO audit_archive_jobs (
    job_type, tenant_id, partition_name, start_date, end_date,
    status, started_at
  ) VALUES (
    'warm_archive', p_tenant_id, partition_name, 
    DATE_TRUNC('month', cutoff_date),
    DATE_TRUNC('month', cutoff_date) + INTERVAL '1 month' - INTERVAL '1 day',
    'running', start_time
  ) RETURNING id INTO job_id;
  
  -- Create archive file path
  archive_file_path := COALESCE(
    archive_config.warm_storage_path,
    '/var/lib/postgresql/archives/'
  ) || partition_name || '_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MISS') || '.jsonl';
  
  -- Export data to file (JSONL format for efficiency)
  EXECUTE format(
    'COPY (
      SELECT jsonb_build_object(
        ''id'', id,
        ''tenant_id'', tenant_id,
        ''table_name'', table_name,
        ''record_id'', record_id,
        ''operation'', operation,
        ''old_values'', old_values,
        ''new_values'', new_values,
        ''changed_fields'', changed_fields,
        ''user_id'', user_id,
        ''session_id'', session_id,
        ''ip_address'', ip_address,
        ''user_agent'', user_agent,
        ''request_id'', request_id,
        ''api_endpoint'', api_endpoint,
        ''http_method'', http_method,
        ''business_reason'', business_reason,
        ''created_at'', created_at
      )
      FROM %I
      WHERE (%L IS NULL OR tenant_id = %L)
        AND created_at < %L
      ORDER BY created_at
    ) TO %L',
    partition_name, p_tenant_id, p_tenant_id, cutoff_date, archive_file_path
  );
  
  -- Get count of archived records
  EXECUTE format(
    'SELECT count(*) FROM %I WHERE (%L IS NULL OR tenant_id = %L) AND created_at < %L',
    partition_name, p_tenant_id, p_tenant_id, cutoff_date
  ) INTO records_processed;
  
  -- Update job status
  UPDATE audit_archive_jobs SET
    status = 'completed',
    completed_at = clock_timestamp(),
    duration_seconds = EXTRACT(EPOCH FROM (clock_timestamp() - start_time)),
    records_processed = records_processed,
    records_archived = records_processed,
    archive_file_path = archive_file_path,
    average_records_per_second = CASE 
      WHEN EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) > 0 
      THEN records_processed / EXTRACT(EPOCH FROM (clock_timestamp() - start_time))
      ELSE 0 
    END
  WHERE id = job_id;
  
  RETURN job_id;
  
EXCEPTION WHEN OTHERS THEN
  -- Update job with error
  UPDATE audit_archive_jobs SET
    status = 'failed',
    completed_at = clock_timestamp(),
    error_message = SQLERRM
  WHERE id = job_id;
  
  RAISE;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up archived data
CREATE OR REPLACE FUNCTION cleanup_archived_audit_data(
  p_tenant_id UUID DEFAULT NULL,
  p_force_cleanup BOOLEAN DEFAULT false
) RETURNS INTEGER AS $$
DECLARE
  cutoff_date DATE;
  records_deleted INTEGER := 0;
  partition_name TEXT;
  archive_config RECORD;
BEGIN
  -- Get archive configuration
  SELECT * INTO archive_config
  FROM audit_archive_config
  WHERE (tenant_id = p_tenant_id OR (tenant_id IS NULL AND p_tenant_id IS NULL))
  ORDER BY tenant_id NULLS LAST
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No archive configuration found';
  END IF;
  
  -- Check for legal hold
  IF archive_config.legal_hold AND NOT p_force_cleanup THEN
    RAISE NOTICE 'Legal hold active - skipping cleanup for tenant %', p_tenant_id;
    RETURN 0;
  END IF;
  
  -- Calculate cutoff date
  cutoff_date := CURRENT_DATE - (archive_config.hot_retention_months || ' months')::INTERVAL;
  partition_name := 'audit_logs_' || TO_CHAR(cutoff_date, 'YYYY_MM');
  
  -- Verify data has been archived
  IF NOT EXISTS (
    SELECT 1 FROM audit_archive_jobs 
    WHERE partition_name = partition_name 
      AND status = 'completed'
      AND (tenant_id = p_tenant_id OR (tenant_id IS NULL AND p_tenant_id IS NULL))
  ) THEN
    RAISE EXCEPTION 'Cannot cleanup partition % - no successful archive job found', partition_name;
  END IF;
  
  -- Delete old records
  EXECUTE format(
    'DELETE FROM %I WHERE (%L IS NULL OR tenant_id = %L) AND created_at < %L',
    partition_name, p_tenant_id, p_tenant_id, cutoff_date
  );
  
  GET DIAGNOSTICS records_deleted = ROW_COUNT;
  
  RETURN records_deleted;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PERFORMANCE MONITORING
-- =============================================================================

-- Function to monitor audit system performance
CREATE OR REPLACE FUNCTION monitor_audit_performance() RETURNS TABLE (
  metric_name TEXT,
  metric_value NUMERIC,
  metric_unit TEXT,
  status TEXT,
  recommendation TEXT
) AS $$
DECLARE
  total_audit_records BIGINT;
  avg_insert_rate NUMERIC;
  largest_partition_size NUMERIC;
  oldest_record_age_days INTEGER;
BEGIN
  -- Total audit records
  SELECT sum(schemasize) INTO total_audit_records
  FROM pg_tables t
  JOIN pg_namespace n ON n.nspname = t.schemaname  
  WHERE t.tablename LIKE 'audit_logs_%'
    AND n.nspname = 'public';
  
  RETURN QUERY SELECT 
    'total_audit_records'::TEXT,
    COALESCE(total_audit_records, 0)::NUMERIC,
    'records'::TEXT,
    CASE WHEN total_audit_records > 10000000 THEN 'warning' ELSE 'ok' END::TEXT,
    CASE WHEN total_audit_records > 10000000 
         THEN 'Consider archiving old data' 
         ELSE 'Audit storage levels normal' END::TEXT;
  
  -- Insertion rate (records per hour in last 24h)
  SELECT count(*) / 24.0 INTO avg_insert_rate
  FROM audit_logs_partitioned
  WHERE created_at > NOW() - INTERVAL '24 hours';
  
  RETURN QUERY SELECT 
    'avg_insert_rate_24h'::TEXT,
    COALESCE(avg_insert_rate, 0)::NUMERIC,
    'records/hour'::TEXT,
    CASE WHEN avg_insert_rate > 1000 THEN 'warning' ELSE 'ok' END::TEXT,
    CASE WHEN avg_insert_rate > 1000 
         THEN 'High audit volume - monitor partition performance' 
         ELSE 'Audit insert rate normal' END::TEXT;
  
  -- Partition size analysis
  WITH partition_sizes AS (
    SELECT 
      schemaname,
      tablename,
      pg_total_relation_size(schemaname||'.'||tablename) / 1024 / 1024 as size_mb
    FROM pg_tables 
    WHERE tablename LIKE 'audit_logs_%'
  )
  SELECT max(size_mb) INTO largest_partition_size FROM partition_sizes;
  
  RETURN QUERY SELECT 
    'largest_partition_size'::TEXT,
    COALESCE(largest_partition_size, 0)::NUMERIC,
    'MB'::TEXT,
    CASE WHEN largest_partition_size > 1000 THEN 'warning' ELSE 'ok' END::TEXT,
    CASE WHEN largest_partition_size > 1000 
         THEN 'Large partition detected - consider more frequent archiving' 
         ELSE 'Partition sizes healthy' END::TEXT;
  
  -- Oldest record age
  SELECT EXTRACT(DAYS FROM (NOW() - min(created_at)))::INTEGER INTO oldest_record_age_days
  FROM audit_logs_partitioned;
  
  RETURN QUERY SELECT 
    'oldest_record_age'::TEXT,
    COALESCE(oldest_record_age_days, 0)::NUMERIC,
    'days'::TEXT,
    CASE WHEN oldest_record_age_days > 365 THEN 'warning' ELSE 'ok' END::TEXT,
    CASE WHEN oldest_record_age_days > 365 
         THEN 'Old audit records found - review retention policy' 
         ELSE 'Record retention within policy' END::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- AUTOMATED MAINTENANCE
-- =============================================================================

-- Function to run automated audit maintenance
CREATE OR REPLACE FUNCTION run_audit_maintenance() RETURNS TABLE (
  task_name TEXT,
  status TEXT,
  details TEXT,
  duration_ms BIGINT
) AS $$
DECLARE
  start_time TIMESTAMP;
  end_time TIMESTAMP;
  task_duration BIGINT;
BEGIN
  -- Ensure partitions exist
  start_time := clock_timestamp();
  PERFORM ensure_audit_partitions();
  end_time := clock_timestamp();
  task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'ensure_partitions'::TEXT,
    'completed'::TEXT,
    'Created missing audit log partitions'::TEXT,
    task_duration;
  
  -- Archive old data (if needed)
  start_time := clock_timestamp();
  BEGIN
    PERFORM archive_audit_data_to_warm();
    end_time := clock_timestamp();
    task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'archive_warm'::TEXT,
      'completed'::TEXT,
      'Archived old audit data to warm storage'::TEXT,
      task_duration;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 
      'archive_warm'::TEXT,
      'skipped'::TEXT,
      'No data ready for archiving or error: ' || SQLERRM,
      0::BIGINT;
  END;
  
  -- Update statistics
  start_time := clock_timestamp();
  EXECUTE 'ANALYZE audit_logs_partitioned';
  end_time := clock_timestamp();
  task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'analyze_partitions'::TEXT,
    'completed'::TEXT,
    'Updated statistics for audit partitions'::TEXT,
    task_duration;
END;
$$ LANGUAGE plpgsql;