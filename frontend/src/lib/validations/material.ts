import { z } from 'zod'

export const MaterialSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, 'Material name is required').max(100, 'Material name must be less than 100 characters'),
  type: z.enum(['yarn', 'component', 'supply'], {
    required_error: 'Material type is required'
  }),
  costPerUnit: z.number().min(0, 'Cost per unit must be positive'),
  unit: z.string().min(1, 'Unit is required').max(20, 'Unit must be less than 20 characters'),
  quantityInStock: z.number().min(0, 'Quantity in stock must be positive'),
  lowStockThreshold: z.number().min(0, 'Low stock threshold must be positive').optional(),
  supplier: z.string().max(100, 'Supplier name must be less than 100 characters').optional(),
  notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export const CreateMaterialSchema = MaterialSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
})

export const UpdateMaterialSchema = MaterialSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

// Specific schemas for different material types
export const YarnSchema = MaterialSchema.extend({
  type: z.literal('yarn'),
  yarnWeight: z.enum(['lace', 'fingering', 'dk', 'worsted', 'bulky', 'super-bulky']).optional(),
  fiber: z.string().max(50, 'Fiber must be less than 50 characters').optional(),
  colorway: z.string().max(50, 'Colorway must be less than 50 characters').optional(),
  yardage: z.number().min(0, 'Yardage must be positive').optional()
})

export const ComponentSchema = MaterialSchema.extend({
  type: z.literal('component'),
  size: z.string().max(20, 'Size must be less than 20 characters').optional(),
  color: z.string().max(30, 'Color must be less than 30 characters').optional()
})

export const SupplySchema = MaterialSchema.extend({
  type: z.literal('supply'),
  category: z.string().max(50, 'Category must be less than 50 characters').optional()
})

export type Material = z.infer<typeof MaterialSchema>
export type CreateMaterial = z.infer<typeof CreateMaterialSchema>
export type UpdateMaterial = z.infer<typeof UpdateMaterialSchema>
export type Yarn = z.infer<typeof YarnSchema>
export type Component = z.infer<typeof ComponentSchema>
export type Supply = z.infer<typeof SupplySchema>