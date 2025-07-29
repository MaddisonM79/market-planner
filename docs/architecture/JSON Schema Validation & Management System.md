-- =============================================================================
-- JSON Schema Validation & Management System
-- =============================================================================
-- Type-safe JSON columns with evolution tracking

-- =============================================================================
-- NOTE: Table definitions have been moved to Prisma Schema.md
-- This file now contains only the database functions and validation logic
-- =============================================================================

-- =============================================================================
-- PREDEFINED SCHEMAS FOR YARN CRAFTING SYSTEM
-- =============================================================================

-- User preferences schema
INSERT INTO json_schemas (schema_name, version, table_name, column_name, schema_definition, description) VALUES
('user_preferences', 1, 'users', 'ui_preferences', '{
  "type": "object",
  "properties": {
    "theme": {
      "type": "string",
      "enum": ["default", "cozy", "fresh", "artisan", "accessible"],
      "default": "default"
    },
    "currency_display": {
      "type": "string", 
      "enum": ["symbol", "code", "name"],
      "default": "symbol"
    },
    "number_format": {
      "type": "object",
      "properties": {
        "decimal_places": {"type": "integer", "minimum": 0, "maximum": 4, "default": 2},
        "thousands_separator": {"type": "string", "enum": [",", ".", " ", ""], "default": ","},
        "decimal_separator": {"type": "string", "enum": [".", ","], "default": "."}
      },
      "required": ["decimal_places"],
      "additionalProperties": false
    },
    "table_settings": {
      "type": "object",
      "properties": {
        "page_size": {"type": "integer", "minimum": 10, "maximum": 500, "default": 50},
        "default_sort": {"type": "string", "default": "name"},
        "show_images": {"type": "boolean", "default": true},
        "compact_view": {"type": "boolean", "default": false}
      },
      "additionalProperties": false
    },
    "notifications": {
      "type": "object",
      "properties": {
        "low_inventory": {"type": "boolean", "default": true},
        "cost_changes": {"type": "boolean", "default": true},
        "market_reminders": {"type": "boolean", "default": true},
        "export_completion": {"type": "boolean", "default": true}
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}', 'User interface and display preferences');

-- Material properties schema
INSERT INTO json_schemas (schema_name, version, table_name, column_name, schema_definition, description) VALUES
('material_properties', 1, 'materials', 'properties', '{
  "type": "object",
  "properties": {
    "yarn_specific": {
      "type": "object",
      "properties": {
        "yards_per_gram": {"type": "number", "minimum": 0},
        "recommended_hook_size": {"type": "string", "pattern": "^[A-Z]|\\d+(\\.\\d+)?mm$"},
        "gauge": {"type": "string"},
        "texture": {"type": "string", "enum": ["smooth", "fuzzy", "bouclé", "chenille", "metallic"]},
        "washability": {"type": "string", "enum": ["hand_wash", "machine_wash", "dry_clean", "not_washable"]},
        "dye_lot": {"type": "string", "maxLength": 50}
      },
      "additionalProperties": false
    },
    "component_specific": {
      "type": "object", 
      "properties": {
        "safety_rating": {"type": "string", "enum": ["child_safe", "adult_only", "decorative_only"]},
        "attachment_method": {"type": "string", "enum": ["sewn", "glued", "inserted", "snap", "magnetic"]},
        "size_mm": {"type": "number", "minimum": 0},
        "quantity_per_package": {"type": "integer", "minimum": 1}
      },
      "additionalProperties": false
    },
    "storage": {
      "type": "object",
      "properties": {
        "temperature_sensitive": {"type": "boolean", "default": false},
        "light_sensitive": {"type": "boolean", "default": false},
        "humidity_sensitive": {"type": "boolean", "default": false},
        "storage_location": {"type": "string", "maxLength": 100}
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": true
}', 'Extended properties for materials including yarn and component specifics');

-- Product customization options schema  
INSERT INTO json_schemas (schema_name, version, table_name, column_name, schema_definition, description) VALUES
('product_customization', 1, 'products', 'customization_options', '{
  "type": "object",
  "properties": {
    "color_variations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string", "minLength": 1, "maxLength": 50},
          "hex_code": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
          "material_substitutions": {
            "type": "array",
            "items": {
              "type": "object", 
              "properties": {
                "original_material_id": {"type": "string", "format": "uuid"},
                "substitute_material_id": {"type": "string", "format": "uuid"},
                "cost_difference": {"type": "number"}
              },
              "required": ["original_material_id", "substitute_material_id"]
            }
          }
        },
        "required": ["name", "hex_code"]
      }
    },
    "size_variations": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string", "minLength": 1, "maxLength": 50},
          "dimensions": {"type": "string", "maxLength": 100},
          "scale_factor": {"type": "number", "minimum": 0.1, "maximum": 5.0},
          "material_multiplier": {"type": "number", "minimum": 0.1, "maximum": 10.0},
          "time_multiplier": {"type": "number", "minimum": 0.1, "maximum": 10.0}
        },
        "required": ["name", "scale_factor"]
      }
    },
    "feature_options": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "feature_name": {"type": "string", "minLength": 1, "maxLength": 100},
          "options": {
            "type": "array",
            "items": {"type": "string", "minLength": 1, "maxLength": 100}
          },
          "cost_modifier": {"type": "number", "default": 0},
          "time_modifier": {"type": "number", "default": 0}
        },
        "required": ["feature_name", "options"]
      }
    }
  },
  "additionalProperties": false
}', 'Product customization and variation options');

