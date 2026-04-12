import React, { Suspense, lazy } from 'react';
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
import { hasAdminAccess } from './types';
import { useRolePermissions } from './src/hooks/useRolePermissions';
import StartupScreen from './components/StartupScreen';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderForm = lazy(() => import('./pages/OrderForm'));
const OrderDetails = lazy(() => import('./pages/OrderDetails'));
const Bills = lazy(() => import('./pages/Bills'));
const BillForm = lazy(() => import('./pages/BillForm'));
const BillDetails = lazy(() => import('./pages/BillDetails'));
const Banking = lazy(() => import('./pages/Banking'));
const Transactions = lazy(() => import('./pages/Transactions'));
const TransactionForm = lazy(() => import('./pages/TransactionForm'));
const Transfer = lazy(() => import('./pages/Transfer'));
const Products = lazy(() => import('./pages/Products'));
const ProductForm = lazy(() => import('./pages/ProductForm'));
const Users = lazy(() => import('./pages/Users'));
const UserForm = lazy(() => import('./pages/UserForm'));
const UserDetails = lazy(() => import('./pages/UserDetails'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerForm = lazy(() => import('./pages/CustomerForm'));
const CustomerDetails = lazy(() => import('./pages/CustomerDetails'));
const Vendors = lazy(() => import('./pages/Vendors'));
const VendorForm = lazy(() => import('./pages/VendorForm'));
const VendorDetails = lazy(() => import('./pages/VendorDetails'));
const Reports = lazy(() => import('./pages/Reports'));
const Payroll = lazy(() => import('./pages/Payroll'));
const RecycleBin = lazy(() => import('./pages/RecycleBin'));
const ExpenseSummary = lazy(() => import('./pages/reports/ExpenseSummary'));
const IncomeSummary = lazy(() => import('./pages/reports/IncomeSummary'));
const IncomeVsExpense = lazy(() => import('./pages/reports/IncomeVsExpense'));
const ProfitLoss = lazy(() => import('./pages/reports/ProfitLoss'));
const ProductQuantitySold = lazy(() => import('./pages/reports/ProductQuantitySold'));
const CustomerSalesReport = lazy(() => import('./pages/reports/CustomerSalesReport'));
const UserActivityPerformanceReport = lazy(() => import('./pages/reports/UserActivityPerformanceReport'));
const PrintOrder = lazy(() => import('./pages/PrintOrder'));
const PrintBill = lazy(() => import('./pages/PrintBill'));
const WalletPage = lazy(() => import('./pages/Wallet'));

const RouteFallback: React.FC = () => (
  <div className="min-h-[40vh] flex items-center justify-center px-6 py-12 text-center text-sm font-medium text-gray-500">
    Loading page...
  </div>
);

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
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
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
