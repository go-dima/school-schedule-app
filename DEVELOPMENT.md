# Development Guide

## Development Environment Setup

### System Requirements
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Git
- Text editor with TypeScript support (VS Code recommended)

### Initial Setup

1. **Clone the Project**
   ```bash
   git clone <repository-url>
   cd school-schedule
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Create Environment File**
   ```bash
   cp .env.example .env.local
   ```
   Edit the file with your actual Supabase details.

4. **Setup Supabase**
   - Create new project at [Supabase](https://supabase.com)
   - Copy URL and key to `.env.local`
   - Run migrations to set up database (see Database Migrations section below)

## Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run storybook    # Storybook for component development

# Build and Testing
npm run build        # Build the application
npm run preview      # Preview production build
npm run test         # Run tests
npm run lint         # Check code quality

# Storybook
npm run build-storybook  # Build Storybook for production

# Database Migrations
npm run migrate          # Check migration status and get instructions
npm run migrate:status   # Show current migration status
```

## Database Migrations

The application uses a custom migration system to manage database schema changes. All migrations are located in the `migrations/` folder at the project root.

### Migration Structure

```
migrations/
├── migrations.json                 # Migration manifest with metadata
├── 001_initial_schema.sql         # Core database schema
├── 002_rls_policies.sql           # Row Level Security policies
├── 003_triggers_functions.sql     # Database triggers and functions
└── 004_sample_data.sql            # Sample data and initial time slots
```

### Running Migrations

1. **Check Migration Status**
   ```bash
   npm run migrate:status
   ```
   This shows which migrations have been applied and which are pending.

2. **Get Migration Instructions**
   ```bash
   npm run migrate
   ```
   This displays detailed instructions for running pending migrations manually.

3. **Manual Migration Process**
   - Open your Supabase project's SQL Editor
   - Run each pending migration file in order:
     1. `001_initial_schema.sql` - Creates tables and basic structure
     2. `002_rls_policies.sql` - Sets up security policies
     3. `003_triggers_functions.sql` - Adds database functions
     4. `004_sample_data.sql` - Populates initial data

### Migration Dependencies

The migrations have built-in dependency tracking:
- Each migration declares its dependencies in `migrations.json`
- The system ensures migrations run in the correct order
- Circular dependencies are detected and prevented

### Creating New Migrations

When adding new features that require database changes:

1. **Create Migration File**
   ```bash
   # Example: 005_add_new_feature.sql
   touch migrations/005_add_new_feature.sql
   ```

2. **Update migrations.json**
   ```json
   {
     "migrations": [
       {
         "id": "005",
         "name": "Add New Feature",
         "description": "Adds new tables and columns for feature X",
         "file": "005_add_new_feature.sql",
         "created_at": "2024-01-01T00:00:00Z",
         "dependencies": ["004"]
       }
     ]
   }
   ```

3. **Write SQL**
   ```sql
   -- 005_add_new_feature.sql
   -- Add new feature tables and columns
   
   CREATE TABLE IF NOT EXISTS public.new_feature (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     name TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
   );
   
   -- Enable RLS
   ALTER TABLE public.new_feature ENABLE ROW LEVEL SECURITY;
   
   -- Add policies
   CREATE POLICY "Users can view new_feature" ON public.new_feature
   FOR SELECT USING (true);
   ```

### Migration Best Practices

- **Always backup** your database before running migrations in production
- **Test migrations** on a copy of production data
- **Keep migrations atomic** - each migration should be self-contained
- **Use transactions** when possible to ensure consistency
- **Document changes** in migration descriptions
- **Never modify existing migrations** that have been applied

### Sample Data

The `004_sample_data.sql` migration includes:
- Initial time slots from the school's schedule
- Sample users with different roles
- Example classes for demonstration

This data is helpful for development but should be removed or replaced for production deployments.

### Troubleshooting Migrations

**Migration tracking table missing:**
```sql
-- Run this in Supabase SQL Editor to create the tracking table
CREATE TABLE IF NOT EXISTS public.migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

**Permission errors:**
- Ensure your Supabase user has sufficient permissions
- Check that RLS policies allow the current user to run migrations

**Dependency errors:**
- Verify that prerequisite migrations have been applied
- Check the `migrations.json` file for correct dependency declarations

## Architecture and Conventions

### File Structure
- **PascalCase** for components and pages (`ScheduleTable.tsx`)
- **camelCase** for functions, hooks, and variables (`useAuth`, `handleClick`)
- **kebab-case** for CSS files (`schedule-table.css`)

### Writing Components

#### Typical Functional Component
```typescript
import React from 'react'
import { Button } from 'antd'
import './MyComponent.css'

interface MyComponentProps {
  title: string
  onClick: () => void
  disabled?: boolean
}

const MyComponent: React.FC<MyComponentProps> = ({ 
  title, 
  onClick, 
  disabled = false 
}) => {
  return (
    <div className="my-component">
      <Button 
        type="primary" 
        onClick={onClick} 
        disabled={disabled}
      >
        {title}
      </Button>
    </div>
  )
}

export default MyComponent
```

### Custom Hooks
```typescript
// hooks/useMyHook.ts
import { useState, useEffect } from 'react'

export function useMyHook(initialValue: string) {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Logic here...

  return { value, setValue, loading, error }
}
```

### Services
- All API calls in service layer
- Consistent error handling
- Well-defined TypeScript types

```typescript
// services/myService.ts
import { supabase } from './supabase'
import type { MyDataType } from '../types'

