import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import PortalMenu from '../components/PortalMenu';
import { Transaction, hasAdminAccess, isEmployeeRole } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, TableLoadingSkeleton } from '../components';
import { useTransactionsPage, useUsers, useCategories, useSystemDefaults } from '../src/hooks/useQueries';
import Pagination from '../src/components/Pagination';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';
import { useUrlSyncedSearchQuery } from '../src/hooks/useUrlSyncedSearchQuery';
import { buildHistoryBackState, getPositivePageParam } from '../src/utils/navigation';
import { formatDateTimeParts, getDateTimeFilters, openAttachmentPreview } from '../utils';

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
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
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

  const createdByIds = useMemo(() => {
    if (effectiveCreatedByFilter === 'all') return undefined;
    if (effectiveCreatedByFilter === 'admins') {
      return users.filter((user) => hasAdminAccess(user.role)).map((user) => user.id);
    }
    if (effectiveCreatedByFilter === 'employees') {
      return users.filter((user) => isEmployeeRole(user.role)).map((user) => user.id);
    }
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
  const { data: allCategories = [] } = useCategories();

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

  const handleTypeTabChange = (type: 'All' | 'Income' | 'Expense' | 'Transfer') => {
    setPage(1);
    setTypeTab(type);
  };

  const handleFilterRangeChange = (range: FilterRange) => {
    setPage(1);
    setFilterRange(range);
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

  const userMap = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const getCreatorName = (transaction: Transaction) => {
    if (!transaction.createdBy?.trim()) return null;
    const user = userMap.get(transaction.createdBy);
    if (user?.name) return user.name;

    if (transaction.history?.created) {
      const match = transaction.history.created.match(/Created by (.+?) on/);
      if (match) return match[1];
    }

    return null;
  };

  const getContactName = (contactId: string, transaction?: Transaction) => {
    if (transaction?.contactName) {
      return {
        name: transaction.contactName,
        type: transaction.contactType || 'Customer',
      };
    }
    if (!contactId) return null;

    const customer = queryClient.getQueryData<any>(['customer', contactId]);
    if (customer) return { name: customer.name, type: 'Customer' };

    const vendor = queryClient.getQueryData<any>(['vendor', contactId]);
    if (vendor) return { name: vendor.name, type: 'Vendor' };

    return null;
  };

  const filteredTransactions = useMemo(() => {
    let results = transactions.filter((transaction) => (
      effectiveTypeTab === 'All' || transaction.type === effectiveTypeTab
    ));

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter((transaction) => {
        const contact = transaction.contactId ? getContactName(transaction.contactId, transaction) : null;
        const creator = getCreatorName(transaction);
        const category = allCategories.find((entry) => entry.id === transaction.category)?.name || transaction.category || '';

        return (
          transaction.description.toLowerCase().includes(query) ||
          category.toLowerCase().includes(query) ||
          transaction.type.toLowerCase().includes(query) ||
          Boolean(contact?.name.toLowerCase().includes(query)) ||
          Boolean(creator?.toLowerCase?.().includes(query)) ||
          formatCurrency(transaction.amount).includes(query)
        );
      });
    }

    return results;
  }, [transactions, effectiveTypeTab, searchQuery, allCategories, users]);

  const formatDateAndTime = (dateString?: string, createdAt?: string) => {
    const candidate = (dateString && dateString.toString().length > 10) ? dateString : (createdAt || dateString || '');
    return formatDateTimeParts(candidate);
  };

  const handleRowClick = (transaction: Transaction) => {
    if (!transaction.referenceId) return;

    if (transaction.type === 'Income') {
      navigate(`/orders/${transaction.referenceId}`, { state: buildHistoryBackState(location) });
      return;
    }

    if (transaction.type === 'Expense' && transaction.category === 'expense_purchases') {
      navigate(`/bills/${transaction.referenceId}`, { state: buildHistoryBackState(location) });
    }
  };

  const canEditTransaction = (transaction: Transaction) => !transaction.referenceId && transaction.type !== 'Transfer';
  const canViewAttachment = (transaction: Transaction) => Boolean(transaction.attachmentUrl?.trim());
  const hasRowActions = (transaction: Transaction) => canEditTransaction(transaction) || canViewAttachment(transaction);

  const closeActionsMenu = () => {
    setOpenActionsMenu(null);
    setAnchorEl(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    navigate(`/transactions/edit/${transaction.id}`, { state: buildHistoryBackState(location) });
  };

  const handleViewAttachment = (transaction: Transaction) => {
    if (!transaction.attachmentUrl || !openAttachmentPreview(transaction.attachmentUrl)) {
      toast.error('Attachment could not be opened.');
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-bold text-gray-700">Created By:</label>
          <select
            value={effectiveCreatedByFilter}
            onChange={(event) => handleCreatedByFilterChange(event.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Users</option>
            {users.some((user) => hasAdminAccess(user.role)) && <option value="admins">Admin Access</option>}
            {users.some((user) => isEmployeeRole(user.role)) && <option value="employees">All Employees</option>}
            <optgroup label="Specific Users">
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest"><>Category <br></br> Notes</></th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest sm:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {transactionsLoading ? (
                <TableLoadingSkeleton columns={5} rows={8} />
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-400 italic font-medium">No transactions found.</td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => {
                  const contact = transaction.contactId ? getContactName(transaction.contactId, transaction) : null;
                  const creator = getCreatorName(transaction);
                  const hasLink = Boolean(transaction.referenceId) && (
                    transaction.type === 'Income' ||
                    (transaction.type === 'Expense' && transaction.category === 'expense_purchases')
                  );
                  const isLinkedTransaction = Boolean(transaction.referenceId);
                  const canEdit = canEditTransaction(transaction);
                  const canPreviewAttachment = canViewAttachment(transaction);
                  const showActions = hasRowActions(transaction);
                  const { date: dateStr, time: timeStr } = formatDateAndTime(transaction.date, transaction.createdAt);

                  return (
                    <tr
                      key={transaction.id}
                      onMouseEnter={() => setHoveredRow(transaction.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      onClick={() => handleRowClick(transaction)}
                      className={`group relative hover:bg-gray-50 transition-all ${hasLink ? 'cursor-pointer' : ''}`}
                    >
                      <td className="px-6 py-5 text-sm font-bold text-gray-700">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-900">{dateStr}</span>
                          <span className="text-[11px] text-gray-400 font-medium">{timeStr}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${transaction.type === 'Income' ? 'bg-[#ebf4ff]' : transaction.type === 'Expense' ? 'bg-red-50 text-red-600' : 'bg-[#e6f0ff]'}`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        {isLinkedTransaction ? (
                          contact ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-900">{contact.name}</span>
                              <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">{contact.type}</span>
                            </div>
                          ) : (
                            <span className="text-gray-300 font-bold text-xs">-</span>
                          )
                        ) : creator ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{creator}</span>
                            <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Created By</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 font-bold text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <p className="text-sm font-bold text-gray-800">{allCategories.find((entry) => entry.id === transaction.category)?.name || transaction.category}</p>
                          <p className="text-xs text-gray-400 italic max-w-xs truncate">{transaction.description}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className={`font-black text-base ${transaction.type === 'Income' ? 'text-emerald-600' : transaction.type === 'Expense' ? 'text-red-600' : 'text-black'}`}>
                          {transaction.type === 'Income' ? '+' : transaction.type === 'Expense' ? '-' : ''}
                          {formatCurrency(transaction.amount)}
                        </span>
                      </td>

                      <td className="px-6 py-5 sm:hidden relative z-[999]" onClick={(event) => event.stopPropagation()}>
                        {showActions && (
                          <div className="relative z-[999]">
                            <button
                              onClick={(event) => {
                                const target = event.currentTarget as HTMLElement;
                                if (openActionsMenu === transaction.id) {
                                  closeActionsMenu();
                                } else {
                                  setOpenActionsMenu(transaction.id);
                                  setAnchorEl(target);
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-lg transition-all"
                            >
                              {ICONS.More}
                            </button>
                            <PortalMenu anchorEl={anchorEl} open={openActionsMenu === transaction.id} onClose={closeActionsMenu}>
                              <>
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      handleEditTransaction(transaction);
                                      closeActionsMenu();
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700"
                                  >
                                    {ICONS.Edit} Edit
                                  </button>
                                )}
                                {canEdit && canPreviewAttachment && <div className="border-t my-1"></div>}
                                {canPreviewAttachment && (
                                  <button
                                    onClick={() => {
                                      handleViewAttachment(transaction);
                                      closeActionsMenu();
                                    }}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"
                                  >
                                    {ICONS.View} View Attachment
                                  </button>
                                )}
                              </>
                            </PortalMenu>
                          </div>
                        )}
                      </td>

                      {hoveredRow === transaction.id && showActions && (
                        <td
                          className="absolute right-6 top-1/2 -translate-y-1/2 z-10 animate-in fade-in slide-in-from-right-2 duration-200 hidden sm:table-cell"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#ebf4ff]">
                            {canEdit && (
                              <button
                                onClick={() => handleEditTransaction(transaction)}
                                className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all"
                                title="Edit"
                              >
                                {ICONS.Edit}
                              </button>
                            )}
                            {canEdit && canPreviewAttachment && <div className="h-5 w-px bg-gray-100 mx-1"></div>}
                            {canPreviewAttachment && (
                              <button
                                onClick={() => handleViewAttachment(transaction)}
                                className="p-2.5 text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all"
                                title="View attachment"
                              >
                                {ICONS.View}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination page={effectivePage} totalPages={totalPages} onPageChange={(nextPage) => setPage(nextPage)} disabled={transactionsLoading} />
    </div>
  );
};

export default Transactions;
