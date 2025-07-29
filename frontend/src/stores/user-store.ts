import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface UserPreferences {
  defaultLaborRate: number // per hour
  currency: string
  theme: 'light' | 'dark' | 'system'
  notifications: {
    lowStock: boolean
    priceUpdates: boolean
    exportComplete: boolean
  }
  marketDefaults: {
    markup: number // percentage
    includeShipping: boolean
    roundPrices: boolean
  }
}

interface UserStore {
  user: {
    id: string
    email: string
    name?: string
    clerkId: string
  } | null
  preferences: UserPreferences
  isLoading: boolean
  error: string | null
  
  // Actions
  setUser: (user: UserStore['user']) => void
  updatePreferences: (updates: Partial<UserPreferences>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearUser: () => void
}

const defaultPreferences: UserPreferences = {
  defaultLaborRate: 15.00,
  currency: 'USD',
  theme: 'system',
  notifications: {
    lowStock: true,
    priceUpdates: false,
    exportComplete: true
  },
  marketDefaults: {
    markup: 50, // 50% markup
    includeShipping: false,
    roundPrices: true
  }
}

export const useUserStore = create<UserStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        preferences: defaultPreferences,
        isLoading: false,
        error: null,
        
        setUser: (user) => set({ user }),
        
        updatePreferences: (updates) =>
          set((state) => ({
            preferences: { ...state.preferences, ...updates }
          })),
        
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        
        clearUser: () => set({ 
          user: null, 
          preferences: defaultPreferences 
        })
      }),
      {
        name: 'user-store',
        partialize: (state) => ({
          user: state.user,
          preferences: state.preferences
        })
      }
    ),
    {
      name: 'user-store'
    }
  )
)