// =============================================================================
// Yarn Crafting SaaS - Prisma Schema
// =============================================================================
// This is your Prisma schema file for the Yarn Crafting SaaS
// Learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["tracing", "metrics", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_trgm, uuid_ossp]
}

// =============================================================================
// CATEGORY SYSTEM MODELS
// =============================================================================

model CategoryType {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name          String    @unique @db.VarChar(100)
  description   String?
  isHierarchical Boolean  @default(false) @map("is_hierarchical")
  allowsCustom  Boolean   @default(true) @map("allows_custom")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // Relationships
  categories    Category[]

  @@map("category_types")
}

model Category {
  id              String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  categoryTypeId  String        @map("category_type_id") @db.Uuid
  tenantId        String?       @map("tenant_id") @db.Uuid // NULL for system defaults
  name            String        @db.VarChar(100)
  code            String?       @db.VarChar(50)
  description     String?
  colorHex        String?       @map("color_hex") @db.VarChar(7)
  iconName        String?       @map("icon_name") @db.VarChar(50)
  parentId        String?       @map("parent_id") @db.Uuid
  sortOrder       Int           @default(0) @map("sort_order")
  level           Int           @default(0)
  path            String?
  isActive        Boolean       @default(true) @map("is_active")
  isSystemDefault Boolean       @default(false) @map("is_system_default")
  usageCount      Int           @default(0) @map("usage_count")
  createdAt       DateTime      @default(now()) @map("created_at")
  createdBy       String?       @map("created_by") @db.Uuid
  updatedAt       DateTime      @updatedAt @map("updated_at")
  updatedBy       String?       @map("updated_by") @db.Uuid

  // Relationships
  categoryType    CategoryType  @relation(fields: [categoryTypeId], references: [id], onDelete: Cascade)
  tenant          Tenant?       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent          Category?     @relation("CategoryHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children        Category[]    @relation("CategoryHierarchy")
  
  // Usage in other tables
  materialsMain   Material[]    @relation("MaterialCategory")
  materialsSub    Material[]    @relation("MaterialSubcategory")
  materialsYarnWeight Material[] @relation("MaterialYarnWeight")
  materialsFiberType Material[]  @relation("MaterialFiberType")
  productsMain    Product[]     @relation("ProductCategory")
  productsSub     Product[]     @relation("ProductSubcategory")
  productsDifficulty Product[]  @relation("ProductDifficulty")
  laborRateConfigs LaborRateConfig[] // Labor rates for this category

  @@unique([categoryTypeId, tenantId, name], name: "unique_category_per_tenant")
  @@unique([categoryTypeId, name], name: "unique_system_category", map: "unique_system_category_idx")
  @@map("categories")
}

// =============================================================================
// ROLE-BASED ACCESS CONTROL MODELS
// =============================================================================

// Permission definitions
model Permission {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String    @unique @db.VarChar(100) // e.g., "products:create", "materials:read"
  description String?
  category    String    @db.VarChar(50) // e.g., "products", "materials", "analytics"
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relationships
  rolePermissions RolePermission[]

  @@map("permissions")
}

// Role definitions  
model Role {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String    @unique @db.VarChar(100) // e.g., "admin", "manager", "crafter"
  description String?
  isSystem    Boolean   @default(false) @map("is_system") // System roles can't be deleted
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relationships
  rolePermissions RolePermission[]
  users          User[]

  @@map("roles")
}

// Junction table for role permissions
model RolePermission {
  id           String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  roleId       String     @map("role_id") @db.Uuid
  permissionId String     @map("permission_id") @db.Uuid
  createdAt    DateTime   @default(now()) @map("created_at")

  // Relationships
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@unique([roleId, permissionId], name: "unique_role_permission")
  @@map("role_permissions")
}

// =============================================================================
// CORE INFRASTRUCTURE MODELS
// =============================================================================

// Tenant model - root of multi-tenant hierarchy
model Tenant {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                 String    @db.VarChar(255)
  subdomain            String    @unique @db.VarChar(100)
  domain               String?   @db.VarChar(255)
  contactEmail         String    @map("contact_email") @db.VarChar(255)
  contactName          String?   @map("contact_name") @db.VarChar(255)
  phone                String?   @db.VarChar(50)
  stripeCustomerId     String?   @unique @map("stripe_customer_id") @db.VarChar(255)
  subscriptionTier     String    @default("free") @map("subscription_tier") @db.VarChar(50)
  subscriptionStatus   String    @default("active") @map("subscription_status") @db.VarChar(50)
  trialEndsAt          DateTime? @map("trial_ends_at")
  businessName         String?   @map("business_name") @db.VarChar(255)
  businessAddress      Json?     @map("business_address")
  taxId                String?   @map("tax_id") @db.VarChar(100)
  currency             String    @default("USD") @db.VarChar(3)
  timezone             String    @default("America/New_York") @db.VarChar(100)
  features             Json      @default("{}")
  limits               Json      @default("{}")
  settings             Json      @default("{}")
  integrations         Json      @default("{}")
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  users                User[]
  categories           Category[]        // Custom categories for this tenant
  materials            Material[]
  products             Product[]
  marketEvents         MarketEvent[]     @map("market_events")
  exportJobs           ExportJob[]       @map("export_jobs")
  integrationConfigs   IntegrationConfig[] @map("integration_configs")
  files                File[]
  auditLogs            AuditLog[]        @map("audit_logs")
  productMaterials     ProductMaterial[] @map("product_materials")
  marketEventProducts  MarketEventProduct[] @map("market_event_products")
  auditArchiveConfigs  AuditArchiveConfig[] @map("audit_archive_configs")
  auditArchiveJobs     AuditArchiveJob[] @map("audit_archive_jobs")
  laborRateConfigs     LaborRateConfig[] @map("labor_rate_configs")
  laborCostCalculations LaborCostCalculation[] @map("labor_cost_calculations")

  @@map("tenants")
}

// User model with custom authentication
model User {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  email                String    @db.VarChar(255)
  passwordHash         String    @map("password_hash") @db.VarChar(255)
  firstName            String?   @map("first_name") @db.VarChar(100)
  lastName             String?   @map("last_name") @db.VarChar(100)
  displayName          String?   @map("display_name") @db.VarChar(200)
  avatarUrl            String?   @map("avatar_url") @db.VarChar(500)
  phone                String?   @db.VarChar(50)
  roleId               String?   @map("role_id") @db.Uuid
  customPermissions    Json      @default("[]") @map("custom_permissions") // Additional permissions beyond role
  laborRate            Decimal   @default(25.00) @map("labor_rate") @db.Decimal(8, 2)
  preferredCurrency    String    @default("USD") @map("preferred_currency") @db.VarChar(3)
  timezone             String?   @db.VarChar(100)
  locale               String    @default("en-US") @db.VarChar(10)
  uiPreferences        Json      @default("{}") @map("ui_preferences")
  notificationSettings Json     @default("{}") @map("notification_settings")
  integrationTokens    Json      @default("{}") @map("integration_tokens")
  
  // Authentication fields
  emailVerified        Boolean   @default(false) @map("email_verified")
  emailVerificationToken String? @unique @map("email_verification_token") @db.VarChar(255)
  emailVerificationExpiresAt DateTime? @map("email_verification_expires_at")
  passwordResetToken   String?   @unique @map("password_reset_token") @db.VarChar(255)
  passwordResetExpiresAt DateTime? @map("password_reset_expires_at")
  mfaEnabled           Boolean   @default(false) @map("mfa_enabled")
  mfaSecret            String?   @map("mfa_secret") @db.VarChar(255)
  mfaBackupCodes       Json?     @map("mfa_backup_codes")
  lastPasswordChangeAt DateTime? @map("last_password_change_at")
  failedLoginAttempts  Int       @default(0) @map("failed_login_attempts")
  lockedUntil          DateTime? @map("locked_until")
  
  // Session tracking
  lastLoginAt          DateTime? @map("last_login_at")
  lastActiveAt         DateTime? @map("last_active_at")
  loginCount           Int       @default(0) @map("login_count")
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  role                 Role?     @relation(fields: [roleId], references: [id])
  refreshTokens        RefreshToken[]
  exportJobsRequested  ExportJob[] @relation("ExportJobRequester")
  filesUploaded        File[]    @relation("FileUploader")
  laborRateConfigs     LaborRateConfig[]
  laborCalculations    LaborCostCalculation[] @relation("LaborCalculatedBy")
  laborApprovals       LaborCostCalculation[] @relation("LaborApprovedBy")
  jsonSchemasCreated   JsonSchema[] @relation("JsonSchemaCreatedBy")
  jsonSchemasApproved  JsonSchema[] @relation("JsonSchemaApprovedBy")

  @@unique([tenantId, email], name: "unique_tenant_email")
  @@unique([email], name: "unique_global_email")
  @@map("users")
}

// Refresh token model for JWT authentication
model RefreshToken {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  token           String    @unique @db.VarChar(500)
  expiresAt       DateTime  @map("expires_at")
  isRevoked       Boolean   @default(false) @map("is_revoked")
  revokedAt       DateTime? @map("revoked_at")
  deviceInfo      Json?     @map("device_info")
  ipAddress       String?   @map("ip_address") @db.Inet
  userAgent       String?   @map("user_agent") @db.VarChar(500)
  createdAt       DateTime  @default(now()) @map("created_at")

  // Relationships
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isRevoked], name: "idx_refresh_tokens_user")
  @@index([expiresAt], name: "idx_refresh_tokens_expiry")
  @@map("refresh_tokens")
}

