import { createContext } from "react";
import type { PermissionsState } from "../services/permissions";
import type { RoleFlags } from "../services/roleFlags";
import type { RequestableRole } from "../constants/roles";
import type { UserRole, UserRoleData } from "../types";

export interface AuthContextType {
  user: any;
  userRoles: UserRoleData[];
  currentRole: UserRoleData | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** requestedRole: the signup page's choice, for a first sign-in. */
  signInWithGoogle: (requestedRole?: RequestableRole) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    requestedRole?: RequestableRole
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (role: UserRoleData) => void;
  hasRole: (role: UserRole) => boolean;
  permissions: PermissionsState;
  roleFlags: RoleFlags;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);
