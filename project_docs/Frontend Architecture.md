# **Yarn Crafting SaaS - Frontend Architecture**

## **Product-Centric Approach**

**Core Philosophy**: This application is fundamentally about **finished products** that crafters make and sell. Materials (yarn, components) are supporting inventory that enables product creation.

**Primary User Journey:**
1. **Manage Materials** → Add yarn, safety eyes, clasps, etc. to inventory
2. **Build Products** → Select materials + labor time = finished product with cost-to-manufacture
3. **Price & Sell** → Set sale prices, generate market sheets, export to sales platforms
4. **Analyze Performance** → Track profitability, material usage, pricing strategies

**Key Entities:**
- **Product** (Primary): Finished items like "Amigurumi Bear", "Baby Blanket", "Scarf"
- **Materials** (Supporting): Yarn + components that go into products  
- **Market Events** (Supporting): Where products are sold
- **Cost Calculations** (Supporting): Material cost + labor = total cost-to-manufacture

## **Tech Stack & Tools**

**Core Framework:**
- **Next.js 15.4.4** (App Router) - latest stable version
- **React 19.1.0** with TypeScript - latest version with new features like Server Components
- **Tailwind CSS v4.1** - major rewrite with 5x faster builds and modern CSS features
- **Shadcn/ui** (latest) - updated for Tailwind v4 and React 19 support
- **Motion 12.23.11** (formerly Framer Motion) - latest animation library

**State Management:**
- **Zustand** for global state (lightweight, TypeScript-first)
- **TanStack Query (React Query)** for server state with optimistic updates
- **React Hook Form** for form management with local persistence
- **Zod** for form validation with custom business rules
- **WebSocket integration** for real-time state synchronization with conflict resolution

**Development Tools:**
- **Storybook** for component development
- **Jest + React Testing Library** for testing
- **ESLint + Prettier** for code quality
- **Husky** for git hooks

**Performance & UX Enhancements:**
- **Virtual scrolling** for large inventory lists (hundreds of items)
- **Progressive image loading** for product photos
- **Debounced cost calculations** with cached totals
- **Form state persistence** in browser storage
- **Real-time notifications** for concurrent user updates
- **Read-only offline mode** for craft fair price viewing
- **Toggleable WebSocket connections** for battery optimization
- **Smart cache management** with size limits and cleanup strategies

**Key Version Updates:**
- **Next.js 15.4.4**: Latest stable with Turbopack improvements and React 19 support
- **React 19.1.0**: New `use` hook, Server Actions, improved hydration, ref cleanup
- **Tailwind v4.1**: Complete rewrite with 5x faster builds, text shadows, mask utilities
- **Motion 12.23.11**: Rebranded from Framer Motion, now uses `motion/react` import
- **Shadcn/ui**: Fully updated for Tailwind v4 and React 19 compatibility

## **Project Structure**

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth route group
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/              # Protected dashboard routes
│   │   ├── products/             # **PRIMARY**: Product management
│   │   ├── materials/            # Materials inventory (yarn + components)
│   │   ├── markets/              # Sales & market management  
│   │   ├── analytics/            # Product analytics & profitability
│   │   ├── integrations/         # Platform exports
│   │   └── settings/             # User settings
│   ├── api/                      # API routes (if needed)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/                   # Reusable UI components
│   ├── ui/                       # Base UI components (shadcn)
│   ├── products/                 # **PRIMARY**: Product-specific components
│   │   ├── product-card.tsx
│   │   ├── product-builder.tsx
│   │   ├── cost-calculator.tsx
│   │   └── pricing-suggestions.tsx
│   ├── materials/                # Material selection & management
│   │   ├── material-selector.tsx
│   │   ├── yarn-card.tsx
│   │   └── component-card.tsx
│   ├── markets/                  # Sales & market components
│   │   ├── market-sheet-generator.tsx
│   │   ├── export-wizard.tsx
│   │   └── pricing-calculator.tsx
│   ├── forms/                    # Form-specific components
│   ├── tables/                   # Data table components
│   ├── modals/                   # Modal components
│   └── layout/                   # Layout components
├── lib/                          # Utilities and configurations
│   ├── api/                      # API client and types
│   ├── auth/                     # Custom auth configuration
│   ├── utils/                    # Helper functions
│   ├── validations/              # Zod schemas for products, materials
│   └── constants/                # App constants
├── hooks/                        # Custom React hooks
│   ├── api/                      # API hooks (products, materials, markets)
│   ├── use-cost-calculator.ts    # Product cost calculation logic
│   └── use-product-builder.ts    # Product creation workflow
├── stores/                       # Zustand stores
│   ├── product-store.ts          # **PRIMARY**: Product state
│   ├── materials-store.ts        # Materials inventory state
│   └── user-store.ts             # User preferences & rates
├── types/                        # TypeScript type definitions
│   ├── product.ts                # **PRIMARY**: Product types
│   ├── material.ts               # Material types (yarn, components)
│   ├── market.ts                 # Market & sales types
│   └── api.ts                    # API response types
└── styles/                       # Additional styling
```

## **Design System & Component Architecture**

### **Color Theme System**

**Theme Architecture:**
```typescript
// lib/themes/theme-definitions.ts
export interface ColorTheme {
  id: string
  name: string
  description: string
  colors: {
    // Core brand colors
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    accent: string
    accentForeground: string
    
    // UI colors
    background: string
    foreground: string
    card: string
    cardForeground: string
    popover: string
    popoverForeground: string
    
    // Status colors
    muted: string
    mutedForeground: string
    border: string
    input: string
    ring: string
    
    // Semantic colors
    destructive: string
    destructiveForeground: string
    success: string
    successForeground: string
    warning: string
    warningForeground: string
    
    // Craft-specific colors
    yarn: {
      cotton: string
      wool: string
      acrylic: string
      silk: string
      linen: string
    }
    
    // Cost indicator colors
    cost: {
      low: string      // Green tones for low cost materials
      medium: string   // Yellow/amber for medium cost
      high: string     // Red tones for expensive materials
      profit: string   // Success green for profit margins
    }
  }
}

