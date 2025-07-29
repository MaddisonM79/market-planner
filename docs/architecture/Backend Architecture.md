# Market Manager - Backend Architecture

## **Implementation Notes & Architecture Decisions**

### **Database & Data Modeling Decisions**

#### **Audit Trails**
- **Strategy**: Application-level tracking (not database-level triggers)
- **Implementation**: Dedicated audit tables with tenant isolation
- **Scope**: All critical operations including cost calculations, inventory adjustments, pricing changes
- **Access**: Tenant admins and application admins can view audit trails

#### **Data Backup & Recovery**
- **Primary Strategy**: PostgreSQL automated backups to DigitalOcean Spaces (Object Storage)
- **Schedule**: Regular automated backups with configurable retention
- **Recovery**: Point-in-time recovery capability for tenant data restoration
- **Isolation**: Tenant-specific backup and recovery processes

#### **Soft Delete Strategy**
- **Policy**: All entities use soft deletes (no hard deletes)
- **Implementation**: `deleted_at` timestamp columns with NULL for active records
- **Restore Capability**: Both tenant admins and application admins can restore deleted items
- **Scope**: Yarn inventory, projects, components, cost calculations, user data
- **Benefits**: Prevents accidental data loss, maintains referential integrity, enables audit trails

### **Integration & External APIs - Open Questions**

#### **API Rate Limiting & Resilience**
- **Challenge**: Handle rate limits from Shopify, Square, and Etsy APIs
- **Considerations**: 
  - Exponential backoff retry strategies
  - Circuit breaker patterns for API failures
  - Queue-based API request management
  - Per-integration rate limit tracking

#### **Webhook Processing**
- **Requirements**: Receive and process webhooks from integrated platforms
- **Use Cases**: Order updates, inventory sync failures, payment confirmations
- **Considerations**:
  - Webhook signature verification
  - Idempotency handling for duplicate webhooks
  - Dead letter queues for failed webhook processing

#### **Stripe Integration Scope**
- **Beyond Payment Processing**: Determine billing model requirements
- **Options**: Subscription billing, usage-based pricing, one-time payments
- **Considerations**: Tenant billing tiers, feature-based pricing, usage metrics

### **Performance & Scalability - Implementation Requirements**

#### **Database Indexing Strategy**
- **Priority**: Optimize tenant-scoped queries for large inventories and cost calculations
- **Key Areas**: 
  - Tenant ID + frequently queried fields (composite indexes)
  - Cost calculation lookup performance
  - Inventory search and filtering
  - **Status**: Needs detailed analysis and implementation

#### **Cost Calculation Architecture**
- **Clarification**: Individual components are independent (no circular dependencies)
- **Structure**: Products can depend on multiple components in a hierarchical manner
- **Implementation**: Tree-based cost calculation with component aggregation
- **Performance**: Cached calculations with invalidation on component cost changes

#### **File Storage Management**
- **Storage Backend**: DigitalOcean Spaces for images and exports
- **Per-Tenant Quotas**: Research DigitalOcean Spaces tenant isolation capabilities
- **Cleanup Strategy**: Automated cleanup for soft-deleted projects and images
- **Monitoring**: Storage usage tracking and alerts per tenant

## **Updated Technology Stack (July 2025)**

| Component | Version | Status | Key Benefits |
|-----------|---------|---------|--------------|
| **Node.js** | `22.x LTS` | Active LTS (until 2027) | 30% faster performance, native fetch, require("esm") |
| **NestJS** | `11.1.x` | Stable | Faster startup, updated CacheModule, new APIs |
| **TypeScript** | `5.8.x` | Stable | Node.js 22 support, improved performance |
| **npm** | `11.5.x` | Latest | Enhanced package management |
| **PostgreSQL** | `17.x` | Stable | Latest security fixes, improved JSON processing |
| **Prisma** | `6.12.x` | Stable | Tracing stable, UUID v7, PostgreSQL 17 support |
| **Redis** | `8.x GA` | Latest | 87% faster commands, new data types, 2x throughput |
| | `7.4.x` | Conservative | Hash field expiration, proven stability |

