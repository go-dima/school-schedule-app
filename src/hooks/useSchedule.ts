import { useState, useEffect } from 'react'
import { classesApi, timeSlotsApi, scheduleApi } from '../services/api'
import { ScheduleService } from '../services/scheduleService'
import type { 
  ClassWithTimeSlot, 
  TimeSlot, 
  ScheduleSelectionWithClass,
  WeeklySchedule 
} from '../types'

export function useSchedule(userId?: string) {
  const [classes, setClasses] = useState<ClassWithTimeSlot[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [userSelections, setUserSelections] = useState<ScheduleSelectionWithClass[]>([])
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadScheduleData()
  }, [userId])

  const loadScheduleData = async () => {
    setLoading(true)
    setError(null)

    try {
      const [classesData, timeSlotsData, userSchedule] = await Promise.all([
        classesApi.getClasses(),
        timeSlotsApi.getTimeSlots(),
        userId ? scheduleApi.getUserSchedule(userId) : Promise.resolve([])
      ])

      setClasses(classesData)
      setTimeSlots(timeSlotsData)
      setUserSelections(userSchedule)
      setWeeklySchedule(ScheduleService.buildWeeklySchedule(classesData))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }

  const selectClass = async (classId: string) => {
    if (!userId) return

    try {
      await scheduleApi.selectClass(userId, classId)
      await loadUserSchedule()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select class')
      throw err
    }
  }

  const unselectClass = async (classId: string) => {
    if (!userId) return

    try {
      await scheduleApi.unselectClass(userId, classId)
      await loadUserSchedule()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unselect class')
      throw err
    }
  }

  const loadUserSchedule = async () => {
    if (!userId) return

    try {
      const userSchedule = await scheduleApi.getUserSchedule(userId)
      setUserSelections(userSchedule)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user schedule')
    }
  }

  const getClassesByTimeSlot = (timeSlotId: string, grade?: number): ClassWithTimeSlot[] => {
    return ScheduleService.getClassesByTimeSlot(classes, timeSlotId, grade)
  }

  const hasTimeConflict = (newClass: ClassWithTimeSlot): boolean => {
    return ScheduleService.hasTimeConflict(userSelections, newClass)
  }

  const getConflictingClasses = (newClass: ClassWithTimeSlot): ClassWithTimeSlot[] => {
    return ScheduleService.getConflictingClasses(userSelections, newClass)
  }

  const isClassSelected = (classId: string): boolean => {
    return userSelections.some(selection => selection.classId === classId)
  }

  const getSelectedClassForTimeSlot = (timeSlotId: string): ClassWithTimeSlot | null => {
    const selection = userSelections.find(
      selection => selection.class.timeSlotId === timeSlotId
    )
    return selection ? selection.class : null
  }

  return {
    classes,
    timeSlots,
    userSelections,
    weeklySchedule,
    loading,
    error,
    loadScheduleData,
    selectClass,
    unselectClass,
    getClassesByTimeSlot,
    hasTimeConflict,
    getConflictingClasses,
    isClassSelected,
    getSelectedClassForTimeSlot,
  }
}