-- =============================================================================
-- JSON VALIDATION FUNCTIONS
-- =============================================================================

-- Function to validate JSON against schema
CREATE OR REPLACE FUNCTION validate_json_with_schema(
  p_table_name VARCHAR(100),
  p_column_name VARCHAR(100), 
  p_json_data JSONB,
  p_record_id UUID DEFAULT NULL
) RETURNS TABLE (
  is_valid BOOLEAN,
  validation_errors JSONB,
  validation_warnings JSONB,
  schema_version INTEGER
) AS $$
DECLARE
  schema_rec RECORD;
  validation_result RECORD;
  errors JSONB := '[]';
  warnings JSONB := '[]';
  is_valid_result BOOLEAN := true;
BEGIN
  -- Get active schema for table/column
  SELECT * INTO schema_rec
  FROM json_schemas
  WHERE table_name = p_table_name 
    AND column_name = p_column_name
    AND status = 'active'
  ORDER BY version DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No schema defined - allow anything but warn
    warnings := warnings || jsonb_build_object(
      'code', 'NO_SCHEMA',
      'message', 'No schema defined for ' || p_table_name || '.' || p_column_name
    );
    
    RETURN QUERY SELECT true, '[]'::JSONB, warnings, 0;
    RETURN;
  END IF;
  
  -- Perform basic JSON Schema validation
  SELECT * INTO validation_result
  FROM validate_json_schema_basic(p_json_data, schema_rec.schema_definition);
  
  is_valid_result := validation_result.is_valid;
  errors := validation_result.errors;
  warnings := validation_result.warnings;
  
  -- Log validation result if record_id provided
  IF p_record_id IS NOT NULL THEN
    INSERT INTO json_schema_usage (
      schema_id, table_name, record_id,
      validation_status, validation_errors, validation_warnings
    ) VALUES (
      schema_rec.id, p_table_name, p_record_id,
      CASE WHEN is_valid_result THEN 'valid' ELSE 'invalid' END,
      errors, warnings
    );
  END IF;
  
  RETURN QUERY SELECT is_valid_result, errors, warnings, schema_rec.version;
END;
$$ LANGUAGE plpgsql;

-- Basic JSON Schema validation function
CREATE OR REPLACE FUNCTION validate_json_schema_basic(
  p_data JSONB,
  p_schema JSONB
) RETURNS TABLE (
  is_valid BOOLEAN,
  errors JSONB,
  warnings JSONB
) AS $$
DECLARE
  errors_array JSONB := '[]';
  warnings_array JSONB := '[]';
  schema_type TEXT;
  schema_properties JSONB;
  required_props JSONB;
  prop_name TEXT;
  prop_schema JSONB;
  prop_value JSONB;
  is_valid_result BOOLEAN := true;
