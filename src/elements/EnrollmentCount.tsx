import React from "react";
import { UserOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

interface EnrollmentCountProps {
  count: number;
  className?: string;
  onClick?: () => void;
}

export const EnrollmentCount: React.FC<EnrollmentCountProps> = ({
  count,
  className = "",
  onClick,
}) => {
  const { t } = useTranslation();

  return (
    <span
      className={`enrollment-count ${className}`}
      title={t("schedule.enrollment.students", { count })}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        color: "#666",
        ...(onClick ? { cursor: "pointer" } : {}),
      }}>
      <UserOutlined style={{ fontSize: "12px" }} />
      <span>{count}</span>
    </span>
  );
};

export default EnrollmentCount;
