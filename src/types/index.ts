export type UserRole = "admin" | "parent" | "child" | "staff" | "moderator";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  // Name a staff member is shown under (Staff View, class teacher label).
  displayName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRoleData {
  id: string;
  userId: string;
  role: UserRole;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PendingApproval {
  id: string;
  userId: string;
  role: UserRole;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  user: User;
}

export interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export type Scope = "test" | "prod";

export interface ClassSlot {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  timeSlotId: string;
}

export interface ClassSlotWithTimeSlot extends ClassSlot {
  timeSlot: TimeSlot;
}

export interface Class {
  id: string;
  title: string;
  description: string;
  teacher: string; // Label; a cached copy of the linked user's display name when userId is set
  userId?: string | null; // Linked Teacher: the teaching user, when they have an account
  slots: ClassSlot[]; // One or more Class Slots this class occupies
  grades: number[]; // Changed from single grade to multiple grades
  isMandatory: boolean;
  isDouble: boolean; // Whether this lesson takes two sequential Class Slots on the same day
  groupNumber: number | null; // קבוצה: 1, 2, or null. Convention: grades 1-2
  trackNumber: number | null; // מסלול: 1, 2, or null. Convention: grades 3-6
  room: string; // Room/location where the lesson takes place
  scope: Scope;
  createdAt: string;
  updatedAt: string;
}

export interface ClassWithTimeSlot extends Omit<Class, "slots"> {
  slots: ClassSlotWithTimeSlot[];
}

export type SelectionStatus = "draft" | "committed";

export interface ScheduleSelection {
  id: string;
  userId: string;
  classId: string;
  status: SelectionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSelectionWithClass extends ScheduleSelection {
  childId?: string;
  class: ClassWithTimeSlot;
}

// Identifies whose schedule_selections rows to read/write: either a
// child-linked selection (parent/staff acting for a student) or a
// user-linked one (the "child" role selecting for themselves).
export type ScheduleTarget = { userId: string } | { childId: string };

export interface WeeklySchedule {
  [dayOfWeek: number]: {
    [timeSlotId: string]: ClassWithTimeSlot[];
  };
}

export const DAYS_OF_WEEK = [
  { key: 0, name: "ראשון", nameEn: "Sunday" },
  { key: 1, name: "שני", nameEn: "Monday" },
  { key: 2, name: "שלישי", nameEn: "Tuesday" },
  { key: 3, name: "רביעי", nameEn: "Wednesday" },
  { key: 4, name: "חמישי", nameEn: "Thursday" },
] as const;

export const GRADES = [1, 2, 3, 4, 5, 6] as const;

export interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  groupNumber: number | null; // קבוצה: 1, 2, or null. Convention: grades 1-2
  trackNumber: number | null; // מסלול: 1, 2, or null. Convention: grades 3-6
  scope: Scope;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuplicateChildMatch {
  id: string;
  grade: number;
  createdByUserId: string | null;
  createdByName: string | null;
  createdByIsSelf: boolean;
}

export interface ParentChildRelationship {
  id: string;
  parentId: string;
  childId: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface EnrolledChild extends Child {
  addedByUserId: string;
  addedByFirstName: string | null;
  addedByLastName: string | null;
  addedByAt: string;
}

export interface ChildWithParents extends Child {
  parents: Array<{
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isPrimary: boolean;
  }>;
}

export interface ScheduleSelectionWithChild
  extends Omit<ScheduleSelection, "userId"> {
  childId: string;
  child: Child;
}

// Staff-authored one-off lesson injected directly into a child's schedule.
// Fully isolated from `classes`/`schedule_selections` - never subject to
// catalog conflict detection or group/mandatory/track auto-lock.
export interface ScheduleOverride {
  id: string;
  childId: string;
  title: string;
  teacher: string; // Label; a cached copy of the linked user's display name when userId is set
  userId?: string | null; // Linked Teacher: the teaching user, when they have an account
  room: string;
  dayOfWeek: number;
  timeSlotId: string;
  scope: Scope;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleOverrideWithTimeSlot extends ScheduleOverride {
  timeSlot: TimeSlot;
}

// An override as seen from the teacher's side (Staff View): the same row,
// plus the display name of the child it was authored for.
export interface ScheduleOverrideWithChildName
  extends ScheduleOverrideWithTimeSlot {
  childName: string;
}

/** A staff user with a display name (get_staff_directory RPC). */
export interface StaffDirectoryEntry {
  id: string;
  displayName: string;
}

/** A catalog (teacher, title) pair plus the linked teaching user, if any. */
export interface TeacherTitlePair {
  teacher: string;
  title: string;
  userId: string | null;
}

/** One committed selection, with the child it was made for (Staff View). */
export interface StaffSelection {
  class: ClassWithTimeSlot;
  childId: string;
  childName: string;
}
