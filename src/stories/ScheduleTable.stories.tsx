import type { Meta, StoryObj } from "@storybook/react";
import ScheduleTable from "../components/ScheduleTable";
import {
  mockTimeSlots,
  mockClasses,
  mockWeeklySchedule,
  selectedClassIds,
  mockUserSelections,
  conflictingClassIds,
  conflictingUserSelections,
  mockOverrides,
} from "./fixtures/scheduleFixtures";

const meta: Meta<typeof ScheduleTable> = {
  title: "Components/ScheduleTable",
  component: ScheduleTable,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    canSelectClasses: false,
    canViewClasses: true,
  },
};

export const WithSelection: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: selectedClassIds,
    userSelections: mockUserSelections,
    canSelectClasses: true,
    canViewClasses: true,
    showEnrollmentCount: true,
    onClassSelect: (classId: string) => console.log("Select class:", classId),
    onClassUnselect: (classId: string) =>
      console.log("Unselect class:", classId),
  },
};

export const WithConflict: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    selectedClasses: conflictingClassIds,
    userSelections: conflictingUserSelections,
    canSelectClasses: true,
    canViewClasses: true,
    showEnrollmentCount: true,
    onClassSelect: (classId: string) => console.log("Select class:", classId),
    onClassUnselect: (classId: string) =>
      console.log("Unselect class:", classId),
  },
};

export const FilteredByGrade: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    userGrade: 3,
    canSelectClasses: true,
    canViewClasses: true,
  },
};

export const EmptySchedule: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: [],
    weeklySchedule: {},
    canSelectClasses: false,
  },
};

// How a staff member sees the grid once a child is selected: fixed slots
// (breaks/meetings, which never open the normal selection drawer) get a "+"
// override affordance that only appears on hover, anchored to the left edge
// of the cell footer. Two overrides are pre-placed -- one on an ordinary
// lesson slot (via the drawer's existing button) and one on a break (via
// this hover footer button) -- to show both entry points and how an
// override card renders once created.
export const StaffOverrides: Story = {
  args: {
    timeSlots: mockTimeSlots,
    classes: mockClasses,
    weeklySchedule: mockWeeklySchedule,
    canSelectClasses: true,
    canViewClasses: true,
    canCreateOverride: true,
    overrides: mockOverrides,
    onCreateOverride: (timeSlotId: string, dayOfWeek: number) =>
      console.log("Create override:", { timeSlotId, dayOfWeek }),
    onOverrideClick: override => console.log("Edit override:", override),
    onClassSelect: (classId: string) => console.log("Select class:", classId),
    onClassUnselect: (classId: string) =>
      console.log("Unselect class:", classId),
  },
};
