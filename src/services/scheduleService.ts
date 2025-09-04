import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  WeeklySchedule,
} from "../types";

export class ScheduleService {
  static buildWeeklySchedule(classes: ClassWithTimeSlot[]): WeeklySchedule {
    const schedule: WeeklySchedule = {};

    classes.forEach((cls) => {
      const { dayOfWeek } = cls.timeSlot;
      const timeSlotId = cls.timeSlotId;

      if (!schedule[dayOfWeek]) {
        schedule[dayOfWeek] = {};
      }

      if (!schedule[dayOfWeek][timeSlotId]) {
        schedule[dayOfWeek][timeSlotId] = [];
      }

      schedule[dayOfWeek][timeSlotId].push(cls);
    });

    return schedule;
  }

  static getConflictingClasses(
    userSelections: ScheduleSelectionWithClass[],
    newClass: ClassWithTimeSlot
  ): ClassWithTimeSlot[] {
    return userSelections
      .filter(
        (selection) =>
          selection.class.timeSlot.dayOfWeek === newClass.timeSlot.dayOfWeek &&
          selection.class.timeSlotId === newClass.timeSlotId &&
          selection.class.id !== newClass.id
      )
      .map((selection) => selection.class);
  }

  static hasTimeConflict(
    userSelections: ScheduleSelectionWithClass[],
    newClass: ClassWithTimeSlot
  ): boolean {
    return this.getConflictingClasses(userSelections, newClass).length > 0;
  }

  static getClassesByTimeSlot(
    classes: ClassWithTimeSlot[],
    timeSlotId: string,
    grade?: number
  ): ClassWithTimeSlot[] {
    return classes.filter(
      (cls) =>
        cls.timeSlotId === timeSlotId &&
        (grade === undefined || cls.grade === grade)
    );
  }

  static formatTimeRange(startTime: string, endTime: string): string {
    const formatTime = (time: string): string => {
      if (!time) return "";

      // If time is in HH:MM:SS format, convert to HH:MM
      if (time.includes(":")) {
        const parts = time.split(":");
        return `${parts[0]}:${parts[1]}`;
      }

      return time;
    };

    const formattedStart = formatTime(startTime);
    const formattedEnd = formatTime(endTime);

    // If both times are missing, return empty string
    if (!formattedStart && !formattedEnd) {
      return "";
    }

    // If only one time is missing, return the available one
    if (!formattedStart) return formattedEnd;
    if (!formattedEnd) return formattedStart;

    // Both times available, return range
    return `${formattedEnd} - ${formattedStart}`;
  }

  static getDayName(dayOfWeek: number): string {
    const dayNames = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    return dayNames[dayOfWeek] || "";
  }

  static getGradeName(grade: number): string {
    switch (grade) {
      case 1:
        return "כיתה א׳";
      case 2:
        return "כיתה ב׳";
      case 3:
        return "כיתה ג׳";
      case 4:
        return "כיתה ד׳";
      case 5:
        return "כיתה ה׳";
      case 6:
        return "כיתה ו׳";
      default:
        return `כיתה ${grade}`;
    }
  }

  static validateTimeSlot(startTime: string, endTime: string): boolean {
    if (!startTime || !endTime) return false;

    const start = new Date(`1970-01-01T${startTime}:00`);
    const end = new Date(`1970-01-01T${endTime}:00`);

    return start < end;
  }

  static isWorkingDay(dayOfWeek: number): boolean {
    return dayOfWeek >= 0 && dayOfWeek <= 4; // Sunday to Thursday
  }
}
