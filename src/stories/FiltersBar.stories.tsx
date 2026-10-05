import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Button, Input, Select, Space } from "antd";
import { PlusOutlined, PrinterOutlined } from "@ant-design/icons";
import { FiltersBar } from "../components/FiltersBar";
// Reproduces the app-wide `.ant-space { direction: ltr }` rule (#249). The
// router imports this page eagerly, so every page in the app carries it. The
// bar's own two groups are pinned ltr in FiltersBar.css and don't need it,
// but the nested label pairs do: loading it here makes them render as in
// the app.
import "../pages/ClassManagementPage.css";

const meta: Meta<typeof FiltersBar> = {
  title: "Components/FiltersBar",
  component: FiltersBar,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

// A label pair as the pages build it: control, then label. The pair's own
// Space follows the global ltr rule, so the label renders to the RIGHT of
// its control.
const labelled = (label: string, control: ReactNode) => (
  <Space size={4} align="center">
    {control}
    <label>{label}</label>
  </Space>
);

// DOM order is the reverse of the on-screen right-to-left order: the bar's
// groups are ltr, so the first child is leftmost.
const boxedFilters = (
  <>
    <Button>נקה מסננים</Button>
    {labelled(
      "כיתה:",
      <Select placeholder="בחר כיתה" style={{ width: 80 }} options={[]} />
    )}
    {labelled(
      "חיפוש:",
      <Input placeholder="חפש שיעור לפי שם" style={{ width: 200 }} />
    )}
  </>
);

const boxedActions = (
  <Button type="primary" icon={<PlusOutlined />}>
    הוסף
  </Button>
);

/**
 * Admin table pages (Students, Class Management, User Management).
 * Expected, right to left (same order as on main):
 *   [חיפוש: label][search] · [כיתה: label][grade] · נקה מסננים
 *   ‖ רענן · הוסף (leftmost).
 */
export const Boxed: Story = {
  args: {
    children: boxedFilters,
    actions: boxedActions,
    canRefresh: true,
  },
};

/**
 * Same as Boxed, locked while a refetch is in flight: every control is
 * disabled, the bar is dimmed and refresh shows its spinner. Order as Boxed.
 */
export const BoxedDisabled: Story = {
  args: {
    children: boxedFilters,
    actions: boxedActions,
    canRefresh: true,
    disabled: true,
    refreshing: true,
  },
};

/**
 * Schedule page, under the tab bar. Expected, right to left (same order as
 * on main): [כיתה: label][grade] · search ‖ רענן · print (leftmost).
 */
export const Flat: Story = {
  args: {
    variant: "flat",
    children: (
      <>
        <Input placeholder="חיפוש שיעור" style={{ width: 200 }} />
        {labelled(
          "כיתה:",
          <Select placeholder="כל הכיתות" style={{ width: 80 }} options={[]} />
        )}
      </>
    ),
    actions: <Button icon={<PrinterOutlined />}>הדפסה</Button>,
    canRefresh: true,
  },
};
