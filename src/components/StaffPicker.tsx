import React from "react";
import { staffKeyToParam } from "../services/staffScheduleService";
import type { StaffMember } from "../services/staffScheduleService";
import { TextSearch } from "./TextSearch";
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
  <TextSearch<StaffMember>
    mode="pick"
    items={members}
    getText={member => member.label}
    getKey={member => staffKeyToParam(member.key)}
    // No regular lessons: listed last (service order), grayed in the
    // dropdown only -- the selected name itself stays plain.
    renderOption={member =>
      member.teaches ? (
        member.label
      ) : (
        <span className="staff-option--no-lessons">{member.label}</span>
      )
    }
    value={value}
    onSelect={member =>
      onChange(member ? staffKeyToParam(member.key) : undefined)
    }
    placeholder={placeholder}
    style={style}
    loading={loading}
    disabled={disabled}
  />
);
