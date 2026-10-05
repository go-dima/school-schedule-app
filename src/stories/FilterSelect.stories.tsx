import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FilterSelect } from "../components/FilterSelect";
import { FiltersBar } from "../components/FiltersBar";
import { GRADES } from "../types";
import { GetGradeName } from "../utils/grades";
// Reproduces the app-wide `.ant-space { direction: ltr }` rule. The router
// imports this page eagerly, so every page in the app carries it; loading it
// here makes the stories render the same order as the app.
import "../pages/ClassManagementPage.css";

const gradeOptions = GRADES.map(grade => ({
  value: grade,
  label: GetGradeName(grade),
}));

// Holds the value in state so picking, the X and the Select's own clear
// icon all work in the story.
const Controlled = ({
  initial,
  disabled,
  placeholder = "כל הכיתות",
}: {
  initial: number | null;
  disabled?: boolean;
  placeholder?: string;
}) => {
  const [grade, setGrade] = useState<number | null>(initial);
  return (
    <FilterSelect<number>
      label="סנן לפי כיתה"
      placeholder={placeholder}
      value={grade}
      onChange={setGrade}
      options={gradeOptions}
      disabled={disabled}
    />
  );
};

const meta: Meta<typeof Controlled> = {
  title: "Components/FilterSelect",
  component: Controlled,
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * No value: placeholder, no X. Expected, right to left:
 *   [סנן לפי כיתה:] [כל הכיתות ▾].
 */
export const Empty: Story = {
  args: { initial: null },
};

/**
 * A grade is set, so the X shows. Expected, right to left:
 *   [סנן לפי כיתה:] [ד׳ ▾] [X] (X leftmost).
 */
export const Selected: Story = {
  args: { initial: 4 },
};

/** As Selected, but the Select and the X are both disabled. */
export const Disabled: Story = {
  args: { initial: 4, disabled: true },
};

/**
 * The Schedule page's grade filter as the last child of the flat bar. The
 * bar's groups are ltr (first child leftmost), so it's the rightmost filter,
 * as on main. The pair's own label/X order is unchanged. Expected, right to
 * left: [סנן לפי כיתה:] [ד׳ ▾] [X] ‖ רענן (leftmost).
 */
export const InFlatFiltersBar: Story = {
  args: { initial: 4 },
  render: args => (
    <FiltersBar variant="flat" canRefresh>
      <Controlled {...args} />
    </FiltersBar>
  ),
};
