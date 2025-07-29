-- =============================================================================
-- Labor Rate Management System
-- =============================================================================
-- Comprehensive labor rate tracking with historical accuracy

-- =============================================================================
-- NOTE: Table definitions have been moved to Prisma Schema.md
-- This file now contains only the database functions and business logic
-- =============================================================================

-- =============================================================================
-- ADVANCED COST CALCULATION FUNCTIONS
-- =============================================================================

-- Function to get current applicable labor rate
CREATE OR REPLACE FUNCTION get_applicable_labor_rate(
  p_tenant_id UUID,
  p_user_id UUID DEFAULT NULL,
  p_product_category_id UUID DEFAULT NULL,
  p_calculation_date DATE DEFAULT CURRENT_DATE,
  p_rush_order BOOLEAN DEFAULT false
) RETURNS TABLE (
  config_id UUID,
  base_rate DECIMAL(8,2),
  total_multiplier DECIMAL(4,2),
  effective_hourly_rate DECIMAL(8,2),
  rate_breakdown JSONB
) AS $$
DECLARE
  rate_config RECORD;
  total_mult DECIMAL(4,2) := 1.0;
  breakdown JSONB := '{}';
BEGIN
  -- Find the most specific applicable rate
  SELECT lrc.* INTO rate_config
  FROM labor_rate_configs lrc
  WHERE lrc.tenant_id = p_tenant_id
    AND lrc.is_active = true
    AND lrc.deleted_at IS NULL
    AND p_calculation_date >= lrc.effective_date
    AND (lrc.expiry_date IS NULL OR p_calculation_date <= lrc.expiry_date)
    AND (
      -- User-specific rate (highest priority)
      (lrc.user_id = p_user_id) OR
      -- Category-specific rate
      (lrc.user_id IS NULL AND lrc.product_category_id = p_product_category_id) OR
      -- Tenant default rate (lowest priority)
      (lrc.user_id IS NULL AND lrc.product_category_id IS NULL AND lrc.is_default = true)
    )
  ORDER BY 
    CASE WHEN lrc.user_id IS NOT NULL THEN 1 ELSE 2 END, -- User-specific first
    CASE WHEN lrc.product_category_id IS NOT NULL THEN 1 ELSE 2 END, -- Category-specific next
    lrc.effective_date DESC -- Most recent first
  LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No applicable labor rate found for tenant % on date %', p_tenant_id, p_calculation_date;
  END IF;
  
  -- Apply multipliers
  total_mult := rate_config.difficulty_multiplier * rate_config.complexity_multiplier;
  breakdown := jsonb_build_object(
    'base_rate', rate_config.base_hourly_rate,
    'difficulty_multiplier', rate_config.difficulty_multiplier,
    'complexity_multiplier', rate_config.complexity_multiplier
  );
  
  -- Apply rush multiplier if needed
  IF p_rush_order THEN
    total_mult := total_mult * rate_config.rush_multiplier;
    breakdown := breakdown || jsonb_build_object('rush_multiplier', rate_config.rush_multiplier);
  END IF;
  
  RETURN QUERY SELECT 
    rate_config.id,
    rate_config.base_hourly_rate,
    total_mult,
    ROUND(rate_config.base_hourly_rate * total_mult, 2),
    breakdown;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to calculate and store labor cost with full audit trail
