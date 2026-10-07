import React from "react";
import { Route, Routes } from "react-router-dom";
import MobileAppLayout from "../../layouts/MobileAppLayout";
import {
  AuthContext,
  type AuthContextType,
} from "../../contexts/AuthContextObject";
import { UiModeContext } from "../../contexts/UiModeContextObject";
import type { UiMode } from "../../services/uiMode";
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

const mockParentAuth: AuthContextType = {
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

/** Renders `page` as the routed content of the real mobile app shell,
 * signed in as a parent. */
export const MobileShell: React.FC<{
  page: React.ReactNode;
  detected?: UiMode;
}> = ({ page, detected = "mobile" }) => (
  <AuthContext.Provider value={mockParentAuth}>
    <UiModeContext.Provider
      value={{
        mode: "mobile",
        detected,
        override: null,
        setOverride: () => {},
      }}>
      <Routes>
        <Route element={<MobileAppLayout />}>
          <Route path="*" element={page} />
        </Route>
      </Routes>
    </UiModeContext.Provider>
  </AuthContext.Provider>
);
