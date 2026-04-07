
import React, { useState, useMemo, useEffect } from 'react';
import { UserRole, OrderStatus, Order, isEmployeeRole } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { StatCard } from '../components/Card';
import { FilterBar, LoadingOverlay } from '../components';
import { getBillActivityDate, getOrderActivityDate, getTransactionActivityDate, isWithinDateRange, FilterRange } from '../utils';
import { useAuth } from '../src/contexts/AuthProvider';
import { 
  useOrders, useBills, useTransactions, useCategories, useUsers, useMyWallet
} from '../src/hooks/useQueries';
import { buildCustomerSalesRows, buildProductSalesRows } from '../src/utils/salesReportUtils';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Line, PieChart, Pie, Cell, Legend, ComposedChart 
} from 'recharts';

const roundDashboardValue = (value: number): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;
  return Math.round(numericValue);
};

const formatDashboardInteger = (value: number): string => {
  return roundDashboardValue(value).toLocaleString('en-BD');
};

const CASH_FLOW_LABELS: Record<string, string> = {
  income: 'Income',
  expense: 'Expense',
  profit: 'Profit',
};

const isSameLocalCalendarDay = (value: string | undefined, compareDate: Date = new Date()): boolean => {
  if (!value) return false;
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === compareDate.getFullYear() &&
    date.getMonth() === compareDate.getMonth() &&
    date.getDate() === compareDate.getDate()
  );
};

const EMPLOYEE_STATUS_STYLES: Record<OrderStatus, { valueClass: string; barClass: string; trackClass: string }> = {
  [OrderStatus.ON_HOLD]: {
    valueClass: 'text-amber-500',
    barClass: 'bg-amber-500',
    trackClass: 'bg-amber-100',
  },
  [OrderStatus.PROCESSING]: {
    valueClass: 'text-sky-500',
    barClass: 'bg-sky-500',
    trackClass: 'bg-sky-100',
  },
  [OrderStatus.PICKED]: {
    valueClass: 'text-cyan-500',
    barClass: 'bg-cyan-500',
    trackClass: 'bg-cyan-100',
  },
  [OrderStatus.COMPLETED]: {
    valueClass: 'text-emerald-500',
    barClass: 'bg-emerald-500',
    trackClass: 'bg-emerald-100',
  },
  [OrderStatus.CANCELLED]: {
    valueClass: 'text-rose-500',
    barClass: 'bg-rose-500',
    trackClass: 'bg-rose-100',
  },
};

const EmployeeSummaryCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  cardClassName: string;
  iconClassName: string;
}> = ({ title, value, icon, cardClassName, iconClassName }) => (
  <div className={`rounded-[12px] px-4 py-4 text-white shadow-[0_18px_40px_rgba(15,47,87,0.12)] ${cardClassName}`}>
    <div className="flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${iconClassName}`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/80">{title}</p>
        <p className="mt-1 text-lg font-black leading-none">{value}</p>
      </div>
    </div>
  </div>
);

