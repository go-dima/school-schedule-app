import React, { useContext, useEffect, useMemo, useState } from "react";
import { detectDeviceType, type DeviceType } from "../utils/device";
import {
  UI_MODE_STORAGE_KEY,
  parseUiModeOverride,
  resolveUiMode,
  type UiMode,
} from "../services/uiMode";
import { trackEvent, AnalyticsEvent } from "../utils/analytics";
import { UiModeContext, type UiModeContextValue } from "./UiModeContextObject";

// localStorage can throw (Safari private mode, blocked site data); the
// override is a convenience, so failures just fall back to the device.
function readOverride(): UiMode | null {
  try {
    return parseUiModeOverride(localStorage.getItem(UI_MODE_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeOverride(override: UiMode | null) {
  try {
    if (override) localStorage.setItem(UI_MODE_STORAGE_KEY, override);
    else localStorage.removeItem(UI_MODE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const UiModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Detected once per load: resizing a window never flips the UI Mode.
  const [detected] = useState<DeviceType>(() => detectDeviceType(navigator));
  const [override, setOverrideState] = useState<UiMode | null>(readOverride);

  const mode = resolveUiMode({ detected, override });

  useEffect(() => {
    trackEvent(AnalyticsEvent.UiModeResolved, {
      mode,
      detected,
      overridden: override !== null,
    });
    // Once per load; later switches are tracked by setOverride.
  }, []);

  const value = useMemo<UiModeContextValue>(
    () => ({
      mode,
      detected,
      override,
      setOverride: next => {
        writeOverride(next);
        setOverrideState(next);
        trackEvent(AnalyticsEvent.UiModeSwitched, {
          mode: resolveUiMode({ detected, override: next }),
          detected,
        });
      },
    }),
    [mode, detected, override]
  );

  return (
    <UiModeContext.Provider value={value}>{children}</UiModeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useUiMode(): UiModeContextValue {
  const ctx = useContext(UiModeContext);
  if (!ctx) throw new Error("useUiMode must be used within UiModeProvider");
  return ctx;
}
