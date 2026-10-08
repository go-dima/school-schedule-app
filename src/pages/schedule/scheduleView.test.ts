import { describe, expect, it } from "vitest";
import { defaultScheduleView, resolveScheduleView } from "./scheduleView";
import type { ScheduleViewInput, ScheduleViewMode } from "./scheduleView";

type Role = "admin/staff" | "admin/staff, no name" | "parent" | "staff+parent";

const ROLES: Record<
  Role,
  Pick<
    ScheduleViewInput,
    "canUseStaffView" | "canUseMyView" | "canPickSchedule"
  >
> = {
  "admin/staff": {
    canUseStaffView: true,
    canUseMyView: true,
    canPickSchedule: false,
  },
  "admin/staff, no name": {
    canUseStaffView: true,
    canUseMyView: false,
    canPickSchedule: false,
  },
  parent: {
    canUseStaffView: false,
    canUseMyView: false,
    canPickSchedule: true,
  },
  "staff+parent": {
    canUseStaffView: true,
    canUseMyView: true,
    canPickSchedule: true,
  },
};

// [role, platform, view param, expected view]
const MATRIX: [Role, "mobile" | "desktop", string | null, ScheduleViewMode][] =
  [
    ["admin/staff", "mobile", null, "mine"],
    ["admin/staff", "mobile", "student", "student"],
    ["admin/staff", "mobile", "mine", "mine"],
    ["admin/staff", "mobile", "staff", "staff"],
    ["admin/staff", "desktop", null, "student"],
    ["admin/staff", "desktop", "student", "student"],
    ["admin/staff", "desktop", "mine", "mine"],
    ["admin/staff", "desktop", "staff", "staff"],
    ["admin/staff, no name", "mobile", null, "student"],
    ["admin/staff, no name", "mobile", "mine", "student"],
    ["admin/staff, no name", "mobile", "staff", "staff"],
    ["admin/staff, no name", "desktop", null, "student"],
    ["parent", "mobile", null, "student"],
    ["parent", "mobile", "mine", "student"],
    ["parent", "mobile", "staff", "student"],
    ["parent", "desktop", null, "student"],
    ["staff+parent", "mobile", null, "student"],
    ["staff+parent", "desktop", null, "student"],
    ["staff+parent", "desktop", "mine", "mine"],
  ];

describe("resolveScheduleView", () => {
  it.each(MATRIX)(
    "%s on %s with view=%s -> %s",
    (role, platform, viewParam, expected) => {
      expect(resolveScheduleView({ platform, viewParam, ...ROLES[role] })).toBe(
        expected
      );
    }
  );
});

describe("defaultScheduleView", () => {
  it("is My Schedule only for pure staff on mobile", () => {
    expect(
      defaultScheduleView({ platform: "mobile", ...ROLES["admin/staff"] })
    ).toBe("mine");
    expect(
      defaultScheduleView({ platform: "desktop", ...ROLES["admin/staff"] })
    ).toBe("student");
  });
});
