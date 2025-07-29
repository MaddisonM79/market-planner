-- =============================================================================
-- Category System - Advanced Operations & Performance Solutions
-- =============================================================================
-- Handling complex category operations: migration, deletion, and performance

-- =============================================================================
-- 1. CATEGORY HIERARCHY MIGRATION & REORGANIZATION
-- =============================================================================

-- Function to move a category and all its children to a new parent
CREATE OR REPLACE FUNCTION move_category_subtree(
  p_category_id UUID,
  p_new_parent_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  categories_moved INTEGER,
  products_affected INTEGER,
  materials_affected INTEGER
) AS $$
DECLARE
  old_path TEXT;
  new_path TEXT;
  old_level INTEGER;
  new_level INTEGER;
  categories_count INTEGER := 0;
  products_count INTEGER := 0;
  materials_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- Validate: prevent circular dependencies
  IF p_new_parent_id IS NOT NULL THEN
    -- Check if new parent is a descendant of the category being moved
    IF EXISTS (
      SELECT 1 FROM categories 
      WHERE id = p_new_parent_id 
        AND path LIKE (SELECT path || '%' FROM categories WHERE id = p_category_id)
    ) THEN
      RAISE EXCEPTION 'Cannot move category to its own descendant (circular dependency)';
    END IF;
  END IF;

  -- Get current category info
  SELECT path, level INTO old_path, old_level
  FROM categories WHERE id = p_category_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found: %', p_category_id;
  END IF;

  -- Calculate new path and level
  IF p_new_parent_id IS NULL THEN
    new_path := '/' || (SELECT name FROM categories WHERE id = p_category_id);
    new_level := 0;
  ELSE
    SELECT 
      path || '/' || (SELECT name FROM categories WHERE id = p_category_id),
      level + 1
    INTO new_path, new_level
    FROM categories 
    WHERE id = p_new_parent_id;
  END IF;

  -- Create audit record for the move operation
  INSERT INTO audit_logs (
    tenant_id, table_name, record_id, operation, 
    old_values, new_values, user_id, business_reason
  ) VALUES (
    (SELECT tenant_id FROM categories WHERE id = p_category_id),
    'categories',
    p_category_id,
    'MOVE',
    jsonb_build_object('old_parent_id', (SELECT parent_id FROM categories WHERE id = p_category_id), 'old_path', old_path),
    jsonb_build_object('new_parent_id', p_new_parent_id, 'new_path', new_path),
    p_user_id,
    'Category hierarchy reorganization'
  );

  -- Update the category being moved
  UPDATE categories SET
    parent_id = p_new_parent_id,
    path = new_path,
    level = new_level,
    updated_at = NOW(),
    updated_by = p_user_id
  WHERE id = p_category_id;

  categories_count := categories_count + 1;

  -- Update all descendant categories
  FOR rec IN 
    SELECT id, path, level, name
    FROM categories 
    WHERE path LIKE old_path || '/%'
    ORDER BY level, path
  LOOP
    -- Calculate new path for descendant
    UPDATE categories SET
      path = new_path || SUBSTRING(rec.path FROM LENGTH(old_path) + 1),
      level = new_level + (rec.level - old_level),
      updated_at = NOW(),
      updated_by = p_user_id
    WHERE id = rec.id;
    
    categories_count := categories_count + 1;
  END LOOP;

  -- Count affected products and materials
  SELECT COUNT(*) INTO products_count
  FROM products p
  WHERE p.category_id = p_category_id 
     OR p.subcategory_id = p_category_id
     OR p.category_id IN (
       SELECT id FROM categories WHERE path LIKE old_path || '/%'
     );

  SELECT COUNT(*) INTO materials_count
  FROM materials m
  WHERE m.category_id = p_category_id 
     OR m.subcategory_id = p_category_id
     OR m.category_id IN (
       SELECT id FROM categories WHERE path LIKE old_path || '/%'
     );

  -- Return results
  RETURN QUERY SELECT categories_count, products_count, materials_count;
END;
$$ LANGUAGE plpgsql;

-- Function to batch reorganize multiple categories
CREATE OR REPLACE FUNCTION batch_reorganize_categories(
  p_moves JSONB, -- Array of {category_id, new_parent_id}
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  category_id UUID,
  status TEXT,
  error_message TEXT,
  categories_moved INTEGER,
  products_affected INTEGER,
  materials_affected INTEGER
) AS $$
DECLARE
  move_item JSONB;
  result_record RECORD;
