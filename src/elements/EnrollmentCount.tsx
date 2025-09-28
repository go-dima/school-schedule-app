import React from "react";
import { UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

interface EnrollmentCountProps {
  count: number;
  className?: string;
}

export const EnrollmentCount: React.FC<EnrollmentCountProps> = ({
  count,
  className = "",
}) => {
  const { t } = useTranslation();

  return (
    <span
      className={`enrollment-count ${className}`}
      title={t("schedule.enrollment.students", { count })}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        color: "#666",
      }}>
      <UserOutlined style={{ fontSize: "12px" }} />
      <span>{count}</span>
    </span>
  );
};

export default EnrollmentCount;