// =============================================================================
// CORE BUSINESS MODELS
// =============================================================================

// Material model - supporting inventory (updated for normalized categories)
model Material {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  name                 String    @db.VarChar(255)
  description          String?
  sku                  String?   @db.VarChar(100)
  
  // Normalized category references
  categoryId           String    @map("category_id") @db.Uuid
  subcategoryId        String?   @map("subcategory_id") @db.Uuid
  yarnWeightId         String?   @map("yarn_weight_id") @db.Uuid
  fiberTypeId          String?   @map("fiber_type_id") @db.Uuid
  
  // Material specifications (kept as free-form for flexibility)
  brand                String?   @db.VarChar(255)
  color                String?   @db.VarChar(100)
  fiberContent         String?   @map("fiber_content") @db.VarChar(255)
  costPerUnit          Decimal   @map("cost_per_unit") @db.Decimal(10, 4)
  unit                 String    @db.VarChar(50)
  quantityAvailable    Decimal?  @map("quantity_available") @db.Decimal(10, 2)
  reorderLevel         Decimal?  @map("reorder_level") @db.Decimal(10, 2)
  reorderQuantity      Decimal?  @map("reorder_quantity") @db.Decimal(10, 2)
  supplierName         String?   @map("supplier_name") @db.VarChar(255)
  supplierSku          String?   @map("supplier_sku") @db.VarChar(100)
  supplierUrl          String?   @map("supplier_url") @db.VarChar(500)
  lastCostUpdateAt     DateTime? @map("last_cost_update_at")
  properties           Json      @default("{}")
  colorVariants        Json      @default("[]") @map("color_variants")
  timesUsed            Int       @default(0) @map("times_used")
  totalQuantityUsed    Decimal   @default(0) @map("total_quantity_used") @db.Decimal(10, 2)
  lastUsedAt           DateTime? @map("last_used_at")
  inventoryPolicy      String    @default("soft_limit") @map("inventory_policy") @db.VarChar(50)
  allowNegativeInventory Boolean @default(true) @map("allow_negative_inventory")
  imageUrls            Json      @default("[]") @map("image_urls")
  notes                String?
  tags                 Json      @default("[]")
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category             Category  @relation("MaterialCategory", fields: [categoryId], references: [id])
  subcategory          Category? @relation("MaterialSubcategory", fields: [subcategoryId], references: [id])
  yarnWeight           Category? @relation("MaterialYarnWeight", fields: [yarnWeightId], references: [id])
  fiberType            Category? @relation("MaterialFiberType", fields: [fiberTypeId], references: [id])
  productMaterials     ProductMaterial[]

  @@map("materials")
}

