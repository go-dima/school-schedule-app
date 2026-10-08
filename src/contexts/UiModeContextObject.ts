import { createContext } from "react";
import type { DeviceType } from "../utils/device";
import type { UiMode } from "../services/uiMode";

export interface UiModeContextValue {
  mode: UiMode;
  detected: DeviceType;
  override: UiMode | null;
  setOverride: (override: UiMode | null) => void;
}

export const UiModeContext = createContext<UiModeContextValue | undefined>(
  undefined
);
