
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { db, saveDb } from './db';
import { AuthProvider, useAuth } from './src/contexts/AuthProvider';
import { ToastProvider } from './src/contexts/ToastContext';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';

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
  // Check authentication state - require user AND profile for full access
  // If user exists but profile is null, still show protected content (profile might be loading)
  const isAuthenticatedWithProfile = user && profile;
  
  return (
    <Routes>
      {/* Public login route - redirect to dashboard if logged in with profile */}
      <Route path="/login" element={
        isAuthenticatedWithProfile ? <Navigate to="/dashboard" replace /> : <Login />
      } />
      
      {/* Protected routes - require authentication */}
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/dashboard" element={
        user ? <Layout><Dashboard /></Layout> : <Navigate to="/login" replace />
      } />
      
      <Route path="/orders" element={
        user ? <Layout><Orders /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/orders/new" element={
        user ? <Layout><OrderForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/orders/edit/:id" element={
        user ? <Layout><OrderForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/orders/:id" element={
        user ? <Layout><OrderDetails /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/print-order/:id" element={
        user ? <PrintOrder /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/bills" element={
        user ? <Layout><Bills /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/bills/new" element={
        user ? <Layout><BillForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/bills/edit/:id" element={
        user ? <Layout><BillForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/bills/:id" element={
        user ? <Layout><BillDetails /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/banking/accounts" element={
        user ? <Layout><Banking /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/banking/transfer" element={
        user ? <Layout><Transfer /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/banking/transactions" element={
        user ? <Layout><Transactions /></Layout> : <Navigate to="/login" replace />
      } />
      
      <Route path="/transactions" element={
        user ? <Navigate to="/banking/transactions" replace /> : <Navigate to="/login" replace />
      } />
      <Route path="/transactions/new/:type" element={
        user ? <Layout><TransactionForm /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/customers" element={
        user ? <Layout><Customers /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/customers/new" element={
        user ? <Layout><CustomerForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/customers/edit/:id" element={
        user ? <Layout><CustomerForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/customers/:id" element={
        user ? <Layout><CustomerDetails /></Layout> : <Navigate to="/login" replace />
      } />
      
      <Route path="/vendors" element={
        user ? <Layout><Vendors /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/new" element={
        user ? <Layout><VendorForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/edit/:id" element={
        user ? <Layout><VendorForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/vendors/:id" element={
        user ? <Layout><VendorDetails /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/products" element={
        user ? <Layout><Products /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/products/new" element={
        user ? <Layout><ProductForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/products/edit/:id" element={
        user ? <Layout><ProductForm /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/users" element={
        user ? <Layout><Users /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/users/new" element={
        user ? <Layout><UserForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/users/edit/:id" element={
        user ? <Layout><UserForm /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/users/:id" element={
        user ? <Layout><UserDetails /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/reports" element={
        user ? <Layout><Reports /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/expense" element={
        user ? <Layout><ExpenseSummary /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/income" element={
        user ? <Layout><IncomeSummary /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/income-vs-expense" element={
        user ? <Layout><IncomeVsExpense /></Layout> : <Navigate to="/login" replace />
      } />
      <Route path="/reports/profit-loss" element={
        user ? <Layout><ProfitLoss /></Layout> : <Navigate to="/login" replace />
      } />

      <Route path="/settings" element={
        user ? <Layout><SettingsPage /></Layout> : <Navigate to="/login" replace />
      } />

      {/* Catch all - redirect based on auth state */}
      <Route path="*" element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
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
        <ToastProvider>
          <HashRouter>
            <AppContent />
            <ToastContainer />
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
