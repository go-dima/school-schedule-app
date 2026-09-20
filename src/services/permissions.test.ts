import { describe, expect, it } from "vitest";
import type { UserRole, UserRoleData } from "../types";
import { getPermissions } from "./permissions";

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

describe("getPermissions", () => {
  it("grants full permissions for an approved admin", () => {
    const permissions = getPermissions([roleData("admin")]);

    expect(permissions).toEqual({
      canManageClasses: true,
      canCreateClasses: true,
      canDeleteClasses: true,
      canViewAllSchedules: true,
      canManageRoster: true,
      canApproveSignups: true,
      canAdjustRoles: true,
    });
  });

  it("grants staff permissions excluding creation/deletion/approval", () => {
    const permissions = getPermissions([roleData("staff")]);

    expect(permissions).toEqual({
      canManageClasses: true,
      canCreateClasses: false,
      canDeleteClasses: false,
      canViewAllSchedules: true,
      canManageRoster: true,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });

  it("grants moderator class management/create/delete but not roster/schedules/approval", () => {
    const permissions = getPermissions([roleData("moderator")]);

    expect(permissions).toEqual({
      canManageClasses: true,
      canCreateClasses: true,
      canDeleteClasses: true,
      canViewAllSchedules: false,
      canManageRoster: false,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });

  it("denies all permissions for parent/child roles", () => {
    const permissions = getPermissions([roleData("parent"), roleData("child")]);

    expect(permissions).toEqual({
      canManageClasses: false,
      canCreateClasses: false,
      canDeleteClasses: false,
      canViewAllSchedules: false,
      canManageRoster: false,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });

  it("stacks staff + moderator into class management, roster/schedules, and create/delete, but not approval", () => {
    const permissions = getPermissions([
      roleData("staff"),
      roleData("moderator"),
    ]);

    expect(permissions).toEqual({
      canManageClasses: true,
      canCreateClasses: true,
      canDeleteClasses: true,
      canViewAllSchedules: true,
      canManageRoster: true,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });

  it("grants full permissions for admin + moderator", () => {
    const permissions = getPermissions([
      roleData("admin"),
      roleData("moderator"),
    ]);

    expect(permissions).toEqual({
      canManageClasses: true,
      canCreateClasses: true,
      canDeleteClasses: true,
      canViewAllSchedules: true,
      canManageRoster: true,
      canApproveSignups: true,
      canAdjustRoles: true,
    });
  });

  it("applies the approval filter per-role within a multi-role user (approved staff + unapproved moderator)", () => {
    const permissions = getPermissions([
      roleData("staff", true),
      roleData("moderator", false),
    ]);

    expect(permissions).toEqual({
      canManageClasses: true,
      canCreateClasses: false,
      canDeleteClasses: false,
      canViewAllSchedules: true,
      canManageRoster: true,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });

  it("ignores unapproved roles", () => {
    const permissions = getPermissions([roleData("admin", false)]);

    expect(permissions).toEqual({
      canManageClasses: false,
      canCreateClasses: false,
      canDeleteClasses: false,
      canViewAllSchedules: false,
      canManageRoster: false,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });

  it("returns all-false permissions for an empty role list", () => {
    const permissions = getPermissions([]);

    expect(permissions).toEqual({
      canManageClasses: false,
      canCreateClasses: false,
      canDeleteClasses: false,
      canViewAllSchedules: false,
      canManageRoster: false,
      canApproveSignups: false,
      canAdjustRoles: false,
    });
  });
});
