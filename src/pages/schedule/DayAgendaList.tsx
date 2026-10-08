import React from "react";
import { useTranslation } from "react-i18next";
import { Card } from "antd";
import { MobileLessonCard } from "./MobileLessonCard";
import {
  getTimeSlotDisplayInfo,
  isBreakTimeSlot,
  isMeetingTimeSlot,
} from "../../utils/timeSlots";
import type { AgendaEntry } from "./dayAgenda";
// Same cell and card styles as the desktop grid.
import "../../components/ScheduleTable.css";
import "./DayAgendaList.css";

// One school day as a vertical list: the time on the right (RTL), and
// beside it the same cell the desktop grid shows for that day and slot.
// Read only. Like the desktop grid, cards carry no lock marks.
export const DayAgendaList: React.FC<{ entries: AgendaEntry[] }> = ({
  entries,
}) => {
  const { t } = useTranslation();

  const cell = (entry: AgendaEntry) => {
    switch (entry.kind) {
      case "overrides":
        return (
          <div className="schedule-cell selected-classes">
            {entry.overrides.map(o => (
              <MobileLessonCard
                key={o.id}
                title={o.title}
                teacher={o.teacher}
                isOverride
              />
            ))}
          </div>
        );
      // A brief: no mandatory or double-lesson tint on the cell (the grid
      // has it); only a conflict is marked.
      case "selected":
        return (
          <div
            className={`schedule-cell selected-classes${
              entry.hasConflict ? " conflict" : ""
            }`}
            title={
              entry.hasConflict
                ? t("schedule.table.conflictTooltip")
                : undefined
            }>
            {entry.classes.map(cls => (
              <MobileLessonCard
                key={cls.id}
                title={cls.title}
                teacher={cls.teacher}
                isContinuation={entry.continuationIds.includes(cls.id)}
                isDouble={cls.isDouble}
                isMandatory={cls.isMandatory}
              />
            ))}
          </div>
        );
      case "nonLesson": {
        const info = getTimeSlotDisplayInfo(entry.timeSlot);
        return (
          <div
            className={`schedule-cell ${info.cssClass}`}
            title={info.description}>
            <Card size="small" className="non-lesson-card">
              <div className="non-lesson-content">
                <div className="slot-name">{entry.timeSlot.name}</div>
                {!isBreakTimeSlot(entry.timeSlot) &&
                  !isMeetingTimeSlot(entry.timeSlot) && (
                    <div className="slot-description">{info.description}</div>
                  )}
              </div>
            </Card>
          </div>
        );
      }
      case "unselected":
        return (
          <div className="schedule-cell multiple">
            <Card size="small" className="class-card">
              <div className="multiple-classes">
                <div className="class-count">
                  {entry.optionCount === 1
                    ? t("schedule.table.oneClass")
                    : t("schedule.table.multipleClasses", {
                        count: entry.optionCount,
                      })}
                </div>
              </div>
            </Card>
          </div>
        );
      case "empty":
        return (
          <div className="schedule-cell empty">
            {t("schedule.table.noClasses")}
          </div>
        );
    }
  };

  return (
    <ol className="day-agenda">
      {entries.map(entry => {
        const compact = entry.kind === "nonLesson";
        return (
          <li
            key={entry.timeSlot.id}
            className={`day-agenda-row${compact ? " is-compact" : ""}`}>
            <div className="day-agenda-time">
              {entry.timeSlot.startTime.slice(0, 5)}
            </div>
            <div className="day-agenda-cell">{cell(entry)}</div>
          </li>
        );
      })}
    </ol>
  );
};
