import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { db, saveDb } from './db';
import { AuthProvider, useAuth } from './src/contexts/AuthProvider';
import { ToastProvider } from './src/contexts/ToastContext';
import { SearchProvider } from './src/contexts/SearchContext';
import { RealtimeProvider } from './src/contexts/RealtimeProvider';
import { NetworkProvider } from './src/contexts/NetworkProvider';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';
import NetworkStatusBanner from './components/NetworkStatusBanner';

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
import ExpenseSummary from './pages/reports/ExpenseSummary';
import IncomeSummary from './pages/reports/IncomeSummary';
import IncomeVsExpense from './pages/reports/IncomeVsExpense';
import ProfitLoss from './pages/reports/ProfitLoss';
import PrintOrder from './pages/PrintOrder';

// Inner app component that uses auth context
const AppRouter: React.FC<{ user: any; profile: any; isLoading: boolean }> = ({ user, profile, isLoading }) => {
  // Check authentication state - only require user since profile is GUARANTEED to exist when user exists
  // Profile is always loaded along with user by AuthProvider, never null during normal operation
  const isAuthenticated = !!user;
  
  return (
    <Routes>
      {/* Public login route - redirect to dashboard if logged in */}
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
      } />

      {/* Protected routes - require authenticated user (profile guaranteed) */}
      <Route path="/" element={
        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/dashboard" element={
        isAuthenticated ? <Layout><Dashboard /></Layout> : <Navigate to="/login" replace />
      } />
      
      <Route path="/orders" element={
        isAuthenticated ? <Layout><Orders /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/orders/new" element={
        isAuthenticated ? <Layout><OrderForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/orders/edit/:id" element={
        isAuthenticated ? <Layout><OrderForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/orders/:id" element={
        isAuthenticated ? <Layout><OrderDetails /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/print-order/:id" element={
        isAuthenticated ? <PrintOrder /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/bills" element={
        isAuthenticated ? <Layout><Bills /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/bills/new" element={
        isAuthenticated ? <Layout><BillForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/bills/edit/:id" element={
        isAuthenticated ? <Layout><BillForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/bills/:id" element={
        isAuthenticated ? <Layout><BillDetails /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/banking/accounts" element={
        isAuthenticated ? <Layout><Banking /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/banking/transfer" element={
        isAuthenticated ? <Layout><Transfer /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/banking/transactions" element={
        isAuthenticated ? <Layout><Transactions /></Layout> : <Navigate to="/login" replace />
      } />
      
      <Route path="/transactions" element={
        isAuthenticated ? <Navigate to="/banking/transactions" replace /> : <Navigate to="/login" replace />
      } />
      <Route path="/transactions/new/:type" element={
        isAuthenticated ? <Layout><TransactionForm /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/customers" element={
        isAuthenticated ? <Layout><Customers /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/customers/new" element={
        isAuthenticated ? <Layout><CustomerForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/customers/edit/:id" element={
        isAuthenticated ? <Layout><CustomerForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/customers/:id" element={
        isAuthenticated ? <Layout><CustomerDetails /></Layout> : <Navigate to="/login" replace />
      } />
      
      <Route path="/vendors" element={
        isAuthenticated ? <Layout><Vendors /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/new" element={
        isAuthenticated ? <Layout><VendorForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/edit/:id" element={
        isAuthenticated ? <Layout><VendorForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/:id" element={
        isAuthenticated ? <Layout><VendorDetails /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/products" element={
        isAuthenticated ? <Layout><Products /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/products/new" element={
        isAuthenticated ? <Layout><ProductForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/products/edit/:id" element={
        isAuthenticated ? <Layout><ProductForm /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/users" element={
        isAuthenticated ? <Layout><Users /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/users/new" element={
        isAuthenticated ? <Layout><UserForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/users/edit/:id" element={
        isAuthenticated ? <Layout><UserForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/users/:id" element={
        isAuthenticated ? <Layout><UserDetails /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/reports" element={
        isAuthenticated ? <Layout><Reports /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/expense" element={
        isAuthenticated ? <Layout><ExpenseSummary /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/income" element={
        isAuthenticated ? <Layout><IncomeSummary /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/income-vs-expense" element={
        isAuthenticated ? <Layout><IncomeVsExpense /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/profit-loss" element={
        isAuthenticated ? <Layout><ProfitLoss /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/settings" element={
        isAuthenticated ? <Layout><SettingsPage /></Layout> : <Navigate to="/login" replace />
      } />

      {/* Catch all - redirect based on auth state */}
      <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
    </Routes>
  );
};

// App content component - safely uses auth context and passes to router
const AppContent: React.FC = () => {
  const { user, profile, isLoading } = useAuth();
  
  console.log('[App] Render - user:', !!user, 'profile:', !!profile, 'isLoading:', isLoading);

  // Show loading screen during initial auth check or active loading
  if (isLoading) {
    console.log('[App] Rendering loading screen');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block p-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return <AppRouter user={user} profile={profile} isLoading={isLoading} />;
};

const App: React.FC = () => {
  console.log('[App] Root component rendering - setting up providers');
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
