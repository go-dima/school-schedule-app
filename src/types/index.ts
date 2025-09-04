export type UserRole = 'admin' | 'parent' | 'child' | 'staff'

export interface User {
  id: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface UserRoleData {
  id: string
  userId: string
  role: UserRole
  approved: boolean
  createdAt: string
  updatedAt: string
}

export interface TimeSlot {
  id: string
  name: string
  startTime: string
  endTime: string
  dayOfWeek: number // 0=Sunday, 1=Monday, etc.
  createdAt: string
  updatedAt: string
}

export interface Class {
  id: string
  title: string
  description: string
  teacher: string
  timeSlotId: string
  grade: number
  isMandatory: boolean
  createdAt: string
  updatedAt: string
}

export interface ClassWithTimeSlot extends Class {
  timeSlot: TimeSlot
}

export interface ScheduleSelection {
  id: string
  userId: string
  classId: string
  createdAt: string
  updatedAt: string
}

export interface ScheduleSelectionWithClass extends ScheduleSelection {
  class: ClassWithTimeSlot
}

export interface WeeklySchedule {
  [dayOfWeek: number]: {
    [timeSlotId: string]: Class[]
  }
}

export const DAYS_OF_WEEK = [
  { key: 0, name: 'ראשון', nameEn: 'Sunday' },
  { key: 1, name: 'שני', nameEn: 'Monday' },
  { key: 2, name: 'שלישי', nameEn: 'Tuesday' },
  { key: 3, name: 'רביעי', nameEn: 'Wednesday' },
  { key: 4, name: 'חמישי', nameEn: 'Thursday' },
] as const

export const GRADES = [1, 2, 3, 4, 5, 6] as const