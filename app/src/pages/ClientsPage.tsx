import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { getClients, createClient, updateClient, deleteClient, uploadFile, getFileUrl, type Client, type ClientInput } from '@/lib/api'

function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<ClientInput>({})
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const load = async () => {
    try { setClients(await getClients()) } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm({})
    setEditId(null)
    setError('')
  }

  const openEdit = (c: Client) => {
    setForm({
      client_code: c.client_code || '',
      name: c.name,
      phone: c.phone || '',
      owner_name: c.owner_name || '',
      outdoor_photo: c.outdoor_photo || '',
      indoor_photo: c.indoor_photo || '',
      district: c.district || '',
      subdistrict: c.subdistrict || '',
      neighborhood: c.neighborhood || '',
      building_door: c.building_door || '',
      status: c.status || '',
    })
    setEditId(c.id)
    setError('')
    setOpen(true)
  }

  const openCreate = () => {
    resetForm()
    setOpen(true)
  }

  const set = (key: keyof ClientInput, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value || null }))

  const handleSubmit = async () => {
    setError('')
    if (!form.name?.trim()) {
      setError('Нэр шаардлагатай')
      return
    }
    try {
      if (editId) {
        await updateClient(editId, form)
      } else {
        await createClient({ ...form, name: form.name.trim() })
      }
      resetForm()
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
    }
  }

  const handlePhotoUpload = async (field: 'outdoor_photo' | 'indoor_photo', file: File) => {
    setUploading(field)
    setError('')
    try {
      const result = await uploadFile(file)
      setForm((prev) => ({ ...prev, [field]: String(result.id) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Зураг хуулахад алдаа гарлаа')
    } finally {
      setUploading(null)
    }
  }

  const clearPhoto = (field: 'outdoor_photo' | 'indoor_photo') => {
    setForm((prev) => ({ ...prev, [field]: null }))
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}"-г устгах уу?`)) return
    try {
      await deleteClient(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Харилцагчид</h1>
        <Button onClick={openCreate}>Шинэ харилцагч</Button>
      </div>

      <Separator className="mb-4" />

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v) }}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup>
            <DialogTitle>{editId ? 'Харилцагч засах' : 'Шинэ харилцагч'}</DialogTitle>
            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Үндсэн мэдээлэл</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input placeholder="Код" value={form.client_code || ''} onChange={(e) => set('client_code', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <input placeholder="Нэр *" value={form.name || ''} onChange={(e) => set('name', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <input placeholder="Утас" value={form.phone || ''} onChange={(e) => set('phone', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <input placeholder="Эзэмшигчийн нэр" value={form.owner_name || ''} onChange={(e) => set('owner_name', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <select value={form.status || ''} onChange={(e) => set('status', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 bg-background">
                    <option value="">Төлөв сонгох</option>
                    <option value="active">Идэвхтэй</option>
                    <option value="inactive">Идэвхгүй</option>
                  </select>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Зураг</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <PhotoUploadField
                    label="Гадна зураг"
                    value={form.outdoor_photo as string | null | undefined}
                    uploading={uploading === 'outdoor_photo'}
                    onUpload={(f) => handlePhotoUpload('outdoor_photo', f)}
                    onClear={() => clearPhoto('outdoor_photo')}
                  />
                  <PhotoUploadField
                    label="Дотор зураг"
                    value={form.indoor_photo as string | null | undefined}
                    uploading={uploading === 'indoor_photo'}
                    onUpload={(f) => handlePhotoUpload('indoor_photo', f)}
                    onClear={() => clearPhoto('indoor_photo')}
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Байршил</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input placeholder="Дүүрэг" value={form.district || ''} onChange={(e) => set('district', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <input placeholder="Хороо" value={form.subdistrict || ''} onChange={(e) => set('subdistrict', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <input placeholder="Хороолол" value={form.neighborhood || ''} onChange={(e) => set('neighborhood', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                  <input placeholder="Барилга, хаалга" value={form.building_door || ''} onChange={(e) => set('building_door', e.target.value)}
                    className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
                </div>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1" onClick={handleSubmit}>{editId ? 'Хадгалах' : 'Бүртгэх'}</Button>
              <DialogClose render={<Button variant="outline" className="flex-1">Цуцлах</Button>} />
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="min-w-[900px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium">Код</th>
                <th className="px-4 py-3 font-medium">Нэр</th>
                <th className="px-4 py-3 font-medium">Утас</th>
                <th className="px-4 py-3 font-medium">Эзэмшигч</th>
                <th className="px-4 py-3 font-medium">Дүүрэг</th>
                <th className="px-4 py-3 font-medium">Төлөв</th>
                <th className="px-4 py-3 font-medium">Гадна зураг</th>
                <th className="px-4 py-3 font-medium">Дотор зураг</th>
                <th className="px-4 py-3 font-medium">Огноо</th>
                <th className="px-4 py-3 font-medium">Үйлдэл</th>
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Одоогоор харилцагч байхгүй</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">{c.client_code || '-'}</td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.phone || '-'}</td>
                  <td className="px-4 py-3">{c.owner_name || '-'}</td>
                  <td className="px-4 py-3">{c.district || '-'}</td>
                  <td className="px-4 py-3">
                    {c.status === 'active' ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Идэвхтэй</span>
                    ) : c.status === 'inactive' ? (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">Идэвхгүй</span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {c.outdoor_photo ? (
                      <img src={getFileUrl(c.outdoor_photo) || ''} alt="Гадна"
                        className="h-10 w-10 cursor-pointer rounded border object-cover hover:opacity-80"
                        onClick={() => setPreviewUrl(getFileUrl(c.outdoor_photo))} />
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {c.indoor_photo ? (
                      <img src={getFileUrl(c.indoor_photo) || ''} alt="Дотор"
                        className="h-10 w-10 cursor-pointer rounded border object-cover hover:opacity-80"
                        onClick={() => setPreviewUrl(getFileUrl(c.indoor_photo))} />
                    ) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {c.created_at ? new Date(c.created_at).toLocaleDateString('mn-MN') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="outline" size="xs" onClick={() => openEdit(c)}>Засах</Button>
                      <Button variant="outline" size="xs" className="text-destructive"
                        onClick={() => handleDelete(c.id, c.name)}>Устгах</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {previewUrl && (
        <Dialog open={true} onOpenChange={(v) => { if (!v) setPreviewUrl(null) }}>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPopup className="max-h-[90vh] max-w-[90vw] overflow-auto p-2 sm:max-w-3xl">
              <img src={previewUrl} alt="Зураг" className="h-auto w-full rounded" />
              <DialogClose render={<Button variant="outline" size="sm" className="mt-2 w-full">Хаах</Button>} />
            </DialogPopup>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  )
}

function PhotoUploadField({ label, value, uploading, onUpload, onClear }: {
  label: string
  value: string | null | undefined
  uploading: boolean
  onUpload: (file: File) => void
  onClear: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const imgUrl = getFileUrl(value)

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = '' } }} />
      <div className="flex items-center gap-3">
        {imgUrl ? (
          <img src={imgUrl} alt={label} className="h-14 w-14 shrink-0 rounded-lg border object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
            Зураггүй
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button type="button" size="xs" variant="outline" disabled={uploading}
            onClick={() => ref.current?.click()}>
            {uploading ? 'Хуулж байна...' : value ? 'Солих' : 'Хуулах'}
          </Button>
          {value && (
            <Button type="button" size="xs" variant="outline" className="text-destructive" onClick={onClear}>
              Устгах
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ClientsPage
