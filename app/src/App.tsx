import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import DashboardLayout from './components/DashboardLayout'
import LoginPage from './pages/LoginPage'
import UsersPage from './pages/UsersPage'
import ClientsPage from './pages/ClientsPage'
import ProductsPage from './pages/ProductsPage'
import RequirePermission from './components/RequirePermission'
import SalesPage from './pages/SalesPage'
import BankAccountsPage from './pages/BankAccountsPage'
import ReportsPage from './pages/ReportsPage'
import SalesSummaryPage from './pages/SalesSummaryPage'
import LogsPage from './pages/LogsPage'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<RequirePermission permission="sales"><SalesPage /></RequirePermission>} />
        <Route path="/clients" element={<RequirePermission permission="clients"><ClientsPage /></RequirePermission>} />
        <Route path="/products" element={<RequirePermission permission="products"><ProductsPage /></RequirePermission>} />
        <Route
          path="/users"
          element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/bank-accounts"
          element={
            <AdminRoute>
              <BankAccountsPage />
            </AdminRoute>
          }
        />
        <Route path="/reports" element={<RequirePermission permission="reports"><ReportsPage /></RequirePermission>} />
        <Route
          path="/sales-summary"
          element={
            <AdminRoute>
              <SalesSummaryPage />
            </AdminRoute>
          }
        />
        <Route
          path="/logs"
          element={
            <AdminRoute>
              <LogsPage />
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  )
}

export default App
