# Yarn Crafting SaaS - Configuration, API Services & Documentation

## **Database Configuration and Tuning**

### **PostgreSQL Configuration (postgresql.conf)**
```ini
# Connection Settings
max_connections = 100                    # Suitable for DigitalOcean managed DB
shared_preload_libraries = 'pg_stat_statements,auto_explain'

# Memory Settings
shared_buffers = 256MB                   # 25% of available RAM for 1GB instance
effective_cache_size = 768MB             # 75% of available RAM
work_mem = 4MB                          # Per operation memory
maintenance_work_mem = 64MB              # For maintenance operations

# Write Ahead Logging (WAL)
wal_level = replica                      # Required for backups
max_wal_size = 1GB                      # Maximum WAL size
min_wal_size = 80MB                     # Minimum WAL size
checkpoint_completion_target = 0.9       # Spread checkpoints over time
wal_compression = on                     # Compress WAL records

# Query Planner
random_page_cost = 1.1                  # SSD optimization
effective_io_concurrency = 200          # SSD concurrent I/O capability
default_statistics_target = 100         # Statistics detail level

# Logging
log_min_duration_statement = 1000       # Log queries taking > 1 second
log_checkpoints = on                    # Log checkpoint activity
log_connections = on                    # Log new connections
log_disconnections = on                 # Log disconnections
log_lock_waits = on                     # Log lock waits

# Auto Vacuum Settings
autovacuum = on                         # Enable automatic vacuum
autovacuum_max_workers = 3              # Number of autovacuum workers
autovacuum_naptime = 1min               # Time between autovacuum runs
autovacuum_vacuum_threshold = 50        # Minimum number of updated tuples
autovacuum_vacuum_scale_factor = 0.2    # Fraction of table size
autovacuum_analyze_threshold = 50       # Minimum number of updated tuples
autovacuum_analyze_scale_factor = 0.1   # Fraction of table size

# Extensions
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000          # Number of statements tracked
pg_stat_statements.track = all          # Track all statements
```

### **Connection Pooling with PgBouncer**
```ini
# pgbouncer.ini
[databases]
yarn_crafting_prod = host=your-db-host port=5432 dbname=yarn_crafting
yarn_crafting_staging = host=your-staging-db-host port=5432 dbname=yarn_crafting

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# Pool settings
pool_mode = transaction                  # Best for web applications
max_client_conn = 200                   # Maximum client connections
default_pool_size = 20                  # Default pool size per database
reserve_pool_size = 5                   # Reserved connections for admin
reserve_pool_timeout = 3               # Timeout for reserve pool

# Server settings
server_reset_query = DISCARD ALL        # Reset server state
server_check_query = SELECT 1           # Health check query
server_check_delay = 30                 # Health check interval

# Timeouts
server_connect_timeout = 15             # Server connection timeout
server_login_retry = 15                 # Login retry attempts
query_timeout = 300                     # Query timeout (5 minutes)
client_idle_timeout = 3600              # Client idle timeout (1 hour)

# Logging
admin_users = admin                     # Admin users
stats_users = stats                     # Stats users
log_connections = 1                     # Log connections
log_disconnections = 1                  # Log disconnections
log_pooler_errors = 1                   # Log pooler errors
```

### **Environment-Specific Database URLs**
```typescript
// lib/database/config.ts
export const databaseConfig = {
  development: {
    url: process.env.DEV_DATABASE_URL,
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    debug: true,
    logging: ['query', 'error', 'warn'],
  },
  
  staging: {
    url: process.env.STAGING_DATABASE_URL,
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    debug: false,
    logging: ['error', 'warn'],
  },
  
  production: {
    url: process.env.DATABASE_URL,
    pool: {
      min: 10,
      max: 30,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 200,
    },
    debug: false,
    logging: ['error'],
    ssl: {
      rejectUnauthorized: false, // For DigitalOcean managed databases
    },
  }
}

// Prisma client configuration
export const prismaClientConfig = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
  errorFormat: 'pretty' as const,
  datasources: {
    db: {
      url: databaseConfig[process.env.NODE_ENV as keyof typeof databaseConfig]?.url
    }
  }
}
```

## **API Services and Controllers**

