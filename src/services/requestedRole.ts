import { REQUESTABLE_ROLES, type RequestableRole } from "../constants/roles";

// The role a new user asked for on the signup page. Email signup carries it
// in auth user metadata (it survives verifying the email on another device);
// Google OAuth can't carry metadata, so it's kept in sessionStorage across
// the redirect, and also in the redirect URL: on Android the OAuth result
// can open in a new tab, which starts with empty sessionStorage.
export const REQUESTED_ROLE_STORAGE_KEY = "requestedRole";
export const REQUESTED_ROLE_URL_PARAM = "requested_role";

const isRequestable = (value: unknown): value is RequestableRole =>
  typeof value === "string" &&
  (REQUESTABLE_ROLES as readonly string[]).includes(value);

// A requestable role, or null for anything else (missing, tampered, admin).
export function parseRequestedRole(value: unknown): RequestableRole | null {
  return isRequestable(value) ? value : null;
}

// Which role the pending request gets: metadata first, then the stored
// value, then parent (a Google sign-in from the login page makes no choice;
// the admin sets the real role at approval). Anything that isn't a
// requestable role is ignored, so a tampered value can't ask for admin.
export function resolveRequestedRole(
  metadata: Record<string, unknown> | null | undefined,
  stored: string | null | undefined
): RequestableRole {
  const fromMetadata = metadata?.requested_role;
  if (isRequestable(fromMetadata)) return fromMetadata;
  if (isRequestable(stored)) return stored;
  return "parent";
}

// sessionStorage can throw (private mode, blocked storage); a lost value
// just falls back to parent.
export function storeRequestedRole(role: RequestableRole): void {
  try {
    sessionStorage.setItem(REQUESTED_ROLE_STORAGE_KEY, role);
  } catch {
    // ignore
  }
}

export function readStoredRequestedRole(): string | null {
  try {
    return sessionStorage.getItem(REQUESTED_ROLE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredRequestedRole(): void {
  try {
    sessionStorage.removeItem(REQUESTED_ROLE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Where Google sends the user back. With a role it's `/?requested_role=...`.
// The Supabase redirect allow list must accept that URL; if it doesn't,
// Supabase falls back to the Site URL and only sessionStorage carries the
// choice.
export function buildOAuthRedirectUrl(
  origin: string,
  role?: RequestableRole
): string {
  if (!role) return origin;
  const url = new URL("/", origin);
  url.searchParams.set(REQUESTED_ROLE_URL_PARAM, role);
  return url.toString();
}

// Moves a `requested_role` query parameter from the URL into sessionStorage
// and removes it from the address bar. Runs before supabase-js reads the
// OAuth callback (see supabase.ts). Only that one parameter is removed: the
// hash (`#access_token=...`) and every other parameter (`?code=...`) are
// kept, so supabase-js still finds the callback. An invalid value is removed
// from the URL but not stored. Returns the stored role, or null.
export function captureRequestedRoleFromUrl(
  win: Window | undefined = typeof window === "undefined" ? undefined : window
): RequestableRole | null {
  if (!win) return null;
  let url: URL;
  try {
    url = new URL(win.location.href);
  } catch {
    return null;
  }
  if (!url.searchParams.has(REQUESTED_ROLE_URL_PARAM)) return null;

  const role = parseRequestedRole(
    url.searchParams.get(REQUESTED_ROLE_URL_PARAM)
  );
  url.searchParams.delete(REQUESTED_ROLE_URL_PARAM);
  try {
    win.history.replaceState(
      win.history.state,
      "",
      url.pathname + url.search + url.hash
    );
  } catch {
    // ignore: the parameter just stays in the address bar
  }

  if (role) storeRequestedRole(role);
  return role;
}
