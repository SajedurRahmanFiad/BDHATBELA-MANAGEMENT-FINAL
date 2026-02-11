
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Transaction } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, TableLoadingSkeleton, IconButton } from '../components';
import { theme } from '../theme';
import { useTransactions, useCustomers, useVendors, useOrders, useBills, useUsers, useCategories } from '../src/hooks/useQueries';
import { useDeleteTransaction } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { useSearch } from '../src/contexts/SearchContext';

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { searchQuery } = useSearch();
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [typeTab, setTypeTab] = useState<'All' | 'Income' | 'Expense' | 'Transfer'>('All');
  const { data: transactions = [], isPending: transactionsLoading } = useTransactions();
  const { data: customers = [] } = useCustomers();
  const { data: vendors = [] } = useVendors();
  const { data: orders = [] } = useOrders();
  const { data: bills = [] } = useBills();
  const { data: users = [] } = useUsers();
  const { data: allCategories = [] } = useCategories();
  const deleteTransactionMutation = useDeleteTransaction();

  const handleDelete = async (transactionId: string) => {
    // Prevent deletion of unsaved transactions (temp IDs)
    if (transactionId.startsWith('temp-')) {
      toast.error('Cannot delete unsaved transactions. Please refresh and try again.');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteTransactionMutation.mutateAsync(transactionId);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Transaction deleted successfully');
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      toast.error('Failed to delete transaction');
    }
  };

  // Create Maps for O(1) lookups instead of O(n) array searching
  const userMap = useMemo(() => {
    return new Map(users.map(u => [u.id, u]));
  }, [users]);

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

  const getCreatorName = (transaction: Transaction) => {
    if (!transaction.createdBy?.trim()) return null;
    const user = userMap.get(transaction.createdBy);
    if (user?.name) return user.name;
    
    // Fallback: extract creator name from history field
    if (transaction.history?.created) {
      const match = transaction.history.created.match(/Created by (.+?) on/);
      if (match) return match[1];
    }
    
    return null;
  };

  const getContactName = (contactId: string) => {
    const customer = customers.find(c => c.id === contactId);
    if (customer) return { name: customer.name, type: 'Customer' };
    const vendor = vendors.find(v => v.id === contactId);
    if (vendor) return { name: vendor.name, type: 'Vendor' };
    return null;
  };

  const filteredTransactions = useMemo(() => {
    let results = transactions
      .filter(t => isWithinRange(t.date))
      .filter(t => typeTab === 'All' || t.type === typeTab);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(transaction => {
        const contact = transaction.contactId ? getContactName(transaction.contactId) : null;
        const creator = getCreatorName(transaction);
        const category = allCategories.find(c => c.id === transaction.category)?.name || transaction.category || '';
        
        return (
          transaction.description.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query) ||
          transaction.type.toLowerCase().includes(query) ||
          (contact?.name.toLowerCase().includes(query)) ||
          (creator?.toLowerCase?.().includes(query)) ||
          formatCurrency(transaction.amount).includes(query)
        );
      });
    }

    return results;
  }, [transactions, filterRange, customDates, typeTab, searchQuery, customers, vendors, allCategories, users]);

  const formatDateAndTime = (dateString?: string, createdAt?: string) => {
    try {
      // Prefer a time-aware value. If `dateString` is a date-only string (YYYY-MM-DD)
      // or missing, fall back to DB `createdAt` which contains the timestamp.
      const candidate = (dateString && dateString.toString().length > 10) ? dateString : (createdAt || dateString || '');
      const date = new Date(candidate);
      const timeZone = 'Asia/Dhaka';
      const dateStr = date.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
      const timeStr = date.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone });
      return { date: dateStr, time: timeStr };
    } catch (e) {
      return { date: dateString || createdAt || '', time: '' };
    }
  };

  const handleRowClick = (transaction: Transaction) => {
    if (transaction.referenceId) {
      const isOrder = orders.some(o => o.id === transaction.referenceId);
      if (isOrder) { navigate(`/orders/${transaction.referenceId}`); return; }
      const isBill = bills.some(b => b.id === transaction.referenceId);
      if (isBill) { navigate(`/bills/${transaction.referenceId}`); return; }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="md:text-2xl text-xl font-bold text-gray-900 tracking-tight">Financial Transactions</h2>
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
        statusTab={typeTab}
        setStatusTab={setTypeTab}
        statusOptions={['Income', 'Expense', 'Transfer']}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"><>Category <br></br> Notes</></th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactionsLoading ? (
                <TableLoadingSkeleton columns={7} rows={8} />
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400 italic font-medium">No transactions found.</td></tr>
              ) : (
                filteredTransactions.map((t) => {
                  const contact = t.contactId ? getContactName(t.contactId) : null;
                  const creator = getCreatorName(t);
                  const hasLink = t.referenceId && (orders.some(o => o.id === t.referenceId) || bills.some(b => b.id === t.referenceId));
                  const isLinkedTransaction = !!t.referenceId;
                  const { date: dateStr, time: timeStr } = formatDateAndTime(t.date, (t as any).createdAt);
                  
                  return (
                    <tr key={t.id} onClick={() => handleRowClick(t)} className={`hover:bg-gray-50 transition-all group ${hasLink ? 'cursor-pointer' : ''}`}>
                      <td className="px-6 py-5 text-sm font-bold text-gray-700"><div className="flex flex-col"><span className="font-bold text-gray-900">{dateStr}</span><span className="text-[11px] text-gray-400 font-medium">{timeStr}</span></div></td>
                      <td className="px-6 py-5"><span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${t.type === 'Income' ? `bg-[#ebf4ff]` : t.type === 'Expense' ? 'bg-red-50 text-red-600' : `bg-[#e6f0ff]`}`}>{t.type}</span></td>
                      <td className="px-6 py-5">{isLinkedTransaction ? (contact ? (<div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{contact.name}</span><span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">{contact.type}</span></div>) : <span className="text-gray-300 font-bold text-xs">—</span>) : (creator ? (<div className="flex flex-col"><span className="text-sm font-bold text-gray-900">{creator}</span><span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Created By</span></div>) : <span className="text-gray-300 font-bold text-xs">—</span>)}</td>
                      <td className="px-6 py-5"><div className="flex flex-col"><p className="text-sm font-bold text-gray-800">{allCategories.find(c => c.id === t.category)?.name || t.category}</p><p className="text-xs text-gray-400 italic max-w-xs truncate">{t.description}</p></div></td>
                      <td className="px-6 py-5 text-right"><span className={`font-black text-base ${t.type === 'Income' ? 'text-emerald-600' : t.type === 'Expense' ? 'text-red-600' : 'text-black'}`}>{t.type === 'Income' ? '+' : t.type === 'Expense' ? '-' : ''}{formatCurrency(t.amount)}</span></td>
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

