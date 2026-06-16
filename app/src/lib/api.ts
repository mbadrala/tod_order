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
  return request<{ token: string; user: { id: number; name: string; username: string; is_admin: boolean; permissions: string[] } }>(
    '/auth/login',
    { method: 'POST', body: JSON.stringify({ username, password }) }
  )
}

export async function getUsers() {
  return request<Array<{ id: number; name: string; username: string; is_admin: number; permissions: string[]; created_at: string; updated_at: string }>>('/auth/users')
}

export async function createUser(data: { name: string; username: string; password: string; permissions?: string[] }) {
  return request<{ message: string; user: { id: number; name: string; username: string; permissions: string[] } }>(
    '/auth/register',
    { method: 'POST', body: JSON.stringify(data) }
  )
}

export async function updateUser(id: number, data: { name?: string; username?: string; password?: string; permissions?: string[] }) {
  return request<{ id: number; name: string; username: string; is_admin: number; permissions: string[] }>(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteUser(id: number) {
  return request<{ message: string }>(`/auth/users/${id}`, { method: 'DELETE' })
}

export async function getMe() {
  return request<{ id: number; name: string; username: string; is_admin: boolean; permissions: string[] }>('/auth/me')
}

export interface Client {
  id: number
  user_id: number
  client_code: string | null
  name: string
  phone: string | null
  owner_name: string | null
  outdoor_photo: string | null
  indoor_photo: string | null
  district: string | null
  subdistrict: string | null
  neighborhood: string | null
  building_door: string | null
  status: string | null
  created_at: string
  updated_at: string
}

export type ClientInput = Partial<Omit<Client, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
}

export interface ClientFilters {
  code?: string
  name?: string
  phone?: string
  page?: number
  per_page?: number
}

export async function getClients(filters: ClientFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<PaginatedResponse<Client>>(`/clients${qs ? '?' + qs : ''}`)
}

export async function getClientsAll(filters: Omit<ClientFilters, 'page' | 'per_page'> = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<Client[]>(`/clients/all${qs ? '?' + qs : ''}`)
}

export async function createClient(data: ClientInput) {
  return request<Client>('/clients', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateClient(id: number, data: ClientInput) {
  return request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteClient(id: number) {
  return request<{ message: string }>(`/clients/${id}`, { method: 'DELETE' })
}

export async function uploadFile(file: File) {
  const token = localStorage.getItem('token')
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/files/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Алдаа гарлаа')
  return data as { id: number; url: string; original_name: string; mime_type: string; size: number }
}

export interface Product {
  id: number
  code: string
  name: string
  created_at: string
  updated_at: string
}

export type ProductInput = { code: string; name: string }

export interface ProductFilters {
  code?: string
  name?: string
  page?: number
  per_page?: number
}

export async function getProducts(filters: ProductFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<PaginatedResponse<Product>>(`/products${qs ? '?' + qs : ''}`)
}

export async function getProductsAll(filters: Omit<ProductFilters, 'page' | 'per_page'> = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<Product[]>(`/products/all${qs ? '?' + qs : ''}`)
}

export async function getProduct(id: number) {
  return request<Product>(`/products/${id}`)
}

export async function createProduct(data: ProductInput) {
  return request<Product>('/products', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateProduct(id: number, data: Partial<ProductInput>) {
  return request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteProduct(id: number) {
  return request<{ message: string }>(`/products/${id}`, { method: 'DELETE' })
}

export interface SaleBankAllocation {
  id: number
  sale_id: number
  bank_account_id: number
  bank_name: string
  account_number: string
  account_name: string
  amount: number
}

export interface Sale {
  id: number
  sale_date: string
  client_code: string | null
  client_name: string | null
  client_phone: string | null
  slip_number: string | null
  status: string
  total_amount: number
  cash_amount: number
  deferred_amount: number
  discount_amount: number
  user_id: number
  user_name?: string
  created_at: string
  updated_at: string
  items: SaleItem[]
  bank_allocations: SaleBankAllocation[]
  items_count?: number
  is_locked?: number
}

export interface SaleItem {
  id: number
  sale_id: number
  product_code: string
  product_name: string
  amount: number
  unit_price: number
  sum_price: number
}

export interface SaleInput {
  sale_date: string
  client_code?: string | null
  client_name?: string | null
  client_phone?: string | null
  slip_number?: string | null
  status?: string
  cash_amount?: number
  deferred_amount?: number
  discount_amount?: number
  items: Array<{
    product_code: string
    product_name: string
    amount: number
    unit_price: number
  }>
  bank_allocations?: Array<{
    bank_account_id: number
    bank_name: string
    account_number: string
    amount: number
  }>
}

export interface SaleFilters {
  client_name?: string
  slip_number?: string
  total_min?: string
  total_max?: string
  page?: number
  per_page?: number
}

export async function getSales(filters: SaleFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<PaginatedResponse<Sale>>(`/sales${qs ? '?' + qs : ''}`)
}

export async function getSale(id: number) {
  return request<Sale>(`/sales/${id}`)
}

export async function createSale(data: SaleInput) {
  return request<Sale>('/sales', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateSale(id: number, data: Partial<SaleInput>) {
  return request<Sale>(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteSale(id: number) {
  return request<{ message: string }>(`/sales/${id}`, { method: 'DELETE' })
}

export interface BankAccount {
  id: number
  bank_name: string
  account_number: string
  account_name: string
  created_at: string
  updated_at: string
}

export type BankAccountInput = { bank_name: string; account_number: string; account_name: string }

export async function getBankAccounts() {
  return request<BankAccount[]>('/bank-accounts')
}

export async function createBankAccount(data: BankAccountInput) {
  return request<BankAccount>('/bank-accounts', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateBankAccount(id: number, data: Partial<BankAccountInput>) {
  return request<BankAccount>(`/bank-accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteBankAccount(id: number) {
  return request<{ message: string }>(`/bank-accounts/${id}`, { method: 'DELETE' })
}

export interface ReportBankAllocation {
  id: number
  report_id: number
  bank_account_id: number
  bank_name: string
  account_number: string
  account_name: string
  amount: number
}

export interface Report {
  id: number
  sale_id: number
  sale_date: string
  client_code: string | null
  client_name: string | null
  client_phone: string | null
  slip_number: string | null
  total_amount: number
  cash_amount: number
  deferred_amount: number
  discount_amount: number
  product_code: string
  product_name: string
  item_amount: number
  unit_price: number
  sum_price: number
  user_id: number
  user_name: string
  created_at: string
  is_locked: number
  bank_allocations: ReportBankAllocation[]
}

export interface ReportFilters {
  from?: string
  to?: string
  client_code?: string
  product_code?: string
  product_name?: string
  amount_min?: number
  amount_max?: number
  unit_price_min?: number
  unit_price_max?: number
  sum_price_min?: number
  sum_price_max?: number
  bank_account_id?: number
  user_id?: number
  page?: number
  per_page?: number
}

export async function listReports(filters: ReportFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<PaginatedResponse<Report>>(`/reports${qs ? '?' + qs : ''}`)
}

export async function listReportsAll(filters: Omit<ReportFilters, 'page' | 'per_page'> = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<Report[]>(`/reports/all${qs ? '?' + qs : ''}`)
}

export async function deleteReport(saleId: number) {
  return request<{ message: string }>(`/reports/${saleId}`, { method: 'DELETE' })
}

export interface LogEntry {
  timestamp: string
  username: string
  method: string
  path: string
  query: string
  status: number
  duration_ms: number
}

export async function getLogs() {
  return request<{ data: LogEntry[]; total: number }>('/logs')
}

export interface SaleSummaryFilters {
  page?: number
  per_page?: number
  client_name?: string
  from?: string
  to?: string
}

export interface SaleSummary {
  sale_date: string
  total_amount: number
  cash_amount: number
  deferred_amount: number
  discount_amount: number
  bank_total: number
  bank_allocations: Record<string, number>
}

export async function getSalesSummary(filters: SaleSummaryFilters = {}) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return request<{ data: SaleSummary[]; total: number; page: number; per_page: number }>(`/sales/admin-summary${qs ? `?${qs}` : ''}`)
}

export async function toggleSaleLock(id: number): Promise<{ is_locked: number }> {
  return request(`/sales/${id}/lock`, { method: 'POST' })
}

export function getFileUrl(id: number | string | null | undefined): string | null {
  if (!id) return null
  const token = localStorage.getItem('token')
  const params = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${API_BASE}/files/${id}${params}`
}
