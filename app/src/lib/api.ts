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

export async function getClients() {
  return request<Client[]>('/clients')
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

export async function getProducts() {
  return request<Product[]>('/products')
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
  user_id: number
  created_at: string
  updated_at: string
  items: SaleItem[]
  bank_allocations: SaleBankAllocation[]
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

export async function getSales() {
  return request<Sale[]>('/sales')
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

export function getFileUrl(id: number | string | null | undefined): string | null {
  if (!id) return null
  const token = localStorage.getItem('token')
  const params = token ? `?token=${encodeURIComponent(token)}` : ''
  return `${API_BASE}/files/${id}${params}`
}
