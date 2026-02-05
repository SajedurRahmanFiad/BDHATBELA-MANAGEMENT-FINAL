
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { Transaction } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button } from '../components';
import { theme } from '../theme';

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });

  const isWithinRange = (dateStr: string) => {
    if (filterRange === 'All Time') return true;
    const date = new Date(dateStr);
    const now = new Date();
    if (filterRange === 'Today') return date.toDateString() === now.toDateString();
    if (filterRange === 'This Week') {
      const first = now.getDate() - now.getDay();
      const last = first + 6;
      const firstDay = new Date(new Date().setDate(first));
      const lastDay = new Date(new Date().setDate(last));
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

  const filteredTransactions = useMemo(() => {
    return db.transactions.filter(t => isWithinRange(t.date));
  }, [filterRange, customDates]);

  const getContactName = (contactId: string) => {
    const customer = db.customers.find(c => c.id === contactId);
    if (customer) return { name: customer.name, type: 'Customer' };
    const vendor = db.vendors.find(v => v.id === contactId);
    if (vendor) return { name: vendor.name, type: 'Vendor' };
    return null;
  };

  const handleRowClick = (transaction: Transaction) => {
    if (transaction.referenceId) {
      const isOrder = db.orders.some(o => o.id === transaction.referenceId);
      if (isOrder) { navigate(`/orders/${transaction.referenceId}`); return; }
      const isBill = db.bills.some(b => b.id === transaction.referenceId);
      if (isBill) { navigate(`/bills/${transaction.referenceId}`); return; }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Financial Transactions</h2>
          <p className="text-gray-500 text-sm">Review all income and expense history</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate('/transactions/new/income')} variant="primary" size="md" icon={ICONS.Plus}>Income</Button>
          <Button onClick={() => navigate('/transactions/new/expense')} variant="danger" size="md" icon={ICONS.Minus}>Expense</Button>
        </div>
      </div>

      <FilterBar 
        title="Transactions"
        filterRange={filterRange}
        setFilterRange={setFilterRange}
        customDates={customDates}
        setCustomDates={setCustomDates}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Category & Notes</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Attachment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-16 text-center text-gray-400 italic font-medium">No transactions found.</td></tr>
              ) : (
                filteredTransactions.map((t) => {
                  const contact = t.contactId ? getContactName(t.contactId) : null;
                  const hasLink = t.referenceId && (db.orders.some(o => o.id === t.referenceId) || db.bills.some(b => b.id === t.referenceId));
                  return (
                    <tr key={t.id} onClick={() => handleRowClick(t)} className={`hover:bg-gray-50 transition-all group ${hasLink ? 'cursor-pointer' : ''}`}>
                      <td className="px-6 py-5 text-sm font-bold text-gray-700">{t.date}</td>
                      <td className="px-6 py-5"><span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${t.type === 'Income' ? 'bg-[#ebf4ff] ${theme.colors.primary[600]}' : t.type === 'Expense' ? 'bg-red-50 text-red-600' : 'bg-[#e6f0ff] ${theme.colors.secondary[600]}'}`}>{t.type}</span></td>
                      <td className="px-6 py-5">{contact ? (<div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{contact.name}</span><span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">{contact.type}</span></div>) : <span className="text-gray-300 font-bold text-xs">—</span>}</td>
                      <td className="px-6 py-5"><div className="flex flex-col"><p className="text-sm font-bold text-gray-800">{t.category}</p><p className="text-xs text-gray-400 italic max-w-xs truncate">{t.description}</p></div></td>
                      <td className="px-6 py-5 text-right"><span className={`font-black text-base ${t.type === 'Income' ? '${theme.colors.primary[600]}' : t.type === 'Expense' ? 'text-red-600' : '${theme.colors.secondary[600]}'}`}>{t.type === 'Income' ? '+' : t.type === 'Expense' ? '-' : ''}{formatCurrency(t.amount)}</span></td>
                      <td className="px-6 py-5 text-center">{t.attachmentUrl ? <div className="p-2 bg-[#ebf4ff] ${theme.colors.primary[600]} rounded-lg inline-block">{ICONS.Download}</div> : <span className="text-gray-200">—</span>}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Transactions;