// Product model - primary business entity (updated for normalized categories)
model Product {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  name                 String    @db.VarChar(255)
  description          String?
  sku                  String?   @db.VarChar(100)
  
  // Normalized category references
  categoryId           String    @map("category_id") @db.Uuid
  subcategoryId        String?   @map("subcategory_id") @db.Uuid
  difficultyLevelId    String?   @map("difficulty_level_id") @db.Uuid
  
  size                 String?   @db.VarChar(100)
  patternName          String?   @map("pattern_name") @db.VarChar(255)
  patternSource        String?   @map("pattern_source") @db.VarChar(255)
  patternUrl           String?   @map("pattern_url") @db.VarChar(500)
  estimatedHours       Decimal?  @map("estimated_hours") @db.Decimal(6, 2)
  actualHours          Decimal?  @map("actual_hours") @db.Decimal(6, 2)
  complexityMultiplier Decimal   @default(1.0) @map("complexity_multiplier") @db.Decimal(4, 2)
  materialCost         Decimal?  @map("material_cost") @db.Decimal(10, 2)
  laborCost            Decimal?  @map("labor_cost") @db.Decimal(10, 2)
  overheadCost         Decimal?  @map("overhead_cost") @db.Decimal(10, 2)
  totalCostToManufacture Decimal? @map("total_cost_to_manufacture") @db.Decimal(10, 2)
  salePrice            Decimal?  @map("sale_price") @db.Decimal(10, 2)
  marketPriceLow       Decimal?  @map("market_price_low") @db.Decimal(10, 2)
  marketPriceHigh      Decimal?  @map("market_price_high") @db.Decimal(10, 2)
  profitMargin         Decimal?  @map("profit_margin") @db.Decimal(5, 2)
  status               String    @default("draft") @db.VarChar(50)
  availability         String    @default("made_to_order") @db.VarChar(50)
  quantityInStock      Int       @default(0) @map("quantity_in_stock")
  quantitySold         Int       @default(0) @map("quantity_sold")
  hasVariants          Boolean   @default(false) @map("has_variants")
  variantOptions       Json      @default("{}") @map("variant_options")
  customizationOptions Json      @default("{}") @map("customization_options")
  shortDescription     String?   @map("short_description") @db.VarChar(500)
  sellingPoints        Json      @default("[]") @map("selling_points")
  careInstructions     String?   @map("care_instructions")
  imageUrls            Json      @default("[]") @map("image_urls")
  primaryImageUrl      String?   @map("primary_image_url") @db.VarChar(500)
  tags                 Json      @default("[]")
  keywords             Json      @default("[]")
  productionNotes      String?   @map("production_notes")
  specialInstructions  String?   @map("special_instructions")
  lastCostCalculationAt DateTime? @map("last_cost_calculation_at")
  costCalculationVersion Int     @default(1) @map("cost_calculation_version")
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  category             Category  @relation("ProductCategory", fields: [categoryId], references: [id])
  subcategory          Category? @relation("ProductSubcategory", fields: [subcategoryId], references: [id])
  difficultyLevel      Category? @relation("ProductDifficulty", fields: [difficultyLevelId], references: [id])
  materials            ProductMaterial[]
  marketEventProducts  MarketEventProduct[]
  laborCostCalculations LaborCostCalculation[]

  @@map("products")
}

