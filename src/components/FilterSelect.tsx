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

// Shared label + clear button + narrow Select used by all Class Management
// filters (day, grade, track, scope) so they share one consistent look.
export function FilterSelect<T extends string | number>({
  label,
  placeholder,
  value,
  onChange,
  options,
  style,
}: FilterSelectProps<T>) {
  return (
    <Space direction="vertical" size={4} style={{ width: 80, ...style }}>
      <Space
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
        }}>
        <label>{label}</label>
        {value !== null && (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => onChange(null)}
            style={{ padding: 0 }}
          />
        )}
      </Space>
      <Select
        placeholder={placeholder}
        allowClear
        style={{ width: "100%" }}
        value={value ?? undefined}
        onChange={v => onChange(v ?? null)}>
        {options.map(option => (
          <Select.Option key={option.value} value={option.value}>
            {option.label}
          </Select.Option>
        ))}
      </Select>
    </Space>
  );
}
