// School days are Sunday (0) to Thursday (4).
export const FIRST_SCHOOL_DAY = 0;
export const LAST_SCHOOL_DAY = 4;

/** The day the mobile schedule opens on: today, or Sunday on Friday and
 * Saturday. */
export function initialScheduleDay(now: Date): number {
  const day = now.getDay();
  return day > LAST_SCHOOL_DAY ? FIRST_SCHOOL_DAY : day;
}

/** Dates of the school week shown in the week strip, Sunday to Thursday.
 * On Friday and Saturday it is the coming week, matching
 * initialScheduleDay. */
export function schoolWeekDates(now: Date): Date[] {
  const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = now.getDay();
  sunday.setDate(sunday.getDate() - day + (day > LAST_SCHOOL_DAY ? 7 : 0));
  return Array.from({ length: LAST_SCHOOL_DAY + 1 }, (_, i) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    return date;
  });
}

/** The school day `step` days from `day`, clamped to Sunday..Thursday (no
 * wrap-around). */
export function stepSchoolDay(day: number, step: number): number {
  return Math.min(LAST_SCHOOL_DAY, Math.max(FIRST_SCHOOL_DAY, day + step));
}
