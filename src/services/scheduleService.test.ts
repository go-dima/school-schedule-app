import { describe, expect, it } from "vitest";
import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithTimeSlot,
  ScheduleSelectionWithClass,
  TimeSlot,
} from "../types";
import { ScheduleService } from "./scheduleService";

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

const tsFirst = timeSlot("ts-first", "09:15", "09:55");
const tsSecond = timeSlot("ts-second", "09:55", "10:30");
const tsThird = timeSlot("ts-third", "11:00", "11:45");

const makeClass = (
  overrides: Partial<ClassWithTimeSlot> = {}
): ClassWithTimeSlot => ({
  id: "class-1",
  title: "Class",
  description: "",
  teacher: "Teacher",
  slots: [{ dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
  grades: [1],
  isMandatory: false,
  isDouble: false,
  groupNumber: null,
  trackNumber: null,
  room: "",
  scope: "prod",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const makeOverride = (
  overrides: Partial<ScheduleOverrideWithTimeSlot> = {}
): ScheduleOverrideWithTimeSlot => ({
  id: "override-1",
  childId: "child-1",
  title: "Personal support",
  teacher: "Ms. Cohen",
  room: "Room 7",
  dayOfWeek: 1,
  timeSlotId: tsFirst.id,
  scope: "prod",
  createdBy: "staff-1",
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-02T00:00:00Z",
  timeSlot: tsFirst,
  ...overrides,
});

const makeSelection = (cls: ClassWithTimeSlot): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "user-1",
  classId: cls.id,
  status: "draft",
  createdAt: "",
  updatedAt: "",
  class: cls,
});

describe("ScheduleService.buildWeeklySchedule", () => {
  it("returns an empty schedule for no classes", () => {
    expect(ScheduleService.buildWeeklySchedule([])).toEqual({});
  });

  it("places a single-slot class in its one cell", () => {
    const cls = makeClass();
    const schedule = ScheduleService.buildWeeklySchedule([cls]);
    expect(schedule[0][tsFirst.id]).toEqual([cls]);
  });

  it("places a same-day double-lesson class in both its cells", () => {
    const cls = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const schedule = ScheduleService.buildWeeklySchedule([cls]);
    expect(schedule[0][tsFirst.id]).toEqual([cls]);
    expect(schedule[0][tsSecond.id]).toEqual([cls]);
  });

  it("places a cross-day multi-slot class in both day cells", () => {
    const cls = makeClass({
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 2, timeSlotId: tsThird.id, timeSlot: tsThird },
      ],
    });
    const schedule = ScheduleService.buildWeeklySchedule([cls]);
    expect(schedule[0][tsFirst.id]).toEqual([cls]);
    expect(schedule[2][tsThird.id]).toEqual([cls]);
  });
});

describe("ScheduleService.getPrimarySlot", () => {
  it("picks the earlier start time for a same-day double lesson", () => {
    const cls = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
      ],
    });
    expect(ScheduleService.getPrimarySlot(cls).timeSlotId).toBe(tsFirst.id);
  });

  it("picks the lower dayOfWeek for a cross-day class", () => {
    const cls = makeClass({
      slots: [
        { dayOfWeek: 2, timeSlotId: tsThird.id, timeSlot: tsThird },
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
      ],
    });
    expect(ScheduleService.getPrimarySlot(cls).dayOfWeek).toBe(0);
  });
});

describe("ScheduleService.isPrimarySlot", () => {
  it("is true for the primary slot and false for any other slot in the cell", () => {
    const cls = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    expect(ScheduleService.isPrimarySlot(cls, 0, tsFirst.id)).toBe(true);
    expect(ScheduleService.isPrimarySlot(cls, 0, tsSecond.id)).toBe(false);
  });
});

