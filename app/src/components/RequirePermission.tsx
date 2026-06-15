import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (user.is_admin) return <>{children}</>
  const perms: string[] = user.permissions || []
  if (!perms.includes(permission)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default RequirePermission
