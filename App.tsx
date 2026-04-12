import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './src/contexts/AuthProvider';
import { ToastProvider } from './src/contexts/ToastContext';
import { SearchProvider } from './src/contexts/SearchContext';
import { RealtimeProvider } from './src/contexts/RealtimeProvider';
import { NetworkProvider } from './src/contexts/NetworkProvider';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';
import NetworkStatusBanner from './components/NetworkStatusBanner';
import { WRITE_FREEZE_ENABLED } from './src/config/incidentMode';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is considered fresh for 5 min
      gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime) - keep in memory for 30 min
      retry: 2, // Retry failed requests 2 times (was 3, too aggressive)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff, max 10s
      refetchOnWindowFocus: false, // Don't auto-refetch on window focus (optimistic updates handle changes)
      refetchOnReconnect: false, // Don't auto-refetch on reconnect (optimistic updates handle changes)
      refetchOnMount: false, // Don't auto-refetch on mount (avoid unnecessary requests)
    },
    mutations: {
      retry: 1, // Only retry mutations once
      retryDelay: 1000, // 1 second delay between retries
    },
  },
});
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderForm from './pages/OrderForm';
import OrderDetails from './pages/OrderDetails';
import Bills from './pages/Bills';
import BillForm from './pages/BillForm';
import BillDetails from './pages/BillDetails';
import Banking from './pages/Banking';
import Transactions from './pages/Transactions';
import TransactionForm from './pages/TransactionForm';
import Transfer from './pages/Transfer';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import UserDetails from './pages/UserDetails';
import SettingsPage from './pages/Settings';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import CustomerDetails from './pages/CustomerDetails';
import Vendors from './pages/Vendors';
import VendorForm from './pages/VendorForm';
import VendorDetails from './pages/VendorDetails';
import Reports from './pages/Reports';
import Payroll from './pages/Payroll';
import RecycleBin from './pages/RecycleBin';
import ExpenseSummary from './pages/reports/ExpenseSummary';
import IncomeSummary from './pages/reports/IncomeSummary';
import IncomeVsExpense from './pages/reports/IncomeVsExpense';
import ProfitLoss from './pages/reports/ProfitLoss';
import ProductQuantitySold from './pages/reports/ProductQuantitySold';
import CustomerSalesReport from './pages/reports/CustomerSalesReport';
import UserActivityPerformanceReport from './pages/reports/UserActivityPerformanceReport';
import PrintOrder from './pages/PrintOrder';
import PrintBill from './pages/PrintBill';
import WalletPage from './pages/Wallet';
import { hasAdminAccess } from './types';
import { useRolePermissions } from './src/hooks/useRolePermissions';
import StartupScreen from './components/StartupScreen';