BEGIN
  -- Process each move operation
  FOR move_item IN SELECT * FROM jsonb_array_elements(p_moves)
  LOOP
    BEGIN
      -- Attempt the move
      SELECT * INTO result_record
      FROM move_category_subtree(
        (move_item->>'category_id')::UUID,
        CASE WHEN move_item->>'new_parent_id' = 'null' THEN NULL 
             ELSE (move_item->>'new_parent_id')::UUID END,
        p_user_id
      );
      
      -- Return success result
      RETURN QUERY SELECT 
        (move_item->>'category_id')::UUID,
        'success'::TEXT,
        NULL::TEXT,
        result_record.categories_moved,
        result_record.products_affected,
        result_record.materials_affected;
        
    EXCEPTION WHEN OTHERS THEN
      -- Return error result
      RETURN QUERY SELECT 
        (move_item->>'category_id')::UUID,
        'error'::TEXT,
        SQLERRM::TEXT,
        0::INTEGER,
        0::INTEGER,
        0::INTEGER;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 2. CATEGORY DELETION WITH DEPENDENCY MANAGEMENT
-- =============================================================================

-- Function to analyze category deletion impact
CREATE OR REPLACE FUNCTION analyze_category_deletion_impact(
  p_category_id UUID
) RETURNS TABLE (
  category_name VARCHAR(100),
  direct_products INTEGER,
  direct_materials INTEGER,
  child_categories INTEGER,
  total_affected_products INTEGER,
  total_affected_materials INTEGER,
  can_delete_safely BOOLEAN,
  suggested_action TEXT
) AS $$
DECLARE
  cat_name VARCHAR(100);
  direct_prod INTEGER := 0;
  direct_mat INTEGER := 0;
  child_cats INTEGER := 0;
  total_prod INTEGER := 0;
  total_mat INTEGER := 0;
  safe_delete BOOLEAN := false;
  suggestion TEXT;
BEGIN
  -- Get category name
  SELECT name INTO cat_name FROM categories WHERE id = p_category_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Category not found: %', p_category_id;
  END IF;

  -- Count direct usage
  SELECT COUNT(*) INTO direct_prod
  FROM products 
  WHERE (category_id = p_category_id OR subcategory_id = p_category_id)
    AND deleted_at IS NULL;

  SELECT COUNT(*) INTO direct_mat
  FROM materials 
  WHERE (category_id = p_category_id OR subcategory_id = p_category_id 
         OR yarn_weight_id = p_category_id OR fiber_type_id = p_category_id)
    AND deleted_at IS NULL;

  -- Count child categories
  SELECT COUNT(*) INTO child_cats
  FROM categories 
  WHERE parent_id = p_category_id AND is_active = true;

  -- Count total affected (including descendants)
  WITH category_tree AS (
    SELECT id FROM categories WHERE id = p_category_id
    UNION ALL
    SELECT c.id 
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
    WHERE c.is_active = true
  )
  SELECT 
    COUNT(DISTINCT p.id),
    COUNT(DISTINCT m.id)
  INTO total_prod, total_mat
  FROM category_tree ct
  LEFT JOIN products p ON (p.category_id = ct.id OR p.subcategory_id = ct.id) 
    AND p.deleted_at IS NULL
  LEFT JOIN materials m ON (m.category_id = ct.id OR m.subcategory_id = ct.id 
    OR m.yarn_weight_id = ct.id OR m.fiber_type_id = ct.id) 
    AND m.deleted_at IS NULL;

  -- Determine if deletion is safe and suggest action
  IF total_prod = 0 AND total_mat = 0 AND child_cats = 0 THEN
    safe_delete := true;
    suggestion := 'Safe to delete - no dependencies';
  ELSIF child_cats > 0 THEN
    safe_delete := false;
    suggestion := format('Cannot delete - has %s child categories. Move or delete children first.', child_cats);
  ELSIF total_prod > 0 OR total_mat > 0 THEN
    safe_delete := false;
    suggestion := format('Cannot delete - used by %s products and %s materials. Reassign or archive instead.', total_prod, total_mat);
  ELSE
    safe_delete := true;
    suggestion := 'Safe to delete';
  END IF;

  RETURN QUERY SELECT 
    cat_name,
    direct_prod,
    direct_mat,
    child_cats,
    total_prod,
    total_mat,
    safe_delete,
    suggestion;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to safely delete category with user choice
