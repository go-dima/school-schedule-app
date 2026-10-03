import type { ReactNode } from "react";
import { Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";
import { ScheduleTabsBar } from "./ScheduleTabsBar";

const { Text } = Typography;

interface ChildTabsProps {
  childList: Child[];
  selectedChildId: string | null | undefined;
  onSelect: (child: Child) => void;
  onAddClick: () => void;
  disabled?: boolean;
  // Page actions shown at the end of the tab bar.
  extra?: ReactNode;
}

function ChildTabLabel({ child }: { child: Child }) {
  return (
    <Space style={{ direction: "rtl" }}>
      <span className="child-tab-name">
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
 * One tab per child plus a trailing "add child" tab that acts as a button.
 * Purely presentational: the parent owns selection and the add-child modal.
 */
export function ChildTabs({
  childList,
  selectedChildId,
  onSelect,
  onAddClick,
  disabled = false,
  extra,
}: ChildTabsProps) {
  const { t } = useTranslation();

  return (
    <ScheduleTabsBar
      activeKey={selectedChildId}
      onChange={key => {
        const child = childList.find(c => c.id === key);
        if (child) onSelect(child);
      }}
      items={childList.map(c => ({
        key: c.id,
        label: <ChildTabLabel child={c} />,
        disabled,
      }))}
      addTab={{ label: t("schedule.page.addChildButton"), onClick: onAddClick }}
      extra={extra}
    />
  );
}