BEGIN
  -- Get schema type
  schema_type := p_schema->>'type';
  
  -- Validate type
  IF schema_type = 'object' THEN
    IF jsonb_typeof(p_data) != 'object' THEN
      errors_array := errors_array || jsonb_build_object(
        'code', 'TYPE_MISMATCH',
        'message', 'Expected object, got ' || jsonb_typeof(p_data)
      );
      is_valid_result := false;
    ELSE
      -- Check required properties
      required_props := p_schema->'required';
      IF required_props IS NOT NULL THEN
        FOR i IN 0..jsonb_array_length(required_props)-1 LOOP
          prop_name := required_props->>i;
          IF NOT p_data ? prop_name THEN
            errors_array := errors_array || jsonb_build_object(
              'code', 'MISSING_REQUIRED',
              'message', 'Missing required property: ' || prop_name,
              'property', prop_name
            );
            is_valid_result := false;
          END IF;
        END LOOP;
      END IF;
      
      -- Validate properties
      schema_properties := p_schema->'properties';
      IF schema_properties IS NOT NULL THEN
        FOR prop_name IN SELECT jsonb_object_keys(p_data) LOOP
          prop_value := p_data->prop_name;
          prop_schema := schema_properties->prop_name;
          
          IF prop_schema IS NULL THEN
            -- Check if additional properties allowed
            IF COALESCE((p_schema->>'additionalProperties')::BOOLEAN, true) = false THEN
              warnings_array := warnings_array || jsonb_build_object(
                'code', 'ADDITIONAL_PROPERTY',
                'message', 'Additional property not allowed: ' || prop_name,
                'property', prop_name
              );
            END IF;
          ELSE
            -- Validate property type
            IF prop_schema->>'type' IS NOT NULL THEN
              CASE prop_schema->>'type'
                WHEN 'string' THEN
                  IF jsonb_typeof(prop_value) != 'string' THEN
                    errors_array := errors_array || jsonb_build_object(
                      'code', 'PROPERTY_TYPE_MISMATCH',
                      'message', 'Property ' || prop_name || ' must be string',
                      'property', prop_name
                    );
                    is_valid_result := false;
                  END IF;
                WHEN 'number' THEN
                  IF jsonb_typeof(prop_value) NOT IN ('number') THEN
                    errors_array := errors_array || jsonb_build_object(
                      'code', 'PROPERTY_TYPE_MISMATCH', 
                      'message', 'Property ' || prop_name || ' must be number',
                      'property', prop_name
                    );
                    is_valid_result := false;
                  END IF;
                WHEN 'boolean' THEN
                  IF jsonb_typeof(prop_value) != 'boolean' THEN
                    errors_array := errors_array || jsonb_build_object(
                      'code', 'PROPERTY_TYPE_MISMATCH',
                      'message', 'Property ' || prop_name || ' must be boolean', 
                      'property', prop_name
                    );
                    is_valid_result := false;
                  END IF;
                WHEN 'array' THEN
                  IF jsonb_typeof(prop_value) != 'array' THEN
                    errors_array := errors_array || jsonb_build_object(
                      'code', 'PROPERTY_TYPE_MISMATCH',
                      'message', 'Property ' || prop_name || ' must be array',
                      'property', prop_name
                    );
                    is_valid_result := false;
                  END IF;
                WHEN 'object' THEN
                  IF jsonb_typeof(prop_value) != 'object' THEN
                    errors_array := errors_array || jsonb_build_object(
                      'code', 'PROPERTY_TYPE_MISMATCH',
                      'message', 'Property ' || prop_name || ' must be object',
                      'property', prop_name
                    );
                    is_valid_result := false;
                  END IF;
              END CASE;
            END IF;
            
            -- Validate enum values
            IF prop_schema->'enum' IS NOT NULL THEN
              IF NOT (prop_schema->'enum' @> jsonb_build_array(prop_value)) THEN
                errors_array := errors_array || jsonb_build_object(
                  'code', 'ENUM_VIOLATION',
                  'message', 'Property ' || prop_name || ' value not in allowed enum',
                  'property', prop_name,
                  'allowed_values', prop_schema->'enum'
                );
                is_valid_result := false;
              END IF;
            END IF;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END IF;
  
  RETURN QUERY SELECT is_valid_result, errors_array, warnings_array;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- SCHEMA MIGRATION FUNCTIONS
