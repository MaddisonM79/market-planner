import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Material, CreateMaterial, UpdateMaterial } from '@/lib/validations'

// API functions (to be implemented with actual API calls)
const api = {
  getMaterials: async (): Promise<Material[]> => {
    // TODO: Replace with actual API call
    const response = await fetch('/api/materials')
    if (!response.ok) throw new Error('Failed to fetch materials')
    return response.json()
  },
  
  getMaterial: async (id: string): Promise<Material> => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/materials/${id}`)
    if (!response.ok) throw new Error('Failed to fetch material')
    return response.json()
  },
  
  createMaterial: async (material: CreateMaterial): Promise<Material> => {
    // TODO: Replace with actual API call
    const response = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(material)
    })
    if (!response.ok) throw new Error('Failed to create material')
    return response.json()
  },
  
  updateMaterial: async (id: string, updates: UpdateMaterial): Promise<Material> => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/materials/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })
    if (!response.ok) throw new Error('Failed to update material')
    return response.json()
  },
  
  deleteMaterial: async (id: string): Promise<void> => {
    // TODO: Replace with actual API call
    const response = await fetch(`/api/materials/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) throw new Error('Failed to delete material')
  }
}

// Query keys
export const materialKeys = {
  all: ['materials'] as const,
  lists: () => [...materialKeys.all, 'list'] as const,
  list: (filters: string) => [...materialKeys.lists(), { filters }] as const,
  details: () => [...materialKeys.all, 'detail'] as const,
  detail: (id: string) => [...materialKeys.details(), id] as const,
  types: (type: string) => [...materialKeys.all, 'type', type] as const
}

// Hooks
export const useMaterials = () => {
  return useQuery({
    queryKey: materialKeys.lists(),
    queryFn: api.getMaterials
  })
}

export const useMaterialsByType = (type: 'yarn' | 'component' | 'supply') => {
  return useQuery({
    queryKey: materialKeys.types(type),
    queryFn: async () => {
      const materials = await api.getMaterials()
      return materials.filter((material) => material.type === type)
    }
  })
}

export const useMaterial = (id: string) => {
  return useQuery({
    queryKey: materialKeys.detail(id),
    queryFn: () => api.getMaterial(id),
    enabled: !!id
  })
}

export const useCreateMaterial = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.createMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.lists() })
    }
  })
}

export const useUpdateMaterial = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateMaterial }) =>
      api.updateMaterial(id, updates),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: materialKeys.lists() })
      queryClient.invalidateQueries({ queryKey: materialKeys.detail(variables.id) })
    }
  })
}

export const useDeleteMaterial = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: api.deleteMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.lists() })
    }
  })
}