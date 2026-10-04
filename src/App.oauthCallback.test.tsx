// @vitest-environment jsdom
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Reproduces the Google OAuth session-loss bug: the implicit-flow callback
// lands on `/#access_token=...`, and supabase-js reads that hash only after
// its async initialization (behind a navigator lock). If the router renders
// first, AuthGate's <Navigate to="/login" replace /> rewrites the URL and the
// token is gone before supabase-js ever sees it. This hit returning users and
// new signups alike.

type AuthChangeHandler = (user: any) => void;
const authCallbacks: AuthChangeHandler[] = [];

// Approved roles returned for the signed-in user; set per test.
let mockRoles: any[] = [];

vi.mock("./services/api", () => ({
  authApi: {
    onAuthStateChange: vi.fn((cb: AuthChangeHandler) => {
      authCallbacks.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(() => Promise.resolve()),
  },
  usersApi: {
    getUserProfile: vi.fn(() =>
      Promise.resolve({
        id: "user-1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        createdAt: "",
        updatedAt: "",
      })
    ),
    getUserRoles: vi.fn(() => Promise.resolve(mockRoles)),
  },
}));

// The pages and data contexts aren't under test; stub them so the real
// router and guards run without pulling in the whole app.
const passthrough = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);
vi.mock("./contexts/ChildContext", () => ({ ChildProvider: passthrough }));
vi.mock("./contexts/AllChildrenContext", () => ({
  AllChildrenProvider: passthrough,
}));
vi.mock("./layouts/AppLayout", async () => {
  const { Outlet } = await import("react-router-dom");
  return { default: () => <Outlet /> };
});
vi.mock("./pages/LoginPage", () => ({ default: () => <div>login page</div> }));
vi.mock("./pages/SignupPage", () => ({ default: () => null }));
vi.mock("./pages/SignupVerifyEmailPage", () => ({ default: () => null }));
vi.mock("./pages/ProfileSetupPage", () => ({ default: () => null }));
vi.mock("./pages/PendingApprovalPage", () => ({
  default: () => <div>pending approval page</div>,
}));
vi.mock("./pages/SchedulePage", () => ({
  default: () => <div>schedule page</div>,
}));
vi.mock("./pages/ClassManagementPage", () => ({ default: () => null }));
vi.mock("./pages/StudentsPage", () => ({ default: () => null }));
vi.mock("./pages/UserListPage", () => ({ default: () => null }));
vi.mock("./pages/PendingApprovalsPage", () => ({ default: () => null }));
vi.mock("./pages/ProfileSettingsPage", () => ({ default: () => null }));

// jsdom's AbortSignal isn't accepted by Node's fetch Request, which the data
// router builds on every navigation. No route here has a loader, so a
// minimal stand-in is enough.
vi.stubGlobal(
  "Request",
  class {
    url: string;
    method: string;
    signal: AbortSignal | undefined;
    constructor(
      url: string | URL,
      init?: { method?: string; signal?: AbortSignal }
    ) {
      this.url = String(url);
      this.method = init?.method ?? "GET";
      this.signal = init?.signal;
    }
  }
);

const CALLBACK_HASH =
  "#access_token=tok&expires_in=3600&refresh_token=ref&token_type=bearer";

const APPROVED_PARENT_ROLE = {
  id: "role-1",
  userId: "user-1",
  role: "parent",
  approved: true,
  createdAt: "",
  updatedAt: "",
};

const settle = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
  });

// Lands on the callback URL and renders the app before supabase-js has
// initialized. The router is created at module load from the current URL,
// so each test imports a fresh copy after setting it.
async function landOnCallback() {
  window.history.replaceState(null, "", `/${CALLBACK_HASH}`);
  const { default: App } = await import("./App");
  render(<App />);
  await settle();
}

// supabase-js finishes initializing: like the real _initialize(), it finds a
// session only if the #access_token hash is still in the URL when it looks,
// clears the hash, and emits INITIAL_SESSION.
async function supabaseInitializes() {
  const tokenStillInUrl = window.location.hash.includes("access_token=");
  if (tokenStillInUrl) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  await act(async () => {
    authCallbacks[authCallbacks.length - 1](
      tokenStillInUrl ? { id: "user-1" } : null
    );
  });
  await settle();
}

describe("App on the OAuth callback URL", () => {
  beforeEach(() => {
    vi.resetModules();
    authCallbacks.length = 0;
    mockRoles = [];
  });

  it("keeps the #access_token hash until supabase-js reports the initial session", async () => {
    await landOnCallback();

    // No auth event delivered yet: nothing may have touched the URL, and no
    // guard may have redirected.
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe(CALLBACK_HASH);
    expect(screen.queryByText("login page")).toBeNull();
  });

  it("signs an existing approved user in, not back to /login", async () => {
    mockRoles = [APPROVED_PARENT_ROLE];
    await landOnCallback();
    await supabaseInitializes();

    expect(window.location.pathname).toBe("/schedule");
    expect(screen.getByText("schedule page")).toBeTruthy();
    expect(screen.queryByText("login page")).toBeNull();
  });

  it("routes a new Google signup to pending approval, not back to /login", async () => {
    await landOnCallback();
    await supabaseInitializes();

    expect(window.location.pathname).toBe("/pending-approval");
    expect(screen.getByText("pending approval page")).toBeTruthy();
  });
});
