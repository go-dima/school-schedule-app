import type { Meta, StoryObj } from "@storybook/react";
import { Route, Routes } from "react-router-dom";
import { Card } from "antd";
import AppLayout from "../layouts/AppLayout";
import { AuthContext } from "../contexts/AuthContextObject";
import { UiModeContext } from "../contexts/UiModeContextObject";
import { mockParentAuth } from "./fixtures/mockAuth";
import "../layouts/layouts.css";

// The desktop app shell (header, sidebar, content area) with mocked auth and
// UI mode contexts, not the real App provider tree. The role is a parent on
// purpose: it makes no Supabase call, so admin-only menu items are not
// covered. The sidebar stays collapsed (its state is internal to AppLayout).
const meta: Meta<typeof AppLayout> = {
  title: "Layouts/AppLayout",
  component: AppLayout,
  tags: ["visual-desktop"],
  parameters: { layout: "fullscreen" },
  decorators: [
    () => (
      <AuthContext.Provider value={mockParentAuth}>
        <UiModeContext.Provider
          value={{
            mode: "desktop",
            detected: "desktop",
            override: null,
            setOverride: () => {},
          }}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route
                path="*"
                element={<Card title="דף לדוגמה">תוכן העמוד</Card>}
              />
            </Route>
          </Routes>
        </UiModeContext.Provider>
      </AuthContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
