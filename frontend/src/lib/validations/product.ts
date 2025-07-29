import { z } from 'zod'

export const ProductSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1, 'Product name is required').max(100, 'Product name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  materials: z.array(z.string().cuid()).min(1, 'At least one material is required'),
  laborTimeMinutes: z.number().min(0, 'Labor time must be positive').max(10080, 'Labor time cannot exceed 7 days'),
  costToManufacture: z.number().min(0, 'Cost must be positive'),
  suggestedPrice: z.number().min(0, 'Price must be positive'),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export const CreateProductSchema = ProductSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  costToManufacture: true, // Calculated automatically
  suggestedPrice: true // Calculated automatically
})

export const UpdateProductSchema = ProductSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true
})

export type Product = z.infer<typeof ProductSchema>
export type CreateProduct = z.infer<typeof CreateProductSchema>
export type UpdateProduct = z.infer<typeof UpdateProductSchema>