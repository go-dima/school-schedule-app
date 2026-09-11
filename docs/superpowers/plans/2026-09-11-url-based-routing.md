# URL-Based Routing (react-router-dom) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `useState`-driven page switching in `App.tsx` with a real `react-router-dom` route tree, so every page has an addressable URL, direct navigation/refresh/back-forward work, admin-only routes are guarded centrally, and the post-signup "check your email" acknowledgment survives the `loading`-driven remount that currently wipes it.

**Architecture:** Introduce a small `src/routes/` module (`paths.ts` for path constants, `resolveGate.ts` for the pure auth/profile/role gating decision, `guards.tsx` for route-guard components built on `resolveGate`, `router.tsx` for the `createBrowserRouter` tree). `App.tsx` keeps its `error`/`loadingTimeout`/`loading` short-circuits exactly as-is and renders `<RouterProvider>` once past them. `AppLayout`, `Sidebar`, `Header`, `ProfileDropdown`, `SchedulePage`, `LoginPage`, `SignupPage` swap their `onNavigate`/`currentPage` props for `useNavigate()`/`useLocation()`. Signup success becomes a real route (`/signup/verify-email`) reached via `navigate()`, not local `useState`, so it survives the shared-`loading` remount.

**Tech Stack:** React 18.2, TypeScript, Vite, Ant Design, react-router-dom v6 (`createBrowserRouter` data-router idiom), Vitest, Storybook 7.

**Spec:** GitHub issue #76 in `go-dima/school-schedule-app` (`gh issue view 76`) — read it in full before starting; this plan implements it end to end, including the signup-success routing fix folded into the spec body.

## Global Constraints

- Router: `react-router-dom` `^6.28.2` (latest 6.28.x), using `createBrowserRouter` — not `<BrowserRouter>`+`<Routes>`. No SSR/framework mode.
- Reuse existing page components as-is; only navigation plumbing changes.
- `resolveGate` is a pure function (no React/router import) covering only the post-loading auth/profile/role branch — the `error`/`loadingTimeout`/`loading` short-circuits in `App.tsx` stay outside it, unchanged.
- Do not introduce React Testing Library component `render()` tests or `MemoryRouter` test setup in `*.test.ts(x)` files. RTL's existing hook-testing harness (`renderHook`/`act`/`waitFor`, already used in `useAuth.test.ts` and `useDraftSelectionAwareness.test.ts`) is fine to keep using but this feature adds no new hook tests beyond `resolveGate.test.ts` (which needs no React at all).
- Keep the existing in-page "no permission" blocks in `ClassManagementPage`, `PendingApprovalsPage`, `UserListPage`, `StudentsPage` — do not remove them.
- All UI copy stays in `src/locales/he.json`, referenced via `t(...)` — no hardcoded Hebrew strings in new code (match existing convention, except where a file already has pre-existing hardcoded Hebrew, which is out of scope to fix).
- Every task ends green on `npx tsc --noEmit` and `npx vitest run`. Do not run `npm run lint`/`npm run build` mid-task unless a task step says to — run both once at the end (Task 20).

---

## File Structure

New files:

- `src/routes/paths.ts` — `ROUTES` path constants, single source of truth for every URL string.
- `src/routes/resolveGate.ts` — pure auth/profile/role gating decision.
- `src/routes/resolveGate.test.ts` — unit tests for the above.
- `src/routes/guards.tsx` — route-guard components (`AuthGate`, `PublicOnlyGate`, `ProfileSetupGate`, `PendingApprovalGate`, `SignupVerifyEmailGate`, `RequireAdmin`, `RequireClassManager`, `NotFoundGate`), all built on `resolveGate`.
- `src/routes/router.tsx` — the `createBrowserRouter` tree, wiring pages + guards to paths.
- `src/pages/SignupVerifyEmailPage.tsx` — the post-signup "check your email" acknowledgment, now a real page instead of `SignupPage`'s local `success` state.

Modified files (see each task): `src/App.tsx`, `src/layouts/AppLayout.tsx`, `src/layouts/Sidebar.tsx`, `src/layouts/Header.tsx`, `src/components/ProfileDropdown.tsx`, `src/pages/SchedulePage.tsx`, `src/pages/ClassManagementPage.tsx`, `src/pages/LoginPage.tsx`, `src/pages/SignupPage.tsx`, `src/types/index.ts`, `src/locales/he.json`, `src/stories/AuthPages.stories.tsx`, `.storybook/preview.tsx`, `package.json`, new `vercel.json`.

---

### Task 1: Install react-router-dom

**Files:**

- Modify: `package.json`, `package-lock.json`

**Interfaces:**

- Produces: `react-router-dom` `^6.28.2` available to import from anywhere in `src/`.

- [ ] **Step 1: Install the dependency**

```bash
npm install react-router-dom@^6.28.2
```

- [ ] **Step 2: Verify it resolves**

```bash
node -e "console.log(require('react-router-dom/package.json').version)"
```

