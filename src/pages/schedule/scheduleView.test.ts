import { describe, expect, it } from "vitest";
import { resolveScheduleTab, viewParamFor } from "./scheduleView";
import type { ScheduleTab, ScheduleTabInput } from "./scheduleView";

type Role = "staff" | "staff, no name" | "staff+parent" | "parent" | "child";
type Platform = ScheduleTabInput["platform"];
/** `?view=` values: none, each tab, and one the page does not know. */
type Param = "none" | "student" | "mine" | "staff" | "unknown";

const ROLES: Record<
  Role,
  Pick<ScheduleTabInput, "canUseStaffView" | "canUseMyView" | "canPickSchedule">
> = {
  staff: { canUseStaffView: true, canUseMyView: true, canPickSchedule: false },
  "staff, no name": {
    canUseStaffView: true,
    canUseMyView: false,
    canPickSchedule: false,
  },
  "staff+parent": {
    canUseStaffView: true,
    canUseMyView: true,
    canPickSchedule: true,
  },
  parent: {
    canUseStaffView: false,
    canUseMyView: false,
    canPickSchedule: true,
  },
  child: { canUseStaffView: false, canUseMyView: false, canPickSchedule: true },
};

const PARAM_VALUE: Record<Param, string | null> = {
  none: null,
  student: "student",
  mine: "mine",
  staff: "staff",
  unknown: "bogus",
};

const ALL_STUDENT: Record<Param, ScheduleTab> = {
  none: "student",
  student: "student",
  mine: "student",
  staff: "student",
  unknown: "student",
};

/** Expected tab for every role x platform x param. */
const RESOLVED: Record<Role, Record<Platform, Record<Param, ScheduleTab>>> = {
  staff: {
    mobile: {
      none: "mine",
      student: "student",
      mine: "mine",
      staff: "staff",
      unknown: "mine",
    },
    desktop: {
      none: "student",
      student: "student",
      mine: "mine",
      staff: "staff",
      unknown: "student",
    },
  },
  "staff, no name": {
    mobile: {
      none: "student",
      student: "student",
      mine: "student",
      staff: "staff",
      unknown: "student",
    },
    desktop: {
      none: "student",
      student: "student",
      mine: "student",
      staff: "staff",
      unknown: "student",
    },
  },
  // Keeps the parent view by default on both platforms (ADR 0004).
  "staff+parent": {
    mobile: {
      none: "student",
      student: "student",
      mine: "mine",
      staff: "staff",
      unknown: "student",
    },
    desktop: {
      none: "student",
      student: "student",
      mine: "mine",
      staff: "staff",
      unknown: "student",
    },
  },
  parent: { mobile: ALL_STUDENT, desktop: ALL_STUDENT },
  child: { mobile: ALL_STUDENT, desktop: ALL_STUDENT },
};

/** Expected `?view=` write (null = drop it) for every role x platform x tab. */
const NO_PARAM_FOR_STUDENT: Record<ScheduleTab, ScheduleTab | null> = {
  student: null,
  mine: "mine",
  staff: "staff",
};
const WRITTEN: Record<
  Role,
  Record<Platform, Record<ScheduleTab, ScheduleTab | null>>
> = {
  staff: {
    mobile: { student: "student", mine: null, staff: "staff" },
    desktop: NO_PARAM_FOR_STUDENT,
  },
  "staff, no name": {
    mobile: NO_PARAM_FOR_STUDENT,
    desktop: NO_PARAM_FOR_STUDENT,
  },
  "staff+parent": {
    mobile: NO_PARAM_FOR_STUDENT,
    desktop: NO_PARAM_FOR_STUDENT,
  },
  parent: { mobile: NO_PARAM_FOR_STUDENT, desktop: NO_PARAM_FOR_STUDENT },
  child: { mobile: NO_PARAM_FOR_STUDENT, desktop: NO_PARAM_FOR_STUDENT },
};

const entries = <K extends string, V>(r: Record<K, V>) =>
  Object.entries(r) as [K, V][];

const RESOLVE_CASES = entries(RESOLVED).flatMap(([role, byPlatform]) =>
  entries(byPlatform).flatMap(([platform, byParam]) =>
    entries(byParam).map(
      ([param, expected]) => [role, platform, param, expected] as const
    )
  )
);

const WRITE_CASES = entries(WRITTEN).flatMap(([role, byPlatform]) =>
  entries(byPlatform).flatMap(([platform, byTab]) =>
    entries(byTab).map(
      ([tab, expected]) => [role, platform, tab, expected] as const
    )
  )
);

describe("resolveScheduleTab", () => {
  it("covers the full role x platform x param matrix", () => {
    expect(RESOLVE_CASES).toHaveLength(5 * 2 * 5);
  });

  it.each(RESOLVE_CASES)(
    "%s on %s with view=%s -> %s",
    (role, platform, param, expected) => {
      expect(
        resolveScheduleTab({
          platform,
          viewParam: PARAM_VALUE[param],
          ...ROLES[role],
        })
      ).toBe(expected);
    }
  );
});

describe("viewParamFor", () => {
  it("covers the full role x platform x tab matrix", () => {
    expect(WRITE_CASES).toHaveLength(5 * 2 * 3);
  });

  it.each(WRITE_CASES)(
    "%s on %s picking %s writes view=%s",
    (role, platform, tab, expected) => {
      expect(viewParamFor(tab, { platform, ...ROLES[role] })).toBe(expected);
    }
  );
});
