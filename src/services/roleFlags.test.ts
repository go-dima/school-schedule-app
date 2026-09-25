import { describe, expect, it } from "vitest";
import type { UserRole, UserRoleData } from "../types";
import { getRoleFlags, pickDefaultRole } from "./roleFlags";

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

describe("pickDefaultRole", () => {
  it("prefers staff over moderator", () => {
    expect(pickDefaultRole([roleData("staff"), roleData("moderator")])).toEqual(
      roleData("staff")
    );
  });

  it("prefers child over parent", () => {
    expect(pickDefaultRole([roleData("parent"), roleData("child")])).toEqual(
      roleData("child")
    );
  });

  it("picks moderator when it is the only role", () => {
    expect(pickDefaultRole([roleData("moderator")])).toEqual(
      roleData("moderator")
    );
  });

  it("returns null for an empty role list", () => {
    expect(pickDefaultRole([])).toBeNull();
  });

  it("ignores unapproved roles", () => {
    expect(
      pickDefaultRole([roleData("staff", false), roleData("moderator")])
    ).toEqual(roleData("moderator"));
  });

  it("returns null when no role is approved", () => {
    expect(pickDefaultRole([roleData("admin", false)])).toBeNull();
  });

  it("picks the same role regardless of input order", () => {
    const roles = [roleData("moderator"), roleData("staff"), roleData("admin")];

    expect(pickDefaultRole(roles)).toEqual(
      pickDefaultRole([...roles].reverse())
    );
    expect(pickDefaultRole(roles)).toEqual(roleData("staff"));
  });
});
