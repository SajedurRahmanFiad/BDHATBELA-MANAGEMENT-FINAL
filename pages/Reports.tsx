
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';

const ReportCard: React.FC<{ 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  color: string; 
  to: string; 
}> = ({ title, description, icon, color, to }) => {
  const navigate = useNavigate();
  return (
    <button 
      onClick={() => navigate(to)}
      className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all text-left w-full group"
    >
      <div className={`p-4 rounded-2xl ${color} transition-transform group-hover:scale-110 duration-300`}>
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center gap-1 text-emerald-600 text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
          View Report {ICONS.ChevronRight}
        </div>
      </div>
    </button>
  );
};

const Reports: React.FC = () => {
  const reportCategories = [
    {
      title: 'Expense Summary',
      description: 'Breakdown of your business spending by category and vendor.',
      icon: ICONS.Delete,
      color: 'bg-red-50 text-red-600',
      to: '/reports/expense'
    },
    {
      title: 'Income Summary',
      description: 'Analysis of your revenue streams and payment collections.',
      icon: ICONS.PlusCircle,
      color: 'bg-emerald-50 text-emerald-600',
      to: '/reports/income'
    },
    {
      title: 'Income vs Expense',
      description: 'Visual comparison of cash inflows and outflows over time.',
      icon: ICONS.Transfer,
      color: 'bg-blue-50 text-blue-600',
      to: '/reports/income-vs-expense'
    },
    {
      title: 'Profit and Loss',
      description: 'Standard P&L statement to track net business profitability.',
      icon: ICONS.Reports,
      color: 'bg-purple-50 text-purple-600',
      to: '/reports/profit-loss'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Financial Reports</h2>
        <p className="text-gray-500 text-sm">Deep dive into your business metrics and performance.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reportCategories.map((report, i) => (
          <ReportCard key={i} {...report} />
        ))}
      </div>

      <div className="bg-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl shadow-emerald-100">
        <div className="relative z-10 max-w-lg">
          <h3 className="text-xl font-bold mb-2">Need a custom audit?</h3>
          <p className="text-emerald-100 text-sm leading-relaxed mb-6">Our reporting engine allows you to filter transactions by dates, accounts, and tags for granular data analysis.</p>
          <button className="px-6 py-2 bg-white text-emerald-600 font-bold rounded-xl hover:bg-emerald-50 transition-colors">
            Contact Support
          </button>
        </div>
        <div className="absolute right-0 bottom-0 opacity-10 p-4 transform translate-x-1/4 translate-y-1/4">
          <div className="w-64 h-64 border-[32px] border-white rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
