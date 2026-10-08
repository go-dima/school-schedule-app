import i18n from "./i18n";

export function GetGradeName(grade: number): string {
  return i18n.t("grades.className", { grade: GetGradeNameShort(grade) });
}

export function GetGradeNameShort(grade: number): string {
  return i18n.t(`grades.short.${grade}`, { defaultValue: `${grade}` });
}
