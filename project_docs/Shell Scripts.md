#!/bin/bash
# =============================================================================
# Yarn Crafting SaaS - Shell Scripts
# =============================================================================
# Collection of deployment, backup, and maintenance scripts

# =============================================================================
# DEPLOYMENT SCRIPTS
# =============================================================================

# -----------------------------------------------------------------------------
# deploy-database.sh - Database deployment with rollback capability
# -----------------------------------------------------------------------------
deploy_database() {
    local ENVIRONMENT=${1:-staging}
    local BACKUP_DIR="./backups"
    local TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    local BACKUP_FILE="${BACKUP_DIR}/pre-deploy-${ENVIRONMENT}-${TIMESTAMP}.sql"
    
    echo "🚀 Starting database deployment for environment: $ENVIRONMENT"
    
    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        echo "❌ Invalid environment. Use: development, staging, or production"
        exit 1
    fi
    
    # Load environment variables
    if [ -f ".env.${ENVIRONMENT}" ]; then
        source ".env.${ENVIRONMENT}"
    else
        echo "❌ Environment file .env.${ENVIRONMENT} not found"
        exit 1
    fi
    
    # Validate required variables
    if [ -z "$DATABASE_URL" ]; then
        echo "❌ DATABASE_URL not set in environment"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # Step 1: Create backup
    echo "📦 Creating pre-deployment backup..."
    if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
        echo "✅ Backup created: $BACKUP_FILE"
    else
        echo "❌ Backup failed"
        exit 1
    fi
    
    # Step 2: Run Prisma migrations
    echo "🔄 Running Prisma migrations..."
    if npx prisma migrate deploy; then
        echo "✅ Prisma migrations completed"
    else
        echo "❌ Prisma migrations failed"
        echo "🔄 Rolling back..."
        psql "$DATABASE_URL" < "$BACKUP_FILE"
        exit 1
    fi
    
    # Step 3: Apply custom SQL functions
    echo "🔄 Applying custom SQL functions..."
    if psql "$DATABASE_URL" < "./sql/functions.sql"; then
        echo "✅ SQL functions applied"
    else
        echo "❌ SQL functions failed"
        echo "🔄 Rolling back..."
        psql "$DATABASE_URL" < "$BACKUP_FILE"
        exit 1
    fi
    
    # Step 4: Create indexes
    echo "🔄 Creating performance indexes..."
    if psql "$DATABASE_URL" < "./sql/indexes.sql"; then
        echo "✅ Indexes created"
    else
        echo "⚠️  Index creation failed (non-critical)"
    fi
    
    # Step 5: Apply triggers
    echo "🔄 Creating triggers..."
    if psql "$DATABASE_URL" < "./sql/triggers.sql"; then
        echo "✅ Triggers created"
    else
        echo "❌ Trigger creation failed"
        echo "🔄 Rolling back..."
        psql "$DATABASE_URL" < "$BACKUP_FILE"
        exit 1
    fi
    
    # Step 6: Seed default data
    if [ "$ENVIRONMENT" = "development" ] || [ "$ENVIRONMENT" = "staging" ]; then
        echo "🌱 Seeding default data..."
        if npx prisma db seed; then
            echo "✅ Seed data applied"
        else
            echo "⚠️  Seed data failed (non-critical)"
        fi
    fi
    
    # Step 7: Validate deployment
    echo "🔍 Validating deployment..."
    VALIDATION_RESULT=$(psql "$DATABASE_URL" -t -c "SELECT * FROM test_backup_integrity();")
    if echo "$VALIDATION_RESULT" | grep -q "pass"; then
        echo "✅ Deployment validation passed"
    else
        echo "❌ Deployment validation failed"
        echo "$VALIDATION_RESULT"
        exit 1
    fi
    
    # Step 8: Cleanup old backups (keep last 10)
    echo "🧹 Cleaning up old backups..."
    find "$BACKUP_DIR" -name "pre-deploy-${ENVIRONMENT}-*.sql" -type f | sort -r | tail -n +11 | xargs rm -f
    
    echo "🎉 Database deployment completed successfully!"
    echo "📊 Backup location: $BACKUP_FILE"
}

