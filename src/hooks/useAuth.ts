import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { authApi, usersApi } from '../services/api'
import type { UserRoleData } from '../types'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [userRoles, setUserRoles] = useState<UserRoleData[]>([])
  const [currentRole, setCurrentRole] = useState<UserRoleData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const user = await authApi.getCurrentUser()
        if (mounted) {
          setUser(user)
          if (user) {
            await loadUserRoles(user.id)
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Authentication error')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    const loadUserRoles = async (userId: string) => {
      try {
        const roles = await usersApi.getUserRoles(userId)
        const approvedRoles = roles.filter(role => role.approved)
        
        if (mounted) {
          setUserRoles(approvedRoles)
          setCurrentRole(approvedRoles[0] || null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load user roles')
        }
      }
    }

    initAuth()

    const { data: { subscription } } = authApi.onAuthStateChange(async (user) => {
      if (mounted) {
        setUser(user)
        setError(null)
        
        if (user) {
          await loadUserRoles(user.id)
        } else {
          setUserRoles([])
          setCurrentRole(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setError(null)
    setLoading(true)
    
    try {
      await authApi.signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email: string, password: string) => {
    setError(null)
    setLoading(true)
    
    try {
      await authApi.signUp(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setError(null)
    
    try {
      await authApi.signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign out failed')
      throw err
    }
  }

  const switchRole = (role: UserRoleData) => {
    if (userRoles.some(r => r.id === role.id)) {
      setCurrentRole(role)
    }
  }

  const hasRole = (role: string): boolean => {
    return userRoles.some(r => r.role === role)
  }

  const isAdmin = (): boolean => {
    return hasRole('admin')
  }

  const canManageClasses = (): boolean => {
    return hasRole('admin') || hasRole('staff')
  }

  const canViewAllSchedules = (): boolean => {
    return hasRole('admin') || hasRole('staff')
  }

  return {
    user,
    userRoles,
    currentRole,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    switchRole,
    hasRole,
    isAdmin,
    canManageClasses,
    canViewAllSchedules,
  }
}