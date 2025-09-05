import React, { useState } from "react";
import { Table, Card, Tag, Button, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DAYS_OF_WEEK } from "../types";
import { ScheduleService } from "../services/scheduleService";
import { getTimeSlotDisplayInfo, isLessonTimeSlot } from "../utils/timeSlots";
import type { TimeSlot, ClassWithTimeSlot, WeeklySchedule } from "../types";
import ClassSelectionDrawer from "./ClassSelectionDrawer";
import "./ScheduleTable.css";

interface ScheduleTableProps {
  timeSlots: TimeSlot[];
  classes: ClassWithTimeSlot[];
  weeklySchedule: WeeklySchedule;
  userGrade?: number;
  selectedClasses?: string[];
  onClassSelect?: (classId: string) => void;
  onClassUnselect?: (classId: string) => void;
  canSelectClasses?: boolean;
  canViewClasses?: boolean;
  isAdmin?: boolean;
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
}

interface ScheduleRow {
  key: string;
  timeSlot: TimeSlot;
  [key: string]: any;
}

const ScheduleTable: React.FC<ScheduleTableProps> = ({
  timeSlots,
  classes,
  weeklySchedule,
  userGrade,
  selectedClasses = [],
  onClassSelect,
  onClassUnselect,
  canSelectClasses = false,
  canViewClasses = false,
  isAdmin = false,
  onCreateClass,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null
  );
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(
    null
  );

  const handleCellClick = (timeSlot: TimeSlot, dayOfWeek: number) => {
    if (!canViewClasses) return;

    // Only allow drawer opening for lesson time slots
    const displayInfo = getTimeSlotDisplayInfo(timeSlot);
    if (!displayInfo.isSelectable) return;

    setSelectedTimeSlot(timeSlot);
    setSelectedDayOfWeek(dayOfWeek);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedTimeSlot(null);
    setSelectedDayOfWeek(null);
  };

  const renderClassCell = (timeSlot: TimeSlot, dayOfWeek: number) => {
    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

    let filteredClasses = userGrade
      ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
      : dayClasses;

    // Filter out continuation classes (double lessons that don't actually start in this slot)
    filteredClasses = filteredClasses.filter(cls => {
      if (cls.isDouble && cls.timeSlotId !== timeSlot.id) {
        // This is a continuation class (double lesson placed in second slot), don't render it in the normal flow
        return false;
      }
      return true;
    });

    const displayInfo = getTimeSlotDisplayInfo(timeSlot);
    const isSelectableSlot = displayInfo.isSelectable && canViewClasses;

    // Check if this slot has double lessons from the previous slot that are SELECTED (continuation slot)
    const currentSlotClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];
    const doubleContinuationClasses = currentSlotClasses.filter(cls => {
      // Only show continuation for SELECTED double lessons
      const isSelected = selectedClasses.includes(cls.id);
      if (!isSelected) return false;

      // Check if this is a double lesson that actually starts in the previous slot
      const previousTimeSlotIndex = timeSlots
        .filter(slot => slot.dayOfWeek === dayOfWeek && isLessonTimeSlot(slot))
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .findIndex(slot => slot.id === timeSlot.id);

      if (previousTimeSlotIndex > 0) {
        const previousTimeSlots = timeSlots
          .filter(
            slot => slot.dayOfWeek === dayOfWeek && isLessonTimeSlot(slot)
          )
          .sort((a, b) => a.startTime.localeCompare(b.startTime));
        const previousSlot = previousTimeSlots[previousTimeSlotIndex - 1];

        return cls.isDouble && cls.timeSlotId === previousSlot.id;
      }
      return false;
    });

    if (doubleContinuationClasses.length > 0) {
      // This is the second slot of a double lesson
      const doubleClass = doubleContinuationClasses[0]; // Assuming only one double class per slot
      const isSelected = selectedClasses.includes(doubleClass.id);

      if (isSelected) {
        // Show as continuation when selected
        return (
          <div className={`schedule-cell double-continuation selected`}>
            <Card size="small" className="class-card double-card">
              <div className="double-continuation-indicator">
                <div className="class-title-small">{doubleClass.title}</div>
                <div className="continuation-text">(המשך)</div>
              </div>
            </Card>
          </div>
        );
      } else {
        // Show as clickable option when not selected
        const displayState = canSelectClasses ? "unselected" : "view-only";
        const tagColor = canSelectClasses ? "blue" : "blue";

        return (
          <div
            className={`schedule-cell single double-main ${
              isSelectableSlot ? "clickable" : ""
            } ${displayState}`}
            onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
            <Card
              size="small"
              className={`class-card double-card ${displayState}-card`}>
              <div className="class-title">{doubleClass.title}</div>
              <div className="class-teacher">{doubleClass.teacher}</div>
              {doubleClass.room && (
                <div className="class-room">כיתה: {doubleClass.room}</div>
              )}
              <div className="class-tags">
                {doubleClass.grades?.map(grade => (
                  <Tag key={grade} color={tagColor}>
                    {ScheduleService.getGradeName(grade)}
                  </Tag>
                ))}
                {doubleClass.isMandatory && <Tag color="red">ליבה</Tag>}
                <Tag color="orange">שיעור כפול</Tag>
              </div>
            </Card>
          </div>
        );
      }
    }

    // Handle non-lesson time slots (breaks, meetings)
    if (!isLessonTimeSlot(timeSlot)) {
      return (
        <div
          className={`schedule-cell ${displayInfo.cssClass}`}
          title={displayInfo.description}>
          <Card size="small" className="non-lesson-card">
            <div className="non-lesson-content">
              <div className="slot-name">{timeSlot.name}</div>
              <div className="slot-description">{displayInfo.description}</div>
            </div>
          </Card>
        </div>
      );
    }

    if (filteredClasses.length === 0) {
      return (
        <div
          className={`schedule-cell empty ${
            isSelectableSlot ? "clickable" : ""
          }`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="אין שיעורים"
            style={{ margin: "8px 0" }}
          />
        </div>
      );
    }

    // Always show as multiple classes interface for consistency (even with 1 class)
    if (filteredClasses.length >= 1) {
      const classCountText =
        filteredClasses.length === 1
          ? "שיעור אחד"
          : `${filteredClasses.length} שיעורים`;

      return (
        <div
          className={`schedule-cell multiple ${
            isSelectableSlot ? "clickable" : ""
          }`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
          <Card size="small" className="class-card">
            <div className="multiple-classes">
              <div className="class-count">{classCountText}</div>
              <Button
                type="link"
                size="small"
                onClick={e => {
                  e.stopPropagation();
                  handleCellClick(timeSlot, dayOfWeek);
                }}>
                {canSelectClasses ? "לחץ לבחירה" : "לחץ לצפייה"}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    // Empty slot
    return (
      <div
        className={`schedule-cell empty ${isSelectableSlot ? "clickable" : ""}`}
        onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="אין שיעורים"
          style={{ margin: "8px 0" }}
        />
      </div>
    );
  };

  const createScheduleData = (): ScheduleRow[] => {
    // Get unique time periods (start-end-name combinations) across all days
    const uniqueTimePeriods = timeSlots.reduce((acc, slot) => {
      const key = `${slot.startTime}-${slot.endTime}-${slot.name}`;
      if (!acc.includes(key)) {
        acc.push(key);
      }
      return acc;
    }, [] as string[]);

    // For each unique time period, create a row with cells for each day
    return uniqueTimePeriods
      .map(timePeriod => {
        // Extract components for future use if needed
        // const [startTime, endTime, name] = timePeriod.split("-");

        // Find a representative time slot for this period (for display purposes)
        const representativeSlot = timeSlots.find(
          slot =>
            `${slot.startTime}-${slot.endTime}-${slot.name}` === timePeriod
        );

        if (!representativeSlot) return null;

        const row: ScheduleRow = {
          key: timePeriod,
          timeSlot: representativeSlot,
        };

        DAYS_OF_WEEK.forEach(day => {
          // Find the specific time slot for this day and time period
          const dayTimeSlot = timeSlots.find(
            slot =>
              slot.dayOfWeek === day.key &&
              `${slot.startTime}-${slot.endTime}-${slot.name}` === timePeriod
          );

          // Use the day-specific time slot if found, otherwise use representative
          const slotToUse = dayTimeSlot || representativeSlot;
          row[`day_${day.key}`] = renderClassCell(slotToUse, day.key);
        });

        return row;
      })
      .filter(row => row !== null) // Remove null rows
      .sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime));
  };

  const columns: ColumnsType<ScheduleRow> = [
    {
      title: "זמן",
      dataIndex: "timeSlot",
      key: "time",
      width: 120,
      className: "time-column",
      render: (timeSlot: TimeSlot) => {
        const timeRange = ScheduleService.formatTimeRange(
          timeSlot.startTime,
          timeSlot.endTime
        );

        return (
          <div className="time-cell">
            {timeRange && <div className="time-range">{timeRange}</div>}
            <div className="time-name">{timeSlot.name}</div>
          </div>
        );
      },
    },
    ...DAYS_OF_WEEK.map(day => ({
      title: day.name,
      dataIndex: `day_${day.key}`,
      key: `day_${day.key}`,
      className: "day-column",
      render: (content: React.ReactNode) => content,
    })),
  ];

  const scheduleData = createScheduleData();

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
          classes={classes.filter(cls => {
            // Show classes that are directly in this time slot
            if (
              cls.timeSlotId === selectedTimeSlot.id &&
              cls.timeSlot.dayOfWeek === selectedDayOfWeek &&
              (!userGrade || cls.grades?.includes(userGrade))
            ) {
              return true;
            }

            // Also show double lessons from the previous slot that extend into this slot
            const previousTimeSlotIndex = timeSlots
              .filter(slot => slot.dayOfWeek === selectedDayOfWeek)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
              .findIndex(slot => slot.id === selectedTimeSlot.id);

            if (previousTimeSlotIndex > 0) {
              const previousTimeSlots = timeSlots
                .filter(slot => slot.dayOfWeek === selectedDayOfWeek)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              const previousSlot = previousTimeSlots[previousTimeSlotIndex - 1];

              return (
                cls.timeSlotId === previousSlot.id &&
                cls.timeSlot.dayOfWeek === selectedDayOfWeek &&
                cls.isDouble &&
                (!userGrade || cls.grades?.includes(userGrade))
              );
            }

            return false;
          })}
          selectedClasses={selectedClasses}
          onClassSelect={onClassSelect}
          onClassUnselect={onClassUnselect}
          canSelectClasses={canSelectClasses}
          isAdmin={isAdmin}
          onCreateClass={onCreateClass}
        />
      )}
    </div>
  );
};

export default ScheduleTable;
