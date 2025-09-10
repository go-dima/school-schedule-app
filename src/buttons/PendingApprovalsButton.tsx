import { NavigateButton, NavigationButtonProps } from "./NavigateButton";

export const PendingApprovalsButton = (props: NavigationButtonProps) => {
  const { onNavigate, ...buttonProps } = props;
  return (
    <NavigateButton
      {...buttonProps}
      pageKey="pending-approvals"
      onNavigate={onNavigate}
    />
  );
};
