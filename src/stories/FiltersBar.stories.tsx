import type { Meta, StoryObj } from "@storybook/react";
import { Button, Input } from "antd";
import { PlusOutlined, PrinterOutlined } from "@ant-design/icons";
import { FiltersBar } from "../components/FiltersBar";
import { FilterField } from "../components/FilterField";
import { FilterSelect } from "../components/FilterSelect";
// Reproduces the app-wide `.ant-space { direction: ltr }` rule. The router
// imports this page eagerly, so every page in the app carries it; loading it
// here makes the stories render the same order as the app.
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
// FilterSelect (X, Select, then label). A pair's own Space follows the global
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

const boxedFilters = (
  <>
    <FilterField label="חיפוש">
      <Input placeholder="חפש שיעור לפי שם" style={{ width: 200 }} />
    </FilterField>
    {gradeFilter("כיתה", "בחר כיתה")}
    <Button>נקה מסננים</Button>
  </>
);

const boxedActions = (
  <Button type="primary" icon={<PlusOutlined />}>
    הוסף
  </Button>
);

/**
 * Admin table pages (Students, Class Management, User Management).
 * Expected, right to left:
 *   [חיפוש: label][search] · [כיתה: label][grade] · נקה מסננים
 *   ‖ הוסף · רענן (leftmost).
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
 * Schedule page, under the tab bar. Expected, right to left:
 *   search · [סנן לפי כיתה: label][grade] ‖ print · רענן (leftmost).
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
