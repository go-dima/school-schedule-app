import React, { useState } from "react";
import { Table, Card, Tag, Button, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DAYS_OF_WEEK } from "../types";
import { ScheduleService } from "../services/scheduleService";
import { getTimeSlotDisplayInfo, isLessonTimeSlot } from "../utils/timeSlots";
import type { TimeSlot, ClassWithTimeSlot, WeeklySchedule } from "../types";
import ClassSelectionDrawer from "./ClassSelectionDrawer";
import "./ScheduleTable.css";
import { GetGradeName } from "@/utils/grades";

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

    // Check if this slot has double lessons from the previous slot (continuation slot)
    const dayTimeSlots = timeSlots
      .filter(slot => isLessonTimeSlot(slot))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const currentTimeSlotIndex = dayTimeSlots.findIndex(
      slot => slot.id === timeSlot.id
    );

    let doubleContinuationClasses: ClassWithTimeSlot[] = [];

    if (currentTimeSlotIndex > 0) {
      const previousSlot = dayTimeSlots[currentTimeSlotIndex - 1];

      // Get double lessons from the original classes array instead of weeklySchedule
      doubleContinuationClasses = classes.filter(cls => {
        // Find double lessons from the previous slot that extend into this slot
        const isDoubleFromPrevious =
          cls.isDouble &&
          cls.timeSlotId === previousSlot.id &&
          cls.dayOfWeek === dayOfWeek;
        // Filter by user grade if needed
        const matchesGrade = !userGrade || cls.grades?.includes(userGrade);
        return isDoubleFromPrevious && matchesGrade;
      });
    }

    if (doubleContinuationClasses.length > 0) {
      // This is the second slot of a double lesson
      const doubleClass = doubleContinuationClasses[0]; // Assuming only one double class per slot
      const isSelected = selectedClasses.includes(doubleClass.id);

      if (isSelected) {
        // Show full class details in second slot when selected
        return (
          <div
            className={`schedule-cell selected-classes double-continuation selected ${
              isSelectableSlot ? "clickable" : ""
            }`}
            onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
            <Card size="small" className="class-card selected-card double-card">
              <div className="class-title">{doubleClass.title}</div>
              <div className="class-teacher">{doubleClass.teacher}</div>
              {doubleClass.room && (
                <div className="class-room">כיתה: {doubleClass.room}</div>
              )}
              <div className="class-tags">
                {doubleClass.grades?.map(grade => (
                  <Tag key={grade} color="green">
                    {GetGradeName(grade)}
                  </Tag>
                ))}
                {doubleClass.isMandatory && <Tag color="red">ליבה</Tag>}
                <Tag color="orange">שיעור כפול</Tag>
              </div>
              <div
                className="continuation-text"
                style={{
                  marginTop: 4,
                  fontSize: "10px",
                  fontStyle: "italic",
                  color: "#fa8c16",
                  textAlign: "center",
                }}>
                (המשך)
              </div>
            </Card>
          </div>
        );
      }
      // If double lesson exists but is not selected, fall through to show regular classes
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

    // Check for selected classes to display individually
    const selectedFilteredClasses = filteredClasses.filter(cls =>
      selectedClasses.includes(cls.id)
    );

    // If there are selected classes, show them individually
    if (selectedFilteredClasses.length > 0) {
      return (
        <div
          className={`schedule-cell selected-classes ${
            isSelectableSlot ? "clickable" : ""
          }`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
          {selectedFilteredClasses.map(cls => {
            const isDoubleLesson = cls.isDouble;
            const displayState = "selected";
            const tagColor = "green";

            return (
              <Card
                key={cls.id}
                size="small"
                className={`class-card ${displayState}-card ${isDoubleLesson ? "double-card" : ""}`}
                style={{
                  marginBottom: selectedFilteredClasses.length > 1 ? 4 : 0,
                }}>
                <div className="class-title">{cls.title}</div>
                <div className="class-teacher">{cls.teacher}</div>
                {cls.room && <div className="class-room">כיתה: {cls.room}</div>}
                <div className="class-tags">
                  {cls.grades?.map(grade => (
                    <Tag key={grade} color={tagColor}>
                      {GetGradeName(grade)}
                    </Tag>
                  ))}
                  {cls.isMandatory && <Tag color="red">ליבה</Tag>}
                  {isDoubleLesson && <Tag color="orange">שיעור כפול</Tag>}
                </div>
              </Card>
            );
          })}
        </div>
      );
    }

    // Combine regular classes with unselected double lesson continuations for display
    const unselectedDoubleContinuations = doubleContinuationClasses.filter(
      cls => !selectedClasses.includes(cls.id)
    );
    const allUnselectedClasses = [
      ...filteredClasses,
      ...unselectedDoubleContinuations,
    ];

    // Remove duplicates (in case a class appears in both lists)
    const uniqueUnselectedClasses = allUnselectedClasses.filter(
      (cls, index, self) => self.findIndex(c => c.id === cls.id) === index
    );

    // For unselected classes, show as multiple classes interface for consistency
    if (uniqueUnselectedClasses.length >= 1) {
      const classCountText =
        uniqueUnselectedClasses.length === 1
          ? "שיעור אחד"
          : `${uniqueUnselectedClasses.length} שיעורים`;

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
    // Get unique time periods (start-end-name combinations) since time slots are now day-independent
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
          // Use the representative slot for all days (since slots are now day-independent)
          row[`day_${day.key}`] = renderClassCell(representativeSlot, day.key);
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
          timeSlots={timeSlots}
          classes={(() => {
            // Filter classes from the original classes array to get proper ClassWithTimeSlot objects
            return classes.filter(cls => {
              // Filter by grade first
              if (userGrade && !cls.grades?.includes(userGrade)) {
                return false;
              }

              // Filter by day
              if (cls.dayOfWeek !== selectedDayOfWeek) {
                return false;
              }

              const dayTimeSlots = timeSlots
                .filter(slot => isLessonTimeSlot(slot))
                .sort((a, b) => a.startTime.localeCompare(b.startTime));

              const currentTimeSlotIndex = dayTimeSlots.findIndex(
                slot => slot.id === selectedTimeSlot.id
              );

              // 1. Show classes that directly start in this time slot
              if (cls.timeSlotId === selectedTimeSlot.id) {
                return true;
              }

              // 2. Show double lessons from the previous slot that extend into this slot
              if (currentTimeSlotIndex > 0) {
                const previousSlot = dayTimeSlots[currentTimeSlotIndex - 1];
                if (cls.timeSlotId === previousSlot.id && cls.isDouble) {
                  return true;
                }
              }

              return false;
            });
          })()}
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
