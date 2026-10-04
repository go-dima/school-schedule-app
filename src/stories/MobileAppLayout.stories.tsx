import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "antd";
import { Route, Routes } from "react-router-dom";
import MobileAppLayout from "../layouts/MobileAppLayout";
import {
  AuthContext,
  type AuthContextType,
} from "../contexts/AuthContextObject";
import { UiModeContext } from "../contexts/UiModeContextObject";
import type { UserRoleData } from "../types";

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

const mockAuthValue: AuthContextType = {
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

const meta: Meta<typeof MobileAppLayout> = {
  title: "Layouts/MobileAppLayout",
  component: MobileAppLayout,
  decorators: [
    Story => (
      <AuthContext.Provider value={mockAuthValue}>
        <UiModeContext.Provider
          value={{
            mode: "mobile",
            detected: "mobile",
            override: null,
            setOverride: () => {},
          }}>
          <Routes>
            <Route element={<Story />}>
              <Route
                path="*"
                element={<Card>תוכן העמוד מוצג כאן ברוחב מלא</Card>}
              />
            </Route>
          </Routes>
        </UiModeContext.Provider>
      </AuthContext.Provider>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};

export default meta;
type Story = StoryObj<typeof MobileAppLayout>;

export const Parent: Story = {};
