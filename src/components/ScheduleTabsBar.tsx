import type { ReactNode } from "react";
import { Space, Tabs } from "antd";
import { PlusOutlined } from "@ant-design/icons";

// Key of the trailing add pseudo-tab. Never becomes active: selecting it
// calls `addTab.onClick` instead.
const ADD_TAB_KEY = "__add__";

export interface ScheduleTabItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
}

interface ScheduleTabsBarProps {
  items: ScheduleTabItem[];
  // "" or undefined = no tab active.
  activeKey: string | null | undefined;
  onChange: (key: string) => void;
  // Actions at the end of the tab bar (e.g. refresh + print).
  extra?: ReactNode;
  // Optional trailing tab that acts as a button (e.g. "add child").
  addTab?: { label: string; onClick: () => void };
}

/**
 * The schedule page's tab bar: line tabs above the filters bar, with page
 * actions at its end. Shared by the staff/student view tabs and the
 * per-child tabs so both read as one pattern.
 *
 * RTL: items render right-to-left in the order given (first = rightmost),
 * with the add tab last (leftmost). Check the on-screen order when changing.
 */
export function ScheduleTabsBar({
  items,
  activeKey,
  onChange,
  extra,
  addTab,
}: ScheduleTabsBarProps) {
  return (
    <Tabs
      className="schedule-tabs"
      // "" (not undefined) keeps rc-tabs controlled with no tab active;
      // undefined would fall back to highlighting the first tab.
      activeKey={activeKey ?? ""}
      onChange={key => {
        if (key === ADD_TAB_KEY) {
          addTab?.onClick();
          return;
        }
        onChange(key);
      }}
      items={[
        ...items,
        ...(addTab
          ? [
              {
                key: ADD_TAB_KEY,
                label: (
                  <Space size={4} className="schedule-tabs__add">
                    <PlusOutlined />
                    {addTab.label}
                  </Space>
                ),
              },
            ]
          : []),
      ]}
      tabBarExtraContent={extra}
    />
  );
}