Expected: prints a `6.28.x` version.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-router-dom dependency"
```

---

### Task 2: Route path constants

**Files:**

- Create: `src/routes/paths.ts`

**Interfaces:**

- Produces: `ROUTES` object (every path used by later tasks), `RoutePath` type.

- [ ] **Step 1: Write the file**

```typescript
// src/routes/paths.ts
export const ROUTES = {
  ROOT: "/",
  SCHEDULE: "/schedule",
  CLASS_MANAGEMENT: "/class-management",
  STUDENTS: "/students",
  USER_MANAGEMENT: "/user-management",
  USER_MANAGEMENT_LIST: "/user-management/list",
  USER_MANAGEMENT_PENDING_APPROVALS: "/user-management/pending-approvals",
  PROFILE_SETTINGS: "/profile-settings",
  LOGIN: "/login",
  SIGNUP: "/signup",
  SIGNUP_VERIFY_EMAIL: "/signup/verify-email",
  PROFILE_SETUP: "/profile-setup",
  PENDING_APPROVAL: "/pending-approval",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors (file isn't imported anywhere yet, so this just confirms it parses).

- [ ] **Step 3: Commit**

```bash
git add src/routes/paths.ts
git commit -m "feat: add route path constants"
```

---

### Task 3: `resolveGate` pure function (TDD)

**Files:**

- Create: `src/routes/resolveGate.ts`
- Test: `src/routes/resolveGate.test.ts`

**Interfaces:**

- Consumes: `ROUTES` from `./paths` (Task 2); `User`, `UserRoleData` from `../types`.
- Produces: `resolveGate(state: GateState): GateRedirect`, `GateState` interface (`{ user: User | null; hasProfile: boolean; roles: UserRoleData[] }`), `GateRedirect` type (`typeof ROUTES.LOGIN | typeof ROUTES.PROFILE_SETUP | typeof ROUTES.PENDING_APPROVAL | null`). Later tasks (guards.tsx) import all three.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/routes/resolveGate.test.ts
import { describe, expect, it } from "vitest";
import { resolveGate } from "./resolveGate";
import { ROUTES } from "./paths";
import type { User, UserRoleData } from "../types";

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "parent@example.com",
  firstName: "Dana",
  lastName: "Cohen",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const makeRole = (overrides: Partial<UserRoleData> = {}): UserRoleData => ({
  id: "role-1",
  userId: "user-1",
  role: "parent",
  approved: true,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("resolveGate", () => {
  it("redirects to /login when there is no user", () => {
    const result = resolveGate({ user: null, hasProfile: false, roles: [] });
    expect(result).toBe(ROUTES.LOGIN);
  });

  it("redirects to /profile-setup when authenticated with an incomplete profile", () => {
    const result = resolveGate({
      user: makeUser(),
      hasProfile: false,
      roles: [],
    });
    expect(result).toBe(ROUTES.PROFILE_SETUP);
  });

  it("redirects to /pending-approval when profile is complete but there are no roles", () => {
    const result = resolveGate({
      user: makeUser(),
      hasProfile: true,
      roles: [],
    });
    expect(result).toBe(ROUTES.PENDING_APPROVAL);
  });

  it("returns null (no redirect) when authenticated, complete profile, and has roles", () => {
    const result = resolveGate({
      user: makeUser(),
      hasProfile: true,
      roles: [makeRole()],
    });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/routes/resolveGate.test.ts
```

Expected: FAIL — `resolveGate.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// src/routes/resolveGate.ts
import { ROUTES } from "./paths";
import type { User, UserRoleData } from "../types";

export interface GateState {
  user: User | null;
  hasProfile: boolean;
  roles: UserRoleData[];
}

export type GateRedirect =
  | typeof ROUTES.LOGIN
  | typeof ROUTES.PROFILE_SETUP
  | typeof ROUTES.PENDING_APPROVAL
  | null;

export function resolveGate(state: GateState): GateRedirect {
  const { user, hasProfile, roles } = state;

  if (!user) return ROUTES.LOGIN;
  if (!hasProfile) return ROUTES.PROFILE_SETUP;
  if (roles.length === 0) return ROUTES.PENDING_APPROVAL;
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/routes/resolveGate.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/resolveGate.ts src/routes/resolveGate.test.ts
git commit -m "feat: add resolveGate pure auth/profile/role gating function"
```

---

### Task 4: Route guard components

**Files:**

- Create: `src/routes/guards.tsx`

**Interfaces:**

- Consumes: `resolveGate`, `GateState` from `./resolveGate` (Task 3); `ROUTES` from `./paths` (Task 2); `useAuth` from `../contexts/AuthContext`.
- Produces: `AuthGate`, `PublicOnlyGate`, `ProfileSetupGate`, `PendingApprovalGate`, `SignupVerifyEmailGate`, `RequireAdmin`, `RequireClassManager`, `NotFoundGate` — each a `React.FC` with no props, rendering either `<Outlet/>` or `<Navigate .../>`. Consumed by `router.tsx` (Task 5).

- [ ] **Step 1: Write the file**

```tsx
// src/routes/guards.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { resolveGate } from "./resolveGate";
import { ROUTES } from "./paths";

function useHasProfile(): boolean {
  const { user } = useAuth();
  return Boolean(user?.firstName && user?.lastName);
}

function useGate() {
  const { user, userRoles } = useAuth();
  const hasProfile = useHasProfile();
  return resolveGate({ user, hasProfile, roles: userRoles });
}

/** Guards the authenticated app layout: redirects to whatever resolveGate says. */
export function AuthGate() {
  const gate = useGate();
  if (gate) return <Navigate to={gate} replace />;
  return <Outlet />;
}

/** Guards /login and /signup: only reachable while unauthenticated. */
export function PublicOnlyGate() {
  const gate = useGate();
  if (gate === null) return <Navigate to={ROUTES.SCHEDULE} replace />;
  if (gate === ROUTES.LOGIN) return <Outlet />;
  return <Navigate to={gate} replace />;
}

/** Guards /profile-setup: only reachable while that's the correct onboarding step. */
export function ProfileSetupGate() {
  const gate = useGate();
  if (gate !== ROUTES.PROFILE_SETUP) {
    return <Navigate to={gate ?? ROUTES.SCHEDULE} replace />;
  }
  return <Outlet />;
}

/** Guards /pending-approval: only reachable while that's the correct onboarding step. */
export function PendingApprovalGate() {
  const gate = useGate();
  if (gate !== ROUTES.PENDING_APPROVAL) {
    return <Navigate to={gate ?? ROUTES.SCHEDULE} replace />;
  }
  return <Outlet />;
}

interface SignupVerifyEmailLocationState {
  fromSignup?: boolean;
}

/**
 * Guards /signup/verify-email: only reachable immediately after a successful
 * signup submission (flagged via navigation state), since it isn't a
 * bookmarkable/deep-linkable page. Anyone else lands back on /signup.
 */
export function SignupVerifyEmailGate() {
  const gate = useGate();
  const location = useLocation();

  if (gate === null) return <Navigate to={ROUTES.SCHEDULE} replace />;
  if (gate !== ROUTES.LOGIN) return <Navigate to={gate} replace />;

  const state = location.state as SignupVerifyEmailLocationState | null;
  if (!state?.fromSignup) return <Navigate to={ROUTES.SIGNUP} replace />;

  return <Outlet />;
}

/** Guards class-management and students routes. */
export function RequireClassManager() {
  const { canManageClasses } = useAuth();
  if (!canManageClasses()) return <Navigate to={ROUTES.SCHEDULE} replace />;
  return <Outlet />;
}

/** Guards the /user-management/* branch. */
export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin()) return <Navigate to={ROUTES.SCHEDULE} replace />;
  return <Outlet />;
}

/** Catch-all for unmatched paths: /schedule if authenticated, else the right gate. */
export function NotFoundGate() {
  const gate = useGate();
  return <Navigate to={gate ?? ROUTES.SCHEDULE} replace />;
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/guards.tsx
git commit -m "feat: add route guard components built on resolveGate"
```

---

### Task 5: Router tree

**Files:**

- Create: `src/routes/router.tsx`

**Interfaces:**

- Consumes: `ROUTES` (Task 2), all guards from `./guards` (Task 4), `AppLayout` (rewritten in Task 7 — write this task first, but note `AppLayout`'s prop signature changes to no-props/`<Outlet/>` in Task 7; this file already assumes that shape), and every page component.
- Produces: `router` (a `createBrowserRouter` instance), the default export consumed by `App.tsx` (Task 6).

- [ ] **Step 1: Write the file**

```tsx
// src/routes/router.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import SignupVerifyEmailPage from "../pages/SignupVerifyEmailPage";
import ProfileSetupPage from "../pages/ProfileSetupPage";
import PendingApprovalPage from "../pages/PendingApprovalPage";
import SchedulePage from "../pages/SchedulePage";
import ClassManagementPage from "../pages/ClassManagementPage";
import StudentsPage from "../pages/StudentsPage";
import UserListPage from "../pages/UserListPage";
import PendingApprovalsPage from "../pages/PendingApprovalsPage";
import ProfileSettingsPage from "../pages/ProfileSettingsPage";
import {
  AuthGate,
  PublicOnlyGate,
  ProfileSetupGate,
  PendingApprovalGate,
  SignupVerifyEmailGate,
  RequireAdmin,
  RequireClassManager,
  NotFoundGate,
} from "./guards";
import { ROUTES } from "./paths";

export const router = createBrowserRouter([
  {
    element: <PublicOnlyGate />,
    children: [
      { path: ROUTES.LOGIN, element: <LoginPage /> },
      { path: ROUTES.SIGNUP, element: <SignupPage /> },
    ],
  },
  {
    element: <SignupVerifyEmailGate />,
    children: [
      {
        path: ROUTES.SIGNUP_VERIFY_EMAIL,
        element: <SignupVerifyEmailPage />,
      },
    ],
  },
  {
    element: <ProfileSetupGate />,
    children: [{ path: ROUTES.PROFILE_SETUP, element: <ProfileSetupPage /> }],
  },
  {
    element: <PendingApprovalGate />,
    children: [
      { path: ROUTES.PENDING_APPROVAL, element: <PendingApprovalPage /> },
    ],
  },
  {
    element: <AuthGate />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to={ROUTES.SCHEDULE} replace /> },
          { path: ROUTES.SCHEDULE, element: <SchedulePage /> },
          {
            element: <RequireClassManager />,
            children: [
              {
                path: ROUTES.CLASS_MANAGEMENT,
                element: <ClassManagementPage />,
              },
              { path: ROUTES.STUDENTS, element: <StudentsPage /> },
            ],
          },
          {
            path: ROUTES.USER_MANAGEMENT,
            element: <RequireAdmin />,
            children: [
              {
                index: true,
                element: <Navigate to={ROUTES.USER_MANAGEMENT_LIST} replace />,
              },
              { path: "list", element: <UserListPage /> },
              {
                path: "pending-approvals",
                element: <PendingApprovalsPage />,
              },
            ],
          },
          {
            path: ROUTES.PROFILE_SETTINGS,
            element: <ProfileSettingsPage />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundGate /> },
]);
```

- [ ] **Step 2: Typecheck (expect errors until later tasks land)**

```bash
npx tsc --noEmit
```

Expected: several errors, all traceable to later tasks in this plan — do not fix any of them now, just confirm none are unexpected:

- `Cannot find module '../pages/SignupVerifyEmailPage'` — fixed by Task 14.
- `AppLayout` still requiring `children`/`onNavigate`/`currentPage` props it's not given here — fixed by Task 7.
- Nothing else should error (every other page component still takes its `onNavigate` prop as _optional_ today, so passing none is fine until Task 11–13 remove those props entirely).

- [ ] **Step 3: Commit**

```bash
git add src/routes/router.tsx
git commit -m "feat: add createBrowserRouter route tree"
```

---

### Task 6: Rewrite `App.tsx`

**Files:**

- Modify: `src/App.tsx`

**Interfaces:**

- Consumes: `router` from `./routes/router` (Task 5).
- Produces: `App` default export, unchanged from the outside (still the app's root component mounted in `main.tsx` — no change needed there).

- [ ] **Step 1: Replace the file contents**

```tsx
// src/App.tsx
import { useEffect, useState } from "react";
import { RouterProvider } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ChildProvider } from "./contexts/ChildContext";
import { ContextErrorBoundary } from "./components/ErrorBoundary";
import { router } from "./routes/router";
import { Spin, Button, Result } from "antd";
import { useTranslation } from "react-i18next";
import "./App.css";

function AppContent() {
  const { loading, error, clearApplicationState } = useAuth();
  const { t } = useTranslation();
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // Timeout protection for loading state
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (loading) {
      timeoutId = setTimeout(() => {
        setLoadingTimeout(true);
      }, 5000); // 5 second timeout
    } else {
      setLoadingTimeout(false);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [loading]);

  // Emergency state clearing keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Shift+Delete or Cmd+Shift+Delete to clear application state
      if (event.ctrlKey && event.shiftKey && event.key === "Delete") {
        event.preventDefault();
        console.log("🚨 Emergency state clear triggered by keyboard shortcut");
        clearApplicationState();
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearApplicationState]);

  // Show error state with recovery options
  if (error && !loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "20px",
        }}>
        <Result
          status="error"
          title={t("errors.auth.title", "Authentication Error")}
          subTitle={error}
          extra={[
            <Button
              type="primary"
              key="retry"
              onClick={() => window.location.reload()}>
              {t("errors.auth.retry", "Try Again")}
            </Button>,
          ]}
        />
      </div>
    );
  }

  // Show timeout warning with recovery options
  if (loadingTimeout) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          padding: "20px",
        }}>
        <Result
          status="warning"
          title={t(
            "errors.timeout.title",
            "Loading is taking longer than expected"
          )}
          subTitle={t(
            "errors.timeout.subtitle",
            "The application may be experiencing connectivity issues."
          )}
          extra={[
            <Button
              type="primary"
              key="clear-state"
              onClick={() => {
                clearApplicationState();
                window.location.reload();
              }}>
              {t("errors.timeout.clearState", "Clear State & Refresh")}
            </Button>,
          ]}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}>
        <Spin size="large" />
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

function App() {
  return (
    <ContextErrorBoundary>
      <AuthProvider>
        <ChildProvider>
          <AppContent />
        </ChildProvider>
      </AuthProvider>
    </ContextErrorBoundary>
  );
}

export default App;
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: same remaining errors as end of Task 5 (missing `SignupVerifyEmailPage` module, `AppLayout` props) — nothing new introduced by this file itself.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "refactor: replace App.tsx page-switch state with RouterProvider"
```

---

### Task 7: Convert `AppLayout` to an Outlet-based layout route

**Files:**

- Modify: `src/layouts/AppLayout.tsx`

**Interfaces:**

- Produces: `AppLayout` as `React.FC` with **no props** (was `{ children, onNavigate, currentPage }`). Consumed by `router.tsx` (Task 5, already written assuming this shape).

- [ ] **Step 1: Replace the file contents**

```tsx
// src/layouts/AppLayout.tsx
import React, { useState } from "react";
import { Layout } from "antd";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import "./layouts.css";

const { Content } = Layout;

const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(true);

  const toggleSidebar = () => {
    setCollapsed(!collapsed);
  };

  return (
    <Layout className="app-layout">
      <Header />
      <Layout>
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        <Content className="app-layout-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: the `AppLayout`-shape error from Task 5 is gone; errors now shift to `Sidebar`/`Header` no longer accepting `onNavigate`/`currentPage` (fixed in Tasks 8–9). The missing `SignupVerifyEmailPage` module error (fixed in Task 14) is still expected.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/AppLayout.tsx
git commit -m "refactor: convert AppLayout to an Outlet-based layout route"
```

---

### Task 8: Convert `Sidebar` to router-native navigation

**Files:**

- Modify: `src/layouts/Sidebar.tsx`

**Interfaces:**

- Consumes: `ROUTES` from `../routes/paths` (Task 2).
- Produces: `Sidebar` as `React.FC<{ collapsed: boolean; onToggle?: () => void }>` (dropped `onNavigate`/`currentPage`). Consumed by `AppLayout` (Task 7, already written assuming this shape).

- [ ] **Step 1: Replace the file contents**

```tsx
// src/layouts/Sidebar.tsx
import React from "react";
import { Layout, Menu, Badge } from "antd";
import {
  CalendarOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { usePendingApprovals } from "../hooks/usePendingApprovals";
import { ROUTES } from "../routes/paths";
import type { MenuProps } from "antd";

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
  onToggle?: () => void;
}

const USER_MANAGEMENT_SUBMENU_KEY = "user-management-submenu";

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { t } = useTranslation();
  const { isAdmin, canManageClasses } = useAuth();
  const { pendingApprovalsCount } = usePendingApprovals();
  const location = useLocation();
  const navigate = useNavigate();
  const [openKeys, setOpenKeys] = React.useState<string[]>([]);

  const isUserManagementPath = location.pathname.startsWith(
    ROUTES.USER_MANAGEMENT
  );

  // Initialize/refresh open keys based on current path
  React.useEffect(() => {
    setOpenKeys(isUserManagementPath ? [USER_MANAGEMENT_SUBMENU_KEY] : []);
  }, [isUserManagementPath]);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleOpenChange = (keys: string[]) => {
    if (!collapsed) {
      setOpenKeys(keys);
    }
  };

  const items: MenuProps["items"] = [
    {
      key: ROUTES.SCHEDULE,
      icon: <CalendarOutlined />,
      label: t("navigation.schedule"),
    },
    {
      key: ROUTES.CLASS_MANAGEMENT,
      icon: <BookOutlined />,
      label: t("navigation.classManagement"),
      style: canManageClasses() ? {} : { display: "none" },
    },
    {
      key: ROUTES.STUDENTS,
      icon: <UsergroupAddOutlined />,
      label: t("navigation.students"),
      style: canManageClasses() ? {} : { display: "none" },
    },
    isAdmin()
      ? {
          key: USER_MANAGEMENT_SUBMENU_KEY,
          icon: <TeamOutlined />,
          label: t("navigation.userManagement"),
          children: [
            {
              key: ROUTES.USER_MANAGEMENT_LIST,
              icon: <UserOutlined />,
              label: t("navigation.userList"),
            },
            {
              key: ROUTES.USER_MANAGEMENT_PENDING_APPROVALS,
              icon:
                pendingApprovalsCount > 0 ? (
                  <Badge count={pendingApprovalsCount} size="small" />
                ) : (
                  <CheckCircleOutlined />
                ),
              label: (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}>
                  <span>{t("navigation.pendingApprovals")}</span>
                </div>
              ),
            },
          ],
        }
      : null,
    {
      key: ROUTES.PROFILE_SETTINGS,
      icon: <SettingOutlined />,
      label: t("navigation.profileSettings"),
    },
  ].filter(Boolean);

  return (
    <div className="sidebar-container">
      <Sider
        className="app-sidebar"
        collapsible
        collapsed={collapsed}
        width={250}
        collapsedWidth={80}
        reverseArrow
        trigger={null}>
        <Menu
          className="sidebar-menu"
          mode="inline"
          selectedKeys={[location.pathname]}
          openKeys={collapsed ? [] : openKeys}
          items={items}
          onClick={handleMenuClick}
          onOpenChange={handleOpenChange}
        />
      </Sider>

      {/* Sidebar trigger bar at bottom */}
      <div
        className="sidebar-trigger-bar"
        style={{
          width: collapsed ? "80px" : "250px",
        }}
        onClick={onToggle}>
        <div className="sidebar-trigger-content">
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          {!collapsed && (
            <span className="sidebar-trigger-text">
              {t("navigation.collapseSidebar")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: remaining errors now only about `Header`/`ProfileDropdown` (Tasks 9–10), plus the still-expected missing `SignupVerifyEmailPage` module error (fixed in Task 14).

- [ ] **Step 3: Commit**

```bash
git add src/layouts/Sidebar.tsx
git commit -m "refactor: convert Sidebar to router-native navigation"
```

---

### Task 9: Convert `Header` to router-native page info

**Files:**

- Modify: `src/layouts/Header.tsx`

**Interfaces:**

- Consumes: `ROUTES` from `../routes/paths` (Task 2).
- Produces: `Header` as `React.FC` with **no props** (was `{ onNavigate, currentPage }`). Consumed by `AppLayout` (Task 7, already written assuming this shape).

- [ ] **Step 1: Replace the file contents**

```tsx
// src/layouts/Header.tsx
import React from "react";
import { Layout, Typography } from "antd";
import {
  CalendarOutlined,
  BookOutlined,
  UserOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import ProfileDropdown from "../components/ProfileDropdown";
import { ROUTES } from "../routes/paths";

const { Header: AntHeader } = Layout;
const { Title } = Typography;

const Header: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

  const getPageInfo = (pathname: string) => {
    switch (pathname) {
      case ROUTES.SCHEDULE:
        return { title: t("navigation.schedule"), icon: <CalendarOutlined /> };
      case ROUTES.CLASS_MANAGEMENT:
        return {
          title: t("navigation.classManagement"),
          icon: <BookOutlined />,
        };
      case ROUTES.USER_MANAGEMENT_LIST:
        return { title: t("navigation.userList"), icon: <UserOutlined /> };
      case ROUTES.USER_MANAGEMENT_PENDING_APPROVALS:
        return {
          title: t("navigation.pendingApprovals"),
          icon: <CheckCircleOutlined />,
        };
      case ROUTES.PROFILE_SETTINGS:
        return {
          title: t("navigation.profileSettings"),
          icon: <SettingOutlined />,
        };
      default:
        return { title: t("app.title"), icon: <HomeOutlined /> };
    }
  };

  const pageInfo = getPageInfo(location.pathname);

  return (
    <AntHeader className="app-header">
      <div className="app-header-left">
        <div className="app-header-logo">
          <Title level={4} className="app-logo-text">
            {t("app.title")}
          </Title>
        </div>
        <div className="app-header-divider" />
        <div className="app-header-page-info">
          <div className="page-title-section">
            {pageInfo.icon}
            <Title level={3} className="page-title">
              {pageInfo.title}
            </Title>
          </div>
        </div>
      </div>

      <div className="app-header-right">
        <ProfileDropdown />
      </div>
    </AntHeader>
  );
};

export default Header;
```

Note: the `user-management` case and the unused `breadcrumb` field are dropped — the bare `/user-management` path never renders (it redirects to `/user-management/list`, see Task 5's router tree), and `breadcrumb` was computed but never rendered (its JSX was already commented out before this change).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: remaining errors now only about `ProfileDropdown` (Task 10), plus the still-expected missing `SignupVerifyEmailPage` module error (fixed in Task 14).

- [ ] **Step 3: Commit**

```bash
git add src/layouts/Header.tsx
git commit -m "refactor: convert Header to router-native page info"
```

---

### Task 10: Convert `ProfileDropdown` to router-native navigation

**Files:**

- Modify: `src/components/ProfileDropdown.tsx`

**Interfaces:**

- Consumes: `ROUTES` from `../routes/paths` (Task 2).
- Produces: `ProfileDropdown` as `React.FC` with **no props** (was `{ onNavigate }`). Consumed by `Header` (Task 9, already written assuming this shape).

- [ ] **Step 1: Replace the file contents**

```tsx
// src/components/ProfileDropdown.tsx
import React from "react";
import { Dropdown, Avatar, Typography, Space } from "antd";
import {
  UserOutlined,
  EditOutlined,
  LogoutOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROUTES } from "../routes/paths";
import type { MenuProps } from "antd";

const { Text } = Typography;

const ProfileDropdown: React.FC = () => {
  const { t } = useTranslation();
  const { user, signOut, currentRole } = useAuth();
  const navigate = useNavigate();

  const handleEditProfile = () => {
    navigate(ROUTES.PROFILE_SETTINGS);
  };

  const handleLogout = () => {
    signOut();
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return "U";
    const first = firstName ? firstName[0].toUpperCase() : "";
    const last = lastName ? lastName[0].toUpperCase() : "";
    return `${first}${last}` || "U";
  };

  const getFullName = (firstName?: string, lastName?: string) => {
    if (!firstName && !lastName) return t("profile.dropdown.anonymous");
    return `${firstName || ""} ${lastName || ""}`.trim();
  };

  const getRoleColor = (role: string): string => {
    const colorMap: Record<string, string> = {
      admin: "#ff4d4f", // red
      teacher: "#1890ff", // blue
      staff: "#1890ff", // blue
      parent: "#52c41a", // green
      child: "#faad14", // yellow
    };
    return colorMap[role] || "#8c8c8c";
  };

  const items: MenuProps["items"] = [
    {
      key: "user-info",
      label: (
        <div
          style={{
            padding: "8px 0",
            borderBottom: "1px solid #f0f0f0",
            marginBottom: 8,
          }}>
          <Text strong>{getFullName(user?.firstName, user?.lastName)}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {user?.email}
          </Text>
        </div>
      ),
      disabled: true,
    },
    {
      key: "edit-profile",
      label: (
        <Space>
          <EditOutlined />
          {t("profile.dropdown.editProfile")}
        </Space>
      ),
      onClick: handleEditProfile,
    },
    {
      type: "divider",
    },
    {
      key: "logout",
      label: (
        <Space>
          <LogoutOutlined />
          {t("profile.dropdown.logout")}
        </Space>
      ),
      onClick: handleLogout,
      danger: true,
    },
  ];

  return (
    <div className="profile-dropdown">
      <Dropdown
        menu={{ items }}
        placement="bottomLeft"
        trigger={["click"]}
        overlayClassName="profile-dropdown-overlay">
        <div
          className="profile-dropdown-trigger"
          style={{
            border: currentRole
              ? `3px solid ${getRoleColor(currentRole.role)}`
              : "none",
          }}>
          <div className="profile-dropdown-user">
            <Avatar
              className="profile-dropdown-avatar"
              size="small"
              icon={<UserOutlined />}>
              {getInitials(user?.firstName, user?.lastName)}
            </Avatar>
            <Text className="profile-dropdown-name">
              {getFullName(user?.firstName, user?.lastName)}
            </Text>
            <DownOutlined style={{ fontSize: "12px", color: "#8c8c8c" }} />
          </div>
        </div>
      </Dropdown>
    </div>
  );
};

export default ProfileDropdown;
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: `AppLayout`/`Sidebar`/`Header`/`ProfileDropdown` chain is now fully clean. Remaining errors are only the still-expected missing `SignupVerifyEmailPage` module error (fixed in Task 14) and `SchedulePage`/`ClassManagementPage` still declaring an `onNavigate` prop of the now-deleted `AppOnNavigate` type — expected until Tasks 11–13.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProfileDropdown.tsx
git commit -m "refactor: convert ProfileDropdown to router-native navigation"
```

---

### Task 11: Update `SchedulePage` navigation

**Files:**

- Modify: `src/pages/SchedulePage.tsx:38-56,527-541` (import list, props interface, the one `onNavigate?.("profile-settings")` call site)

**Interfaces:**

- Consumes: `ROUTES` from `../routes/paths` (Task 2).
- Produces: `SchedulePage` as `React.FC` with **no props** (was `{ onNavigate? }`).

- [ ] **Step 1: Update the type import (around line 38-44)**

Change:

```typescript
import type {
  AppOnNavigate,
  Class,
  TimeSlot,
  Child,
  ScheduleTarget,
} from "../types";
```

to:

```typescript
import type { Class, TimeSlot, Child, ScheduleTarget } from "../types";
```

- [ ] **Step 2: Add the router import near the other hooks/imports (after the `useTranslation` import, line 15)**

```typescript
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes/paths";
```

- [ ] **Step 3: Drop the props interface and destructure (around line 52-56)**

Change:

```typescript
interface SchedulePageProps {
  onNavigate?: AppOnNavigate;
}

const SchedulePage: React.FC<SchedulePageProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
```

to:

```typescript
const SchedulePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
```

- [ ] **Step 4: Update the one call site (around line 537)**

Change:

```typescript
              onClick={() => onNavigate?.("profile-settings")}>
```

to:

```typescript
              onClick={() => navigate(ROUTES.PROFILE_SETTINGS)}>
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: `SchedulePage` errors gone; `router.tsx` (Task 5) no longer needs adjustment since it already rendered `<SchedulePage />` with no props. The still-expected missing `SignupVerifyEmailPage` module error (fixed in Task 14) remains.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SchedulePage.tsx
git commit -m "refactor: convert SchedulePage to router-native navigation"
```

---

### Task 12: Drop unused `onNavigate` prop from `ClassManagementPage`

**Files:**

- Modify: `src/pages/ClassManagementPage.tsx:1-58` (import list, props interface)

**Interfaces:**

- Produces: `ClassManagementPage` as `React.FC` with no props (the `onNavigate` field was already declared-but-unused before this change — confirmed via grep, it's never destructured or read in the component body).

- [ ] **Step 1: Remove `AppOnNavigate` from the type import (around line 27-33)**

Change:

```typescript
import type {
  ClassWithTimeSlot,
  TimeSlot,
  Class,
  Scope,
  AppOnNavigate,
} from "../types";
```

to:

```typescript
import type { ClassWithTimeSlot, TimeSlot, Class, Scope } from "../types";
```

- [ ] **Step 2: Remove the props interface and simplify the component signature (around line 54-59)**

Change:

```typescript
interface ClassManagementPageProps {
  onNavigate?: AppOnNavigate;
}

const ClassManagementPage: React.FC<ClassManagementPageProps> = () => {
  const { t } = useTranslation();
  const { canManageClasses } = useAuth();
```

to:

```typescript
const ClassManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const { canManageClasses } = useAuth();
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: `ClassManagementPage` errors gone. The still-expected missing `SignupVerifyEmailPage` module error (fixed in Task 14) remains.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ClassManagementPage.tsx
git commit -m "refactor: drop unused onNavigate prop from ClassManagementPage"
```

---

### Task 13: Remove `AppOnNavigate`/`AppPages` types

**Files:**

- Modify: `src/types/index.ts:145-156`

**Interfaces:**

- Produces: nothing (pure deletion) — by this point no file imports `AppOnNavigate`/`AppPages` (Tasks 6–12 removed every usage).

- [ ] **Step 1: Delete the block**

Remove from the end of the file:

```typescript
export type AppPages =
  | "schedule"
  | "class-management"
  | "students"
  | "pending-approvals"
  | "user-management"
  | "user-list"
  | "profile-settings";

// For App navigation
export type AppOnNavigate = (page: AppPages) => void;
```

- [ ] **Step 2: Confirm nothing else references them**

```bash
grep -rn "AppOnNavigate\|AppPages" src --include="*.ts" --include="*.tsx"
```

Expected: no matches.

- [ ] **Step 3: Typecheck the whole project**

```bash
npx tsc --noEmit
```

Expected: the still-expected missing `SignupVerifyEmailPage` module error (fixed in Task 14) remains, and `LoginPage`/`SignupPage` still declaring `onSwitchToSignup`/`onSwitchToLogin` props means `router.tsx` (Task 5) rendering `<LoginPage />`/`<SignupPage />` with no props now errors since those props are required (not optional) today — expected, fixed in Tasks 14–15. No other errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "refactor: remove AppOnNavigate/AppPages types"
```

---

### Task 14: `SignupVerifyEmailPage` + locale copy

**Files:**

- Create: `src/pages/SignupVerifyEmailPage.tsx`
- Modify: `src/locales/he.json` (add `auth.signup.verifyEmail.*` keys)

**Interfaces:**

- Consumes: `ROUTES` from `../routes/paths` (Task 2).
- Produces: `SignupVerifyEmailPage` default export, a `React.FC` with no props. Consumed by `router.tsx` (Task 5, already written assuming this shape).

- [ ] **Step 1: Add locale keys**

In `src/locales/he.json`, inside the existing `auth.signup` object (after `"error": "שגיאה בהרשמה",` and before `"successTitle"`), add a nested `verifyEmail` object. The existing `successTitle`/`successAlertTitle`/`successMessage1-3`/`returnToLogin` keys stay untouched (nothing currently reads them once Task 15 removes `SignupPage`'s `success` branch, but deleting unused locale keys is out of scope — leave them):

```json
    "verifyEmail": {
      "title": "כמעט סיימת!",
      "alertTitle": "אנא אשר/י את כתובת הדוא\"ל",
      "message1": "שלחנו אליך מייל אישור לכתובת שהזנת בהרשמה.",
      "message2": "לאחר אישור הדוא\"ל, בקשתך תמתין לאישור מנהל המערכת ותקבל/י הודעה כאשר החשבון יאושר.",
      "message3": "בינתיים, אפשר לחזור לעמוד ההתחברות.",
      "returnToLogin": "חזור לעמוד ההתחברות"
    },
```

- [ ] **Step 2: Write the page**

```tsx
// src/pages/SignupVerifyEmailPage.tsx
import React from "react";
import { Card, Typography, Alert, Button } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../routes/paths";
import "./AuthPages.css";

const { Title } = Typography;

const SignupVerifyEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>{t("auth.signup.verifyEmail.title")}</Title>
          </div>

          <Alert
            message={t("auth.signup.verifyEmail.alertTitle")}
            description={
              <div>
                <p>{t("auth.signup.verifyEmail.message1")}</p>
                <p>{t("auth.signup.verifyEmail.message2")}</p>
                <p>{t("auth.signup.verifyEmail.message3")}</p>
              </div>
            }
            type="success"
            showIcon
            className="success-alert"
          />

          <div className="auth-footer">
            <Button
              type="primary"
              size="large"
              onClick={() => navigate(ROUTES.LOGIN)}
              block>
              {t("auth.signup.verifyEmail.returnToLogin")}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupVerifyEmailPage;
```

- [ ] **Step 3: Validate the JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('src/locales/he.json', 'utf8')); console.log('valid json')"
```

Expected: prints `valid json`.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: `router.tsx`'s `<SignupVerifyEmailPage />` reference now resolves cleanly.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SignupVerifyEmailPage.tsx src/locales/he.json
git commit -m "feat: add SignupVerifyEmailPage with verify-email copy"
```

---

### Task 15: Update `LoginPage`/`SignupPage` to router-native navigation; fix the signup-success bug

**Files:**

- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/SignupPage.tsx`

**Interfaces:**

- Consumes: `ROUTES` from `../routes/paths` (Task 2); `SignupVerifyEmailPage`'s route `ROUTES.SIGNUP_VERIFY_EMAIL` (Task 14) and its guard's expected `location.state.fromSignup` flag (Task 4's `SignupVerifyEmailGate`).
- Produces: `LoginPage` and `SignupPage` as `React.FC` with **no props** (was `{ onSwitchToSignup }` / `{ onSwitchToLogin }`). Consumed by `router.tsx` (Task 5, already written assuming this shape).

- [ ] **Step 1: Rewrite `LoginPage.tsx`**

```tsx
// src/pages/LoginPage.tsx
import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Divider,
  Space,
} from "antd";
import { UserOutlined, LockOutlined, GoogleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROUTES } from "../routes/paths";
import "./AuthPages.css";

const { Title, Text, Link } = Typography;

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [localError, setLocalError] = useState<string | null>(null);
  const { signIn, signInWithGoogle, loading } = useAuth();

  const onFinish = async (values: LoginFormValues) => {
    setLocalError(null);

    try {
      await signIn(values.email, values.password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : t("auth.login.error"));
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);

    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("auth.login.googleError")
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>{t("auth.login.title")}</Title>
            <Text type="secondary">{t("auth.login.subtitle")}</Text>
          </div>

          {localError && (
            <Alert
              message={t("auth.login.error")}
              description={localError}
              type="error"
              showIcon
              closable
              onClose={() => setLocalError(null)}
              className="auth-alert"
            />
          )}

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            className="auth-form">
            <Form.Item
              name="email"
              label={t("auth.login.emailLabel")}
              rules={[
                { required: true, message: t("auth.login.emailRequired") },
                { type: "email", message: t("auth.login.emailInvalid") },
              ]}>
              <Input
                prefix={<UserOutlined />}
                placeholder={t("auth.login.emailPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t("auth.login.passwordLabel")}
              rules={[
                { required: true, message: t("auth.login.passwordRequired") },
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("auth.login.passwordPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                disabled={loading}
                block
                className="auth-submit-btn">
                {t("auth.login.loginButton")}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>{t("auth.login.or")}</Divider>

          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Button
              icon={<GoogleOutlined />}
              size="large"
              block
              loading={loading}
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="oauth-btn google-btn">
              {t("auth.login.googleButton")}
            </Button>
          </Space>

          <div className="auth-footer">
            <Text>
              {t("auth.login.signupPrompt")}{" "}
              <Link onClick={() => navigate(ROUTES.SIGNUP)}>
                {t("auth.login.signupLink")}
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
```

- [ ] **Step 2: Rewrite `SignupPage.tsx`**

```tsx
// src/pages/SignupPage.tsx
import React, { useState } from "react";
import {
  Form,
  Input,
  Button,
  Card,
  Typography,
  Alert,
  Checkbox,
  Divider,
  Space,
} from "antd";
import { LockOutlined, MailOutlined, GoogleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ROUTES } from "../routes/paths";
import "./AuthPages.css";

const { Title, Text, Link } = Typography;

interface SignupFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

const SignupPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [localError, setLocalError] = useState<string | null>(null);
  const { signUp, signInWithGoogle, loading } = useAuth();

  const onFinish = async (values: SignupFormValues) => {
    setLocalError(null);

    try {
      await signUp(values.email, values.password);
      navigate(ROUTES.SIGNUP_VERIFY_EMAIL, {
        state: { fromSignup: true },
        replace: true,
      });
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("auth.signup.error")
      );
    }
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);

    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("auth.signup.googleError")
      );
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <Card className="auth-card">
          <div className="auth-header">
            <Title level={2}>{t("auth.signup.title")}</Title>
            <Text type="secondary">{t("auth.signup.subtitle")}</Text>
          </div>

          {localError && (
            <Alert
              message={t("auth.signup.error")}
              description={localError}
              type="error"
              showIcon
              closable
              onClose={() => setLocalError(null)}
              className="auth-alert"
            />
          )}

          <Form
            form={form}
            name="signup"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            className="auth-form">
            <Form.Item
              name="email"
              label={t("auth.signup.emailLabel")}
              rules={[
                { required: true, message: t("auth.signup.emailRequired") },
                { type: "email", message: t("auth.login.emailInvalid") },
              ]}>
              <Input
                prefix={<MailOutlined />}
                placeholder="your@email.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={t("auth.signup.passwordLabel")}
              rules={[
                { required: true, message: t("auth.login.passwordRequired") },
                { min: 6, message: t("auth.signup.passwordMinLength") },
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("auth.signup.passwordPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label={t("auth.signup.confirmPasswordLabel")}
              dependencies={["password"]}
              rules={[
                {
                  required: true,
                  message: t("auth.signup.confirmPasswordRequired"),
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error(t("auth.signup.passwordMismatch"))
                    );
                  },
                }),
              ]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="terms"
              valuePropName="checked"
              rules={[
                { required: true, message: t("auth.signup.termsRequired") },
              ]}>
              <Checkbox>{t("auth.signup.termsCheckbox")}</Checkbox>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                disabled={loading}
                block
                className="auth-submit-btn">
                {t("auth.signup.signupButton")}
              </Button>
            </Form.Item>
          </Form>

          <Divider plain>{t("auth.signup.or")}</Divider>

          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Button
              icon={<GoogleOutlined />}
              size="large"
              block
              loading={loading}
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="oauth-btn google-btn">
              {t("auth.signup.googleButton")}
            </Button>
          </Space>

          <div className="auth-footer">
            <Text>
              {t("auth.signup.loginPrompt")}{" "}
              <Link onClick={() => navigate(ROUTES.LOGIN)}>
                {t("auth.signup.loginLink")}
              </Link>
            </Text>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SignupPage;
```

Note what changed vs. the original: the `success` state and its whole render branch are gone — replaced by `navigate(ROUTES.SIGNUP_VERIFY_EMAIL, { state: { fromSignup: true }, replace: true })` right after `signUp()` resolves. This is the actual fix for the bug described in the spec: `navigate()` operates on react-router's shared history object, not on `SignupPage`'s own component state, so it still takes effect even though the `loading` flag flip (inside `useAuth.signUp`, both before and after this line) unmounts and remounts `SignupPage` around this same `await` — by the time this line runs, the remount has already happened and the _new_ `SignupPage` instance's `navigate` reference points at the same shared router, so the URL change (and the `fromSignup` flag `SignupVerifyEmailGate` checks) still lands correctly. `form.resetFields()` is dropped since the component is navigating away, not staying mounted to show a reset form.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors project-wide (except the story file, fixed in Task 16, which passes props these components no longer accept).

- [ ] **Step 4: Commit**

```bash
git add src/pages/LoginPage.tsx src/pages/SignupPage.tsx
git commit -m "fix: make signup success a route so it survives the loading remount"
```

---

### Task 16: Update `AuthPages.stories.tsx` for prop-less `LoginPage`/`SignupPage`

**Files:**

- Modify: `src/stories/AuthPages.stories.tsx`

**Interfaces:**

- Consumes: nothing new — just adapts to `LoginPage`/`SignupPage` no longer taking `onSwitchToSignup`/`onSwitchToLogin` props (Task 15).

This file isn't mentioned by name in the spec, but it directly renders `LoginPage`/`SignupPage` with the props Task 15 just removed, so it won't compile without this update. The old `AuthFlow` combined story existed to demo the local `showSignup`/`showLogin` toggle that no longer exists (real navigation now goes through the router, which the bare `<MemoryRouter>` decorator — Task 18 — doesn't wire up `<Routes>` for); it's replaced by two standalone stories.

- [ ] **Step 1: Replace the file contents**

```tsx
// src/stories/AuthPages.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import { AuthContext, type AuthContextType } from "../contexts/AuthContext";

const mockAuthValue: AuthContextType = {
  user: null,
  userRoles: [],
  currentRole: null,
  loading: false,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  switchRole: () => {},
  hasRole: () => false,
  isAdmin: () => false,
  canManageClasses: () => false,
  canViewAllSchedules: () => false,
  clearApplicationState: () => {},
};

function MockAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Login Page Stories
const loginMeta: Meta<typeof LoginPage> = {
  title: "Pages/LoginPage",
  component: LoginPage,
  decorators: [
    Story => (
      <MockAuthProvider>
        <Story />
      </MockAuthProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default loginMeta;
type LoginStory = StoryObj<typeof loginMeta>;

export const LoginDefault: LoginStory = {
  render: () => <LoginPage />,
};

// Signup Page Stories
const signupMeta: Meta<typeof SignupPage> = {
  title: "Pages/SignupPage",
  component: SignupPage,
  decorators: [
    Story => (
      <MockAuthProvider>
        <Story />
      </MockAuthProvider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

type SignupStory = StoryObj<typeof signupMeta>;

export const SignupDefault: SignupStory = {
  render: () => <SignupPage />,
};
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors project-wide.

- [ ] **Step 3: Commit**

```bash
git add src/stories/AuthPages.stories.tsx
git commit -m "refactor: update AuthPages stories for prop-less LoginPage/SignupPage"
```

---

### Task 17: Add `vercel.json` SPA rewrite

**Files:**

- Create: `vercel.json`

- [ ] **Step 1: Write the file**

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Validate the JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8')); console.log('valid json')"
```

Expected: prints `valid json`.

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json SPA rewrite for client-side routing"
```

---

### Task 18: Add `MemoryRouter` to the Storybook preview decorator

**Files:**

- Modify: `.storybook/preview.tsx`

- [ ] **Step 1: Update the decorator**

Change:

```tsx
import type { Preview } from "@storybook/react";
import React from "react";
import { ConfigProvider } from "antd";
import heIL from "antd/locale/he_IL";
import "../src/utils/i18n";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    Story => (
      <ConfigProvider locale={heIL} direction="rtl">
        <div dir="rtl">
          <Story />
        </div>
      </ConfigProvider>
    ),
  ],
};

export default preview;
```

to:

```tsx
import type { Preview } from "@storybook/react";
import React from "react";
import { ConfigProvider } from "antd";
import heIL from "antd/locale/he_IL";
import { MemoryRouter } from "react-router-dom";
import "../src/utils/i18n";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    Story => (
      <ConfigProvider locale={heIL} direction="rtl">
        <div dir="rtl">
          <MemoryRouter>
            <Story />
          </MemoryRouter>
        </div>
      </ConfigProvider>
    ),
  ],
};

export default preview;
```

The `<MemoryRouter>` wraps _inside_ the existing `ConfigProvider`/RTL `<div dir="rtl">`, alongside it rather than replacing it — every story keeps Hebrew/RTL locale and now also has router context available for any component that calls `useNavigate()`/`useLocation()` (all of `Sidebar`, `Header`, `ProfileDropdown`, `SchedulePage`, `LoginPage`, `SignupPage` do, as of Tasks 8–15).

- [ ] **Step 2: Run Storybook and confirm no router-context errors**

```bash
npm run storybook -- --ci --quiet &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:6006
kill %1
```

Expected: HTTP `200`. (This is a smoke check that the dev server boots; do a full visual check in Task 19.)

- [ ] **Step 3: Commit**

```bash
git add .storybook/preview.tsx
git commit -m "chore: add MemoryRouter to Storybook preview decorator"
```

---

### Task 19: Full verification — typecheck, unit tests, lint, build, manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run the full unit test suite**

```bash
npx vitest run
```

Expected: all existing tests still pass, plus the 4 new `resolveGate` tests (Task 3).

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: 0 errors/warnings. Fix any `no-unused-vars` from now-dead imports (e.g. if any icon import became unused when a switch-case was dropped) before proceeding.

- [ ] **Step 4: Production build**

```bash
npm run build
```

Expected: builds successfully (this also re-runs `tsc`).

- [ ] **Step 5: Manual smoke test — start the dev server**

```bash
npm run dev
```

Then, using a browser (or the `claude-in-chrome` tools if available), walk the checklist from the spec's "Further Notes":

- Direct-visit `/schedule`, `/class-management`, `/students`, `/user-management/list`, `/user-management/pending-approvals`, `/profile-settings` while logged out → each redirects to `/login`.
- Log in, then direct-visit each of those routes again → each renders the right page; non-admin visiting `/class-management`/`/students`/`/user-management/list`/`/user-management/pending-approvals` redirects to `/schedule`.
- Reload the browser while on `/schedule` (or any authenticated page) → stays on that page, doesn't lose place.
- Use browser back/forward after navigating between two sidebar pages → moves between them instead of exiting the app.
- Visit `/login` or `/signup` while already logged in → redirects into the app.
- Sign up with a new email → lands on `/signup/verify-email` showing the persistent confirmation (the bug fix) → reload that page directly (without the `fromSignup` state) → redirects to `/signup` (confirms it isn't bookmarkable).
- Sidebar/Header active-state and title match the current URL on every page.
- Trigger the `ContextErrorBoundary` fallback (e.g. temporarily throw in a component) and click "Go to Login" → lands on a working `/login` page.
- `npm run storybook` → open `Pages/LoginPage` and `Pages/SignupPage` stories, confirm they render without router-context errors.

- [ ] **Step 6: Report results**

Summarize which checklist items passed/failed in the PR description (Task 20) — do not claim the feature works without having actually run this checklist.

---

### Task 20: Open the pull request

**Files:** none

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feature/app-routing
```

- [ ] **Step 2: Open the PR against `main`**

```bash
gh pr create --title "Add URL-based routing (react-router-dom)" --body "$(cat <<'EOF'
## Summary
- Replaces `App.tsx`'s `useState`-driven page switching with a real `react-router-dom` `createBrowserRouter` tree, so every page has an addressable URL and back/forward/refresh work.
- Extracts the auth/profile/role redirect decision into a pure, unit-tested `resolveGate` function, used by route guards for the authenticated app, the public auth routes, and the two onboarding routes.
- Fixes a real bug along the way: `SignupPage`'s "check your email" success view could never render, because the shared bootstrap `loading` flag unmounts/remounts the page mid-signup, wiping its local `success` state. Signup success is now a route (`/signup/verify-email`) reached via `navigate()`, which survives that remount.
- Adds a `vercel.json` SPA rewrite and a `MemoryRouter` Storybook decorator so direct/refreshed navigation and Storybook both keep working.

Closes #76.

## Test plan
- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Manual smoke test per Task 19 of the implementation plan (`docs/superpowers/plans/2026-09-11-url-based-routing.md`)
EOF
)"
```

- [ ] **Step 3: Share the PR URL with the user**

Report the PR URL back. Per project convention ([[close_issues_after_merge]]), do **not** close issue #76 now — it closes automatically on merge via the "Closes #76" line, or should be left for the user to close manually if the PR isn't set to auto-merge.
