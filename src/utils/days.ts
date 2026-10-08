import i18n from "./i18n";

export const GetDayName = (dayOfWeek: number): string => {
  return Number.isInteger(dayOfWeek) && dayOfWeek >= 0 && dayOfWeek <= 6
    ? i18n.t(`days.short.${dayOfWeek}`)
    : "";
};

export const IsWorkingDay = (dayOfWeek: number): boolean => {
  return dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
};
