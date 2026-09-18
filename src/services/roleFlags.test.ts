import { describe, expect, it } from "vitest";
import type { UserRole, UserRoleData } from "../types";
import { getRoleFlags } from "./roleFlags";

const roleData = (
  role: UserRole,
  approved = true,
  overrides: Partial<UserRoleData> = {}
): UserRoleData => ({
  id: `${role}-id`,
  userId: "user-1",
  role,
  approved,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

describe("getRoleFlags", () => {
  it("flags an approved admin", () => {
    expect(getRoleFlags([roleData("admin")])).toEqual({
      isAdmin: true,
      isStaff: false,
      isModerator: false,
      isParent: false,
      isChild: false,
    });
  });

  it("flags an approved staff member", () => {
    expect(getRoleFlags([roleData("staff")])).toEqual({
      isAdmin: false,
      isStaff: true,
      isModerator: false,
      isParent: false,
      isChild: false,
    });
  });

  it("flags an approved moderator", () => {
    expect(getRoleFlags([roleData("moderator")])).toEqual({
      isAdmin: false,
      isStaff: false,
      isModerator: true,
      isParent: false,
      isChild: false,
    });
  });

  it("flags multiple stacked roles at once", () => {
    expect(getRoleFlags([roleData("staff"), roleData("moderator")])).toEqual({
      isAdmin: false,
      isStaff: true,
      isModerator: true,
      isParent: false,
      isChild: false,
    });
  });

  it("flags parent and child roles", () => {
    expect(getRoleFlags([roleData("parent"), roleData("child")])).toEqual({
      isAdmin: false,
      isStaff: false,
      isModerator: false,
      isParent: true,
      isChild: true,
    });
  });

  it("ignores unapproved roles", () => {
    expect(getRoleFlags([roleData("admin", false)])).toEqual({
      isAdmin: false,
      isStaff: false,
      isModerator: false,
      isParent: false,
      isChild: false,
    });
  });

  it("returns all-false flags for an empty role list", () => {
    expect(getRoleFlags([])).toEqual({
      isAdmin: false,
      isStaff: false,
      isModerator: false,
      isParent: false,
      isChild: false,
    });
  });
});