export const themes: Record<string, ColorTheme> = {
  // Default theme - Professional craft focus
  default: {
    id: 'default',
    name: 'Craft Studio',
    description: 'Clean, professional theme for serious crafters',
    colors: {
      primary: '#3b82f6',
      primaryForeground: '#ffffff',
      secondary: '#f1f5f9',
      secondaryForeground: '#0f172a',
      accent: '#f8fafc',
      accentForeground: '#1e293b',
      
      background: '#ffffff',
      foreground: '#020617',
      card: '#ffffff',
      cardForeground: '#020617',
      popover: '#ffffff',
      popoverForeground: '#020617',
      
      muted: '#f1f5f9',
      mutedForeground: '#64748b',
      border: '#e2e8f0',
      input: '#e2e8f0',
      ring: '#3b82f6',
      
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
      success: '#22c55e',
      successForeground: '#ffffff',
      warning: '#f59e0b',
      warningForeground: '#ffffff',
      
      yarn: {
        cotton: '#f8fafc',
        wool: '#fef3c7',
        acrylic: '#e0f2fe',
        silk: '#fdf2f8',
        linen: '#f7fee7'
      },
      
      cost: {
        low: '#dcfce7',
        medium: '#fef3c7', 
        high: '#fee2e2',
        profit: '#22c55e'
      }
    }
  },

  // Warm & cozy theme
  cozy: {
    id: 'cozy',
    name: 'Cozy Corner',
    description: 'Warm, inviting colors inspired by hand-knitted comfort',
    colors: {
      primary: '#d97706',
      primaryForeground: '#ffffff',
      secondary: '#fed7aa',
      secondaryForeground: '#9a3412',
      accent: '#fef3c7',
      accentForeground: '#92400e',
      
      background: '#fffbeb',
      foreground: '#92400e',
      card: '#ffffff',
      cardForeground: '#92400e',
      popover: '#ffffff',
      popoverForeground: '#92400e',
      
      muted: '#fef3c7',
      mutedForeground: '#a16207',
      border: '#fed7aa',
      input: '#fed7aa',
      ring: '#d97706',
      
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
      success: '#16a34a',
      successForeground: '#ffffff',
      warning: '#ea580c',
      warningForeground: '#ffffff',
      
      yarn: {
        cotton: '#fef7ed',
        wool: '#fef3c7',
        acrylic: '#fef2f2',
        silk: '#fdf4ff',
        linen: '#f0fdf4'
      },
      
      cost: {
        low: '#dcfce7',
        medium: '#fbbf24',
        high: '#f87171',
        profit: '#16a34a'
      }
    }
  },

  // Fresh & modern theme
  fresh: {
    id: 'fresh',
    name: 'Fresh Mint',
    description: 'Clean, modern palette with refreshing green accents',
    colors: {
      primary: '#059669',
      primaryForeground: '#ffffff',
      secondary: '#d1fae5', 
      secondaryForeground: '#064e3b',
      accent: '#ecfdf5',
      accentForeground: '#065f46',
      
      background: '#ffffff',
      foreground: '#064e3b',
      card: '#ffffff',
      cardForeground: '#064e3b',
      popover: '#ffffff',
      popoverForeground: '#064e3b',
      
      muted: '#f3f4f6',
      mutedForeground: '#6b7280',
      border: '#d1d5db',
      input: '#d1d5db',
      ring: '#059669',
      
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
      success: '#10b981',
      successForeground: '#ffffff',
      warning: '#f59e0b',
      warningForeground: '#ffffff',
      
      yarn: {
        cotton: '#f7fee7',
        wool: '#fef3c7',
        acrylic: '#f0f9ff',
        silk: '#fdf2f8',
        linen: '#f0fdf4'
      },
      
      cost: {
        low: '#d1fae5',
        medium: '#fed7aa',
        high: '#fecaca',
        profit: '#10b981'
      }
    }
  },

  // Purple artisan theme
  artisan: {
    id: 'artisan',
    name: 'Artisan Purple',
    description: 'Rich, creative palette for artistic crafters',
    colors: {
      primary: '#7c3aed',
      primaryForeground: '#ffffff',
      secondary: '#ddd6fe',
      secondaryForeground: '#4c1d95',
      accent: '#f3f4f6',
      accentForeground: '#374151',
      
      background: '#ffffff',
      foreground: '#1f2937',
      card: '#ffffff',
      cardForeground: '#1f2937',
      popover: '#ffffff',
      popoverForeground: '#1f2937',
      
      muted: '#f9fafb',
      mutedForeground: '#6b7280',
      border: '#e5e7eb',
      input: '#e5e7eb',
      ring: '#7c3aed',
      
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
      success: '#10b981',
      successForeground: '#ffffff',
      warning: '#f59e0b',
      warningForeground: '#ffffff',
      
      yarn: {
        cotton: '#f8fafc',
        wool: '#fef3c7',
        acrylic: '#ede9fe',
        silk: '#fdf2f8',
        linen: '#f0fdf4'
      },
      
      cost: {
        low: '#dcfce7',
        medium: '#fef3c7',
        high: '#fee2e2',
        profit: '#10b981'
      }
    }
  },

  // High contrast accessibility theme
  accessible: {
    id: 'accessible',
    name: 'High Contrast',
    description: 'Maximum contrast for better accessibility',
    colors: {
      primary: '#000000',
      primaryForeground: '#ffffff',
      secondary: '#f8f9fa',
      secondaryForeground: '#000000',
      accent: '#e9ecef',
      accentForeground: '#000000',
      
      background: '#ffffff',
      foreground: '#000000',
      card: '#ffffff',
      cardForeground: '#000000',
      popover: '#ffffff',
      popoverForeground: '#000000',
      
      muted: '#f8f9fa',
      mutedForeground: '#495057',
      border: '#dee2e6',
      input: '#ced4da',
      ring: '#000000',
      
      destructive: '#dc3545',
      destructiveForeground: '#ffffff',
      success: '#198754',
      successForeground: '#ffffff',
      warning: '#fd7e14',
      warningForeground: '#000000',
      
      yarn: {
        cotton: '#f8f9fa',
        wool: '#fff3cd',
        acrylic: '#cff4fc',
        silk: '#f8d7da',
        linen: '#d1e7dd'
      },
      
      cost: {
        low: '#d1e7dd',
        medium: '#fff3cd',
        high: '#f8d7da',
        profit: '#198754'
      }
    }
  }
}
```

**Theme Store & Management:**
```typescript
// stores/theme-store.ts
interface ThemeStore {
  currentTheme: string
  availableThemes: ColorTheme[]
  setTheme: (themeId: string) => void
  getThemeColors: () => ColorTheme['colors']
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  currentTheme: 'default',
  availableThemes: Object.values(themes),
  
  setTheme: (themeId: string) => {
    const theme = themes[themeId]
    if (theme) {
      set({ currentTheme: themeId })
      localStorage.setItem('selected-theme', themeId)
      
      // Apply CSS custom properties
      applyThemeToDOM(theme)
    }
  },
  
  getThemeColors: () => {
    const { currentTheme } = get()
    return themes[currentTheme]?.colors || themes.default.colors
  },
  
  isDarkMode: false,
  toggleDarkMode: () => {
    set((state) => ({ isDarkMode: !state.isDarkMode }))
    // Dark mode variants would be applied here
  }
}))

