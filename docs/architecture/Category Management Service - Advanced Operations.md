// =============================================================================
// Category Management Service - Advanced Operations
// =============================================================================
// TypeScript service layer for handling complex category operations

import { PrismaClient } from '@prisma/client'
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

export interface CategoryMoveRequest {
  categoryId: string
  newParentId?: string
  reason?: string
}

export interface CategoryDeletionOptions {
  strategy: 'abort' | 'reassign' | 'archive_items' | 'force_delete'
  reassignToCategoryId?: string
  reason?: string
}

export interface CategoryDeletionImpact {
  categoryName: string
  directProducts: number
  directMaterials: number
  childCategories: number
  totalAffectedProducts: number
  totalAffectedMaterials: number
  canDeleteSafely: boolean
  suggestedAction: string
}

export interface CategoryPerformanceMetrics {
  operationType: string
  avgDurationMs: number
  totalCalls: number
  slowestQuery: string
}

@Injectable()
export class CategoryManagementService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly eventEmitter: EventEmitter2
  ) {}

  // =============================================================================
  // 1. CATEGORY HIERARCHY MIGRATION & REORGANIZATION
  // =============================================================================

  /**
   * Move a category and all its children to a new parent
   */
  async moveCategorySubtree(
    tenantId: string,
    categoryId: string,
    newParentId?: string,
    userId?: string,
    reason?: string
  ): Promise<{
    categoriesMoved: number
    productsAffected: number
    materialsAffected: number
  }> {
    try {
      // Validate permissions and business rules first
      await this.validateCategoryMove(tenantId, categoryId, newParentId)

      const result = await this.prisma.$queryRaw`
        SELECT * FROM move_category_subtree(
          ${categoryId}::UUID,
          ${newParentId ? newParentId + '::UUID' : null},
          ${userId ? userId + '::UUID' : null}
        )
      ` as any[]

      const moveResult = result[0]

      // Emit event for cache invalidation and real-time updates
      this.eventEmitter.emit('category.moved', {
        tenantId,
        categoryId,
        newParentId,
        result: moveResult,
        userId,
        reason
      })

      // Refresh materialized views asynchronously
      this.refreshCategoryPaths().catch(console.error)

      return {
        categoriesMoved: moveResult.categories_moved,
        productsAffected: moveResult.products_affected,
        materialsAffected: moveResult.materials_affected
      }
    } catch (error) {
      throw new BadRequestException(`Failed to move category: ${error.message}`)
    }
  }

  /**
   * Batch reorganize multiple categories
   */
  async batchReorganizeCategories(
    tenantId: string,
    moves: CategoryMoveRequest[],
    userId?: string
  ): Promise<Array<{
    categoryId: string
    status: 'success' | 'error'
    errorMessage?: string
    categoriesMoved?: number
    productsAffected?: number
    materialsAffected?: number
  }>> {
    // Validate all moves first
    for (const move of moves) {
      await this.validateCategoryMove(tenantId, move.categoryId, move.newParentId)
    }

    const movesJson = JSON.stringify(
      moves.map(m => ({
        category_id: m.categoryId,
        new_parent_id: m.newParentId || 'null'
      }))
    )

    const results = await this.prisma.$queryRaw`
      SELECT * FROM batch_reorganize_categories(
        ${movesJson}::JSONB,
        ${userId ? userId + '::UUID' : null}
      )
    ` as any[]

    // Emit batch move event
    this.eventEmitter.emit('category.batch_moved', {
      tenantId,
      moves,
      results,
      userId
    })

    // Refresh materialized views
    this.refreshCategoryPaths().catch(console.error)

    return results.map(r => ({
      categoryId: r.category_id,
      status: r.status,
      errorMessage: r.error_message,
      categoriesMoved: r.categories_moved,
      productsAffected: r.products_affected,
      materialsAffected: r.materials_affected
    }))
  }

  private async validateCategoryMove(
    tenantId: string,
    categoryId: string,
    newParentId?: string
  ): Promise<void> {
    // Check if category exists and belongs to tenant
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ tenantId }, { tenantId: null }] // Allow system categories
      }
    })

    if (!category) {
      throw new BadRequestException('Category not found or not accessible')
    }

    // Check if new parent exists and belongs to tenant (if specified)
    if (newParentId) {
      const parentCategory = await this.prisma.category.findFirst({
        where: {
          id: newParentId,
          OR: [{ tenantId }, { tenantId: null }]
        }
      })

      if (!parentCategory) {
        throw new BadRequestException('Parent category not found or not accessible')
      }

      // Check if categories are of compatible types
      if (category.categoryTypeId !== parentCategory.categoryTypeId) {
        throw new BadRequestException('Cannot move category to different category type')
      }
    }
  }

  // =============================================================================
  // 2. CATEGORY DELETION WITH DEPENDENCY MANAGEMENT
  // =============================================================================

  /**
   * Analyze the impact of deleting a category
   */
  async analyzeCategoryDeletionImpact(
    categoryId: string
  ): Promise<CategoryDeletionImpact> {
    const result = await this.prisma.$queryRaw`
      SELECT * FROM analyze_category_deletion_impact(${categoryId}::UUID)
    ` as any[]

    const impact = result[0]
    return {
      categoryName: impact.category_name,
      directProducts: impact.direct_products,
      directMaterials: impact.direct_materials,
      childCategories: impact.child_categories,
      totalAffectedProducts: impact.total_affected_products,
      totalAffectedMaterials: impact.total_affected_materials,
      canDeleteSafely: impact.can_delete_safely,
      suggestedAction: impact.suggested_action
    }
  }

  /**
   * Delete category with user-specified strategy for handling dependencies
   */
  async deleteCategoryWithDependencies(
    tenantId: string,
    categoryId: string,
    options: CategoryDeletionOptions,
    userId?: string
  ): Promise<{
    status: string
    message: string
    productsReassigned: number
    materialsReassigned: number
    categoriesDeleted: number
  }> {
    // Analyze impact first
    const impact = await this.analyzeCategoryDeletionImpact(categoryId)

    // Validate deletion permissions
    await this.validateCategoryDeletion(tenantId, categoryId, options)

    const result = await this.prisma.$queryRaw`
      SELECT * FROM delete_category_with_dependencies(
        ${categoryId}::UUID,
        ${options.strategy},
        ${options.reassignToCategoryId ? options.reassignToCategoryId + '::UUID' : null},
        ${userId ? userId + '::UUID' : null}
      )
    ` as any[]

    const deletionResult = result[0]

    // Emit deletion event
    this.eventEmitter.emit('category.deleted', {
      tenantId,
      categoryId,
      options,
      impact,
      result: deletionResult,
      userId
    })

    // Refresh materialized views
    this.refreshCategoryPaths().catch(console.error)

    return {
      status: deletionResult.status,
      message: deletionResult.message,
      productsReassigned: deletionResult.products_reassigned,
      materialsReassigned: deletionResult.materials_reassigned,
      categoriesDeleted: deletionResult.categories_deleted
    }
  }

  private async validateCategoryDeletion(
    tenantId: string,
    categoryId: string,
    options: CategoryDeletionOptions
  ): Promise<void> {
    // Check if category belongs to tenant (can't delete system categories)
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        tenantId: tenantId // Must be tenant-specific, not system category
      }
    })

    if (!category) {
      throw new BadRequestException('Cannot delete system categories or category not found')
    }

    // Validate reassignment target if specified
    if (options.strategy === 'reassign' && !options.reassignToCategoryId) {
      throw new BadRequestException('Reassignment target required for reassign strategy')
    }

    if (options.reassignToCategoryId) {
      const targetCategory = await this.prisma.category.findFirst({
        where: {
          id: options.reassignToCategoryId,
          OR: [{ tenantId }, { tenantId: null }]
        }
      })

      if (!targetCategory) {
        throw new BadRequestException('Reassignment target category not found')
      }

      if (targetCategory.categoryTypeId !== category.categoryTypeId) {
        throw new BadRequestException('Cannot reassign to different category type')
      }
    }
  }

  // =============================================================================
  // 3. PERFORMANCE OPTIMIZATION FOR DEEP HIERARCHIES
  // =============================================================================

  /**
   * Get category tree with pagination and depth limits for performance
   */
  async getCategoryTreePaginated(
    tenantId: string,
    categoryType: string,
    parentId?: string,
    options: {
      maxDepth?: number
      limit?: number
      offset?: number
    } = {}
  ): Promise<Array<{
    id: string
    name: string
    parentId?: string
    level: number
    fullPath: string
    usageCount: number
    childrenCount: number
    hasMoreChildren: boolean
  }>> {
    const {
      maxDepth = 3,
      limit = 100,
      offset = 0
    } = options

    const result = await this.prisma.$queryRaw`
      SELECT * FROM get_category_tree_paginated(
        ${tenantId}::UUID,
        ${categoryType},
        ${parentId ? parentId + '::UUID' : null},
        ${maxDepth}::INTEGER,
        ${limit}::INTEGER,
        ${offset}::INTEGER
      )
    ` as any[]

    return result.map(r => ({
      id: r.id,
      name: r.name,
      parentId: r.parent_id,
      level: r.level,
      fullPath: r.full_path,
      usageCount: r.usage_count,
      childrenCount: Number(r.children_count),
      hasMoreChildren: r.has_more_children
    }))
  }

  /**
   * Search categories by path with relevance scoring
   */
  async searchCategoriesByPath(
    tenantId: string,
    categoryType: string,
    searchTerm: string,
    limit: number = 20
  ): Promise<Array<{
    id: string
    name: string
    fullPath: string
    usageCount: number
    relevanceScore: number
  }>> {
    const result = await this.prisma.$queryRaw`
      SELECT * FROM search_categories_by_path(
        ${tenantId}::UUID,
        ${categoryType},
        ${searchTerm},
        ${limit}::INTEGER
      )
    ` as any[]

    return result.map(r => ({
      id: r.id,
      name: r.name,
      fullPath: r.full_path,
      usageCount: r.usage_count,
      relevanceScore: Number(r.relevance_score)
    }))
  }

  /**
   * Monitor category system performance
   */
  async getCategoryPerformanceMetrics(): Promise<CategoryPerformanceMetrics[]> {
    const result = await this.prisma.$queryRaw`
      SELECT * FROM monitor_category_performance()
    ` as any[]

    return result.map(r => ({
      operationType: r.operation_type,
      avgDurationMs: Number(r.avg_duration_ms),
      totalCalls: Number(r.total_calls),
      slowestQuery: r.slowest_query
    }))
  }

  /**
   * Refresh materialized views for category paths
   */
  async refreshCategoryPaths(): Promise<void> {
    await this.prisma.$queryRaw`SELECT refresh_category_paths()`
  }

  /**
   * Run automated category system maintenance
   */
  async maintainCategorySystem(): Promise<Array<{
    taskName: string
    status: string
    details: string
  }>> {
    const result = await this.prisma.$queryRaw`
      SELECT * FROM maintain_category_system()
    ` as any[]

    return result.map(r => ({
      taskName: r.task_name,
      status: r.status,
      details: r.details
    }))
  }

  // =============================================================================
  // 4. CACHING AND REAL-TIME UPDATES
  // =============================================================================

  /**
   * Intelligent category caching with invalidation
   */
  private categoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()

  async getCachedCategoryTree(
    tenantId: string,
    categoryType: string,
    forceRefresh: boolean = false
  ): Promise<any> {
    const cacheKey = `${tenantId}:${categoryType}:tree`
    const cached = this.categoryCache.get(cacheKey)
    const now = Date.now()

    // Use cache if available and not expired
    if (!forceRefresh && cached && (now - cached.timestamp) < cached.ttl) {
      return cached.data
    }

    // Fetch fresh data
    const data = await this.getCategoryTreePaginated(tenantId, categoryType)

    // Cache with appropriate TTL based on data size and usage
    const ttl = data.length > 100 ? 300000 : 600000 // 5-10 minutes
    this.categoryCache.set(cacheKey, { data, timestamp: now, ttl })

    return data
  }

  /**
   * Invalidate cache for tenant/category type
   */
  invalidateCategoryCache(tenantId: string, categoryType?: string): void {
    if (categoryType) {
      this.categoryCache.delete(`${tenantId}:${categoryType}:tree`)
    } else {
      // Invalidate all for tenant
      for (const key of this.categoryCache.keys()) {
        if (key.startsWith(`${tenantId}:`)) {
          this.categoryCache.delete(key)
        }
      }
    }
  }

  // =============================================================================
  // 5. BULK OPERATIONS WITH PROGRESS TRACKING
  // =============================================================================

  /**
   * Bulk category operations with progress tracking
   */
  async performBulkCategoryOperation(
    tenantId: string,
    operation: 'move' | 'delete' | 'merge',
    categoryIds: string[],
    options: any,
    progressCallback?: (progress: { completed: number; total: number; currentItem: string }) => void
  ): Promise<{
    successful: number
    failed: number
    errors: Array<{ categoryId: string; error: string }>
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ categoryId: string; error: string }>
    }

    for (let i = 0; i < categoryIds.length; i++) {
      const categoryId = categoryIds[i]
      
      try {
        // Report progress
        if (progressCallback) {
          progressCallback({
            completed: i,
            total: categoryIds.length,
            currentItem: categoryId
          })
        }

        switch (operation) {
          case 'move':
            await this.moveCategorySubtree(
              tenantId,
              categoryId,
              options.newParentId,
              options.userId,
              options.reason
            )
            break
          case 'delete':
            await this.deleteCategoryWithDependencies(
              tenantId,
              categoryId,
              options.deletionOptions,
              options.userId
            )
            break
          // Add other operations as needed
        }

        results.successful++
      } catch (error) {
        results.failed++
        results.errors.push({
          categoryId,
          error: error.message
        })
      }
    }

    // Final progress update
    if (progressCallback) {
      progressCallback({
        completed: categoryIds.length,
        total: categoryIds.length,
        currentItem: 'completed'
      })
    }

    return results
  }
}

