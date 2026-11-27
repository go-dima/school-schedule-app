import type { Meta, StoryObj } from "@storybook/react";
import SchedulePage from "../pages/schedule/SchedulePage";
import { AuthContext } from "../contexts/AuthContextObject";
import type { AuthContextType } from "../contexts/AuthContextObject";
import { UiModeContext } from "../contexts/UiModeContextObject";
import { ChildProvider } from "../contexts/ChildContext";
import { AllChildrenProvider } from "../contexts/AllChildrenContext";
import {
  childrenApi,
  classesApi,
  scheduleApi,
  scheduleOverridesApi,
  timeSlotsApi,
} from "../services/api";
import { mockParentAuth } from "./fixtures/mockAuth";
import { mockChildren } from "./fixtures/childFixtures";
import {
  mockClasses,
  mockOverrides,
  mockTimeSlots,
  mockUserSelections,
} from "./fixtures/scheduleFixtures";
import { StubbedApis } from "./fixtures/stubApis";
import { never } from "./fixtures/never";

// The desktop SchedulePage, signed in as a parent with two children. The page
// reads from ChildProvider, AllChildrenProvider and its own catalog provider;
// StubbedApis swaps the Supabase-backed calls they make (children, classes,
// time slots, selections, overrides) for fixtures while the story is mounted,
// so the story makes no Supabase request. Mobile is MobileSchedulePage's story.

// mockParentAuth has no user id, and the children hooks wait for one.
const parentWithId: AuthContextType = {
  ...mockParentAuth,
  user: { ...mockParentAuth.user, id: "parent-1" },
};

const meta: Meta<typeof SchedulePage> = {
  title: "Pages/Schedule/Desktop",
  component: SchedulePage,
  tags: ["visual-desktop"],
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, { parameters }) => (
      <AuthContext.Provider value={parentWithId}>
        <UiModeContext.Provider
          value={{
            mode: "desktop",
            detected: "desktop",
            override: null,
            setOverride: () => {},
          }}>
          <StubbedApis
            patches={[
              [
                childrenApi,
                "getParentChildren",
                parameters.fetchChildren ?? (async () => mockChildren),
              ],
              [childrenApi, "getAllChildren", async () => []],
              [
                classesApi,
                "getClasses",
                parameters.fetchClasses ?? (async () => mockClasses),
              ],
              [timeSlotsApi, "getTimeSlots", async () => mockTimeSlots],
              [
                scheduleApi,
                "getSelectedSchedule",
                async () => mockUserSelections,
              ],
              [scheduleOverridesApi, "getOverrides", async () => mockOverrides],
            ]}>
            <ChildProvider>
              <AllChildrenProvider>
                <Story />
              </AllChildrenProvider>
            </ChildProvider>
          </StubbedApis>
        </UiModeContext.Provider>
      </AuthContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoChildren: Story = {
  parameters: { fetchChildren: async () => [] },
};

export const Loading: Story = {
  parameters: { fetchClasses: never },
};
