import React from "react";
import { Select } from "antd";

const { Option } = Select;

interface GroupTrackSelectProps {
  value?: number | null;
  onChange?: (value: number | undefined) => void;
  optionLabel: (value: number) => string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: React.CSSProperties;
  // Antd's Form.Item clones its child and injects extra props (id, onBlur,
  // etc. for label association / validation) -- forward whatever it sends so
  // this behaves like a native Select there, not just as a standalone widget.
  [key: string]: unknown;
}

// Shared 1/2/none Select for Group (קבוצה) and Track (מסלול) -- same domain,
// same matching mechanism, independently set. Used both as a Form.Item child
// (ClassForm/ChildForm, which inject value/onChange) and standalone
// (ChildTrackSelector on the Schedule view).
export function GroupTrackSelect({
  value,
  onChange,
  optionLabel,
  placeholder,
  disabled = false,
  loading = false,
  style,
  ...rest
}: GroupTrackSelectProps) {
  return (
    <Select
      value={value ?? undefined}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      allowClear
      style={{ minWidth: 140, ...style }}
      {...rest}>
      {[1, 2].map(n => (
        <Option key={n} value={n}>
          {optionLabel(n)}
        </Option>
      ))}
    </Select>
  );
}