## **Technology Stack**

### **Runtime & Core Framework**
- **Node.js**: `22.x LTS` ("Jod" - Active LTS until October 2025, Maintenance until April 2027)
- **NestJS**: `11.1.x` (Latest stable with performance improvements)
- **TypeScript**: `5.8.x` (Latest stable with Node.js 22 support)
- **npm**: `11.x` (Latest stable)

### **Database & ORM**
- **PostgreSQL**: `17.x` (Latest stable with security fixes and performance improvements)
- **Prisma**: `6.12.x` (Latest stable with tracing, UUID v7 support, and enhanced JSON handling)
- **Redis**: `8.x GA` (Latest with 30+ performance improvements) or `7.4.x` (Stable production option)

### **Key Dependencies**
```json
{
  "dependencies": {
    "@nestjs/core": "^11.1.5",
    "@nestjs/common": "^11.1.5",
    "@nestjs/platform-express": "^11.1.5",
    "@nestjs/websockets": "^11.1.5",
    "@nestjs/platform-socket.io": "^11.1.5",
    "@nestjs/config": "^3.2.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/swagger": "^7.3.0",
    "@nestjs/bull": "^10.1.0",
    "prisma": "^6.12.0",
    "@prisma/client": "^6.12.0",
    "bullmq": "^5.56.8",
    "redis": "^4.6.0",
    "socket.io": "^4.8.1",
    "argon2": "^0.43.1",
    "class-validator": "^0.14.2",
    "class-transformer": "^0.5.1",
    "multer": "^2.0.2",
    "sharp": "^0.34.3"
  },
  "devDependencies": {
    "typescript": "^5.8.3"
  }
}
```

## **Architecture Overview**

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js)                     │
├─────────────────────────────────────────────────────────────┤
│                    Load Balancer                           │
├─────────────────────────────────────────────────────────────┤
│                   NestJS API Gateway                       │
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐   │
│  │   REST API    │ │   WebSocket   │ │   File Upload   │   │
│  │   Module      │ │   Gateway     │ │   Service       │   │
│  └───────────────┘ └───────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                   Business Logic Layer                     │
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐   │
│  │   Inventory   │ │   Projects    │ │   Cost Calc     │   │
│  │   Service     │ │   Service     │ │   Service       │   │
│  └───────────────┘ └───────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Data Access Layer                       │
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐   │
│  │   Prisma ORM  │ │   Redis Cache │ │   Queue System  │   │
│  │              │ │               │ │   (BullMQ)      │   │
│  └───────────────┘ └───────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐   │
│  │  PostgreSQL   │ │     Redis     │ │  DigitalOcean   │   │
│  │   Database    │ │   Instance    │ │     Spaces      │   │
│  └───────────────┘ └───────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## **Database Design Philosophy**

### **Hybrid Approach: Relational + JSON**
- **Core Business Data**: Fully normalized relational structure
- **User Customizations**: JSON columns for flexibility
- **Metadata & Extensions**: JSON for rapid feature development

### **Enhanced Multi-Tenant Architecture with Audit & Soft Deletes**

-- Note: Yarns table replaced by comprehensive Materials table in Prisma Schema.md
-- The Materials table supports yarns, components, and all craft supply types

-- Note: Audit logs table definition moved to Prisma Schema.md
-- Advanced audit partitioning is handled in "Audit Trail Partitioning & Archival System.md"

-- Enhanced RLS policies for soft deletes
CREATE POLICY tenant_active_data ON yarns
  FOR ALL TO authenticated_user
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NULL);

