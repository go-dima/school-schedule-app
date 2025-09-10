import { NavigateButton, NavigationButtonProps } from "./NavigateButton";

export const UserManagementButton = (props: NavigationButtonProps) => {
  const { onNavigate, ...buttonProps } = props;
  return (
    <NavigateButton
      {...buttonProps}
      pageKey="user-management"
      onNavigate={onNavigate}
    />
  );
};
