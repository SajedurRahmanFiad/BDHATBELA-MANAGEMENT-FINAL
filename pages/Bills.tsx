
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Bill, BillStatus } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';

const Bills: React.FC = () => {
  const navigate = useNavigate();
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [statusTab, setStatusTab] = useState<BillStatus | 'All'>('All');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const getStatusColor = (status: BillStatus) => {
    switch (status) {
      case BillStatus.ON_HOLD: return 'bg-gray-100 text-gray-600';
      case BillStatus.PROCESSING: return 'bg-blue-100 text-blue-600';
      case BillStatus.RECEIVED: return 'bg-emerald-100 text-emerald-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const isWithinRange = (dateStr: string) => {
    if (filterRange === 'All Time') return true;
    const date = new Date(dateStr);
    const now = new Date();
    if (filterRange === 'Today') return date.toDateString() === now.toDateString();
    if (filterRange === 'This Week') {
      const first = now.getDate() - now.getDay();
      const firstDay = new Date(new Date().setDate(first));
      const lastDay = new Date(new Date().setDate(first + 6));
      return date >= firstDay && date <= lastDay;
    }
    if (filterRange === 'This Month') return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    if (filterRange === 'This Year') return date.getFullYear() === now.getFullYear();
    if (filterRange === 'Custom') {
      if (!customDates.from || !customDates.to) return true;
      return date >= new Date(customDates.from) && date <= new Date(customDates.to);
    }
    return true;
  };

  const filteredBills = useMemo(() => {
    return db.bills
      .filter(b => isWithinRange(b.billDate))
      .filter(b => statusTab === 'All' || b.status === statusTab);
  }, [filterRange, customDates, statusTab]);

  const handleDuplicate = (bill: Bill) => {
    const newBill: Bill = {
      ...bill,
      id: Math.random().toString(36).substr(2, 9),
      billNumber: `PUR-${Math.floor(Math.random() * 10000)}`,
      billDate: new Date().toISOString().split('T')[0],
      status: BillStatus.ON_HOLD,
      paidAmount: 0,
    };
    db.bills.unshift(newBill);
    saveDb();
    navigate(0);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Purchase Bills</h2>
          <p className="text-gray-500 font-medium text-sm">Manage vendor procurement and supply chain payables</p>
        </div>
        <button onClick={() => navigate('/bills/new')} className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3.5 rounded-2xl font-black text-sm hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">{ICONS.Plus} New Bill</button>
      </div>

      <FilterBar 
        title="Bills"
        filterRange={filterRange}
        setFilterRange={setFilterRange}
        customDates={customDates}
        setCustomDates={setCustomDates}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        statusOptions={Object.values(BillStatus)}
      />

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Bill Number</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Vendor</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Created By</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBills.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic font-medium">No purchase bills found for this criteria.</td></tr>
              ) : filteredBills.map((bill) => (
                <tr key={bill.id} onMouseEnter={() => setHoveredRow(bill.id)} onMouseLeave={() => setHoveredRow(null)} onClick={() => navigate(`/bills/${bill.id}`)} className="group relative hover:bg-blue-50/20 cursor-pointer transition-all">
                  <td className="px-6 py-5">
                    <span className="font-black text-gray-900">#{bill.billNumber}</span>
                    <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{bill.billDate}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-bold text-gray-700">{db.vendors.find(v => v.id === bill.vendorId)?.name || 'Unknown Vendor'}</span>
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-gray-500">{bill.createdBy}</td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(bill.status)}`}>{bill.status}</span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <span className="font-black text-gray-900 text-base">{formatCurrency(bill.total)}</span>
                  </td>
                  {hoveredRow === bill.id && (
                    <td className="absolute inset-y-0 right-0 flex items-center pr-6 bg-gradient-to-l from-white via-white to-transparent">
                      <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-blue-100 animate-in fade-in slide-in-from-right-2 duration-200" onClick={e => e.stopPropagation()}>
                        <button onClick={() => navigate(`/bills/edit/${bill.id}`)} className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">{ICONS.Edit}</button>
                        <button onClick={() => handleDuplicate(bill)} className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">{ICONS.Duplicate}</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Bills;
