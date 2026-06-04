const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: { ...authHeaders(), ...options?.headers },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Алдаа гарлаа')
  return data
}

export async function login(username: string, password: string) {
  return request<{ token: string; user: { id: number; name: string; username: string; is_admin: boolean } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ username, password }) }
  )
}

export async function getUsers() {
  return request<Array<{ id: number; name: string; username: string; is_admin: number; created_at: string; updated_at: string }>>('/auth/users')
}

export async function createUser(data: { name: string; username: string; password: string }) {
  return request<{ message: string; user: { id: number; name: string; username: string } }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(data) }
  )
}

export async function updateUser(id: number, data: { name?: string; username?: string; password?: string }) {
  return request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteUser(id: number) {
  return request<{ message: string }>(`/auth/users/${id}`, { method: 'DELETE' })
}
