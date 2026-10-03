import type { Meta, StoryObj } from "@storybook/react";
import PrintableSchedule from "../components/PrintableSchedule";
import {
  mockTimeSlots,
  mockWeeklySchedule,
  selectedClassIds,
} from "./fixtures/scheduleFixtures";
import { GetGradeName } from "../utils/grades";

// Renders the same markup/CSS used inside the print popup window, so the
// print layout and colors can be inspected and tweaked here directly instead
// of opening a real print dialog.
const childTitle = `מערכת של נועה כהן - ${GetGradeName(4)}`;

const meta: Meta<typeof PrintableSchedule> = {
  title: "Components/PrintableSchedule",
  component: PrintableSchedule,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: childTitle,
    grade: 4,
    timeSlots: mockTimeSlots,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: selectedClassIds,
  },
};

export const NoSelections: Story = {
  args: {
    title: childTitle,
    grade: 4,
    timeSlots: mockTimeSlots,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: [],
  },
};

// Staff View print: no grade filter, every class in the feed is shown.
export const StaffView: Story = {
  args: {
    title: "מערכת של דנה",
    timeSlots: mockTimeSlots,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: selectedClassIds,
  },
};
