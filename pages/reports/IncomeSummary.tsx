
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, ICONS } from '../../constants';
import { Button, ReportPageSkeleton } from '../../components';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { theme } from '../../theme';
import { useIncomeSummaryReport } from '../../src/hooks/useQueries';

const IncomeSummary: React.FC = () => {
  const navigate = useNavigate();
  const { data, isPending } = useIncomeSummaryReport();
  const isLoading = isPending;
  const chartData = data?.revenueMix || [];
  const topCustomers = data?.topCustomers || [];
  const COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

  if (isLoading) {
    return <ReportPageSkeleton cards={3} showChart tableColumns={0} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/reports')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Income Summary</h2>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl font-bold text-sm text-gray-700 hover:bg-gray-50">
            {ICONS.Download} Export CSV
          </button>
          <Button variant="primary" size="sm" icon={ICONS.Print}>
            Export Image
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm flex flex-col items-center">
          <h3 className="font-bold text-gray-800 self-start mb-6">Revenue Mix</h3>
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${theme.colors.primary[600]} p-8 rounded-lg text-white shadow-lg shadow-[#0f2f57]/20`}>
            <p className="text-[#c7dff5] text-xs font-bold uppercase tracking-widest mb-1">Total Revenue Collected</p>
            <h4 className="text-lg font-black">{formatCurrency(data?.totalRevenue || 0)}</h4>
            <div className="mt-6 p-4 bg-white/10 rounded-xl flex items-center justify-between">
              <span className="text-sm font-medium">Avg Transaction Size</span>
              <span className="font-bold">{formatCurrency(data?.averageTransactionSize || 0)}</span>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">Top Customers</h3>
            <div className="space-y-4">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center font-bold text-xs">{(c.name || '?').charAt(0)}</div>
                    <span className="text-sm font-semibold text-gray-700">{c.name}</span>
                  </div>
                  <span className={`text-sm font-black`}>{formatCurrency(c.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeSummary;
