import React from "react";
import { Select } from "antd";
import { staffKeyToParam } from "../services/staffScheduleService";
import type { StaffMember } from "../services/staffScheduleService";
import "./StaffPicker.css";

interface StaffPickerProps {
  members: StaffMember[];
  loading?: boolean;
  /** staffKeyToParam(member.key): a user id or a name. */
  value?: string;
  onChange: (param: string | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}

/** Schedule page Staff View: pick one staff member to show their week. */
export const StaffPicker: React.FC<StaffPickerProps> = ({
  members,
  loading,
  value,
  onChange,
  disabled,
  placeholder,
  style,
}) => (
  <Select
    showSearch
    allowClear
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    style={style}
    loading={loading}
    disabled={disabled}
    optionFilterProp="label"
    options={members.map(({ key, label, teaches }) => ({
      value: staffKeyToParam(key),
      label,
      // No regular lessons: listed last (service order), grayed.
      className: teaches ? undefined : "staff-option--no-lessons",
    }))}
  />
);
