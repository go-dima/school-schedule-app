import { NavigateButton, NavigationButtonProps } from "./NavigateButton";

export const ClassManagementButton = (props: NavigationButtonProps) => {
  const { onNavigate, ...buttonProps } = props;
  return (
    <NavigateButton
      {...buttonProps}
      pageKey="class-management"
      onNavigate={onNavigate}
    />
  );
};
