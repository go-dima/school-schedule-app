import React from "react";
import { InfoCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

interface AddedByTooltipProps {
  firstName: string | null;
  lastName: string | null;
  at: string;
}

export const AddedByTooltip: React.FC<AddedByTooltipProps> = ({
  firstName,
  lastName,
  at,
}) => {
  const { t } = useTranslation();

  const name =
    [firstName, lastName].filter(Boolean).join(" ") ||
    t("classManagement.enrollmentDrawer.addedByUnknown");

  const date = new Date(at).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Tooltip
      title={t("classManagement.enrollmentDrawer.addedByTooltip", {
        name,
        date,
      })}>
      <InfoCircleOutlined style={{ color: "#999" }} />
    </Tooltip>
  );
};

export default AddedByTooltip;
