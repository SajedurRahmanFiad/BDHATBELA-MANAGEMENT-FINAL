
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { formatCurrency, ICONS } from '../../constants';
import { Button } from '../../components';
import { theme } from '../../theme';
import { useOrders, useBills, useTransactions, useCategories } from '../../src/hooks/useQueries';
import { OrderStatus } from '../../types';

const PLRow: React.FC<{ label: string; amount: number; isBold?: boolean; isTotal?: boolean; indent?: boolean }> = ({ label, amount, isBold, isTotal, indent }) => (
  <div className={`flex justify-between py-2 ${isBold ? 'font-bold text-gray-900' : 'text-gray-600'} ${isTotal ? 'border-t-2 border-gray-100 pt-4 mt-2' : ''} ${indent ? 'pl-6' : ''}`}>
    <span className="text-sm">{label}</span>
    <span className="text-sm font-black">{formatCurrency(amount)}</span>
  </div>
);

const ProfitLoss: React.FC = () => {
  const navigate = useNavigate();
  const { data: orders = [] } = useOrders();
  const { data: bills = [] } = useBills();
  const { data: transactions = [] } = useTransactions();
  const { data: allCategories = [] } = useCategories();
  
  // Create category map for ID -> name lookup
  const categoryMap = new Map(allCategories.map(c => [c.id, c.name]));
  
  // Date range filter state
  type DateRangeType = 'currentYear' | 'currentMonth' | 'custom';
  const [dateRange, setDateRange] = useState<DateRangeType>('currentYear');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Helper to check if date is within selected range
  const isWithinRange = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    if (dateRange === 'currentYear') {
      return date.getFullYear() === now.getFullYear();
    } else if (dateRange === 'currentMonth') {
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    } else if (dateRange === 'custom') {
      if (!customFrom || !customTo) return true;
      return date >= new Date(customFrom) && date <= new Date(customTo);
    }
    return true;
  };

  // Filter and calculate P&L based on date range
  const plData = useMemo(() => {
    // Only completed orders count as sales
    const completedOrders = orders.filter(o => o.status === OrderStatus.COMPLETED && isWithinRange(o.orderDate));
    const grossSales = completedOrders.reduce((s, o) => s + o.total, 0);
    
    // All bills in range count as COGS (purchases)
    const purchaseBills = bills.filter(b => isWithinRange(b.billDate));
    const costOfPurchases = purchaseBills.reduce((s, b) => s + b.total, 0);
    
    const grossProfit = grossSales - costOfPurchases;

    // All other expenses in range (excluding purchase category)
    const expenses = transactions.filter(t => 
      t.type === 'Expense' && 
      t.category !== 'expense_purchases' && 
      isWithinRange(t.date)
    );
    const totalOperatingExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    
    const netProfit = grossProfit - totalOperatingExpenses;

    return {
      grossSales,
      costOfPurchases,
      grossProfit,
      expenses,
      totalOperatingExpenses,
      netProfit,
      completedOrders,
      purchaseBills
    };
  }, [orders, bills, transactions, dateRange, customFrom, customTo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Profit and Loss Statement</h2>
        </div>
        <button 
          onClick={() => window.print()} 
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors"
        >
          {ICONS.Print} Print Statement
        </button>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Period</h3>
        <div className="flex gap-4 items-end">
          <div className="flex gap-3">
            <label className="flex items-center gap-2">
              <input 
                type="radio" 
                name="dateRange" 
                value="currentYear" 
                checked={dateRange === 'currentYear'}
                onChange={(e) => setDateRange(e.target.value as DateRangeType)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Current Year</span>
            </label>
            <label className="flex items-center gap-2">
              <input 
                type="radio" 
                name="dateRange" 
                value="currentMonth" 
                checked={dateRange === 'currentMonth'}
                onChange={(e) => setDateRange(e.target.value as DateRangeType)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Current Month</span>
            </label>
            <label className="flex items-center gap-2">
              <input 
                type="radio" 
                name="dateRange" 
                value="custom" 
                checked={dateRange === 'custom'}
                onChange={(e) => setDateRange(e.target.value as DateRangeType)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Custom Range</span>
            </label>
          </div>
          
          {dateRange === 'custom' && (
            <div className="flex gap-3 ml-auto">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">From:</label>
                <input 
                  type="date" 
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-600">To:</label>
                <input 
                  type="date" 
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 bg-gray-50 border-b border-gray-100 text-center">
          {db.settings.company.logo && (
            <img src={db.settings.company.logo} className="w-16 h-16 rounded-xl mx-auto mb-4 grayscale opacity-50" />
          )}
          <h3 className="text-xl font-bold text-gray-900">{db.settings.company.name}</h3>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
            For the period ending {new Date().toLocaleDateString('en-BD', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <div className="p-8 space-y-2">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Revenue</h4>
          <PLRow label="Gross Sales (Completed Orders)" amount={plData.grossSales} />
          <PLRow label="Other Operating Income" amount={0} />
          <PLRow label="Total Revenue" amount={plData.grossSales} isBold isTotal />

          <div className="pt-8">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Cost of Goods Sold</h4>
            <PLRow label="Purchases" amount={plData.costOfPurchases} />
            <PLRow label="Total COGS" amount={plData.costOfPurchases} isBold isTotal />
          </div>

          <div className="pt-8">
            <PLRow label="Gross Profit" amount={plData.grossProfit} isBold />
          </div>

          <div className="pt-8">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Operating Expenses</h4>
            {plData.expenses.slice(0, 5).map((e, i) => {
              const categoryName = categoryMap.get(e.category) || e.category || 'Uncategorized';
              return <PLRow key={i} label={categoryName} amount={e.amount} indent />;
            })}
            {plData.expenses.length > 5 && (
              <PLRow 
                label="Other Miscellaneous" 
                amount={plData.expenses.slice(5).reduce((s,e) => s+e.amount, 0)} 
                indent 
              />
            )}
            <PLRow label="Total Operating Expenses" amount={plData.totalOperatingExpenses} isBold isTotal />
          </div>

          <div className="pt-12">
            <div className={`p-6 rounded-lg flex justify-between items-center ${plData.netProfit >= 0 ? theme.colors.primary[600] : 'bg-red-600'} text-white shadow-xl`}>
              <span className="text-lg font-black uppercase tracking-widest">Net Profit / Loss</span>
              <span className="text-3xl font-black">{formatCurrency(plData.netProfit)}</span>
            </div>
          </div>
        </div>
        
        <div className="p-8 text-center text-[10px] text-gray-300 italic border-t border-gray-50">
          This report is generated automatically by BD Hatbela Financial Management System.
        </div>
      </div>
    </div>
  );
};

export default ProfitLoss;
