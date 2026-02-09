
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { formatCurrency, ICONS } from '../../constants';
import { Button } from '../../components';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { theme } from '../../theme';
import { useTransactions, useVendors, useAccounts } from '../../src/hooks/useQueries';

const ExpenseSummary: React.FC = () => {
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions();
  const { data: vendors = [] } = useVendors();
  const { data: accounts = [] } = useAccounts();
  
  const expenses = transactions.filter(t => t.type === 'Expense');
  
  const categoryDataMap: Record<string, number> = {};
  expenses.forEach(e => {
    categoryDataMap[e.category] = (categoryDataMap[e.category] || 0) + e.amount;
  });

  const chartData = Object.entries(categoryDataMap).map(([name, value]) => ({ name, value }));
  const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#8B5CF6', '#EC4899', '#3B82F6'];

  const handleExportCSV = () => {
    const headers = 'Date,Category,Contact,Account,Amount,Description\n';
    const csvContent = expenses.map(e => {
      const contact = vendors.find(v => v.id === e.contactId)?.name || 'N/A';
      const account = accounts.find(a => a.id === e.accountId)?.name || 'N/A';
      return `${e.date},${e.category},"${contact}","${account}",${e.amount},"${e.description}"`;
    }).join('\n');
    const blob = new Blob([headers + csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'expense_summary.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Expense Summary</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50">
            {ICONS.Download} Export CSV
          </button>
          <Button variant="primary" size="sm" icon={ICONS.Print}>
            Export Image
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-6">Expenses by Category</h3>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
          <h3 className="font-bold text-gray-800">Key Statistics</h3>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Total Outflow</p>
              <h4 className="text-3xl font-black text-red-600">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</h4>
            </div>
            <div className="divide-y divide-gray-50">
              {chartData.sort((a,b) => b.value - a.value).slice(0, 5).map((item, i) => (
                <div key={i} className="py-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-500">{item.name}</span>
                  <span className="text-sm font-bold text-gray-900">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50">
          <h3 className="font-bold text-gray-900">Recent Expense Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.slice(0, 10).map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">{e.date}</td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-800">{e.category}</td>
                  <td className="px-6 py-4 text-right font-black text-red-600">{formatCurrency(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpenseSummary;