CREATE POLICY tenant_deleted_data ON yarns
  FOR SELECT TO authenticated_user
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID AND deleted_at IS NOT NULL);
```

## **API Architecture**

### **RESTful Design with OpenAPI Documentation**

#### **API Structure**
```
/api/v1/
├── auth/
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh-token
│   ├── POST /forgot-password
│   ├── POST /reset-password
│   ├── POST /verify-email
│   ├── POST /resend-verification
│   ├── POST /enable-mfa
│   ├── POST /disable-mfa
│   ├── POST /verify-mfa
│   └── GET /profile
├── inventory/
│   ├── GET /yarns
│   ├── POST /yarns
│   ├── PUT /yarns/:id
│   ├── DELETE /yarns/:id
│   ├── POST /yarns/bulk
│   ├── PUT /yarns/bulk
│   ├── DELETE /yarns/bulk
│   └── GET /dashboard
├── projects/
│   ├── GET /projects
│   ├── POST /projects
│   ├── GET /projects/:id/complete
│   ├── PUT /projects/:id
│   ├── DELETE /projects/:id
│   └── POST /projects/:id/calculate-costs
├── exports/
│   ├── POST /market-sheets
│   ├── GET /exports/:id/status
│   └── POST /csv/import
├── integrations/
│   ├── POST /shopify/sync
│   ├── POST /square/sync
│   └── GET /integrations/status
└── files/
    ├── POST /images/upload
    ├── PUT /images/:id/crop
    └── DELETE /images/:id
```

#### **Bulk Operations Support**
```typescript
// Bulk endpoints for efficient operations
POST /api/v1/inventory/yarns/bulk
{
  "operations": [
    { "action": "create", "data": { "name": "Red Heart Super Saver", ... } },
    { "action": "update", "id": "uuid", "data": { "cost_per_unit": 4.99 } },
    { "action": "delete", "id": "uuid" }
  ]
}

PUT /api/v1/inventory/yarns/bulk
{
  "filter": { "brand": "Red Heart" },
  "updates": { "cost_per_unit": 5.99 }
}
```

## **Real-Time Features**

### **WebSocket Implementation**
```typescript
// Namespace-based organization
/inventory  - Real-time inventory updates
/projects   - Live cost calculations
/exports    - Export job progress
```

#### **Event Structure**
```typescript
// Inventory updates
client.emit('inventory-updated', {
  tenantId: string,
  type: 'yarn' | 'component' | 'project',
  action: 'created' | 'updated' | 'deleted',
  data: object,
  timestamp: Date
});

// Real-time cost calculations
client.emit('cost-calculation-progress', {
  projectId: string,
  step: string,
  progress: number,
  currentCost: number,
  estimatedTotal: number
});
```

## **Background Job Processing**

### **Queue System with BullMQ**

#### **Queue Organization**
```typescript
// Queue definitions
queues = {
  'cost-calculations': {
    concurrency: 5,
    priority: 'high',
    retention: { completed: 10, failed: 5 }
  },
  'exports': {
    concurrency: 2,
    priority: 'medium', 
    retention: { completed: 5, failed: 10 }
  },
  'integrations': {
    concurrency: 3,
    priority: 'low',
    retention: { completed: 20, failed: 20 }
  }
}
```

#### **Enhanced Job Types with Audit & Backup Support**
```typescript
// Audit trail jobs
interface AuditLogJob {
  tenantId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE';
  tableName: string;
  recordId: string;
  oldValues?: object;
  newValues?: object;
  userId: string;
  metadata: {
    ipAddress: string;
    userAgent: string;
    timestamp: Date;
  };
}

// Backup jobs
interface BackupJob {
  tenantId: string;
  backupType: 'full' | 'incremental' | 'point-in-time';
  destination: 'digitalocean-spaces';
  retentionDays: number;
  scheduledAt: Date;
}

// Soft delete cleanup jobs
interface CleanupJob {
  tenantId: string;
  tableName: string;
  cleanupAfterDays: number; // e.g., permanently delete after 90 days
  dryRun: boolean;
}

// API integration jobs with retry logic
interface ApiIntegrationJob {
  tenantId: string;
  provider: 'shopify' | 'square' | 'etsy' | 'stripe';
  operation: string;
  payload: object;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}
```

## **File Handling Strategy**

### **Image Processing Pipeline**
```typescript
// Upload flow
1. Validate image (type, size, dimensions)
2. Generate multiple sizes (thumbnail, small, medium, large)
3. Upload to DigitalOcean Spaces
4. Store metadata in database
5. Return URLs + crop coordinates

