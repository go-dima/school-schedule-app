import { Tag, Space } from "antd";
import { useTranslation } from "react-i18next";

interface GroupTrackTagsProps {
  groupNumber: number | null;
  trackNumber: number | null;
}

// Shared badge pair for Group (קבוצה) and Track (מסלול) -- same domain, same
// matching mechanism, independently set. Used everywhere either attribute is
// listed: Class Management, Child Management, and the Students page.
export function GroupTrackTags({
  groupNumber,
  trackNumber,
}: GroupTrackTagsProps) {
  const { t } = useTranslation();

  if (!groupNumber && !trackNumber) {
    return null;
  }

  return (
    <Space size="small">
      {groupNumber && (
        <Tag color="purple">
          {t("classManagement.table.groupTag", { group: groupNumber })}
        </Tag>
      )}
      {trackNumber && (
        <Tag color="cyan">
          {t("classManagement.table.trackTag", { track: trackNumber })}
        </Tag>
      )}
    </Space>
  );
}
