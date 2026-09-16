import React from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

interface OverrideSuffixButtonProps {
  onClick: () => void;
}

// A narrow, full-height strip revealed on hover of the enclosing
// `.schedule-cell` (see .override-card-footer in ScheduleTable.css) --
// staff's entry point into override creation for fixed slots
// (breaks/meetings), which never open the normal selection drawer.
// Anchored to the whole cell rather than nested in the card's padding, and
// kept narrow rather than spanning the card's width: a centered
// single-line slot label leaves a margin before it starts, which is where
// this sits, so it never covers the label itself.
export const OverrideSuffixButton: React.FC<OverrideSuffixButtonProps> = ({
  onClick,
}) => {
  const { t } = useTranslation();

  return (
    <Tooltip title={t("schedule.override.buttonLabel")}>
      <div
        className="override-card-footer"
        onClick={e => {
          e.stopPropagation();
          onClick();
        }}>
        <PlusOutlined />
      </div>
    </Tooltip>
  );
};
