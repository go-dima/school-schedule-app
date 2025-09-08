export function GetGradeName(grade: number): string {
  return `כיתה ${GetGradeNameShort(grade)}`;
}

export function GetGradeNameShort(grade: number): string {
  switch (grade) {
    case 1:
      return "א׳";
    case 2:
      return "ב׳";
    case 3:
      return "ג׳";
    case 4:
      return "ד׳";
    case 5:
      return "ה׳";
    case 6:
      return "ו׳";
    default:
      return `${grade}`;
  }
}
