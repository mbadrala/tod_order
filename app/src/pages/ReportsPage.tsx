import { useEffect, useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { DatePicker } from '@/components/ui/date-picker'
import { ClientSelect } from '@/components/ui/client-select'
import { getBankAccounts, getClients, type BankAccount, type Client, type Sale, type SaleItem, type SaleBankAllocation } from '@/lib/api'
import * as XLSX from 'xlsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function authHeaders() {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

interface FlatRow {
  sale_date: string
  client_code: string
  client_name: string
  client_phone: string
  slip_number: string
  product_code: string
  product_name: string
  amount: number
  unit_price: number
  sum_price: number
  cash_amount: number
  deferred_amount: number
  user_name: string
  created_at: string
  bankAllocs: Record<string, number>
}

function buildExportName(from?: Date, to?: Date, clientCode?: string, clientName?: string): string {
  const parts: string[] = ['export']
  if (from) parts.push('from_' + from.toISOString().slice(0, 10))
  if (to) parts.push('to_' + to.toISOString().slice(0, 10))
  if (clientCode) {
    const label = clientName ? `${clientName}_${clientCode}` : clientCode
    parts.push(label.replace(/[^a-zA-Z0-9_\-\u0400-\u04ff]/g, '_'))
  }
  return parts.join('_')
}

function ReportsPage() {
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined)
  const [toDate, setToDate] = useState<Date | undefined>(undefined)
  const [clientCode, setClientCode] = useState('')
  const [clientName, setClientName] = useState('')
  const [data, setData] = useState<Sale[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(false)

  const loadMeta = async () => {
    try {
      const [c, b] = await Promise.all([getClients(), getBankAccounts()])
      setClients(c)
      setBankAccounts(b)
    } catch { /* ignore */ }
  }

  useEffect(() => { loadMeta() }, [])

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (fromDate) params.set('from', fromDate.toISOString().slice(0, 10))
      if (toDate) params.set('to', toDate.toISOString().slice(0, 10))
      if (clientCode.trim()) params.set('client_code', clientCode.trim())

      const res = await fetch(`${API_BASE}/sales/report?${params}`, { headers: authHeaders() })
      const json = await res.json()
      if (res.ok) setData(json)
      else setData([])
    } catch { setData([]) }
    setLoading(false)
  }, [fromDate, toDate, clientCode])

  useEffect(() => { fetchReport() }, [fetchReport])

  const handleClientSelect = (c: { client_code: string; client_name: string; client_phone: string }) => {
    setClientCode(c.client_code)
    setClientName(c.client_name)
  }

  const clearClient = () => {
    setClientCode('')
    setClientName('')
  }

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = []
    for (const sale of data) {
      const items: SaleItem[] = sale.items || []
      const allocs: SaleBankAllocation[] = sale.bank_allocations || []
      const bankByAccountId: Record<string, number> = {}
      for (const a of allocs) {
        bankByAccountId[String(a.bank_account_id)] = a.amount
      }
      for (const item of items) {
        rows.push({
          sale_date: sale.sale_date,
          client_code: sale.client_code || '',
          client_name: sale.client_name || '',
          client_phone: sale.client_phone || '',
          slip_number: sale.slip_number || '',
          product_code: item.product_code,
          product_name: item.product_name,
          amount: item.amount,
          unit_price: item.unit_price,
          sum_price: item.sum_price,
          cash_amount: sale.cash_amount ?? 0,
          deferred_amount: sale.deferred_amount ?? 0,
          user_name: (sale as any).user_name || '',
          created_at: sale.created_at,
          bankAllocs: { ...bankByAccountId },
        })
      }
    }
    return rows
  }, [data])

  const exportName = useMemo(() =>
    buildExportName(fromDate, toDate, clientCode || undefined, clientName || undefined),
    [fromDate, toDate, clientCode, clientName]
  )

  const exportPdf = () => {
    const params = new URLSearchParams()
    if (fromDate) params.set('from', fromDate.toISOString().slice(0, 10))
    if (toDate) params.set('to', toDate.toISOString().slice(0, 10))
    if (clientCode.trim()) params.set('client_code', clientCode.trim())
    const token = localStorage.getItem('token')
    const url = `${API_BASE}/sales/report/pdf?${params}&token=${encodeURIComponent(token || '')}`
    window.open(url, '_blank')
  }

  const exportExcel = () => {
    const headers = [
      'Огноо', 'Харилцагчийн код', 'Харилцагчийн нэр', 'Утасны дугаар',
      'Падааны дугаар', 'Барааны код', 'Барааны нэр', 'Тоо хэмжээ',
      'Нэгж үнэ', 'Дүн', 'Бэлэн',
      ...bankAccounts.map((ba) => (ba.account_name || ba.bank_name || `Данс ${i + 1}`)),
      'Дараа төлбөр', 'Бүртгэсэн ажилтан', 'Бүртгэсэн огноо',
    ]
    const body = flatRows.map((r) => [
      r.sale_date, r.client_code, r.client_name, r.client_phone,
      r.slip_number, r.product_code, r.product_name, r.amount,
      r.unit_price, r.sum_price, r.cash_amount,
      ...bankAccounts.map((ba) => r.bankAllocs[String(ba.id)] || 0),
      r.deferred_amount, r.user_name, r.created_at,
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...body])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Тайлан')
    XLSX.writeFile(wb, `${exportName}.xlsx`)
  }

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Тайлан</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf} disabled={flatRows.length === 0}>
            PDF экспорт
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={flatRows.length === 0}>
            Excel экспорт
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Эхлэх огноо</p>
          <DatePicker value={fromDate} onChange={(d) => setFromDate(d ?? undefined)} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Дуусах огноо</p>
          <DatePicker value={toDate} onChange={(d) => setToDate(d ?? undefined)} />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Харилцагч</p>
          <div className="flex gap-1">
            <div className="min-w-60">
              <ClientSelect
                clients={clients}
                selectedCode={clientCode}
                selectedName={clientName}
                selectedPhone=""
                onSelect={handleClientSelect}
              />
            </div>
            {clientCode && (
              <Button variant="ghost" size="xs" onClick={clearClient}>✕</Button>
            )}
          </div>
        </div>
        <Button variant="default" onClick={fetchReport}>Хайх</Button>
      </div>

      <Separator className="mb-4" />

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Уншиж байна...</p>
      ) : flatRows.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Илэрц олдсонгүй</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                <th className="whitespace-nowrap px-2 py-2 font-medium">Огноо</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Харилцагчийн код</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Харилцагчийн нэр</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Утасны дугаар</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Падааны дугаар</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Барааны код</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Барааны нэр</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">Тоо хэмжээ</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">Нэгж үнэ</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">Дүн</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">Бэлэн</th>
                {bankAccounts.map((ba) => (
                  <th key={ba.id} className="whitespace-nowrap px-2 py-2 font-medium text-right" title={`${ba.bank_name} - ${ba.account_number}`}>
                    {ba.account_name || ba.bank_name}
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-2 font-medium text-right">Дараа төлбөр</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Бүртгэсэн ажилтан</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">Бүртгэсэн огноо</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((r, idx) => (
                <tr key={idx} className="border-t">
                  <td className="whitespace-nowrap px-2 py-1.5">{r.sale_date}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.client_code}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.client_name}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.client_phone}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.slip_number}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.product_code}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.product_name}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.amount}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.unit_price.toLocaleString('mn-MN')}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums font-medium">{r.sum_price.toLocaleString('mn-MN')}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.cash_amount.toLocaleString('mn-MN')}</td>
                  {bankAccounts.map((ba) => (
                    <td key={ba.id} className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">
                      {(r.bankAllocs[String(ba.id)] || 0).toLocaleString('mn-MN')}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.deferred_amount.toLocaleString('mn-MN')}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.user_name}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">Нийт мөр: {flatRows.length}</p>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