export const myService = {
  async getData(): Promise<MyDataType[]> {
    const { data, error } = await supabase
      .from('my_table')
      .select('*')

    if (error) throw new ApiError(error.message)
    return data
  }
}
```

## Working with Storybook

### Creating New Stories
```typescript
// stories/MyComponent.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import MyComponent from '../components/MyComponent'

const meta: Meta<typeof MyComponent> = {
  title: 'Components/MyComponent',
  component: MyComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Click here',
    onClick: () => console.log('clicked!'),
  },
}
```

## Testing

### Unit Tests
```typescript
// __tests__/MyComponent.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import MyComponent from '../components/MyComponent'

describe('MyComponent', () => {
  test('renders correctly', () => {
    const mockOnClick = vi.fn()
    
    render(
      <MyComponent 
        title="Test Title" 
        onClick={mockOnClick} 
      />
    )
    
    expect(screen.getByText('Test Title')).toBeInTheDocument()
  })
})
```

### Service Tests
```typescript
// __tests__/services/api.test.ts
import { describe, test, expect, beforeEach } from 'vitest'
import { myService } from '../services/myService'

describe('MyService', () => {
  test('fetches data correctly', async () => {
    const result = await myService.getData()
    expect(Array.isArray(result)).toBe(true)
  })
})
```

## Styling and RTL

### CSS and RTL
- Use CSS logical properties when possible
- `margin-inline-start` instead of `margin-right`
- `text-align: start` instead of `text-align: right`

```css
/* Good - uses logical properties */
.my-component {
  margin-inline-start: 16px;
  text-align: start;
  border-inline-end: 1px solid #d9d9d9;
}

/* Less ideal - RTL specific */
.my-component {
  margin-right: 16px;
  text-align: right;
  border-left: 1px solid #d9d9d9;
}
```

### Ant Design and RTL
- All components configured with `direction="rtl"` in ConfigProvider
- Use Hebrew locale (`heIL`)
- Always check components look good in RTL

## State Management

### Local State
Use `useState` for local component state:
```typescript
const [loading, setLoading] = useState(false)
```

### Global State
Use Context API for global state:
```typescript
// contexts/MyContext.tsx
const MyContext = createContext<MyContextType | undefined>(undefined)

export function MyProvider({ children }: { children: ReactNode }) {
  // State logic here
  return (
    <MyContext.Provider value={contextValue}>
      {children}
    </MyContext.Provider>
  )
}
```

### Server State
Use custom hooks with Supabase:
```typescript
const { data, loading, error } = useSchedule(userId)
```

## Working with TypeScript

### Defining Types
```typescript
// types/index.ts
export interface User {
  id: string
  email: string
  createdAt: string
}

export type UserRole = 'admin' | 'parent' | 'child' | 'staff'

// Union types for defined states
export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
```

### Generic Types
```typescript
interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

// Usage
const response: ApiResponse<User[]> = await api.getUsers()
```

## Working with Supabase

### Row Level Security
Every query must consider RLS policies:
```typescript
// ❌ Not good - not secure
const { data } = await supabase
  .from('users')
  .select('*')

// ✅ Good - relies on RLS
const { data } = await supabase
  .from('users')
  .select('*')
  .eq('id', userId) // RLS ensures user only sees themselves
```

### Real-time Subscriptions
```typescript
useEffect(() => {
  const subscription = supabase
    .channel('schedule_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'classes' },
      (payload) => {
        // Handle real-time updates
      }
    )
    .subscribe()

  return () => {
    subscription.unsubscribe()
  }
}, [])
```

## Optimization and Performance

### Code Splitting
```typescript
// Lazy loading pages
const SchedulePage = lazy(() => import('./pages/SchedulePage'))
```

### Memoization
```typescript
// Components
const MemoizedComponent = memo(MyComponent)

// Computed values
const expensiveValue = useMemo(() => {
  return heavyCalculation(data)
}, [data])

// Functions
const handleClick = useCallback(() => {
  // Handle click
}, [dependency])
```

## Debugging

### React DevTools
Install React Developer Tools for inspecting state and props.

### Supabase Debugging
```typescript
// Add logging to queries
const { data, error } = await supabase
  .from('table')
  .select('*')

console.log('Supabase query:', { data, error })
```

### Network Debugging
Use Network tab in browser to inspect API calls.

## Best Practices

### Performance
- Use React.memo for heavy components
- Lazy load pages not needed immediately
- Optimize images and static files

### Accessibility
- Use semantic HTML
- Add alt texts to images
- Ensure keyboard navigation
- Check contrast ratios

### Security
- Don't expose API keys in client code
- Use RLS to protect data
- Validate all user input

### Code Quality
- Write tests for all new functionality
- Use strict TypeScript types
- Follow ESLint rules
- Add comments to complex code

## Common Issues and Solutions

### Supabase Connection Issues
```bash
# Check that keys are correct
echo $VITE_SUPABASE_URL
echo $VITE_SUPABASE_ANON_KEY
```

### Build Errors
```bash
# Clear cache and node_modules
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
- Ensure all imports are correct
- Check that types are defined
- Use `npm run typecheck` for full check

---

Remember: Good development takes time and patience. Use the tools available to you and don't hesitate to ask questions!