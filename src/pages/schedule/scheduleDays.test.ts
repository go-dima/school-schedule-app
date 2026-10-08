import { describe, expect, it } from "vitest";
import {
  initialScheduleDay,
  schoolWeekDates,
  stepSchoolDay,
} from "./scheduleDays";

// 2026-10-04 is a Sunday.
const at = (dayOfMonth: number) => new Date(2026, 9, dayOfMonth, 10, 30);

describe("initialScheduleDay", () => {
  it.each([
    [4, 0], // Sunday
    [5, 1],
    [6, 2],
    [7, 3],
    [8, 4], // Thursday
    [9, 0], // Friday -> Sunday
    [10, 0], // Saturday -> Sunday
  ])("October %i opens on day %i", (dayOfMonth, expected) => {
    expect(initialScheduleDay(at(dayOfMonth))).toBe(expected);
  });
});

describe("schoolWeekDates", () => {
  const dates = (d: Date) => schoolWeekDates(d).map(x => x.getDate());

  it("gives this week's Sunday to Thursday on a school day", () => {
    expect(dates(at(6))).toEqual([4, 5, 6, 7, 8]);
  });

  it("gives the coming week on Friday and Saturday", () => {
    expect(dates(at(9))).toEqual([11, 12, 13, 14, 15]);
    expect(dates(at(10))).toEqual([11, 12, 13, 14, 15]);
  });

  it("crosses a month boundary", () => {
    // Thursday 2026-10-29: week of Sunday 25 .. Thursday 29.
    expect(dates(at(29))).toEqual([25, 26, 27, 28, 29]);
    // Friday 2026-10-30: next week starts Sunday 1 November.
    expect(dates(at(30))).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("stepSchoolDay", () => {
  it("moves within the week", () => {
    expect(stepSchoolDay(2, 1)).toBe(3);
    expect(stepSchoolDay(2, -1)).toBe(1);
  });

  it("stops at Sunday and Thursday", () => {
    expect(stepSchoolDay(0, -1)).toBe(0);
    expect(stepSchoolDay(4, 1)).toBe(4);
  });
});
