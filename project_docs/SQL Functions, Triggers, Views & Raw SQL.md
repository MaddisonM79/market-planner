-- =============================================================================
-- Yarn Crafting SaaS - SQL Functions, Triggers, Views & Raw SQL
-- =============================================================================
-- This file contains all raw SQL that doesn't go into Prisma schema
-- Including functions, triggers, views, indexes, and stored procedures

-- =============================================================================
-- POSTGRESQL EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- =============================================================================
-- CATEGORY SYSTEM FUNCTIONS
-- =============================================================================

-- Function to get available categories for a tenant (system + custom)
CREATE OR REPLACE FUNCTION get_tenant_categories(
  p_tenant_id UUID,
  p_category_type_name VARCHAR(100)
) RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  code VARCHAR(50),
  description TEXT,
  color_hex VARCHAR(7),
  icon_name VARCHAR(50),
  parent_id UUID,
  level INTEGER,
  path TEXT,
  is_custom BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.code,
    c.description,
    c.color_hex,
    c.icon_name,
    c.parent_id,
    c.level,
    c.path,
    (c.tenant_id IS NOT NULL) as is_custom
  FROM categories c
  JOIN category_types ct ON c.category_type_id = ct.id
  WHERE ct.name = p_category_type_name
    AND c.is_active = true
    AND (c.tenant_id IS NULL OR c.tenant_id = p_tenant_id) -- System defaults + tenant custom
  ORDER BY c.level, c.sort_order, c.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update category usage counts
CREATE OR REPLACE FUNCTION increment_category_usage(p_category_id UUID) RETURNS VOID AS $$
BEGIN
  UPDATE categories 
  SET usage_count = usage_count + 1 
  WHERE id = p_category_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create a custom category for a tenant
