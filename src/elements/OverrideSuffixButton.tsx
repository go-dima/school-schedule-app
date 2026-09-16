import React from "react";
import { Tooltip } from "antd";

interface OverrideSuffixButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
}

// A narrow, full-height strip revealed on hover -- staff's entry point into
// override creation for fixed slots (breaks/meetings, which never open the
// normal selection drawer) via a "+" icon, and into editing an existing
// override directly from the grid (any slot type) via an edit icon, so a
// break-slot override -- which has no other UI path once the slot's create
// button disappears -- stays reachable. Kept narrow rather than spanning
// the card's width: a centered single-line label leaves a margin before it
// starts, which is where this sits, so it never covers the label itself.
export const OverrideSuffixButton: React.FC<OverrideSuffixButtonProps> = ({
  icon,
  tooltip,
  onClick,
}) => {
  return (
    <Tooltip title={tooltip}>
      <div
        className="override-card-footer"
        onClick={e => {
          e.stopPropagation();
          onClick();
        }}>
        {icon}
      </div>
    </Tooltip>
  );
};
