import React from "react";
import { Card } from "antd";
import type { ScheduleOverrideWithTimeSlot } from "../types";
import ClassCardHeader from "./ClassCardHeader";

interface OverrideCardProps {
  override: ScheduleOverrideWithTimeSlot;
  onClick?: (override: ScheduleOverrideWithTimeSlot) => void;
}

// Renders a staff override identically to a committed/selected class card
// (same class names as ClassCard's "selected" state) -- but sourced from
// the separate `overrides` prop, never merged into weeklySchedule/classes.
// Clicking it opens the edit modal instead of the cell's normal drawer.
const OverrideCard: React.FC<OverrideCardProps> = ({ override, onClick }) => (
  <Card
    size="small"
    className="class-card selected-card"
    onClick={e => {
      e.stopPropagation();
      onClick?.(override);
    }}>
    <ClassCardHeader
      title={override.title}
      isContinuation={false}
      teacher={override.teacher}
      room={override.room}
    />
  </Card>
);

export default OverrideCard;
