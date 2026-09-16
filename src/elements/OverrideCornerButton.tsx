import React from "react";
import { PlusOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useTranslation } from "react-i18next";

interface OverrideCornerButtonProps {
  onClick: () => void;
}

// A small corner badge revealed on hover of the enclosing `.schedule-cell`
// (see ScheduleTable.css) -- staff's entry point into override creation for
// fixed slots (breaks/meetings), which never open the normal selection
// drawer. Deliberately a corner badge rather than a full-height suffix: a
// centered single-line slot label leaves no dedicated gutter, so anything
// spanning the card's full height would sit on top of it.
export const OverrideCornerButton: React.FC<OverrideCornerButtonProps> = ({
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
