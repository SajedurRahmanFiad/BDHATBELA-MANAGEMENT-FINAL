
import React, { useState, useMemo, useEffect } from 'react';
import { UserRole, OrderStatus, Order, Bill, Transaction } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { theme } from '../theme';
import { StatCard } from '../components/Card';
import { FilterBar, LoadingOverlay } from '../components';
import { isWithinDateRange, FilterRange } from '../utils';
import { useAuth } from '../src/contexts/AuthProvider';
import { 
  useOrders, useBills, useTransactions, useUsers, useCategories
} from '../src/hooks/useQueries';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend, ComposedChart 
} from 'recharts';

const Dashboard: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Wait for auth to load
  if (authLoading) {
    return <div className="p-8 text-center text-gray-500">Loading session...</div>;
  }

  // Safety check - should have auth user by this point
  if (!user) {
    return <div className="p-8 text-center text-gray-500">Not Authenticated</div>;
  }
  
  const isAdmin = user.role === UserRole.ADMIN;
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  
  // Real-time data from React Query
  const { data: orders = [], isPending: ordersLoading } = useOrders();
  const { data: bills = [], isPending: billsLoading } = useBills();
  const { data: transactions = [], isPending: transactionsLoading } = useTransactions();
  const { data: dashUsers = [], isPending: usersLoading } = useUsers();
  const { data: allCategories = [] } = useCategories();
  
  const loading = ordersLoading || billsLoading || transactionsLoading || usersLoading;

  const filteredOrders = useMemo(() => orders.filter(o => isWithinDateRange(o.orderDate, filterRange, customDates)), [orders, filterRange, customDates]);
  const filteredBills = useMemo(() => bills.filter(b => isWithinDateRange(b.billDate, filterRange, customDates)), [bills, filterRange, customDates]);
  const filteredTransactions = useMemo(() => transactions.filter(t => isWithinDateRange(t.date, filterRange, customDates)), [transactions, filterRange, customDates]);

  // --- ADMIN CALCULATIONS ---
  // Prefer transaction-based metrics. Fallback to orders/bills if transactions missing.
  const salesFromTransactions = filteredTransactions
    .filter(t => t.type === 'Income' && !!t.referenceId)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalSales = salesFromTransactions > 0
    ? salesFromTransactions
    : filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).reduce((sum, o) => sum + o.total, 0);

  const purchasesFromTransactions = filteredTransactions
    .filter(t => t.type === 'Expense' && t.category === 'expense_purchases')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalPurchases = purchasesFromTransactions > 0
    ? purchasesFromTransactions
    : filteredBills.reduce((sum, b) => sum + b.total, 0);

  const otherExpenses = filteredTransactions
    .filter(t => t.type === 'Expense' && t.category !== 'expense_purchases')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalProfit = totalSales - totalPurchases - otherExpenses;

  const orderCounts = {
    total: filteredOrders.length,
    processing: filteredOrders.filter(o => o.status === OrderStatus.PROCESSING).length,
    picked: filteredOrders.filter(o => o.status === OrderStatus.PICKED).length,
    completed: filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).length,
    cancelled: filteredOrders.filter(o => o.status === OrderStatus.CANCELLED).length,
  };

  // Calculate total amounts for each order status
  const orderTotals = {
    total: filteredOrders.reduce((sum, o) => sum + o.total, 0),
    processing: filteredOrders.filter(o => o.status === OrderStatus.PROCESSING).reduce((sum, o) => sum + o.total, 0),
    picked: filteredOrders.filter(o => o.status === OrderStatus.PICKED).reduce((sum, o) => sum + o.total, 0),
    completed: filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).reduce((sum, o) => sum + o.total, 0),
    cancelled: filteredOrders.filter(o => o.status === OrderStatus.CANCELLED).reduce((sum, o) => sum + o.total, 0),
  };

  const totalReceivables = filteredOrders.reduce((sum, o) => sum + (o.total - o.paidAmount), 0);
  const totalPayables = filteredBills.reduce((sum, b) => sum + (b.total - b.paidAmount), 0);

  // additional metrics
  const averageOrderValue = orderCounts.completed > 0
    ? totalSales / orderCounts.completed
    : 0;

  // --- EMPLOYEE CALCULATIONS ---
  // For employees the top FilterBar should not affect stat cards — use unfiltered `orders` for stats
  const myTotalCreated = orders.filter(o => o.createdBy === user.id).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const myCreatedToday = orders.filter(o => o.createdBy === user.id && o.orderDate === todayStr).length;
  const myPendingOrders = orders.filter(o => o.createdBy === user.id && o.status === OrderStatus.ON_HOLD).length;

  // --- CHART DATA ---
  // Calculate cash flow by month from UNFILTERED real data (not affected by FilterBar)
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    // Initialize structure to aggregate data by month
    const aggregatedData: Record<string, { income: number; expense: number }> = {};
    months.forEach(m => {
      aggregatedData[m] = { income: 0, expense: 0 };
    });

    // Aggregate month data primarily from transactions (income & expense)
    transactions.forEach(txn => {
      const txnDate = new Date(txn.date);
      if (txnDate.getFullYear() !== currentYear) return;
      const monthIndex = txnDate.getMonth();
      const monthName = months[monthIndex];
      if (txn.type === 'Income') {
        aggregatedData[monthName].income += txn.amount;
      } else if (txn.type === 'Expense') {
        aggregatedData[monthName].expense += txn.amount;
      }
    });

    // Convert to chart format
    return months.map(name => ({
      name,
      income: aggregatedData[name].income,
      expense: -aggregatedData[name].expense, // Negative for visualization
      profit: aggregatedData[name].income - aggregatedData[name].expense
    }));
  }, [orders, bills, transactions]);

  // Calculate expenses by category from real data
  const expenseByCategory = useMemo(() => {
    // Create map for category ID -> name lookup
    const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));
    
    const expenseMap: Record<string, number> = {};
    const colorMap: Record<string, string> = {};
    
    // Define color palette for categories
    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    let colorIndex = 0;

    // Add purchases from Bills
    if (totalPurchases > 0) {
      expenseMap['Purchases'] = totalPurchases;
      colorMap['Purchases'] = colors[colorIndex++];
    }

    // Add expenses from Transactions by category
    const expenseTransactions = filteredTransactions.filter(
      t => t.type === 'Expense' && t.category !== 'expense_purchases'
    );

    expenseTransactions.forEach(transaction => {
      // Look up category name from ID, fallback to 'Uncategorized'
      const categoryName = categoryMap.get(transaction.category) || transaction.category || 'Uncategorized';
      expenseMap[categoryName] = (expenseMap[categoryName] || 0) + transaction.amount;
      if (!colorMap[categoryName]) {
        colorMap[categoryName] = colors[colorIndex % colors.length];
        colorIndex++;
      }
    });

    // Convert to chart format, ensuring we always have data
    const data = Object.entries(expenseMap).map(([name, value]) => ({
      name,
      value: Math.max(value, 1), // Ensure at least 1 to show in pie chart
      color: colorMap[name]
    }));

    // If no data, show placeholder
    return data.length > 0 ? data : [{ name: 'No Data', value: 1, color: '#D1D5DB' }];
  }, [filteredTransactions, totalPurchases, allCategories]);

  // The performance chart should respect the current filter
  const employeePerformanceData = dashUsers.map(u => ({
    name: u.name.split(' ')[0],
    orders: filteredOrders.filter(o => o.createdBy === u.id).length
  })).sort((a, b) => b.orders - a.orders);

  if (isAdmin) {
    return (
      <div className="space-y-6">
        <LoadingOverlay isLoading={loading} message= "Loading dashboard data..." />
        <FilterBar 
          filterRange={filterRange}
          setFilterRange={setFilterRange}
          customDates={customDates}
          setCustomDates={setCustomDates}
        />

        {/* first row: financial metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard title="Total Sales" value={formatCurrency(totalSales)} icon={ICONS.Sales} bgColor="bg-blue-600" textColor="text-white" iconBgColor="bg-blue-700" />
          <StatCard title="Total Purchases" value={formatCurrency(totalPurchases)} icon={ICONS.Briefcase} bgColor="bg-purple-600" textColor="text-white" iconBgColor="bg-purple-700" />
          <StatCard title="Other Expenses" value={formatCurrency(otherExpenses)} icon={ICONS.Delete} bgColor="bg-amber-500" textColor="text-white" iconBgColor="bg-amber-600" />
          <StatCard title="Total Profit" value={formatCurrency(totalProfit)} icon={ICONS.Reports} isProfitCard={true} profitValue={totalProfit} />
          <StatCard title="Avg Order Value" value={formatCurrency(averageOrderValue)} icon={ICONS.Banking} bgColor="bg-green-600" textColor="text-white" iconBgColor="bg-green-700" />
        </div>

        {/* second row: order status breakdown including cancelled */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mt-6">
          <StatCard title="Total Orders" value={orderCounts.total} icon={ICONS.Dashboard} bgColor="bg-indigo-700" textColor="text-white" iconBgColor="bg-indigo-800" subtotalAmount={formatCurrency(orderTotals.total)} />
          <StatCard title="Processing Orders" value={orderCounts.processing} icon={ICONS.More} bgColor="bg-sky-500" textColor="text-white" iconBgColor="bg-sky-600" subtotalAmount={formatCurrency(orderTotals.processing)} />
          <StatCard title="Picked Orders" value={orderCounts.picked} icon={ICONS.Courier} bgColor="bg-cyan-500" textColor="text-white" iconBgColor="bg-cyan-600" subtotalAmount={formatCurrency(orderTotals.picked)} />
          <StatCard title="Completed Orders" value={orderCounts.completed} icon={ICONS.PlusCircle} bgColor="bg-teal-600" textColor="text-white" iconBgColor="bg-teal-700" subtotalAmount={formatCurrency(orderTotals.completed)} />
          <StatCard title="Cancelled Orders" value={orderCounts.cancelled} icon={ICONS.AlertCircle} bgColor="bg-red-500" textColor="text-white" iconBgColor="bg-red-600" subtotalAmount={formatCurrency(orderTotals.cancelled)} />
        </div>

        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Cash Flow</h3>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#059669]"></div>
                <span className="text-xs font-bold text-gray-500 uppercase">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-xs font-bold text-gray-500 uppercase">Expense</span>
              </div>
            </div>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              {isMobile ? (
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                  <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} />
                </ComposedChart>
              ) : (
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                  <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-gray-900">Profit & Loss Summary</h3>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 border border-gray-100 rounded-lg">
                <span className="font-bold text-gray-600 text-sm">Total Incomes</span>
                <span className="font-black text-gray-900 text-sm">{formatCurrency(totalSales)}</span>
              </div>
              <div className="flex justify-between items-center p-4 border border-gray-100 rounded-lg">
                <span className="font-bold text-gray-600 text-sm">Total Expenses</span>
                <span className="font-black text-gray-900 text-sm">{formatCurrency(totalPurchases + otherExpenses)}</span>
              </div>
              <div
                className={`flex justify-between items-center p-6 rounded-xl shadow-xl text-white
                  ${totalProfit >= 0
                    ? 'bg-emerald-600 shadow-emerald-600/20'
                    : 'bg-red-600 shadow-red-600/20'}
                `}
              >
                <span className="font-black uppercase tracking-widest text-sm">
                  Net Profit
                </span>

                <span
                  className={`font-black text-sm`}>
                  {formatCurrency(totalProfit)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="text-xl font-bold text-gray-900 mb-8">Expenses by Category</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseByCategory} innerRadius={0} outerRadius={100} dataKey="value">
                    {expenseByCategory.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                  {isMobile ? (
                    <Legend verticalAlign="bottom" align="center" layout="horizontal" wrapperStyle={{ paddingTop: '20px' }} />
                  ) : (
                    <Legend verticalAlign="middle" align="right" layout="vertical" />
                  )}
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
      <FilterBar 
        filterRange={filterRange}
        setFilterRange={setFilterRange}
        customDates={customDates}
        setCustomDates={setCustomDates}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Created" value={myTotalCreated} icon={ICONS.Sales} bgColor="bg-blue-600" textColor="text-white" iconBgColor="bg-blue-700" />
        <StatCard title="Created Today" value={myCreatedToday} icon={ICONS.Dashboard} bgColor="bg-teal-500" textColor="text-white" iconBgColor="bg-teal-600" />
        <StatCard title="Pending (Hold)" value={myPendingOrders} icon={ICONS.More} bgColor="bg-orange-500" textColor="text-white" iconBgColor="bg-orange-600" />
      </div>

      <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
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