// Inner app component that uses auth context
const AppRouter: React.FC<{ user: any; profile: any }> = ({ user, profile }) => {
  // Check authentication state - only require user since profile is GUARANTEED to exist when user exists
  // Profile is always loaded along with user by AuthProvider, never null during normal operation
  const isAuthenticated = !!user;
  const activeUser = profile || user;
  const isAdmin = hasAdminAccess(activeUser?.role);
  const { can, canAny, canViewAdminDashboard, canViewEmployeeDashboard } = useRolePermissions();
  const writeFreezeEnabled = WRITE_FREEZE_ENABLED;
  const canViewDashboard = canViewAdminDashboard || canViewEmployeeDashboard;
  const defaultProtectedRoute = canViewDashboard
    ? '/dashboard'
    : can('orders.view')
      ? '/orders'
      : can('customers.view')
        ? '/customers'
        : can('products.view')
          ? '/products'
          : can('bills.view')
            ? '/bills'
            : can('vendors.view')
              ? '/vendors'
              : can('transactions.view')
                ? '/banking/transactions'
                : can('accounts.view')
                  ? '/banking/accounts'
                  : can('transfers.create')
                    ? '/banking/transfer'
                    : can('wallet.view')
                      ? '/wallet'
                      : can('reports.view')
                        ? '/reports'
                        : can('recycleBin.view')
                          ? '/recycle-bin'
          : can('users.view')
            ? '/users'
            : isAdmin
              ? '/settings'
              : '/dashboard';
  
  return (
    <Routes>
      {/* Public login route - redirect to dashboard if logged in */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to={defaultProtectedRoute} replace /> : <Login />
      } />

      {/* Protected routes - require authenticated user (profile guaranteed) */}
      <Route path="/" element={
        isAuthenticated ? <Navigate to={defaultProtectedRoute} replace /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/dashboard" element={
        isAuthenticated ? (canViewDashboard ? <Layout><Dashboard /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      
      <Route path="/orders" element={
        isAuthenticated ? (can('orders.view') ? <Layout><Orders /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/orders/new" element={
        isAuthenticated ? (can('orders.create') ? (writeFreezeEnabled ? <Navigate to="/orders" replace /> : <Layout><OrderForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/orders/edit/:id" element={
        isAuthenticated ? (canAny(['orders.editOwn', 'orders.editAny']) ? (writeFreezeEnabled ? <Navigate to="/orders" replace /> : <Layout><OrderForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/orders/:id" element={
        isAuthenticated ? (can('orders.view') ? <Layout><OrderDetails /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/print-order/:id" element={
        isAuthenticated ? (can('orders.view') ? <PrintOrder /> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      
      <Route path="/bills" element={
        isAuthenticated ? (can('bills.view') ? <Layout><Bills /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/bills/new" element={
        isAuthenticated ? (can('bills.create') ? (writeFreezeEnabled ? <Navigate to="/bills" replace /> : <Layout><BillForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/bills/edit/:id" element={
        isAuthenticated ? (canAny(['bills.editOwn', 'bills.editAny']) ? (writeFreezeEnabled ? <Navigate to="/bills" replace /> : <Layout><BillForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/bills/:id" element={
        isAuthenticated ? (can('bills.view') ? <Layout><BillDetails /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/print-bill/:id" element={
        isAuthenticated ? (can('bills.view') ? <PrintBill /> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      <Route path="/banking/accounts" element={
        isAuthenticated ? (can('accounts.view') ? <Layout><Banking /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/banking/transfer" element={
        isAuthenticated ? (can('transfers.create') ? <Layout><Transfer /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/banking/transactions" element={
        isAuthenticated ? (can('transactions.view') ? <Layout><Transactions /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      
      <Route path="/transactions" element={
        isAuthenticated ? (can('transactions.view') ? <Navigate to="/banking/transactions" replace /> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/transactions/new/:type" element={
        isAuthenticated ? (can('transactions.create') ? (writeFreezeEnabled ? <Navigate to="/banking/transactions" replace /> : <Layout><TransactionForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/transactions/edit/:id" element={
        isAuthenticated ? (can('transactions.edit') ? (writeFreezeEnabled ? <Navigate to="/banking/transactions" replace /> : <Layout><TransactionForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      <Route path="/customers" element={
        isAuthenticated ? (can('customers.view') ? <Layout><Customers /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/customers/new" element={
        isAuthenticated ? (can('customers.create') ? (writeFreezeEnabled ? <Navigate to="/customers" replace /> : <Layout><CustomerForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/customers/edit/:id" element={
        isAuthenticated ? (can('customers.edit') ? (writeFreezeEnabled ? <Navigate to="/customers" replace /> : <Layout><CustomerForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/customers/:id" element={
        isAuthenticated ? (can('customers.view') ? <Layout><CustomerDetails /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      
      <Route path="/vendors" element={
        isAuthenticated ? (can('vendors.view') ? <Layout><Vendors /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/new" element={
        isAuthenticated ? (can('vendors.create') ? (writeFreezeEnabled ? <Navigate to="/vendors" replace /> : <Layout><VendorForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/edit/:id" element={
        isAuthenticated ? (can('vendors.edit') ? (writeFreezeEnabled ? <Navigate to="/vendors" replace /> : <Layout><VendorForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/:id" element={
        isAuthenticated ? (can('vendors.view') ? <Layout><VendorDetails /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      <Route path="/products" element={
        isAuthenticated ? (can('products.view') ? <Layout><Products /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/products/new" element={
        isAuthenticated ? (can('products.create') ? (writeFreezeEnabled ? <Navigate to="/products" replace /> : <Layout><ProductForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/products/edit/:id" element={
        isAuthenticated ? (can('products.edit') ? (writeFreezeEnabled ? <Navigate to="/products" replace /> : <Layout><ProductForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      <Route path="/users" element={
        isAuthenticated ? (can('users.view') ? <Layout><Users /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/users/new" element={
        isAuthenticated ? (can('users.view') ? (writeFreezeEnabled ? <Navigate to="/users" replace /> : <Layout><UserForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/users/edit/:id" element={
        isAuthenticated ? (can('users.view') ? (writeFreezeEnabled ? <Navigate to="/users" replace /> : <Layout><UserForm /></Layout>) : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/users/:id" element={
        isAuthenticated ? (can('users.view') ? <Layout><UserDetails /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      <Route path="/reports" element={
        isAuthenticated ? (can('reports.view') ? <Layout><Reports /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/payroll" element={
        isAuthenticated
          ? can('payroll.view')
            ? <Layout><Payroll /></Layout>
            : can('wallet.view')
              ? <Navigate to="/wallet" replace />
              : <Navigate to={defaultProtectedRoute} replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="/recycle-bin" element={
        isAuthenticated
          ? can('recycleBin.view')
            ? <Layout><RecycleBin /></Layout>
            : can('wallet.view')
              ? <Navigate to="/wallet" replace />
              : <Navigate to={defaultProtectedRoute} replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="/wallet" element={
        isAuthenticated
          ? can('wallet.view')
            ? <Layout><WalletPage /></Layout>
            : <Navigate to={defaultProtectedRoute} replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="/reports/expense" element={
        isAuthenticated ? (can('reports.view') ? <Layout><ExpenseSummary /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/reports/income" element={
        isAuthenticated ? (can('reports.view') ? <Layout><IncomeSummary /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/reports/income-vs-expense" element={
        isAuthenticated ? (can('reports.view') ? <Layout><IncomeVsExpense /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/reports/profit-loss" element={
        isAuthenticated ? (can('reports.view') ? <Layout><ProfitLoss /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/reports/product-quantity-sold" element={
        isAuthenticated ? (can('reports.view') ? <Layout><ProductQuantitySold /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/reports/customer-sales" element={
        isAuthenticated ? (can('reports.view') ? <Layout><CustomerSalesReport /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />
      <Route path="/reports/user-activity-performance" element={
        isAuthenticated ? (can('reports.view') ? <Layout><UserActivityPerformanceReport /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      <Route path="/settings" element={
        isAuthenticated ? (isAdmin ? <Layout><SettingsPage /></Layout> : <Navigate to={defaultProtectedRoute} replace />) : <Navigate to="/login" replace />
      } />

      {/* Catch all - redirect based on auth state */}
      <Route path="*" element={isAuthenticated ? <Navigate to={defaultProtectedRoute} replace /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

// App content component - safely uses auth context and passes to router
const AppContent: React.FC = () => {
  const { user, profile, startupStatus, startupError, retrySessionRestore, signOut } = useAuth();

  if (startupStatus === 'idle' || startupStatus === 'checking') {
    return <StartupScreen status={startupStatus} />;
  }

  if (startupStatus === 'timeout' || startupStatus === 'offline' || startupStatus === 'error') {
    return (
      <StartupScreen
        status={startupStatus}
        error={startupError}
        onRetry={retrySessionRestore}
        onBackToLogin={signOut}
      />
    );
  }

  return <AppRouter user={user} profile={profile} />;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NetworkProvider>
          <ToastProvider>
            <SearchProvider>
              <RealtimeProvider>
                <HashRouter>
                  <AppContent />
                  <NetworkStatusBanner />
                  <ToastContainer />
                </HashRouter>
              </RealtimeProvider>
            </SearchProvider>
          </ToastProvider>
        </NetworkProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
