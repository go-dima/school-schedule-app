import { Tag } from "antd";
import { useTranslation } from "react-i18next";

interface TrackTagProps {
  track: number;
}

export const TrackTag = ({ track }: TrackTagProps) => {
  const { t } = useTranslation();

  return <Tag color="cyan">{t("schedule.table.trackTag", { track })}</Tag>;
};
