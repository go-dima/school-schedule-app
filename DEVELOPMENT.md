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
npm run test:visual  # Visual diff of every Storybook story against main (needs Docker)

# Storybook
npm run build-storybook  # Build Storybook for production

# Database Migrations
npm run migrate          # Check migration status and get instructions
npm run migrate:status   # Show current migration status
```

### Pre-commit hook

The hook runs `lint-staged` (see `lint-staged.config.js`). For staged `.ts` and `.tsx` files it runs `prettier --write`, then `eslint --fix --max-warnings 0 --report-unused-disable-directives`. A warning blocks the commit, the same as `npm run lint`. Fixable problems are fixed first and do not block.

- Files that ESLint ignores get prettier only. To ignore a new path, add it to `ignorePatterns` in `.eslintrc.json`. Do not add it to the hook.
- The hook checks staged files only. A rule that depends on other files is not re-checked on files that did not change.
- `git commit --no-verify` bypasses the hook.

## Database Migrations

The application uses a custom migration system to manage database schema changes. All migrations are located in the `migrations/` folder at the project root.

### Migration Structure

```
migrations/
├── migrations.json                 # Migration manifest with metadata
├── 001_initial_schema.sql         # Core database schema
├── 002_rls_policies.sql           # Row Level Security policies
├── 003_triggers_functions.sql     # Database triggers and functions
├── 004_sample_data.sql            # Sample data and initial time slots
└── ...                             # See migrations/ for the current full list
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
   - Run each pending migration file from `migrations/` in numeric order (see `migrations/migrations.json` for the full, current list and descriptions)

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
import { useState, useEffect } from "react";

export function useMyHook(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Logic here...

  return { value, setValue, loading, error };
}
```

### Services

- All API calls in service layer
- Consistent error handling
- Well-defined TypeScript types

```typescript
// services/myService.ts
import { supabase } from "./supabase";
import type { MyDataType } from "../types";

export const myService = {
  async getData(): Promise<MyDataType[]> {
    const { data, error } = await supabase.from("my_table").select("*");

    if (error) throw new ApiError(error.message);
    return data;
  },
};
```

## Working with Storybook

### Creating New Stories

```typescript
// stories/MyComponent.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import MyComponent from "../components/MyComponent";

const meta: Meta<typeof MyComponent> = {
  title: "Components/MyComponent",
  component: MyComponent,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Click here",
    onClick: () => console.log("clicked!"),
  },
};
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
import { describe, test, expect, beforeEach } from "vitest";
import { myService } from "../services/myService";

