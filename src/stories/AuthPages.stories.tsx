import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "@storybook/testing-library";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import {
  AuthContext,
  type AuthContextType,
} from "../contexts/AuthContextObject";

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
  permissions: {
    canManageClasses: false,
    canCreateClasses: false,
    canDeleteClasses: false,
    canViewAllSchedules: false,
    canManageRoster: false,
    canApproveSignups: false,
    canAdjustRoles: false,
    canPickSchedule: false,
    canManageChildren: false,
  },
  roleFlags: {
    isAdmin: false,
    isStaff: false,
    isModerator: false,
    isParent: false,
    isChild: false,
  },
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

// The signup entry point is a full-width button under the Google button.
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

// No role chosen yet: both signup buttons disabled, "choose your role" hint.
export const SignupDefault: SignupStory = {
  render: () => <SignupPage />,
};

// A role chosen: the hint goes away and both buttons are enabled.
export const SignupRoleChosen: SignupStory = {
  render: () => <SignupPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("radio", { name: "הורה" }));
  },
};
