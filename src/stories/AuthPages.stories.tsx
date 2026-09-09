import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
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

function LoginWrapper() {
  const [_showSignup, setShowSignup] = useState(false);

  return <LoginPage onSwitchToSignup={() => setShowSignup(true)} />;
}

export const LoginDefault: LoginStory = {
  render: () => <LoginWrapper />,
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

function SignupWrapper() {
  const [_showLogin, setShowLogin] = useState(false);

  return <SignupPage onSwitchToLogin={() => setShowLogin(true)} />;
}

export const SignupDefault: SignupStory = {
  render: () => <SignupWrapper />,
};

// Combined Auth Flow Story
function AuthFlowWrapper() {
  const [showSignup, setShowSignup] = useState(false);

  if (showSignup) {
    return <SignupPage onSwitchToLogin={() => setShowSignup(false)} />;
  }

  return <LoginPage onSwitchToSignup={() => setShowSignup(true)} />;
}

export const AuthFlow: StoryObj = {
  render: () => <AuthFlowWrapper />,
  parameters: {
    docs: {
      description: {
        story: "מציג את התזרים המלא של התחברות והרשמה עם מעברים בין הדפים",
      },
    },
  },
};