### **Category Service Implementation**
```typescript
// lib/services/category.service.ts
import { PrismaClient } from '@prisma/client'
import { Injectable, BadRequestException } from '@nestjs/common'

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaClient) {}

  // Get available categories for a tenant (system + custom)
  async getTenantCategories(tenantId: string, categoryType: string) {
    return await this.prisma.$queryRaw`
      SELECT * FROM get_tenant_categories(${tenantId}::UUID, ${categoryType})
      ORDER BY level, sort_order, name
    `
  }

  // Get hierarchical category tree for dropdowns
  async getCategoryHierarchy(tenantId: string, categoryType: string) {
    const categories = await this.prisma.$queryRaw`
      SELECT * FROM get_category_hierarchy(${tenantId}::UUID, ${categoryType})
    `

    // Transform flat list into tree structure for UI
    return this.buildCategoryTree(categories as any[])
  }

  // Create custom category for tenant
  async createCustomCategory(
    tenantId: string,
    categoryType: string,
    data: {
      name: string
      description?: string
      parentId?: string
      colorHex?: string
      iconName?: string
    },
    userId: string
  ) {
    return await this.prisma.$queryRaw`
      SELECT create_custom_category(
        ${tenantId}::UUID,
        ${categoryType},
        ${data.name},
        ${data.description},
        ${data.parentId ? data.parentId + '::UUID' : null},
        ${data.colorHex},
        ${data.iconName},
        ${userId}::UUID
      ) as id
    `
  }

  // Validate category assignment
  async validateCategory(tenantId: string, categoryId: string, requiredType?: string) {
    const result = await this.prisma.$queryRaw`
      SELECT validate_category_assignment(
        ${tenantId}::UUID, 
        ${categoryId}::UUID,
        ${requiredType}
      ) as is_valid
    `
    return (result as any)[0]?.is_valid || false
  }

  private buildCategoryTree(flatCategories: any[]): any[] {
    const categoryMap = new Map()
    const rootCategories: any[] = []

    // First pass: create map of all categories
    flatCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] })
    })

    // Second pass: build tree structure
    flatCategories.forEach(cat => {
      const categoryNode = categoryMap.get(cat.id)
      if (cat.parent_id) {
        const parent = categoryMap.get(cat.parent_id)
        if (parent) {
          parent.children.push(categoryNode)
        }
      } else {
        rootCategories.push(categoryNode)
      }
    })

    return rootCategories
  }
}
```

### **Material Controller with Category Validation**
```typescript
// controllers/material.controller.ts
import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common'
import { CategoryService } from '../services/category.service'
import { TenantGuard } from '../guards/tenant.guard'
import { CurrentTenant } from '../decorators/current-tenant.decorator'
import { CurrentUser } from '../decorators/current-user.decorator'

@Controller('api/v1/materials')
@UseGuards(TenantGuard)
export class MaterialController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly categoryService: CategoryService
  ) {}

  @Post()
  async createMaterial(
    @Body() data: CreateMaterialDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string
  ) {
    // Validate category belongs to tenant and is correct type
    const isValidCategory = await this.categoryService.validateCategory(
      tenantId, 
      data.categoryId, 
      'material_categories'
    )

    if (!isValidCategory) {
      throw new BadRequestException('Invalid category for this tenant')
    }

    // Validate yarn-specific categories if needed
    if (data.yarnWeightId) {
      const isValidYarnWeight = await this.categoryService.validateCategory(
        tenantId,
        data.yarnWeightId,
        'yarn_weights'
      )
      if (!isValidYarnWeight) {
        throw new BadRequestException('Invalid yarn weight category')
      }
    }

    return await this.prisma.material.create({
      data: {
        ...data,
        tenantId,
        createdBy: userId,
        updatedBy: userId
      },
      include: {
        category: true,
        subcategory: true,
        yarnWeight: true,
        fiberType: true
      }
    })
  }

  @Get()
  async getMaterials(
    @CurrentTenant() tenantId: string,
    @Query() filters?: MaterialFiltersDto
  ) {
    return await this.prisma.material.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.subcategoryId && { subcategoryId: filters.subcategoryId }),
        ...(filters?.yarnWeightId && { yarnWeightId: filters.yarnWeightId })
      },
      include: {
        category: {
          select: { id: true, name: true, code: true, colorHex: true, iconName: true }
        },
        subcategory: {
          select: { id: true, name: true, code: true, colorHex: true, iconName: true }
        },
        yarnWeight: {
          select: { id: true, name: true, code: true }
        },
        fiberType: {
          select: { id: true, name: true, code: true }
        }
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' }
      ]
    })
  }

  @Get('categories')
  async getMaterialCategories(@CurrentTenant() tenantId: string) {
    return await this.categoryService.getCategoryHierarchy(tenantId, 'material_categories')
  }

  @Post('categories')
  async createCustomCategory(
    @Body() data: CreateCategoryDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string
  ) {
    return await this.categoryService.createCustomCategory(
      tenantId,
      'material_categories',
      data,
      userId
    )
  }
}
```

