// =============================================================================
// TypeScript Integration for Advanced Cost Calculation & Schema Management
// =============================================================================

// =============================================================================
// 1. COST CALCULATION ACCURACY - TypeScript INTERFACES
// =============================================================================

// Labor rate configuration types
export interface LaborRateConfig {
  id: string
  tenantId: string
  userId?: string // null for tenant-wide rates
  rateName: string
  baseHourlyRate: number
  currency: string
  productCategoryId?: string
  difficultyMultiplier: number
  complexityMultiplier: number
  rushMultiplier: number
  effectiveDate: Date
  expiryDate?: Date
  isActive: boolean
  isDefault: boolean
  timesUsed: number
  lastUsedAt?: Date
}

// Historical cost calculation
export interface LaborCostCalculation {
  id: string
  tenantId: string
  productId: string
  laborRateConfigId: string
  baseHourlyRate: number
  effectiveMultipliers: {
    difficultyMultiplier: number
    complexityMultiplier: number
    rushMultiplier?: number
  }
  estimatedHours?: number
  actualHours?: number
  calculatedLaborCost: number
  calculationMethod: 'time_based' | 'multiplier_based' | 'fixed_rate'
  calculationContext: Record<string, any>
  calculatedBy: string
  calculatedAt: Date
  requiresApproval: boolean
  approvedBy?: string
  approvedAt?: Date
  version: number
  isCurrent: boolean
}

// Cost calculation service with audit trail
export class CostCalculationService {
  constructor(private api: ApiClient) {}

  // Get applicable labor rate with full context
  async getApplicableLaborRate(params: {
    tenantId: string
    userId?: string
    productCategoryId?: string
    calculationDate?: Date
    rushOrder?: boolean
  }): Promise<{
    configId: string
    baseRate: number
    totalMultiplier: number
    effectiveHourlyRate: number
    rateBreakdown: {
      baseRate: number
      difficultyMultiplier: number
      complexityMultiplier: number
      rushMultiplier?: number
    }
  }> {
    const response = await this.api.post('/cost-calculation/applicable-rate', params)
    return response.data
  }

  // Calculate labor cost with full audit trail
  async calculateLaborCostWithHistory(params: {
    productId: string
    userId: string
    estimatedHours: number
    actualHours?: number
    rushOrder?: boolean
    calculationContext?: Record<string, any>
  }): Promise<string> { // Returns calculation ID
    const response = await this.api.post('/cost-calculation/calculate-with-history', params)
    return response.data.calculationId
  }

  // Get cost calculation history
  async getLaborCostHistory(
    productId: string, 
    limit: number = 10
  ): Promise<Array<{
    calculationId: string
    calculatedAt: Date
    baseRate: number
    effectiveRate: number
    hoursUsed: number
    totalCost: number
    method: string
    calculatedByName: string
    isCurrent: boolean
    requiresApproval: boolean
    approvedAt?: Date
  }>> {
    const response = await this.api.get(`/cost-calculation/history/${productId}?limit=${limit}`)
    return response.data
  }

  // Multi-user tenant cost validation
  async validateCostCalculationAccess(
    userId: string, 
    productId: string
  ): Promise<{
    canCalculate: boolean
    canApprove: boolean
    requiresApproval: boolean
    currentUserRate?: LaborRateConfig
  }> {
    const response = await this.api.get(`/cost-calculation/validate-access/${productId}?userId=${userId}`)
    return response.data
  }
}

