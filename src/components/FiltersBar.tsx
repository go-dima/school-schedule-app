import React from "react";
import { Button, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import "./FiltersBar.css";

interface FiltersBarProps {
  /**
   * Filter controls, on the right side of the row (it wraps). The group is
   * pinned ltr, so the first child is leftmost and the last is rightmost.
   */
  children: React.ReactNode;
  /**
   * Non-filter actions (add, scope, print, ...), on the left side. Also
   * ltr: the first action is leftmost of the group.
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
   * makes it the rightmost control of the actions group.
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
// Both groups are ltr (first child leftmost), which keeps the bars'
// long-standing on-screen order. Right to left: children last-to-first |
// refresh, then actions last-to-first.
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
