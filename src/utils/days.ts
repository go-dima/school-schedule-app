export const GetDayName = (dayOfWeek: number): string => {
  const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  return dayNames[dayOfWeek] || "";
};

export const IsWorkingDay = (dayOfWeek: number): boolean => {
  return dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
};