describe("ScheduleService.getConflictingClasses / hasTimeConflict", () => {
  it("reports no conflict when slots don't overlap", () => {
    const existing = makeClass({ id: "existing" });
    const candidate = makeClass({
      id: "candidate",
      slots: [{ dayOfWeek: 1, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
    });
    const selections = [makeSelection(existing)];
    expect(ScheduleService.hasTimeConflict(selections, candidate)).toBe(false);
  });

  it("reports a conflict on an exact single-slot overlap", () => {
    const existing = makeClass({ id: "existing" });
    const candidate = makeClass({ id: "candidate" });
    const selections = [makeSelection(existing)];
    const conflicts = ScheduleService.getConflictingClasses(
      selections,
      candidate
    );
    expect(conflicts.map(c => c.id)).toEqual(["existing"]);
  });

  it("reports a conflict when only one of several slots overlaps", () => {
    const existing = makeClass({
      id: "existing",
      slots: [{ dayOfWeek: 2, timeSlotId: tsThird.id, timeSlot: tsThird }],
    });
    const candidate = makeClass({
      id: "candidate",
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 2, timeSlotId: tsThird.id, timeSlot: tsThird },
      ],
    });
    const selections = [makeSelection(existing)];
    expect(ScheduleService.hasTimeConflict(selections, candidate)).toBe(true);
  });

  it("excludes the class from conflicting with itself", () => {
    const cls = makeClass({ id: "same" });
    const selections = [makeSelection(cls)];
    expect(ScheduleService.hasTimeConflict(selections, cls)).toBe(false);
  });

  it("detects a conflict between a same-day double lesson and a single-slot class in its second slot (regression)", () => {
    const existingDouble = makeClass({
      id: "double",
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const candidate = makeClass({
      id: "candidate",
      slots: [{ dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond }],
    });
    const selections = [makeSelection(existingDouble)];
    expect(ScheduleService.hasTimeConflict(selections, candidate)).toBe(true);
  });

  it("dedupes conflicts against the same class occupying multiple overlapping slots", () => {
    const existing = makeClass({
      id: "existing",
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const candidate = makeClass({
      id: "candidate",
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const selections = [makeSelection(existing)];
    const conflicts = ScheduleService.getConflictingClasses(
      selections,
      candidate
    );
    expect(conflicts.map(c => c.id)).toEqual(["existing"]);
  });
});

describe("ScheduleService.hasConflictInSlot", () => {
  const double = makeClass({
    id: "double",
    isDouble: true,
    slots: [
      { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
      { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
    ],
  });
  const inSecondSlot = makeClass({
    id: "second-only",
    slots: [{ dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond }],
  });
  const selections = [makeSelection(double), makeSelection(inSecondSlot)];

  it("is true only in the slot where another lesson actually overlaps", () => {
    expect(
      ScheduleService.hasConflictInSlot(selections, double, 0, tsSecond.id)
    ).toBe(true);
    expect(
      ScheduleService.hasConflictInSlot(
        selections,
        inSecondSlot,
        0,
        tsSecond.id
      )
    ).toBe(true);
  });

  it("leaves the double lesson's other half clear", () => {
    expect(
      ScheduleService.hasConflictInSlot(selections, double, 0, tsFirst.id)
    ).toBe(false);
  });

  it("never conflicts a lesson with itself", () => {
    expect(
      ScheduleService.hasConflictInSlot(
        [makeSelection(double)],
        double,
        0,
        tsSecond.id
      )
    ).toBe(false);
  });

  it("is false for a slot the lesson doesn't occupy", () => {
    expect(
      ScheduleService.hasConflictInSlot(selections, inSecondSlot, 0, tsFirst.id)
    ).toBe(false);
  });
});

describe("ScheduleService שילוב never conflicts", () => {
  // שילוב (integration) happens inside another lesson, so sharing a slot
  // with it is not a clash -- for the grid or the selection drawer.
  const lesson = makeClass({ id: "lesson", title: "מתמטיקה" });
  const integration = makeClass({ id: "integration", title: "שילוב" });
  const selections = [makeSelection(lesson), makeSelection(integration)];

  it("doesn't mark a cell where a lesson shares the slot with שילוב", () => {
    expect(
      ScheduleService.hasConflictInSlot(selections, lesson, 0, tsFirst.id)
    ).toBe(false);
    expect(
      ScheduleService.hasConflictInSlot(selections, integration, 0, tsFirst.id)
    ).toBe(false);
  });

  it("doesn't report שילוב as a class-wide conflict either way", () => {
    expect(
      ScheduleService.hasTimeConflict([makeSelection(integration)], lesson)
    ).toBe(false);
    expect(
      ScheduleService.hasTimeConflict([makeSelection(lesson)], integration)
    ).toBe(false);
  });

  it("still marks two other lessons sharing a slot, even beside שילוב", () => {
    const other = makeClass({ id: "other", title: "אנגלית" });
    const withOther = [...selections, makeSelection(other)];
    expect(
      ScheduleService.hasConflictInSlot(withOther, lesson, 0, tsFirst.id)
    ).toBe(true);
  });
});

describe("ScheduleService.getDrawerConflicts", () => {
  it("flags a double lesson that overlaps a different, already-selected class in its other (empty) slot", () => {
    const b = makeClass({
      id: "b",
      slots: [{ dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
    });
    const doubleA = makeClass({
      id: "double-a",
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const userSelections = [makeSelection(b)];

    const conflicts = ScheduleService.getDrawerConflicts(
      [doubleA],
      userSelections,
      ["b"],
      0,
      tsSecond.id
    );

    expect(conflicts.map(c => c.id)).toEqual(["double-a"]);
  });

  it("does not flag any candidate as conflicted once the viewed slot already has a selection (blocked by single-choice-per-slot instead)", () => {
    const b = makeClass({
      id: "b",
      slots: [{ dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
    });
    const c = makeClass({
      id: "c",
      slots: [{ dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond }],
    });
    const doubleA = makeClass({
      id: "double-a",
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst },
        { dayOfWeek: 0, timeSlotId: tsSecond.id, timeSlot: tsSecond },
      ],
    });
    const userSelections = [makeSelection(b), makeSelection(c)];

    const conflicts = ScheduleService.getDrawerConflicts(
      [c, doubleA],
      userSelections,
      ["b", "c"],
      0,
      tsSecond.id
    );

    expect(conflicts).toEqual([]);
  });

  it("does not flag a track-linked candidate against a class already selected in the very same slot", () => {
    const selectedInSlot = makeClass({ id: "selected" });
    const trackCandidate = makeClass({ id: "track-candidate", trackNumber: 1 });
    const userSelections = [makeSelection(selectedInSlot)];

    const conflicts = ScheduleService.getDrawerConflicts(
      [selectedInSlot, trackCandidate],
      userSelections,
      ["selected"],
      0,
      tsFirst.id
    );

    expect(conflicts).toEqual([]);
  });
});

describe("ScheduleService.getNextConsecutiveTimeSlot", () => {
  const lesson1: TimeSlot = { ...tsFirst, name: "שיעור ראשון" };
  const lesson2: TimeSlot = { ...tsSecond, name: "שיעור שני" };
  const breakSlot: TimeSlot = timeSlot("break", "10:30", "11:00");
  const lesson3: TimeSlot = { ...tsThird, name: "שיעור שלישי" };

  it("returns the next lesson slot by start time, skipping non-lesson slots", () => {
    const allSlots = [lesson1, lesson2, breakSlot, lesson3];
    expect(
      ScheduleService.getNextConsecutiveTimeSlot(lesson2, allSlots)?.id
    ).toBe(lesson3.id);
  });

  it("returns null when there is no next lesson slot", () => {
    const allSlots = [lesson1, lesson2, breakSlot, lesson3];
    expect(
      ScheduleService.getNextConsecutiveTimeSlot(lesson3, allSlots)
    ).toBeNull();
  });
});

describe("ScheduleService.getDoubleLessonPair / isDoubleLessonSecondSlot", () => {
  const lesson1: TimeSlot = { ...tsFirst, name: "שיעור ראשון" };
  const lesson2: TimeSlot = { ...tsSecond, name: "שיעור שני" };
  const lesson3: TimeSlot = { ...tsThird, name: "שיעור שלישי" };
  const allSlots = [lesson1, lesson2, lesson3];

  it("finds the pair for a plain same-day double lesson", () => {
    const cls = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: lesson1.id, timeSlot: lesson1 },
        { dayOfWeek: 0, timeSlotId: lesson2.id, timeSlot: lesson2 },
      ],
    });
    const pair = ScheduleService.getDoubleLessonPair(cls, allSlots);
    expect(pair?.[0].timeSlotId).toBe(lesson1.id);
    expect(pair?.[1].timeSlotId).toBe(lesson2.id);
  });

  it("returns null for a non-double class even with adjacent slots", () => {
    const cls = makeClass({
      isDouble: false,
      slots: [
        { dayOfWeek: 0, timeSlotId: lesson1.id, timeSlot: lesson1 },
        { dayOfWeek: 0, timeSlotId: lesson2.id, timeSlot: lesson2 },
      ],
    });
    expect(ScheduleService.getDoubleLessonPair(cls, allSlots)).toBeNull();
  });

  it("finds the double-lesson pair by adjacency, not array position, when an unrelated earlier slot is also present", () => {
    // Regression: a class with an extra, unrelated slot that sorts earlier
    // than the actual double-lesson pair must not have that extra slot
    // mistaken for the anchor.
    const cls = makeClass({
      isDouble: true,
      slots: [
        { dayOfWeek: 0, timeSlotId: lesson1.id, timeSlot: lesson1 }, // unrelated, sorts first
        { dayOfWeek: 2, timeSlotId: lesson2.id, timeSlot: lesson2 }, // double anchor
        { dayOfWeek: 2, timeSlotId: lesson3.id, timeSlot: lesson3 }, // double continuation
      ],
    });
    const pair = ScheduleService.getDoubleLessonPair(cls, allSlots);
    expect(pair?.[0]).toEqual({
      dayOfWeek: 2,
      timeSlotId: lesson2.id,
      timeSlot: lesson2,
    });
    expect(pair?.[1]).toEqual({
      dayOfWeek: 2,
      timeSlotId: lesson3.id,
      timeSlot: lesson3,
    });

    // And the unrelated earlier slot must NOT be classified as a continuation.
    expect(
      ScheduleService.isDoubleLessonSecondSlot(cls, 0, lesson1.id, allSlots)
    ).toBe(false);
    expect(
      ScheduleService.isDoubleLessonSecondSlot(cls, 2, lesson3.id, allSlots)
    ).toBe(true);
  });

  it("does not treat a non-double multi-slot class's second slot as a continuation", () => {
    // Regression: a class meeting on two separate days (not a Double Lesson)
    // must never be classified as having a "continuation" slot.
    const cls = makeClass({
      isDouble: false,
      slots: [
        { dayOfWeek: 0, timeSlotId: lesson1.id, timeSlot: lesson1 },
        { dayOfWeek: 2, timeSlotId: lesson3.id, timeSlot: lesson3 },
      ],
    });
    expect(
      ScheduleService.isDoubleLessonSecondSlot(cls, 2, lesson3.id, allSlots)
    ).toBe(false);
  });
});

describe("ScheduleService.resolveSelectionStatus", () => {
  it("resolves staff to committed", () => {
    expect(ScheduleService.resolveSelectionStatus("staff")).toBe("committed");
  });

  it("resolves admin to committed", () => {
    expect(ScheduleService.resolveSelectionStatus("admin")).toBe("committed");
  });

  it("resolves parent to draft", () => {
    expect(ScheduleService.resolveSelectionStatus("parent")).toBe("draft");
  });

  it("resolves child to draft", () => {
    expect(ScheduleService.resolveSelectionStatus("child")).toBe("draft");
  });

  it("resolves no role (undefined) to draft", () => {
    expect(ScheduleService.resolveSelectionStatus(undefined)).toBe("draft");
  });
});

describe("ScheduleService.resolveScheduleView", () => {
  // Explicit matrix so a future change to this decision point shows up as a
  // failing row here rather than a silent behavior change on the page.
  // Overrides only ever belong in a committed view (see the method's own
  // comment) -- this is the single place that decides "committed" per role/
  // toggle and which child's overrides (if any) that implies.
  const cases: Array<{
    name: string;
    input: Parameters<typeof ScheduleService.resolveScheduleView>[0];
    expected: ReturnType<typeof ScheduleService.resolveScheduleView>;
  }> = [
    {
      name: "parent, draft (not toggled): no overrides",
      input: {
        role: "parent",
        canPickSchedule: true,
        viewCommitted: false,
        selectedChildId: "child-1",
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "draft",
        overrideChildId: undefined,
        canCreateOverride: false,
      },
    },
    {
      name: "parent, toggled to committed: overrides for that child",
      input: {
        role: "parent",
        canPickSchedule: true,
        viewCommitted: true,
        selectedChildId: "child-1",
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "committed",
        overrideChildId: "child-1",
        canCreateOverride: false,
      },
    },
    {
      name: "parent, toggled to committed, no child selected yet: no overrides",
      input: {
        role: "parent",
        canPickSchedule: true,
        viewCommitted: true,
        selectedChildId: undefined,
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "committed",
        overrideChildId: undefined,
        canCreateOverride: false,
      },
    },
    {
      name: "staff, child selected: always committed, overrides for that child, can create",
      input: {
        role: "staff",
        canPickSchedule: false,
        viewCommitted: false,
        selectedChildId: undefined,
        staffSelectedChildId: "child-2",
      },
      expected: {
        viewStatus: "committed",
        overrideChildId: "child-2",
        canCreateOverride: true,
      },
    },
    {
      name: "staff, no child selected: committed, no overrides, cannot create",
      input: {
        role: "staff",
        canPickSchedule: false,
        viewCommitted: false,
        selectedChildId: undefined,
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "committed",
        overrideChildId: undefined,
        canCreateOverride: false,
      },
    },
    {
      name: "admin: committed, but no override read/write (staff-only feature)",
      input: {
        role: "admin",
        canPickSchedule: false,
        viewCommitted: false,
        selectedChildId: undefined,
        staffSelectedChildId: "child-2",
      },
      expected: {
        viewStatus: "committed",
        overrideChildId: undefined,
        canCreateOverride: false,
      },
    },
    {
      name: "child, toggled to committed: overrides for their own student",
      input: {
        role: "child",
        canPickSchedule: true,
        viewCommitted: true,
        selectedChildId: "own-student",
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "committed",
        overrideChildId: "own-student",
        canCreateOverride: false,
      },
    },
    {
      name: "child, not linked to a student yet: draft, no overrides",
      input: {
        role: "child",
        canPickSchedule: true,
        viewCommitted: false,
        selectedChildId: undefined,
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "draft",
        overrideChildId: undefined,
        canCreateOverride: false,
      },
    },
    {
      name: "no role yet: draft, no overrides",
      input: {
        role: undefined,
        canPickSchedule: false,
        viewCommitted: false,
        selectedChildId: undefined,
        staffSelectedChildId: undefined,
      },
      expected: {
        viewStatus: "draft",
        overrideChildId: undefined,
        canCreateOverride: false,
      },
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(ScheduleService.resolveScheduleView(input)).toEqual(expected);
  });
});

describe("ScheduleService.orderClassesByPickStatus", () => {
  it("leaves order unchanged when there are no draft classes", () => {
    const classes = [
      makeClass({ id: "class-1" }),
      makeClass({ id: "class-2" }),
      makeClass({ id: "class-3" }),
    ];

    const result = ScheduleService.orderClassesByPickStatus(classes, new Set());

    expect(result.map(c => c.id)).toEqual(["class-1", "class-2", "class-3"]);
  });

  it("sorts draft-marked classes to the front, preserving relative order within each group", () => {
    const classes = [
      makeClass({ id: "class-1" }),
      makeClass({ id: "class-2" }),
      makeClass({ id: "class-3" }),
      makeClass({ id: "class-4" }),
    ];

    const result = ScheduleService.orderClassesByPickStatus(
      classes,
      new Set(["class-2", "class-4"])
    );

    expect(result.map(c => c.id)).toEqual([
      "class-2",
      "class-4",
      "class-1",
      "class-3",
    ]);
  });

  it("returns an empty array for empty input", () => {
    const result = ScheduleService.orderClassesByPickStatus(
      [],
      new Set(["class-1"])
    );

    expect(result).toEqual([]);
  });

  it("pushes staff-only placeholder classes after regular classes within each group", () => {
    const classes = [
      makeClass({ id: "class-1", title: "חונכות" }),
      makeClass({ id: "class-2" }),
      makeClass({ id: "class-3", title: "שילוב" }),
      makeClass({ id: "class-4" }),
    ];

    const result = ScheduleService.orderClassesByPickStatus(classes, new Set());

    expect(result.map(c => c.id)).toEqual([
      "class-2",
      "class-4",
      "class-1",
      "class-3",
    ]);
  });

  it("keeps staff-only classes after regular classes even when draft-picked", () => {
    const classes = [
      makeClass({ id: "class-1", title: "חונכות" }),
      makeClass({ id: "class-2" }),
    ];

    const result = ScheduleService.orderClassesByPickStatus(
      classes,
      new Set(["class-1", "class-2"])
    );

    expect(result.map(c => c.id)).toEqual(["class-2", "class-1"]);
  });
});

describe("ScheduleService.isStaffOnlyClass", () => {
  it("is true for חונכות", () => {
    expect(
      ScheduleService.isStaffOnlyClass(makeClass({ title: "חונכות" }))
    ).toBe(true);
  });

  it("is true for שילוב", () => {
    expect(
      ScheduleService.isStaffOnlyClass(makeClass({ title: "שילוב" }))
    ).toBe(true);
  });

  it("is false for a regular class", () => {
    expect(
      ScheduleService.isStaffOnlyClass(makeClass({ title: "מתמטיקה" }))
    ).toBe(false);
  });
});

describe("ScheduleService.mergeWeeklySchedules", () => {
  it("returns base unchanged when overlay is empty", () => {
    const cls = makeClass();
    const base = ScheduleService.buildWeeklySchedule([cls]);

    expect(ScheduleService.mergeWeeklySchedules(base, {})).toEqual(base);
  });

  it("adds an overlay-only day/slot entry missing from base", () => {
    const cls = makeClass({ id: "overlay-only" });
    const overlay = ScheduleService.buildWeeklySchedule([cls]);

    const merged = ScheduleService.mergeWeeklySchedules({}, overlay);

    expect(merged[0][tsFirst.id]).toEqual([cls]);
  });

  it("dedups by class id when the same class exists in both for the same day/slot", () => {
    const cls = makeClass();
    const base = ScheduleService.buildWeeklySchedule([cls]);
    const overlay = ScheduleService.buildWeeklySchedule([cls]);

    const merged = ScheduleService.mergeWeeklySchedules(base, overlay);

    expect(merged[0][tsFirst.id]).toEqual([cls]);
  });

  it("keeps distinct entries for different days/slots without cross-contamination", () => {
    const baseCls = makeClass({
      id: "base-class",
      slots: [{ dayOfWeek: 0, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
    });
    const overlayCls = makeClass({
      id: "overlay-class",
      slots: [{ dayOfWeek: 2, timeSlotId: tsThird.id, timeSlot: tsThird }],
    });
    const base = ScheduleService.buildWeeklySchedule([baseCls]);
    const overlay = ScheduleService.buildWeeklySchedule([overlayCls]);

    const merged = ScheduleService.mergeWeeklySchedules(base, overlay);

    expect(merged[0][tsFirst.id]).toEqual([baseCls]);
    expect(merged[2][tsThird.id]).toEqual([overlayCls]);
  });
});

describe("ScheduleService.getOverridesForCell", () => {
  it("returns overrides matching both dayOfWeek and timeSlotId", () => {
    const override = makeOverride({ dayOfWeek: 1, timeSlotId: tsFirst.id });

    const result = ScheduleService.getOverridesForCell(
      [override],
      1,
      tsFirst.id
    );

    expect(result).toEqual([override]);
  });

  it("returns [] when no override matches the cell", () => {
    const override = makeOverride({ dayOfWeek: 1, timeSlotId: tsFirst.id });

    expect(
      ScheduleService.getOverridesForCell([override], 2, tsThird.id)
    ).toEqual([]);
  });

  it("does not match on day-only equality", () => {
    const override = makeOverride({ dayOfWeek: 1, timeSlotId: tsFirst.id });

    expect(
      ScheduleService.getOverridesForCell([override], 1, tsThird.id)
    ).toEqual([]);
  });

  it("does not match on slot-only equality", () => {
    const override = makeOverride({ dayOfWeek: 1, timeSlotId: tsFirst.id });

    expect(
      ScheduleService.getOverridesForCell([override], 2, tsFirst.id)
    ).toEqual([]);
  });
});

describe("ScheduleService.canOpenSlot", () => {
  const lesson = { ...tsFirst, name: "שיעור ראשון" };
  const meeting = { ...tsFirst, id: "ts-meeting", name: "מפגש בוקר" };
  const recess = { ...tsFirst, id: "ts-recess", name: "הפסקה גדולה" };

  it("opens a lesson slot for anyone who can view classes", () => {
    expect(
      ScheduleService.canOpenSlot(lesson, {
        canViewClasses: true,
        canAssignNonLessonSlots: false,
      })
    ).toBe(true);
  });

  it("never opens any slot without canViewClasses", () => {
    for (const slot of [lesson, meeting]) {
      expect(
        ScheduleService.canOpenSlot(slot, {
          canViewClasses: false,
          canAssignNonLessonSlots: true,
        })
      ).toBe(false);
    }
  });

  it("opens meeting and break slots only for staff who assign them", () => {
    for (const slot of [meeting, recess]) {
      expect(
        ScheduleService.canOpenSlot(slot, {
          canViewClasses: true,
          canAssignNonLessonSlots: false,
        })
      ).toBe(false);
      expect(
        ScheduleService.canOpenSlot(slot, {
          canViewClasses: true,
          canAssignNonLessonSlots: true,
        })
      ).toBe(true);
    }
  });
});

describe("ScheduleService.hasSelectedClassInSlot", () => {
  const cls = makeClass({
    slots: [{ dayOfWeek: 3, timeSlotId: tsFirst.id, timeSlot: tsFirst }],
  });
  const weekly = ScheduleService.buildWeeklySchedule([cls]);

  it("is true when any day holds a selected class in the slot", () => {
    expect(
      ScheduleService.hasSelectedClassInSlot(weekly, tsFirst.id, [cls.id])
    ).toBe(true);
  });

  it("is false when the slot's classes aren't selected", () => {
    expect(ScheduleService.hasSelectedClassInSlot(weekly, tsFirst.id, [])).toBe(
      false
    );
    expect(
      ScheduleService.hasSelectedClassInSlot(weekly, tsSecond.id, [cls.id])
    ).toBe(false);
  });
});

describe("ScheduleService.classTitles", () => {
  const classes = [
    makeClass({ id: "a", title: "חשבון", grades: [3, 4] }),
    makeClass({ id: "b", title: "אמנות", grades: [4] }),
    makeClass({ id: "c", title: "חשבון", grades: [5] }),
    makeClass({ id: "d", title: "Drama", grades: [5] }),
  ];

  it("lists every title once, sorted", () => {
    expect(ScheduleService.classTitles(classes)).toEqual([
      "Drama",
      "אמנות",
      "חשבון",
    ]);
  });

  it("keeps only the titles of classes in the given grade", () => {
    expect(ScheduleService.classTitles(classes, 4)).toEqual(["אמנות", "חשבון"]);
    expect(ScheduleService.classTitles(classes, 5)).toEqual(["Drama", "חשבון"]);
    expect(ScheduleService.classTitles(classes, 1)).toEqual([]);
  });
});

describe("ScheduleService.actsAsStaffInStudentView", () => {
  it.each([
    { isStaff: true, canPickSchedule: false, expected: true }, // staff only
    { isStaff: true, canPickSchedule: true, expected: false }, // staff + parent (#192)
    { isStaff: false, canPickSchedule: true, expected: false }, // parent / child
    { isStaff: false, canPickSchedule: false, expected: false }, // admin only
  ])(
    "isStaff=$isStaff canPickSchedule=$canPickSchedule -> $expected",
    ({ isStaff, canPickSchedule, expected }) => {
      expect(
        ScheduleService.actsAsStaffInStudentView({ isStaff, canPickSchedule })
      ).toBe(expected);
    }
  );
});