// Junction table for product materials
model ProductMaterial {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  productId            String    @map("product_id") @db.Uuid
  materialId           String    @map("material_id") @db.Uuid
  quantityUsed         Decimal   @map("quantity_used") @db.Decimal(10, 4)
  unit                 String    @db.VarChar(50)
  unitCost             Decimal   @map("unit_cost") @db.Decimal(10, 4)
  totalCost            Decimal   @map("total_cost") @db.Decimal(10, 2)
  isPrimary            Boolean   @default(true) @map("is_primary")
  alternativeGroup     String?   @map("alternative_group") @db.VarChar(100)
  notes                String?
  costCalculatedAt     DateTime  @default(now()) @map("cost_calculated_at")
  costCalculationVersion Int     @default(1) @map("cost_calculation_version")
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product              Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  material             Material  @relation(fields: [materialId], references: [id], onDelete: Cascade)

  @@unique([productId, materialId, isPrimary], name: "unique_primary_material")
  @@map("product_materials")
}

// =============================================================================
// MARKET AND SALES MODELS
// =============================================================================

// Market events for sales tracking
model MarketEvent {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  name                 String    @db.VarChar(255)
  description          String?
  eventType            String?   @map("event_type") @db.VarChar(100)
  venueName            String?   @map("venue_name") @db.VarChar(255)
  venueAddress         Json?     @map("venue_address")
  startDate            DateTime  @map("start_date") @db.Date
  endDate              DateTime? @map("end_date") @db.Date
  startTime            DateTime? @map("start_time") @db.Time
  endTime              DateTime? @map("end_time") @db.Time
  timezone             String?   @db.VarChar(100)
  boothNumber          String?   @map("booth_number") @db.VarChar(50)
  boothSize            String?   @map("booth_size") @db.VarChar(100)
  boothCost            Decimal?  @map("booth_cost") @db.Decimal(10, 2)
  vendorFee            Decimal?  @map("vendor_fee") @db.Decimal(10, 2)
  expectedAttendance   Int?      @map("expected_attendance")
  totalSales           Decimal   @default(0) @map("total_sales") @db.Decimal(10, 2)
  totalProfit          Decimal   @default(0) @map("total_profit") @db.Decimal(10, 2)
  itemsSold            Int       @default(0) @map("items_sold")
  status               String    @default("planned") @db.VarChar(50)
  preparationNotes     String?   @map("preparation_notes")
  setupNotes           String?   @map("setup_notes")
  salesNotes           String?   @map("sales_notes")
  sheetGeneratedAt     DateTime? @map("sheet_generated_at")
  sheetUrl             String?   @map("sheet_url") @db.VarChar(500)
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  products             MarketEventProduct[]

  @@map("market_events")
}

