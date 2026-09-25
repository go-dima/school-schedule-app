import React from "react";
import { useTranslation } from "react-i18next";
import type { ClassWithTimeSlot, Child } from "../types";
import { GetGradeName } from "../utils/grades";
import "./PrintableClassRoster.css";

export interface PrintableClassRosterProps {
  classInfo: ClassWithTimeSlot;
  children: Child[];
}

const PrintableClassRoster: React.FC<PrintableClassRosterProps> = ({
  classInfo,
  children,
}) => {
  const { t } = useTranslation();

  return (
    <div className="printable-class-roster">
      <div className="print-header">
        <h1 className="print-title">
          {classInfo.title} ({classInfo.teacher})
        </h1>
      </div>

      <div className="print-roster-list">
        {children.map(child => (
          <div key={child.id} className="print-roster-row">
            <span className="print-roster-name">
              {child.firstName} {child.lastName}
            </span>
            <span className="print-roster-grade">
              {GetGradeName(child.grade)}
            </span>
          </div>
        ))}
      </div>

      <div className="print-count">
        {children.length} {t("classManagement.table.enrollmentColumn")}
      </div>
    </div>
  );
};

export default PrintableClassRoster;
