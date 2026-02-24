
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { formatCurrency, ICONS } from '../../constants';
import { Button } from '../../components';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { theme } from '../../theme';
import { useTransactions } from '../../src/hooks/useQueries';

const IncomeVsExpense: React.FC = () => {
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions();

  // Aggregate real data by month
  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    
    // Initialize structure
    const aggregatedData: Record<string, { income: number; expense: number }> = {};
    months.forEach(m => {
      aggregatedData[m] = { income: 0, expense: 0 };
    });

    // Aggregate income and expense exclusively from transactions
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
      expense: aggregatedData[name].expense,
      profit: aggregatedData[name].income - aggregatedData[name].expense
    }));
  }, [transactions]);
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
          <Button variant="primary" size="sm" icon={ICONS.Print}>
            Export Full Report
          </Button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm">
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
        {(() => {
          const totalIncome = chartData.reduce((s, d) => s + d.income, 0);
          const totalExpense = chartData.reduce((s, d) => s + d.expense, 0);
          const avgProfit = chartData.length > 0 ? (totalIncome - totalExpense) / chartData.length : 0;
          
          const highestMonthIndex = chartData.reduce((maxIdx, curr, i) => 
            curr.income > chartData[maxIdx].income ? i : maxIdx, 0);
          const lowestExpenseMonthIndex = chartData.reduce((minIdx, curr, i) => 
            curr.expense < chartData[minIdx].expense ? i : minIdx, 0);
          
          return [
            { 
              label: 'Highest Revenue Month', 
              value: chartData[highestMonthIndex]?.name || '—', 
              amount: chartData[highestMonthIndex]?.income || 0, 
            },
            { 
              label: 'Least Expense Month', 
              value: chartData[lowestExpenseMonthIndex]?.name || '—', 
              amount: chartData[lowestExpenseMonthIndex]?.expense || 0, 
            },
            { 
              label: 'Average Monthly Profit', 
              value: 'Monthly Avg', 
              amount: avgProfit, 
              color: 'text-purple-600' 
            }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <h4 className="text-xl font-bold text-gray-900 mt-1">{stat.value}</h4>
              <p className={`text-lg font-black mt-2 ${stat.color}`}>{formatCurrency(stat.amount)}</p>
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

export default IncomeVsExpense;