CREATE OR REPLACE FUNCTION create_custom_category(
  p_tenant_id UUID,
  p_category_type_name VARCHAR(100),
  p_name VARCHAR(100),
  p_description TEXT DEFAULT NULL,
  p_parent_id UUID DEFAULT NULL,
  p_color_hex VARCHAR(7) DEFAULT NULL,
  p_icon_name VARCHAR(50) DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  category_type_id_val UUID;
  new_category_id UUID;
  parent_level INTEGER := 0;
  parent_path TEXT := '';
BEGIN
  -- Get category type
  SELECT id INTO category_type_id_val
  FROM category_types
  WHERE name = p_category_type_name AND allows_custom = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category type % not found or does not allow custom categories', p_category_type_name;
  END IF;
  
  -- If parent specified, get its level and path
  IF p_parent_id IS NOT NULL THEN
    SELECT level + 1, path || '/' || lower(name)
    INTO parent_level, parent_path
    FROM categories
    WHERE id = p_parent_id 
      AND (tenant_id = p_tenant_id OR tenant_id IS NULL);
      
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent category not found or not accessible';
    END IF;
  END IF;
  
  -- Insert new category
  INSERT INTO categories (
    category_type_id, tenant_id, name, description, parent_id, 
    color_hex, icon_name, level, path, created_by, updated_by
  ) VALUES (
    category_type_id_val, p_tenant_id, p_name, p_description, p_parent_id,
    p_color_hex, p_icon_name, parent_level, parent_path || '/' || lower(p_name),
    p_created_by, p_created_by
  ) RETURNING id INTO new_category_id;
  
  RETURN new_category_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get category hierarchy for display
CREATE OR REPLACE FUNCTION get_category_hierarchy(
  p_tenant_id UUID,
  p_category_type_name VARCHAR(100)
) RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  code VARCHAR(50),
  description TEXT,
  parent_id UUID,
  level INTEGER,
  path TEXT,
  color_hex VARCHAR(7),
  icon_name VARCHAR(50),
  usage_count INTEGER,
  is_custom BOOLEAN,
  children_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH category_tree AS (
    SELECT 
      c.id,
      c.name,
      c.code,
      c.description,
      c.parent_id,
      c.level,
      c.path,
      c.color_hex,
      c.icon_name,
      c.usage_count,
      (c.tenant_id IS NOT NULL) as is_custom,
      COUNT(children.id) as children_count
    FROM categories c
    JOIN category_types ct ON c.category_type_id = ct.id
    LEFT JOIN categories children ON children.parent_id = c.id 
      AND children.is_active = true
      AND (children.tenant_id IS NULL OR children.tenant_id = p_tenant_id)
    WHERE ct.name = p_category_type_name
      AND c.is_active = true
      AND (c.tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    GROUP BY c.id, c.name, c.code, c.description, c.parent_id, c.level, 
             c.path, c.color_hex, c.icon_name, c.usage_count, c.tenant_id
  )
  SELECT 
    ct.id,
    ct.name,
    ct.code,
    ct.description,
    ct.parent_id,
    ct.level,
    ct.path,
    ct.color_hex,
    ct.icon_name,
    ct.usage_count,
    ct.is_custom,
    ct.children_count
  FROM category_tree ct
  ORDER BY ct.level, ct.parent_id NULLS FIRST, ct.name;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate category assignment
CREATE OR REPLACE FUNCTION validate_category_assignment(
  p_tenant_id UUID,
  p_category_id UUID,
  p_required_type VARCHAR(100) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  category_exists BOOLEAN := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM categories c
    LEFT JOIN category_types ct ON c.category_type_id = ct.id
    WHERE c.id = p_category_id
      AND c.is_active = true
      AND (c.tenant_id IS NULL OR c.tenant_id = p_tenant_id)
      AND (p_required_type IS NULL OR ct.name = p_required_type)
  ) INTO category_exists;
  
  RETURN category_exists;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- MULTI-TENANT ROW-LEVEL SECURITY
-- =============================================================================

-- Create reusable function for current tenant
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to validate tenant access
CREATE OR REPLACE FUNCTION validate_tenant_access(
  p_user_id UUID,
  p_tenant_id UUID,
  p_required_role TEXT DEFAULT 'member'
) RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_tenant_id UUID;
BEGIN
  SELECT u.role, u.tenant_id 
  INTO user_role, user_tenant_id
  FROM users u
  WHERE u.id = p_user_id AND u.deleted_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check tenant membership
  IF user_tenant_id != p_tenant_id THEN
    RETURN FALSE;
  END IF;
  
  -- Check role hierarchy: owner > admin > member > viewer
  RETURN CASE p_required_role
    WHEN 'owner' THEN user_role = 'owner'
    WHEN 'admin' THEN user_role IN ('owner', 'admin')
    WHEN 'member' THEN user_role IN ('owner', 'admin', 'member')
    WHEN 'viewer' THEN user_role IN ('owner', 'admin', 'member', 'viewer')
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- COST CALCULATION FUNCTIONS
-- =============================================================================

-- Function to calculate product material cost
CREATE OR REPLACE FUNCTION calculate_product_material_cost(
  p_product_id UUID
) RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_cost DECIMAL(10,2) := 0;
BEGIN
  SELECT COALESCE(SUM(pm.total_cost), 0)
  INTO total_cost
  FROM product_materials pm
  WHERE pm.product_id = p_product_id 
    AND pm.deleted_at IS NULL
    AND pm.is_primary = true;
  
  RETURN total_cost;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate labor cost
CREATE OR REPLACE FUNCTION calculate_labor_cost(
  p_hours DECIMAL(6,2),
  p_labor_rate DECIMAL(8,2),
  p_complexity_multiplier DECIMAL(4,2) DEFAULT 1.0
) RETURNS DECIMAL(10,2) AS $$
BEGIN
  RETURN ROUND(p_hours * p_labor_rate * p_complexity_multiplier, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to recalculate all product costs
CREATE OR REPLACE FUNCTION recalculate_product_costs(
  p_tenant_id UUID,
  p_product_id UUID DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
  products_updated INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT p.id, p.estimated_hours, p.complexity_multiplier, u.labor_rate
    FROM products p
    JOIN users u ON u.tenant_id = p.tenant_id AND u.role IN ('owner', 'admin')
    WHERE p.tenant_id = p_tenant_id
      AND p.deleted_at IS NULL
      AND (p_product_id IS NULL OR p.id = p_product_id)
    ORDER BY p.updated_at DESC
    LIMIT 1000 -- Prevent runaway calculations
  LOOP
    UPDATE products SET
      material_cost = calculate_product_material_cost(rec.id),
      labor_cost = calculate_labor_cost(
        rec.estimated_hours, 
        rec.labor_rate, 
        COALESCE(rec.complexity_multiplier, 1.0)
      ),
      last_cost_calculation_at = NOW(),
      cost_calculation_version = cost_calculation_version + 1
    WHERE id = rec.id;
    
    -- Update total cost and profit margin
    UPDATE products SET
      total_cost_to_manufacture = COALESCE(material_cost, 0) + COALESCE(labor_cost, 0) + COALESCE(overhead_cost, 0),
      profit_margin = CASE 
        WHEN sale_price > 0 AND total_cost_to_manufacture > 0 THEN
          ROUND(((sale_price - total_cost_to_manufacture) / sale_price * 100), 2)
        ELSE NULL
      END
    WHERE id = rec.id;
    
    products_updated := products_updated + 1;
  END LOOP;
  
  RETURN products_updated;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- INVENTORY MANAGEMENT FUNCTIONS
-- =============================================================================

-- Function to check for low inventory
CREATE OR REPLACE FUNCTION get_low_inventory_materials(
  p_tenant_id UUID
) RETURNS TABLE (
  material_id UUID,
  material_name VARCHAR(255),
  current_quantity DECIMAL(10,2),
  reorder_level DECIMAL(10,2),
  suggested_reorder_quantity DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.name,
    m.quantity_available,
    m.reorder_level,
    m.reorder_quantity
  FROM materials m
  WHERE m.tenant_id = p_tenant_id
    AND m.deleted_at IS NULL
    AND m.quantity_available IS NOT NULL
    AND m.reorder_level IS NOT NULL
    AND m.quantity_available <= m.reorder_level
  ORDER BY (m.quantity_available / NULLIF(m.reorder_level, 0)) ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- AUDIT TRAIL FUNCTIONS
-- =============================================================================

-- Function to automatically log changes
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS TRIGGER AS $$
DECLARE
  audit_data JSONB;
  tenant_id_val UUID;
  user_id_val UUID;
BEGIN
  -- Extract tenant_id from the record
  IF TG_OP = 'DELETE' THEN
    tenant_id_val := OLD.tenant_id;
  ELSE
    tenant_id_val := NEW.tenant_id;
  END IF;
  
  -- Get current user ID
  user_id_val := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  
  -- Build audit record
  audit_data := jsonb_build_object(
    'table_name', TG_TABLE_NAME,
    'operation', TG_OP,
    'tenant_id', tenant_id_val,
    'user_id', user_id_val,
    'timestamp', NOW()
  );
  
  IF TG_OP = 'DELETE' THEN
    audit_data := audit_data || jsonb_build_object('old_values', to_jsonb(OLD));
    INSERT INTO audit_logs (tenant_id, table_name, record_id, operation, old_values, user_id)
    VALUES (tenant_id_val, TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), user_id_val);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    audit_data := audit_data || jsonb_build_object(
      'old_values', to_jsonb(OLD),
      'new_values', to_jsonb(NEW)
    );
    INSERT INTO audit_logs (tenant_id, table_name, record_id, operation, old_values, new_values, user_id)
    VALUES (tenant_id_val, TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), user_id_val);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    audit_data := audit_data || jsonb_build_object('new_values', to_jsonb(NEW));
    INSERT INTO audit_logs (tenant_id, table_name, record_id, operation, new_values, user_id)
    VALUES (tenant_id_val, TG_TABLE_NAME, NEW.id, TG_OP, to_jsonb(NEW), user_id_val);
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CATEGORY USAGE TRACKING TRIGGERS
-- =============================================================================

-- Function to update material usage when product materials change
CREATE OR REPLACE FUNCTION update_material_usage_stats() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment usage stats
    UPDATE materials SET
      times_used = times_used + 1,
      total_quantity_used = total_quantity_used + NEW.quantity_used,
      last_used_at = NOW()
    WHERE id = NEW.material_id;
    RETURN NEW;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Adjust usage stats
    UPDATE materials SET
      total_quantity_used = total_quantity_used - OLD.quantity_used + NEW.quantity_used,
      last_used_at = NOW()
    WHERE id = NEW.material_id;
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement usage stats
    UPDATE materials SET
      times_used = GREATEST(times_used - 1, 0),
      total_quantity_used = GREATEST(total_quantity_used - OLD.quantity_used, 0)
    WHERE id = OLD.material_id;
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update usage counts and maintain hierarchy
CREATE OR REPLACE FUNCTION update_category_usage_trigger() RETURNS TRIGGER AS $$
BEGIN
  -- For materials table
  IF TG_TABLE_NAME = 'materials' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM increment_category_usage(NEW.category_id);
      IF NEW.subcategory_id IS NOT NULL THEN
        PERFORM increment_category_usage(NEW.subcategory_id);
      END IF;
      IF NEW.yarn_weight_id IS NOT NULL THEN
        PERFORM increment_category_usage(NEW.yarn_weight_id);
      END IF;
      IF NEW.fiber_type_id IS NOT NULL THEN
        PERFORM increment_category_usage(NEW.fiber_type_id);
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Handle category changes
      IF OLD.category_id != NEW.category_id THEN
        UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.category_id;
        PERFORM increment_category_usage(NEW.category_id);
      END IF;
      -- Handle subcategory changes
      IF OLD.subcategory_id IS DISTINCT FROM NEW.subcategory_id THEN
        IF OLD.subcategory_id IS NOT NULL THEN
          UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.subcategory_id;
        END IF;
        IF NEW.subcategory_id IS NOT NULL THEN
          PERFORM increment_category_usage(NEW.subcategory_id);
        END IF;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.category_id;
      IF OLD.subcategory_id IS NOT NULL THEN
        UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.subcategory_id;
      END IF;
    END IF;
  END IF;
  
  -- For products table
  IF TG_TABLE_NAME = 'products' THEN
    IF TG_OP = 'INSERT' THEN
      PERFORM increment_category_usage(NEW.category_id);
      IF NEW.subcategory_id IS NOT NULL THEN
        PERFORM increment_category_usage(NEW.subcategory_id);
      END IF;
      IF NEW.difficulty_level_id IS NOT NULL THEN
        PERFORM increment_category_usage(NEW.difficulty_level_id);
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.category_id != NEW.category_id THEN
        UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.category_id;
        PERFORM increment_category_usage(NEW.category_id);
      END IF;
      IF OLD.subcategory_id IS DISTINCT FROM NEW.subcategory_id THEN
        IF OLD.subcategory_id IS NOT NULL THEN
          UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.subcategory_id;
        END IF;
        IF NEW.subcategory_id IS NOT NULL THEN
          PERFORM increment_category_usage(NEW.subcategory_id);
        END IF;
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.category_id;
      IF OLD.subcategory_id IS NOT NULL THEN
        UPDATE categories SET usage_count = GREATEST(usage_count - 1, 0) WHERE id = OLD.subcategory_id;
      END IF;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MATERIALIZED VIEWS
-- =============================================================================

-- Materialized view for product cost summaries
CREATE MATERIALIZED VIEW product_cost_summary AS
SELECT 
  p.id,
  p.tenant_id,
  p.name,
  c.name as category_name,
  p.status,
  COALESCE(pm_costs.total_material_cost, 0) as material_cost_calculated,
  p.labor_cost,
  p.total_cost_to_manufacture,
  p.sale_price,
  p.profit_margin,
  CASE 
    WHEN p.last_cost_calculation_at < GREATEST(p.updated_at, COALESCE(pm_costs.max_updated_at, p.updated_at))
    THEN true 
    ELSE false 
  END as needs_cost_recalculation,
  p.updated_at
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN (
  SELECT 
    pm.product_id,
    SUM(pm.total_cost) as total_material_cost,
    MAX(pm.updated_at) as max_updated_at
  FROM product_materials pm
  WHERE pm.deleted_at IS NULL AND pm.is_primary = true
  GROUP BY pm.product_id
) pm_costs ON p.id = pm_costs.product_id
WHERE p.deleted_at IS NULL;

-- Create unique index on materialized view
CREATE UNIQUE INDEX idx_product_cost_summary_id ON product_cost_summary(id);
CREATE INDEX idx_product_cost_summary_tenant ON product_cost_summary(tenant_id, status);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_product_cost_summary() RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY product_cost_summary;
END;
$$ LANGUAGE plpgsql;

-- View for inventory alerts
CREATE OR REPLACE VIEW inventory_alerts AS
SELECT 
  m.id,
  m.tenant_id,
  m.name,
  c.name as category_name,
  m.quantity_available,
  m.reorder_level,
  m.reorder_quantity,
  CASE 
    WHEN m.quantity_available <= 0 THEN 'out_of_stock'
    WHEN m.quantity_available <= m.reorder_level * 0.5 THEN 'critical'
    WHEN m.quantity_available <= m.reorder_level THEN 'low'
    ELSE 'ok'
  END as alert_level,
  ROUND((m.quantity_available / NULLIF(m.reorder_level, 0)) * 100, 1) as inventory_percentage
FROM materials m
LEFT JOIN categories c ON m.category_id = c.id
WHERE m.deleted_at IS NULL
  AND m.quantity_available IS NOT NULL
  AND m.reorder_level IS NOT NULL
ORDER BY 
  CASE 
    WHEN m.quantity_available <= 0 THEN 1
    WHEN m.quantity_available <= m.reorder_level * 0.5 THEN 2
    WHEN m.quantity_available <= m.reorder_level THEN 3
    ELSE 4
  END,
  m.quantity_available / NULLIF(m.reorder_level, 0) ASC;

-- =============================================================================
-- PERFORMANCE & MONITORING FUNCTIONS
-- =============================================================================

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries(
  min_duration_ms INT DEFAULT 1000
) RETURNS TABLE (
  query_text TEXT,
  avg_duration_ms NUMERIC,
  total_calls BIGINT,
  total_time_ms NUMERIC,
  rows_per_call NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pss.query,
    ROUND(pss.mean_exec_time::NUMERIC, 2) as avg_duration_ms,
    pss.calls,
    ROUND(pss.total_exec_time::NUMERIC, 2) as total_time_ms,
    ROUND((pss.rows::NUMERIC / pss.calls), 2) as rows_per_call
  FROM pg_stat_statements pss
  WHERE pss.mean_exec_time >= min_duration_ms
  ORDER BY pss.mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Function to monitor table sizes and growth
CREATE OR REPLACE FUNCTION monitor_table_sizes() RETURNS TABLE (
  table_name TEXT,
  size_mb NUMERIC,
  row_count BIGINT,
  bloat_ratio NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.table_name::TEXT,
    ROUND((pg_total_relation_size(t.schemaname||'.'||t.tablename)::NUMERIC / 1024 / 1024), 2) as size_mb,
    c.reltuples::BIGINT as row_count,
    ROUND(
      CASE 
        WHEN pg_total_relation_size(t.schemaname||'.'||t.tablename) > 0 
        THEN (pg_total_relation_size(t.schemaname||'.'||t.tablename)::NUMERIC / 
              NULLIF(pg_relation_size(t.schemaname||'.'||t.tablename), 0)::NUMERIC)
        ELSE 1 
      END, 2
    ) as bloat_ratio
  FROM pg_tables t
  JOIN pg_class c ON c.relname = t.tablename
  WHERE t.schemaname = 'public'
  ORDER BY pg_total_relation_size(t.schemaname||'.'||t.tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Database health check function
CREATE OR REPLACE FUNCTION database_health_check() RETURNS JSON AS $$
DECLARE
  result JSON;
  connection_count INT;
  slow_query_count INT;
  lock_count INT;
  avg_response_time NUMERIC;
BEGIN
  -- Get current connections
  SELECT COUNT(*) INTO connection_count
  FROM pg_stat_activity
  WHERE state = 'active';
  
  -- Get slow queries in last hour
  SELECT COUNT(*) INTO slow_query_count
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000;
  
  -- Get current locks
  SELECT COUNT(*) INTO lock_count
  FROM pg_locks l
  JOIN pg_stat_activity a ON l.pid = a.pid
  WHERE l.granted = false;
  
  -- Get average response time
  SELECT COALESCE(ROUND(AVG(mean_exec_time)::NUMERIC, 2), 0) INTO avg_response_time
  FROM pg_stat_statements
  WHERE calls > 10;
  
  -- Build health report
  SELECT json_build_object(
    'timestamp', NOW(),
    'status', CASE 
      WHEN connection_count > 90 THEN 'warning'
      WHEN slow_query_count > 10 THEN 'warning'
      WHEN lock_count > 5 THEN 'warning'
      WHEN avg_response_time > 500 THEN 'warning'
      ELSE 'healthy'
    END,
    'metrics', json_build_object(
      'active_connections', connection_count,
      'slow_queries_last_hour', slow_query_count,
      'blocked_queries', lock_count,
      'avg_response_time_ms', avg_response_time
    ),
    'recommendations', CASE
      WHEN connection_count > 90 THEN json_build_array('Consider connection pooling optimization')
      WHEN slow_query_count > 10 THEN json_build_array('Review and optimize slow queries')
      WHEN lock_count > 5 THEN json_build_array('Investigate blocking queries')
      WHEN avg_response_time > 500 THEN json_build_array('Database performance tuning needed')
      ELSE json_build_array('Database is performing well')
    END
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function for automated maintenance
CREATE OR REPLACE FUNCTION run_maintenance_tasks() RETURNS TABLE (
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
  -- Update table statistics
  start_time := clock_timestamp();
  ANALYZE;
  end_time := clock_timestamp();
  task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'update_statistics'::TEXT,
    'completed'::TEXT,
    'Updated table statistics for query planner'::TEXT,
    task_duration;
  
  -- Refresh materialized views
  start_time := clock_timestamp();
  PERFORM refresh_product_cost_summary();
  end_time := clock_timestamp();
  task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'refresh_materialized_views'::TEXT,
    'completed'::TEXT,
    'Refreshed product cost summary view'::TEXT,
    task_duration;
  
  -- Clean up old audit logs (keep 90 days)
  start_time := clock_timestamp();
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  end_time := clock_timestamp();
  task_duration := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
  
  RETURN QUERY SELECT 
    'cleanup_audit_logs'::TEXT,
    'completed'::TEXT,
    format('Cleaned up audit logs older than 90 days, deleted %s rows', 
           (SELECT count(*) FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days'))::TEXT,
    task_duration;
  
  -- Reset daily rate limit counters (if past midnight)
  UPDATE integration_configs 
  SET requests_today = 0 
  WHERE updated_at::DATE < CURRENT_DATE;
  
  RETURN QUERY SELECT 
    'reset_rate_limits'::TEXT,
    'completed'::TEXT,
    'Reset daily rate limit counters'::TEXT,
    0::BIGINT;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DATA EXPORT AND BACKUP FUNCTIONS
-- =============================================================================

-- Function to export tenant data for backup or migration
CREATE OR REPLACE FUNCTION export_tenant_data(
  p_tenant_id UUID,
  p_include_deleted BOOLEAN DEFAULT false
) RETURNS JSON AS $$
DECLARE
  result JSON;
  tenant_data RECORD;
BEGIN
  -- Get tenant information
  SELECT row_to_json(t) INTO tenant_data
  FROM tenants t
  WHERE t.id = p_tenant_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;
  
  -- Build complete export
  SELECT json_build_object(
    'tenant', tenant_data,
    'export_timestamp', NOW(),
    'include_deleted', p_include_deleted,
    'users', (
      SELECT json_agg(row_to_json(u))
      FROM users u
      WHERE u.tenant_id = p_tenant_id
        AND (p_include_deleted OR u.deleted_at IS NULL)
    ),
    'materials', (
      SELECT json_agg(row_to_json(m))
      FROM materials m
      WHERE m.tenant_id = p_tenant_id
        AND (p_include_deleted OR m.deleted_at IS NULL)
    ),
    'products', (
      SELECT json_agg(row_to_json(p))
      FROM products p
      WHERE p.tenant_id = p_tenant_id
        AND (p_include_deleted OR p.deleted_at IS NULL)
    ),
    'product_materials', (
      SELECT json_agg(row_to_json(pm))
      FROM product_materials pm
      WHERE pm.tenant_id = p_tenant_id
        AND (p_include_deleted OR pm.deleted_at IS NULL)
    ),
    'market_events', (
      SELECT json_agg(row_to_json(me))
      FROM market_events me
      WHERE me.tenant_id = p_tenant_id
        AND (p_include_deleted OR me.deleted_at IS NULL)
    ),
    'export_jobs', (
      SELECT json_agg(row_to_json(ej))
      FROM export_jobs ej
      WHERE ej.tenant_id = p_tenant_id
        AND (p_include_deleted OR ej.deleted_at IS NULL)
    ),
    'files', (
      SELECT json_agg(row_to_json(f))
      FROM files f
      WHERE f.tenant_id = p_tenant_id
        AND (p_include_deleted OR f.deleted_at IS NULL)
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to test backup integrity
CREATE OR REPLACE FUNCTION test_backup_integrity(
  backup_timestamp TIMESTAMP DEFAULT NOW()
) RETURNS TABLE (
  test_name TEXT,
  status TEXT,
  details TEXT
) AS $$
BEGIN
  -- Test critical table counts
  RETURN QUERY
  SELECT 
    'critical_table_counts'::TEXT,
    CASE WHEN min_count > 0 THEN 'pass' ELSE 'fail' END::TEXT,
    format('Tenants: %s, Users: %s, Products: %s, Materials: %s', 
           tenant_count, user_count, product_count, material_count)::TEXT
  FROM (
    SELECT 
      (SELECT count(*) FROM tenants WHERE deleted_at IS NULL) as tenant_count,
      (SELECT count(*) FROM users WHERE deleted_at IS NULL) as user_count,
      (SELECT count(*) FROM products WHERE deleted_at IS NULL) as product_count,
      (SELECT count(*) FROM materials WHERE deleted_at IS NULL) as material_count,
      LEAST(
        (SELECT count(*) FROM tenants WHERE deleted_at IS NULL),
        (SELECT count(*) FROM users WHERE deleted_at IS NULL)
      ) as min_count
  ) t;
  
  -- Test referential integrity
  RETURN QUERY
  SELECT 
    'referential_integrity'::TEXT,
    CASE WHEN orphan_count = 0 THEN 'pass' ELSE 'fail' END::TEXT,
    format('Found %s orphaned records', orphan_count)::TEXT
  FROM (
    SELECT (
      -- Check for orphaned product materials
      (SELECT count(*) FROM product_materials pm 
       LEFT JOIN products p ON pm.product_id = p.id 
       WHERE p.id IS NULL) +
      -- Check for orphaned users
      (SELECT count(*) FROM users u 
       LEFT JOIN tenants t ON u.tenant_id = t.id 
       WHERE t.id IS NULL)
    ) as orphan_count
  ) t;
  
  -- Test audit log completeness
  RETURN QUERY
  SELECT 
    'audit_log_completeness'::TEXT,
    CASE WHEN recent_audit_count > 0 THEN 'pass' ELSE 'fail' END::TEXT,
    format('Found %s recent audit entries', recent_audit_count)::TEXT
  FROM (
    SELECT count(*) as recent_audit_count
    FROM audit_logs
    WHERE created_at > NOW() - INTERVAL '24 hours'
  ) t;
END;
$$ LANGUAGE plpgsql;