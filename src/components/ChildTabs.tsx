import { Space, Tabs, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";

const { Text } = Typography;

interface ChildTabsProps {
  childList: Child[];
  selectedChildId: string | null | undefined;
  onSelect: (child: Child) => void;
  onAddClick: () => void;
  disabled?: boolean;
}

function ChildTabLabel({ child }: { child: Child }) {
  return (
    <Space style={{ direction: "rtl" }}>
      <span>
        {child.firstName} {child.lastName}
      </span>
      <Text type="secondary" style={{ fontSize: 12 }}>
        ({GetGradeName(child.grade)}
        {child.groupNumber ? child.groupNumber : ""})
      </Text>
    </Space>
  );
}

/**
 * One tab per child plus a trailing "add child" tab-button. Purely
 * presentational: the parent owns selection and the add-child modal.
 */
export function ChildTabs({
  childList,
  selectedChildId,
  onSelect,
  onAddClick,
  disabled = false,
}: ChildTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs
      className="child-tabs"
      type="editable-card"
      size="small"
      // "" (not undefined) keeps rc-tabs controlled with no tab active;
      // undefined would fall back to highlighting the first tab.
      activeKey={selectedChildId ?? ""}
      onChange={key => {
        const child = childList.find(c => c.id === key);
        if (child) onSelect(child);
      }}
      onEdit={(_, action) => {
        if (action === "add") onAddClick();
      }}
      addIcon={
        <Space size={4}>
          <PlusOutlined />
          {t("schedule.page.addChildButton")}
        </Space>
      }
      locale={{ addAriaLabel: t("schedule.page.addChildButton") }}
      items={childList.map(c => ({
        key: c.id,
        label: <ChildTabLabel child={c} />,
        closable: false,
        disabled,
      }))}
    />
  );
}
