import { Alert } from "antd";
import { useTranslation } from "react-i18next";

export const CommittedReadOnlyBanner = () => {
  const { t } = useTranslation();

  return (
    <Alert
      message={t("schedule.committedReadOnlyBanner")}
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};