# -----------------------------------------------------------------------------
# rollback-database.sh - Emergency rollback script
# -----------------------------------------------------------------------------
rollback_database() {
    local ENVIRONMENT=${1:-staging}
    local BACKUP_FILE=${2}
    
    if [ -z "$BACKUP_FILE" ]; then
        echo "❌ Usage: rollback_database <environment> <backup_file>"
        echo "Available backups:"
        ls -la ./backups/pre-deploy-${ENVIRONMENT}-*.sql 2>/dev/null || echo "No backups found"
        exit 1
    fi
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    echo "⚠️  WARNING: This will rollback the database to a previous state!"
    echo "🔄 Rolling back to: $BACKUP_FILE"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Load environment
        source ".env.${ENVIRONMENT}"
        
        # Stop application services
        echo "🛑 Stopping application services..."
        systemctl stop yarn-crafting-api 2>/dev/null || echo "Service not running"
        systemctl stop yarn-crafting-worker 2>/dev/null || echo "Worker not running"
        
        # Restore database
        echo "🔄 Restoring database..."
        if psql "$DATABASE_URL" < "$BACKUP_FILE"; then
            echo "✅ Database restored successfully"
        else
            echo "❌ Database restore failed"
            exit 1
        fi
        
        # Start services
        echo "▶️  Starting application services..."
        systemctl start yarn-crafting-api
        systemctl start yarn-crafting-worker
        
        echo "🎉 Rollback completed successfully!"
    else
        echo "❌ Rollback cancelled"
    fi
}

# =============================================================================
# BACKUP AND RECOVERY SCRIPTS
# =============================================================================

# -----------------------------------------------------------------------------
# backup-database.sh - Comprehensive backup script
# -----------------------------------------------------------------------------
backup_database() {
    local ENVIRONMENT=${1:-production}
    local BACKUP_TYPE=${2:-full}  # full, incremental, schema-only
    local BACKUP_DIR="./backups/$(date +%Y/%m)"
    local TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    local SPACES_BUCKET="yarn-crafting-backups"
    
    echo "📦 Starting $BACKUP_TYPE backup for $ENVIRONMENT environment"
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    case $BACKUP_TYPE in
        "full")
            BACKUP_FILE="${BACKUP_DIR}/full-backup-${ENVIRONMENT}-${TIMESTAMP}.sql"
            echo "🔄 Creating full database backup..."
            pg_dump --verbose --clean --create --format=custom "$DATABASE_URL" > "$BACKUP_FILE"
            ;;
        "schema-only")
            BACKUP_FILE="${BACKUP_DIR}/schema-backup-${ENVIRONMENT}-${TIMESTAMP}.sql"
            echo "🔄 Creating schema-only backup..."
            pg_dump --verbose --schema-only --format=custom "$DATABASE_URL" > "$BACKUP_FILE"
            ;;
        "data-only")
            BACKUP_FILE="${BACKUP_DIR}/data-backup-${ENVIRONMENT}-${TIMESTAMP}.sql"
            echo "🔄 Creating data-only backup..."
            pg_dump --verbose --data-only --format=custom "$DATABASE_URL" > "$BACKUP_FILE"
            ;;
        *)
            echo "❌ Invalid backup type. Use: full, schema-only, data-only"
            exit 1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup created: $BACKUP_FILE"
        
        # Compress backup
        echo "🗜️  Compressing backup..."
        gzip "$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE}.gz"
        
        # Upload to DigitalOcean Spaces (if configured)
        if [ ! -z "$DO_SPACES_KEY" ] && [ ! -z "$DO_SPACES_SECRET" ]; then
            echo "☁️  Uploading to DigitalOcean Spaces..."
            s3cmd put "$BACKUP_FILE" "s3://${SPACES_BUCKET}/$(basename $BACKUP_FILE)" \
                --access_key="$DO_SPACES_KEY" \
                --secret_key="$DO_SPACES_SECRET" \
                --host="nyc3.digitaloceanspaces.com" \
                --host-bucket="%(bucket)s.nyc3.digitaloceanspaces.com"
            
            if [ $? -eq 0 ]; then
                echo "✅ Backup uploaded to cloud storage"
            else
                echo "⚠️  Cloud upload failed (backup still available locally)"
            fi
        fi
        
        # Verify backup integrity
        echo "🔍 Verifying backup integrity..."
        if pg_restore --list "$BACKUP_FILE" > /dev/null 2>&1; then
            echo "✅ Backup integrity verified"
        else
            echo "❌ Backup integrity check failed"
            exit 1
        fi
        
        # Cleanup old local backups (keep last 7 days)
        echo "🧹 Cleaning up old backups..."
        find "./backups" -name "*-backup-${ENVIRONMENT}-*.sql.gz" -mtime +7 -delete
        
        echo "🎉 Backup completed successfully!"
        echo "📁 Local: $BACKUP_FILE"
        
    else
        echo "❌ Backup failed"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# restore-database.sh - Point-in-time recovery
