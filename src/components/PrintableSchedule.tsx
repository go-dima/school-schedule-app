import React from "react";
import { Table } from "antd";
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
import type { TimeSlot, WeeklySchedule, Child } from "../types";
import { GetGradeName } from "../utils/grades";
import "./PrintableSchedule.css";

interface PrintableScheduleProps {
  child: Child;
  timeSlots: TimeSlot[];
  weeklySchedule: WeeklySchedule;
  selectedClasses: string[];
}

interface ScheduleRow {
  key: string;
  timeSlot: TimeSlot;
  [key: string]: any;
}

const PrintableSchedule: React.FC<PrintableScheduleProps> = ({
  child,
  timeSlots,
  weeklySchedule,
  selectedClasses,
}) => {
  const { t } = useTranslation();
  const renderClassCell = (timeSlot: TimeSlot, dayOfWeek: number) => {
    const dayClasses = weeklySchedule[dayOfWeek]?.[timeSlot.id] || [];

    // Filter by child's grade
    let filteredClasses = dayClasses.filter(cls =>
      cls.grades?.includes(child.grade)
    );

    const displayInfo = getTimeSlotDisplayInfo(timeSlot);

    // A "continuation" cell is specifically a Double Lesson's second slot —
    // any other non-primary slot of a multi-slot class still gets a full card.
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

      return (
        <div className="print-schedule-cell selected double-continuation">
          <div className="print-class-card">
            <div className="print-class-title">{doubleClass.title}</div>
            <div className="print-class-teacher">{doubleClass.teacher}</div>
            {doubleClass.room && (
              <div className="print-class-room">
                {t("schedule.table.room", { room: doubleClass.room })}
              </div>
            )}
            <div className="print-continuation-text">
              {t("schedule.table.continuationText")}
            </div>
          </div>
        </div>
      );
    }

    // Handle non-lesson time slots (breaks, meetings)
    if (!isLessonTimeSlot(timeSlot)) {
      return (
        <div className={`print-schedule-cell ${displayInfo.cssClass}`}>
          <div className="print-non-lesson-content">
            <div className="print-slot-name">{timeSlot.name}</div>
          </div>
        </div>
      );
    }

    if (primaryClasses.length === 0) {
      return (
        <div className="print-schedule-cell empty">
          <div className="print-empty-text">
            {t("schedule.table.noClasses")}
          </div>
        </div>
      );
    }

    // Check for selected classes to display
    const selectedPrimaryClasses = primaryClasses.filter(cls =>
      selectedClasses.includes(cls.id)
    );

    // If there are selected classes, show them
    if (selectedPrimaryClasses.length > 0) {
      return (
        <div className="print-schedule-cell selected">
          {selectedPrimaryClasses.map(cls => (
            <div key={cls.id} className="print-class-card">
              <div className="print-class-title">{cls.title}</div>
              <div className="print-class-teacher">{cls.teacher}</div>
              {cls.room && (
                <div className="print-class-room">
                  {t("schedule.table.room", { room: cls.room })}
                </div>
              )}
              {cls.isDouble && (
                <div className="print-double-indicator">
                  {t("schedule.table.doubleLessonTag")}
                </div>
              )}
              {cls.isMandatory && (
                <div className="print-mandatory-indicator">
                  {t("schedule.table.mandatoryTag")}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // No selected classes for this slot
    return (
      <div className="print-schedule-cell empty">
        <div className="print-empty-text">{t("schedule.table.noClasses")}</div>
      </div>
    );
  };

  const createScheduleData = (): ScheduleRow[] => {
    // Get unique time periods
    const uniqueTimePeriods = timeSlots.reduce((acc, slot) => {
      const key = `${slot.startTime}-${slot.endTime}-${slot.name}`;
      if (!acc.includes(key)) {
        acc.push(key);
      }
      return acc;
    }, [] as string[]);

    return uniqueTimePeriods
      .map(timePeriod => {
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
          row[`day_${day.key}`] = renderClassCell(representativeSlot, day.key);
        });

        return row;
      })
      .filter(row => row !== null)
      .sort((a, b) => a.timeSlot.startTime.localeCompare(b.timeSlot.startTime));
  };

  const columns: ColumnsType<ScheduleRow> = [
    {
      title: t("schedule.table.timeColumn"),
      dataIndex: "timeSlot",
      key: "time",
      width: 100,
      className: "print-time-column",
      render: (timeSlot: TimeSlot) => {
        const timeRange = ScheduleService.formatTimeRange(
          timeSlot.startTime,
          timeSlot.endTime
        );
        const isBreakOrMeeting =
          isBreakTimeSlot(timeSlot) || isMeetingTimeSlot(timeSlot);

        return (
          <div
            className={`print-time-cell ${isBreakOrMeeting ? "compact" : ""}`}>
            {timeRange && <div className="print-time-range">{timeRange}</div>}
            {!isBreakOrMeeting && (
              <div className="print-time-name">{timeSlot.name}</div>
            )}
          </div>
        );
      },
    },
    ...DAYS_OF_WEEK.map(day => ({
      title: day.name,
      dataIndex: `day_${day.key}`,
      key: `day_${day.key}`,
      width: 140,
      className: "print-day-column",
      render: (content: React.ReactNode) => content,
    })),
  ];

  const scheduleData = createScheduleData();

  return (
    <div className="printable-schedule">
      <div className="print-header">
        <h1 className="print-title">
          מערכת של {child.firstName} {child.lastName} -{" "}
          {GetGradeName(child.grade)}
        </h1>
      </div>

      <div className="print-schedule-container">
        <Table<ScheduleRow>
          columns={columns}
          dataSource={scheduleData}
          pagination={false}
          className="print-schedule-table"
          size="small"
          bordered
          rowClassName={record => record.className || ""}
        />
      </div>
    </div>
  );
};

export default PrintableSchedule;