### **Database Monitoring Service**
```typescript
// lib/monitoring/database-monitor.ts
import { PrismaClient } from '@prisma/client'
import { Logger } from '@nestjs/common'
import { Injectable } from '@nestjs/common'

@Injectable()
export class DatabaseMonitor {
  private readonly logger = new Logger(DatabaseMonitor.name)
  private readonly prisma = new PrismaClient()

  async performHealthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: any[]
    metrics: any
  }> {
    try {
      // Run performance issue detection
      const issues = await this.prisma.$queryRaw`
        SELECT * FROM detect_performance_issues()
      `

      // Get basic metrics
      const metrics = await this.prisma.$queryRaw`
        SELECT json_build_object(
          'connection_count', (
            SELECT count(*) FROM pg_stat_activity WHERE state = 'active'
          ),
          'database_size_mb', (
            SELECT round(pg_database_size(current_database())::numeric / 1024 / 1024, 2)
          ),
          'slow_query_count', (
            SELECT count(*) FROM pg_stat_statements WHERE mean_exec_time > 1000
          ),
          'cache_hit_ratio', (
            SELECT round(
              sum(blks_hit)::numeric / nullif(sum(blks_hit + blks_read), 0) * 100, 2
            ) FROM pg_stat_database WHERE datname = current_database()
          )
        ) as metrics
      `

      const status = this.determineHealthStatus(issues as any[])
      
      return {
        status,
        issues: issues as any[],
        metrics: (metrics as any)[0]?.metrics || {}
      }
    } catch (error) {
      this.logger.error('Health check failed', error)
      return {
        status: 'critical',
        issues: [{ issue_type: 'health_check_failed', description: error.message }],
        metrics: {}
      }
    }
  }

  private determineHealthStatus(issues: any[]): 'healthy' | 'warning' | 'critical' {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical')
    const warningIssues = issues.filter(issue => issue.severity === 'warning')

    if (criticalIssues.length > 0) return 'critical'
    if (warningIssues.length > 0) return 'warning'
    return 'healthy'
  }

  async runMaintenanceTasks(): Promise<void> {
    try {
      this.logger.log('Starting automated maintenance tasks')
      
      const results = await this.prisma.$queryRaw`
        SELECT * FROM run_maintenance_tasks()
      `
      
      this.logger.log('Maintenance tasks completed', { results })
    } catch (error) {
      this.logger.error('Maintenance tasks failed', error)
    }
  }

  async monitorTenantUsage(): Promise<{
    tenantId: string
    metrics: {
      productCount: number
      materialCount: number
      storageUsageMB: number
      apiCallsToday: number
    }
  }[]> {
    const results = await this.prisma.$queryRaw`
      SELECT 
        t.id as tenant_id,
        json_build_object(
          'product_count', COALESCE(p.product_count, 0),
          'material_count', COALESCE(m.material_count, 0),
          'storage_usage_mb', COALESCE(f.storage_mb, 0),
          'api_calls_today', COALESCE(ic.requests_today, 0)
        ) as metrics
      FROM tenants t
      LEFT JOIN (
        SELECT tenant_id, count(*) as product_count
        FROM products
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) p ON t.id = p.tenant_id
      LEFT JOIN (
        SELECT tenant_id, count(*) as material_count
        FROM materials
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) m ON t.id = m.tenant_id
      LEFT JOIN (
        SELECT tenant_id, sum(file_size) / 1024 / 1024 as storage_mb
        FROM files
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) f ON t.id = f.tenant_id
      LEFT JOIN (
        SELECT tenant_id, sum(requests_today) as requests_today
        FROM integration_configs
        WHERE deleted_at IS NULL
        GROUP BY tenant_id
      ) ic ON t.id = ic.tenant_id
      WHERE t.deleted_at IS NULL
    `

    return results as any[]
  }
}

// Schedule monitoring tasks
export const scheduleMonitoringTasks = () => {
  const monitor = new DatabaseMonitor()
  
  // Health check every 5 minutes
  setInterval(async () => {
    const health = await monitor.performHealthCheck()
    if (health.status !== 'healthy') {
      console.warn('Database health issues detected', health)
      // Send alerts via email, Slack, etc.
    }
  }, 5 * 60 * 1000)
  
  // Maintenance tasks daily at 2 AM
  setInterval(async () => {
    const now = new Date()
    if (now.getHours() === 2 && now.getMinutes() === 0) {
      await monitor.runMaintenanceTasks()
    }
  }, 60 * 1000)
  
  // Usage monitoring hourly
  setInterval(async () => {
    const usage = await monitor.monitorTenantUsage()
    // Log usage metrics for billing/analytics
    console.log('Tenant usage metrics', usage)
  }, 60 * 60 * 1000)
}
```