CREATE OR REPLACE FUNCTION delete_category_with_dependencies(
  p_category_id UUID,
  p_deletion_strategy VARCHAR(50), -- 'abort', 'reassign', 'archive_items', 'force_delete'
  p_reassign_to_category_id UUID DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
) RETURNS TABLE (
  status TEXT,
  message TEXT,
  products_reassigned INTEGER,
  materials_reassigned INTEGER,
  categories_deleted INTEGER
) AS $$
DECLARE
  impact_result RECORD;
  products_affected INTEGER := 0;
  materials_affected INTEGER := 0;
  categories_deleted_count INTEGER := 0;
BEGIN
  -- Analyze impact first
  SELECT * INTO impact_result
  FROM analyze_category_deletion_impact(p_category_id);

  -- Handle based on strategy
  CASE p_deletion_strategy
    WHEN 'abort' THEN
      IF NOT impact_result.can_delete_safely THEN
        RETURN QUERY SELECT 
          'aborted'::TEXT,
          impact_result.suggested_action,
          0::INTEGER, 0::INTEGER, 0::INTEGER;
        RETURN;
      END IF;

    WHEN 'reassign' THEN
      IF p_reassign_to_category_id IS NULL THEN
        RETURN QUERY SELECT 
          'error'::TEXT,
          'Reassignment target category required'::TEXT,
          0::INTEGER, 0::INTEGER, 0::INTEGER;
        RETURN;
      END IF;

      -- Reassign products
      UPDATE products SET 
        category_id = CASE WHEN category_id = p_category_id THEN p_reassign_to_category_id ELSE category_id END,
        subcategory_id = CASE WHEN subcategory_id = p_category_id THEN NULL ELSE subcategory_id END,
        updated_by = p_user_id,
        updated_at = NOW()
      WHERE (category_id = p_category_id OR subcategory_id = p_category_id)
        AND deleted_at IS NULL;
      
      GET DIAGNOSTICS products_affected = ROW_COUNT;

      -- Reassign materials
      UPDATE materials SET 
        category_id = CASE WHEN category_id = p_category_id THEN p_reassign_to_category_id ELSE category_id END,
        subcategory_id = CASE WHEN subcategory_id = p_category_id THEN NULL ELSE subcategory_id END,
        yarn_weight_id = CASE WHEN yarn_weight_id = p_category_id THEN NULL ELSE yarn_weight_id END,
        fiber_type_id = CASE WHEN fiber_type_id = p_category_id THEN NULL ELSE fiber_type_id END,
        updated_by = p_user_id,
        updated_at = NOW()
      WHERE (category_id = p_category_id OR subcategory_id = p_category_id 
             OR yarn_weight_id = p_category_id OR fiber_type_id = p_category_id)
        AND deleted_at IS NULL;
      
      GET DIAGNOSTICS materials_affected = ROW_COUNT;

    WHEN 'archive_items' THEN
      -- Soft delete products and materials using this category
      UPDATE products SET 
        deleted_at = NOW(),
        deleted_by = p_user_id
      WHERE (category_id = p_category_id OR subcategory_id = p_category_id)
        AND deleted_at IS NULL;
      
      GET DIAGNOSTICS products_affected = ROW_COUNT;

      UPDATE materials SET 
        deleted_at = NOW(),
        deleted_by = p_user_id
      WHERE (category_id = p_category_id OR subcategory_id = p_category_id 
             OR yarn_weight_id = p_category_id OR fiber_type_id = p_category_id)
        AND deleted_at IS NULL;
      
      GET DIAGNOSTICS materials_affected = ROW_COUNT;

    WHEN 'force_delete' THEN
      -- This is dangerous - only for system cleanup
      -- Force reassign to a default "uncategorized" category
      -- Implementation would depend on business rules
      NULL;

    ELSE
      RETURN QUERY SELECT 
        'error'::TEXT,
        'Invalid deletion strategy'::TEXT,
        0::INTEGER, 0::INTEGER, 0::INTEGER;
      RETURN;
  END CASE;

  -- Now safe to delete the category
  UPDATE categories SET 
    is_active = false,
    deleted_at = NOW(),
    deleted_by = p_user_id
  WHERE id = p_category_id;

  categories_deleted_count := 1;

  -- Audit the deletion
  INSERT INTO audit_logs (
    tenant_id, table_name, record_id, operation, 
    old_values, user_id, business_reason
  ) VALUES (
    (SELECT tenant_id FROM categories WHERE id = p_category_id),
    'categories',
    p_category_id,
    'DELETE',
    jsonb_build_object(
      'deletion_strategy', p_deletion_strategy,
      'products_affected', products_affected,
      'materials_affected', materials_affected
    ),
    p_user_id,
    format('Category deletion with %s strategy', p_deletion_strategy)
  );

  RETURN QUERY SELECT 
    'success'::TEXT,
    format('Category deleted successfully. %s products and %s materials affected.', 
           products_affected, materials_affected),
    products_affected,
    materials_affected,
    categories_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 3. PERFORMANCE OPTIMIZATION FOR DEEP HIERARCHIES
