import React from "react";
import { Route, Routes } from "react-router-dom";
import MobileAppLayout from "../../layouts/MobileAppLayout";
import { AuthContext } from "../../contexts/AuthContextObject";
import { mockParentAuth } from "./mockAuth";
import { UiModeContext } from "../../contexts/UiModeContextObject";
import type { UiMode } from "../../services/uiMode";

/** Renders `page` as the routed content of the real mobile app shell,
 * signed in as a parent. */
export const MobileShell: React.FC<{
  page: React.ReactNode;
  detected?: UiMode;
}> = ({ page, detected = "mobile" }) => (
  <AuthContext.Provider value={mockParentAuth}>
    <UiModeContext.Provider
      value={{
        mode: "mobile",
        detected,
        override: null,
        setOverride: () => {},
      }}>
      <Routes>
        <Route element={<MobileAppLayout />}>
          <Route path="*" element={page} />
        </Route>
      </Routes>
    </UiModeContext.Provider>
  </AuthContext.Provider>
);
