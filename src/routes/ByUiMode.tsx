import React, { Suspense } from "react";
import { Spin } from "antd";
import { useUiMode } from "../contexts/UiModeContext";

// Renders a route's desktop or mobile element by UI Mode, on the same URL.
// Pass React.lazy components so each mode only downloads its own code.
export const ByUiMode: React.FC<{
  desktop: React.ReactNode;
  mobile: React.ReactNode;
}> = ({ desktop, mobile }) => {
  const { mode } = useUiMode();
  return (
    <Suspense
      fallback={
        <div className="by-ui-mode-loading">
          <Spin size="large" />
        </div>
      }>
      {mode === "mobile" ? mobile : desktop}
    </Suspense>
  );
};
