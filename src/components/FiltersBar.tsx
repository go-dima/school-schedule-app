import React from "react";
import { Space } from "antd";

interface FiltersBarProps {
  /** Filter controls, rendered on the wrap-capable start side of the row. */
  children: React.ReactNode;
  /** Non-filter actions (refresh, export, role switch, ...), rendered on the end side. */
  actions?: React.ReactNode;
}

// Shared filters-section/filters-row wrapper (see layouts.css) so every page
// that needs a filters row (Schedule, User Management, ...) gets the same
// layout -- filters on one side, actions like refresh on the other -- without
// duplicating the wrapper markup per page.
export const FiltersBar: React.FC<FiltersBarProps> = ({
  children,
  actions,
}) => (
  <div className="filters-section">
    <div className="filters-row">
      <Space wrap>{children}</Space>
      {actions && <Space>{actions}</Space>}
    </div>
  </div>
);