// Apply theme colors to CSS custom properties
const applyThemeToDOM = (theme: ColorTheme) => {
  const root = document.documentElement
  
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(`--color-${key}`, value)
    } else if (typeof value === 'object') {
      // Handle nested color objects (yarn, cost)
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        root.style.setProperty(`--color-${key}-${nestedKey}`, nestedValue as string)
      })
    }
  })
}
```

**Theme Selector Component:**
```typescript
// components/settings/theme-selector.tsx
const ThemeSelector: React.FC = () => {
  const { currentTheme, availableThemes, setTheme } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Color Theme</h3>
          <p className="text-sm text-muted-foreground">
            Choose a color theme that matches your style
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setIsOpen(!isOpen)}
          className="min-w-[120px] justify-start"
        >
          <div className="flex items-center space-x-2">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: themes[currentTheme]?.colors.primary }}
            />
            <span>{themes[currentTheme]?.name}</span>
          </div>
          <ChevronDown className="w-4 h-4 ml-auto" />
        </Button>
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-card">
          {availableThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isSelected={currentTheme === theme.id}
              onSelect={() => {
                setTheme(theme.id)
                setIsOpen(false)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Individual theme preview card
const ThemeCard: React.FC<{
  theme: ColorTheme
  isSelected: boolean
  onSelect: () => void
}> = ({ theme, isSelected, onSelect }) => {
  return (
    <button
      onClick={onSelect}
      className={`p-4 rounded-lg border-2 text-left transition-colors ${
        isSelected 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="space-y-3">
        {/* Theme name and description */}
        <div>
          <h4 className="font-medium">{theme.name}</h4>
          <p className="text-xs text-muted-foreground">{theme.description}</p>
        </div>
        
        {/* Color palette preview */}
        <div className="space-y-2">
          <div className="flex space-x-1">
            <div 
              className="w-6 h-6 rounded"
              style={{ backgroundColor: theme.colors.primary }}
              title="Primary"
            />
            <div 
              className="w-6 h-6 rounded"
              style={{ backgroundColor: theme.colors.secondary }}
              title="Secondary"
            />
            <div 
              className="w-6 h-6 rounded"
              style={{ backgroundColor: theme.colors.accent }}
              title="Accent"
            />
          </div>
          
          {/* Yarn colors preview */}
          <div className="flex space-x-1">
            {Object.entries(theme.colors.yarn).slice(0, 3).map(([yarnType, color]) => (
              <div
                key={yarnType}
                className="w-4 h-4 rounded-sm border"
                style={{ backgroundColor: color }}
                title={yarnType}
              />
            ))}
          </div>
        </div>
        
        {/* Mini product card preview */}
        <div 
          className="p-2 rounded text-xs"
          style={{ 
            backgroundColor: theme.colors.card,
            color: theme.colors.cardForeground,
            border: `1px solid ${theme.colors.border}`
          }}
        >
          <div className="font-medium">Sample Product</div>
          <div style={{ color: theme.colors.mutedForeground }}>
            Cost: $12.50 • Sale: $25.00
          </div>
          <div 
            className="inline-block px-1 py-0.5 rounded text-xs mt-1"
            style={{ 
              backgroundColor: theme.colors.cost.profit,
              color: theme.colors.successForeground
            }}
          >
            50% profit
          </div>
        </div>
      </div>
    </button>
  )
}
```

**Tailwind Configuration for Themes:**
```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Use CSS custom properties for dynamic theming
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primaryForeground)',
        secondary: 'var(--color-secondary)',
        'secondary-foreground': 'var(--color-secondaryForeground)',
        accent: 'var(--color-accent)',
        'accent-foreground': 'var(--color-accentForeground)',
        
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        card: 'var(--color-card)',
        'card-foreground': 'var(--color-cardForeground)',
        popover: 'var(--color-popover)',
        'popover-foreground': 'var(--color-popoverForeground)',
        
        muted: 'var(--color-muted)',
        'muted-foreground': 'var(--color-mutedForeground)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        
        destructive: 'var(--color-destructive)',
        'destructive-foreground': 'var(--color-destructiveForeground)',
        success: 'var(--color-success)',
        'success-foreground': 'var(--color-successForeground)',
        warning: 'var(--color-warning)',
        'warning-foreground': 'var(--color-warningForeground)',
        
        // Craft-specific colors
        'yarn-cotton': 'var(--color-yarn-cotton)',
        'yarn-wool': 'var(--color-yarn-wool)',
        'yarn-acrylic': 'var(--color-yarn-acrylic)',
        'yarn-silk': 'var(--color-yarn-silk)',
        'yarn-linen': 'var(--color-yarn-linen)',
        
        'cost-low': 'var(--color-cost-low)',
        'cost-medium': 'var(--color-cost-medium)',
        'cost-high': 'var(--color-cost-high)',
        'cost-profit': 'var(--color-cost-profit)',
      }
    }
  },
  plugins: []
}
```

**Usage in Components:**
```typescript
// Example: Material card with theme-aware styling
const MaterialCard: React.FC<{ material: Material }> = ({ material }) => {
  const getYarnColor = (fiberType: string) => {
    const colorMap: Record<string, string> = {
      cotton: 'bg-yarn-cotton',
      wool: 'bg-yarn-wool', 
      acrylic: 'bg-yarn-acrylic',
      silk: 'bg-yarn-silk',
      linen: 'bg-yarn-linen'
    }
    return colorMap[fiberType.toLowerCase()] || 'bg-muted'
  }

  const getCostColor = (cost: number) => {
    if (cost < 5) return 'bg-cost-low text-success-foreground'
    if (cost < 15) return 'bg-cost-medium text-warning-foreground'
    return 'bg-cost-high text-destructive-foreground'
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-12 rounded ${getYarnColor(material.fiberContent)}`} />
          <div>
            <h3 className="font-medium">{material.name}</h3>
            <p className="text-sm text-muted-foreground">{material.brand}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-sm ${getCostColor(material.costPerUnit)}`}>
          ${material.costPerUnit}
        </div>
      </div>
    </Card>
  )
}
```

**Base Design Tokens (Updated):**
```typescript
// Now dynamically themed via CSS custom properties
const componentStyles = {
  button: 'bg-primary text-primary-foreground hover:bg-primary/90',
  card: 'bg-card text-card-foreground border-border',
  input: 'border-input bg-background text-foreground',
  badge: 'bg-accent text-accent-foreground',
  
  // Craft-specific styling
  yarnCard: 'bg-card border-border hover:border-primary/50',
  costIndicator: 'text-success font-medium',
  profitMargin: 'text-cost-profit font-semibold'
}
```

**Component Hierarchy:**
- **Layout Components**: Navigation, Sidebar, Header, Footer
- **Data Display**: Tables, Cards, Charts, Badges
- **Forms**: Input variants, Selectors, File uploads
- **Feedback**: Toasts, Loading states, Error boundaries
- **Business Logic**: Inventory cards, Cost calculators, Product builders

## **Key Pages & Route Structure**

### **Authentication (Custom)**
```
/(auth)/
├── /login                        # Sign in page
├── /register                     # Registration page
├── /verify-email                 # Email verification
├── /forgot-password              # Password reset request
├── /reset-password               # Password reset form
├── /enable-mfa                   # MFA setup
└── /onboarding                   # Initial setup wizard
```

### **Main Dashboard**
```
/(dashboard)/
├── /                            # Dashboard home - products overview
├── /products/                   # **PRIMARY**: Product catalog & management
│   ├── /                        # Product gallery/list
│   ├── /[id]                    # Product details & cost breakdown
│   ├── /create                  # New product builder
│   ├── /[id]/edit               # Edit existing product
│   └── /[id]/duplicate          # Duplicate product workflow
├── /materials/                  # Materials inventory (yarn + components)
│   ├── /yarn                    # Yarn inventory
│   ├── /components              # Components (eyes, clasps, etc.)
│   ├── /add                     # Add new materials
│   └── /bulk-import             # CSV/bulk import
├── /markets/                    # Sales & market management
│   ├── /events                  # Market events planning
│   ├── /sheets                  # Product market sheets
│   ├── /pricing                 # Pricing strategies
│   └── /history                 # Sales history
├── /analytics/                  # Product profitability & trends
│   ├── /costs                   # Cost analysis by product
│   ├── /profits                 # Profit margins & trends
│   └── /materials-usage         # Material utilization
├── /integrations/               # Shopify, Etsy, Square exports
└── /settings/                   # User preferences & rates
```

## **State Management Strategy**

### **Global State (Zustand)**
```typescript
// stores/user-store.ts
interface UserStore {
  profile: UserProfile | null
  preferences: UserPreferences
  laborRate: number
  selectedTheme: string
  updateProfile: (profile: Partial<UserProfile>) => void
  setLaborRate: (rate: number) => void
  setTheme: (themeId: string) => void
  getThemePreferences: () => { theme: string; customColors?: Record<string, string> }
}

// stores/product-store.ts
interface ProductStore {
  currentProduct: Product | null
  productFilters: ProductFilters
  selectedProducts: string[]
  setCurrentProduct: (product: Product | null) => void
  setFilters: (filters: Partial<ProductFilters>) => void
  toggleProductSelection: (productId: string) => void
}

// stores/materials-store.ts
interface MaterialsStore {
  yarns: Yarn[]
  components: Component[]
  filters: MaterialFilters
  setFilters: (filters: Partial<MaterialFilters>) => void
}
```

### **Server State (TanStack Query)**
```typescript
// hooks/api/use-products.ts
export const useProducts = (filters?: ProductFilters) => {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.products.getAll(filters),
  })
}

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => api.products.getById(id),
    enabled: !!id
  })
}

export const useCreateProduct = () => {
  return useMutation({
    mutationFn: api.products.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['products'])
    }
  })
}

// hooks/api/use-materials.ts
export const useMaterials = () => {
  return useQuery({
    queryKey: ['materials'],
    queryFn: () => api.materials.getAll(),
  })
}
```

## **Advanced Implementation Requirements**

### **Real-Time State Management**

**WebSocket Integration:**
```typescript
// hooks/use-real-time-sync.ts
export const useRealTimeSync = () => {
  const [socket] = useState(() => new WebSocket(process.env.NEXT_PUBLIC_WS_URL))
  const queryClient = useQueryClient()
  
  useEffect(() => {
    socket.onmessage = (event) => {
      const { type, data, userId } = JSON.parse(event.data)
      
      if (type === 'PRODUCT_UPDATED' && userId !== currentUserId) {
        // Show notification to other users
        toast.info(`Product "${data.name}" was updated by another user`)
        
        // Invalidate and refetch current data
        queryClient.invalidateQueries(['products', data.id])
      }
    }
  }, [socket])
}
```

**Optimistic Updates with Rollback:**
```typescript
// hooks/use-optimistic-product-update.ts
export const useOptimisticProductUpdate = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateProduct,
    onMutate: async (newProduct) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['products', newProduct.id])
      
      // Snapshot previous value
      const previousProduct = queryClient.getQueryData(['products', newProduct.id])
      
      // Optimistically update
      queryClient.setQueryData(['products', newProduct.id], newProduct)
      
      return { previousProduct }
    },
    onError: (err, newProduct, context) => {
      // Rollback on error
      if (context?.previousProduct) {
        queryClient.setQueryData(['products', newProduct.id], context.previousProduct)
      }
      toast.error('Update failed - changes have been reverted')
    },
    onSuccess: (data) => {
      // Broadcast to other users via WebSocket
      socket.send(JSON.stringify({
        type: 'PRODUCT_UPDATED',
        data: data,
        userId: currentUserId
      }))
    }
  })
}
```

### **Performance Optimization**

**Virtual Scrolling for Large Lists:**
```typescript
// components/inventory/virtual-inventory-list.tsx
import { FixedSizeList as List } from 'react-window'

const VirtualInventoryList: React.FC<{ items: Material[] }> = ({ items }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <MaterialCard material={items[index]} />
    </div>
  )

  return (
    <List
      height={600}              // Container height
      itemCount={items.length}
      itemSize={120}            // Height of each item
      overscanCount={5}         // Items to render outside viewport
    >
      {Row}
    </List>
  )
}
```

**Debounced Cost Calculation with Caching:**
```typescript
// hooks/use-cost-calculator.ts
export const useCostCalculator = (productId?: string) => {
  const [materials, setMaterials] = useState<ProductMaterial[]>([])
  const [laborHours, setLaborHours] = useState(0)
  const [cachedTotal, setCachedTotal] = useState<number | null>(null)

  // Debounced calculation to avoid excessive API calls
  const debouncedCalculation = useMemo(
    () => debounce(async (materials: ProductMaterial[], hours: number) => {
      try {
        const result = await api.products.calculateCost(materials, hours)
        setCachedTotal(result.total)
        
        // Cache the result for this product
        if (productId) {
          localStorage.setItem(`cost-cache-${productId}`, JSON.stringify({
            total: result.total,
            timestamp: Date.now(),
            materials: materials,
            laborHours: hours
          }))
        }
      } catch (error) {
        console.error('Cost calculation failed:', error)
      }
    }, 500),
    [productId]
  )

  // Load cached cost on mount
  useEffect(() => {
    if (productId) {
      const cached = localStorage.getItem(`cost-cache-${productId}`)
      if (cached) {
        const { total, timestamp } = JSON.parse(cached)
        // Use cache if less than 5 minutes old
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setCachedTotal(total)
        }
      }
    }
  }, [productId])

  return {
    materials,
    setMaterials,
    laborHours,
    setLaborHours,
    cachedTotal,
    isCalculating: !cachedTotal,
    triggerCalculation: () => debouncedCalculation(materials, laborHours)
  }
}
```

**Progressive Image Loading:**
```typescript
// components/ui/progressive-image.tsx
const ProgressiveImage: React.FC<{
  src: string
  placeholder: string
  alt: string
  className?: string
}> = ({ src, placeholder, alt, className }) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Placeholder/low-res image */}
      <img
        src={placeholder}
        alt={alt}
        className={`transition-opacity duration-300 ${isLoaded ? 'opacity-0' : 'opacity-100'}`}
      />
      
      {/* High-res image */}
      <img
        src={src}
        alt={alt}
        className={`absolute inset-0 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-500">Failed to load image</span>
        </div>
      )}
    </div>
  )
}
```

### **Form State Persistence**

**Auto-save Product Builder:**
```typescript
// hooks/use-form-persistence.ts
export const useFormPersistence = (formKey: string, defaultValues: any) => {
  const form = useForm({ defaultValues })
  
  // Save to localStorage on every change
  useEffect(() => {
    const subscription = form.watch((data) => {
      localStorage.setItem(`form-${formKey}`, JSON.stringify(data))
    })
    return () => subscription.unsubscribe()
  }, [form, formKey])

  // Load saved data on mount
  useEffect(() => {
    const savedData = localStorage.getItem(`form-${formKey}`)
    if (savedData) {
      const parsed = JSON.parse(savedData)
      form.reset(parsed)
      
      // Show restoration message
      toast.info('Previous form data restored')
    }
  }, [formKey])

  // Clear saved data on successful submit
  const clearSavedData = () => {
    localStorage.removeItem(`form-${formKey}`)
  }

  return { form, clearSavedData }
}
```

### **Advanced Validation System**

**Inventory-Aware Validation:**
```typescript
// lib/validations/product-validation.ts
const createProductSchema = (materials: Material[], tenantConfig: TenantConfig) => 
  z.object({
    name: z.string().min(1, "Product name is required"),
    materials: z.array(z.object({
      materialId: z.string(),
      quantityUsed: z.number().positive()
    })).superRefine((productMaterials, ctx) => {
      productMaterials.forEach((prodMat, index) => {
        const material = materials.find(m => m.id === prodMat.materialId)
        if (!material) return

        const availableQty = material.quantityAvailable || 0
        
        if (prodMat.quantityUsed > availableQty) {
          // Hard failure - always block
          if (material.inventoryPolicy === 'HARD_LIMIT') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Insufficient ${material.name}. Available: ${availableQty}, Required: ${prodMat.quantityUsed}`,
              path: [index, 'quantityUsed']
            })
          } 
          // Soft failure - warn but allow override
          else if (material.inventoryPolicy === 'SOFT_LIMIT' && !tenantConfig.allowInventoryOverride) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Warning: Low ${material.name} inventory. Available: ${availableQty}`,
              path: [index, 'quantityUsed']
            })
          }
        }
      })
    })
  })
```

### **Component Architecture Models**

**Material Model System:**
```typescript
// lib/models/material-models.ts
export interface BaseMaterialModel {
  id: string
  name: string
  category: MaterialCategory
  costPerUnit: number
  unit: string
}

export interface InventoryMaterialModel extends BaseMaterialModel {
  quantityAvailable: number
  reorderLevel: number
  supplier: string
  lastRestocked: Date
}

export interface ProductMaterialModel extends BaseMaterialModel {
  quantityUsed: number
  totalCost: number
  alternatives?: string[] // Alternative material IDs
}

export interface MarketMaterialModel extends BaseMaterialModel {
  isRequired: boolean
  displayName: string
  showCost: boolean
}

// Factory functions for different contexts
export const createInventoryMaterial = (data: any): InventoryMaterialModel => ({
  ...data,
  quantityAvailable: data.quantity || 0,
  reorderLevel: data.reorderLevel || 0
})

export const createProductMaterial = (data: any): ProductMaterialModel => ({
  ...data,
  quantityUsed: data.quantityUsed || 0,
  totalCost: (data.quantityUsed || 0) * (data.costPerUnit || 0)
})
```

### **Mobile-First Considerations**

**Craft Fair Product Focus:**
```typescript
// components/mobile/craft-fair-mode.tsx
const CraftFairMode: React.FC = () => {
  return (
    <div className="md:hidden"> {/* Mobile only */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
        <div className="grid grid-cols-3 gap-2">
          <button className="py-3 px-4 bg-green-600 text-white rounded-lg font-medium">
            Quick Sale
          </button>
          <button className="py-3 px-4 bg-blue-600 text-white rounded-lg font-medium">
            Update Price
          </button>
          <button className="py-3 px-4 bg-gray-600 text-white rounded-lg font-medium">
            View Sales
          </button>
        </div>
      </div>
      
      {/* Large, touch-friendly product grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 pb-20">
        {products.map(product => (
          <ProductCardLarge key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
```

### **Mobile & Craft Fair Optimization**

**Read-Only Offline Mode:**
```typescript
// hooks/use-offline-cache.ts
export const useOfflineCache = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [cachedData, setCachedData] = useState<{
    products: Product[]
    materials: Material[]
    lastSync: number
  } | null>(null)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Cache essential data when online
  const cacheEssentialData = async () => {
    if (isOnline) {
      try {
        const [products, materials] = await Promise.all([
          api.products.getAll(),
          api.materials.getAll()
        ])
        
        const essentialData = {
          products: products.map(p => ({
            id: p.id,
            name: p.name,
            salePrice: p.salePrice,
            costToManufacture: p.costToManufacture,
            category: p.category,
            images: p.images.slice(0, 1) // Only first image
          })),
          materials: materials.map(m => ({
            id: m.id,
            name: m.name,
            costPerUnit: m.costPerUnit,
            category: m.category
          })),
          lastSync: Date.now()
        }
        
        localStorage.setItem('craft-fair-cache', JSON.stringify(essentialData))
        setCachedData(essentialData)
      } catch (error) {
        console.error('Failed to cache essential data:', error)
      }
    }
  }

  // Load cached data when offline
  useEffect(() => {
    if (!isOnline) {
      const cached = localStorage.getItem('craft-fair-cache')
      if (cached) {
        setCachedData(JSON.parse(cached))
      }
    }
  }, [isOnline])

  return {
    isOnline,
    cachedData,
    cacheEssentialData,
    isDataStale: cachedData ? Date.now() - cachedData.lastSync > 24 * 60 * 60 * 1000 : false
  }
}
```

**Toggleable WebSocket Connections:**
```typescript
// hooks/use-realtime-settings.ts
export const useRealtimeSettings = () => {
  const [realtimeEnabled, setRealtimeEnabled] = useState(() => {
    const saved = localStorage.getItem('realtime-enabled')
    return saved ? JSON.parse(saved) : true
  })

  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)

  // Monitor battery level
  useEffect(() => {
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setBatteryLevel(battery.level)
        
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level)
          
          // Auto-disable real-time updates when battery is low
          if (battery.level < 0.2 && realtimeEnabled) {
            setRealtimeEnabled(false)
            toast.info('Real-time updates disabled to save battery')
          }
        })
      })
    }
  }, [realtimeEnabled])

  const toggleRealtime = (enabled: boolean) => {
    setRealtimeEnabled(enabled)
    localStorage.setItem('realtime-enabled', JSON.stringify(enabled))
  }

  return {
    realtimeEnabled,
    toggleRealtime,
    batteryLevel,
    showBatteryWarning: batteryLevel !== null && batteryLevel < 0.3
  }
}

// components/craft-fair/realtime-toggle.tsx
const RealtimeToggle: React.FC = () => {
  const { realtimeEnabled, toggleRealtime, batteryLevel, showBatteryWarning } = useRealtimeSettings()

  return (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
      <Switch
        checked={realtimeEnabled}
        onCheckedChange={toggleRealtime}
        disabled={showBatteryWarning}
      />
      <div className="flex-1">
        <label className="text-sm font-medium">Real-time Updates</label>
        <p className="text-xs text-gray-600">
          Sync changes with other users instantly
        </p>
        {showBatteryWarning && (
          <p className="text-xs text-amber-600 mt-1">
            Disabled due to low battery ({Math.round((batteryLevel || 0) * 100)}%)
          </p>
        )}
      </div>
    </div>
  )
}
```

### **Scalability & Performance**

**WebSocket Connection Management (Upsell Feature):**
```typescript
// lib/websocket/connection-manager.ts
class WebSocketManager {
  private connections: Map<string, WebSocket> = new Map()
  private maxConnections = 100 // Free tier limit
  private isProTier = false

  constructor(userTier: 'free' | 'pro' | 'enterprise') {
    this.isProTier = userTier !== 'free'
    this.maxConnections = userTier === 'free' ? 100 : userTier === 'pro' ? 1000 : 10000
  }

  async createConnection(userId: string): Promise<WebSocket | null> {
    if (this.connections.size >= this.maxConnections && !this.isProTier) {
      // Show upsell message for free tier
      toast.info('Upgrade to Pro for unlimited real-time connections')
      return null
    }

    const ws = new WebSocket(`${process.env.NEXT_PUBLIC_WS_URL}?userId=${userId}`)
    this.connections.set(userId, ws)
    
    ws.onclose = () => {
      this.connections.delete(userId)
    }

    return ws
  }

  getConnection(userId: string): WebSocket | null {
    return this.connections.get(userId) || null
  }

  closeConnection(userId: string) {
    const ws = this.connections.get(userId)
    if (ws) {
      ws.close()
      this.connections.delete(userId)
    }
  }
}
```

**Smart Cache Management:**
```typescript
// lib/cache/cache-manager.ts
class CacheManager {
  private maxSizeBytes = 50 * 1024 * 1024 // 50MB limit
  private cachePrefix = 'yarn-crafting-'

  calculateCacheSize(): number {
    let totalSize = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.cachePrefix)) {
        totalSize += localStorage.getItem(key)?.length || 0
      }
    }
    return totalSize
  }

  cleanupOldCache() {
    const cacheEntries: Array<{key: string, timestamp: number, size: number}> = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.cachePrefix)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          cacheEntries.push({
            key,
            timestamp: data.timestamp || 0,
            size: localStorage.getItem(key)?.length || 0
          })
        } catch (error) {
          // Remove corrupted cache entries
          localStorage.removeItem(key)
        }
      }
    }

    // Sort by timestamp (oldest first)
    cacheEntries.sort((a, b) => a.timestamp - b.timestamp)

    // Remove oldest entries until under size limit
    let currentSize = this.calculateCacheSize()
    for (const entry of cacheEntries) {
      if (currentSize <= this.maxSizeBytes) break
      localStorage.removeItem(entry.key)
      currentSize -= entry.size
    }
  }

  setCache(key: string, data: any, ttl = 24 * 60 * 60 * 1000) {
    // Check if adding this entry would exceed limit
    const dataStr = JSON.stringify({
      data,
      timestamp: Date.now(),
      expires: Date.now() + ttl
    })

    if (this.calculateCacheSize() + dataStr.length > this.maxSizeBytes) {
      this.cleanupOldCache()
    }

    localStorage.setItem(this.cachePrefix + key, dataStr)
  }

  getCache(key: string): any | null {
    try {
      const cached = localStorage.getItem(this.cachePrefix + key)
      if (!cached) return null

      const parsed = JSON.parse(cached)
      
      // Check if expired
      if (Date.now() > parsed.expires) {
        localStorage.removeItem(this.cachePrefix + key)
        return null
      }

      return parsed.data
    } catch (error) {
      localStorage.removeItem(this.cachePrefix + key)
      return null
    }
  }
}

export const cacheManager = new CacheManager()
```

**Virtual Scrolling with Real-Time Updates:**
```typescript
// hooks/use-stable-virtual-list.ts
export const useStableVirtualList = (items: any[], itemHeight: number) => {
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const listRef = useRef<HTMLDivElement>(null)

  // Track focused item to maintain position during updates
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const [focusedItemIndex, setFocusedItemIndex] = useState<number>(-1)

  // When items change, try to maintain scroll position
  useEffect(() => {
    if (focusedItemId) {
      const newIndex = items.findIndex(item => item.id === focusedItemId)
      if (newIndex !== -1 && newIndex !== focusedItemIndex) {
        // Item moved, adjust scroll to maintain position
        const scrollDelta = (newIndex - focusedItemIndex) * itemHeight
        const newScrollTop = Math.max(0, scrollTop + scrollDelta)
        
        if (listRef.current) {
          listRef.current.scrollTop = newScrollTop
        }
        setScrollTop(newScrollTop)
        setFocusedItemIndex(newIndex)
      }
    }
  }, [items, focusedItemId, focusedItemIndex, itemHeight, scrollTop])

  // Handle WebSocket updates with stable scrolling
  const handleItemUpdate = useCallback((updatedItem: any) => {
    // Find the item that's currently in view
    const viewportStart = Math.floor(scrollTop / itemHeight)
    const viewportEnd = Math.min(
      viewportStart + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    )

    // If updated item is in viewport, track it to maintain position
    const itemIndex = items.findIndex(item => item.id === updatedItem.id)
    if (itemIndex >= viewportStart && itemIndex <= viewportEnd) {
      setFocusedItemId(updatedItem.id)
      setFocusedItemIndex(itemIndex)
    }
  }, [scrollTop, containerHeight, itemHeight, items])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
    // Clear focus when user manually scrolls
    setFocusedItemId(null)
  }

  return {
    listRef,
    scrollTop,
    containerHeight,
    handleScroll,
    handleItemUpdate,
    setContainerHeight
  }
}
```

### **Data Consistency & Business Logic**

**Stale Price Handling:**
```typescript
// components/product-builder/price-freshness-indicator.tsx
const PriceFreshnessIndicator: React.FC<{
  materials: ProductMaterial[]
  onRefreshPrices: () => void
}> = ({ materials, onRefreshPrices }) => {
  const [priceAges, setPriceAges] = useState<Record<string, number>>({})

  useEffect(() => {
    // Check when each material price was last updated
    const ages: Record<string, number> = {}
    materials.forEach(material => {
      const cached = cacheManager.getCache(`material-price-${material.materialId}`)
      ages[material.materialId] = cached ? Date.now() - cached.timestamp : 0
    })
    setPriceAges(ages)
  }, [materials])

  const hasStalePrice = Object.values(priceAges).some(age => age > 60 * 60 * 1000) // 1 hour
  const oldestPrice = Math.max(...Object.values(priceAges))

  if (!hasStalePrice) return null

  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center space-x-2">
        <AlertTriangle className="w-4 h-4 text-amber-600" />
        <div>
          <p className="text-sm font-medium text-amber-800">
            Material prices may be outdated
          </p>
          <p className="text-xs text-amber-600">
            Last updated {formatDistanceToNow(new Date(Date.now() - oldestPrice))} ago
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRefreshPrices}
        className="border-amber-300 text-amber-700 hover:bg-amber-100"
      >
        Refresh Prices
      </Button>
    </div>
  )
}
```

**Bulk Operations with Tenant Settings:**
```typescript
// hooks/use-bulk-operations.ts
export const useBulkOperations = () => {
  const { data: tenantConfig } = useTenantConfig()
  
  const bulkUpdateMaterials = useMutation({
    mutationFn: async (updates: MaterialUpdate[]) => {
      const results = await api.materials.bulkUpdate(updates, {
        rollbackOnFailure: tenantConfig?.bulkOperationsRollback || false
      })
      return results
    },
    onSuccess: (results) => {
      const { successful, failed } = results
      
      if (failed.length > 0) {
        // Show detailed failure report
        toast.custom((t) => (
          <BulkOperationResult
            successful={successful.length}
            failed={failed}
            onDismiss={() => toast.dismiss(t.id)}
          />
        ), { duration: 10000 })
      } else {
        toast.success(`Successfully updated ${successful.length} materials`)
      }
    }
  })

  return { bulkUpdateMaterials }
}

// components/bulk-operations/bulk-operation-result.tsx
const BulkOperationResult: React.FC<{
  successful: number
  failed: Array<{item: any, error: string}>
  onDismiss: () => void
}> = ({ successful, failed, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-gray-900">Bulk Operation Complete</h3>
          <p className="text-sm text-gray-600 mt-1">
            {successful} successful, {failed.length} failed
          </p>
        </div>
        <button onClick={onDismiss} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {failed.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showDetails ? 'Hide' : 'Show'} error details
          </button>
          
          {showDetails && (
            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
              {failed.map((failure, index) => (
                <div key={index} className="text-xs bg-red-50 p-2 rounded border">
                  <p className="font-medium text-red-800">{failure.item.name}</p>
                  <p className="text-red-600">{failure.error}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```
```typescript
// components/error-boundaries/calculator-error-boundary.tsx
class CalculatorErrorBoundary extends React.Component {
  state = { hasError: false, error: null }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-medium text-red-800">Cost Calculator Error</h3>
          <p className="text-red-600 mt-1">
            Unable to calculate costs. Please refresh or contact support.
          </p>
          <button 
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Retry
          </button>
        </div>
      )
    }
    
    return this.props.children
  }
}
```

## **Technical Implementation Notes**

**No Offline Mode**: All operations require internet connectivity
**No Custom Gestures**: Relying on standard web interactions only  
**Accessibility**: Will be addressed in future phases

### **Error Boundary Considerations**

While you mentioned errors should be simple due to strong typing, here are some **additional scenarios** to consider:

**Network-Related Errors:**
- **Cost API timeouts** during complex calculations with many materials
- **WebSocket disconnections** during real-time updates
- **Image upload failures** for product photos
- **Concurrent edit conflicts** when multiple users edit the same product

**Data Consistency Issues:**
- **Stale material pricing** when costs change during product creation
- **Inventory race conditions** when materials are consumed by multiple products simultaneously
- **Currency/decimal precision** errors in cost calculations
- **Large dataset pagination** failures with virtual scrolling

**User Input Edge Cases:**
- **Invalid material combinations** (e.g., incompatible yarn weights)
- **Circular dependencies** in material alternatives
- **Bulk import validation** failures for CSV material uploads
- **Form state corruption** during auto-save operations

**Recommended Error Boundary Strategy:**
```typescript
// Separate error boundaries for different functional areas
<ProductBuilderErrorBoundary>
  <CostCalculatorErrorBoundary>
    <CostCalculator />
  </CostCalculatorErrorBoundary>
  
  <MaterialSelectorErrorBoundary>
    <MaterialSelector />
  </MaterialSelectorErrorBoundary>
</ProductBuilderErrorBoundary>
```

This allows **granular error isolation** - if the cost calculator fails, the material selector continues working, and users can still save their progress.

### **1. Product Management Components**

**Product Card:**
```typescript
interface ProductCardProps {
  product: Product
  onEdit: (product: Product) => void
  onDuplicate: (product: Product) => void
  onDelete: (id: string) => void
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDuplicate, onDelete }) => {
  const profitMargin = ((product.salePrice - product.costToManufacture) / product.salePrice) * 100

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          <ProductImage 
            src={product.images[0]} 
            alt={product.name}
            className="w-16 h-16 object-cover rounded"
          />
          <div>
            <h3 className="font-medium">{product.name}</h3>
            <p className="text-sm text-gray-500">{product.category}</p>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="outline">{product.pattern?.name}</Badge>
              <Badge variant="secondary">{product.difficulty}</Badge>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="font-medium">${product.salePrice}</p>
          <p className="text-sm text-gray-500">Cost: ${product.costToManufacture}</p>
          <p className="text-xs text-green-600">+{profitMargin.toFixed(1)}% margin</p>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2 mt-3 pt-3 border-t">
        <Button size="sm" variant="outline" onClick={() => onEdit(product)}>
          Edit
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDuplicate(product)}>
          Duplicate
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onDelete(product.id)}>
          Delete
        </Button>
      </div>
    </Card>
  )
}
```

### **2. Product Builder/Editor Component**

```typescript
const ProductBuilder: React.FC = () => {
  const { data: materials } = useMaterials()
  const [product, setProduct] = useState<CreateProductDto>({
    name: '',
    category: '',
    description: '',
    materials: [],
    laborHours: 0,
    images: []
  })

  const { data: user } = useUser()
  const laborCost = product.laborHours * (user?.laborRate || 25)
  
  const materialCost = useMemo(() => 
    product.materials.reduce((sum, mat) => {
      const material = materials?.find(m => m.id === mat.materialId)
      return sum + (mat.quantityUsed * (material?.costPerUnit || 0))
    }, 0)
  , [product.materials, materials])

  const totalCostToManufacture = materialCost + laborCost

  const handleAddMaterial = (materialId: string, quantity: number) => {
    setProduct(prev => ({
      ...prev,
      materials: [
        ...prev.materials.filter(m => m.materialId !== materialId),
        { materialId, quantityUsed: quantity }
      ]
    }))
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Product Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Product Name"
            value={product.name}
            onChange={(e) => setProduct(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Amigurumi Teddy Bear"
          />
          <Select
            label="Category"
            value={product.category}
            onValueChange={(value) => setProduct(prev => ({ ...prev, category: value }))}
          >
            <SelectItem value="amigurumi">Amigurumi</SelectItem>
            <SelectItem value="blankets">Blankets</SelectItem>
            <SelectItem value="clothing">Clothing</SelectItem>
            <SelectItem value="accessories">Accessories</SelectItem>
          </Select>
        </div>
        
        <Textarea
          label="Description"
          value={product.description}
          onChange={(e) => setProduct(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Product description for customers..."
          className="mt-4"
        />
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Materials & Components</h3>
        <MaterialSelector 
          materials={materials}
          selected={product.materials}
          onAddMaterial={handleAddMaterial}
          onRemoveMaterial={(materialId) => 
            setProduct(prev => ({
              ...prev,
              materials: prev.materials.filter(m => m.materialId !== materialId)
            }))
          }
        />
      </Card>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Labor & Costing</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            type="number"
            label="Hours to Make"
            value={product.laborHours}
            onChange={(e) => setProduct(prev => ({ ...prev, laborHours: parseFloat(e.target.value) || 0 }))}
            placeholder="0.0"
          />
          <div className="space-y-1">
            <label className="text-sm font-medium">Hourly Rate</label>
            <p className="text-lg font-semibold">${user?.laborRate || 25}/hr</p>
            <Button variant="link" size="sm">Update in Settings</Button>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Labor Cost</label>
            <p className="text-lg font-semibold text-blue-600">${laborCost.toFixed(2)}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-gray-50">
        <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span>Materials Cost:</span>
            <span className="font-medium">${materialCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Labor Cost:</span>
            <span className="font-medium">${laborCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold border-t pt-2">
            <span>Total Cost to Manufacture:</span>
            <span className="text-green-600">${totalCostToManufacture.toFixed(2)}</span>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <PricingSuggestions costToManufacture={totalCostToManufacture} />
        </div>
      </Card>
    </div>
  )
}
```

### **3. Materials Selector Component**

```typescript
interface MaterialSelectorProps {
  materials?: Material[]
  selected: ProductMaterial[]
  onAddMaterial: (materialId: string, quantity: number) => void
  onRemoveMaterial: (materialId: string) => void
}

const MaterialSelector: React.FC<MaterialSelectorProps> = ({
  materials = [],
  selected,
  onAddMaterial,
  onRemoveMaterial
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filteredMaterials = materials.filter(material => {
    const matchesSearch = material.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || material.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ['all', 'yarn', 'eyes', 'clasps', 'stuffing', 'other']

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search materials..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          {categories.map(cat => (
            <SelectItem key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </SelectItem>
          ))}
        </Select>
      </div>

      {/* Selected Materials */}
      {selected.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700">Selected Materials:</h4>
          {selected.map(selectedMaterial => {
            const material = materials.find(m => m.id === selectedMaterial.materialId)
            if (!material) return null
            
            return (
              <div key={material.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <MaterialIcon type={material.category} />
                  <div>
                    <span className="font-medium">{material.name}</span>
                    <p className="text-sm text-gray-600">
                      {selectedMaterial.quantityUsed} {material.unit} × ${material.costPerUnit}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">
                    ${(selectedMaterial.quantityUsed * material.costPerUnit).toFixed(2)}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveMaterial(material.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Available Materials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredMaterials
          .filter(material => !selected.some(s => s.materialId === material.id))
          .map(material => (
            <MaterialCard
              key={material.id}
              material={material}
              onAdd={(quantity) => onAddMaterial(material.id, quantity)}
            />
          ))}
      </div>
    </div>
  )
}
```

## **API Integration Layer**

### **API Client Setup**
```typescript
// lib/api/client.ts
class ApiClient {
  private baseUrl: string
  private token?: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL!
  }

  setToken(token: string) {
    this.token = token
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options?.headers,
    }

    const response = await fetch(url, { ...options, headers })
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  // Primary API methods - Products focused
  products = {
    getAll: (filters?: ProductFilters) => this.request<Product[]>(`/products${filters ? '?' + new URLSearchParams(filters) : ''}`),
    getById: (id: string) => this.request<Product>(`/products/${id}`),
    create: (data: CreateProductDto) => this.request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    update: (id: string, data: UpdateProductDto) => this.request<Product>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    }),
    delete: (id: string) => this.request<void>(`/products/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) => this.request<Product>(`/products/${id}/duplicate`, { method: 'POST' }),
    calculateCost: (materials: ProductMaterial[], laborHours: number) => 
      this.request<CostCalculation>('/products/calculate-cost', {
        method: 'POST',
        body: JSON.stringify({ materials, laborHours })
      })
  }

  // Supporting materials API
  materials = {
    getAll: () => this.request<Material[]>('/materials'),
    getYarn: () => this.request<Yarn[]>('/materials/yarn'),
    getComponents: () => this.request<Component[]>('/materials/components'),
    create: (data: CreateMaterialDto) => this.request<Material>('/materials', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    bulkImport: (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      return this.request<BulkImportResult>('/materials/bulk-import', {
        method: 'POST',
        body: formData,
        headers: {} // Let browser set Content-Type for FormData
      })
    }
  }

  // Market and sales API  
  markets = {
    getEvents: () => this.request<MarketEvent[]>('/markets/events'),
    generateSheet: (data: MarketSheetRequest) => this.request<Blob>('/markets/sheet', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    exportProducts: (format: 'shopify' | 'square' | 'etsy', productIds: string[]) =>
      this.request<ExportResult>(`/markets/export/${format}`, {
        method: 'POST',
        body: JSON.stringify({ productIds })
      })
  }
}

export const api = new ApiClient()
```

## **Responsive Design Strategy**

### **Breakpoint System**
```typescript
// Mobile-first approach
const breakpoints = {
  sm: '640px',   // Small tablets
  md: '768px',   // Tablets
  lg: '1024px',  // Desktops
  xl: '1280px',  // Large desktops
}
```

### **Mobile-Optimized Components**
- **Touch-friendly** buttons and form inputs
- **Swipe gestures** for product cards and tables
- **Collapsible sidebar** navigation
- **Stack layouts** for mobile inventory cards
- **Bottom sheet modals** for mobile actions

## **Performance Optimizations**

### **Data Loading**
- **React Query** for caching and background updates
- **Infinite scrolling** for large inventory lists
- **Optimistic updates** for user actions
- **Image optimization** with Next.js Image component

### **Bundle Optimization**
- **Dynamic imports** for heavy components
- **Tree shaking** for unused dependencies
- **Code splitting** by route and feature

## **Development Workflow**

### **Component Development**
1. **Storybook** for isolated component development
2. **TypeScript** strict mode for type safety
3. **Unit tests** for business logic components
4. **Integration tests** for key user flows

### **API Integration**
1. **Mock API** responses during development
2. **Error boundary** components for graceful failures
3. **Loading states** for all async operations
4. **Retry logic** for failed requests

### **Deployment Pipeline**
1. **Vercel** for frontend hosting (or DigitalOcean Apps)
2. **Preview deployments** for PR reviews
3. **Environment-specific** configurations
4. **Performance monitoring** with Core Web Vitals

## **Next Steps**

### **Phase 1: Core MVP (Weeks 1-3)**
1. **Setup project** with Next.js 15.4 and TypeScript
2. **Configure Tailwind v4** and shadcn/ui components  
3. **Implement theme system** with 5 predefined color themes
   - Theme definitions and CSS custom properties setup
   - Theme selector component for user settings
   - Craft-specific color schemes (yarn types, cost indicators)
4. **Implement custom authentication** with JWT tokens
5. **Build core layouts** and navigation with theme support
6. **Create product management** components (PRIMARY focus)
   - Product builder/editor with form persistence
   - Product gallery/list with virtual scrolling  
   - Cost calculator with debouncing and caching
   - Theme-aware yarn and cost color coding

### **Phase 2: Performance & Mobile (Weeks 4-5)**
6. **Add materials management** (supporting product creation)
   - Material selector with inventory validation
   - Virtual scrolling for large lists
   - Smart cache management (50MB limit)
7. **Integrate with backend** API (products + materials)
8. **Implement offline mode** for craft fair price viewing
9. **Add battery optimization** with toggleable real-time updates

### **Phase 3: Advanced Features (Weeks 6-8)**
10. **Add WebSocket integration** for real-time sync
11. **Implement market features**
    - Market sheet generation with stale price warnings
    - Product pricing tools
    - Bulk operations with tenant settings
12. **Add export functionality** for sales platforms
13. **Create craft fair mobile mode** with large touch targets

### **Phase 4: Scaling & Optimization (Weeks 9-10)**
14. **Implement connection pooling** (upsell feature)
15. **Add comprehensive error boundaries** 
16. **Mobile optimization** and performance tuning
17. **Cache cleanup strategies** and monitoring

**Development Priority**: Focus on product creation and management first, then layer on performance optimizations and real-time features. The architecture supports both immediate MVP needs and long-term scalability for hundreds of concurrent users.