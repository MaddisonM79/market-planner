import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Material {
  id: string
  name: string
  type: 'yarn' | 'component' | 'supply'
  costPerUnit: number
  unit: string // 'skein', 'ball', 'gram', 'piece', etc.
  quantityInStock: number
  lowStockThreshold?: number
  supplier?: string
  notes?: string
  createdAt: Date
  updatedAt: Date
}

interface MaterialsStore {
  materials: Material[]
  selectedMaterials: string[] // IDs for multi-select
  isLoading: boolean
  error: string | null
  filters: {
    type: 'all' | 'yarn' | 'component' | 'supply'
    searchTerm: string
    lowStockOnly: boolean
  }
  
  // Actions
  setMaterials: (materials: Material[]) => void
  addMaterial: (material: Material) => void
  updateMaterial: (id: string, updates: Partial<Material>) => void
  deleteMaterial: (id: string) => void
  toggleMaterialSelection: (id: string) => void
  clearSelectedMaterials: () => void
  setFilters: (filters: Partial<MaterialsStore['filters']>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Getters
  getFilteredMaterials: () => Material[]
  getMaterialById: (id: string) => Material | undefined
  getLowStockMaterials: () => Material[]
}

export const useMaterialsStore = create<MaterialsStore>()(
  devtools(
    (set, get) => ({
      materials: [],
      selectedMaterials: [],
      isLoading: false,
      error: null,
      filters: {
        type: 'all',
        searchTerm: '',
        lowStockOnly: false
      },
      
      setMaterials: (materials) => set({ materials }),
      
      addMaterial: (material) => 
        set((state) => ({ 
          materials: [...state.materials, material] 
        })),
      
      updateMaterial: (id, updates) =>
        set((state) => ({
          materials: state.materials.map((material) =>
            material.id === id ? { ...material, ...updates } : material
          )
        })),
      
      deleteMaterial: (id) =>
        set((state) => ({
          materials: state.materials.filter((material) => material.id !== id),
          selectedMaterials: state.selectedMaterials.filter((selectedId) => selectedId !== id)
        })),
      
      toggleMaterialSelection: (id) =>
        set((state) => ({
          selectedMaterials: state.selectedMaterials.includes(id)
            ? state.selectedMaterials.filter((selectedId) => selectedId !== id)
            : [...state.selectedMaterials, id]
        })),
      
      clearSelectedMaterials: () => set({ selectedMaterials: [] }),
      
      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters }
        })),
      
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      
      // Getters
      getFilteredMaterials: () => {
        const { materials, filters } = get()
        return materials.filter((material) => {
          const matchesType = filters.type === 'all' || material.type === filters.type
          const matchesSearch = material.name.toLowerCase().includes(filters.searchTerm.toLowerCase())
          const matchesLowStock = !filters.lowStockOnly || 
            (material.lowStockThreshold && material.quantityInStock <= material.lowStockThreshold)
          
          return matchesType && matchesSearch && matchesLowStock
        })
      },
      
      getMaterialById: (id) => {
        const { materials } = get()
        return materials.find((material) => material.id === id)
      },
      
      getLowStockMaterials: () => {
        const { materials } = get()
        return materials.filter((material) => 
          material.lowStockThreshold && material.quantityInStock <= material.lowStockThreshold
        )
      }
    }),
    {
      name: 'materials-store'
    }
  )
)