# -----------------------------------------------------------------------------
restore_database() {
    local ENVIRONMENT=${1:-staging}
    local BACKUP_FILE=${2}
    local RESTORE_DB=${3:-"${DATABASE_NAME}_recovery"}
    
    if [ -z "$BACKUP_FILE" ]; then
        echo "❌ Usage: restore_database <environment> <backup_file> [target_db_name]"
        exit 1
    fi
    
    echo "🔄 Starting database restore..."
    echo "📁 Source: $BACKUP_FILE"
    echo "🎯 Target: $RESTORE_DB"
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    # Extract if gzipped
    if [[ "$BACKUP_FILE" == *.gz ]]; then
        echo "📦 Extracting compressed backup..."
        gunzip -k "$BACKUP_FILE"
        BACKUP_FILE="${BACKUP_FILE%.*}"
    fi
    
    # Verify backup file exists
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ Backup file not found: $BACKUP_FILE"
        exit 1
    fi
    
    # Create target database
    echo "🏗️  Creating target database..."
    createdb "$RESTORE_DB" || echo "Database may already exist"
    
    # Restore backup
    echo "🔄 Restoring backup..."
    if pg_restore --verbose --clean --create --dbname="$RESTORE_DB" "$BACKUP_FILE"; then
        echo "✅ Database restore completed"
        
        # Run validation
        echo "🔍 Validating restored data..."
        VALIDATION_RESULT=$(psql "postgresql://localhost/$RESTORE_DB" -t -c "SELECT * FROM test_backup_integrity();")
        
        if echo "$VALIDATION_RESULT" | grep -q "pass"; then
            echo "✅ Restore validation passed"
            echo "🎉 Database restored successfully to: $RESTORE_DB"
        else
            echo "⚠️  Restore validation warnings:"
            echo "$VALIDATION_RESULT"
        fi
        
    else
        echo "❌ Database restore failed"
        exit 1
    fi
}

# =============================================================================
# MAINTENANCE SCRIPTS
# =============================================================================

# -----------------------------------------------------------------------------
# maintenance.sh - Automated maintenance tasks
# -----------------------------------------------------------------------------
run_maintenance() {
    local ENVIRONMENT=${1:-production}
    local TASK=${2:-all}  # all, vacuum, analyze, cleanup, stats
    
    echo "🔧 Starting maintenance tasks for $ENVIRONMENT"
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    case $TASK in
        "vacuum"|"all")
            echo "🧹 Running VACUUM ANALYZE..."
            psql "$DATABASE_URL" -c "VACUUM ANALYZE;"
            echo "✅ VACUUM ANALYZE completed"
            ;;
    esac
    
    case $TASK in
        "cleanup"|"all")
            echo "🗑️  Running cleanup tasks..."
            psql "$DATABASE_URL" -c "SELECT * FROM run_maintenance_tasks();"
            echo "✅ Cleanup tasks completed"
            ;;
    esac
    
    case $TASK in
        "stats"|"all")
            echo "📊 Updating statistics..."
            psql "$DATABASE_URL" -c "ANALYZE;"
            echo "✅ Statistics updated"
            ;;
    esac
    
    case $TASK in
        "reindex"|"all")
            if [ "$ENVIRONMENT" != "production" ]; then
                echo "🔧 Reindexing (non-production only)..."
                psql "$DATABASE_URL" -c "REINDEX DATABASE CONCURRENTLY;"
                echo "✅ Reindexing completed"
            else
                echo "⚠️  Skipping reindex in production (run manually if needed)"
            fi
            ;;
    esac
    
    echo "🎉 Maintenance completed!"
}

