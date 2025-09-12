import React from "react";
import { GetGradeName, GetGradeNameShort } from "@/utils/grades";
import { Tag } from "antd";

export const GradesRangeTag: React.FC<{ grades: number[]; color: string }> = ({
  grades,
  color,
}) => {
  if (!grades || grades.length === 0) return null;

  const minGrade = Math.min(...grades);
  const maxGrade = Math.max(...grades);

  return (
    <Tag className="class-tags" color={color}>
      {grades.length === 1
        ? GetGradeName(minGrade)
        : `כיתה ${GetGradeNameShort(minGrade)} - ${GetGradeNameShort(maxGrade)}`}
    </Tag>
  );
};