## **Frontend React Components**

### **Category Select Component**
```typescript
// components/forms/CategorySelect.tsx
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { categoryService } from '@/lib/services/category.service'

interface CategorySelectProps {
  tenantId: string
  categoryType: string
  value?: string
  onChange: (categoryId: string) => void
  placeholder?: string
}

export const CategorySelect: React.FC<CategorySelectProps> = ({ 
  tenantId, 
  categoryType, 
  value, 
  onChange, 
  placeholder 
}) => {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', tenantId, categoryType],
    queryFn: () => categoryService.getCategoryHierarchy(tenantId, categoryType)
  })

  const renderCategoryOption = (category: any, level = 0) => (
    <React.Fragment key={category.id}>
      <SelectItem 
        value={category.id}
        className={`pl-${level * 4}`}
      >
        <div className="flex items-center space-x-2">
          {category.icon_name && (
            <span className="w-4 h-4" style={{ color: category.color_hex }}>
              <Icon name={category.icon_name} />
            </span>
          )}
          <span>{category.name}</span>
          {category.is_custom && (
            <Badge variant="outline" size="sm">Custom</Badge>
          )}
        </div>
      </SelectItem>
      {category.children?.map((child: any) => 
        renderCategoryOption(child, level + 1)
      )}
    </React.Fragment>
  )

  if (isLoading) {
    return <div className="animate-pulse bg-gray-200 h-10 rounded" />
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || "Select category..."} />
      </SelectTrigger>
      <SelectContent>
        {categories.map(category => renderCategoryOption(category))}
      </SelectContent>
    </Select>
  )
}
```

### **Material Form with Categories**
```typescript
// components/materials/MaterialForm.tsx
import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Form, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { CategorySelect } from '@/components/forms/CategorySelect'

const createMaterialSchema = z.object({
  name: z.string().min(1, "Material name is required"),
  categoryId: z.string().min(1, "Category is required"),
  subcategoryId: z.string().optional(),
  yarnWeightId: z.string().optional(),
  fiberTypeId: z.string().optional(),
  brand: z.string().optional(),
  color: z.string().optional(),
  costPerUnit: z.number().min(0, "Cost must be positive"),
  unit: z.string().min(1, "Unit is required"),
  quantityAvailable: z.number().optional(),
  reorderLevel: z.number().optional(),
  description: z.string().optional(),
})

type CreateMaterialDto = z.infer<typeof createMaterialSchema>

interface MaterialFormProps {
  tenantId: string
  onSubmit: (data: CreateMaterialDto) => void
  defaultValues?: Partial<CreateMaterialDto>
}

export const MaterialForm: React.FC<MaterialFormProps> = ({ 
  tenantId, 
  onSubmit, 
  defaultValues 
}) => {
  const form = useForm<CreateMaterialDto>({
    resolver: zodResolver(createMaterialSchema),
    defaultValues
  })

  const selectedCategory = form.watch('categoryId')
  
  // Check if selected category is yarn
  const isYarnCategory = React.useMemo(() => {
    // This would be determined by checking the category code or name
    // For now, simplified logic
    return selectedCategory && selectedCategory.includes('yarn')
  }, [selectedCategory])

  const handleSubmit = (data: CreateMaterialDto) => {
    onSubmit(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Material Name *</FormLabel>
                <Input {...field} placeholder="e.g., Red Heart Super Saver" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category *</FormLabel>
                <CategorySelect
                  tenantId={tenantId}
                  categoryType="material_categories"
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select material category..."
                />
              </FormItem>
            )}
          />
        </div>

        {/* Show yarn-specific fields only for yarn materials */}
        {isYarnCategory && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-medium col-span-full">Yarn Details</h3>
            
            <FormField
              control={form.control}
              name="yarnWeightId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Yarn Weight</FormLabel>
                  <CategorySelect
                    tenantId={tenantId}
                    categoryType="yarn_weights"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select yarn weight..."
                  />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="fiberTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiber Type</FormLabel>
                  <CategorySelect
                    tenantId={tenantId}
                    categoryType="fiber_types"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select fiber type..."
                  />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Brand</FormLabel>
                <Input {...field} placeholder="e.g., Red Heart" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <Input {...field} placeholder="e.g., Navy Blue" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit *</FormLabel>
                <Input {...field} placeholder="e.g., gram, yard, piece" />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="costPerUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cost Per Unit *</FormLabel>
                <Input 
                  type="number" 
                  step="0.01"
                  {...field} 
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  placeholder="0.00" 
                />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quantityAvailable"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity Available</FormLabel>
                <Input 
                  type="number" 
                  step="0.01"
                  {...field} 
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  placeholder="0.00" 
                />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="reorderLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reorder Level</FormLabel>
                <Input 
                  type="number" 
                  step="0.01"
                  {...field} 
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  placeholder="0.00" 
                />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <textarea 
                {...field}
                className="w-full p-2 border rounded-md"
                rows={3}
                placeholder="Additional notes about this material..."
              />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <button 
            type="button" 
            className="px-4 py-2 border rounded-md"
            onClick={() => form.reset()}
          >
            Reset
          </button>
          <button 
            type="submit" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Material
          </button>
        </div>
      </form>
    </Form>
  )
}
```