-- =============================================================================

-- Materialized view for category paths (performance optimization)
CREATE MATERIALIZED VIEW category_paths_mv AS
WITH RECURSIVE category_path AS (
  -- Base case: root categories
  SELECT 
    id,
    tenant_id,
    category_type_id,
    name,
    parent_id,
    level,
    ARRAY[id] as path_ids,
    ARRAY[name] as path_names,
    name as full_path,
    usage_count,
    is_active
  FROM categories 
  WHERE parent_id IS NULL AND is_active = true

  UNION ALL

  -- Recursive case: child categories
  SELECT 
    c.id,
    c.tenant_id,
    c.category_type_id,
    c.name,
    c.parent_id,
    c.level,
    cp.path_ids || c.id,
    cp.path_names || c.name,
    cp.full_path || ' > ' || c.name,
    c.usage_count,
    c.is_active
  FROM categories c
  JOIN category_path cp ON c.parent_id = cp.id
  WHERE c.is_active = true AND array_length(cp.path_ids, 1) < 10 -- Prevent infinite recursion
)
SELECT 
  id,
  tenant_id,
  category_type_id,
  name,
  parent_id,
  level,
  path_ids,
  path_names,
  full_path,
  usage_count,
  array_length(path_ids, 1) as depth
FROM category_path;

-- Unique index for materialized view
CREATE UNIQUE INDEX idx_category_paths_mv_id ON category_paths_mv(id);
CREATE INDEX idx_category_paths_mv_tenant_type ON category_paths_mv(tenant_id, category_type_id);
CREATE INDEX idx_category_paths_mv_depth ON category_paths_mv(depth, usage_count DESC);

-- Function to refresh category paths (called after hierarchy changes)
CREATE OR REPLACE FUNCTION refresh_category_paths() RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY category_paths_mv;
END;
$$ LANGUAGE plpgsql;

