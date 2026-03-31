import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, ICONS } from '../../constants';
import { Button } from '../../components';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTransactions } from '../../src/hooks/useQueries';

const IncomeVsExpense: React.FC = () => {
  const navigate = useNavigate();
  const { data: transactions = [] } = useTransactions();

  const chartData = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        name: date.toLocaleDateString('en-BD', { month: 'short' }),
        label: date.toLocaleDateString('en-BD', { month: 'short', year: 'numeric' }),
        income: 0,
        expense: 0,
      };
    });

    const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    transactions.forEach((transaction) => {
      const transactionDate = new Date(transaction.date || transaction.createdAt || '');
      if (Number.isNaN(transactionDate.getTime())) return;

      const bucket = bucketMap.get(`${transactionDate.getFullYear()}-${transactionDate.getMonth()}`);
      if (!bucket) return;

      if (transaction.type === 'Income') {
        bucket.income += Number(transaction.amount || 0);
      } else if (transaction.type === 'Expense') {
        bucket.expense += Number(transaction.amount || 0);
      }
    });

    return buckets.map((bucket) => ({
      name: bucket.name,
      label: bucket.label,
      income: bucket.income,
      expense: bucket.expense,
      profit: bucket.income - bucket.expense,
    }));
  }, [transactions]);

  const totalIncome = chartData.reduce((sum, entry) => sum + entry.income, 0);
  const totalExpense = chartData.reduce((sum, entry) => sum + entry.expense, 0);
  const averageProfit = chartData.length > 0 ? (totalIncome - totalExpense) / chartData.length : 0;
  const monthsWithActivity = chartData.filter((entry) => entry.income > 0 || entry.expense > 0);
  const highestRevenueMonth = monthsWithActivity.reduce<typeof chartData[number] | null>((best, current) => {
    if (!best || current.income > best.income) return current;
    return best;
  }, null);
  const lowestExpenseMonth = monthsWithActivity.reduce<typeof chartData[number] | null>((best, current) => {
    if (!best || current.expense < best.expense) return current;
    return best;
  }, null);

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
          <Button variant="primary" size="sm" icon={ICONS.Print} onClick={() => window.print()}>
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
        {[
          {
            label: 'Highest Revenue Month',
            value: highestRevenueMonth?.label || 'N/A',
            amount: highestRevenueMonth?.income || 0,
            color: '',
          },
          {
            label: 'Least Expense Month',
            value: lowestExpenseMonth?.label || 'N/A',
            amount: lowestExpenseMonth?.expense || 0,
            color: '',
          },
          {
            label: 'Average Monthly Profit',
            value: 'Monthly Avg',
            amount: averageProfit,
            color: 'text-purple-600',
          },
        ].map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
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