## **Docker and Deployment Configuration**

### **Development Docker Compose**
```yaml
# docker-compose.yml for local development
version: '3.8'

services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_DB: yarn_crafting_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --lc-collate=C --lc-ctype=C"
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d
    command: |
      postgres 
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.track=all
      -c max_connections=100
      -c shared_buffers=256MB
      -c effective_cache_size=1GB
      -c maintenance_work_mem=64MB
      -c checkpoint_completion_target=0.9
      -c wal_buffers=16MB
      -c default_statistics_target=100
      -c random_page_cost=1.1
      -c effective_io_concurrency=200

  redis:
    image: redis:8
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASES_HOST: postgres
      DATABASES_PORT: 5432
      DATABASES_USER: postgres
      DATABASES_PASSWORD: postgres
      DATABASES_DBNAME: yarn_crafting_dev
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 100
      DEFAULT_POOL_SIZE: 20
    ports:
      - "6432:6432"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

### **DigitalOcean App Platform Configuration**
```yaml
# app.yaml
name: yarn-crafter-api
services:
- name: api
  source_dir: /
  github:
    repo: your-org/yarn-crafter-backend
    branch: main
  run_command: npm run start:prod
  environment_slug: node-js
  instance_count: 2
  instance_size_slug: basic-xxs
  
- name: worker
  source_dir: /
  run_command: npm run worker:start
  instance_count: 1
  instance_size_slug: basic-xxs

databases:
- name: yarn-crafter-db
  engine: PG
  version: "17" 
  
- name: yarn-crafter-redis
  engine: REDIS
  version: "8"
```

## **Migration Strategy from Hardcoded Categories**

### **SQL Migration Script**
```sql
-- Migration script to convert existing hardcoded categories
-- Run this after setting up the new category system

-- Step 1: Create migration mapping for existing materials
CREATE TEMP TABLE material_category_mapping AS
SELECT DISTINCT 
  m.category as old_category,
  m.subcategory as old_subcategory,
  c.id as new_category_id,
  sc.id as new_subcategory_id
FROM materials m
LEFT JOIN categories c ON c.code = UPPER(m.category) 
  AND c.tenant_id IS NULL
  AND EXISTS (
    SELECT 1 FROM category_types ct 
    WHERE ct.id = c.category_type_id AND ct.name = 'material_categories'
  )
LEFT JOIN categories sc ON sc.code = UPPER(m.subcategory)
  AND sc.tenant_id IS NULL
  AND sc.parent_id = c.id
WHERE m.deleted_at IS NULL;

-- Step 2: Add temporary columns for migration
ALTER TABLE materials ADD COLUMN old_category VARCHAR(100);
ALTER TABLE materials ADD COLUMN old_subcategory VARCHAR(100);

