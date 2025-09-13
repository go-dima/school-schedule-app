import { Tag } from "antd";
import { useTranslation } from "react-i18next";

export const DoubleLessonTag = () => {
  const { t } = useTranslation();

  return <Tag color="orange">{t("schedule.table.doubleLessonTag")}</Tag>;
};