// React hook for cost calculation with real-time accuracy
export const useCostCalculationWithHistory = (productId?: string) => {
  const [calculations, setCalculations] = useState<LaborCostCalculation[]>([])
  const [currentRate, setCurrentRate] = useState<LaborRateConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [validationStatus, setValidationStatus] = useState<{
    canCalculate: boolean
    canApprove: boolean
    requiresApproval: boolean
  } | null>(null)

  const costService = new CostCalculationService(api)
  const { user } = useUser()

  // Load calculation history
  useEffect(() => {
    if (productId && user) {
      const loadData = async () => {
        setLoading(true)
        try {
          const [history, validation] = await Promise.all([
            costService.getLaborCostHistory(productId),
            costService.validateCostCalculationAccess(user.id, productId)
          ])
          
          setCalculations(history)
          setValidationStatus(validation)
          
          if (validation.currentUserRate) {
            setCurrentRate(validation.currentUserRate)
          }
        } catch (error) {
          console.error('Failed to load cost calculation data:', error)
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [productId, user])

  // Calculate new cost with validation
  const calculateCost = useCallback(async (params: {
    estimatedHours: number
    actualHours?: number
    rushOrder?: boolean
    calculationContext?: Record<string, any>
  }) => {
    if (!productId || !user || !validationStatus?.canCalculate) {
      throw new Error('Cannot calculate cost - insufficient permissions')
    }

    setLoading(true)
    try {
      const calculationId = await costService.calculateLaborCostWithHistory({
        productId,
        userId: user.id,
        ...params
      })

      // Reload history to show new calculation
      const updatedHistory = await costService.getLaborCostHistory(productId)
      setCalculations(updatedHistory)

      return calculationId
    } finally {
      setLoading(false)
    }
  }, [productId, user, validationStatus])

  return {
    calculations,
    currentRate,
    loading,
    validationStatus,
    calculateCost,
    canCalculate: validationStatus?.canCalculate || false,
    canApprove: validationStatus?.canApprove || false
  }
}

// =============================================================================
// 2. AUDIT TRAIL OPTIMIZATION - TypeScript INTERFACES
// =============================================================================

// Audit configuration types
export interface AuditArchiveConfig {
  id: string
  tenantId?: string
  hotRetentionMonths: number
  warmRetentionMonths: number
  coldRetentionMonths: number
  warmStoragePath?: string
  coldStoragePath?: string
  compressionEnabled: boolean
  encryptionEnabled: boolean
  archiveBatchSize: number
  maxArchiveDurationMinutes: number
  legalHold: boolean
  retentionPolicyVersion: number
}

export interface AuditArchiveJob {
  id: string
  jobType: 'warm_archive' | 'cold_archive' | 'cleanup'
  tenantId?: string
  partitionName: string
  startDate: Date
  endDate: Date
  status: 'queued' | 'running' | 'completed' | 'failed'
  recordsProcessed: number
  recordsArchived: number
  recordsDeleted: number
  compressionRatio?: number
  startedAt?: Date
  completedAt?: Date
  durationSeconds?: number
  averageRecordsPerSecond?: number
  archiveFilePath?: string
  archiveFileSizeBytes?: bigint
  checksum?: string
  errorMessage?: string
  retryCount: number
  maxRetries: number
}

// Audit monitoring service
export class AuditMonitoringService {
  constructor(private api: ApiClient) {}

  // Get audit system performance metrics
  async getPerformanceMetrics(): Promise<Array<{
    metricName: string
    metricValue: number
    metricUnit: string
    status: 'ok' | 'warning' | 'critical'
    recommendation: string
  }>> {
    const response = await this.api.get('/audit/performance-metrics')
    return response.data
  }

  // Start archive job
  async startArchiveJob(params: {
    tenantId?: string
    jobType: 'warm_archive' | 'cold_archive'
    targetDate?: Date
  }): Promise<string> { // Returns job ID
    const response = await this.api.post('/audit/archive', params)
    return response.data.jobId
  }

  // Get archive job status
  async getArchiveJobStatus(jobId: string): Promise<AuditArchiveJob> {
    const response = await this.api.get(`/audit/archive-jobs/${jobId}`)
    return response.data
  }

  // Get archive configuration
  async getArchiveConfig(tenantId?: string): Promise<AuditArchiveConfig> {
    const response = await this.api.get(`/audit/config${tenantId ? `?tenantId=${tenantId}` : ''}`)
    return response.data
  }

  // Update archive configuration
  async updateArchiveConfig(
    config: Partial<AuditArchiveConfig>
  ): Promise<AuditArchiveConfig> {
    const response = await this.api.put('/audit/config', config)
    return response.data
  }
}

// React hook for audit monitoring
export const useAuditMonitoring = () => {
  const [metrics, setMetrics] = useState<any[]>([])
  const [config, setConfig] = useState<AuditArchiveConfig | null>(null)
  const [jobs, setJobs] = useState<AuditArchiveJob[]>([])
  const [loading, setLoading] = useState(false)

  const auditService = new AuditMonitoringService(api)

  // Load audit data
  useEffect(() => {
    const loadAuditData = async () => {
      setLoading(true)
      try {
        const [performanceMetrics, archiveConfig] = await Promise.all([
          auditService.getPerformanceMetrics(),
          auditService.getArchiveConfig()
        ])
        
        setMetrics(performanceMetrics)
        setConfig(archiveConfig)
      } catch (error) {
        console.error('Failed to load audit data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadAuditData()
  }, [])

  // Start archive job
  const startArchive = useCallback(async (jobType: 'warm_archive' | 'cold_archive') => {
    try {
      const jobId = await auditService.startArchiveJob({ jobType })
      
      // Poll job status
      const pollStatus = async () => {
        const job = await auditService.getArchiveJobStatus(jobId)
        setJobs(prev => {
          const updated = prev.filter(j => j.id !== jobId)
          return [...updated, job]
        })
        
        if (job.status === 'running') {
          setTimeout(pollStatus, 5000) // Poll every 5 seconds
        }
      }
      
      pollStatus()
      return jobId
    } catch (error) {
      console.error('Failed to start archive job:', error)
      throw error
    }
  }, [])

  return {
    metrics,
    config,
    jobs,
    loading,
    startArchive,
    hasWarnings: metrics.some(m => m.status === 'warning'),
    hasCritical: metrics.some(m => m.status === 'critical')
  }
}

// =============================================================================
// 3. JSON SCHEMA MANAGEMENT - TypeScript INTERFACES
// =============================================================================

// JSON Schema types
export interface JsonSchema {
  id: string
  schemaName: string
  version: number
  tableName: string
  columnName: string
  schemaDefinition: Record<string, any> // JSON Schema format
  previousVersion?: number
  migrationScript?: string
  breakingChange: boolean
  strictValidation: boolean
  allowAdditionalProperties: boolean
  status: 'draft' | 'active' | 'deprecated' | 'retired'
  effectiveDate: Date
  retirementDate?: Date
  description?: string
  documentationUrl?: string
  createdBy?: string
  approvedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface JsonValidationResult {
  isValid: boolean
  validationErrors: Array<{
    code: string
    message: string
    property?: string
    allowedValues?: any[]
  }>
  validationWarnings: Array<{
    code: string
    message: string
    property?: string
  }>
  schemaVersion: number
}

export interface JsonSchemaUsage {
  id: string
  schemaId: string
  tableName: string
  recordId: string
  validationStatus: 'valid' | 'invalid' | 'warning'
  validationErrors?: any[]
  validationWarnings?: any[]
  validationDurationMs?: number
  validatedAt: Date
  migrationApplied: boolean
  migrationAppliedAt?: Date
  migrationError?: string
}

// JSON Schema management service
export class JsonSchemaService {
  constructor(private api: ApiClient) {}

  // Validate JSON data against schema
  async validateJson(
    tableName: string,
    columnName: string,
    jsonData: Record<string, any>,
    recordId?: string
  ): Promise<JsonValidationResult> {
    const response = await this.api.post('/json-schema/validate', {
      tableName,
      columnName,
      jsonData,
      recordId
    })
    return response.data
  }

  // Get schema for table/column
  async getSchema(
    tableName: string,
    columnName: string,
    version?: number
  ): Promise<JsonSchema> {
    const params = new URLSearchParams({ tableName, columnName })
    if (version) params.append('version', version.toString())
    
    const response = await this.api.get(`/json-schema/schema?${params}`)
    return response.data
  }

  // Create new schema version
  async createSchemaVersion(schema: Omit<JsonSchema, 'id' | 'createdAt' | 'updatedAt'>): Promise<JsonSchema> {
    const response = await this.api.post('/json-schema/schema', schema)
    return response.data
  }

  // Migrate data between schema versions
  async migrateSchema(
    tableName: string,
    columnName: string,
    fromVersion: number,
    toVersion: number,
    batchSize: number = 1000
  ): Promise<{
    recordsProcessed: number
    recordsMigrated: number
    recordsFailed: number
    migrationDurationSeconds: number
  }> {
    const response = await this.api.post('/json-schema/migrate', {
      tableName,
      columnName,
      fromVersion,
      toVersion,
      batchSize
    })
    return response.data
  }

  // Get usage analytics
  async getUsageAnalytics(
    tableName: string,
    columnName: string
  ): Promise<Array<{
    propertyPath: string
    usageCount: number
    distinctValues: number
    dataType: string
    optimizationSuggestion: string
  }>> {
    const response = await this.api.get(`/json-schema/usage-analytics?tableName=${tableName}&columnName=${columnName}`)
    return response.data
  }

  // Optimize indexes for JSON column
  async optimizeIndexes(
    tableName: string,
    columnName: string
  ): Promise<string> {
    const response = await this.api.post('/json-schema/optimize-indexes', {
      tableName,
      columnName
    })
    return response.data.result
  }
}

// Type-safe JSON schema validation hook
export const useJsonSchemaValidation = <T extends Record<string, any>>(
  tableName: string,
  columnName: string,
  initialData?: T
) => {
  const [data, setData] = useState<T | undefined>(initialData)
  const [schema, setSchema] = useState<JsonSchema | null>(null)
  const [validationResult, setValidationResult] = useState<JsonValidationResult | null>(null)
  const [loading, setLoading] = useState(false)

  const schemaService = new JsonSchemaService(api)

  // Load schema
  useEffect(() => {
    const loadSchema = async () => {
      try {
        const schemaData = await schemaService.getSchema(tableName, columnName)
        setSchema(schemaData)
      } catch (error) {
        console.error('Failed to load schema:', error)
      }
    }
    loadSchema()
  }, [tableName, columnName])

  // Validate data when it changes
  useEffect(() => {
    if (data && schema) {
      const validateData = async () => {
        setLoading(true)
        try {
          const result = await schemaService.validateJson(tableName, columnName, data)
          setValidationResult(result)
        } catch (error) {
          console.error('Validation failed:', error)
        } finally {
          setLoading(false)
        }
      }
      
      // Debounce validation
      const timeoutId = setTimeout(validateData, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [data, schema, tableName, columnName])

  // Update data with validation
  const updateData = useCallback((newData: Partial<T>) => {
    setData(prev => ({ ...prev, ...newData } as T))
  }, [])

  // Validate specific field
  const validateField = useCallback(async (fieldPath: string, value: any): Promise<boolean> => {
    if (!schema) return true

    try {
      const testData = { ...data, [fieldPath]: value }
      const result = await schemaService.validateJson(tableName, columnName, testData)
      return result.isValid
    } catch {
      return false
    }
  }, [data, schema, tableName, columnName])

  return {
    data,
    setData: updateData,
    schema,
    validationResult,
    loading,
    isValid: validationResult?.isValid ?? true,
    errors: validationResult?.validationErrors ?? [],
    warnings: validationResult?.validationWarnings ?? [],
    validateField
  }
}

// Type-safe form component with JSON schema validation
export const JsonSchemaForm = <T extends Record<string, any>>({
  tableName,
  columnName,
  initialData,
  onSubmit,
  onValidationChange
}: {
  tableName: string
  columnName: string
  initialData?: T
  onSubmit: (data: T) => void
  onValidationChange?: (isValid: boolean) => void
}) => {
  const {
    data,
    setData,
    schema,
    validationResult,
    loading,
    isValid,
    errors,
    warnings
  } = useJsonSchemaValidation(tableName, columnName, initialData)

  // Notify parent of validation changes
  useEffect(() => {
    onValidationChange?.(isValid)
  }, [isValid, onValidationChange])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isValid && data) {
      onSubmit(data)
    }
  }

  if (!schema) {
    return <div>Loading schema...</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Render form fields based on schema */}
      {schema.schemaDefinition.properties && Object.entries(schema.schemaDefinition.properties).map(([key, propSchema]: [string, any]) => (
        <div key={key} className="space-y-2">
          <label className="block text-sm font-medium">
            {propSchema.title || key}
            {schema.schemaDefinition.required?.includes(key) && <span className="text-red-500">*</span>}
          </label>
          
          {propSchema.type === 'string' && (
            <input
              type="text"
              value={data?.[key] || ''}
              onChange={(e) => setData({ [key]: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder={propSchema.description}
            />
          )}
          
          {propSchema.type === 'number' && (
            <input
              type="number"
              value={data?.[key] || ''}
              onChange={(e) => setData({ [key]: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 border rounded"
              min={propSchema.minimum}
              max={propSchema.maximum}
              step={propSchema.multipleOf || 'any'}
            />
          )}
          
          {propSchema.type === 'boolean' && (
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={data?.[key] || false}
                onChange={(e) => setData({ [key]: e.target.checked })}
                className="mr-2"
              />
              {propSchema.description}
            </label>
          )}
          
          {propSchema.enum && (
            <select
              value={data?.[key] || ''}
              onChange={(e) => setData({ [key]: e.target.value })}
              className="w-full p-2 border rounded"
            >
              <option value="">Select...</option>
              {propSchema.enum.map((option: string) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          )}
        </div>
      ))}
      
      {/* Validation feedback */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <h4 className="font-medium text-red-800">Validation Errors:</h4>
          <ul className="mt-1 text-sm text-red-600">
            {errors.map((error, idx) => (
              <li key={idx}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}
      
      {warnings.length > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
          <h4 className="font-medium text-yellow-800">Warnings:</h4>
          <ul className="mt-1 text-sm text-yellow-600">
            {warnings.map((warning, idx) => (
              <li key={idx}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}
      
      <button
        type="submit"
        disabled={!isValid || loading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Validating...' : 'Submit'}
      </button>
    </form>
  )
}

// Export all services for easy access
export const services = {
  costCalculation: new CostCalculationService(api),
  auditMonitoring: new AuditMonitoringService(api),
  jsonSchema: new JsonSchemaService(api)
}