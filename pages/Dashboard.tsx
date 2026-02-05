
import React, { useState, useMemo } from 'react';
import { db } from '../db';
import { UserRole, OrderStatus } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, ComposedChart 
} from 'recharts';

const StatBox: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
    <div className={`p-4 rounded-xl ${color}`}>
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</p>
      <h3 className="text-2xl font-black mt-1 text-gray-900">{value}</h3>
    </div>
  </div>
);

type FilterRange = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom';

const Dashboard: React.FC = () => {
  const user = db.currentUser;
  const isAdmin = user.role === UserRole.ADMIN;
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });

  const isWithinRange = (dateStr: string) => {
    if (filterRange === 'All Time') return true;
    const date = new Date(dateStr);
    const now = new Date();
    
    if (filterRange === 'Today') {
      return date.toDateString() === now.toDateString();
    }
    if (filterRange === 'This Week') {
      const first = now.getDate() - now.getDay();
      const last = first + 6;
      const firstDay = new Date(now.setDate(first));
      const lastDay = new Date(now.setDate(last));
      return date >= firstDay && date <= lastDay;
    }
    if (filterRange === 'This Month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (filterRange === 'This Year') {
      return date.getFullYear() === now.getFullYear();
    }
    if (filterRange === 'Custom') {
      if (!customDates.from || !customDates.to) return true;
      return date >= new Date(customDates.from) && date <= new Date(customDates.to);
    }
    return true;
  };

  const filteredOrders = useMemo(() => db.orders.filter(o => isWithinRange(o.orderDate)), [filterRange, customDates]);
  const filteredBills = useMemo(() => db.bills.filter(b => isWithinRange(b.billDate)), [filterRange, customDates]);
  const filteredTransactions = useMemo(() => db.transactions.filter(t => isWithinRange(t.date)), [filterRange, customDates]);

  // --- ADMIN CALCULATIONS ---
  const totalSales = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalPurchases = filteredBills.reduce((sum, b) => sum + b.total, 0);
  const otherExpenses = filteredTransactions
    .filter(t => t.type === 'Expense' && t.category !== 'Purchases')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalProfit = totalSales - totalPurchases - otherExpenses;

  const orderCounts = {
    total: filteredOrders.length,
    processing: filteredOrders.filter(o => o.status === OrderStatus.PROCESSING).length,
    picked: filteredOrders.filter(o => o.status === OrderStatus.PICKED).length,
    completed: filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).length,
  };

  const totalReceivables = filteredOrders.reduce((sum, o) => sum + (o.total - o.paidAmount), 0);
  const totalPayables = filteredBills.reduce((sum, b) => sum + (b.total - b.paidAmount), 0);

  // --- EMPLOYEE CALCULATIONS ---
  const myTotalCreated = filteredOrders.filter(o => o.createdBy === user.name).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const myCreatedToday = filteredOrders.filter(o => o.createdBy === user.name && o.orderDate === todayStr).length;
  const myPendingOrders = filteredOrders.filter(o => o.createdBy === user.name && o.status === OrderStatus.ON_HOLD).length;

  // --- CHART DATA ---
  const cashFlowData = [
    { name: 'Jan', income: 45000, expense: 32000, profit: 13000 },
    { name: 'Feb', income: 52000, expense: 28000, profit: 24000 },
    { name: 'Mar', income: 38000, expense: 45000, profit: -7000 },
    { name: 'Apr', income: 61000, expense: 39000, profit: 22000 },
    { name: 'May', income: 55000, expense: 41000, profit: 14000 },
    { name: 'Jun', income: 72000, expense: 50000, profit: 22000 },
  ];

  const expenseByCategory = [
    { name: 'Purchases', value: totalPurchases || 1, color: '#10B981' },
    { name: 'Rent', value: 15000, color: '#3B82F6' },
    { name: 'Utilities', value: 8000, color: '#F59E0B' },
    { name: 'Marketing', value: 12000, color: '#EF4444' },
    { name: 'Salaries', value: 45000, color: '#8B5CF6' },
  ];

  const employeePerformanceData = db.users.map(u => ({
    name: u.name.split(' ')[0],
    orders: db.orders.filter(o => o.createdBy === u.name).length
  })).sort((a, b) => b.orders - a.orders);

  const FilterBar = () => (
    <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm mb-6">
      {(['All Time', 'Today', 'This Week', 'This Month', 'This Year', 'Custom'] as FilterRange[]).map(range => (
        <button
          key={range}
          onClick={() => setFilterRange(range)}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            filterRange === range 
              ? 'bg-emerald-600 text-white shadow-md' 
              : 'text-gray-500 hover:bg-gray-50'
          }`}
        >
          {range}
        </button>
      ))}
      {filterRange === 'Custom' && (
        <div className="flex items-center gap-2 ml-auto">
          <input 
            type="date" 
            value={customDates.from} 
            onChange={e => setCustomDates({...customDates, from: e.target.value})}
            className="px-3 py-1.5 border rounded-lg text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500" 
          />
          <span className="text-gray-300 text-xs font-bold uppercase">To</span>
          <input 
            type="date" 
            value={customDates.to} 
            onChange={e => setCustomDates({...customDates, to: e.target.value})}
            className="px-3 py-1.5 border rounded-lg text-xs font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500" 
          />
        </div>
      )}
    </div>
  );

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Admin Dashboard</h2>
          <div className="text-sm font-bold text-gray-500 uppercase bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm">
            Overview • {new Date().toLocaleDateString('en-BD', { month: 'long', year: 'numeric' })}
          </div>
        </div>

        <FilterBar />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatBox title="Total Sales" value={formatCurrency(totalSales)} icon={ICONS.Sales} color="bg-emerald-50 text-emerald-600" />
          <StatBox title="Total Purchases" value={formatCurrency(totalPurchases)} icon={ICONS.Briefcase} color="bg-blue-50 text-blue-600" />
          <StatBox title="Other Expenses" value={formatCurrency(otherExpenses)} icon={ICONS.Delete} color="bg-red-50 text-red-600" />
          <StatBox title="Total Profit" value={formatCurrency(totalProfit)} icon={ICONS.Reports} color="bg-purple-50 text-purple-600" />
          
          <StatBox title="Total Orders" value={orderCounts.total} icon={ICONS.Dashboard} color="bg-indigo-50 text-indigo-600" />
          <StatBox title="Processing Orders" value={orderCounts.processing} icon={ICONS.More} color="bg-yellow-50 text-yellow-600" />
          <StatBox title="Picked Orders" value={orderCounts.picked} icon={ICONS.Courier} color="bg-sky-50 text-sky-600" />
          <StatBox title="Completed Orders" value={orderCounts.completed} icon={ICONS.PlusCircle} color="bg-teal-50 text-teal-600" />
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Cash Flow Analysis</h3>
              <p className="text-sm text-gray-400">Monthly breakdown of income vs expenses</p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-xs font-bold text-gray-500 uppercase">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-xs font-bold text-gray-500 uppercase">Expense</span>
              </div>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} barSize={40} />
                <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Receivables</p>
              <h4 className="text-4xl font-black text-gray-900">{formatCurrency(totalReceivables)}</h4>
              <p className="text-xs text-emerald-600 font-bold">Unpaid Customer Invoices</p>
            </div>
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">{ICONS.Sales}</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Payables</p>
              <h4 className="text-4xl font-black text-gray-900">{formatCurrency(totalPayables)}</h4>
              <p className="text-xs text-red-600 font-bold">Outstanding Vendor Bills</p>
            </div>
            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-600">{ICONS.Briefcase}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900">Profit & Loss Summary</h3>
              <button className="text-emerald-600 font-bold text-sm hover:underline">View Statement</button>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                <span className="font-bold text-gray-600">Operating Income</span>
                <span className="font-black text-emerald-600">{formatCurrency(totalSales)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
                <span className="font-bold text-gray-600">Total Expenses</span>
                <span className="font-black text-red-600">{formatCurrency(totalPurchases + otherExpenses)}</span>
              </div>
              <div className="flex justify-between items-center p-6 bg-emerald-600 rounded-3xl shadow-xl shadow-emerald-100 text-white">
                <span className="text-lg font-black uppercase tracking-widest">Net Profit</span>
                <span className="text-3xl font-black">{formatCurrency(totalProfit)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-8">Expenses by Category</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseByCategory} innerRadius={80} outerRadius={100} paddingAngle={5} dataKey="value">
                    {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="middle" align="right" layout="vertical" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Staff Workspace</h2>
        <div className="px-4 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg shadow-emerald-200">Current Session</div>
      </div>

      <FilterBar />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatBox title="Total Created" value={myTotalCreated} icon={ICONS.Sales} color="bg-emerald-50 text-emerald-600" />
        <StatBox title="Created Today" value={myCreatedToday} icon={ICONS.Dashboard} color="bg-blue-50 text-blue-600" />
        <StatBox title="Pending (Hold)" value={myPendingOrders} icon={ICONS.More} color="bg-yellow-50 text-yellow-600" />
      </div>

      <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900">Team Performance</h3>
          <p className="text-sm text-gray-400">Comparing total orders across all employees</p>
        </div>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={employeePerformanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="orders" fill="#10B981" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