-- =============================================================================

-- Function to migrate JSON data between schema versions
CREATE OR REPLACE FUNCTION migrate_json_schema(
  p_table_name VARCHAR(100),
  p_column_name VARCHAR(100), 
  p_from_version INTEGER,
  p_to_version INTEGER,
  p_batch_size INTEGER DEFAULT 1000
) RETURNS TABLE (
  records_processed INTEGER,
  records_migrated INTEGER,
  records_failed INTEGER,
  migration_duration_seconds NUMERIC
) AS $$
DECLARE
  migration_script TEXT;
  from_schema RECORD;
  to_schema RECORD;
  batch_count INTEGER;
  total_processed INTEGER := 0;
  total_migrated INTEGER := 0;
  total_failed INTEGER := 0;
  start_time TIMESTAMP;
  cursor_sql TEXT;
  migration_cursor CURSOR FOR EXECUTE cursor_sql;
  record_batch RECORD[];
  batch_record RECORD;
  migrated_data JSONB;
BEGIN
  start_time := clock_timestamp();
  
  -- Get schema information
  SELECT * INTO from_schema FROM json_schemas 
  WHERE table_name = p_table_name AND column_name = p_column_name AND version = p_from_version;
  
  SELECT * INTO to_schema FROM json_schemas 
  WHERE table_name = p_table_name AND column_name = p_column_name AND version = p_to_version;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schema versions not found';
  END IF;
  
  migration_script := to_schema.migration_script;
  
  IF migration_script IS NULL THEN
    RAISE EXCEPTION 'No migration script defined for version % to %', p_from_version, p_to_version;
  END IF;
  
  -- Build cursor SQL
  cursor_sql := format(
    'SELECT id, %I as json_data FROM %I WHERE %I IS NOT NULL',
    p_column_name, p_table_name, p_column_name
  );
  
  -- Process records in batches
  FOR batch_record IN EXECUTE cursor_sql LOOP
    total_processed := total_processed + 1;
    
    BEGIN
      -- Execute migration function/script
      EXECUTE format('SELECT %s($1)', migration_script) INTO migrated_data USING batch_record.json_data;
      
      -- Update record with migrated data
      EXECUTE format(
        'UPDATE %I SET %I = $1 WHERE id = $2',
        p_table_name, p_column_name
      ) USING migrated_data, batch_record.id;
      
      total_migrated := total_migrated + 1;
      
      -- Log successful migration
      INSERT INTO json_schema_usage (
        schema_id, table_name, record_id,
        validation_status, migration_applied, migration_applied_at
      ) VALUES (
        to_schema.id, p_table_name, batch_record.id,
        'valid', true, NOW()
      );
      
    EXCEPTION WHEN OTHERS THEN
      total_failed := total_failed + 1;
      
      -- Log migration failure
      INSERT INTO json_schema_usage (
        schema_id, table_name, record_id,
        validation_status, migration_applied, migration_error
      ) VALUES (
        to_schema.id, p_table_name, batch_record.id,
        'invalid', false, SQLERRM
      );
    END;
    
    -- Commit batch periodically
    IF total_processed % p_batch_size = 0 THEN
      COMMIT;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    total_processed,
    total_migrated, 
    total_failed,
    EXTRACT(EPOCH FROM (clock_timestamp() - start_time));
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- QUERY OPTIMIZATION FOR JSON COLUMNS
-- =============================================================================

