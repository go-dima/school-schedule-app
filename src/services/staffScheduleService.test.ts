import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithChildName,
  TimeSlot,
} from "../types";
import { classesApi, scheduleOverridesApi } from "./api";
import { ScheduleService } from "./scheduleService";
import { StaffScheduleService } from "./staffScheduleService";

vi.mock("./api", () => ({
  classesApi: {
    getTeacherTitlePairs: vi.fn(),
    getClassesByTeacher: vi.fn(),
  },
  scheduleOverridesApi: {
    getOverridesByTeacher: vi.fn(),
  },
}));

const timeSlot = (
  id: string,
  startTime: string,
  endTime: string
): TimeSlot => ({
  id,
  name: id,
  startTime,
  endTime,
  createdAt: "",
  updatedAt: "",
});

const tsFirst = timeSlot("ts-first", "08:00", "08:45");
const tsSecond = timeSlot("ts-second", "08:45", "09:30");

const makeClass = (
  overrides: Partial<ClassWithTimeSlot> = {}
): ClassWithTimeSlot => ({
  id: "class-1",
  title: "מתמטיקה",
  description: "",
  teacher: "דנה",
  slots: [{ dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
  grades: [3],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "חדר 1",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const makeOverride = (
  overrides: Partial<ScheduleOverrideWithChildName> = {}
): ScheduleOverrideWithChildName => ({
  id: "override-1",
  childId: "child-1",
  childName: "נועה לוי",
  title: "תגבור",
  teacher: "דנה",
  room: "חדר 7",
  dayOfWeek: 1,
  timeSlotId: tsFirst.id,
  timeSlot: tsFirst,
  scope: "prod",
  createdBy: "staff-1",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const build = (input: {
  catalog?: ClassWithTimeSlot[];
  selections?: ClassWithTimeSlot[];
  overrides?: ScheduleOverrideWithChildName[];
}) =>
  StaffScheduleService.buildStaffView({
    catalog: input.catalog ?? [],
    selections: input.selections ?? [],
    overrides: input.overrides ?? [],
  });

const conflictsOf = (
  view: ReturnType<typeof build>,
  cls: ClassWithTimeSlot
): boolean => ScheduleService.hasTimeConflict(view.userSelections, cls);

describe("StaffScheduleService.buildStaffView", () => {
  it("places catalog classes in the grid and marks them all selected", () => {
    const view = build({ catalog: [makeClass()] });

    expect(view.weeklySchedule[0][tsFirst.id].map(c => c.id)).toEqual([
      "class-1",
    ]);
    expect(view.selectedClasses).toEqual(["class-1"]);
  });

  it("excludes Special Classes, including כישורי חיים", () => {
    const view = build({
      catalog: [
        makeClass({ id: "a", title: "חונכות" }),
        makeClass({ id: "b", title: "שילוב" }),
        makeClass({ id: "c", title: "מחויבות אישית" }),
        makeClass({ id: "d", title: "כישורי חיים" }),
        makeClass({ id: "e", title: "מתמטיקה" }),
      ],
    });

    expect(view.classes.map(c => c.id)).toEqual(["e"]);
  });

  it("groups overrides by title, day and slot into one entry listing the children", () => {
    const view = build({
      overrides: [
        makeOverride({ id: "o1", childId: "c1", childName: "נועה לוי" }),
        makeOverride({ id: "o2", childId: "c2", childName: "אבי כהן" }),
        makeOverride({
          id: "o3",
          childId: "c3",
          childName: "רון",
          dayOfWeek: 2,
        }),
      ],
    });

    const monday = view.weeklySchedule[1][tsFirst.id];
    expect(monday).toHaveLength(1);
    expect(monday[0].title).toBe("תגבור");
    expect(monday[0].teacher).toBe("אבי כהן, נועה לוי");
    expect(monday[0].grades).toEqual([]);
    expect(view.extraEnrollmentCounts.get(monday[0].id)).toBe(2);

    expect(view.weeklySchedule[2][tsFirst.id]).toHaveLength(1);
    expect(view.classes).toHaveLength(2);
  });

  it("keeps overrides with different titles in the same slot apart (and in conflict)", () => {
    const view = build({
      overrides: [
        makeOverride({ id: "o1", title: "תגבור" }),
        makeOverride({ id: "o2", title: "קריאה", childId: "c2" }),
      ],
    });

    const cell = view.weeklySchedule[1][tsFirst.id];
    expect(cell).toHaveLength(2);
    expect(cell.every(cls => conflictsOf(view, cls))).toBe(true);
  });

  it("flags a catalog class and an override sharing a slot as a conflict", () => {
    const view = build({
      catalog: [
        makeClass({
          slots: [{ dayOfWeek: 1, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
        }),
      ],
      overrides: [makeOverride()],
    });

    const cell = view.weeklySchedule[1][tsFirst.id];
    expect(cell).toHaveLength(2);
    expect(cell.every(cls => conflictsOf(view, cls))).toBe(true);
  });

  it("flags two catalog classes sharing a slot as a conflict", () => {
    const view = build({
      catalog: [
        makeClass({ id: "a" }),
        makeClass({ id: "b", title: "אנגלית" }),
      ],
    });

    expect(view.classes.every(cls => conflictsOf(view, cls))).toBe(true);
  });

  it("does not flag a grouped override against itself", () => {
    const view = build({
      overrides: [
        makeOverride({ id: "o1", childId: "c1" }),
        makeOverride({ id: "o2", childId: "c2", childName: "אבי" }),
      ],
    });

    expect(view.classes).toHaveLength(1);
    expect(conflictsOf(view, view.classes[0])).toBe(false);
  });

  it("keeps both slots of a double lesson without a self-conflict", () => {
    const double = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const view = build({ catalog: [double] });

    expect(view.weeklySchedule[0][tsFirst.id]).toEqual([double]);
    expect(view.weeklySchedule[0][tsSecond.id]).toEqual([double]);
    expect(conflictsOf(view, double)).toBe(false);
  });

  it("merges the selections stream without duplicating catalog classes", () => {
    const shared = makeClass({ id: "shared" });
    const special = makeClass({
      id: "special",
      title: "חונכות",
      slots: [{ dayOfWeek: 3, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
    });
    const view = build({ catalog: [shared], selections: [shared, special] });

    expect(view.classes.map(c => c.id)).toEqual(["shared", "special"]);
  });
});

describe("StaffScheduleService.toStaffMembers", () => {
  it("returns distinct, trimmed, alphabetical names", () => {
    expect(
      StaffScheduleService.toStaffMembers([
        { teacher: " רונית ", title: "מתמטיקה" },
        { teacher: "רונית", title: "אנגלית" },
        { teacher: "אבי", title: "ספורט" },
        { teacher: "", title: "אמנות" },
      ])
    ).toEqual([
      { name: "אבי", teaches: true },
      { name: "רונית", teaches: true },
    ]);
  });

  it("excludes the generic mentor placeholder", () => {
    expect(
      StaffScheduleService.toStaffMembers([
        { teacher: "חונך", title: "מתמטיקה" },
        { teacher: " חונך ", title: "אנגלית" },
      ])
    ).toEqual([]);
  });

  it("lists staff with no regular lessons last, alphabetically, not by lesson count", () => {
    expect(
      StaffScheduleService.toStaffMembers([
        { teacher: "תמר", title: "כישורי חיים" },
        { teacher: "אורי", title: "שילוב" },
        { teacher: "יעל", title: "שילוב" },
        { teacher: "יעל", title: "מדעים" },
        { teacher: "בני", title: "ספורט" },
        { teacher: "בני", title: "ספורט" },
        { teacher: "בני", title: "ספורט" },
      ])
    ).toEqual([
      { name: "בני", teaches: true },
      { name: "יעל", teaches: true },
      { name: "אורי", teaches: false },
      { name: "תמר", teaches: false },
    ]);
  });
});

describe("StaffScheduleService fetchers", () => {
  beforeEach(() => {
    vi.mocked(classesApi.getTeacherTitlePairs).mockReset();
    vi.mocked(classesApi.getClassesByTeacher).mockReset();
    vi.mocked(scheduleOverridesApi.getOverridesByTeacher).mockReset();
  });

  it("getStaffMembers derives members from the catalog pairs", async () => {
    vi.mocked(classesApi.getTeacherTitlePairs).mockResolvedValue([
      { teacher: "חונך", title: "מתמטיקה" },
      { teacher: "דנה ", title: "מתמטיקה" },
    ]);

    await expect(StaffScheduleService.getStaffMembers()).resolves.toEqual([
      { name: "דנה", teaches: true },
    ]);
  });

  it("getCatalogForStaff drops Special Classes", async () => {
    vi.mocked(classesApi.getClassesByTeacher).mockResolvedValue([
      makeClass({ id: "a" }),
      makeClass({ id: "b", title: "כישורי חיים" }),
    ]);

    const result = await StaffScheduleService.getCatalogForStaff("דנה");

    expect(classesApi.getClassesByTeacher).toHaveBeenCalledWith("דנה");
    expect(result.map(c => c.id)).toEqual(["a"]);
  });

  it("getSelectionsForStaff is a stub until part 2", async () => {
    await expect(
      StaffScheduleService.getSelectionsForStaff("דנה")
    ).resolves.toEqual([]);
  });

  it("getStaffView combines the catalog and override streams", async () => {
    vi.mocked(classesApi.getClassesByTeacher).mockResolvedValue([
      makeClass({ id: "a" }),
    ]);
    vi.mocked(scheduleOverridesApi.getOverridesByTeacher).mockResolvedValue([
      makeOverride(),
    ]);

    const view = await StaffScheduleService.getStaffView("דנה");

    expect(scheduleOverridesApi.getOverridesByTeacher).toHaveBeenCalledWith(
      "דנה"
    );
    expect(view.classes).toHaveLength(2);
  });
});
