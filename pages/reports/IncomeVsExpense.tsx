
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { formatCurrency, ICONS } from '../../constants';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const IncomeVsExpense: React.FC = () => {
  const navigate = useNavigate();

  // Aggregate by month (Mock logic for demo using transaction dates)
  const monthlyData: Record<string, { income: number; expense: number }> = {
    'Jan': { income: 45000, expense: 32000 },
    'Feb': { income: 52000, expense: 28000 },
    'Mar': { income: 38000, expense: 45000 },
    'Apr': { income: 61000, expense: 39000 },
    'May': { income: 55000, expense: 41000 },
    'Jun': { income: 72000, expense: 50000 },
  };

  const chartData = Object.entries(monthlyData).map(([name, vals]) => ({
    name,
    income: vals.income,
    expense: vals.expense,
    profit: vals.income - vals.expense
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Income vs Expense Trend</h2>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 shadow-md">
            {ICONS.Print} Export Full Report
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
        <h3 className="font-bold text-gray-800 mb-8">Cash Flow Dynamics (Last 6 Months)</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="top" align="right" height={36} />
              <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} name="Total Income" barSize={40} />
              <Bar dataKey="expense" fill="#EF4444" radius={[4, 4, 0, 0]} name="Total Expense" barSize={40} />
              <Line type="monotone" dataKey="profit" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} name="Net Cash Flow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Highest Revenue Month', value: 'June', amount: 72000, color: 'text-emerald-600' },
          { label: 'Least Expense Month', value: 'February', amount: 28000, color: 'text-blue-600' },
          { label: 'Average Monthly Profit', value: 'Steady Growth', amount: 18000, color: 'text-purple-600' }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
            <h4 className="text-xl font-bold text-gray-900 mt-1">{stat.value}</h4>
            <p className={`text-lg font-black mt-2 ${stat.color}`}>{formatCurrency(stat.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IncomeVsExpense;
