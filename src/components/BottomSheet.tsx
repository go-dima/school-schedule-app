import React from "react";
import { Drawer } from "antd";
import type { DrawerProps } from "antd";
import "./BottomSheet.css";

export type BottomSheetProps = Omit<DrawerProps, "placement" | "height">;

/**
 * A bottom sheet for mobile UI Mode: an antd Drawer from the bottom, 85% of
 * the dynamic viewport high. Its body doesn't scroll the page behind it, and
 * its inputs stay at 16px so iOS doesn't zoom in. Every other Drawer prop
 * passes through; `className` is added to the sheet's own class.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  className,
  ...props
}) => (
  <Drawer
    {...props}
    className={className ? `bottom-sheet ${className}` : "bottom-sheet"}
    placement="bottom"
    height="85dvh"
  />
);
