import type {
  ClassWithTimeSlot,
  ScheduleOverrideWithTimeSlot,
} from "../../types";

/** What a lesson card shows, whichever card renders it (desktop grid,
 * mobile day view). The cards decide how much of it to show. */
export interface LessonCardModel {
  title: string;
  teacher?: string;
  room?: string;
  grades?: number[];
  /** A Double Lesson's second slot. */
  isContinuation: boolean;
  isDouble: boolean;
  isMandatory: boolean;
  isOverride: boolean;
}

export function classLesson(
  cls: ClassWithTimeSlot,
  { isContinuation = false }: { isContinuation?: boolean } = {}
): LessonCardModel {
  return {
    title: cls.title,
    teacher: cls.teacher,
    room: cls.room,
    grades: cls.grades,
    isContinuation,
    isDouble: cls.isDouble,
    isMandatory: cls.isMandatory,
    isOverride: false,
  };
}

export function overrideLesson(
  override: ScheduleOverrideWithTimeSlot
): LessonCardModel {
  return {
    title: override.title,
    teacher: override.teacher,
    room: override.room,
    isContinuation: false,
    isDouble: false,
    isMandatory: false,
    isOverride: true,
  };
}

/** The card's CSS classes (LessonCard.css): the same variant classes on
 * every card, so desktop and mobile share colours and borders. `plain`
 * drops the variant colours (mandatory, double, override) and keeps the
 * base card, for views that show the schedule as a brief. */
export function lessonCardClassName(
  lesson: LessonCardModel,
  { plain = false, extra }: { plain?: boolean; extra?: string } = {}
): string {
  return [
    "class-card",
    "selected-card",
    !plain && lesson.isDouble && "double-card",
    !plain && lesson.isMandatory && "mandatory-card",
    !plain && lesson.isOverride && "override-card",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}
