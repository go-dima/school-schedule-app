import { describe, expect, it } from "vitest";
import { buildDayAgenda, type AgendaEntry } from "./dayAgenda";
import { isLessonTimeSlot } from "../../utils/timeSlots";
import {
  conflictingClassIds,
  conflictingUserSelections,
  doubleDayKey,
  mockOverrides,
  mockTimeSlots,
  mockUserSelections,
  mockWeeklySchedule,
  morningMeetingClass,
  morningMeetingSelected,
  selectedClassIds,
  withMorningMeetingWeeklySchedule,
} from "../../stories/fixtures/scheduleFixtures";

const lessonSlots = mockTimeSlots.filter(isLessonTimeSlot);

const agenda = (
  day: number,
  overrides: Partial<Parameters<typeof buildDayAgenda>[0]> = {}
) =>
  buildDayAgenda({
    day,
    timeSlots: mockTimeSlots,
    weeklySchedule: mockWeeklySchedule,
    selectedClassIds,
    userSelections: mockUserSelections,
    overrides: [],
    ...overrides,
  });

const entryFor = (entries: AgendaEntry[], timeSlotId: string) =>
  entries.find(e => e.timeSlot.id === timeSlotId)!;

describe("buildDayAgenda", () => {
  it("has one entry per time slot, in start-time order", () => {
    const entries = agenda(0);
    expect(entries).toHaveLength(mockTimeSlots.length);
    const starts = entries.map(e => e.timeSlot.startTime);
    expect(starts).toEqual([...starts].sort());
  });

  it("shows the selected class of a lesson slot", () => {
    // class-0-1: Sunday, second lesson slot.
    const entry = entryFor(agenda(0), lessonSlots[1].id);
    expect(entry.kind).toBe("selected");
    if (entry.kind !== "selected") return;
    expect(entry.classes.map(c => c.id)).toEqual(["class-0-1"]);
    expect(entry.hasConflict).toBe(false);
  });

  it("counts the options of a lesson slot with no selection", () => {
    const entry = entryFor(agenda(0), lessonSlots[0].id);
    expect(entry).toMatchObject({ kind: "unselected", optionCount: 1 });
  });

  it("marks an empty lesson slot", () => {
    // Wednesday's last lesson slot has no classes in the fixtures.
    const entry = entryFor(agenda(3), lessonSlots[5].id);
    expect(entry.kind).toBe("empty");
  });

  it("shows a break or meeting label when nothing is selected there", () => {
    const nonLesson = mockTimeSlots.find(s => !isLessonTimeSlot(s))!;
    expect(entryFor(agenda(0), nonLesson.id).kind).toBe("nonLesson");
  });

  it("shows a class selected on a meeting slot instead of the label", () => {
    const meetingSlotId = morningMeetingClass.slots[0].timeSlotId;
    const entry = entryFor(
      agenda(0, {
        weeklySchedule: withMorningMeetingWeeklySchedule,
        selectedClassIds: morningMeetingSelected,
      }),
      meetingSlotId
    );
    expect(entry).toMatchObject({ kind: "selected" });
  });

  it("shows both slots of a selected Double Lesson, the second as a continuation", () => {
    const [first, second] = lessonSlots.slice(-2);
    const entries = agenda(doubleDayKey);
    const a = entryFor(entries, first.id);
    const b = entryFor(entries, second.id);
    expect(a).toMatchObject({ kind: "selected", continuationIds: [] });
    expect(b).toMatchObject({
      kind: "selected",
      continuationIds: [`class-${doubleDayKey}-double`],
    });
  });

  it("lets an override replace the slot", () => {
    const override = mockOverrides.find(
      o => o.id === "override-over-mandatory"
    )!;
    const entry = entryFor(
      agenda(doubleDayKey, { overrides: mockOverrides }),
      override.timeSlotId
    );
    expect(entry).toMatchObject({ kind: "overrides" });
  });

  it("flags two selected classes in the same slot as a conflict", () => {
    const entry = entryFor(
      agenda(4, {
        selectedClassIds: conflictingClassIds,
        userSelections: conflictingUserSelections,
      }),
      lessonSlots[4].id
    );
    expect(entry).toMatchObject({ kind: "selected", hasConflict: true });
  });

  it("filters the options by grade", () => {
    // Sunday's first lesson class (class-0-0) is for grade 1 only.
    const entry = entryFor(agenda(0, { userGrade: 6 }), lessonSlots[0].id);
    expect(entry.kind).toBe("empty");
  });
});
