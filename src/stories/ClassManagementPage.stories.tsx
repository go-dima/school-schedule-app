import type { Meta, StoryObj } from "@storybook/react";
import ClassManagementPage from "../pages/ClassManagementPage";
import { AuthContext, type AuthContextType } from "../contexts/AuthContext";
import type { UserRoleData } from "../types";

// Note: ClassManagementPage fetches its data internally via classesApi,
// timeSlotsApi and EnrollmentService (real Supabase calls). There is no
// mocking setup for Supabase calls in this Storybook instance, so this story
// demonstrates the page's loading/error shell rather than a populated table -
// the fetch will simply fail (or hang) in this environment.
const adminRole: UserRoleData = {
  id: "role-1",
  userId: "user-1",
  role: "admin",
  approved: true,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

const mockAuthValue: AuthContextType = {
  user: null,
  userRoles: [adminRole],
  currentRole: adminRole,
  loading: false,
  error: null,
  signIn: async () => {},
  signInWithGoogle: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  switchRole: () => {},
  hasRole: () => true,
  isAdmin: () => true,
  canManageClasses: () => true,
  canViewAllSchedules: () => true,
  clearApplicationState: () => {},
};

function MockAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      {children}
    </AuthContext.Provider>
  );
}

const meta: Meta<typeof ClassManagementPage> = {
  title: "Pages/ClassManagementPage",
  component: ClassManagementPage,
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

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
