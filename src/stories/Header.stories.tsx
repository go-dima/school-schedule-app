import type { Meta, StoryObj } from "@storybook/react";
import { Layout } from "antd";
import Header from "../layouts/Header";
import { AuthContext } from "../contexts/AuthContextObject";
import { UiModeContext } from "../contexts/UiModeContextObject";
import { mockParentAuth } from "./fixtures/mockAuth";
import "../layouts/layouts.css";

// The desktop app header, signed in as a parent: the profile trigger shows
// the role as a pill next to the name.
const meta: Meta<typeof Header> = {
  title: "Layouts/Header",
  component: Header,
  parameters: { layout: "fullscreen" },
  decorators: [
    Story => (
      <AuthContext.Provider value={mockParentAuth}>
        <UiModeContext.Provider
          value={{
            mode: "desktop",
            detected: "desktop",
            override: null,
            setOverride: () => {},
          }}>
          <Layout>
            <Story />
          </Layout>
        </UiModeContext.Provider>
      </AuthContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Header>;

export const Parent: Story = {};
