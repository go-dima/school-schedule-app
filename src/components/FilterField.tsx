import React from "react";
import { Space } from "antd";

interface FilterFieldProps {
  label: string;
  children: React.ReactNode;
}

// Shared "control, then trailing label" pairing used across FiltersBar
// consumers (Schedule, User Management) so individual filters share one
// consistent look instead of each re-wrapping <Space size="small"> by hand.
export const FilterField: React.FC<FilterFieldProps> = ({
  label,
  children,
}) => (
  <Space size="small">
    {children}
    <span>{label}:</span>
  </Space>
);
