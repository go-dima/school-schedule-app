export type UserRole = "admin" | "parent" | "child" | "staff";

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
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
  teacher: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface ParentChildRelationship {
  id: string;
  parentId: string;
  childId: string;
  isPrimary: boolean;
  createdAt: string;
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