describe("MyService", () => {
  test("fetches data correctly", async () => {
    const result = await myService.getData();
    expect(Array.isArray(result)).toBe(true);
  });
});
```

### Visual diff

`npm run test:visual` shows which Storybook stories look different on your branch than on `main`. It is separate from `npm test`, and a green visual run does not replace `npm test`. Run it before and after a refactor that must not change how the app looks.

**Needs:** Docker running, and `npm ci` done (it installs the pinned `@playwright/test`).

**What it does**

1. Builds Storybook for the base ref (default `main`) in a temporary git worktree outside the repo, with that ref's own lockfile and `.storybook` config.
2. Builds Storybook for your working tree, uncommitted changes included.
3. Starts the pinned Playwright container and screenshots every story at 1280x800 and 375x812. A story tagged `visual-mobile` is shot only at 375x812, one tagged `visual-desktop` only at 1280x800.
4. Compares the images and prints a summary. Nothing is committed.

The browser clock is frozen, the timezone is `Asia/Jerusalem`, animations are off and `Math.random` is seeded. Any request that leaves localhost is blocked and fails the run.

**Flags** (pass them after `--`: `npm run test:visual -- --base my-branch`)

| Flag              | Effect                                                                           |
| ----------------- | -------------------------------------------------------------------------------- |
| `--base <ref>`    | Compare with this ref instead of `main`. Use the parent branch for a stacked PR. |
| `--fresh`         | Ignore the cache and rebuild the base.                                           |
| `--open`          | Open the HTML report even when nothing changed.                                  |
| `--allow-removed` | Do not fail on removed stories (for example after a deliberate rename).          |

**Exit codes**

| Code | Meaning                                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | No changed or removed stories. New stories are allowed.                                                                                                             |
| 1    | At least one story changed or was removed. The HTML report opens with base, branch and diff images.                                                                 |
| 2    | Infrastructure error: Docker is not running, the base ref is missing, a build failed, a story shows Storybook's error screen, or a story requested an external URL. |

**Reading the result.** The summary counts changed, new, removed and unstable stories. A renamed story is one removed plus one new. An unstable story gave two different images on the base side, so it is listed but cannot fail the run: run again. The HTML report is in `visual-report/` (reopen it with `npx playwright show-report visual-report`).

**Cache.** The base build and base images are cached in `.visual-cache/`, keyed by base SHA, Playwright version, CPU architecture, the base ref's `package-lock.json` and the `visual/` folder. Delete `.visual-cache/` to clear it, or pass `--fresh`.

**Reviewing a sweep.** A PR that changes most images on purpose (for example the antd theme-token move, #304) fails the run by design. Review it from the report. For a stacked PR, run `npm run test:visual -- --base <parent-branch>` so only the differences this layer adds show up.

**Known limits**

- Hover and focus states, print layout, routed-page RTL, behavior, and container-query behavior at widths other than 1280 and 375 are not covered. `npm test` is still needed.
- The Storybook preview wrapper (`MemoryRouter`, `ConfigProvider`, `<div dir="rtl">`) can hide an RTL bug, so routed pages still need a manual check.
- Results do not carry across machines or CPU architectures.
- Local `main` can be behind `origin/main`. The summary warns about it. Use `--base origin/main` to compare with the remote.

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
const [loading, setLoading] = useState(false);
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
const { data, loading, error } = useSchedule(userId);
```

## Working with TypeScript

### Defining Types

```typescript
// types/index.ts
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export type UserRole = "admin" | "parent" | "child" | "staff";

// Union types for defined states
export type LoadingState = "idle" | "loading" | "success" | "error";
```

### Generic Types

```typescript
interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

// Usage
const response: ApiResponse<User[]> = await api.getUsers();
```

## Working with Supabase

### Row Level Security

Every query must consider RLS policies:

```typescript
// ❌ Not good - not secure
const { data } = await supabase.from("users").select("*");

// ✅ Good - relies on RLS
const { data } = await supabase.from("users").select("*").eq("id", userId); // RLS ensures user only sees themselves
```

### Real-time Subscriptions

```typescript
useEffect(() => {
  const subscription = supabase
    .channel("schedule_changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "classes" },
      payload => {
        // Handle real-time updates
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### Edge Functions

Edge Functions live in `supabase/functions/`, managed via `npx supabase` (no global CLI install needed).

**`notify-signup-telegram`** — posts a Telegram message with the new user's email whenever a row is inserted into `public.users`. It's invoked by a Supabase Database Webhook (Dashboard → Integrations → Webhooks — not under Database on this project), not by app code, and authenticates the caller via a shared `x-webhook-secret` header instead of a user JWT (deployed with `--no-verify-jwt`).

See [supabase/functions/notify-signup-telegram/README.md](supabase/functions/notify-signup-telegram/README.md) for full setup, secrets, deploy, and Database Webhook configuration steps.

## Optimization and Performance

### Code Splitting

```typescript
// Lazy loading pages
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
```

### Memoization

```typescript
// Components
const MemoizedComponent = memo(MyComponent);

// Computed values
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// Functions
const handleClick = useCallback(() => {
  // Handle click
}, [dependency]);
```

## Debugging

### React DevTools

Install React Developer Tools for inspecting state and props.

### Supabase Debugging

```typescript
// Add logging to queries
const { data, error } = await supabase.from("table").select("*");

console.log("Supabase query:", { data, error });
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
