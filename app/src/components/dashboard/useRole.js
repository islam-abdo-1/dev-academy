import { useAuth } from '@/lib/AuthContext'

export function isSuperAdmin(role) {
  return role === 'SUPER_ADMIN'
}

export function isStaff(role) {
  return role === 'ADMIN' || role === 'SUPER_ADMIN'
}

export function useRole() {
  const { user, profile, loading } = useAuth()
  const role =
    profile?.role === 'super_admin'
      ? 'SUPER_ADMIN'
      : profile?.role === 'admin'
        ? 'ADMIN'
        : 'STUDENT'

  return { role, user: profile, loading: loading || (!!user && !profile) }
}