-- Step 3: Backup existing data
UPDATE materials SET 
  old_category = category,
  old_subcategory = subcategory;

-- Step 4: Update materials with new category IDs
UPDATE materials m SET
  category_id = mcm.new_category_id,
  subcategory_id = mcm.new_subcategory_id
FROM material_category_mapping mcm
WHERE m.category = mcm.old_category
  AND (m.subcategory = mcm.old_subcategory OR (m.subcategory IS NULL AND mcm.old_subcategory IS NULL))
  AND mcm.new_category_id IS NOT NULL;

-- Step 5: Handle unmapped categories (create custom categories for tenant)
INSERT INTO categories (category_type_id, tenant_id, name, code, description, is_system_default, sort_order)
SELECT DISTINCT
  (SELECT id FROM category_types WHERE name = 'material_categories'),
  m.tenant_id,
  m.category,
  UPPER(REPLACE(m.category, ' ', '_')),
  'Migrated from legacy category system',
  false,
  999
FROM materials m
LEFT JOIN material_category_mapping mcm ON m.category = mcm.old_category
WHERE mcm.new_category_id IS NULL
  AND m.category IS NOT NULL
  AND m.deleted_at IS NULL;

-- Step 6: Update materials with newly created custom categories
UPDATE materials m SET
  category_id = c.id
FROM categories c
WHERE c.tenant_id = m.tenant_id
  AND c.name = m.old_category
  AND m.category_id IS NULL
  AND m.deleted_at IS NULL;

-- Step 7: Verify migration
SELECT 
  COUNT(*) as total_materials,
  COUNT(category_id) as materials_with_category,
  COUNT(*) - COUNT(category_id) as unmapped_materials
FROM materials 
WHERE deleted_at IS NULL;

-- Step 8: Drop old columns after verification
-- ALTER TABLE materials DROP COLUMN category;
-- ALTER TABLE materials DROP COLUMN subcategory;
-- ALTER TABLE materials DROP COLUMN old_category;
-- ALTER TABLE materials DROP COLUMN old_subcategory;

-- Note: Keep the DROP statements commented until migration is fully verified
```

## **TypeScript Migration Script**
```typescript
// scripts/migrate-categories.ts
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

interface MigrationStep {
  name: string
  description: string
  execute: () => Promise<void>
  rollback?: () => Promise<void>
}

const migrationSteps: MigrationStep[] = [
  {
    name: 'backup_database',
    description: 'Create pre-migration backup',
    execute: async () => {
      console.log('Creating database backup...')
      execSync('pg_dump $DATABASE_URL > pre-category-migration-backup.sql')
    }
  },
  {
    name: 'create_category_tables',
    description: 'Create new category system tables',
    execute: async () => {
      console.log('Creating category system tables...')
      execSync('psql $DATABASE_URL < sql/category-tables.sql')
    },
    rollback: async () => {
      console.log('Dropping category tables...')
      await prisma.$executeRaw`DROP TABLE IF EXISTS categories CASCADE`
      await prisma.$executeRaw`DROP TABLE IF EXISTS category_types CASCADE`
    }
  },
  {
    name: 'seed_default_categories',
    description: 'Seed system default categories',
    execute: async () => {
      console.log('Seeding default categories...')
      execSync('psql $DATABASE_URL < sql/seed-categories.sql')
    }
  },
  {
    name: 'migrate_material_categories',
    description: 'Migrate existing material categories',
    execute: async () => {
      console.log('Migrating material categories...')
      execSync('psql $DATABASE_URL < sql/migrate-material-categories.sql')
    }
  },
  {
    name: 'migrate_product_categories',
    description: 'Migrate existing product categories',
    execute: async () => {
      console.log('Migrating product categories...')
      execSync('psql $DATABASE_URL < sql/migrate-product-categories.sql')
    }
  },
  {
    name: 'add_foreign_keys',
    description: 'Add foreign key constraints',
    execute: async () => {
      console.log('Adding foreign key constraints...')
      await prisma.$executeRaw`
        ALTER TABLE materials 
        ADD CONSTRAINT fk_materials_category 
        FOREIGN KEY (category_id) REFERENCES categories(id)
      `
      await prisma.$executeRaw`
        ALTER TABLE products 
        ADD CONSTRAINT fk_products_category 
        FOREIGN KEY (category_id) REFERENCES categories(id)
      `
    }
  },
  {
    name: 'create_triggers',
    description: 'Create category usage triggers',
    execute: async () => {
      console.log('Creating category usage triggers...')
      execSync('psql $DATABASE_URL < sql/category-triggers.sql')
    }
  },
  {
    name: 'validate_migration',
    description: 'Validate migration results',
    execute: async () => {
      console.log('Validating migration...')
      
      const materialCount = await prisma.material.count({
        where: { deletedAt: null }
      })
      
      const materialsWithCategory = await prisma.material.count({
        where: { 
          deletedAt: null,
          categoryId: { not: null }
        }
      })
      
      console.log(`Materials: ${materialCount}, With categories: ${materialsWithCategory}`)
      
      if (materialCount !== materialsWithCategory) {
        throw new Error(`Category migration incomplete: ${materialCount - materialsWithCategory} materials without categories`)
      }
      
      console.log('✅ Migration validation passed')
    }
  }
]

