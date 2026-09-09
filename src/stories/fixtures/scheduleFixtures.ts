import { ScheduleService } from "../../services/scheduleService";
import { getDefaultTimeSlots, isLessonTimeSlot } from "../../utils/timeSlots";
import { DAYS_OF_WEEK } from "../../types";
import type { TimeSlot, ClassWithTimeSlot } from "../../types";

// Shared mock schedule data for stories (ScheduleTable, PrintableSchedule),
// so both render the exact same week and stay in sync as it evolves.

// Full school day, including meetings and breaks, so the table renders exactly
// as it does in the app (not just the lesson slots).
export const mockTimeSlots: TimeSlot[] = getDefaultTimeSlots().map(
  (slot, index) => ({
    ...slot,
    id: String(index + 1),
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  })
);

const lessonSlots = mockTimeSlots.filter(isLessonTimeSlot);

const subjects = [
  { title: "מתמטיקה", teacher: "מורה שרה" },
  { title: "עברית", teacher: "מורה רחל" },
  { title: "אנגלית", teacher: "מורה דוד" },
  { title: "מדעים", teacher: "מורה מיכל" },
  { title: 'תנ"ך', teacher: "מורה יעל" },
  { title: "אומנות", teacher: "מורה נועה" },
];

// One class per lesson slot per day, so every day of the week has a full
// column of classes to select from.
export const mockClasses: ClassWithTimeSlot[] = DAYS_OF_WEEK.flatMap(day =>
  lessonSlots.map((timeSlot, index) => {
    const subject = subjects[index];
    const gradeStart = ((index + day.key) % 6) + 1;
    const grades =
      (index + day.key) % 3 === 0
        ? [gradeStart]
        : [gradeStart, Math.min(gradeStart + 1, 6)];

    return {
      id: `class-${day.key}-${index}`,
      title: subject.title,
      description: `שיעור ${subject.title} - יום ${day.name}`,
      teacher: subject.teacher,
      slots: [{ dayOfWeek: day.key, timeSlotId: timeSlot.id, timeSlot }],
      grades,
      isMandatory: index === 0,
      isDouble: false,
      groupNumber: null,
      trackNumber: null,
      room: `כיתה ${100 + day.key * 10 + index}`,
      scope: "test" as const,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
  })
);

// A handful of slots with several competing classes to choose from, so the
// "multiple classes" cell state shows up throughout the week (not just once).
// Skips day/slot pairs used elsewhere below (the empty slot, the double
// lesson, and each day's pre-selected slot at index 1).
const extraOptions: {
  dayKey: number;
  slotIndex: number;
  title: string;
  teacher: string;
  grades: number[];
  room: string;
}[] = [
  {
    dayKey: 1,
    slotIndex: 2,
    title: "חינוך גופני",
    teacher: "מורה אבי",
    grades: [2, 3],
    room: "אולם ספורט",
  },
  {
    dayKey: 4,
    slotIndex: 4,
    title: "מחשבים",
    teacher: "מורה תום",
    grades: [5, 6],
    room: "כיתת מחשבים",
  },
  {
    dayKey: 4,
    slotIndex: 4,
    title: "מוזיקה",
    teacher: "מורה שירה",
    grades: [1],
    room: "חדר מוזיקה",
  },
  {
    dayKey: 0,
    slotIndex: 3,
    title: "מחול",
    teacher: "מורה דנה",
    grades: [1, 2],
    room: "אולם מחול",
  },
  {
    dayKey: 3,
    slotIndex: 0,
    title: "רובוטיקה",
    teacher: "מורה גיל",
    grades: [4, 5],
    room: "מעבדת רובוטיקה",
  },
  {
    dayKey: 0,
    slotIndex: 5,
    title: "שחמט",
    teacher: "מורה עידו",
    grades: [3],
    room: "חדר העשרה",
  },
  {
    dayKey: 0,
    slotIndex: 5,
    title: "דרמה",
    teacher: "מורה טל",
    grades: [4],
    room: "חדר דרמה",
  },
];

mockClasses.push(
  ...extraOptions.map((option, index) => {
    const timeSlot = lessonSlots[option.slotIndex];
    return {
      id: `class-${option.dayKey}-${option.slotIndex}-extra-${index}`,
      title: option.title,
      description: `שיעור ${option.title}`,
      teacher: option.teacher,
      slots: [{ dayOfWeek: option.dayKey, timeSlotId: timeSlot.id, timeSlot }],
      grades: option.grades,
      isMandatory: false,
      isDouble: false,
      groupNumber: null,
      trackNumber: null,
      room: option.room,
      scope: "test" as const,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
  })
);

// Leave Wednesday's last lesson with no classes at all, so the empty-slot
// state shows up too.
mockClasses.splice(
  mockClasses.findIndex(cls => cls.id === "class-3-5"),
  1
);

// Turn Tuesday's last two lesson slots into a double lesson.
export const doubleDayKey = 2;
const [doubleFirstSlot, doubleSecondSlot] = lessonSlots.slice(-2);
const doubleClassIndex = mockClasses.findIndex(
  cls =>
    cls.id === `class-${doubleDayKey}-${lessonSlots.indexOf(doubleFirstSlot)}`
);
mockClasses.splice(doubleClassIndex, 1);
mockClasses.splice(
  mockClasses.findIndex(
    cls =>
      cls.id ===
      `class-${doubleDayKey}-${lessonSlots.indexOf(doubleSecondSlot)}`
  ),
  1,
  {
    id: `class-${doubleDayKey}-double`,
    title: "אומנות - שיעור כפול",
    description: "שיעור אומנות כפול - יום שלישי",
    teacher: "מורה נועה",
    slots: [
      {
        dayOfWeek: doubleDayKey,
        timeSlotId: doubleFirstSlot.id,
        timeSlot: doubleFirstSlot,
      },
      {
        dayOfWeek: doubleDayKey,
        timeSlotId: doubleSecondSlot.id,
        timeSlot: doubleSecondSlot,
      },
    ],
    grades: [4, 5],
    isMandatory: true,
    isDouble: true,
    groupNumber: null,
    trackNumber: null,
    room: "חדר אומנות",
    scope: "test",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  }
);

// Build the weekly schedule properly to handle double lessons
export const mockWeeklySchedule =
  ScheduleService.buildWeeklySchedule(mockClasses);

// One selected class per day (skipping the "multiple classes" cell and the
// double lesson pair), so selection is partial and spread across every day.
export const selectedClassIds = DAYS_OF_WEEK.filter(
  day => day.key !== doubleDayKey
).map(day => `class-${day.key}-1`);
selectedClassIds.push(`class-${doubleDayKey}-double`);
