/**
 * True when the class is taught in the given grade. A class with no grades
 * list matches no grade.
 */
export function classMatchesGrade(
  cls: { grades?: number[] },
  grade: number
): boolean {
  return cls.grades?.includes(grade) ?? false;
}
