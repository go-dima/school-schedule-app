import { Alert } from "antd";
import { useTranslation } from "react-i18next";

export const DraftBanner = () => {
  const { t } = useTranslation();

  return (
    <Alert
      message={t("schedule.draftBanner")}
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
};