// =============================================================================
// CATEGORY EVENTS AND WEBHOOKS
// =============================================================================

export interface CategoryEvent {
  type: 'moved' | 'deleted' | 'created' | 'updated'
  tenantId: string
  categoryId: string
  userId?: string
  timestamp: Date
  metadata: any
}

@Injectable()
export class CategoryEventService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Subscribe to category events for real-time updates
   */
  onCategoryEvent(callback: (event: CategoryEvent) => void): void {
    this.eventEmitter.on('category.*', (data) => {
      const event: CategoryEvent = {
        type: data.type,
        tenantId: data.tenantId,
        categoryId: data.categoryId,
        userId: data.userId,
        timestamp: new Date(),
        metadata: data
      }
      callback(event)
    })
  }

  /**
   * Emit category event for real-time updates
   */
  emitCategoryEvent(type: CategoryEvent['type'], data: any): void {
    this.eventEmitter.emit(`category.${type}`, { ...data, type })
  }
}

// =============================================================================
// CONTROLLER IMPLEMENTATION
// =============================================================================

import { Controller, Post, Delete, Get, Body, Param, Query, UseGuards } from '@nestjs/common'
import { TenantGuard } from '../guards/tenant.guard'
import { CurrentTenant } from '../decorators/current-tenant.decorator'
import { CurrentUser } from '../decorators/current-user.decorator'

