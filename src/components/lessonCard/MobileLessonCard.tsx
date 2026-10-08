import React from "react";
import { Card } from "antd";
import { lessonCardClassName, type LessonCardModel } from "./lessonCardModel";
import "./LessonCard.css";
import "./MobileLessonCard.css";

// The mobile day view's lesson card: the title alone on one line, styled
// like the desktop card's title, in plain colours and with no continuation
// mark: the mobile view is a brief of the schedule. Separate from ClassCard
// because it changes on its own, like print; the model and the base card
// classes are shared.
export const MobileLessonCard: React.FC<{ lesson: LessonCardModel }> = ({
  lesson,
}) => (
  <Card
    size="small"
    className={lessonCardClassName(lesson, {
      plain: true,
      extra: "mobile-lesson-card",
    })}>
    <div className="class-title mobile-lesson-title">{lesson.title}</div>
  </Card>
);
