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

export type ClassScope = "test" | "prod";

export interface Class {
  id: string;
  title: string;
  description: string;
  teacher: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  timeSlotId: string;
  grades: number[]; // Changed from single grade to multiple grades
  isMandatory: boolean;
  isDouble: boolean; // Whether this lesson takes two consecutive time slots
  room: string; // Room/location where the lesson takes place
  scope: ClassScope;
  createdAt: string;
  updatedAt: string;
}

export interface ClassWithTimeSlot extends Class {
  timeSlot: TimeSlot;
}

export interface ScheduleSelection {
  id: string;
  userId: string;
  classId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSelectionWithClass extends ScheduleSelection {
  class: ClassWithTimeSlot;
}

export interface WeeklySchedule {
  [dayOfWeek: number]: {
    [timeSlotId: string]: Class[];
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
