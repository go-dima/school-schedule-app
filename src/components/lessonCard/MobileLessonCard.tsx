import React from "react";
import { Card } from "antd";
import { useTranslation } from "react-i18next";
import { lessonCardClassName, type LessonCardModel } from "./lessonCardModel";
import "./LessonCard.css";
import "./MobileLessonCard.css";

// The mobile day view's lesson card: the title (and continuation mark) on
// one line, styled like the desktop card's title, in plain colours (no
// mandatory/double/override tint): the mobile view is a brief of the
// schedule. Separate from ClassCard because it changes on its own, like
// print; the model and the base card classes are shared.
export const MobileLessonCard: React.FC<{ lesson: LessonCardModel }> = ({
  lesson,
}) => {
  const { t } = useTranslation();
  return (
    <Card
      size="small"
      className={lessonCardClassName(lesson, {
        plain: true,
        extra: "mobile-lesson-card",
      })}>
      <div className="class-title mobile-lesson-title">
        {lesson.title}
        {lesson.isContinuation && (
          <span className="continuation-suffix">
            {t("schedule.table.continuationText")}
          </span>
        )}
      </div>
    </Card>
  );
};
