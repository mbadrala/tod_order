const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Нэвтрэхэд алдаа гарлаа')
  return data
}