-- Optimized function to get category tree with pagination
CREATE OR REPLACE FUNCTION get_category_tree_paginated(
  p_tenant_id UUID,
  p_category_type_name VARCHAR(100),
  p_parent_id UUID DEFAULT NULL,
  p_max_depth INTEGER DEFAULT 3,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  parent_id UUID,
  level INTEGER,
  full_path TEXT,
  usage_count INTEGER,
  children_count BIGINT,
  has_more_children BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.name,
    cp.parent_id,
    cp.level,
    cp.full_path,
    cp.usage_count,
    COALESCE(child_counts.children_count, 0) as children_count,
    CASE WHEN COALESCE(child_counts.children_count, 0) > 0 
         AND cp.level < p_max_depth THEN true ELSE false END as has_more_children
  FROM category_paths_mv cp
  JOIN category_types ct ON cp.category_type_id = ct.id
  LEFT JOIN (
    SELECT 
      parent_id,
      COUNT(*) as children_count
    FROM category_paths_mv
    WHERE tenant_id = p_tenant_id OR tenant_id IS NULL
    GROUP BY parent_id
  ) child_counts ON cp.id = child_counts.parent_id
  WHERE ct.name = p_category_type_name
    AND (cp.tenant_id = p_tenant_id OR cp.tenant_id IS NULL)
    AND (p_parent_id IS NULL AND cp.parent_id IS NULL 
         OR cp.parent_id = p_parent_id)
    AND cp.level <= p_max_depth
  ORDER BY cp.usage_count DESC, cp.name
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to find categories by path search (optimized for deep hierarchies)
CREATE OR REPLACE FUNCTION search_categories_by_path(
  p_tenant_id UUID,
  p_category_type_name VARCHAR(100),
  p_search_term TEXT,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
  full_path TEXT,
  usage_count INTEGER,
  relevance_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.name,
    cp.full_path,
    cp.usage_count,
    -- Calculate relevance score
    (
      CASE WHEN cp.name ILIKE p_search_term || '%' THEN 100.0
           WHEN cp.name ILIKE '%' || p_search_term || '%' THEN 80.0
           WHEN cp.full_path ILIKE '%' || p_search_term || '%' THEN 60.0
           ELSE 40.0
      END +
      -- Boost score based on usage
      (LEAST(cp.usage_count, 100) * 0.1)
    ) as relevance_score
  FROM category_paths_mv cp
  JOIN category_types ct ON cp.category_type_id = ct.id
  WHERE ct.name = p_category_type_name
    AND (cp.tenant_id = p_tenant_id OR cp.tenant_id IS NULL)
    AND (
      cp.name ILIKE '%' || p_search_term || '%' OR
      cp.full_path ILIKE '%' || p_search_term || '%'
    )
  ORDER BY relevance_score DESC, cp.usage_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Performance monitoring for category operations
CREATE OR REPLACE FUNCTION monitor_category_performance() RETURNS TABLE (
  operation_type TEXT,
  avg_duration_ms NUMERIC,
  total_calls BIGINT,
  slowest_query TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    CASE 
      WHEN query ILIKE '%get_category_hierarchy%' THEN 'hierarchy_queries'
      WHEN query ILIKE '%move_category_subtree%' THEN 'category_moves'
      WHEN query ILIKE '%delete_category%' THEN 'category_deletions'
      WHEN query ILIKE '%category_paths_mv%' THEN 'path_materialized_view'
      ELSE 'other_category_ops'
    END as operation_type,
    ROUND(AVG(mean_exec_time)::NUMERIC, 2) as avg_duration_ms,
    SUM(calls) as total_calls,
    (array_agg(query ORDER BY mean_exec_time DESC))[1] as slowest_query
  FROM pg_stat_statements
  WHERE query ILIKE '%categor%'
    AND calls > 0
  GROUP BY operation_type
  ORDER BY avg_duration_ms DESC;
END;
$$ LANGUAGE plpgsql;

-- Automated category maintenance
CREATE OR REPLACE FUNCTION maintain_category_system() RETURNS TABLE (
  task_name TEXT,
  status TEXT,
  details TEXT
) AS $$
DECLARE
  orphaned_count INTEGER;
  deep_hierarchy_count INTEGER;
BEGIN
  -- Task 1: Clean up orphaned categories
  DELETE FROM categories 
  WHERE tenant_id IS NOT NULL 
    AND tenant_id NOT IN (SELECT id FROM tenants WHERE deleted_at IS NULL);
  
  GET DIAGNOSTICS orphaned_count = ROW_COUNT;
  
  RETURN QUERY SELECT 
    'cleanup_orphaned_categories'::TEXT,
    'completed'::TEXT,
    format('Removed %s orphaned categories', orphaned_count);

  -- Task 2: Refresh materialized views
  PERFORM refresh_category_paths();
  
  RETURN QUERY SELECT 
    'refresh_category_paths'::TEXT,
    'completed'::TEXT,
    'Category paths materialized view refreshed';

  -- Task 3: Check for performance issues
  SELECT COUNT(*) INTO deep_hierarchy_count
  FROM category_paths_mv 
  WHERE depth > 5;
  
  IF deep_hierarchy_count > 0 THEN
    RETURN QUERY SELECT 
      'deep_hierarchy_warning'::TEXT,
      'warning'::TEXT,
      format('Found %s categories with depth > 5 levels', deep_hierarchy_count);
  END IF;

  -- Task 4: Update usage statistics
  ANALYZE categories;
  
  RETURN QUERY SELECT 
    'update_statistics'::TEXT,
    'completed'::TEXT,
    'Category table statistics updated';
END;
$$ LANGUAGE plpgsql;