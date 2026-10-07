import type { Meta, StoryObj } from "@storybook/react";
import { MobileScheduleView } from "../pages/schedule/MobileScheduleView";
import { buildDayAgenda } from "../pages/schedule/dayAgenda";
import { scheduleCapabilities } from "../pages/schedule/scheduleCapabilities";
import type { Child } from "../types";
import { MobileShell } from "./fixtures/mobileShell";
import {
  mockOverrides,
  mockTimeSlots,
  mockUserSelections,
  mockWeeklySchedule,
  selectedClassIds,
} from "./fixtures/scheduleFixtures";

const child = (id: string, firstName: string, grade: number): Child => ({
  id,
  firstName,
  lastName: "כהן",
  grade,
  groupNumber: null,
  trackNumber: null,
  scope: "test",
  createdBy: null,
  createdByName: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const children = [child("c1", "נועה", 2), child("c2", "איתי", 4)];

// The real page layout (MobileScheduleView) inside the real mobile shell,
// fed from fixtures instead of useChildScheduleController.
const meta: Meta<typeof MobileScheduleView> = {
  title: "Pages/Schedule/MobileSchedulePage",
  component: MobileScheduleView,
  args: {
    caps: scheduleCapabilities("mobile"),
    // 2026-10-06 is a Tuesday.
    now: new Date(2026, 9, 6, 9, 0),
    userChildren: children,
    selectedChild: children[0],
    childrenLoading: false,
    canManageChildren: true,
    canPickSchedule: true,
    viewCommitted: true,
    viewStatus: "committed",
    pageLoading: false,
    scheduleGridLoading: false,
    loading: false,
    error: null,
    entriesForDay: day =>
      buildDayAgenda({
        day,
        timeSlots: mockTimeSlots,
        weeklySchedule: mockWeeklySchedule,
        selectedClassIds,
        userSelections: mockUserSelections,
        overrides: mockOverrides,
      }),
    setViewCommitted: () => {},
    handleRefresh: () => {},
    handleParentChildAdded: () => {},
    handleParentChildSelect: () => {},
  },
  render: args => <MobileShell page={<MobileScheduleView {...args} />} />,
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
};

export default meta;
type Story = StoryObj<typeof MobileScheduleView>;

/** A parent with two children: tabs, then the week strip with no gap. */
export const ParentWithTwoChildren: Story = {};

/** A child user (or a parent of one child) sees no child tabs. */
export const SingleChild: Story = {
  args: { userChildren: [children[0]], canManageChildren: false },
};

/** No child chosen: the alert sits between the tabs and nothing else. */
export const NoChildSelected: Story = { args: { selectedChild: null } };

export const Loading: Story = { args: { pageLoading: true } };
