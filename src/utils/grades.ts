import i18n from "./i18n";

export function GetGradeName(grade: number): string {
  return i18n.t("grades.className", { grade: GetGradeNameShort(grade) });
}

export function GetGradeNameShort(grade: number): string {
  return i18n.t(`grades.short.${grade}`, { defaultValue: `${grade}` });
}

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
