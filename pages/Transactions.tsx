
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Transaction, UserRole, isEmployeeRole } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, TableLoadingSkeleton, IconButton } from '../components';
import { theme } from '../theme';
import { useTransactionsPage, useUsers, useCategories, useSystemDefaults } from '../src/hooks/useQueries';
import Pagination from '../src/components/Pagination';
import { useDeleteTransaction } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';
import { useUrlSyncedSearchQuery } from '../src/hooks/useUrlSyncedSearchQuery';
import { buildHistoryBackState, getPositivePageParam } from '../src/utils/navigation';
import { getDateTimeFilters } from '../utils';

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { data: systemDefaults } = useSystemDefaults();
  const pageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSearchParams = searchParams.toString();
  const urlPage = getPositivePageParam(searchParams.get('page'));
  const urlFilterRange = (searchParams.get('range') as FilterRange | null) || 'All Time';
  const urlCustomDates = {
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  };
  const urlTypeTab = (searchParams.get('type') as 'All' | 'Income' | 'Expense' | 'Transfer' | null) || 'All';
  const urlCreatedByFilter = searchParams.get('createdBy') || 'all';
  const { searchQuery } = useUrlSyncedSearchQuery(searchParams.get('search') || '');
  const [syncedSearchParams, setSyncedSearchParams] = useState<string | null>(null);
  const shouldHydrateFromUrl = syncedSearchParams !== currentSearchParams;
  const [filterRange, setFilterRange] = useState<FilterRange>(urlFilterRange);
  const [customDates, setCustomDates] = useState(urlCustomDates);
  const [typeTab, setTypeTab] = useState<'All' | 'Income' | 'Expense' | 'Transfer'>(urlTypeTab);
  const [createdByFilter, setCreatedByFilter] = useState<string>(urlCreatedByFilter);
  const [page, setPage] = useState<number>(urlPage);
  const previousSearchQueryRef = React.useRef(searchQuery);
  
  const { data: users = [] } = useUsers();

  useEffect(() => {
    if (!shouldHydrateFromUrl) return;

    setPage(urlPage);
    setFilterRange(urlFilterRange);
    setCustomDates(urlCustomDates);
    setTypeTab(urlTypeTab);
    setCreatedByFilter(urlCreatedByFilter);
    setSyncedSearchParams(currentSearchParams);
  }, [
    shouldHydrateFromUrl,
    urlPage,
    urlFilterRange,
    urlCustomDates,
    urlTypeTab,
    urlCreatedByFilter,
    currentSearchParams,
  ]);

  useEffect(() => {
    if (shouldHydrateFromUrl) {
      previousSearchQueryRef.current = searchQuery;
      return;
    }

    if (previousSearchQueryRef.current !== searchQuery) {
      setPage(1);
      previousSearchQueryRef.current = searchQuery;
    }
  }, [searchQuery, shouldHydrateFromUrl]);

  const effectivePage = shouldHydrateFromUrl ? urlPage : page;
  const effectiveFilterRange = shouldHydrateFromUrl ? urlFilterRange : filterRange;
  const effectiveCustomDates = shouldHydrateFromUrl ? urlCustomDates : customDates;
  const effectiveTypeTab = shouldHydrateFromUrl ? urlTypeTab : typeTab;
  const effectiveCreatedByFilter = shouldHydrateFromUrl ? urlCreatedByFilter : createdByFilter;
  const timeFilters = useMemo(
    () => getDateTimeFilters(effectiveFilterRange, effectiveCustomDates),
    [effectiveFilterRange, effectiveCustomDates]
  );

  // Compute createdByIds based on createdByFilter
  const createdByIds = useMemo(() => {
    if (effectiveCreatedByFilter === 'all') return undefined;
    if (effectiveCreatedByFilter === 'admins') {
      return users.filter(u => u.role === UserRole.ADMIN).map(u => u.id);
    }
    if (effectiveCreatedByFilter === 'employees') {
      return users.filter(u => isEmployeeRole(u.role)).map(u => u.id);
    }
    // Specific user ID
    return [effectiveCreatedByFilter];
  }, [effectiveCreatedByFilter, users]);

  const { data: transactionsPage, isFetching: transactionsLoading } = useTransactionsPage(effectivePage, pageSize, {
    type: effectiveTypeTab === 'All' ? undefined : effectiveTypeTab,
    from: timeFilters.from,
    to: timeFilters.to,
    search: searchQuery,
    createdByIds,
  });
  const transactions = transactionsPage?.data ?? [];
  const totalTransactions = transactionsPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalTransactions / pageSize));
  // Instead of loading entire customers/vendors tables, only fetch rows referenced by the current page.
  // Relational contact/account names are now included in the paginated transactions payload
  const { data: allCategories = [] } = useCategories();
  const deleteTransactionMutation = useDeleteTransaction();

  useEffect(() => {
    if (shouldHydrateFromUrl) return;

    const params: Record<string, string> = {};
    if (effectivePage > 1) params.page = String(effectivePage);
    if (effectiveTypeTab !== 'All') params.type = effectiveTypeTab;
    if (effectiveFilterRange !== 'All Time') params.range = effectiveFilterRange;
    if (effectiveCustomDates.from) params.from = effectiveCustomDates.from;
    if (effectiveCustomDates.to) params.to = effectiveCustomDates.to;
    if (effectiveCreatedByFilter !== 'all') params.createdBy = effectiveCreatedByFilter;
    if (searchQuery) params.search = searchQuery;

    if (new URLSearchParams(params).toString() !== currentSearchParams) {
      setSearchParams(params, { replace: true });
    }
  }, [
    shouldHydrateFromUrl,
    effectivePage,
    effectiveTypeTab,
    effectiveFilterRange,
    effectiveCustomDates.from,
    effectiveCustomDates.to,
    effectiveCreatedByFilter,
    searchQuery,
    currentSearchParams,
    setSearchParams,
  ]);

  // Wrapper functions that reset page AND apply filter (atomic operation)
  const handleTypeTabChange = (type: 'All' | 'Income' | 'Expense' | 'Transfer') => {
    setPage(1);
    setTypeTab(type);
  };

  const handleFilterRangeChange = (range: FilterRange) => {
    setPage(1);
    setFilterRange(range);
    // Clear customDates when switching away from 'Custom' to prevent stale date values
    if (range !== 'Custom') {
      setCustomDates({ from: '', to: '' });
    }
  };

  const handleCustomDatesChange = (dates: { from: string; to: string }) => {
    setPage(1);
    setCustomDates(dates);
  };

  const handleCreatedByFilterChange = (filter: string) => {
    setPage(1);
    setCreatedByFilter(filter);
  };

  const handleDelete = async (transactionId: string) => {
    // Prevent deletion of unsaved transactions (temp IDs)
    if (transactionId.startsWith('temp-')) {
      toast.error('Cannot delete unsaved transactions. Please refresh and try again.');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await deleteTransactionMutation.mutateAsync(transactionId);
      // Cache updated deterministically by mutation hook
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

  const getContactName = (contactId: string, t?: Transaction) => {
    // Prefer relational name included in transaction row
    if (t && (t as any).contactName) return { name: (t as any).contactName, type: ((t as any).contactType as any) || 'Customer' };
    if (!contactId) return null;
    const customer = queryClient.getQueryData<any>(['customer', contactId]);
    if (customer) return { name: customer.name, type: 'Customer' };
    const vendor = queryClient.getQueryData<any>(['vendor', contactId]);
    if (vendor) return { name: vendor.name, type: 'Vendor' };
    return null;
  };

  const filteredTransactions = useMemo(() => {
    let results = transactions
      .filter(t => effectiveTypeTab === 'All' || t.type === effectiveTypeTab);

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
  }, [transactions, effectiveTypeTab, searchQuery, allCategories, users]);

  const formatDateAndTime = (dateString?: string, createdAt?: string) => {
    try {
      const candidate = (dateString && dateString.toString().length > 10) ? dateString : (createdAt || dateString || '');
      if (!candidate) return { date: '', time: '' };
      const date = new Date(candidate);
      if (Number.isNaN(date.getTime())) {
        return { date: dateString || createdAt || '', time: '' };
      }
      const timeZone = 'Asia/Dhaka';
      const dateStr = date.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric', timeZone });
      const timeStr = date.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone });
      return { date: dateStr, time: timeStr };
    } catch (e) {
      return { date: dateString || createdAt || '', time: '' };
    }
  };

  const handleRowClick = (transaction: Transaction) => {
    if (!transaction.referenceId) return;

    // Reference routing is deterministic by transaction type/category in this app.
    if (transaction.type === 'Income') {
      navigate(`/orders/${transaction.referenceId}`, { state: buildHistoryBackState(location) });
      return;
    }

    if (transaction.type === 'Expense' && transaction.category === 'expense_purchases') {
      navigate(`/bills/${transaction.referenceId}`, { state: buildHistoryBackState(location) });
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
        filterRange={effectiveFilterRange}
        setFilterRange={handleFilterRangeChange}
        customDates={effectiveCustomDates}
        setCustomDates={handleCustomDatesChange}
        statusTab={effectiveTypeTab}
        setStatusTab={handleTypeTabChange}
        statusOptions={['Income', 'Expense', 'Transfer']}
      />

      {/* Created By Filter Dropdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-bold text-gray-700">Created By:</label>
          <select
            value={effectiveCreatedByFilter}
            onChange={(e) => handleCreatedByFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Users</option>
            {users.some(u => u.role === UserRole.ADMIN) && <option value="admins">All Admins</option>}
            {users.some(u => isEmployeeRole(u.role)) && <option value="employees">All Employees</option>}
            <optgroup label="Specific Users">
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} {u.role === UserRole.ADMIN ? '(Admin)' : '(Employee)'}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

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
                <TableLoadingSkeleton columns={5} rows={8} />
              ) : filteredTransactions.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-400 italic font-medium">No transactions found.</td></tr>
              ) : (
                filteredTransactions.map((t) => {
                  const contact = t.contactId ? getContactName(t.contactId, t) : null;
                  const creator = getCreatorName(t);
                  const hasLink = !!t.referenceId && (
                    t.type === 'Income' ||
                    (t.type === 'Expense' && t.category === 'expense_purchases')
                  );
                  const isLinkedTransaction = !!t.referenceId;
                  const { date: dateStr, time: timeStr } = formatDateAndTime(t.date, t.createdAt);
                  
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
        <Pagination page={effectivePage} totalPages={totalPages} onPageChange={(p) => setPage(p)} disabled={transactionsLoading} />
    </div>
  );
};

export default Transactions;

