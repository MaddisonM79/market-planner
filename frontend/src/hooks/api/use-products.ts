import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Product, CreateProduct, UpdateProduct } from '@/lib/validations'

// API functions (to be implemented with actual API calls)
const api = {
  getProducts: async (): Promise<Product[]> => {
    // TODO: Replace with actual API call
    const response = await fetch('/api/products')
    if (!response.ok) throw new Error('Failed to fetch products')
    return response.json()
  },
  
  getProduct: async (id: string): Promise<Product> => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/products/${id}`)
    if (!response.ok) throw new Error('Failed to fetch product')
    return response.json()
  },
  
  createProduct: async (product: CreateProduct): Promise<Product> => {
    // TODO: Replace with actual API call
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    })
    if (!response.ok) throw new Error('Failed to create product')
    return response.json()
  },
  
  updateProduct: async (id: string, updates: UpdateProduct): Promise<Product> => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!response.ok) throw new Error('Failed to update product')
    return response.json()
  },
  
  deleteProduct: async (id: string): Promise<void> => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/products/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete product')
  }
}

// Query keys
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: string) => [...productKeys.lists(), { filters }] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const
}

// Hooks
export const useProducts = () => {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: api.getProducts
  })
}

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => api.getProduct(id),
    enabled: !!id
  })
}

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    }
  })
}

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateProduct }) =>
      api.updateProduct(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
    }
  })
}

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    }
  })
}