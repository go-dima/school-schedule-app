import { REQUESTABLE_ROLES, type RequestableRole } from "../constants/roles";

// The role a new user asked for on the signup page. Email signup carries it
// in auth user metadata (it survives verifying the email on another device);
// Google OAuth can't carry metadata, so it's kept in sessionStorage across
// the redirect.
export const REQUESTED_ROLE_STORAGE_KEY = "requestedRole";

const isRequestable = (value: unknown): value is RequestableRole =>
  typeof value === "string" &&
  (REQUESTABLE_ROLES as readonly string[]).includes(value);

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
