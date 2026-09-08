import { describe, expect, it } from "vitest";
import type {
  ClassWithTimeSlot,
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

const makeSelection = (cls: ClassWithTimeSlot): ScheduleSelectionWithClass => ({
  id: `sel-${cls.id}`,
  userId: "user-1",
  classId: cls.id,
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
