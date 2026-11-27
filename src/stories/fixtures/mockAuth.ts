import type { AuthContextType } from "../../contexts/AuthContextObject";
import type { UserRoleData } from "../../types";

// A parent: no admin menu items, so the shell never calls the pending
// approvals API (there is no Supabase mocking in Storybook).
const parentRole: UserRoleData = {
  id: "role-1",
  userId: "user-1",
  role: "parent",
  approved: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

export const mockParentAuth: AuthContextType = {
  user: { firstName: "דנה", lastName: "כהן", email: "dana@example.com" },
  userRoles: [parentRole],
  currentRole: parentRole,
  loading: false,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  switchRole: () => {},
  hasRole: role => role === "parent",
  permissions: {
    canManageClasses: false,
    canCreateClasses: false,
    canDeleteClasses: false,
    canViewAllSchedules: false,
    canManageRoster: false,
    canApproveSignups: false,
    canAdjustRoles: false,
    canPickSchedule: true,
    canManageChildren: true,
  },
  roleFlags: {
    isAdmin: false,
    isStaff: false,
    isModerator: false,
    isParent: true,
    isChild: false,
  },
};

const adminRole: UserRoleData = {
  id: "role-admin-1",
  userId: "admin-1",
  role: "admin",
  approved: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

// An admin with every permission, for the admin-only pages. Unlike
// mockParentAuth it has a user id, so hooks that wait for one start loading.
// Use it only on pages (not the app shell, which calls Supabase for admins),
// with their service calls stubbed (see stubApis.tsx).
export const mockAdminAuth: AuthContextType = {
  ...mockParentAuth,
  user: {
    id: "admin-1",
    firstName: "אורית",
    lastName: "שמש",
    email: "orit@example.com",
  },
  userRoles: [adminRole],
  currentRole: adminRole,
  hasRole: () => true,
  permissions: {
    canManageClasses: true,
    canCreateClasses: true,
    canDeleteClasses: true,
    canViewAllSchedules: true,
    canManageRoster: true,
    canApproveSignups: true,
    canAdjustRoles: true,
    canPickSchedule: false,
    canManageChildren: false,
  },
  roleFlags: {
    isAdmin: true,
    isStaff: false,
    isModerator: false,
    isParent: false,
    isChild: false,
  },
};
