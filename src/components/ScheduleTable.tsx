import React, { useState } from 'react'
import { Table, Card, Tag, Button, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DAYS_OF_WEEK } from '../types'
import { ScheduleService } from '../services/scheduleService'
import { getTimeSlotDisplayInfo, isLessonTimeSlot } from '../utils/timeSlots'
import type { TimeSlot, ClassWithTimeSlot, WeeklySchedule } from '../types'
import ClassSelectionDrawer from './ClassSelectionDrawer'
import './ScheduleTable.css'

interface ScheduleTableProps {
  timeSlots: TimeSlot[]
  classes: ClassWithTimeSlot[]
  weeklySchedule: WeeklySchedule
  userGrade?: number
  selectedClasses?: string[]
  onClassSelect?: (classId: string) => void
  onClassUnselect?: (classId: string) => void
  canSelectClasses?: boolean
}

interface ScheduleRow {
  key: string
  timeSlot: TimeSlot
  [key: string]: any
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({
  timeSlots,
  classes,
  weeklySchedule,
  userGrade,
  selectedClasses = [],
  onClassSelect,
  onClassUnselect,
  canSelectClasses = false
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null)
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null)

  const handleCellClick = (timeSlot: TimeSlot, dayOfWeek: number) => {
    if (!canSelectClasses) return
    
    // Only allow selection for lesson time slots
    const displayInfo = getTimeSlotDisplayInfo(timeSlot)
    if (!displayInfo.isSelectable) return
    
    setSelectedTimeSlot(timeSlot)
    setSelectedDayOfWeek(dayOfWeek)
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setSelectedTimeSlot(null)
    setSelectedDayOfWeek(null)
  }

  const getTimeSlotsForDay = (dayOfWeek: number) => {
    return timeSlots.filter(slot => slot.dayOfWeek === dayOfWeek)
  }

  const renderClassCell = (timeSlot: TimeSlot, dayOfWeek: number) => {
    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || []
    const filteredClasses = userGrade 
      ? dayClasses.filter(cls => cls.grade === userGrade)
      : dayClasses

    const displayInfo = getTimeSlotDisplayInfo(timeSlot)
    const isSelectableSlot = displayInfo.isSelectable && canSelectClasses

    // Handle non-lesson time slots (breaks, meetings)
    if (!isLessonTimeSlot(timeSlot)) {
      return (
        <div 
          className={`schedule-cell ${displayInfo.cssClass}`}
          title={displayInfo.description}
        >
          <Card size="small" className="non-lesson-card">
            <div className="non-lesson-content">
              <div className="slot-name">{timeSlot.name}</div>
              <div className="slot-description">{displayInfo.description}</div>
            </div>
          </Card>
        </div>
      )
    }

    if (filteredClasses.length === 0) {
      return (
        <div 
          className={`schedule-cell empty ${isSelectableSlot ? 'clickable' : ''}`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}
        >
          <Empty 
            image={Empty.PRESENTED_IMAGE_SIMPLE} 
            description="אין שיעורים"
            style={{ margin: '8px 0' }}
          />
        </div>
      )
    }

    if (filteredClasses.length === 1) {
      const cls = filteredClasses[0]
      const isSelected = selectedClasses.includes(cls.id)
      
      return (
        <div 
          className={`schedule-cell single ${isSelectableSlot ? 'clickable' : ''} ${isSelected ? 'selected' : ''}`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}
        >
          <Card size="small" className="class-card">
            <div className="class-title">{cls.title}</div>
            <div className="class-teacher">{cls.teacher}</div>
            <div className="class-tags">
              <Tag color={isSelected ? 'green' : 'blue'} size="small">
                {ScheduleService.getGradeName(cls.grade)}
              </Tag>
              {cls.isMandatory && (
                <Tag color="red" size="small">
                  חובה
                </Tag>
              )}
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div 
        className={`schedule-cell multiple ${isSelectableSlot ? 'clickable' : ''}`}
        onClick={() => handleCellClick(timeSlot, dayOfWeek)}
      >
        <Card size="small" className="class-card">
          <div className="multiple-classes">
            <div className="class-count">{filteredClasses.length} שיעורים</div>
            <Button type="link" size="small">
              לחץ לבחירה
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  const createScheduleData = (): ScheduleRow[] => {
    const uniqueTimeSlots = timeSlots.reduce((acc, slot) => {
      const key = `${slot.startTime}-${slot.endTime}-${slot.name}`
      if (!acc.find(s => `${s.startTime}-${s.endTime}-${s.name}` === key)) {
        acc.push(slot)
      }
      return acc
    }, [] as TimeSlot[])

    return uniqueTimeSlots
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(slot => {
        const row: ScheduleRow = {
          key: `${slot.startTime}-${slot.endTime}`,
          timeSlot: slot
        }
        
        DAYS_OF_WEEK.forEach(day => {
          row[`day_${day.key}`] = renderClassCell(slot, day.key)
        })
        
        return row
      })
  }

  const columns: ColumnsType<ScheduleRow> = [
    {
      title: 'זמן',
      dataIndex: 'timeSlot',
      key: 'time',
      width: 120,
      className: 'time-column',
      render: (timeSlot: TimeSlot) => (
        <div className="time-cell">
          <div className="time-range">
            {ScheduleService.formatTimeRange(timeSlot.startTime, timeSlot.endTime)}
          </div>
          <div className="time-name">{timeSlot.name}</div>
        </div>
      )
    },
    ...DAYS_OF_WEEK.map(day => ({
      title: day.name,
      dataIndex: `day_${day.key}`,
      key: `day_${day.key}`,
      className: 'day-column',
      render: (content: React.ReactNode) => content
    }))
  ]

  const scheduleData = createScheduleData()

  return (
    <div className="schedule-table-container">
      <Table<ScheduleRow>
        columns={columns}
        dataSource={scheduleData}
        pagination={false}
        scroll={{ x: 800 }}
        className="schedule-table rtl-table"
        size="small"
        bordered
      />
      
      {selectedTimeSlot && selectedDayOfWeek !== null && (
        <ClassSelectionDrawer
          open={drawerOpen}
          onClose={handleCloseDrawer}
          timeSlot={selectedTimeSlot}
          dayOfWeek={selectedDayOfWeek}
          classes={classes.filter(cls => 
            cls.timeSlotId === selectedTimeSlot.id && 
            cls.timeSlot.dayOfWeek === selectedDayOfWeek &&
            (!userGrade || cls.grade === userGrade)
          )}
          selectedClasses={selectedClasses}
          onClassSelect={onClassSelect}
          onClassUnselect={onClassUnselect}
        />
      )}
    </div>
  )
}

export default ScheduleTable