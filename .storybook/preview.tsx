import type { Preview } from "@storybook/react";
import React from "react";
import { ConfigProvider } from "antd";
import heIL from "antd/locale/he_IL";
import "../src/utils/i18n";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    Story => (
      <ConfigProvider locale={heIL} direction="rtl">
        <div dir="rtl">
          <Story />
        </div>
      </ConfigProvider>
    ),
  ],
};

export default preview;
