import React from "react";
import { Button, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import "./FiltersBar.css";

interface FiltersBarProps {
  /**
   * Filter controls, on the right side of the row (it wraps). In RTL the
   * first child is rightmost.
   */
  children: React.ReactNode;
  /**
   * Non-filter actions (add, scope, print, ...), on the left side. The first
   * action is rightmost of the group.
   */
  actions?: React.ReactNode;
  /**
   * "boxed" (default, gradient card) for the admin table pages: Students,
   * Class Management, User Management. "flat" for Schedule, which sits
   * under its tab bar.
   */
  variant?: "boxed" | "flat";
  /**
   * When true, renders a built-in refresh button after the actions, which
   * makes it the leftmost control of the bar.
   */
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

// The one filters/actions bar every list page uses (Schedule, Students,
// Class Management, User Management). Layout and spacing live in
// FiltersBar.css only; pages pass controls, never a style.
// RTL, right to left: children in order | actions in order, then refresh.
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
