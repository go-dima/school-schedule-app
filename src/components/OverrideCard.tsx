import React from "react";
import { Card } from "antd";
import type { ScheduleOverrideWithTimeSlot } from "../types";
import ClassCardHeader from "./ClassCardHeader";

interface OverrideCardProps {
  override: ScheduleOverrideWithTimeSlot;
}

// Renders a staff override identically to a committed/selected class card
// (same class names as ClassCard's "selected" state) -- but sourced from
// the separate `overrides` prop, never merged into weeklySchedule/classes.
// Purely presentational, like ClassCard: no click handler of its own, so a
// click on it bubbles up to the enclosing cell's onClick and opens the
// normal drawer, where the override is shown first with edit/delete.
const OverrideCard: React.FC<OverrideCardProps> = ({ override }) => (
  <Card size="small" className="class-card selected-card override-card">
    <ClassCardHeader
      title={override.title}
      isContinuation={false}
      teacher={override.teacher}
      room={override.room}
    />
  </Card>
);

export default OverrideCard;
