import React from "react";
import { Card } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { ScheduleOverrideWithTimeSlot } from "../types";
import ClassCardHeader from "./ClassCardHeader";
import { OverrideSuffixButton } from "@/elements/OverrideSuffixButton";

interface OverrideCardProps {
  override: ScheduleOverrideWithTimeSlot;
  onEdit?: (override: ScheduleOverrideWithTimeSlot) => void;
}

// Renders a staff override identically to a committed/selected class card
// (same class names as ClassCard's "selected" state) -- but sourced from
// the separate `overrides` prop, never merged into weeklySchedule/classes.
// The card itself has no click handler (matching ClassCard, so a click on a
// lesson-slot override still bubbles up to the cell and opens the drawer).
// The edit suffix button is this card's own affordance instead -- its only
// UI path on a fixed slot (breaks/meetings never open that drawer), and a
// second, more discoverable path on a lesson slot alongside the drawer.
const OverrideCard: React.FC<OverrideCardProps> = ({ override, onEdit }) => {
  const { t } = useTranslation();

  return (
    <Card size="small" className="class-card selected-card override-card">
      <ClassCardHeader
        title={override.title}
        isContinuation={false}
        teacher={override.teacher}
        room={override.room}
      />
      {onEdit && (
        <OverrideSuffixButton
          icon={<EditOutlined />}
          tooltip={t("schedule.override.editButton")}
          onClick={() => onEdit(override)}
        />
      )}
    </Card>
  );
};

export default OverrideCard;
