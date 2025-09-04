/**
 * Time slots utility
 * Provides functions for managing and categorizing time slots
 */

import type { TimeSlot } from '../types'

// Time slot categories based on PRD requirements
export const TIME_SLOT_CATEGORIES = {
  MEETINGS: ['מפגש בוקר', 'מפגש צהריים'],
  BREAKS: ['הפסקת אוכל', 'הפסקה', 'הפסקה קטנה', 'ארוחת צהריים'],
  LESSONS: ['שיעור ראשון', 'שיעור שני', 'שיעור שלישי', 'שיעור רביעי', 'שיעור חמישי', 'שיעור שישי'],
} as const

export type TimeSlotCategory = keyof typeof TIME_SLOT_CATEGORIES

/**
 * Get the category of a time slot based on its name
 */
export function getTimeSlotCategory(timeSlotName: string): TimeSlotCategory | null {
  for (const [category, names] of Object.entries(TIME_SLOT_CATEGORIES)) {
    if (names.includes(timeSlotName as any)) {
      return category as TimeSlotCategory
    }
  }
  return null
}

/**
 * Check if a time slot is a lesson (can have classes)
 */
export function isLessonTimeSlot(timeSlot: TimeSlot): boolean {
  return TIME_SLOT_CATEGORIES.LESSONS.includes(timeSlot.name as any)
}

/**
 * Check if a time slot is a break
 */
export function isBreakTimeSlot(timeSlot: TimeSlot): boolean {
  return TIME_SLOT_CATEGORIES.BREAKS.includes(timeSlot.name as any)
}

/**
 * Check if a time slot is a meeting
 */
export function isMeetingTimeSlot(timeSlot: TimeSlot): boolean {
  return TIME_SLOT_CATEGORIES.MEETINGS.includes(timeSlot.name as any)
}

/**
 * Filter time slots by category
 */
export function filterTimeSlotsByCategory(
  timeSlots: TimeSlot[], 
  category: TimeSlotCategory
): TimeSlot[] {
  const categoryNames = TIME_SLOT_CATEGORIES[category]
  return timeSlots.filter(slot => categoryNames.includes(slot.name as any))
}

/**
 * Get lesson time slots only (excludes breaks and meetings)
 */
export function getLessonTimeSlots(timeSlots: TimeSlot[]): TimeSlot[] {
  return filterTimeSlotsByCategory(timeSlots, 'LESSONS')
}

/**
 * Get default time slots for a day (based on PRD)
 */
export function getDefaultTimeSlotsForDay(dayOfWeek: number): Omit<TimeSlot, 'id' | 'createdAt' | 'updatedAt'>[] {
  return [
    { name: 'מפגש בוקר', startTime: '08:30', endTime: '09:00', dayOfWeek },
    { name: 'הפסקת אוכל', startTime: '09:00', endTime: '09:15', dayOfWeek },
    { name: 'שיעור ראשון', startTime: '09:15', endTime: '09:50', dayOfWeek },
    { name: 'שיעור שני', startTime: '09:50', endTime: '10:30', dayOfWeek },
    { name: 'הפסקה', startTime: '10:30', endTime: '11:00', dayOfWeek },
    { name: 'שיעור שלישי', startTime: '11:00', endTime: '11:40', dayOfWeek },
    { name: 'שיעור רביעי', startTime: '11:40', endTime: '12:20', dayOfWeek },
    { name: 'הפסקה קטנה', startTime: '12:20', endTime: '12:30', dayOfWeek },
    { name: 'מפגש צהריים', startTime: '12:30', endTime: '12:45', dayOfWeek },
    { name: 'ארוחת צהריים', startTime: '12:45', endTime: '13:30', dayOfWeek },
    { name: 'שיעור חמישי', startTime: '13:30', endTime: '14:15', dayOfWeek },
    { name: 'שיעור שישי', startTime: '14:15', endTime: '15:00', dayOfWeek },
  ]
}

/**
 * Validate time slot name against PRD requirements
 */
export function isValidTimeSlotName(name: string): boolean {
  return Object.values(TIME_SLOT_CATEGORIES).flat().includes(name as any)
}

/**
 * Get time slot display info with styling hints
 */
export function getTimeSlotDisplayInfo(timeSlot: TimeSlot): {
  category: TimeSlotCategory | null
  isSelectable: boolean
  cssClass: string
  description: string
} {
  const category = getTimeSlotCategory(timeSlot.name)
  
  switch (category) {
    case 'LESSONS':
      return {
        category,
        isSelectable: true,
        cssClass: 'lesson-slot',
        description: 'זמן לימוד - ניתן לבחור שיעורים'
      }
    case 'BREAKS':
      return {
        category,
        isSelectable: false,
        cssClass: 'break-slot',
        description: 'הפסקה'
      }
    case 'MEETINGS':
      return {
        category,
        isSelectable: false,
        cssClass: 'meeting-slot',
        description: 'מפגש כיתתי'
      }
    default:
      return {
        category: null,
        isSelectable: false,
        cssClass: 'unknown-slot',
        description: 'זמן לא מוגדר'
      }
  }
}