// Processing options
sizes: {
  thumbnail: { width: 150, height: 150, crop: 'center' },
  small: { width: 300, height: 300, quality: 80 },
  medium: { width: 600, height: 600, quality: 85 },
  large: { width: 1200, height: 1200, quality: 90 }
}
```

### **CSV Import/Export**
```typescript
// Flexible CSV handling
interface CsvOperation {
  file: Buffer;
  mapping: {
    [csvColumn: string]: {
      field: string;
      transform?: (value: any) => any;
      validate?: (value: any) => boolean;
    }
  };
  options: {
    delimiter: string;
    encoding: string;
    skipHeader: boolean;
    batchSize: number;
  };
}
```

## **Security & Authentication**

### **Multi-layered Security**
1. **Custom Authentication**: JWT tokens with refresh token rotation
2. **Password Security**: Argon2 hashing with configurable parameters
3. **Email Verification**: Secure token-based email verification
4. **MFA Support**: TOTP-based two-factor authentication with backup codes
5. **Account Security**: Failed login tracking, account lockout, password reset
6. **Row-Level Security**: Database-level tenant isolation  
7. **Request Guards**: NestJS guards for authorization
8. **Rate Limiting**: Redis-based rate limiting

### **Role-Based Access Control (RBAC)**

**Design Philosophy:**
- **Roles** are containers for permissions (admin, manager, crafter)
- **Guards check permissions**, not roles, for flexibility
- Users get permissions from role + custom permissions
- Permission-based guards allow fine-grained control

```typescript
// Permission-based guard (checks permissions, not roles)
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler()
    );
    
    if (!requiredPermissions) return true;
    
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Get user's effective permissions (role + custom)
    const userPermissions = await this.getUserPermissions(user);
    
    return requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );
  }

  private async getUserPermissions(user: any): Promise<string[]> {
    // Combine role permissions + custom permissions
    const rolePermissions = user.role?.permissions || [];
    const customPermissions = user.customPermissions || [];
    
    return [...new Set([...rolePermissions, ...customPermissions])];
  }
}

// Usage in controllers with base permission model
@Controller('products')
export class ProductsController {
  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_CREATE)
  createProduct(@Body() dto: CreateProductDto) {
    // Only users with 'products:create' permission can access
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCTS_READ) 
  getProducts() {
    // Only users with 'products:read' permission can access
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_UPDATE)
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    // Only users with 'products:update' permission can access
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_SOFT_DELETE)
  softDeleteProduct(@Param('id') id: string) {
    // Soft delete - recoverable
  }

  @Delete(':id/permanent')
  @RequirePermissions(PERMISSIONS.PRODUCTS_HARD_DELETE)
  hardDeleteProduct(@Param('id') id: string) {
    // Hard delete - admin only, permanent
  }

  @Post(':id/restore')
  @RequirePermissions(PERMISSIONS.PRODUCTS_RESTORE)
  restoreProduct(@Param('id') id: string) {
    // Restore soft-deleted product
  }
}
```

### **Base Permission Model**

**Standard Permission Pattern:** `{resource}:{action}`

**Base Actions (CRUD + Soft Delete):**
- `read` - View/list resources
- `create` - Create new resources  
- `update` - Modify existing resources
- `soft_delete` - Mark as deleted (recoverable)
- `hard_delete` - Permanently delete (admin only)
- `restore` - Restore soft-deleted items

```typescript
// Base permission generator
class PermissionBuilder {
  static readonly BASE_ACTIONS = [
    'read', 'create', 'update', 'soft_delete', 'hard_delete', 'restore'
  ] as const;

  static buildResourcePermissions(resource: string) {
    return this.BASE_ACTIONS.reduce((perms, action) => {
      perms[`${resource.toUpperCase()}_${action.toUpperCase()}`] = `${resource}:${action}`;
      return perms;
    }, {} as Record<string, string>);
  }