// Junction table for market event products
model MarketEventProduct {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  marketEventId        String    @map("market_event_id") @db.Uuid
  productId            String    @map("product_id") @db.Uuid
  quantityPlanned      Int       @default(1) @map("quantity_planned")
  quantityBrought      Int?      @map("quantity_brought")
  quantitySold         Int       @default(0) @map("quantity_sold")
  salePriceOverride    Decimal?  @map("sale_price_override") @db.Decimal(10, 2)
  totalRevenue         Decimal   @default(0) @map("total_revenue") @db.Decimal(10, 2)
  displayOrder         Int?      @map("display_order")
  featured             Boolean   @default(false)
  notes                String?
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  marketEvent          MarketEvent @relation(fields: [marketEventId], references: [id], onDelete: Cascade)
  product              Product     @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([marketEventId, productId], name: "unique_event_product")
  @@map("market_event_products")
}

// =============================================================================
// INTEGRATION AND EXPORT MODELS
// =============================================================================

// Export jobs for platform integrations
model ExportJob {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  jobType              String    @map("job_type") @db.VarChar(100)
  targetPlatform       String    @map("target_platform") @db.VarChar(100)
  exportConfig         Json      @default("{}") @map("export_config")
  productIds           Json?     @map("product_ids")
  filters              Json?
  status               String    @default("queued") @db.VarChar(50)
  progressPercentage   Int       @default(0) @map("progress_percentage")
  itemsTotal           Int?      @map("items_total")
  itemsProcessed       Int       @default(0) @map("items_processed")
  itemsSuccessful      Int       @default(0) @map("items_successful")
  itemsFailed          Int       @default(0) @map("items_failed")
  resultFileUrl        String?   @map("result_file_url") @db.VarChar(500)
  resultMetadata       Json?     @map("result_metadata")
  errorLog             Json?     @map("error_log")
  startedAt            DateTime? @map("started_at")
  completedAt          DateTime? @map("completed_at")
  expiresAt            DateTime? @map("expires_at")
  retryCount           Int       @default(0) @map("retry_count")
  maxRetries           Int       @default(3) @map("max_retries")
  lastRetryAt          DateTime? @map("last_retry_at")
  requestedBy          String    @map("requested_by") @db.Uuid
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  requester            User      @relation("ExportJobRequester", fields: [requestedBy], references: [id])

  @@map("export_jobs")
}

// Integration configurations
model IntegrationConfig {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  platform             String    @db.VarChar(100)
  integrationName      String?   @map("integration_name") @db.VarChar(255)
  credentials          Json      @default("{}") // Encrypted
  connectionConfig     Json      @default("{}") @map("connection_config")
  status               String    @default("inactive") @db.VarChar(50)
  lastSyncAt           DateTime? @map("last_sync_at")
  lastHealthCheckAt    DateTime? @map("last_health_check_at")
  healthStatus         String?   @map("health_status") @db.VarChar(50)
  errorMessage         String?   @map("error_message")
  autoSyncEnabled      Boolean   @default(false) @map("auto_sync_enabled")
  syncFrequency        String?   @map("sync_frequency") @db.VarChar(50)
  syncConfig           Json      @default("{}") @map("sync_config")
  totalSyncs           Int       @default(0) @map("total_syncs")
  successfulSyncs      Int       @default(0) @map("successful_syncs")
  failedSyncs          Int       @default(0) @map("failed_syncs")
  lastSyncResult       Json?     @map("last_sync_result")
  rateLimitConfig      Json      @default("{}") @map("rate_limit_config")
  requestsToday        Int       @default(0) @map("requests_today")
  requestsThisHour     Int       @default(0) @map("requests_this_hour")
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, platform], name: "unique_active_platform")
  @@map("integration_configs")
}

