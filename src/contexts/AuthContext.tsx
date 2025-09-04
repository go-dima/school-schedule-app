import React, { createContext, useContext } from 'react'
import { useAuth as useAuthHook } from '../hooks/useAuth'
import type { UserRoleData } from '../types'

export interface AuthContextType {
  user: any
  userRoles: UserRoleData[]
  currentRole: UserRoleData | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  switchRole: (role: UserRoleData) => void
  hasRole: (role: string) => boolean
  isAdmin: () => boolean
  canManageClasses: () => boolean
  canViewAllSchedules: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthHook()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}