  static buildAllPermissions(resource: string): string[] {
    return this.BASE_ACTIONS.map(action => `${resource}:${action}`);
  }
}

// Generated permissions for each resource
const PRODUCT_PERMISSIONS = PermissionBuilder.buildResourcePermissions('products');
const MATERIAL_PERMISSIONS = PermissionBuilder.buildResourcePermissions('materials');
const USER_PERMISSIONS = PermissionBuilder.buildResourcePermissions('users');
const ROLE_PERMISSIONS = PermissionBuilder.buildResourcePermissions('roles');
const CATEGORY_PERMISSIONS = PermissionBuilder.buildResourcePermissions('categories');
const MARKET_EVENT_PERMISSIONS = PermissionBuilder.buildResourcePermissions('market_events');
const EXPORT_PERMISSIONS = PermissionBuilder.buildResourcePermissions('exports');
const FILE_PERMISSIONS = PermissionBuilder.buildResourcePermissions('files');

// Complete permission registry
export const PERMISSIONS = {
  // Products - primary business entity
  ...PRODUCT_PERMISSIONS,
  
  // Materials - supporting inventory  
  ...MATERIAL_PERMISSIONS,
  
  // User management
  ...USER_PERMISSIONS,
  
  // Role management
  ...ROLE_PERMISSIONS,
  
  // Categories
  ...CATEGORY_PERMISSIONS,
  
  // Market events
  ...MARKET_EVENT_PERMISSIONS,
  
  // Export jobs
  ...EXPORT_PERMISSIONS,
  
  // File management
  ...FILE_PERMISSIONS,
  
  // Special permissions (non-CRUD)
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',
  TENANT_SETTINGS: 'tenant:settings',
  AUDIT_LOGS_VIEW: 'audit_logs:view',
  COST_CALCULATIONS_RUN: 'cost_calculations:run',
  INTEGRATIONS_MANAGE: 'integrations:manage',
} as const;

// Helper for wildcard permissions
export const WILDCARD_PERMISSIONS = {
  PRODUCTS_ALL: 'products:*',
  MATERIALS_ALL: 'materials:*',
  USERS_ALL: 'users:*',
  ROLES_ALL: 'roles:*',
  ADMIN_ALL: '*:*'
};
```

### **Role Configurations with Base Permissions**
```typescript
const DEFAULT_ROLES = {
  // Full system administrator
  admin: [
    WILDCARD_PERMISSIONS.ADMIN_ALL, // All permissions on all resources
  ],
  
  // Business manager - can manage products/materials but not users
  manager: [
    WILDCARD_PERMISSIONS.PRODUCTS_ALL,     // products:*
    WILDCARD_PERMISSIONS.MATERIALS_ALL,    // materials:*
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.CATEGORIES_CREATE,
    PERMISSIONS.CATEGORIES_UPDATE,
    PERMISSIONS.MARKET_EVENTS_READ,
    PERMISSIONS.MARKET_EVENTS_CREATE,
    PERMISSIONS.MARKET_EVENTS_UPDATE,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.EXPORTS_READ,
    PERMISSIONS.EXPORTS_CREATE,
  ],
  
  // Regular crafter - can manage own work but limited access
  crafter: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_SOFT_DELETE,    // Can soft delete own products
    PERMISSIONS.PRODUCTS_RESTORE,        // Can restore own soft-deleted products
    PERMISSIONS.MATERIALS_READ,
    PERMISSIONS.MATERIALS_CREATE,
    PERMISSIONS.MATERIALS_UPDATE,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.MARKET_EVENTS_READ,
    PERMISSIONS.FILES_READ,
    PERMISSIONS.FILES_CREATE,
    PERMISSIONS.COST_CALCULATIONS_RUN,
  ],
  
  // View-only role for accountants/analysts
  viewer: [
    PERMISSIONS.PRODUCTS_READ,
    PERMISSIONS.MATERIALS_READ,
    PERMISSIONS.CATEGORIES_READ,
    PERMISSIONS.MARKET_EVENTS_READ,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.EXPORTS_READ,
    PERMISSIONS.AUDIT_LOGS_VIEW,
  ]
};
```

### **Permission Hierarchy & Validation**
```typescript
// Permission hierarchy (higher includes lower)
const PERMISSION_HIERARCHY = {
  'hard_delete': ['soft_delete', 'update', 'read'],
  'soft_delete': ['update', 'read'], 
  'restore': ['read'],
  'update': ['read'],
  'create': ['read'],  // Creating implies you can read
  'read': []
};

