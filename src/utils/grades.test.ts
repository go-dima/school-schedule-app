import { describe, it, expect } from "vitest";
import { classMatchesGrade } from "./grades";

describe("classMatchesGrade", () => {
  it("is true when the class is taught in the grade", () => {
    expect(classMatchesGrade({ grades: [3, 4] }, 4)).toBe(true);
  });

  it("is false when the grade is not in the list", () => {
    expect(classMatchesGrade({ grades: [3, 4] }, 5)).toBe(false);
  });

  it("is false when the class has no grades list", () => {
    expect(classMatchesGrade({}, 4)).toBe(false);
  });
});
