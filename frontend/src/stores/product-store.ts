import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface Product {
  id: string
  name: string
  description?: string
  materials: string[] // Material IDs
  laborTimeMinutes: number
  costToManufacture: number
  suggestedPrice: number
  createdAt: Date
  updatedAt: Date
}

interface ProductStore {
  products: Product[]
  selectedProduct: Product | null
  isLoading: boolean
  error: string | null
  
  // Actions
  setProducts: (products: Product[]) => void
  addProduct: (product: Product) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  selectProduct: (product: Product | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useProductStore = create<ProductStore>()(
  devtools(
    (set, get) => ({
      products: [],
      selectedProduct: null,
      isLoading: false,
      error: null,
      
      setProducts: (products) => set({ products }),
      
      addProduct: (product) => 
        set((state) => ({ 
          products: [...state.products, product] 
        })),
      
      updateProduct: (id, updates) =>
        set((state) => ({
          products: state.products.map((product) =>
            product.id === id ? { ...product, ...updates } : product
          ),
          selectedProduct: 
            state.selectedProduct?.id === id 
              ? { ...state.selectedProduct, ...updates }
              : state.selectedProduct
        })),
      
      deleteProduct: (id) =>
        set((state) => ({
          products: state.products.filter((product) => product.id !== id),
          selectedProduct: 
            state.selectedProduct?.id === id ? null : state.selectedProduct
        })),
      
      selectProduct: (product) => set({ selectedProduct: product }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error })
    }),
    {
      name: 'product-store'
    }
  )
)