# -----------------------------------------------------------------------------
# health-check.sh - Database health monitoring
# -----------------------------------------------------------------------------
health_check() {
    local ENVIRONMENT=${1:-production}
    local ALERT_WEBHOOK=${2}
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    echo "🏥 Running health check for $ENVIRONMENT..."
    
    # Get health status
    HEALTH_JSON=$(psql "$DATABASE_URL" -t -c "SELECT database_health_check();")
    
    # Parse status
    STATUS=$(echo "$HEALTH_JSON" | jq -r '.status // "unknown"')
    
    echo "📊 Health Status: $STATUS"
    echo "$HEALTH_JSON" | jq '.'
    
    # Send alerts for warnings/critical
    if [ "$STATUS" = "warning" ] || [ "$STATUS" = "critical" ]; then
        echo "⚠️  Health issue detected!"
        
        if [ ! -z "$ALERT_WEBHOOK" ]; then
            echo "📢 Sending alert notification..."
            curl -X POST "$ALERT_WEBHOOK" \
                -H "Content-Type: application/json" \
                -d "{
                    \"text\": \"🚨 Database Health Alert - $ENVIRONMENT\",
                    \"attachments\": [{
                        \"color\": \"$([ "$STATUS" = "critical" ] && echo "danger" || echo "warning")\",
                        \"fields\": [{
                            \"title\": \"Status\",
                            \"value\": \"$STATUS\",
                            \"short\": true
                        }],
                        \"text\": \"$HEALTH_JSON\"
                    }]
                }"
        fi
        
        # Exit with error for monitoring systems
        exit 1
    else
        echo "✅ All systems healthy"
        exit 0
    fi
}

# -----------------------------------------------------------------------------
# monitor-performance.sh - Performance monitoring
# -----------------------------------------------------------------------------
monitor_performance() {
    local ENVIRONMENT=${1:-production}
    local REPORT_FILE="./reports/performance-$(date +%Y%m%d_%H%M%S).txt"
    
    echo "📈 Monitoring database performance for $ENVIRONMENT..."
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    # Create reports directory
    mkdir -p "./reports"
    
    # Generate performance report
    {
        echo "=== Database Performance Report ==="
        echo "Generated: $(date)"
        echo "Environment: $ENVIRONMENT"
        echo ""
        
        echo "=== Slow Queries (>1000ms) ==="
        psql "$DATABASE_URL" -c "SELECT * FROM analyze_slow_queries(1000);"
        echo ""
        
        echo "=== Table Sizes ==="
        psql "$DATABASE_URL" -c "SELECT * FROM monitor_table_sizes();"
        echo ""
        
        echo "=== Connection Stats ==="
        psql "$DATABASE_URL" -c "
            SELECT 
                state,
                count(*) as connections,
                round(avg(extract(epoch from now() - query_start))) as avg_duration_seconds
            FROM pg_stat_activity 
            WHERE state IS NOT NULL 
            GROUP BY state 
            ORDER BY connections DESC;"
        echo ""
        
        echo "=== Cache Hit Ratio ==="
        psql "$DATABASE_URL" -c "
            SELECT 
                schemaname,
                relname,
                heap_blks_read,
                heap_blks_hit,
                round(heap_blks_hit::numeric / (heap_blks_hit + heap_blks_read + 1) * 100, 2) as cache_hit_ratio
            FROM pg_statio_user_tables 
            WHERE heap_blks_read + heap_blks_hit > 0
            ORDER BY cache_hit_ratio ASC
            LIMIT 10;"
        echo ""
        
        echo "=== Index Usage ==="
        psql "$DATABASE_URL" -c "
            SELECT 
                schemaname,
                relname,
                indexrelname,
                idx_scan,
                idx_tup_read,
                idx_tup_fetch
            FROM pg_stat_user_indexes 
            ORDER BY idx_scan DESC 
            LIMIT 10;"
        
    } > "$REPORT_FILE"
    
    echo "✅ Performance report generated: $REPORT_FILE"
    
    # Display summary
    echo ""
    echo "📊 Quick Summary:"
    echo "• Slow queries: $(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_statements WHERE mean_exec_time > 1000;")"
    echo "• Active connections: $(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';")"
    echo "• Database size: $(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));")"
}

