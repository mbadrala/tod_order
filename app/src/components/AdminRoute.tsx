import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

function AdminRoute({ children }: { children: ReactNode }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  if (!user.is_admin) return <Navigate to="/" replace />
  return <>{children}</>
}

export default AdminRoute