// =============================================================================
// FILE MANAGEMENT MODELS
// =============================================================================

// File management
model File {
  id                   String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId             String    @map("tenant_id") @db.Uuid
  filename             String    @db.VarChar(255)
  originalFilename     String    @map("original_filename") @db.VarChar(255)
  mimeType             String    @map("mime_type") @db.VarChar(100)
  fileSize             BigInt    @map("file_size")
  storageProvider      String    @default("digitalocean_spaces") @map("storage_provider") @db.VarChar(50)
  storagePath          String    @map("storage_path") @db.VarChar(500)
  storageUrl           String    @map("storage_url") @db.VarChar(500)
  storageMetadata      Json      @default("{}") @map("storage_metadata")
  fileType             String    @map("file_type") @db.VarChar(100)
  entityType           String?   @map("entity_type") @db.VarChar(100)
  entityId             String?   @map("entity_id") @db.Uuid
  imageMetadata        Json?     @map("image_metadata")
  imageVariants        Json?     @map("image_variants")
  processingStatus     String    @default("completed") @map("processing_status") @db.VarChar(50)
  processingError      String?   @map("processing_error")
  isPublic             Boolean   @default(true) @map("is_public")
  downloadCount        Int       @default(0) @map("download_count")
  lastAccessedAt       DateTime? @map("last_accessed_at")
  expiresAt            DateTime? @map("expires_at")
  autoDeleteAfterDays  Int?      @map("auto_delete_after_days")
  uploadedBy           String    @map("uploaded_by") @db.Uuid
  
  // Soft delete and audit fields
  deletedAt            DateTime? @map("deleted_at")
  deletedBy            String?   @map("deleted_by") @db.Uuid
  createdAt            DateTime  @default(now()) @map("created_at")
  createdBy            String?   @map("created_by") @db.Uuid
  updatedAt            DateTime  @updatedAt @map("updated_at")
  updatedBy            String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant               Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  uploader             User      @relation("FileUploader", fields: [uploadedBy], references: [id])

  @@map("files")
}

// =============================================================================
// AUDIT AND COMPLIANCE MODELS
// =============================================================================

