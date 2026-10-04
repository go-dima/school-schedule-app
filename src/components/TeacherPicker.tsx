import React from "react";
import type { StaffMember } from "../services/staffScheduleService";
import { TextSearch } from "./TextSearch";

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
  <TextSearch<StaffMember>
    mode="filter"
    items={members}
    getText={member => member.label}
    value={value ?? ""}
    onChange={text => onChange?.(text)}
    loading={loading}
    placeholder={placeholder}
    autoFocus={autoFocus}
    onBlur={onBlur}
    style={{ width: "100%" }}
  />
);
