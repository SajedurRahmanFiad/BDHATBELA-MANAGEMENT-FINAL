
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { formatCurrency, ICONS } from '../../constants';
import { Button } from '../../components';
import { theme } from '../../theme';
import { useOrders, useBills, useTransactions } from '../../src/hooks/useQueries';

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

  // Mock aggregates for P&L
  const grossSales = orders.reduce((s, o) => s + o.total, 0);
  const costOfPurchases = bills.reduce((s, b) => s + b.total, 0);
  const grossProfit = grossSales - costOfPurchases;

  const expenses = transactions.filter(t => t.type === 'Expense' && t.category !== 'Purchases');
  const totalOperatingExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  
  const netProfit = grossProfit - totalOperatingExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Profit and Loss Statement</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" icon={ICONS.Print}>
            Print Statement
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-8 bg-gray-50 border-b border-gray-100 text-center">
          {db.settings.company.logo && (
            <img src={db.settings.company.logo} className="w-16 h-16 rounded-xl mx-auto mb-4 grayscale opacity-50" />
          )}
          <h3 className="text-xl font-bold text-gray-900">{db.settings.company.name}</h3>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">For the period ending {new Date().toLocaleDateString('en-BD', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="p-8 space-y-2">
          <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Revenue</h4>
          <PLRow label="Gross Sales" amount={grossSales} />
          <PLRow label="Other Operating Income" amount={0} />
          <PLRow label="Total Revenue" amount={grossSales} isBold isTotal />

          <div className="pt-8">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Cost of Goods Sold</h4>
            <PLRow label="Purchases" amount={costOfPurchases} />
            <PLRow label="Total COGS" amount={costOfPurchases} isBold isTotal />
          </div>

          <div className="pt-8">
            <PLRow label="Gross Profit" amount={grossProfit} isBold />
          </div>

          <div className="pt-8">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Operating Expenses</h4>
            {expenses.slice(0, 5).map((e, i) => (
              <PLRow key={i} label={e.category} amount={e.amount} indent />
            ))}
            {expenses.length > 5 && <PLRow label="Other Miscellaneous" amount={expenses.slice(5).reduce((s,e) => s+e.amount, 0)} indent />}
            <PLRow label="Total Operating Expenses" amount={totalOperatingExpenses} isBold isTotal />
          </div>

          <div className="pt-12">
            <div className={`p-6 rounded-lg flex justify-between items-center ${netProfit >= 0 ? theme.colors.primary[600] : 'bg-red-600'} text-white shadow-xl`}>
              <span className="text-lg font-black uppercase tracking-widest">Net Profit / Loss</span>
              <span className="text-3xl font-black">{formatCurrency(netProfit)}</span>
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
