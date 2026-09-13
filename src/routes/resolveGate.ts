import { ROUTES } from "./paths";
import type { User, UserRoleData } from "../types";

export interface GateState {
  user: User | null;
  hasProfile: boolean;
  roles: UserRoleData[];
}

export type GateRedirect =
  | typeof ROUTES.LOGIN
  | typeof ROUTES.PROFILE_SETUP
  | typeof ROUTES.PENDING_APPROVAL
  | null;

export function resolveGate(state: GateState): GateRedirect {
  const { user, hasProfile, roles } = state;

  if (!user) return ROUTES.LOGIN;
  if (!hasProfile) return ROUTES.PROFILE_SETUP;
  if (roles.length === 0) return ROUTES.PENDING_APPROVAL;
  return null;
}