// Validate permission dependencies
export function validatePermissions(permissions: string[]): boolean {
  for (const permission of permissions) {
    const [resource, action] = permission.split(':');
    const requiredPerms = PERMISSION_HIERARCHY[action] || [];
    
    for (const requiredAction of requiredPerms) {
      const requiredPerm = `${resource}:${requiredAction}`;
      if (!permissions.includes(requiredPerm)) {
        console.warn(`Permission ${permission} requires ${requiredPerm}`);
        return false;
      }
    }
  }
  return true;
}

// Auto-expand permissions based on hierarchy
export function expandPermissions(permissions: string[]): string[] {
  const expanded = new Set(permissions);
  
  for (const permission of permissions) {
    const [resource, action] = permission.split(':');
    const impliedPerms = PERMISSION_HIERARCHY[action] || [];
    
    for (const impliedAction of impliedPerms) {
      expanded.add(`${resource}:${impliedAction}`);
    }
  }
  
  return Array.from(expanded);
}
```

### **Tenant Context Management**
```typescript
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Set tenant context for database queries
    await this.prisma.$executeRaw`
      SELECT set_config('app.current_tenant_id', ${user.tenantId}, true)
    `;
    
    return true;
  }
}
```

## **Caching Strategy**

### **Redis Caching Layers**
```typescript
// Cache patterns
cachePatterns = {
  // User session data
  'session:{userId}': { ttl: 3600 }, // 1 hour
  
  // Inventory summaries  
  'inventory:summary:{tenantId}': { ttl: 300 }, // 5 minutes
  
  // Cost calculations
  'cost:project:{projectId}': { ttl: 1800 }, // 30 minutes
  
  // Export results
  'export:{exportId}': { ttl: 86400 }, // 24 hours
  
  // Integration tokens
  'integration:{tenantId}:{provider}': { ttl: 3000 } // 50 minutes
}
```

## **Monitoring & Observability**

### **Logging Strategy**
- **Application Logs**: Structured JSON logging with correlation IDs
- **Database Logs**: Query performance monitoring
- **Queue Logs**: Job execution tracking and failure analysis
- **WebSocket Logs**: Connection and event tracking

### **Health Checks**
```typescript
// Health check endpoints
GET /health
{
  "status": "ok",
  "checks": {
    "database": "healthy",
    "redis": "healthy", 
    "queues": "healthy",
    "storage": "healthy"
  },
  "uptime": 86400,
  "version": "1.0.0"
}
```

## **Deployment Configuration**

### **DigitalOcean App Platform**
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

## **Development Workflow**

### **Environment Structure**
- **Development**: Local PostgreSQL + Redis
- **Staging**: DigitalOcean managed services (small instances)  
- **Production**: DigitalOcean managed services (production instances)

### **Migration Strategy**
```bash
# Database migrations
npm run migrate:dev     # Development
npm run migrate:staging # Staging deployment
npm run migrate:prod    # Production deployment

