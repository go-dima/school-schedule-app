import React from "react";
import { Button, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import "./FiltersBar.css";

interface FiltersBarProps {
  /** Filter controls, rendered on the wrap-capable start side of the row. */
  children: React.ReactNode;
  /** Non-filter actions (export, role switch, ...), rendered on the end side. */
  actions?: React.ReactNode;
  /** Boxed (card) look, or flat/unboxed row. Defaults to "boxed". */
  variant?: "boxed" | "flat";
  /** When true, renders a built-in refresh button as the last action. */
  canRefresh?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Defaults to the shared "רענן" translation. */
  refreshLabel?: string;
  /**
   * Locks the whole bar (filters and actions alike) against interaction --
   * for a data refetch in flight, where every control reads stale state
   * until it resolves. Individual controls can still carry their own
   * `disabled` for narrower, state-driven cases; this is the blanket one.
   */
  disabled?: boolean;
}

// Shared filters-section/filters-row wrapper (see FiltersBar.css) so every
// page that needs a filters row (Schedule, User Management, ...) gets the
// same layout -- filters on one side, actions like refresh on the other --
// without duplicating the wrapper markup per page.
export const FiltersBar: React.FC<FiltersBarProps> = ({
  children,
  actions,
  variant = "boxed",
  canRefresh = false,
  onRefresh,
  refreshing,
  refreshLabel,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <fieldset
      className={`filters-section filters-section--${variant}${
        disabled ? " filters-section--disabled" : ""
      }`}
      disabled={disabled}
      aria-disabled={disabled}>
      <div className="filters-row">
        <Space wrap>{children}</Space>
        {(actions || canRefresh) && (
          <Space>
            {actions}
            {canRefresh && (
              <Button
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                disabled={disabled}
                loading={refreshing}>
                {refreshLabel ?? t("common.buttons.refresh")}
              </Button>
            )}
          </Space>
        )}
      </div>
    </fieldset>
  );
};
