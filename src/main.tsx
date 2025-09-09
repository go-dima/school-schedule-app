import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import heIL from "antd/locale/he_IL";
import { env } from "./utils/env";
import "./utils/i18n";
import App from "./App.tsx";
import "./index.css";

// Update document title
document.title = env.appTitle;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={heIL}
      direction="rtl"
      theme={{
        token: {
          fontFamily:
            'Assistant, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
      }}>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