async function migrateCategorySystem() {
  const startTime = Date.now()
  const completedSteps: string[] = []
  
  try {
    console.log('🚀 Starting category system migration...')
    
    for (const step of migrationSteps) {
      console.log(`\n🔄 ${step.name}: ${step.description}`)
      await step.execute()
      completedSteps.push(step.name)
      console.log(`✅ ${step.name} completed`)
    }
    
    const duration = (Date.now() - startTime) / 1000
    console.log(`\n🎉 Category migration completed successfully in ${duration}s`)
    
  } catch (error) {
    console.error(`\n❌ Migration failed at step: ${completedSteps[completedSteps.length] || 'unknown'}`)
    console.error('Error:', error)
    
    // Attempt rollback
    console.log('\n🔄 Attempting rollback...')
    
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const stepName = completedSteps[i]
      const step = migrationSteps.find(s => s.name === stepName)
      
      if (step?.rollback) {
        try {
          console.log(`Rolling back: ${step.name}`)
          await step.rollback()
        } catch (rollbackError) {
          console.error(`Rollback failed for ${step.name}:`, rollbackError)
        }
      }
    }
    
    console.log('💾 Consider restoring from backup: pre-category-migration-backup.sql')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  migrateCategorySystem()
}
```

## **Troubleshooting Guide**

### **Common Issues and Solutions**

#### **Category Validation Errors**
```typescript
// Common category-related errors and fixes

// Error: "Invalid category for this tenant"
// Solution: Verify category belongs to tenant or is system default
const debugCategoryIssue = async (tenantId: string, categoryId: string) => {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      OR: [
        { tenantId: tenantId },
        { tenantId: null } // System default
      ]
    },
    include: {
      categoryType: true
    }
  })
  
  if (!category) {
    console.log('❌ Category not found or not accessible')
    return false
  }
  
  console.log('✅ Category found:', {
    id: category.id,
    name: category.name,
    type: category.categoryType.name,
    isCustom: category.tenantId !== null
  })
  
  return true
}
```

#### **Migration Issues**
```sql
-- Check migration status
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('materials', 'products')
  AND column_name LIKE '%category%'
ORDER BY table_name, column_name;

-- Find unmapped materials
SELECT 
  m.id,
  m.name,
  m.old_category,
  m.category_id
FROM materials m
WHERE m.category_id IS NULL 
  AND m.deleted_at IS NULL
LIMIT 10;

-- Fix orphaned categories
DELETE FROM categories 
WHERE tenant_id IS NOT NULL 
  AND tenant_id NOT IN (SELECT id FROM tenants);
```

#### **Performance Issues**
```sql
-- Check index usage for categories
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename IN ('categories', 'materials', 'products')
ORDER BY idx_scan DESC;

-- Rebuild category path indexes if needed
REINDEX INDEX CONCURRENTLY idx_categories_path;
REINDEX INDEX CONCURRENTLY idx_categories_usage;
```

### **Best Practices Summary**

1. **Always validate categories** before assignment
2. **Use hierarchical queries** for category trees
3. **Cache category data** at application level
4. **Monitor usage counts** for insights
5. **Test migrations thoroughly** in staging
6. **Keep audit trails** for category changes
7. **Use transactions** for bulk category operations
8. **Plan for tenant isolation** in all category operations

This normalized category system provides the flexibility and scalability needed for a multi-tenant SaaS while maintaining data integrity and performance.