-- Function to create optimized indexes for JSON queries
CREATE OR REPLACE FUNCTION optimize_json_column_indexes(
  p_table_name VARCHAR(100),
  p_column_name VARCHAR(100)
) RETURNS TEXT AS $$
DECLARE
  schema_rec RECORD;
  index_sql TEXT;
  result_text TEXT := '';
BEGIN
  -- Get active schema
  SELECT * INTO schema_rec
  FROM json_schemas
  WHERE table_name = p_table_name 
    AND column_name = p_column_name
    AND status = 'active'
  ORDER BY version DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN 'No active schema found for ' || p_table_name || '.' || p_column_name;
  END IF;
  
  -- Create GIN index for general JSON operations
  index_sql := format(
    'CREATE INDEX IF NOT EXISTS idx_%s_%s_gin ON %s USING GIN (%s)',
    p_table_name, p_column_name, p_table_name, p_column_name
  );
  EXECUTE index_sql;
  result_text := result_text || 'Created GIN index for ' || p_column_name || E'\n';
  
  -- Create specific indexes based on schema properties
  IF schema_rec.schema_definition->'properties' IS NOT NULL THEN
    -- Create indexes for commonly queried string properties
    FOR prop_name IN 
      SELECT key 
      FROM jsonb_each(schema_rec.schema_definition->'properties') 
      WHERE value->>'type' = 'string'
      LIMIT 5 -- Limit to avoid too many indexes
    LOOP
      index_sql := format(
        'CREATE INDEX IF NOT EXISTS idx_%s_%s_%s ON %s ((%s->>%L))',
        p_table_name, p_column_name, prop_name, p_table_name, p_column_name, prop_name
      );
      
      BEGIN
        EXECUTE index_sql;
        result_text := result_text || 'Created index for property: ' || prop_name || E'\n';
      EXCEPTION WHEN OTHERS THEN
        result_text := result_text || 'Failed to create index for property: ' || prop_name || ' - ' || SQLERRM || E'\n';
      END;
    END LOOP;
  END IF;
  
  RETURN result_text;
END;
$$ LANGUAGE plpgsql;

-- Function to analyze JSON column usage patterns
CREATE OR REPLACE FUNCTION analyze_json_usage_patterns(
  p_table_name VARCHAR(100),
  p_column_name VARCHAR(100)
) RETURNS TABLE (
  property_path TEXT,
  usage_count BIGINT,
  distinct_values BIGINT,
  data_type TEXT,
  optimization_suggestion TEXT
) AS $$
BEGIN
  RETURN QUERY
  EXECUTE format($sql$
    WITH json_paths AS (
      SELECT 
        jsonb_path_query_array(%I, '$.**') as all_values,
        jsonb_path_query_array(%I, '$.** ? (@.type() == "string")') as string_values,
        jsonb_path_query_array(%I, '$.** ? (@.type() == "number")') as number_values
      FROM %I
      WHERE %I IS NOT NULL
    ),
    path_analysis AS (
      SELECT 
        'string_properties' as property_path,
        jsonb_array_length(string_values) as usage_count,
        (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(string_values) as value) as distinct_values,
        'string' as data_type
      FROM json_paths
      UNION ALL
      SELECT 
        'number_properties' as property_path,
        jsonb_array_length(number_values) as usage_count,
        (SELECT count(DISTINCT value) FROM jsonb_array_elements(number_values) as value) as distinct_values,
        'number' as data_type
      FROM json_paths
    )
    SELECT 
      property_path,
      usage_count,
      distinct_values,
      data_type,
      CASE 
        WHEN usage_count > 1000 AND distinct_values < 50 THEN 'Consider creating btree index'
        WHEN usage_count > 5000 THEN 'Consider creating GIN index'
        WHEN distinct_values::NUMERIC / usage_count < 0.1 THEN 'High cardinality - GIN index recommended'
        ELSE 'Current indexing sufficient'
      END as optimization_suggestion
    FROM path_analysis
    WHERE usage_count > 0
  $sql$, p_column_name, p_column_name, p_column_name, p_table_name, p_column_name);
END;
$$ LANGUAGE plpgsql;