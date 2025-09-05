/**
 * Mandatory Class Service
 * Handles automatic selection and management of mandatory classes
 */

import { scheduleApi, classesApi } from './api'
import type { ClassWithTimeSlot, UserRoleData } from '../types'

export class MandatoryClassService {
  /**
   * Get mandatory classes for a specific grade
   */
  static async getMandatoryClassesForGrade(grade: number): Promise<ClassWithTimeSlot[]> {
    try {
      const allClasses = await classesApi.getClasses()
      return allClasses.filter(cls => cls.isMandatory && cls.grades?.includes(grade))
    } catch (error) {
      console.error('Failed to get mandatory classes:', error)
      return []
    }
  }

  /**
   * Auto-select mandatory classes for a user based on their grade/role
   */
  static async autoSelectMandatoryClasses(
    userId: string, 
    _userRole: UserRoleData,
    userGrade?: number
  ): Promise<void> {
    if (!userGrade) {
      console.warn('No grade specified for mandatory class selection')
      return
    }

    try {
      // Get mandatory classes for the user's grade
      const mandatoryClasses = await this.getMandatoryClassesForGrade(userGrade)
      
      if (mandatoryClasses.length === 0) {
        console.log(`No mandatory classes found for grade ${userGrade}`)
        return
      }

      // Get user's current selections to avoid duplicates
      const currentSelections = await scheduleApi.getUserSchedule(userId)
      const selectedClassIds = currentSelections.map(selection => selection.classId)

      // Select mandatory classes that aren't already selected
      const classesToSelect = mandatoryClasses.filter(
        cls => !selectedClassIds.includes(cls.id)
      )

      console.log(`Auto-selecting ${classesToSelect.length} mandatory classes for user ${userId}`)

      // Select each mandatory class
      for (const mandatoryClass of classesToSelect) {
        try {
          await scheduleApi.selectClass(userId, mandatoryClass.id)
          console.log(`Auto-selected mandatory class: ${mandatoryClass.title}`)
        } catch (error) {
          console.error(`Failed to auto-select mandatory class ${mandatoryClass.title}:`, error)
        }
      }
    } catch (error) {
      console.error('Failed to auto-select mandatory classes:', error)
    }
  }

  /**
   * Check if a class can be unselected (mandatory classes cannot be unselected by students)
   */
  static canUnselectClass(
    classItem: ClassWithTimeSlot,
    userRole: UserRoleData
  ): boolean {
    // Admins and staff can unselect any class
    if (userRole.role === 'admin' || userRole.role === 'staff') {
      return true
    }

    // Parents can unselect any class for their children
    if (userRole.role === 'parent') {
      return true
    }

    // Students cannot unselect mandatory classes
    if (userRole.role === 'child' && classItem.isMandatory) {
      return false
    }

    return true
  }

  /**
   * Get classes that conflict with a mandatory class
   * This helps identify scheduling conflicts when mandatory classes are involved
   */
  static async getConflictsWithMandatoryClasses(
    newClass: ClassWithTimeSlot,
    userGrade: number
  ): Promise<ClassWithTimeSlot[]> {
    try {
      const mandatoryClasses = await this.getMandatoryClassesForGrade(userGrade)
      
      return mandatoryClasses.filter(mandatoryClass => 
        mandatoryClass.timeSlot.dayOfWeek === newClass.timeSlot.dayOfWeek &&
        mandatoryClass.timeSlotId === newClass.timeSlotId &&
        mandatoryClass.id !== newClass.id
      )
    } catch (error) {
      console.error('Failed to check mandatory class conflicts:', error)
      return []
    }
  }

  /**
   * Create a new mandatory class
   */
  static async createMandatoryClass(
    classData: Omit<ClassWithTimeSlot, 'id' | 'createdAt' | 'updatedAt' | 'timeSlot'>
  ): Promise<any> {
    try {
      const newClass = await classesApi.createClass({
        ...classData,
        isMandatory: true
      })

      console.log(`Created mandatory class: ${classData.title} for grades ${classData.grades?.join(', ')}`)
      
      // Auto-select this class for all users in the relevant grades
      if (classData.grades && classData.grades.length > 0) {
        for (const grade of classData.grades) {
          await this.autoSelectForAllUsersInGrade(newClass.id, grade)
        }
      }
      
      return newClass
    } catch (error) {
      console.error('Failed to create mandatory class:', error)
      throw error
    }
  }

  /**
   * Auto-select a mandatory class for all users in a specific grade
   */
  private static async autoSelectForAllUsersInGrade(
    classId: string, 
    grade: number
  ): Promise<void> {
    try {
      // This would require additional database queries to get all users in a grade
      // For now, we'll log the action - in a real implementation, you'd query
      // for all users with the 'child' role in the specified grade
      console.log(`Would auto-select class ${classId} for all students in grade ${grade}`)
      
      // TODO: Implement actual auto-selection for existing students
      // This would involve:
      // 1. Query for all users with child role and matching grade
      // 2. For each user, select the mandatory class
      // 3. Handle any conflicts that arise
    } catch (error) {
      console.error('Failed to auto-select for grade users:', error)
    }
  }

  /**
   * Handle new user registration - auto-select mandatory classes
   */
  static async handleNewUserRegistration(
    userId: string,
    userRole: UserRoleData,
    userGrade?: number
  ): Promise<void> {
    // Only auto-select for students
    if (userRole.role !== 'child' || !userGrade) {
      return
    }

    console.log(`Handling new user registration: auto-selecting mandatory classes for grade ${userGrade}`)
    
    // Small delay to ensure user profile is fully set up
    setTimeout(() => {
      this.autoSelectMandatoryClasses(userId, userRole, userGrade)
    }, 1000)
  }

  /**
   * Validate that a user hasn't unselected mandatory classes
   */
  static async validateUserSchedule(
    userId: string,
    userGrade: number
  ): Promise<{
    isValid: boolean
    missingMandatory: ClassWithTimeSlot[]
  }> {
    try {
      const mandatoryClasses = await this.getMandatoryClassesForGrade(userGrade)
      const userSelections = await scheduleApi.getUserSchedule(userId)
      const selectedClassIds = userSelections.map(selection => selection.classId)

      const missingMandatory = mandatoryClasses.filter(
        cls => !selectedClassIds.includes(cls.id)
      )

      return {
        isValid: missingMandatory.length === 0,
        missingMandatory
      }
    } catch (error) {
      console.error('Failed to validate user schedule:', error)
      return {
        isValid: false,
        missingMandatory: []
      }
    }
  }
}

export const mandatoryClassService = MandatoryClassService