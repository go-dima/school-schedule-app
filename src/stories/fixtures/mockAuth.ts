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
