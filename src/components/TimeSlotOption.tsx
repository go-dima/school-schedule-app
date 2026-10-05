import { Select } from "antd";
import { CoffeeOutlined, ReadOutlined, TeamOutlined } from "@ant-design/icons";
import { ScheduleService } from "../services/scheduleService";
import type { TimeSlot } from "../types";
import {
  isBreakTimeSlot,
  isMeetingTimeSlot,
  isNonLessonTimeSlot,
} from "../utils/timeSlots";
import "./TimeSlotOption.css";

const { Option } = Select;

const timeSlotIcon = (slot: TimeSlot) =>
  isBreakTimeSlot(slot) ? (
    <CoffeeOutlined />
  ) : isMeetingTimeSlot(slot) ? (
    <TeamOutlined />
  ) : (
    <ReadOutlined />
  );

// A time slot picker option: an icon per slot type, with breaks and meetings
// muted. The plain-text `label` is what search filters on and what the
// closed Select shows, so the Select needs optionFilterProp="label" and
// optionLabelProp="label".
export const renderTimeSlotOption = (slot: TimeSlot) => {
  const label = `${slot.name} - ${ScheduleService.formatTimeRange(
    slot.startTime,
    slot.endTime
  )}`;
  return (
    <Option key={slot.id} value={slot.id} label={label}>
      <span
        className={`time-slot-option ${
          isNonLessonTimeSlot(slot) ? "non-lesson" : ""
        }`}>
        {timeSlotIcon(slot)}
        {label}
      </span>
    </Option>
  );
};
