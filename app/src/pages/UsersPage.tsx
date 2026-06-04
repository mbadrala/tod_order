import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/api'

interface User {
  id: number
  name: string
  username: string
  is_admin: number
  created_at: string
}

function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try {
      setUsers(await getUsers())
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setName('')
    setUsername('')
    setPassword('')
    setEditId(null)
    setShowForm(false)
    setError('')
  }

  const openEdit = (u: User) => {
    setName(u.name)
    setUsername(u.username)
    setPassword('')
    setEditId(u.id)
    setShowForm(true)
    setError('')
  }

  const handleSubmit = async () => {
    setError('')
    if (!name.trim() || !username.trim()) {
      setError('Нэр болон нэвтрэх нэр шаардлагатай')
      return
    }
    try {
      if (editId) {
        await updateUser(editId, { name: name.trim(), username: username.trim(), ...(password ? { password } : {}) })
      } else {
        if (!password || password.length < 6) {
          setError('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой')
          return
        }
        await createUser({ name: name.trim(), username: username.trim(), password })
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`${name} хэрэглэгчийг устгах уу?`)) return
    try {
      await deleteUser(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Хэрэглэгчид</h1>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          Шинэ хэрэглэгч
        </Button>
      </div>

      <Separator className="mb-4" />

      {showForm && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="mb-3 text-sm font-semibold">
            {editId ? 'Хэрэглэгч засах' : 'Шинэ хэрэглэгч бүртгэх'}
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <input
              placeholder="Нэр"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
            <input
              placeholder="Нэвтрэх нэр"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
            <input
              type="password"
              placeholder={editId ? 'Шинэ нууц үг (хоосон)' : 'Нууц үг'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
            />
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleSubmit}>
              {editId ? 'Хадгалах' : 'Бүртгэх'}
            </Button>
            <Button variant="outline" size="sm" onClick={resetForm}>
              Цуцлах
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Нэр</th>
              <th className="px-4 py-3 font-medium">Нэвтрэх нэр</th>
              <th className="px-4 py-3 font-medium">Эрх</th>
              <th className="px-4 py-3 font-medium">Бүртгэгдсэн</th>
              <th className="px-4 py-3 font-medium">Үйлдэл</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">{u.id}</td>
                <td className="px-4 py-3">{u.name}</td>
                <td className="px-4 py-3">{u.username}</td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Админ
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Хэрэглэгч</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="outline" size="xs" onClick={() => openEdit(u)}>
                      Засах
                    </Button>
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-destructive"
                      disabled={!!u.is_admin}
                      onClick={() => handleDelete(u.id, u.name)}
                    >
                      Устгах
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default UsersPage
