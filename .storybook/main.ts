import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path from "path";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(viteConfig) {
    return mergeConfig(viteConfig, {
      // Storybook never talks to a real Supabase project: pages call stubbed
      // services (see src/stories/fixtures/stubApis.tsx). These placeholders
      // only let src/utils/env.ts load without a .env.local, so a clean
      // checkout (or CI) builds the same stories as a developer machine.
      define: {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
          "http://localhost:54321"
        ),
        "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
          "storybook-placeholder-key"
        ),
      },
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "../src"),
        },
      },
    });
  },
};

export default config;
