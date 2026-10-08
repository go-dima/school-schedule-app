import React from "react";
import { Card } from "antd";
import type { ClassWithTimeSlot } from "../../types";
import ClassCardHeader from "./ClassCardHeader";
import { classLesson, lessonCardClassName } from "./lessonCardModel";
import { GradesRangeTag } from "@/elements/GradesRangeTag";
import { DoubleLessonTag } from "@/elements/DoubleLessonTag";
import { EnrollmentCount } from "@/elements/EnrollmentCount";
import "./LessonCard.css";

interface ClassCardProps {
  cls: ClassWithTimeSlot;
  isContinuation: boolean;
  showEnrollmentCount?: boolean;
  enrollmentCount?: number;
  style?: React.CSSProperties;
}

// The desktop grid's class card: title, teacher and room, and tags.
const ClassCard: React.FC<ClassCardProps> = ({
  cls,
  isContinuation,
  showEnrollmentCount = false,
  enrollmentCount = 0,
  style,
}) => {
  const lesson = classLesson(cls, { isContinuation });

  return (
    <Card
      key={cls.id}
      size="small"
      className={lessonCardClassName(lesson)}
      style={style}>
      {showEnrollmentCount && (
        <div className="class-enrollment-badge">
          <EnrollmentCount count={enrollmentCount} />
        </div>
      )}
      <ClassCardHeader
        title={lesson.title}
        isContinuation={lesson.isContinuation}
        teacher={lesson.teacher}
        room={lesson.room}
        reserveBadgeSpace={showEnrollmentCount}
        tags={
          <>
            <GradesRangeTag grades={cls.grades} color="green" />
            {lesson.isDouble && <DoubleLessonTag />}
          </>
        }
      />
    </Card>
  );
};

export default ClassCard;
