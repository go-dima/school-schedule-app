import React from "react";
import { Select, Space, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";

interface FilterSelectOption<T extends string | number> {
  value: T;
  label: string;
}

interface FilterSelectProps<T extends string | number> {
  label: string;
  placeholder?: string;
  value: T | null;
  onChange: (value: T | null) => void;
  options: FilterSelectOption<T>[];
  style?: React.CSSProperties;
}

// Shared narrow Select + trailing label (+ clear button) used by all Class
// Management filters (day, grade, track) so they share one consistent look,
// matching the Schedule page's "element, then label" convention.
export function FilterSelect<T extends string | number>({
  label,
  placeholder,
  value,
  onChange,
  options,
  style,
}: FilterSelectProps<T>) {
  return (
    <Space size={4} align="center">
      {value !== null && (
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={() => onChange(null)}
          style={{ padding: 0 }}
        />
      )}
      <Select
        placeholder={placeholder}
        allowClear
        style={{ width: 80, ...style }}
        value={value ?? undefined}
        onChange={v => onChange(v ?? null)}>
        {options.map(option => (
          <Select.Option key={option.value} value={option.value}>
            {option.label}
          </Select.Option>
        ))}
      </Select>
      <label>{label}</label>
    </Space>
  );
}
