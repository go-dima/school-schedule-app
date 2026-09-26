import React from "react";
import { AutoComplete } from "antd";
import type { StaffMember } from "../services/staffScheduleService";

interface TeacherPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  members: StaffMember[];
  loading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
}

/**
 * The `teacher` field of the class and override forms: suggests staff
 * members, but accepts any free text (teachers without an account). Picking
 * or typing a staff user's exact display name links them on save -- see
 * StaffScheduleService.resolveTeacherUserId.
 */
export const TeacherPicker: React.FC<TeacherPickerProps> = ({
  value,
  onChange,
  members,
  loading,
  placeholder,
  autoFocus,
  onBlur,
}) => (
  <AutoComplete
    value={value}
    onChange={onChange}
    onBlur={onBlur}
    autoFocus={autoFocus}
    style={{ width: "100%" }}
    placeholder={placeholder}
    allowClear
    notFoundContent={loading ? undefined : null}
    options={members.map(m => ({ value: m.label }))}
    filterOption={(input, option) =>
      (option?.value ?? "").toString().includes(input.trim())
    }
  />
);
