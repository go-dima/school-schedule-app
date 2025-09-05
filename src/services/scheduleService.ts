import type {
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  WeeklySchedule,
  TimeSlot,
} from "../types";

export class ScheduleService {
  static buildWeeklySchedule(
    classes: ClassWithTimeSlot[],
    allTimeSlots: TimeSlot[] = []
  ): WeeklySchedule {
    const schedule: WeeklySchedule = {};

    console.log("🏗️ Building weekly schedule with:", {
      classCount: classes.length,
      timeSlotCount: allTimeSlots.length,
      doubleClassCount: classes.filter(cls => cls.isDouble).length,
    });

    classes.forEach(cls => {
      const { dayOfWeek } = cls.timeSlot;
      const timeSlotId = cls.timeSlotId;

      if (!schedule[dayOfWeek]) {
        schedule[dayOfWeek] = {};
      }

      if (!schedule[dayOfWeek][timeSlotId]) {
        schedule[dayOfWeek][timeSlotId] = [];
      }

      schedule[dayOfWeek][timeSlotId].push(cls);

      if (cls.isDouble) {
        console.log(`📝 Adding double lesson "${cls.title}" to primary slot:`, {
          dayOfWeek,
          timeSlotId,
          timeSlotName: cls.timeSlot.name,
        });
      }

      // For double lessons, also add to the next consecutive time slot
      if (cls.isDouble && allTimeSlots.length > 0) {
        const nextTimeSlot = this.getNextConsecutiveTimeSlot(
          cls.timeSlot,
          allTimeSlots
        );
        if (nextTimeSlot) {
          if (!schedule[dayOfWeek][nextTimeSlot.id]) {
            schedule[dayOfWeek][nextTimeSlot.id] = [];
          }
          // Add the class to the second slot as well, but mark it as continuation
          schedule[dayOfWeek][nextTimeSlot.id].push({
            ...cls,
            // We could add a flag here but the rendering logic handles it
          });

          console.log(
            `➕ Adding double lesson "${cls.title}" to continuation slot:`,
            {
              dayOfWeek,
              nextTimeSlotId: nextTimeSlot.id,
              nextTimeSlotName: nextTimeSlot.name,
            }
          );
        } else {
          console.warn(
            `⚠️ No next time slot found for double lesson "${cls.title}"`
          );
        }
      }
    });

    return schedule;
  }

  static getConflictingClasses(
    userSelections: ScheduleSelectionWithClass[],
    newClass: ClassWithTimeSlot,
    allTimeSlots: TimeSlot[] = []
  ): ClassWithTimeSlot[] {
    const conflicts: ClassWithTimeSlot[] = [];

    // Check conflicts in the primary time slot
    const primaryConflicts = userSelections
      .filter(
        selection =>
          selection.class.timeSlot.dayOfWeek === newClass.timeSlot.dayOfWeek &&
          selection.class.timeSlotId === newClass.timeSlotId &&
          selection.class.id !== newClass.id
      )
      .map(selection => selection.class);

    conflicts.push(...primaryConflicts);

    // If the new class is a double lesson, check conflicts in the next consecutive slot
    if (newClass.isDouble && allTimeSlots.length > 0) {
      const nextTimeSlot = this.getNextConsecutiveTimeSlot(
        newClass.timeSlot,
        allTimeSlots
      );
      if (nextTimeSlot) {
        const nextSlotConflicts = userSelections
          .filter(
            selection =>
              selection.class.timeSlot.dayOfWeek ===
                newClass.timeSlot.dayOfWeek &&
              selection.class.timeSlotId === nextTimeSlot.id &&
              selection.class.id !== newClass.id
          )
          .map(selection => selection.class);

        conflicts.push(...nextSlotConflicts);
      }
    }

    // Also check if any existing double lessons would conflict with this class
    const existingDoubleConflicts = userSelections
      .filter(selection => {
        const existingClass = selection.class;
        if (!existingClass.isDouble) return false;

        // Check if the new class would be in the second slot of an existing double lesson
        if (allTimeSlots.length > 0) {
          const existingNextSlot = this.getNextConsecutiveTimeSlot(
            existingClass.timeSlot,
            allTimeSlots
          );
          return (
            existingNextSlot &&
            existingNextSlot.id === newClass.timeSlotId &&
            existingClass.timeSlot.dayOfWeek === newClass.timeSlot.dayOfWeek &&
            existingClass.id !== newClass.id
          );
        }
        return false;
      })
      .map(selection => selection.class);

    conflicts.push(...existingDoubleConflicts);

    // Remove duplicates
    return conflicts.filter(
      (conflict, index, self) =>
        self.findIndex(c => c.id === conflict.id) === index
    );
  }

  static hasTimeConflict(
    userSelections: ScheduleSelectionWithClass[],
    newClass: ClassWithTimeSlot,
    allTimeSlots: TimeSlot[] = []
  ): boolean {
    return (
      this.getConflictingClasses(userSelections, newClass, allTimeSlots)
        .length > 0
    );
  }

  static getNextConsecutiveTimeSlot(
    currentTimeSlot: TimeSlot,
    allTimeSlots: TimeSlot[]
  ): TimeSlot | null {
    // Filter lesson time slots for the same day and sort by start time
    const daySlots = allTimeSlots
      .filter(slot => slot.dayOfWeek === currentTimeSlot.dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Find the current slot index
    const currentIndex = daySlots.findIndex(
      slot => slot.id === currentTimeSlot.id
    );

    // Return the next slot if it exists
    if (currentIndex >= 0 && currentIndex < daySlots.length - 1) {
      return daySlots[currentIndex + 1];
    }

    return null;
  }

  static getClassesByTimeSlot(
    classes: ClassWithTimeSlot[],
    timeSlotId: string,
    grade?: number
  ): ClassWithTimeSlot[] {
    return classes.filter(
      cls =>
        cls.timeSlotId === timeSlotId &&
        (grade === undefined || cls.grades?.includes(grade))
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
    return `כיתה ${this.getGradeNameShort(grade)}`;
  }

  static getGradeNameShort(grade: number): string {
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
