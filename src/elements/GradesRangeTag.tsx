import React from "react";
import { GetGradeName, GetGradeNameShort } from "@/utils/grades";
import { Tag } from "antd";
import { useTranslation } from "react-i18next";

export const GradesRangeTag: React.FC<{ grades: number[]; color: string }> = ({
  grades,
  color,
}) => {
  const { t } = useTranslation();
  if (!grades || grades.length === 0) return null;

  const minGrade = Math.min(...grades);
  const maxGrade = Math.max(...grades);

  return (
    <Tag color={color}>
      {grades.length === 1
        ? GetGradeName(minGrade)
        : t("grades.range", {
            from: GetGradeNameShort(minGrade),
            to: GetGradeNameShort(maxGrade),
          })}
    </Tag>
  );
};
