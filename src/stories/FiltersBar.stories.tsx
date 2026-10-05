import type { Meta, StoryObj } from "@storybook/react";
import { Button, Input } from "antd";
import { PlusOutlined, PrinterOutlined } from "@ant-design/icons";
import { FiltersBar } from "../components/FiltersBar";
import { FilterField } from "../components/FilterField";
import { FilterSelect } from "../components/FilterSelect";
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

// Label pairs as the pages build them: FilterField (control, then label) and
// FilterSelect (Select, then label). A pair's own Space follows the global
// ltr rule, so the label renders to the RIGHT of its control.
const gradeFilter = (label: string, placeholder: string) => (
  <FilterSelect<number>
    label={label}
    placeholder={placeholder}
    value={null}
    onChange={() => {}}
    options={[]}
  />
);

// DOM order is the reverse of the on-screen right-to-left order: the bar's
// groups are ltr, so the first child is leftmost.
const boxedFilters = (
  <>
    <Button>נקה מסננים</Button>
    {gradeFilter("כיתה", "בחר כיתה")}
    <FilterField label="חיפוש">
      <Input placeholder="חפש שיעור לפי שם" style={{ width: 200 }} />
    </FilterField>
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
 * on main; the grade filter is the last child, so it is rightmost):
 *   [סנן לפי כיתה: label][grade] · search ‖ רענן · print (leftmost).
 */
export const Flat: Story = {
  args: {
    variant: "flat",
    children: (
      <>
        <Input placeholder="חיפוש שיעור" style={{ width: 200 }} />
        {gradeFilter("סנן לפי כיתה", "כל הכיתות")}
      </>
    ),
    actions: <Button icon={<PrinterOutlined />}>הדפסה</Button>,
    canRefresh: true,
  },
};
