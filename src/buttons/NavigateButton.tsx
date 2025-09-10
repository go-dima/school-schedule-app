import React from "react";
import { AppOnNavigate, AppPages } from "@/types";
import { ButtonProps, Button } from "antd";
import { useTranslation } from "react-i18next";
import { UserAddOutlined } from "@ant-design/icons";

export interface NavigationButtonProps {
  onNavigate?: AppOnNavigate;
}

export type NavigateButtonProps = ButtonProps &
  NavigationButtonProps & {
    pageKey: AppPages;
  };

const keyToProps: Record<AppPages, { icon: React.ReactNode; tKey: string }> = {
  "class-management": { icon: <UserAddOutlined />, tKey: "classManagement" },
  "user-management": { icon: <UserAddOutlined />, tKey: "userManagement" },
  "pending-approvals": { icon: <UserAddOutlined />, tKey: "pendingRequests" },
  schedule: { icon: <UserAddOutlined />, tKey: "schedule" },
};

export const NavigateButton = (props: NavigateButtonProps) => {
  const { onNavigate, pageKey, ...buttonProps } = props;
  const { t } = useTranslation();

  const { icon, tKey } = keyToProps[pageKey];

  return (
    <Button {...buttonProps} icon={icon} onClick={() => onNavigate?.(pageKey)}>
      {t(`common.buttons.${tKey}`)}
    </Button>
  );
};
