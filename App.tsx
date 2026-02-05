
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
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

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/orders/edit/:id" element={<OrderForm />} />
          <Route path="/orders/:id" element={<OrderDetails />} />
          
          <Route path="/bills" element={<Bills />} />
          <Route path="/bills/new" element={<BillForm />} />
          <Route path="/bills/edit/:id" element={<BillForm />} />
          <Route path="/bills/:id" element={<BillDetails />} />

          <Route path="/banking/accounts" element={<Banking />} />
          <Route path="/banking/transfer" element={<Transfer />} />
          <Route path="/banking/transactions" element={<Transactions />} />
          
          <Route path="/transactions" element={<Navigate to="/banking/transactions" replace />} />
          <Route path="/transactions/new/:type" element={<TransactionForm />} />

          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/new" element={<CustomerForm />} />
          <Route path="/customers/edit/:id" element={<CustomerForm />} />
          <Route path="/customers/:id" element={<CustomerDetails />} />
          
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/vendors/new" element={<VendorForm />} />
          <Route path="/vendors/edit/:id" element={<VendorForm />} />
          <Route path="/vendors/:id" element={<VendorDetails />} />

          <Route path="/products" element={<Products />} />
          <Route path="/products/new" element={<ProductForm />} />
          <Route path="/products/edit/:id" element={<ProductForm />} />

          <Route path="/users" element={<Users />} />
          <Route path="/users/new" element={<UserForm />} />
          <Route path="/users/edit/:id" element={<UserForm />} />
          <Route path="/users/:id" element={<UserDetails />} />

          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/expense" element={<ExpenseSummary />} />
          <Route path="/reports/income" element={<IncomeSummary />} />
          <Route path="/reports/income-vs-expense" element={<IncomeVsExpense />} />
          <Route path="/reports/profit-loss" element={<ProfitLoss />} />

          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<div className="p-8 text-center text-gray-500">Feature coming soon in this demo!</div>} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
