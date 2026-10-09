import type { ReactNode } from "react";
import { Space, Typography } from "antd";
import { useTranslation } from "react-i18next";
import type { Child } from "../types";
import { GetGradeName } from "@/utils/grades";
import { ScheduleTabsBar } from "./ScheduleTabsBar";
import "./ChildTabs.css";

const { Text } = Typography;

interface ChildTabsProps {
  childList: Child[];
  selectedChildId: string | null | undefined;
  onSelect: (child: Child) => void;
  /** Omit to hide the add-child tab. */
  onAddClick?: () => void;
  disabled?: boolean;
  // Page actions shown at the end of the tab bar.
  extra?: ReactNode;
}

function ChildTabLabel({ child }: { child: Child }) {
  return (
    <Space>
      <span className="child-tab-name">
        {child.firstName} {child.lastName}
      </span>
      <Text type="secondary" className="child-tab-grade">
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
      addTab={
        onAddClick
          ? { label: t("schedule.page.addChildButton"), onClick: onAddClick }
          : undefined
      }
      extra={extra}
    />
  );
}
