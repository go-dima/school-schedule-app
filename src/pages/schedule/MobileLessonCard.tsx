import React from "react";
import { Card } from "antd";
import { useTranslation } from "react-i18next";
import "./MobileLessonCard.css";

// One line per lesson for the mobile day view: title (and continuation
// mark) then teacher, nothing else. Separate from ClassCard/OverrideCard
// because it changes on its own (like print), but it keeps their card
// classes so colours and borders match the desktop grid.
export const MobileLessonCard: React.FC<{
  title: string;
  teacher?: string;
  isContinuation?: boolean;
  isDouble?: boolean;
  isMandatory?: boolean;
  isOverride?: boolean;
}> = ({
  title,
  teacher,
  isContinuation = false,
  isDouble = false,
  isMandatory = false,
  isOverride = false,
}) => {
  const { t } = useTranslation();
  return (
    <Card
      size="small"
      className={`class-card selected-card mobile-lesson-card${
        isDouble ? " double-card" : ""
      }${isMandatory ? " mandatory-card" : ""}${
        isOverride ? " override-card" : ""
      }`}>
      <div className="mobile-lesson-line">
        <span className="mobile-lesson-title">
          {title}
          {isContinuation && (
            <span className="continuation-suffix">
              {t("schedule.table.continuationText")}
            </span>
          )}
        </span>
        {teacher && <span className="mobile-lesson-teacher">{teacher}</span>}
      </div>
    </Card>
  );
};
