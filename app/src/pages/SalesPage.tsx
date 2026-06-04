import { useEffect, useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogClose } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DatePicker } from '@/components/ui/date-picker'
import { ClientSelect } from '@/components/ui/client-select'
import { getSales, createSale, updateSale, deleteSale, getProducts, getClients, type Sale, type Product, type Client } from '@/lib/api'

interface LineItemForm {
  product_code: string
  product_name: string
  amount: number
  unit_price: number
}

const emptyLine = (): LineItemForm => ({ product_code: '', product_name: '', amount: 1, unit_price: 0 })

function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'sale_date', desc: true }])
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [saleDate, setSaleDate] = useState<Date>(new Date())
  const [clientCode, setClientCode] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [slipNumber, setSlipNumber] = useState('')
  const [items, setItems] = useState<LineItemForm[]>([emptyLine()])
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)
  const isAdmin = JSON.parse(localStorage.getItem('user') || '{}').is_admin

  const load = async () => {
    try {
      const [s, p, c] = await Promise.all([getSales(), getProducts(), getClients()])
      setSales(s)
      setProducts(p)
      setClients(c)
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setSaleDate(new Date())
    setClientCode('')
    setClientName('')
    setClientPhone('')
    setSlipNumber('')
    setItems([emptyLine()])
    setEditId(null)
    setError('')
  }

  const openEdit = (s: Sale) => {
    setSaleDate(new Date(s.sale_date))
    setClientCode(s.client_code || '')
    setClientName(s.client_name || '')
    setClientPhone(s.client_phone || '')
    setSlipNumber(s.slip_number || '')
    setItems(s.items.map((i) => ({
      product_code: i.product_code,
      product_name: i.product_name,
      amount: i.amount,
      unit_price: i.unit_price,
    })))
    setEditId(s.id)
    setError('')
    setOpen(true)
  }

  const openCreate = () => {
    resetForm()
    setOpen(true)
  }

  const addItem = () => setItems((prev) => [...prev, emptyLine()])

  const removeItem = (idx: number) => {
    setItems((prev) => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  const updateItem = (idx: number, field: keyof LineItemForm, value: string | number) => {
    setItems((prev) => {
      const next = prev.map((item, i) => i === idx ? { ...item, [field]: value } : item)

      if (field === 'product_code') {
        const code = String(value)
        const match = products.find((p) => p.code === code)
        if (match) next[idx].product_name = match.name
      }

      return next
    })
  }

  const totalSum = useMemo(() =>
    items.reduce((sum, item) => sum + item.amount * item.unit_price, 0),
    [items]
  )

  const dateStr = useMemo(() => {
    try { return saleDate.toISOString().slice(0, 10) } catch { return new Date().toISOString().slice(0, 10) }
  }, [saleDate])

  const save = async (status: string) => {
    setError('')
    if (!slipNumber.trim()) {
      setError('Падааны дугаар шаардлагатай')
      return
    }
    if (items.length === 0 || items.every((i) => !i.product_code.trim())) {
      setError('Дор хаяж нэг бараа оруулна уу')
      return
    }
    try {
      const payload = {
        sale_date: dateStr,
        client_code: clientCode || null,
        client_name: clientName || null,
        client_phone: clientPhone || null,
        slip_number: slipNumber.trim(),
        status,
        items: items.map((i) => ({
          product_code: i.product_code,
          product_name: i.product_name,
          amount: i.amount,
          unit_price: i.unit_price,
        })),
      }
      if (editId) {
        await updateSale(editId, payload)
      } else {
        await createSale(payload)
      }
      resetForm()
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
    }
  }

  const handleDelete = async (id: number) => {
    setDeleteTarget({ id, name: `Борлуулалт #${id}` })
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteSale(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setDeleteTarget(null)
      setError(err instanceof Error ? err.message : 'Алдаа гарлаа')
    }
  }

  const handleClientSelect = (c: { client_code: string; client_name: string; client_phone: string }) => {
    setClientCode(c.client_code)
    setClientName(c.client_name)
    setClientPhone(c.client_phone)
  }

  const columns: ColumnDef<Sale>[] = [
    {
      id: 'sale_date',
      header: 'Огноо',
      accessorKey: 'sale_date',
      cell: ({ getValue }) => {
        const v = getValue() as string
        return v ? new Date(v).toLocaleDateString('mn-MN') : '-'
      },
    },
    {
      id: 'client_name',
      header: 'Харилцагч',
      cell: ({ row }) => row.original.client_name || row.original.client_code || '-',
    },
    {
      id: 'slip_number',
      header: 'Падааны дугаар',
      accessorKey: 'slip_number',
      cell: ({ getValue }) => String(getValue() ?? '-'),
    },
    {
      id: 'status',
      header: 'Төлөв',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const v = getValue() as string
        if (v === 'draft') return <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Түр хадгалсан</span>
        return <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Баталгаажсан</span>
      },
    },
    {
      id: 'total_amount',
      header: 'Дүн',
      accessorKey: 'total_amount',
      cell: ({ getValue }) => {
        const v = getValue() as number
        return v.toLocaleString('mn-MN') + ' ₮'
      },
    },
    {
      id: 'items_count',
      header: 'Мөр',
      cell: ({ row }) => row.original.items?.length ?? '-',
    },
    {
      id: 'actions',
      header: 'Үйлдэл',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="outline" size="xs" onClick={() => openEdit(row.original)}>Засах</Button>
          {isAdmin && (
            <Button variant="outline" size="xs" className="text-destructive"
              onClick={() => handleDelete(row.original.id)}>Устгах</Button>
          )}
        </div>
      ),
    },
  ]

  const table = useReactTable({
    data: sales,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Борлуулалт</h1>
        <Button onClick={openCreate}>Шинэ борлуулалт</Button>
      </div>

      <Separator className="mb-4" />

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v) }}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogTitle>{editId ? 'Борлуулалт засах' : 'Шинэ борлуулалт'}</DialogTitle>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Огноо</p>
                <DatePicker value={saleDate} onChange={(d) => d && setSaleDate(d)} />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Падааны дугаар</p>
                <input placeholder="Падааны №" value={slipNumber} onChange={(e) => setSlipNumber(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/50" />
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Харилцагч</p>
                <ClientSelect
                  clients={clients}
                  selectedCode={clientCode}
                  selectedName={clientName}
                  selectedPhone={clientPhone}
                  onSelect={handleClientSelect}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Бараанууд</p>
                <Button size="xs" variant="outline" onClick={addItem}>+ Мөр нэмэх</Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
                      <th className="px-2 py-2 font-medium">Барааны код</th>
                      <th className="px-2 py-2 font-medium">Барааны нэр</th>
                      <th className="px-2 py-2 font-medium text-right">Ширхэг</th>
                      <th className="px-2 py-2 font-medium text-right">Үнэ</th>
                      <th className="px-2 py-2 font-medium text-right">Нийт</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1.5">
                          <input
                            list="product-codes"
                            placeholder="Код" value={item.product_code}
                            onChange={(e) => updateItem(idx, 'product_code', e.target.value)}
                            className="w-full rounded border px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input placeholder="Нэр" value={item.product_name}
                            onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                            className="w-full rounded border px-2 py-1.5 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="1" value={item.amount}
                            onChange={(e) => updateItem(idx, 'amount', Number(e.target.value))}
                            className="w-16 rounded border px-2 py-1.5 text-right text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min="0" step="100" value={item.unit_price}
                            onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                            className="w-24 rounded border px-2 py-1.5 text-right text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                          {(item.amount * item.unit_price).toLocaleString('mn-MN')}
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeItem(idx)}
                            className="rounded px-1 py-0.5 text-xs text-destructive hover:bg-destructive/10">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <datalist id="product-codes">
                {products.map((p) => (
                  <option key={p.id} value={p.code} label={`${p.code} - ${p.name}`} />
                ))}
              </datalist>

              <div className="mt-3 flex justify-end border-t pt-3">
                <div className="text-sm font-semibold tabular-nums">
                  Нийт дүн: {totalSum.toLocaleString('mn-MN')} ₮
                </div>
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => save('draft')}>Түр хадгалах</Button>
              <Button className="flex-1" onClick={() => save('final')}>{editId ? 'Хадгалах' : 'Бүртгэх'}</Button>
              <DialogClose render={<Button variant="outline">Цуцлах</Button>} />
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none hover:text-foreground/80' : ''}
                    onClick={header.column.getToggleSortingHandler()}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? ''}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  Одоогоор борлуулалт байхгүй
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title="Борлуулалт устгах"
        message={`${deleteTarget?.name ?? ''}-г устгах уу?`}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default SalesPage