@Controller('api/v1/categories')
@UseGuards(TenantGuard)
export class CategoryManagementController {
  constructor(
    private readonly categoryService: CategoryManagementService,
    private readonly eventService: CategoryEventService
  ) {}

  @Post(':categoryId/move')
  async moveCategory(
    @Param('categoryId') categoryId: string,
    @Body() body: { newParentId?: string; reason?: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string
  ) {
    return await this.categoryService.moveCategorySubtree(
      tenantId,
      categoryId,
      body.newParentId,
      userId,
      body.reason
    )
  }

  @Post('batch/move')
  async batchMoveCategories(
    @Body() body: { moves: CategoryMoveRequest[] },
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string
  ) {
    return await this.categoryService.batchReorganizeCategories(
      tenantId,
      body.moves,
      userId
    )
  }

  @Get(':categoryId/deletion-impact')
  async getDeletionImpact(@Param('categoryId') categoryId: string) {
    return await this.categoryService.analyzeCategoryDeletionImpact(categoryId)
  }

  @Delete(':categoryId')
  async deleteCategory(
    @Param('categoryId') categoryId: string,
    @Body() options: CategoryDeletionOptions,
    @CurrentTenant() tenantId: string,
    @CurrentUser() userId: string
  ) {
    return await this.categoryService.deleteCategoryWithDependencies(
      tenantId,
      categoryId,
      options,
      userId
    )
  }

  @Get('tree/paginated')
  async getCategoryTree(
    @Query('type') categoryType: string,
    @Query('parentId') parentId?: string,
    @Query('maxDepth') maxDepth?: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @CurrentTenant() tenantId: string
  ) {
    return await this.categoryService.getCategoryTreePaginated(
      tenantId,
      categoryType,
      parentId,
      { maxDepth: Number(maxDepth) || 3, limit: Number(limit) || 100, offset: Number(offset) || 0 }
    )
  }

  @Get('search')
  async searchCategories(
    @Query('type') categoryType: string,
    @Query('q') searchTerm: string,
    @Query('limit') limit?: number,
    @CurrentTenant() tenantId: string
  ) {
    return await this.categoryService.searchCategoriesByPath(
      tenantId,
      categoryType,
      searchTerm,
      Number(limit) || 20
    )
  }

  @Get('performance')
  async getPerformanceMetrics() {
    return await this.categoryService.getCategoryPerformanceMetrics()
  }

  @Post('maintenance')
  async runMaintenance() {
    return await this.categoryService.maintainCategorySystem()
  }
}