# =============================================================================
# UTILITY SCRIPTS
# =============================================================================

# -----------------------------------------------------------------------------
# seed-categories.sh - Seed default category data
# -----------------------------------------------------------------------------
seed_categories() {
    local ENVIRONMENT=${1:-development}
    
    echo "🌱 Seeding category data for $ENVIRONMENT..."
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    # Run category seed SQL
    if psql "$DATABASE_URL" < "./sql/seed-categories.sql"; then
        echo "✅ Category data seeded successfully"
    else
        echo "❌ Category seeding failed"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# create-tenant.sh - Create new tenant with default data
# -----------------------------------------------------------------------------
create_tenant() {
    local TENANT_NAME=${1}
    local CONTACT_EMAIL=${2}
    local ENVIRONMENT=${3:-development}
    
    if [ -z "$TENANT_NAME" ] || [ -z "$CONTACT_EMAIL" ]; then
        echo "❌ Usage: create_tenant <tenant_name> <contact_email> [environment]"
        exit 1
    fi
    
    echo "🏢 Creating new tenant: $TENANT_NAME"
    
    # Load environment
    source ".env.${ENVIRONMENT}"
    
    # Generate subdomain from name
    SUBDOMAIN=$(echo "$TENANT_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-\|-$//g')
    
    # Create tenant
    TENANT_ID=$(psql "$DATABASE_URL" -t -c "
        INSERT INTO tenants (name, subdomain, contact_email) 
        VALUES ('$TENANT_NAME', '$SUBDOMAIN', '$CONTACT_EMAIL') 
        RETURNING id;" | tr -d ' ')
    
    if [ ! -z "$TENANT_ID" ]; then
        echo "✅ Tenant created with ID: $TENANT_ID"
        echo "🌐 Subdomain: $SUBDOMAIN"
        echo "📧 Contact: $CONTACT_EMAIL"
    else
        echo "❌ Tenant creation failed"
        exit 1
    fi
}

# -----------------------------------------------------------------------------
# Main script dispatcher
# -----------------------------------------------------------------------------
main() {
    local COMMAND=${1}
    shift
    
    case $COMMAND in
        "deploy")
            deploy_database "$@"
            ;;
        "rollback")
            rollback_database "$@"
            ;;
        "backup")
            backup_database "$@"
            ;;
        "restore")
            restore_database "$@"
            ;;
        "maintenance")
            run_maintenance "$@"
            ;;
        "health")
            health_check "$@"
            ;;
        "performance")
            monitor_performance "$@"
            ;;
        "seed-categories")
            seed_categories "$@"
            ;;
        "create-tenant")
            create_tenant "$@"
            ;;
        *)
            echo "🚀 Yarn Crafting SaaS - Database Operations"
            echo ""
            echo "Available commands:"
            echo "  deploy <environment>                    - Deploy database changes"
            echo "  rollback <environment> <backup_file>   - Rollback to previous state"
            echo "  backup <environment> [type]            - Create database backup"
            echo "  restore <environment> <backup_file>    - Restore from backup"
            echo "  maintenance <environment> [task]       - Run maintenance tasks"
            echo "  health <environment> [webhook_url]     - Check database health"
            echo "  performance <environment>              - Generate performance report"
            echo "  seed-categories <environment>          - Seed default categories"
            echo "  create-tenant <name> <email> [env]     - Create new tenant"
            echo ""
            echo "Examples:"
            echo "  ./db-ops.sh deploy staging"
            echo "  ./db-ops.sh backup production full"
            echo "  ./db-ops.sh health production https://hooks.slack.com/..."
            echo "  ./db-ops.sh maintenance production vacuum"
            exit 1
            ;;
    esac
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi