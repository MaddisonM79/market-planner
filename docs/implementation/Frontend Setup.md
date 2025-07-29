# Frontend Setup - Market Manager

## 🎯 **Overview**

The frontend is built with Next.js 15.4.4, React 19.1.0, and a modern TypeScript stack focused on product-centric craft inventory management.

## 📦 **Technology Stack**

### **Core Framework**
- **Next.js 15.4.4** - App Router with React 19 support
- **React 19.1.0** - Latest with Server Components and new hooks
- **TypeScript 5+** - Full type safety
- **Tailwind CSS 3.4+** - Utility-first styling

### **State Management**
- **Zustand 4.4.7** - Lightweight global state
- **TanStack Query 5.17.0** - Server state with caching
- **React Hook Form 7.48.2** - Form state management

### **Validation & Types**
- **Zod 3.22.4** - Schema validation
- **@hookform/resolvers 3.3.2** - Form validation integration

### **UI & Animation**
- **Motion 12.23.11** - Animation library (formerly Framer Motion)
- **Radix UI** - Headless component primitives
- **Lucide React** - Icon library
- **Shadcn/ui** - Component system


## 🏗️ **Project Structure**

```
frontend/src/
├── app/                          # Next.js App Router
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
├── components/                   # Reusable UI components  
│   ├── ui/                       # Base UI components (shadcn)
│   ├── products/                 # Product-specific components
│   ├── materials/                # Material management components
│   ├── markets/                  # Sales & market components
│   ├── forms/                    # Form components
│   ├── tables/                   # Data table components
│   ├── modals/                   # Modal components
│   └── layout/                   # Layout components
├── stores/                       # Zustand stores
│   ├── index.ts                  # Store exports
│   ├── product-store.ts          # Product state management
│   ├── materials-store.ts        # Materials inventory state
│   └── user-store.ts             # User preferences
├── hooks/                        # Custom React hooks
│   └── api/                      # TanStack Query API hooks
│       ├── index.ts              # Hook exports
│       ├── use-products.ts       # Product API operations
│       └── use-materials.ts      # Materials API operations
├── lib/                          # Utilities and configurations
│   ├── api/                      # API client setup
│   ├── auth/                     # Authentication config
│   ├── utils/                    # Helper functions
│   ├── constants/                # App constants
│   └── validations/              # Zod schemas
│       ├── index.ts              # Schema exports
│       ├── product.ts            # Product validation schemas
│       └── material.ts           # Material validation schemas
├── types/                        # TypeScript type definitions
└── styles/                       # Additional styling
```

## 🗄️ **State Management Architecture**

### **Zustand Stores**

**Product Store** (`stores/product-store.ts`):
```typescript
interface ProductStore {
  products: Product[]
  selectedProduct: Product | null
  isLoading: boolean
  error: string | null
  // CRUD operations + selection
}
```

**Materials Store** (`stores/materials-store.ts`):
```typescript
interface MaterialsStore {
  materials: Material[]
  selectedMaterials: string[]  // Multi-select support
  filters: FilterOptions
  // CRUD + filtering + selection
}
```

**User Store** (`stores/user-store.ts`):
```typescript
interface UserStore {
  user: User | null
  preferences: UserPreferences  // Persistent settings
  // User management + preferences
}
```

## 🔌 **API Integration**

### **TanStack Query Hooks**

**Product Operations:**
```typescript
// Get all products
const { data: products, isLoading } = useProducts()

// Get single product
const { data: product } = useProduct(productId)

// Create product
const createProduct = useCreateProduct()

// Update product
const updateProduct = useUpdateProduct()

// Delete product
const deleteProduct = useDeleteProduct()
```

**Materials Operations:**
```typescript
// Get all materials
const { data: materials } = useMaterials()

// Get materials by type
const { data: yarns } = useMaterialsByType('yarn')

// CRUD operations
const createMaterial = useCreateMaterial()
const updateMaterial = useUpdateMaterial()
const deleteMaterial = useDeleteMaterial()
```

## ✅ **Validation Schemas**

### **Product Schema** (`lib/validations/product.ts`):
```typescript
const ProductSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  materials: z.array(z.string().cuid()).min(1),
  laborTimeMinutes: z.number().min(0).max(10080),
  costToManufacture: z.number().min(0),
  suggestedPrice: z.number().min(0)
})
```

### **Material Schema** (`lib/validations/material.ts`):
```typescript
const MaterialSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['yarn', 'component', 'supply']),
  costPerUnit: z.number().min(0),
  unit: z.string().min(1).max(20),
  quantityInStock: z.number().min(0),
  lowStockThreshold: z.number().min(0).optional()
})
```

## 🎨 **Component Architecture**

### **Planned Component Structure**

**Product Components:**
- `ProductCard` - Product display cards
- `ProductBuilder` - Step-by-step product creation
- `CostCalculator` - Real-time cost calculations
- `PricingSuggestions` - AI-powered pricing recommendations

**Material Components:**
- `MaterialSelector` - Multi-select material picker
- `YarnCard` - Yarn-specific inventory cards
- `ComponentCard` - Component inventory display

**Market Components:**
- `MarketSheetGenerator` - Generate market price sheets
- `ExportWizard` - CSV export for platforms
- `PricingCalculator` - Profit margin calculator

## 🚀 **Development Workflow**

### **Getting Started**

1. **Install Dependencies:**
   ```bash
   cd frontend/
   npm install
   ```

2. **Start Development:**
   ```bash
   # Via Docker (recommended)
   npm run docker:dev:up
   
   # Or locally
   npm run dev
   ```

3. **Access Application:**
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:3001/api

### **Adding New Features**

**1. Create Zod Schema:**
```typescript
// lib/validations/new-feature.ts
export const NewFeatureSchema = z.object({
  // Define validation rules
})
```

**2. Create Store:**
```typescript
// stores/new-feature-store.ts
export const useNewFeatureStore = create<NewFeatureStore>()({
  // Define state and actions
})
```

**3. Create API Hooks:**
```typescript
// hooks/api/use-new-feature.ts
export const useNewFeature = () => {
  return useQuery({
    queryKey: ['new-feature'],
    queryFn: api.getNewFeature
  })
}
```

**4. Create Components:**
```typescript
// components/new-feature/new-feature-card.tsx
export function NewFeatureCard() {
  const { data } = useNewFeature()
  const store = useNewFeatureStore()
  // Component logic
}
```

## 🔧 **Configuration**

### **Environment Variables**
```bash
# Frontend-specific variables
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
```

### **TypeScript Configuration**
Path aliases configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## 📋 **Code Standards**

### **File Naming**
- Components: `PascalCase.tsx`
- Hooks: `use-kebab-case.ts`
- Stores: `kebab-case-store.ts`
- Types: `kebab-case.ts`

### **Import Organization**
```typescript
// 1. React/Next.js imports
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. External library imports
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'

// 3. Internal imports
import { useProductStore } from '@/stores'
import { ProductSchema } from '@/lib/validations'
```

### **Component Structure**
```typescript
// 1. Type definitions
interface ComponentProps {
  // Props definition
}

// 2. Component definition
export function Component({ prop }: ComponentProps) {
  // 3. Hooks
  const store = useStore()
  const { data } = useQuery()
  
  // 4. Event handlers
  const handleClick = () => {}
  
  // 5. Render
  return <div>Component content</div>
}
```

## 🎯 **Next Steps**

**Immediate Development Priorities:**
1. **Product Management UI** - Core product CRUD interface
2. **Materials Inventory** - Yarn and component management
3. **Cost Calculator** - Real-time cost calculation components
4. **Form Components** - Reusable form building blocks
5. **Data Tables** - Sortable, filterable inventory displays

**Component Development Order:**
1. Base UI components (buttons, inputs, modals)
2. Product management components
3. Materials inventory components
4. Cost calculation components
5. Market and export components

**Integration Points:**
- API endpoints from NestJS backend
- Real-time updates via WebSocket (future)
- Authentication system to be implemented
- Database operations via API layer

The frontend foundation is complete and ready for component development!