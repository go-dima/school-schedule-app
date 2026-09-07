import React, { useState, useEffect } from "react";
import { Table, Card, Tag, Button, Empty } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useTranslation } from "react-i18next";
import { DAYS_OF_WEEK } from "../types";
import { ScheduleService } from "../services/scheduleService";
import {
  getTimeSlotDisplayInfo,
  isLessonTimeSlot,
  isBreakTimeSlot,
  isMeetingTimeSlot,
} from "../utils/timeSlots";
import type {
  TimeSlot,
  ClassWithTimeSlot,
  ScheduleSelectionWithClass,
  WeeklySchedule,
} from "../types";
import ClassSelectionDrawer from "./ClassSelectionDrawer";
import "./ScheduleTable.css";
import { GradesRangeTag } from "@/elements/GradesRangeTag";
import { DoubleLessonTag } from "@/elements/DoubleLessonTag";
import { EnrollmentCount } from "@/elements/EnrollmentCount";
import { EnrollmentService } from "../services/enrollmentService";

interface ScheduleTableProps {
  timeSlots: TimeSlot[];
  classes: ClassWithTimeSlot[];
  weeklySchedule: WeeklySchedule;
  userGrade?: number;
  selectedClasses?: string[];
  userSelections?: ScheduleSelectionWithClass[];
  onClassSelect?: (classId: string) => void;
  onClassUnselect?: (classId: string) => void;
  canSelectClasses?: boolean;
  canViewClasses?: boolean;
  isAdmin?: boolean;
  onCreateClass?: (timeSlotId: string, dayOfWeek: number) => void;
  searchTerm?: string;
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
  userSelections = [],
  onClassSelect,
  onClassUnselect,
  canSelectClasses = false,
  canViewClasses = false,
  isAdmin = false,
  onCreateClass,
  searchTerm = "",
}) => {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(
    null
  );
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(
    null
  );
  const [enrollmentCounts, setEnrollmentCounts] = useState<Map<string, number>>(
    new Map()
  );

  // Fetch enrollment counts when component mounts or classes change
  useEffect(() => {
    const fetchEnrollmentCounts = async () => {
      try {
        const counts = await EnrollmentService.getClassEnrollmentCounts();
        setEnrollmentCounts(counts);
      } catch (error) {
        console.error("Failed to fetch enrollment counts:", error);
      }
    };

    if (classes.length > 0) {
      fetchEnrollmentCounts();
    }
  }, [classes]);

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

  // Helper function to check if a time slot should be highlighted based on search term
  const shouldHighlightTimeSlot = (
    timeSlot: TimeSlot,
    dayOfWeek: number
  ): boolean => {
    if (!searchTerm.trim()) return false;

    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

    let filteredClasses = userGrade
      ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
      : dayClasses;

    return filteredClasses.some(cls =>
      cls.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const renderClassCell = (timeSlot: TimeSlot, dayOfWeek: number) => {
    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

    let filteredClasses = userGrade
      ? dayClasses.filter(cls => cls.grades?.includes(userGrade))
      : dayClasses;

    const displayInfo = getTimeSlotDisplayInfo(timeSlot);
    const isSelectableSlot = displayInfo.isSelectable && canViewClasses;
    const isHighlighted = shouldHighlightTimeSlot(timeSlot, dayOfWeek);
    const highlightClass = isHighlighted ? "search-highlighted" : "";

    // A "continuation" cell is specifically a Double Lesson's second slot —
    // any other non-primary slot of a multi-slot class (e.g. a class meeting
    // on two separate days) still gets a full card, since it isn't a
    // continuation of anything.
    const continuationClasses = filteredClasses.filter(cls =>
      ScheduleService.isDoubleLessonSecondSlot(
        cls,
        dayOfWeek,
        timeSlot.id,
        timeSlots
      )
    );
    const primaryClasses = filteredClasses.filter(
      cls => !continuationClasses.includes(cls)
    );

    // Handle double lesson continuations - but only for SELECTED classes
    const selectedContinuationClasses = continuationClasses.filter(cls =>
      selectedClasses.includes(cls.id)
    );

    if (selectedContinuationClasses.length) {
      // This is the second slot of a SELECTED double lesson
      const doubleClass = selectedContinuationClasses[0];
      const isMandatory = doubleClass.isMandatory;

      // Show full class details in second slot when selected
      return (
        <div
          className={`schedule-cell selected-classes double-continuation selected ${
            isMandatory ? "mandatory-cell" : ""
          } ${isSelectableSlot ? "clickable" : ""} ${highlightClass}`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
          <Card
            size="small"
            className={`class-card selected-card double-card ${isMandatory ? "mandatory-card" : ""}`}>
            <div className="class-title">{doubleClass.title}</div>
            <div className="class-teacher">{doubleClass.teacher}</div>
            {doubleClass.room && (
              <div className="class-room">
                {t("schedule.table.room", { room: doubleClass.room })}
              </div>
            )}
            <div
              className="continuation-text"
              style={{
                marginBottom: 4,
                fontSize: "10px",
                fontStyle: "italic",
                color: "#fa8c16",
                textAlign: "center",
              }}>
              {t("schedule.table.continuationText")}
            </div>
            <div className="class-labels-row">
              <div className="class-enrollment-labels">
                <div className="class-tags">
                  <GradesRangeTag grades={doubleClass.grades} color="green" />
                  {doubleClass.isMandatory && (
                    <Tag color="red">{t("schedule.table.mandatoryTag")}</Tag>
                  )}
                  <DoubleLessonTag />
                </div>
              </div>
              <div className="class-enrollment-icon">
                <EnrollmentCount
                  count={enrollmentCounts.get(doubleClass.id) || 0}
                />
              </div>
            </div>
          </Card>
        </div>
      );
    }

    // Handle non-lesson time slots (breaks, meetings)
    if (!isLessonTimeSlot(timeSlot)) {
      return (
        <div
          className={`schedule-cell ${displayInfo.cssClass} ${highlightClass}`}
          title={displayInfo.description}>
          <Card size="small" className="non-lesson-card">
            <div className="non-lesson-content">
              <div className="slot-name">{timeSlot.name}</div>
              {!isBreakTimeSlot(timeSlot) && !isMeetingTimeSlot(timeSlot) && (
                <div className="slot-description">
                  {displayInfo.description}
                </div>
              )}
            </div>
          </Card>
        </div>
      );
    }

    if (primaryClasses.length === 0) {
      return (
        <div
          className={`schedule-cell empty ${
            isSelectableSlot ? "clickable" : ""
          } ${highlightClass}`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t("schedule.table.noClasses")}
            style={{ margin: "8px 0" }}
          />
        </div>
      );
    }

    // Check for selected classes to display individually
    const selectedPrimaryClasses = primaryClasses.filter(cls =>
      selectedClasses.includes(cls.id)
    );

    // If there are selected classes, show them individually
    if (selectedPrimaryClasses.length > 0) {
      const hasMandatoryClass = selectedPrimaryClasses.some(
        cls => cls.isMandatory
      );

      return (
        <div
          className={`schedule-cell selected-classes ${
            hasMandatoryClass ? "mandatory-cell" : ""
          } ${isSelectableSlot ? "clickable" : ""} ${highlightClass}`}
          onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
          {selectedPrimaryClasses.map(cls => {
            const isDoubleLesson = cls.isDouble;
            const isMandatory = cls.isMandatory;
            const displayState = "selected";
            const tagColor = "green";

            return (
              <Card
                key={cls.id}
                size="small"
                className={`class-card ${displayState}-card ${isDoubleLesson ? "double-card" : ""} ${isMandatory ? "mandatory-card" : ""}`}
                style={{
                  marginBottom: selectedPrimaryClasses.length > 1 ? 4 : 0,
                }}>
                <div className="class-title">{cls.title}</div>
                <div className="class-teacher">{cls.teacher}</div>
                {cls.room && (
                  <div className="class-room">
                    {t("schedule.table.room", { room: cls.room })}
                  </div>
                )}
                <div className="class-labels-row">
                  <div className="class-enrollment-labels">
                    <div className="class-tags">
                      <GradesRangeTag grades={cls.grades} color={tagColor} />
                      {cls.isMandatory && (
                        <Tag color="red">
                          {t("schedule.table.mandatoryTag")}
                        </Tag>
                      )}
                      {isDoubleLesson && <DoubleLessonTag />}
                    </div>
                  </div>
                  <div className="class-enrollment-icon">
                    <EnrollmentCount
                      count={enrollmentCounts.get(cls.id) || 0}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      );
    }

    // Show unselected classes (both primary and continuation classes)
    const unselectedPrimaryClasses = primaryClasses.filter(
      cls => !selectedClasses.includes(cls.id)
    );
    const unselectedContinuationClasses = continuationClasses.filter(
      cls => !selectedClasses.includes(cls.id)
    );

    // Combine unselected primary and continuation classes for selection
    const allUnselectedClasses = [
      ...unselectedPrimaryClasses,
      ...unselectedContinuationClasses,
    ];

    // Remove duplicates (in case a class appears in both lists)
    const uniqueUnselectedClasses = allUnselectedClasses.filter(
      (cls, index, self) => self.findIndex(c => c.id === cls.id) === index
    );

    // For unselected classes, show as multiple classes interface for consistency
    if (uniqueUnselectedClasses.length >= 1) {
      const classCountText =
        uniqueUnselectedClasses.length === 1
          ? t("schedule.table.oneClass")
          : t("schedule.table.multipleClasses", {
              count: uniqueUnselectedClasses.length,
            });

      return (
        <div
          className={`schedule-cell multiple ${
            isSelectableSlot ? "clickable" : ""
          } ${highlightClass}`}
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
                {canSelectClasses
                  ? t("schedule.table.clickToSelect")
                  : t("schedule.table.clickToView")}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    // Empty slot
    return (
      <div
        className={`schedule-cell empty ${isSelectableSlot ? "clickable" : ""} ${highlightClass}`}
        onClick={() => handleCellClick(timeSlot, dayOfWeek)}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t("schedule.table.noClasses")}
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

        const isBreakOrMeeting =
          isBreakTimeSlot(representativeSlot) ||
          isMeetingTimeSlot(representativeSlot);

        const row: ScheduleRow = {
          key: timePeriod,
          timeSlot: representativeSlot,
          className: isBreakOrMeeting ? "compact-row" : undefined,
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
      title: t("schedule.table.timeColumn"),
      dataIndex: "timeSlot",
      key: "time",
      width: 120,
      className: "time-column",
      render: (timeSlot: TimeSlot) => {
        const timeRange = ScheduleService.formatTimeRange(
          timeSlot.startTime,
          timeSlot.endTime
        );
        const isBreakOrMeeting =
          isBreakTimeSlot(timeSlot) || isMeetingTimeSlot(timeSlot);

        return (
          <div
            className={`time-cell ${isBreakOrMeeting ? "compact-time-cell" : ""}`}>
            {timeRange && <div className="time-range">{timeRange}</div>}
            {!isBreakOrMeeting && (
              <div className="time-name">{timeSlot.name}</div>
            )}
          </div>
        );
      },
    },
    ...DAYS_OF_WEEK.map(day => ({
      title: day.name,
      dataIndex: `day_${day.key}`,
      key: `day_${day.key}`,
      width: 160, // Fixed width for consistent day columns
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
        rowClassName={record => record.className || ""}
      />

      {selectedTimeSlot && selectedDayOfWeek !== null && (
        <ClassSelectionDrawer
          open={drawerOpen}
          onClose={handleCloseDrawer}
          timeSlot={selectedTimeSlot}
          dayOfWeek={selectedDayOfWeek}
          timeSlots={timeSlots}
          classes={classes.filter(cls => {
            if (userGrade && !cls.grades?.includes(userGrade)) {
              return false;
            }

            return cls.slots.some(
              slot =>
                slot.dayOfWeek === selectedDayOfWeek &&
                slot.timeSlotId === selectedTimeSlot.id
            );
          })}
          selectedClasses={selectedClasses}
          conflictingClasses={classes.filter(
            cls =>
              !selectedClasses.includes(cls.id) &&
              ScheduleService.hasTimeConflict(userSelections, cls)
          )}
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
