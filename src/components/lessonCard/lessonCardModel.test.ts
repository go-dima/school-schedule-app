import { describe, expect, it } from "vitest";
import {
  classLesson,
  lessonCardClassName,
  overrideLesson,
} from "./lessonCardModel";
import {
  doubleDayKey,
  mockClasses,
  mockOverrides,
} from "../../stories/fixtures/scheduleFixtures";

const double = mockClasses.find(c => c.id === `class-${doubleDayKey}-double`)!;
const plain = mockClasses.find(c => !c.isDouble && !c.isMandatory)!;

describe("lessonCardModel", () => {
  it("maps a class", () => {
    expect(classLesson(double, { isContinuation: true })).toEqual({
      title: double.title,
      teacher: double.teacher,
      room: double.room,
      grades: double.grades,
      isContinuation: true,
      isDouble: true,
      isMandatory: true,
      isOverride: false,
    });
  });

  it("maps an override", () => {
    const o = mockOverrides[0];
    expect(overrideLesson(o)).toMatchObject({
      title: o.title,
      teacher: o.teacher,
      room: o.room,
      isOverride: true,
      isContinuation: false,
    });
  });

  it("gives the shared card classes", () => {
    expect(lessonCardClassName(classLesson(plain))).toBe(
      "class-card selected-card"
    );
    expect(lessonCardClassName(classLesson(double))).toBe(
      "class-card selected-card double-card mandatory-card"
    );
    expect(lessonCardClassName(overrideLesson(mockOverrides[0]), "extra")).toBe(
      "class-card selected-card override-card extra"
    );
  });
});
