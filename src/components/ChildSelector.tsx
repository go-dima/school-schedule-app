import React from "react";
import { Select, Typography, Space } from "antd";
import { UserOutlined } from "@ant-design/icons";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";

const { Text } = Typography;

interface ChildSelectorProps {
  children: Child[];
  selectedChildId: string | null;
  onChildSelect: (childId: string | undefined) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function ChildSelector({
  children,
  selectedChildId,
  onChildSelect,
  placeholder = "בחר ילד",
  style,
  disabled = false,
}: ChildSelectorProps) {
  return (
    <div style={style}>
      <Select
        placeholder={placeholder}
        value={selectedChildId}
        onChange={onChildSelect}
        disabled={disabled || children.length === 0}
        suffixIcon={<UserOutlined />}
        style={{ width: "100%" }}
        allowClear
        showSearch
        filterOption={(input, option) => {
          return ((option?.label || "") as string)
            .toLowerCase()
            .includes(input.toLowerCase());
        }}>
        {children.map(child => (
          <Select.Option
            key={child.id}
            value={child.id}
            label={`${child.firstName} ${child.lastName}`}>
            <Space style={{ direction: "rtl" }}>
              <span>
                {child.firstName} {child.lastName}
              </span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({GetGradeName(child.grade)}
                {child.groupNumber ? child.groupNumber : ""})
              </Text>
            </Space>
          </Select.Option>
        ))}
      </Select>

      {children.length === 0 && (
        <Text
          type="secondary"
          style={{ fontSize: 12, marginTop: 4, display: "block" }}>
          אין ילדים רשומים. הוסף ילד בעמוד הפרופיל.
        </Text>
      )}
    </div>
  );
}
