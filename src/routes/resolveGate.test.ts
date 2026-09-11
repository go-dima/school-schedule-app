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