CREATE OR REPLACE FUNCTION calculate_labor_cost_with_history(
  p_product_id UUID,
  p_user_id UUID,
  p_estimated_hours DECIMAL(6,2),
  p_actual_hours DECIMAL(6,2) DEFAULT NULL,
  p_rush_order BOOLEAN DEFAULT false,
  p_calculation_context JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  product_rec RECORD;
  rate_info RECORD;
  calculated_cost DECIMAL(10,2);
  calc_start_time TIMESTAMP;
  calc_end_time TIMESTAMP;
  new_calc_id UUID;
  requires_approval_flag BOOLEAN := false;
BEGIN
  calc_start_time := clock_timestamp();
  
  -- Get product information
  SELECT p.*, c.id as category_id INTO product_rec
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;
  
  -- Get applicable rate
  SELECT * INTO rate_info
  FROM get_applicable_labor_rate(
    product_rec.tenant_id,
    p_user_id,
    product_rec.category_id,
    CURRENT_DATE,
    p_rush_order
  );
  
  -- Calculate cost
  calculated_cost := ROUND(
    COALESCE(p_actual_hours, p_estimated_hours) * rate_info.effective_hourly_rate, 
    2
  );
  
  -- Check if approval required (e.g., cost > $500 or rush orders)
  requires_approval_flag := calculated_cost > 500 OR p_rush_order;
  
  calc_end_time := clock_timestamp();
  
  -- Supersede previous current calculation
  UPDATE labor_cost_calculations 
  SET is_current = false,
      superseded_by = gen_random_uuid() -- Will be updated below
  WHERE product_id = p_product_id AND is_current = true;
  
  -- Insert new calculation
  INSERT INTO labor_cost_calculations (
    tenant_id, product_id, labor_rate_config_id,
    base_hourly_rate, effective_multipliers,
    estimated_hours, actual_hours, calculated_labor_cost,
    calculation_method, calculation_context,
    calculated_by, requires_approval,
    calculation_duration_ms
  ) VALUES (
    product_rec.tenant_id, p_product_id, rate_info.config_id,
    rate_info.base_rate, rate_info.rate_breakdown,
    p_estimated_hours, p_actual_hours, calculated_cost,
    'time_based', p_calculation_context,
    p_user_id, requires_approval_flag,
    EXTRACT(EPOCH FROM (calc_end_time - calc_start_time)) * 1000
  ) RETURNING id INTO new_calc_id;
  
  -- Update the superseded_by reference
  UPDATE labor_cost_calculations 
  SET superseded_by = new_calc_id
  WHERE product_id = p_product_id AND superseded_by IS NOT NULL AND id != new_calc_id;
  
  -- Update usage statistics
  UPDATE labor_rate_configs 
  SET times_used = times_used + 1,
      last_used_at = NOW()
  WHERE id = rate_info.config_id;
  
  -- Update product with new labor cost (if approved or doesn't require approval)
  IF NOT requires_approval_flag THEN
    UPDATE products 
    SET labor_cost = calculated_cost,
        last_cost_calculation_at = NOW(),
        cost_calculation_version = cost_calculation_version + 1
    WHERE id = p_product_id;
  END IF;
  
  RETURN new_calc_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get labor cost history for a product
CREATE OR REPLACE FUNCTION get_labor_cost_history(
  p_product_id UUID,
  p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
  calculation_id UUID,
  calculated_at TIMESTAMP,
  base_rate DECIMAL(8,2),
  effective_rate DECIMAL(8,2),
  hours_used DECIMAL(6,2),
  total_cost DECIMAL(10,2),
  method VARCHAR(50),
  calculated_by_name VARCHAR(200),
  is_current BOOLEAN,
  requires_approval BOOLEAN,
  approved_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lcc.id,
    lcc.calculated_at,
    lcc.base_hourly_rate,
    (lcc.calculated_labor_cost / NULLIF(COALESCE(lcc.actual_hours, lcc.estimated_hours), 0)),
    COALESCE(lcc.actual_hours, lcc.estimated_hours),
    lcc.calculated_labor_cost,
    lcc.calculation_method,
    COALESCE(u.display_name, u.first_name || ' ' || u.last_name, u.email),
    lcc.is_current,
    lcc.requires_approval,
    lcc.approved_at
  FROM labor_cost_calculations lcc
  LEFT JOIN users u ON lcc.calculated_by = u.id
  WHERE lcc.product_id = p_product_id
  ORDER BY lcc.calculated_at DESC, lcc.version DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;