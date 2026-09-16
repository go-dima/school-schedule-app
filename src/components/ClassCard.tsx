import React from "react";
import { Card } from "antd";
import type { ClassWithTimeSlot } from "../types";
import ClassCardHeader from "./ClassCardHeader";
import { GradesRangeTag } from "@/elements/GradesRangeTag";
import { DoubleLessonTag } from "@/elements/DoubleLessonTag";
import { EnrollmentCount } from "@/elements/EnrollmentCount";

interface ClassCardProps {
  cls: ClassWithTimeSlot;
  isContinuation: boolean;
  showEnrollmentCount?: boolean;
  enrollmentCount?: number;
  style?: React.CSSProperties;
}

const ClassCard: React.FC<ClassCardProps> = ({
  cls,
  isContinuation,
  showEnrollmentCount = false,
  enrollmentCount = 0,
  style,
}) => {
  const isMandatory = cls.isMandatory;

  return (
    <Card
      key={cls.id}
      size="small"
      className={`class-card selected-card ${
        cls.isDouble ? "double-card" : ""
      } ${isMandatory ? "mandatory-card" : ""}`}
      style={style}>
      {showEnrollmentCount && (
        <div className="class-enrollment-badge">
          <EnrollmentCount count={enrollmentCount} />
        </div>
      )}
      <ClassCardHeader
        title={cls.title}
        isContinuation={isContinuation}
        teacher={cls.teacher}
        room={cls.room}
        tags={
          <>
            <GradesRangeTag grades={cls.grades} color="green" />
            {cls.isDouble && <DoubleLessonTag />}
          </>
        }
      />
    </Card>
  );
};

export default ClassCard;
