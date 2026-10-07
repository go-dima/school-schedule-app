import React from "react";
import { useTranslation } from "react-i18next";
import { Tooltip, Typography } from "antd";
import { LockOutlined, WarningOutlined } from "@ant-design/icons";
import ClassCard from "../../components/ClassCard";
import OverrideCard from "../../components/OverrideCard";
import type { AgendaEntry } from "./dayAgenda";
import "./DayAgendaList.css";

const { Text } = Typography;

// One school day as a vertical list: the time on the right (RTL), the
// slot's content beside it. Read only.
export const DayAgendaList: React.FC<{
  entries: AgendaEntry[];
  lockedClassIds: Set<string>;
}> = ({ entries, lockedClassIds }) => {
  const { t } = useTranslation();

  const content = (entry: AgendaEntry) => {
    switch (entry.kind) {
      case "overrides":
        return entry.overrides.map(o => (
          <OverrideCard key={o.id} override={o} />
        ));
      case "selected":
        return entry.classes.map(cls => (
          <div key={cls.id} className="day-agenda-class">
            <ClassCard
              cls={cls}
              isContinuation={entry.continuationIds.includes(cls.id)}
            />
            {lockedClassIds.has(cls.id) && (
              <Tooltip title={t("schedule.drawer.lockedClassTooltip")}>
                <LockOutlined className="day-agenda-lock" />
              </Tooltip>
            )}
          </div>
        ));
      case "nonLesson":
        return <Text type="secondary">{entry.timeSlot.name}</Text>;
      // A lesson slot with nothing selected: its name and what's on offer.
      case "unselected":
        return (
          <Text type="secondary">
            {entry.timeSlot.name} ·{" "}
            {entry.optionCount === 1
              ? t("schedule.table.oneClass")
              : t("schedule.table.multipleClasses", {
                  count: entry.optionCount,
                })}
          </Text>
        );
      case "empty":
        return (
          <Text type="secondary">
            {entry.timeSlot.name} · {t("schedule.table.noClasses")}
          </Text>
        );
    }
  };

  return (
    <ol className="day-agenda">
      {entries.map(entry => {
        const compact =
          entry.kind === "nonLesson" ||
          entry.kind === "unselected" ||
          entry.kind === "empty";
        const conflict = entry.kind === "selected" && entry.hasConflict;
        return (
          <li
            key={entry.timeSlot.id}
            className={`day-agenda-row${compact ? " is-compact" : ""}${
              conflict ? " is-conflict" : ""
            }`}>
            <div className="day-agenda-time">
              <span>{entry.timeSlot.startTime.slice(0, 5)}</span>
              {!compact && (
                <span className="day-agenda-time-end">
                  {entry.timeSlot.endTime.slice(0, 5)}
                </span>
              )}
            </div>
            <div className="day-agenda-content">
              {!compact && (
                <Text type="secondary" className="day-agenda-slot-name">
                  {entry.timeSlot.name}
                  {conflict && (
                    <Tooltip title={t("schedule.table.conflictTooltip")}>
                      <WarningOutlined className="day-agenda-conflict-icon" />
                    </Tooltip>
                  )}
                </Text>
              )}
              {content(entry)}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
