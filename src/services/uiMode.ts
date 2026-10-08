import type { DeviceType } from "../utils/device";

export type UiMode = DeviceType;

export const UI_MODE_STORAGE_KEY = "uiMode";

// The UI Mode is the user's explicit override if they set one, otherwise the
// detected device. It never depends on roles: every role gets the mobile
// shell on a phone.
export function resolveUiMode({
  detected,
  override,
}: {
  detected: DeviceType;
  override: UiMode | null;
}): UiMode {
  return override ?? detected;
}

export function parseUiModeOverride(value: string | null): UiMode | null {
  return value === "mobile" || value === "desktop" ? value : null;
}
