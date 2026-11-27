import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import { Analytics } from "@vercel/analytics/react";
import heIL from "antd/locale/he_IL";
import { env } from "./utils/env";
import "./utils/i18n";
import { theme } from "./theme";
import App from "./App.tsx";
import "./index.css";

// Update document title
document.title = env.appTitle;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={heIL} direction="rtl" theme={theme}>
      <App />
      <Analytics />
    </ConfigProvider>
  </React.StrictMode>
);
