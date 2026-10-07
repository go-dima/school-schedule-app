import type { Meta, StoryObj } from "@storybook/react";
import { ScheduleDayView } from "../pages/schedule/ScheduleDayView";
import { buildDayAgenda } from "../pages/schedule/dayAgenda";
import {
  conflictingClassIds,
  conflictingUserSelections,
  mockOverrides,
  mockTimeSlots,
  mockUserSelections,
  mockWeeklySchedule,
  selectedClassIds,
} from "./fixtures/scheduleFixtures";

const lockedClassIds = new Set(["class-1-1"]);

const entriesForDay =
  (opts: {
    selected?: string[];
    selections?: typeof mockUserSelections;
    withOverrides?: boolean;
  }) =>
  (day: number) =>
    buildDayAgenda({
      day,
      timeSlots: mockTimeSlots,
      weeklySchedule: mockWeeklySchedule,
      selectedClassIds: opts.selected ?? selectedClassIds,
      userSelections: opts.selections ?? mockUserSelections,
      overrides: opts.withOverrides ? mockOverrides : [],
    });

// 2026-10-06 is a Tuesday; 2026-10-09 a Friday.
const tuesday = new Date(2026, 9, 6, 9, 0);
const friday = new Date(2026, 9, 9, 9, 0);

const meta: Meta<typeof ScheduleDayView> = {
  title: "Pages/Schedule/ScheduleDayView",
  component: ScheduleDayView,
  args: {
    now: tuesday,
    entriesForDay: entriesForDay({}),
    lockedClassIds,
  },
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile2" },
  },
  decorators: [
    Story => (
      <div
        style={
          {
            padding: 12,
            background: "#f8fafc",
            minHeight: "100vh",
            // No app header above the strip in Storybook.
            "--schedule-strip-top": "0px",
          } as React.CSSProperties
        }>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ScheduleDayView>;

/** Opens on today (Tuesday): a Double Lesson pair and an override. */
export const OpensOnToday: Story = {
  args: { entriesForDay: entriesForDay({ withOverrides: true }) },
};

/** On Friday it opens on the coming Sunday. */
export const FridayOpensSunday: Story = { args: { now: friday } };

/** Thursday has two selected classes in the same slot. */
export const Conflict: Story = {
  args: {
    now: new Date(2026, 9, 8, 9, 0),
    entriesForDay: entriesForDay({
      selected: conflictingClassIds,
      selections: conflictingUserSelections,
    }),
  },
};

export const Loading: Story = { args: { loading: true } };
