import React from "react";
import { Card } from "antd";
import { useTranslation } from "react-i18next";
import { lessonCardClassName, type LessonCardModel } from "./lessonCardModel";
import "./LessonCard.css";
import "./MobileLessonCard.css";

// The mobile day view's lesson card: title (and continuation mark) then
// teacher, on one line. Separate from ClassCard because it changes on its
// own, like print; the model and the variant classes are shared, so it
// matches the desktop grid's colours and borders.
export const MobileLessonCard: React.FC<{ lesson: LessonCardModel }> = ({
  lesson,
}) => {
  const { t } = useTranslation();
  return (
    <Card
      size="small"
      className={lessonCardClassName(lesson, "mobile-lesson-card")}>
      <div className="mobile-lesson-line">
        <span className="mobile-lesson-title">
          {lesson.title}
          {lesson.isContinuation && (
            <span className="continuation-suffix">
              {t("schedule.table.continuationText")}
            </span>
          )}
        </span>
        {lesson.teacher && (
          <span className="mobile-lesson-teacher">{lesson.teacher}</span>
        )}
      </div>
    </Card>
  );
};
