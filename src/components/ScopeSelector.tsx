import React from "react";
import { Form, Select, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { Scope } from "../types";

const { Text } = Typography;
const { Option } = Select;

interface ScopeSelectorProps {
  value?: Scope;
  onChange?: (scope: Scope) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export function ScopeSelector({
  value = "prod",
  onChange,
  placeholder,
  disabled = false,
}: ScopeSelectorProps) {
  const { t } = useTranslation();

  // Only show in development environment
  const isDevelopment = process.env.NODE_ENV === "development";

  if (!isDevelopment) {
    return null;
  }

  return (
    <Form.Item label={t("scope.selector.label")} name="scope">
      <Select
        value={value}
        onChange={onChange}
        placeholder={placeholder || t("scope.selector.placeholder")}
        disabled={disabled}
        style={{ width: "100%" }}>
        <Option value="prod">
          <Text>{t("scope.prod")}</Text>
        </Option>
        <Option value="test">
          <Text>{t("scope.test")}</Text>
        </Option>
      </Select>
    </Form.Item>
  );
}