// Audit logging (partitioned version replaces this)
model AuditLog {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId     String    @map("tenant_id") @db.Uuid
  tableName    String    @map("table_name") @db.VarChar(100)
  recordId     String    @map("record_id") @db.Uuid
  operation    String    @db.VarChar(20)
  oldValues    Json?     @map("old_values")
  newValues    Json?     @map("new_values")
  changedFields String[] @map("changed_fields")
  userId       String?   @map("user_id") @db.Uuid
  sessionId    String?   @map("session_id") @db.VarChar(255)
  ipAddress    String?   @map("ip_address") @db.Inet
  userAgent    String?   @map("user_agent")
  requestId    String?   @map("request_id") @db.VarChar(255)
  apiEndpoint  String?   @map("api_endpoint") @db.VarChar(255)
  httpMethod   String?   @map("http_method") @db.VarChar(10)
  businessReason String? @map("business_reason")
  approvalRequired Boolean @default(false) @map("approval_required")
  approvedBy   String?   @map("approved_by") @db.Uuid
  approvedAt   DateTime? @map("approved_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  // Relationships
  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("audit_logs")
}

// Archive configuration for audit logs
model AuditArchiveConfig {
  id                        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId                  String?   @map("tenant_id") @db.Uuid
  hotRetentionMonths        Int       @default(6) @map("hot_retention_months")
  warmRetentionMonths       Int       @default(24) @map("warm_retention_months")
  coldRetentionMonths       Int       @default(84) @map("cold_retention_months")
  warmStoragePath           String?   @map("warm_storage_path")
  coldStoragePath           String?   @map("cold_storage_path")
  compressionEnabled        Boolean   @default(true) @map("compression_enabled")
  encryptionEnabled         Boolean   @default(true) @map("encryption_enabled")
  archiveBatchSize          Int       @default(10000) @map("archive_batch_size")
  maxArchiveDurationMinutes Int       @default(30) @map("max_archive_duration_minutes")
  legalHold                 Boolean   @default(false) @map("legal_hold")
  retentionPolicyVersion    Int       @default(1) @map("retention_policy_version")
  createdAt                 DateTime  @default(now()) @map("created_at")
  updatedAt                 DateTime  @updatedAt @map("updated_at")

  // Relationships
  tenant                    Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("audit_archive_config")
}

// Archive job tracking
model AuditArchiveJob {
  id                        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jobType                   String    @map("job_type") @db.VarChar(50)
  tenantId                  String?   @map("tenant_id") @db.Uuid
  partitionName             String    @map("partition_name")
  startDate                 DateTime  @map("start_date") @db.Date
  endDate                   DateTime  @map("end_date") @db.Date
  status                    String    @default("queued") @map("status") @db.VarChar(50)
  recordsProcessed          Int       @default(0) @map("records_processed")
  recordsArchived           Int       @default(0) @map("records_archived")
  recordsDeleted            Int       @default(0) @map("records_deleted")
  compressionRatio          Decimal?  @map("compression_ratio") @db.Decimal(5,2)
  startedAt                 DateTime? @map("started_at")
  completedAt               DateTime? @map("completed_at")
  durationSeconds           Int?      @map("duration_seconds")
  averageRecordsPerSecond   Int?      @map("average_records_per_second")
  archiveFilePath           String?   @map("archive_file_path")
  archiveFileSizeBytes      BigInt?   @map("archive_file_size_bytes")
  checksum                  String?   @map("checksum") @db.VarChar(64)
  errorMessage              String?   @map("error_message")
  retryCount                Int       @default(0) @map("retry_count")
  maxRetries                Int       @default(3) @map("max_retries")
  createdAt                 DateTime  @default(now()) @map("created_at")

  // Relationships
  tenant                    Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("audit_archive_jobs")
}

// =============================================================================
// LABOR RATE MANAGEMENT MODELS
// =============================================================================

// Labor rate configuration
model LaborRateConfig {
  id                  String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId            String    @map("tenant_id") @db.Uuid
  userId              String?   @map("user_id") @db.Uuid
  rateName            String    @map("rate_name") @db.VarChar(100)
  baseHourlyRate      Decimal   @map("base_hourly_rate") @db.Decimal(8,2)
  currency            String    @default("USD") @db.VarChar(3)
  productCategoryId   String?   @map("product_category_id") @db.Uuid
  difficultyMultiplier Decimal  @default(1.0) @map("difficulty_multiplier") @db.Decimal(4,2)
  complexityMultiplier Decimal  @default(1.0) @map("complexity_multiplier") @db.Decimal(4,2)
  rushMultiplier      Decimal   @default(1.0) @map("rush_multiplier") @db.Decimal(4,2)
  effectiveDate       DateTime  @default(now()) @map("effective_date") @db.Date
  expiryDate          DateTime? @map("expiry_date") @db.Date
  isActive            Boolean   @default(true) @map("is_active")
  isDefault           Boolean   @default(false) @map("is_default")
  timesUsed           Int       @default(0) @map("times_used")
  lastUsedAt          DateTime? @map("last_used_at")
  
  // Soft delete and audit fields
  deletedAt           DateTime? @map("deleted_at")
  deletedBy           String?   @map("deleted_by") @db.Uuid
  createdAt           DateTime  @default(now()) @map("created_at")
  createdBy           String?   @map("created_by") @db.Uuid
  updatedAt           DateTime  @updatedAt @map("updated_at")
  updatedBy           String?   @map("updated_by") @db.Uuid

  // Relationships
  tenant              Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user                User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  productCategory     Category? @relation(fields: [productCategoryId], references: [id])
  laborCostCalculations LaborCostCalculation[]

  @@index([tenantId, isActive, effectiveDate], name: "idx_labor_rates_tenant_active")
  @@index([userId, isActive], name: "idx_labor_rates_user")
  @@index([productCategoryId, isActive], name: "idx_labor_rates_category")
  @@map("labor_rate_configs")
}

// Labor cost calculation tracking
model LaborCostCalculation {
  id                     String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId               String    @map("tenant_id") @db.Uuid
  productId              String    @map("product_id") @db.Uuid
  laborRateConfigId      String?   @map("labor_rate_config_id") @db.Uuid
  baseHourlyRate         Decimal   @map("base_hourly_rate") @db.Decimal(8,2)
  effectiveMultipliers   Json      @default("{}") @map("effective_multipliers")
  estimatedHours         Decimal?  @map("estimated_hours") @db.Decimal(6,2)
  actualHours            Decimal?  @map("actual_hours") @db.Decimal(6,2)
  calculatedLaborCost    Decimal   @map("calculated_labor_cost") @db.Decimal(10,2)
  calculationMethod      String    @map("calculation_method") @db.VarChar(50)
  calculationContext     Json      @default("{}") @map("calculation_context")
  calculatedBy           String?   @map("calculated_by") @db.Uuid
  calculatedAt           DateTime  @default(now()) @map("calculated_at")
  requiresApproval       Boolean   @default(false) @map("requires_approval")
  approvedBy             String?   @map("approved_by") @db.Uuid
  approvedAt             DateTime? @map("approved_at")
  approvalNotes          String?   @map("approval_notes")
  version                Int       @default(1)
  isCurrent              Boolean   @default(true) @map("is_current")
  supersededBy           String?   @map("superseded_by") @db.Uuid
  calculationDurationMs  Int?      @map("calculation_duration_ms")

  // Relationships
  tenant                 Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  product                Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  laborRateConfig        LaborRateConfig? @relation(fields: [laborRateConfigId], references: [id])
  calculatedByUser       User?     @relation("LaborCalculatedBy", fields: [calculatedBy], references: [id])
  approvedByUser         User?     @relation("LaborApprovedBy", fields: [approvedBy], references: [id])

  @@index([productId, isCurrent, version], name: "idx_labor_calc_product_current")
  @@index([tenantId, calculatedAt], name: "idx_labor_calc_tenant_date")
  @@index([calculatedBy, calculatedAt], name: "idx_labor_calc_user")
  @@map("labor_cost_calculations")
}

// =============================================================================
// JSON SCHEMA MANAGEMENT MODELS
// =============================================================================

// JSON Schema definitions
model JsonSchema {
  id                         String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  schemaName                 String    @map("schema_name") @db.VarChar(100)
  version                    Int
  tableName                  String    @map("table_name") @db.VarChar(100)
  columnName                 String    @map("column_name") @db.VarChar(100)
  schemaDefinition           Json      @map("schema_definition")
  previousVersion            Int?      @map("previous_version")
  migrationScript            String?   @map("migration_script")
  breakingChange             Boolean   @default(false) @map("breaking_change")
  strictValidation           Boolean   @default(true) @map("strict_validation")
  allowAdditionalProperties  Boolean   @default(false) @map("allow_additional_properties")
  status                     String    @default("draft") @db.VarChar(50)
  effectiveDate              DateTime  @default(now()) @map("effective_date") @db.Date
  retirementDate             DateTime? @map("retirement_date") @db.Date
  description                String?
  documentationUrl           String?   @map("documentation_url")
  createdBy                  String?   @map("created_by") @db.Uuid
  approvedBy                 String?   @map("approved_by") @db.Uuid
  createdAt                  DateTime  @default(now()) @map("created_at")
  updatedAt                  DateTime  @updatedAt @map("updated_at")

  // Relationships  
  createdByUser              User?     @relation("JsonSchemaCreatedBy", fields: [createdBy], references: [id])
  approvedByUser             User?     @relation("JsonSchemaApprovedBy", fields: [approvedBy], references: [id])
  jsonSchemaUsage            JsonSchemaUsage[]

  @@unique([schemaName, version], name: "unique_schema_version")
  @@index([tableName, columnName, status], name: "idx_json_schemas_table_column")
  @@index([schemaName, version], name: "idx_json_schemas_active")
  @@map("json_schemas")
}

// JSON Schema usage tracking
model JsonSchemaUsage {
  id                    String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  schemaId              String    @map("schema_id") @db.Uuid
  tableName             String    @map("table_name") @db.VarChar(100)
  recordId              String    @map("record_id") @db.Uuid
  validationStatus      String    @map("validation_status") @db.VarChar(50)
  validationErrors      Json?     @map("validation_errors")
  validationWarnings    Json?     @map("validation_warnings")
  validationDurationMs  Int?      @map("validation_duration_ms")
  validatedAt           DateTime  @default(now()) @map("validated_at")
  migrationApplied      Boolean   @default(false) @map("migration_applied")
  migrationAppliedAt    DateTime? @map("migration_applied_at")
  migrationError        String?   @map("migration_error")

  // Relationships
  jsonSchema            JsonSchema @relation(fields: [schemaId], references: [id])

  @@index([tableName, recordId, validatedAt], name: "idx_schema_usage_record")
  @@index([validationStatus, validatedAt], name: "idx_schema_usage_validation")
  @@map("json_schema_usage")
}