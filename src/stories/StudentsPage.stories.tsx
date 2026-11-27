import type { Meta, StoryObj } from "@storybook/react";
import StudentsPage from "../pages/students/StudentsPage";
import { AuthContext } from "../contexts/AuthContextObject";
import { AllChildrenProvider } from "../contexts/AllChildrenContext";
import { childrenApi } from "../services/api";
import { mockAdminAuth } from "./fixtures/mockAuth";
import { mockAllStudents } from "./fixtures/childFixtures";
import { StubbedApis } from "./fixtures/stubApis";
import { never } from "./fixtures/never";

// StudentsPage reads students from AllChildrenProvider, which fetches them
// with childrenApi.getAllChildren. StubbedApis swaps that call for fixtures
// while the story is mounted, so the story makes no Supabase request.
const meta: Meta<typeof StudentsPage> = {
  title: "Pages/StudentsPage",
  component: StudentsPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story, { parameters }) => (
      <AuthContext.Provider value={mockAdminAuth}>
        <StubbedApis
          patches={[
            [
              childrenApi,
              "getAllChildren",
              parameters.fetchStudents ?? (async () => mockAllStudents),
            ],
          ]}>
          <AllChildrenProvider>
            <Story />
          </AllChildrenProvider>
        </StubbedApis>
      </AuthContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoStudents: Story = {
  parameters: { fetchStudents: async () => [] },
};

export const Loading: Story = {
  parameters: { fetchStudents: never },
};