const EmployeeStatusCard: React.FC<{
  title: string;
  value: number;
  total: number;
  valueClass: string;
  barClass: string;
  trackClass: string;
}> = ({ title, value, total, valueClass, barClass, trackClass }) => {
  const width = total > 0 && value > 0 ? Math.max((value / total) * 100, 8) : 0;

  return (
    <div className="rounded-[12px] border border-gray-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[16px] font-black text-gray-900">{title}</p>
        <p className={`text-lg font-black leading-none ${valueClass}`}>{value}</p>
      </div>
      <div className={`mt-5 h-3 overflow-hidden rounded-full ${trackClass}`}>
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

const EmployeeComparisonRow: React.FC<{
  name: string;
  role: string;
  orderCount: number;
  maxCount: number;
  isCurrentUser: boolean;
}> = ({ name, role, orderCount, maxCount, isCurrentUser }) => {
  const width = maxCount > 0 && orderCount > 0 ? Math.max((orderCount / maxCount) * 100, 8) : 0;

  return (
    <div className={`rounded-[12px] border px-4 py-4 shadow-sm ${isCurrentUser ? 'border-[#c7dff5] bg-[#f8fbff]' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-md font-black text-gray-900">{name}</p>
          <p className="mt-1 text-[10px] font-black uppercase text-gray-400">{role}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none text-[#0f172a]">{orderCount}</p>
          <p className="mt-1 text-[10px] font-black uppercase text-gray-400">Orders</p>
        </div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#e8edf5]">
        <div className="h-full rounded-full bg-[#94a3b8]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
};

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
  const { data: allCategories = [] } = useCategories();
  const { data: users = [] } = useUsers();
  const { data: myWallet, isPending: myWalletLoading } = useMyWallet(!isAdmin);
  const payrollSettings = { unitAmount: 0, countedStatuses: [] as OrderStatus[] };
  
  const loading = ordersLoading || billsLoading || transactionsLoading || (!isAdmin && myWalletLoading);

  const filteredOrders = useMemo(
    () => orders.filter((order) => isWithinDateRange(getOrderActivityDate(order), filterRange, customDates)),
    [orders, filterRange, customDates]
  );
  const filteredBills = useMemo(
    () => bills.filter((bill) => isWithinDateRange(getBillActivityDate(bill), filterRange, customDates)),
    [bills, filterRange, customDates]
  );
  const filteredTransactions = useMemo(
    () => transactions.filter((transaction) => isWithinDateRange(getTransactionActivityDate(transaction), filterRange, customDates)),
    [transactions, filterRange, customDates]
  );
  const filteredEmployeeComparisonOrders = useMemo(
    () => filteredOrders,
    [filteredOrders]
  );

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

  // counts for the stat cards. `total` is simply the number of orders
  // remaining after the date-range filter; it does **not** exclude any
  // statuses. thus the "Total Orders" card will display every order in the
  // selected window regardless of processing/completed/cancelled/etc.
  const orderCounts = {
    total: filteredOrders.length,
    onHold: filteredOrders.filter(o => o.status === OrderStatus.ON_HOLD).length,
    processing: filteredOrders.filter(o => o.status === OrderStatus.PROCESSING).length,
    picked: filteredOrders.filter(o => o.status === OrderStatus.PICKED).length,
    completed: filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).length,
    cancelled: filteredOrders.filter(o => o.status === OrderStatus.CANCELLED).length,
  };

  // Calculate total amounts for each order status
  const orderTotals = {
    total: filteredOrders.reduce((sum, o) => sum + o.total, 0),
    onHold: filteredOrders.filter(o => o.status === OrderStatus.ON_HOLD).reduce((sum, o) => sum + o.total, 0),
    processing: filteredOrders.filter(o => o.status === OrderStatus.PROCESSING).reduce((sum, o) => sum + o.total, 0),
    picked: filteredOrders.filter(o => o.status === OrderStatus.PICKED).reduce((sum, o) => sum + o.total, 0),
    completed: filteredOrders.filter(o => o.status === OrderStatus.COMPLETED).reduce((sum, o) => sum + o.total, 0),
    cancelled: filteredOrders.filter(o => o.status === OrderStatus.CANCELLED).reduce((sum, o) => sum + o.total, 0),
  };

  const totalReceivables = filteredOrders.reduce((sum, o) => sum + (o.total - o.paidAmount), 0);
  const totalPayables = filteredBills.reduce((sum, b) => sum + (b.total - b.paidAmount), 0);

  // --- EMPLOYEE CALCULATIONS ---
  const myOrders = useMemo(
    () => orders.filter((order) => order.createdBy === user.id),
    [orders, user.id]
  );
  const filteredMyOrders = useMemo(
    () => myOrders.filter((order) => isWithinDateRange(getOrderActivityDate(order), filterRange, customDates)),
    [myOrders, filterRange, customDates]
  );
  const myTotalCreated = myOrders.length;
  const myCreatedToday = myOrders.filter((order) => isSameLocalCalendarDay(getOrderActivityDate(order))).length;
  const myPendingOrders = myOrders.filter((order) => order.status === OrderStatus.ON_HOLD).length;
  const employeeStatusSnapshot = useMemo(() => ([
    {
      status: OrderStatus.ON_HOLD,
      label: 'On Hold',
      value: filteredMyOrders.filter((order) => order.status === OrderStatus.ON_HOLD).length,
    },
    {
      status: OrderStatus.PROCESSING,
      label: 'Processing',
      value: filteredMyOrders.filter((order) => order.status === OrderStatus.PROCESSING).length,
    },
    {
      status: OrderStatus.PICKED,
      label: 'Picked',
      value: filteredMyOrders.filter((order) => order.status === OrderStatus.PICKED).length,
    },
    {
      status: OrderStatus.COMPLETED,
      label: 'Completed',
      value: filteredMyOrders.filter((order) => order.status === OrderStatus.COMPLETED).length,
    },
    {
      status: OrderStatus.CANCELLED,
      label: 'Cancelled',
      value: filteredMyOrders.filter((order) => order.status === OrderStatus.CANCELLED).length,
    },
  ]), [filteredMyOrders]);
  const employeeUsers = useMemo(
    () => users.filter((candidate) => isEmployeeRole(candidate.role)),
    [users]
  );
  const countedPayrollStatuses = useMemo(() => {
    const selectedStatuses = payrollSettings.countedStatuses?.length
      ? payrollSettings.countedStatuses
      : [
          OrderStatus.ON_HOLD,
          OrderStatus.PROCESSING,
          OrderStatus.PICKED,
          OrderStatus.COMPLETED,
          OrderStatus.CANCELLED,
        ];

    return new Set(selectedStatuses);
  }, [payrollSettings.countedStatuses]);
  const filteredPayrollOrders = useMemo(
    () => filteredOrders.filter((order) => countedPayrollStatuses.has(order.status)),
    [countedPayrollStatuses, filteredOrders]
  );
  const employeeComparisonRows = useMemo(() => {
    const employeeIdSet = new Set(employeeUsers.map((candidate) => candidate.id));
    const counts = new Map<string, number>();

    filteredEmployeeComparisonOrders.forEach((order) => {
      if (!employeeIdSet.has(order.createdBy)) return;
      counts.set(order.createdBy, (counts.get(order.createdBy) || 0) + 1);
    });

    const knownRows = employeeUsers.map((candidate) => ({
      userId: candidate.id,
      name: candidate.name,
      role: candidate.role,
      orderCount: counts.get(candidate.id) || 0,
      isCurrentUser: candidate.id === user.id,
    }));

    const fallbackRows = Array.from(counts.entries())
      .filter(([userId]) => !employeeIdSet.has(userId))
      .map(([userId, orderCount]) => {
        const sampleOrder = filteredEmployeeComparisonOrders.find((order) => order.createdBy === userId);
        return {
          userId,
          name: sampleOrder?.creatorName || 'Unknown Employee',
          role: UserRole.EMPLOYEE,
          orderCount,
          isCurrentUser: userId === user.id,
        };
      });

    return [...knownRows, ...fallbackRows]
      .filter((row) => row.orderCount > 0 || row.isCurrentUser)
      .sort((left, right) => {
        if (right.orderCount !== left.orderCount) return right.orderCount - left.orderCount;
        if (left.isCurrentUser) return -1;
        if (right.isCurrentUser) return 1;
        return left.name.localeCompare(right.name);
      });
  }, [employeeUsers, filteredEmployeeComparisonOrders, user.id]);
  const employeeComparisonMax = useMemo(
    () => Math.max(0, ...employeeComparisonRows.map((row) => row.orderCount)),
    [employeeComparisonRows]
  );
  const dashboardPayrollRows = useMemo(() => {
    const employeeIdSet = new Set(employeeUsers.map((candidate) => candidate.id));
    const counts = new Map<string, number>();

    filteredPayrollOrders.forEach((order) => {
      if (!employeeIdSet.has(order.createdBy)) return;
      counts.set(order.createdBy, (counts.get(order.createdBy) || 0) + 1);
    });

    return employeeUsers.map((candidate) => {
      const countedOrders = counts.get(candidate.id) || 0;
      return {
        employeeId: candidate.id,
        employeeName: candidate.name,
        countedOrders,
        estimatedAmount: countedOrders * payrollSettings.unitAmount,
      };
    });
  }, [employeeUsers, filteredPayrollOrders, payrollSettings.unitAmount]);
  const adminEstimatedPayroll = useMemo(
    () => dashboardPayrollRows.reduce((sum, row) => sum + row.estimatedAmount, 0),
    [dashboardPayrollRows]
  );
  const adminEmployeesDue = useMemo(
    () => dashboardPayrollRows.filter((row) => row.countedOrders > 0).length,
    [dashboardPayrollRows]
  );
  const myPayrollOrders = useMemo(
    () => filteredMyOrders.filter((order) => countedPayrollStatuses.has(order.status)),
    [countedPayrollStatuses, filteredMyOrders]
  );
  const myEstimatedPayroll = useMemo(
    () => myPayrollOrders.length * payrollSettings.unitAmount,
    [myPayrollOrders, payrollSettings.unitAmount]
  );

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
      income: roundDashboardValue(aggregatedData[name].income),
      expense: -roundDashboardValue(aggregatedData[name].expense), // Negative for visualization
      profit: roundDashboardValue(aggregatedData[name].income - aggregatedData[name].expense)
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
      value: Math.max(roundDashboardValue(value), 1), // Ensure at least 1 to show in pie chart
      color: colorMap[name]
    }));

    // If no data, show placeholder
    return data.length > 0 ? data : [{ name: 'No Data', value: 1, color: '#D1D5DB' }];
  }, [filteredTransactions, totalPurchases, allCategories]);

  const topSoldProducts = useMemo(() => {
    return buildProductSalesRows(orders, filterRange, customDates).slice(0, 5).map((r) => ({ name: r.productName, qty: r.quantity }));
  }, [orders, filterRange, customDates]);

  const topCustomers = useMemo(() => {
    return buildCustomerSalesRows(orders, filterRange, customDates).slice(0, 5);
  }, [orders, filterRange, customDates]);

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

        <div className="space-y-6">
          {/* Stats: combined so they flow breaklessly on small screens */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
            <StatCard title="Total Sales" value={formatCurrency(totalSales)} icon={ICONS.Sales} bgColor="bg-blue-600" textColor="text-white" iconBgColor="bg-blue-700" />
            <StatCard title="Total Purchases" value={formatCurrency(totalPurchases)} icon={ICONS.Briefcase} bgColor="bg-purple-600" textColor="text-white" iconBgColor="bg-purple-700" />
            <StatCard title="Other Expenses" value={formatCurrency(otherExpenses)} icon={ICONS.Delete} bgColor="bg-amber-500" textColor="text-white" iconBgColor="bg-amber-600" />
            <StatCard title="Total Profit" value={formatCurrency(totalProfit)} icon={ICONS.Reports} isProfitCard={true} profitValue={totalProfit} />
            <StatCard title="Total Orders" value={orderCounts.total} icon={ICONS.Dashboard} bgColor="bg-indigo-700" textColor="text-white" iconBgColor="bg-indigo-800" subtotalAmount={formatCurrency(orderTotals.total)} />

            <StatCard title="On Hold Orders" value={orderCounts.onHold} icon={ICONS.More} bgColor="bg-orange-500" textColor="text-white" iconBgColor="bg-orange-600" subtotalAmount={formatCurrency(orderTotals.onHold)} />
            <StatCard title="Processing Orders" value={orderCounts.processing} icon={ICONS.More} bgColor="bg-sky-500" textColor="text-white" iconBgColor="bg-sky-600" subtotalAmount={formatCurrency(orderTotals.processing)} />
            <StatCard title="Picked Orders" value={orderCounts.picked} icon={ICONS.Courier} bgColor="bg-cyan-500" textColor="text-white" iconBgColor="bg-cyan-600" subtotalAmount={formatCurrency(orderTotals.picked)} />
            <StatCard title="Completed Orders" value={orderCounts.completed} icon={ICONS.PlusCircle} bgColor="bg-teal-600" textColor="text-white" iconBgColor="bg-teal-700" subtotalAmount={formatCurrency(orderTotals.completed)} />
            <StatCard title="Cancelled Orders" value={orderCounts.cancelled} icon={ICONS.AlertCircle} bgColor="bg-red-500" textColor="text-white" iconBgColor="bg-red-600" subtotalAmount={formatCurrency(orderTotals.cancelled)} />
          </div>
        </div>

        {false && (
        <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Payroll Snapshot</h3>
              <p className="mt-1.5 text-sm font-medium text-gray-500">
                Estimated employee payroll for the current dashboard period using the active payroll settings.
              </p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              {countedPayrollStatuses.size} counted statuses • unit rate {formatCurrency(payrollSettings.unitAmount)}
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#d6e3f0] bg-[#f8fbff] px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Estimated Payroll</p>
              <p className="mt-3 text-lg font-black text-gray-900">{formatCurrency(adminEstimatedPayroll)}</p>
              <p className="mt-2 text-sm font-medium text-gray-500">Total live payroll amount for the filtered dashboard window.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Employees Due</p>
              <p className="mt-3 text-lg font-black text-gray-900">{adminEmployeesDue}</p>
              <p className="mt-2 text-sm font-medium text-gray-500">Employees with at least one qualifying order in this period.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white px-5 py-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Counted Orders</p>
              <p className="mt-3 text-lg font-black text-gray-900">{filteredPayrollOrders.length}</p>
              <p className="mt-2 text-sm font-medium text-gray-500">Orders currently included by the configured payroll statuses.</p>
            </div>
          </div>
        </section>
        )}

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
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} tickFormatter={(value) => formatDashboardInteger(Number(value))} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number | string, name: string) => [
                      formatCurrency(Math.abs(roundDashboardValue(Number(value)))),
                      CASH_FLOW_LABELS[String(name)] || String(name),
                    ]}
                  />
                  <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                  <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} />
                </ComposedChart>
              ) : (
                <ComposedChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#94a3b8' }} tickFormatter={(value) => formatDashboardInteger(Number(value))} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f8fafc' }}
                    formatter={(value: number | string, name: string) => [
                      formatCurrency(Math.abs(roundDashboardValue(Number(value)))),
                      CASH_FLOW_LABELS[String(name)] || String(name),
                    ]}
                  />
                  <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} barSize={40} />
                  <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={40} />
                  <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Top 5 Sold Products</h3>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">By Qty</span>
            </div>
            <div className="space-y-3">
              {topSoldProducts.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No completed sales in this period.</p>
              ) : (
                topSoldProducts.map((p, idx) => (
                  <div key={`${p.name}-${idx}`} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-b-0 last:pb-0">
                    <span className="text-sm font-bold text-gray-900">{p.name}</span>
                    <span className="text-sm font-black text-emerald-600">{p.qty}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Top 5 Customers</h3>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">By Sales</span>
            </div>
            <div className="space-y-3">
              {topCustomers.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No completed sales in this period.</p>
              ) : (
                topCustomers.map((c, idx) => (
                  <div key={`${c.name}-${idx}`} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-b-0 last:pb-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-900">{c.name}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{c.orders} orders</span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">{formatCurrency(c.amount)}</span>
                  </div>
                ))
              )}
            </div>
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
                  <Tooltip formatter={(value: number | string) => formatCurrency(roundDashboardValue(Number(value)))} />
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
      <LoadingOverlay isLoading={loading} message="Loading dashboard data..." />

      <FilterBar 
        filterRange={filterRange}
        setFilterRange={setFilterRange}
        customDates={customDates}
        setCustomDates={setCustomDates}
      />

      <section className="rounded-[16px] border border-gray-100 bg-white p-5 shadow-sm md:p-8">
        <div className="grid gap-4 xl:grid-cols-4">
          <EmployeeSummaryCard
            title="Total Created"
            value={myTotalCreated}
            icon={ICONS.Sales}
            cardClassName="bg-gradient-to-r from-[#2d5fe6] to-[#366ae8]"
            iconClassName="bg-[#2452cb]"
          />
          <EmployeeSummaryCard
            title="Created Today"
            value={myCreatedToday}
            icon={ICONS.Dashboard}
            cardClassName="bg-gradient-to-r from-[#1fa9a2] to-[#2bbdb2]"
            iconClassName="bg-[#14948d]"
          />
          <EmployeeSummaryCard
            title="On Hold"
            value={myPendingOrders}
            icon={ICONS.More}
            cardClassName="bg-gradient-to-r from-[#ff7a11] to-[#ff7a11]"
            iconClassName="bg-[#ef6800]"
          />
          <EmployeeSummaryCard
            title="Wallet Balance"
            value={formatCurrency(myWallet?.currentBalance ?? 0)}
            icon={ICONS.Payroll}
            cardClassName="bg-gradient-to-r from-[#119f57] to-[#43cf7f]"
            iconClassName="bg-[#0d7f46]"
          />
        </div>

        <div className="mt-8 border-t border-gray-100 pt-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-gray-900">My Orders by Status</h3>
              <p className="mt-1.5 text-xs font-medium text-gray-400">Based on the selected date range</p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Quick Status Snapshot</p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {employeeStatusSnapshot.map((entry) => {
              const styles = EMPLOYEE_STATUS_STYLES[entry.status];
              return (
                <EmployeeStatusCard
                  key={entry.status}
                  title={entry.label}
                  value={entry.value}
                  total={Math.max(filteredMyOrders.length, 1)}
                  valueClass={styles.valueClass}
                  barClass={styles.barClass}
                  trackClass={styles.trackClass}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[16px] border border-gray-100 bg-white p-5 shadow-sm md:p-8">
        <div>
          <h3 className="text-xl font-black text-gray-900">Order Comparison</h3>
          <p className="mt-1 text-xs font-medium text-gray-400">Orders created by all employees in the selected date range</p>
        </div>

        {employeeComparisonRows.length === 0 ? (
          <div className="mt-6 rounded-[22px] border border-dashed border-gray-200 bg-gray-50 px-6 py-14 text-center text-xs font-medium text-gray-400">
            No employee order activity matched the selected date range.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {employeeComparisonRows.map((entry) => (
              <EmployeeComparisonRow
                key={entry.userId}
                name={entry.name}
                role={entry.role}
                orderCount={entry.orderCount}
                maxCount={employeeComparisonMax}
                isCurrentUser={entry.isCurrentUser}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;