# Seed data
npm run seed:dev        # Development sample data
npm run seed:prod       # Production defaults (yarn types, etc.)
```

## **Next Steps & Open Questions**

### **Immediate Implementation Priorities**
1. **Database Schema Design** - Implement soft deletes and audit tables
2. **Tenant Context Management** - Enhanced RLS with soft delete support  
3. **Audit Trail Service** - Application-level change tracking
4. **Backup Strategy Implementation** - DigitalOcean Spaces integration
5. **Cost Calculation Engine** - Component hierarchy without circular dependencies

### **Research & Decision Points**

#### **API Integration Strategy**
- **Rate Limiting**: Design circuit breaker patterns for Shopify/Square/Etsy APIs
- **Webhook Security**: Implement signature verification and replay protection
- **Error Handling**: Define retry strategies and dead letter queue processing
- **API Versioning**: Handle API version changes across integrated platforms

#### **Storage & Performance Optimization**
- **DigitalOcean Spaces**: Determine tenant quota enforcement mechanisms
- **Database Indexing**: Analyze query patterns for optimal index strategy
- **Cache Strategy**: Design multi-layer caching for cost calculations and inventory
- **File Lifecycle**: Implement automated cleanup for soft-deleted resources

#### **Billing & Subscription Model**
- **Stripe Integration Scope**: Define subscription vs usage-based billing requirements
- **Feature Tiers**: Determine which features require paid subscriptions
- **Usage Metrics**: Track tenant usage for billing and quota enforcement
- **Payment Flow**: Design checkout and subscription management user experience

#### **Compliance & Security**
- **Data Retention**: Define policies for permanent deletion after soft delete period
- **Audit Requirements**: Determine compliance needs for financial calculations
- **Tenant Data Export**: GDPR compliance for data portability requests
- **Security Monitoring**: Implement anomaly detection for tenant activities

---

**Next Implementation Priority:**
1. Core database schema design
2. Authentication & tenant setup
3. Basic CRUD operations
4. WebSocket gateway setup
5. Queue system integration
6. File upload handling

## **Version Update Benefits (July 2025)**

### **Node.js 22.x LTS Advantages:**
- **Performance**: Up to 30% faster file operations and 15% improved web request handling
- **Native fetch**: Built-in fetch API support (no more node-fetch dependency)
- **require("esm")**: Better ESM/CommonJS interoperability
- **Security**: Latest security patches and vulnerability fixes
- **Long-term Support**: Active support until October 2025, Maintenance until April 2027

### **NestJS 11.x Improvements:**
- **Startup Performance**: Significantly faster application startup times
- **Updated Dependencies**: CacheModule now uses cache-manager v6 with Keyv
- **New Features**: ParseDatePipe, IntrinsicException, request-scoped CQRS providers
- **TypeScript**: Better metadata type inference with Reflector

### **TypeScript 5.8.x Features:**
- **Node.js 22 Support**: Full compatibility with latest Node.js features
- **Performance**: Improved compilation speeds and memory usage
- **ESM Support**: Enhanced module resolution and require("esm") support
- **Editor Experience**: Better IntelliSense and error reporting

### **Database Stack Improvements:**

#### **PostgreSQL 17.x Benefits:**
- **Security**: Latest security patches including CVE fixes
- **Performance**: Improved query execution and memory management
- **JSON**: Enhanced JSON processing capabilities
- **Reliability**: Better connection handling and crash recovery

#### **Prisma 6.12.x Advantages:**
- **Tracing Stable**: Production-ready observability with distributed tracing
- **UUID v7**: Support for latest UUID standard with better ordering
- **Performance**: Improved query generation and execution
- **TypeScript**: Enhanced type safety and better IntelliSense
- **PostgreSQL 17**: Full compatibility with latest PostgreSQL features

#### **Redis 8.x GA Benefits:**
- **Performance**: Up to 87% faster command execution
- **Throughput**: Up to 2x more operations per second with multi-threading
- **Replication**: 18% faster replication with 35% lower buffer usage  
- **Data Types**: 8 new data structures including vector sets (beta), JSON, time series
- **Query Engine**: Up to 16x more query processing power with horizontal scaling
- **Backward Compatible**: Seamless upgrade from Redis 7.x

**Alternative: Redis 7.4 (Conservative Choice)**
- **Hash Field Expiration**: Fine-grained expiration control for hash fields
- **Vector Data Types**: New vector capabilities for AI/ML applications
- **Client-side Caching**: Improved performance with local caching
- **Production Proven**: Stable GA release with extensive testing

### **Migration Considerations:**
- **Cache Module**: Update to cache-manager v6 syntax if using caching
- **TypeScript**: May need to update tsconfig.json for new compiler options
- **Dependencies**: Run `npm audit` and update vulnerable packages
- **Testing**: Verify all tests pass with new NestJS 11.x APIs

#### **Database Stack Migration Notes:**
- **PostgreSQL 17**: Use `pg_upgrade` for major version upgrade from 16.x
- **Prisma 6.x**: 
  - Update Prisma schema for new features
  - Regenerate Prisma Client: `npx prisma generate`
  - Check for breaking changes in query syntax
  - Test tracing configuration if using observability
- **Redis 8.x**:
  - **Recommended**: Direct upgrade from Redis 7.x (backward compatible)
  - Update client libraries to support new data types
  - Test performance with new multi-threading configuration  
  - **Alternative**: Stay on Redis 7.4 for conservative production deployments

#### **3rd Party Dependencies Improvements:**

##### **Queue & Real-time Processing:**
- **BullMQ 5.56.x**: Latest version with enhanced performance and Redis 8 compatibility
  - Published daily with active maintenance and bug fixes
  - Improved Redis 7+ support with minimum Redis 6.2.0 requirement
  - Better job scheduling and group processing capabilities

- **Socket.IO 4.8.x**: Stable WebSocket communication
  - Latest stable version 4.8.1 released October 2024
  - Enhanced connection reliability and performance optimizations
  - Better browser compatibility and debugging capabilities

##### **Security & Validation:**
- **Argon2 0.43.x**: Modern password hashing (Winner of Password Hashing Competition 2015)
  - Version 0.43.1 published 13 days ago with active maintenance
  - Memory-hard function resistant to GPU/ASIC attacks
  - Configurable parameters for time, memory, and parallelism
  - Recommended by NIST for password hashing (Argon2id variant)
  - No password length limitations (unlike bcrypt's 72-byte truncation)

- **class-validator 0.14.x**: Input validation
  - Version 0.14.2 published 3 months ago with active maintenance
  - Enhanced decorator-based validation capabilities
  - Better TypeScript integration and error handling

- **class-transformer 0.5.x**: Object transformation
  - Stable version 0.5.1 for transforming plain objects to class instances
  - Reliable transformation with groups and versioning support
  - Essential for NestJS DTO handling

##### **File Processing:**
- **Multer 2.0.x**: File upload handling
  - Version 2.0.2 published 11 days ago with critical security fixes
  - Important security update: Fixed CVE-2025-47935 and CVE-2025-47944 denial of service vulnerabilities
  - **CRITICAL**: Upgrade required from versions <2.0.0 due to memory leak vulnerability

- **Sharp 0.34.x**: High-performance image processing
  - Version 0.34.3 published 18 days ago - fastest module for image resizing
  - Supports JPEG, PNG, WebP, GIF, AVIF, and TIFF formats with libvips performance
  - Enhanced memory efficiency and multi-core processing capabilities

#### **Security & Migration Alerts:**

**RECOMMENDED - Switch to Argon2:**
- Argon2 is the modern standard for password hashing (won Password Hashing Competition 2015)
- **Superior Security**: Memory-hard function resistant to GPU/ASIC attacks vs bcrypt's CPU-only approach
- **Configurable**: Fine-tune time, memory, and parallelism parameters for your threat model
- **No Length Limits**: Unlike bcrypt's 72-byte password truncation
- **NIST Recommended**: Argon2id variant is officially recommended for password hashing

**CRITICAL - Multer Security Update:**
- Multer versions <2.0.0 are vulnerable to denial of service due to memory leaks
- **Action Required**: Immediate upgrade to Multer 2.0.0+ to fix stream handling vulnerabilities
- Test file upload endpoints thoroughly after upgrade

**BullMQ Redis Compatibility:**
- Minimum Redis 6.2.0 required, optimized for Redis 7+ and Redis 8
- Ensure Redis version compatibility when upgrading BullMQ

**class-transformer Considerations:**
- Version 0.5.1 is stable but older (4 years)
- Consider watching for newer releases or alternative "class-transform" fork
- Test transformation logic thoroughly with TypeScript strict mode