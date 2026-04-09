
import React, { useState, useMemo, useEffect } from 'react';
import PortalMenu from '../components/PortalMenu';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Order, OrderStatus, hasAdminAccess, isEmployeeRole } from '../types';
import { formatCurrency, ICONS, getStatusColor } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, TableLoadingSkeleton, OrderCompletionModal, type OrderCompletionFormState, SteadfastModal, CarryBeeModal, PaperflyModal } from '../components';
import { theme } from '../theme';
import { useAuth } from '../src/contexts/AuthProvider';
import { useOrdersPage, useUsers, useOrderSettings, useSystemDefaults } from '../src/hooks/useQueries';
import Pagination from '../src/components/Pagination';
import { useCompletePickedOrder, useCreateOrder } from '../src/hooks/useMutations';
import { DEFAULT_PAGE_SIZE } from '../src/services/supabaseQueries';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { useUrlSyncedSearchQuery } from '../src/hooks/useUrlSyncedSearchQuery';
import { handlePrintOrder } from '../src/utils/printUtils';
import { buildHistoryBackState, getPositivePageParam } from '../src/utils/navigation';
import { buildLocalDateTime, formatDate, getDateTimeFilters, getOrderActivityDate, getTodayDate } from '../utils';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = hasAdminAccess(user?.role);
  const isEmployee = isEmployeeRole(user?.role);
  const createCompletionForm = (order?: Order | null): OrderCompletionFormState => ({
    outcome: 'Delivered',
    date: getTodayDate(),
    time: new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: false }),
    accountId: '',
    amount: order ? Math.max(order.total - order.paidAmount, 0) : 0,
    paymentMethod: '',
    categoryId: '',
    note: '',
  });

  const { data: systemDefaults } = useSystemDefaults();
  const pageSize = systemDefaults?.recordsPerPage || DEFAULT_PAGE_SIZE;

  const [searchParams, setSearchParams] = useSearchParams();
  const currentSearchParams = searchParams.toString();
  const urlPage = getPositivePageParam(searchParams.get('page'));
  const urlStatusTab = (searchParams.get('status') as OrderStatus | null) || 'All';
  const urlFilterRange = (searchParams.get('range') as FilterRange | null) || 'All Time';
  const urlCreatedByFilter = searchParams.get('createdBy') || 'all';
  const urlCustomDates = {
    from: searchParams.get('from') || '',
    to: searchParams.get('to') || '',
  };
  const { searchQuery } = useUrlSyncedSearchQuery(searchParams.get('search') || '');
  const [syncedSearchParams, setSyncedSearchParams] = useState<string | null>(null);
  const shouldHydrateFromUrl = syncedSearchParams !== currentSearchParams;

  const [filterRange, setFilterRange] = useState<FilterRange>(urlFilterRange);
  const [customDates, setCustomDates] = useState(urlCustomDates);
  const [statusTab, setStatusTab] = useState<OrderStatus | 'All'>(urlStatusTab);
  const [createdByFilter, setCreatedByFilter] = useState<string>(urlCreatedByFilter);
  const [page, setPage] = useState<number>(urlPage);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const previousSearchQueryRef = React.useRef(searchQuery);

  const [completionOrder, setCompletionOrder] = useState<Order | null>(null);
  const [showSteadfast, setShowSteadfast] = useState<string | null>(null);
  const [showCarryBee, setShowCarryBee] = useState<string | null>(null);
  const [showPaperfly, setShowPaperfly] = useState<string | null>(null);
  const [completionForm, setCompletionForm] = useState<OrderCompletionFormState>(createCompletionForm());

  const { data: users = [] } = useUsers();

  useEffect(() => {
    if (!shouldHydrateFromUrl) return;

    setPage(urlPage);
    setStatusTab(urlStatusTab);
    setFilterRange(urlFilterRange);
    setCreatedByFilter(urlCreatedByFilter);
    setCustomDates(urlCustomDates);
    setSyncedSearchParams(currentSearchParams);
  }, [
    shouldHydrateFromUrl,
    urlPage,
    urlStatusTab,
    urlFilterRange,
    urlCreatedByFilter,
    urlCustomDates,
    currentSearchParams,
  ]);

  // Force-refresh orders list when returning from OrderDetails after creating a new order.
  useEffect(() => {
    const navState = (location.state as any) || {};
    if (!navState.refreshOrders) return;

    queryClient.refetchQueries({ queryKey: ['orders'], exact: false, type: 'active' });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, queryClient, navigate]);

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
  const effectiveStatusTab = shouldHydrateFromUrl ? urlStatusTab : statusTab;
  const effectiveFilterRange = shouldHydrateFromUrl ? urlFilterRange : filterRange;
  const effectiveCreatedByFilter = shouldHydrateFromUrl ? urlCreatedByFilter : createdByFilter;
  const effectiveCustomDates = shouldHydrateFromUrl ? urlCustomDates : customDates;

  // Compute server-side created_at range based on selected filter
  const timeFilters = useMemo(() => {
    return getDateTimeFilters(effectiveFilterRange, effectiveCustomDates);
  }, [effectiveFilterRange, effectiveCustomDates]);

  // Compute createdByIds based on createdByFilter
  const createdByIds = useMemo(() => {
    if (effectiveCreatedByFilter === 'all') return undefined;
    if (effectiveCreatedByFilter === 'admins') {
      return users.filter(u => hasAdminAccess(u.role)).map(u => u.id);
    }
    if (effectiveCreatedByFilter === 'employees') {
      return users.filter(u => isEmployeeRole(u.role)).map(u => u.id);
    }
    return [effectiveCreatedByFilter];
  }, [effectiveCreatedByFilter, users]);

  const { data: ordersPage, isFetching: ordersLoading } = useOrdersPage(effectivePage, pageSize, {
    status: effectiveStatusTab === 'All' ? undefined : effectiveStatusTab,
    from: timeFilters.from,
    to: timeFilters.to,
    search: searchQuery,
    createdByIds,
  });
  const orders = ordersPage?.data ?? [];
  const totalOrdersCount = ordersPage?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalOrdersCount / pageSize));

  const { data: orderSettings } = useOrderSettings();

  useEffect(() => {
    if (shouldHydrateFromUrl) return;

    const params: Record<string, string> = {};
    if (effectivePage && effectivePage > 1) params.page = String(effectivePage);
    if (effectiveStatusTab && effectiveStatusTab !== 'All') params.status = String(effectiveStatusTab);
    if (effectiveFilterRange && effectiveFilterRange !== 'All Time') params.range = effectiveFilterRange;
    if (effectiveCustomDates.from) params.from = effectiveCustomDates.from;
    if (effectiveCustomDates.to) params.to = effectiveCustomDates.to;
    if (effectiveCreatedByFilter && effectiveCreatedByFilter !== 'all') params.createdBy = effectiveCreatedByFilter;
    if (searchQuery) params.search = searchQuery;

    if (new URLSearchParams(params).toString() !== currentSearchParams) {
      setSearchParams(params, { replace: true });
    }
  }, [
    shouldHydrateFromUrl,
    currentSearchParams,
    effectivePage,
    effectiveStatusTab,
    effectiveFilterRange,
    effectiveCustomDates.from,
    effectiveCustomDates.to,
    effectiveCreatedByFilter,
    searchQuery,
    setSearchParams,
  ]);

  // Wrapper functions that reset page AND apply filter (atomic operation)
  const handleStatusTabChange = (newStatus: OrderStatus | 'All') => {
    setPage(1);
    setStatusTab(newStatus);
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

  const createOrderMutation = useCreateOrder();
  const completePickedOrderMutation = useCompletePickedOrder();

  // Create a Map for O(1) user lookups instead of O(n) array searching
  const userMap = useMemo(() => {
    return new Map(users.map(u => [u.id, u]));
  }, [users]);


  // creatorName is delivered alongside the order via the joined query
  const getCreatorName = (order: Order) => order.creatorName || '';

  // orders already filtered/paginated by the server based on active filters
  const displayedOrders = orders;

  const handleDuplicate = async (order: Order) => {
    if (!orderSettings) {
      toast.error('Unable to generate new order number. Please try again.');
      return;
    }

    const newOrderNumber = `${orderSettings.prefix}${orderSettings.nextNumber}`;
    const newOrder: Omit<Order, 'id'> = {
      orderNumber: newOrderNumber,
      orderDate: getTodayDate(),
      customerId: order.customerId,
      createdBy: user?.id || order.createdBy,
      status: OrderStatus.ON_HOLD,
      items: order.items,
      subtotal: order.subtotal,
      discount: order.discount,
      shipping: order.shipping,
      total: order.total,
      paidAmount: 0,
      history: order.history,
    };
    try {
      await createOrderMutation.mutateAsync(newOrder);
      // New orders appear on page 1 (newest-first) - cache is updated deterministically by the mutation hook
      toast.success('Order duplicated successfully');
    } catch (err) {
      console.error('Failed to duplicate order', err);
      toast.error('Failed to duplicate order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const openCompletionModal = (order: Order) => {
    setCompletionForm(createCompletionForm(order));
    setCompletionOrder(order);
  };

  const handleCompletePickedOrder = async () => {
    if (!completionOrder) return;

    try {
      if (!completionForm.accountId) {
        toast.error('Please select an account');
        return;
      }
      if (completionForm.amount <= 0) {
        toast.error(completionForm.outcome === 'Returned' ? 'Please enter the return expense amount' : 'Please enter the received amount');
        return;
      }
      if (completionForm.outcome === 'Returned' && !completionForm.paymentMethod) {
        toast.error('Please select a payment method');
        return;
      }
      if (completionForm.outcome === 'Returned' && !completionForm.categoryId) {
        toast.error('Please select an expense category');
        return;
      }

      const fullDatetime = buildLocalDateTime(completionForm.date, completionForm.time);
      if (!fullDatetime) {
        toast.error('Please enter a valid date and time');
        return;
      }
      await completePickedOrderMutation.mutateAsync({
        orderId: completionOrder.id,
        outcome: completionForm.outcome,
        date: fullDatetime.toISOString(),
        accountId: completionForm.accountId,
        amount: completionForm.amount,
        paymentMethod: completionForm.outcome === 'Returned' ? completionForm.paymentMethod : undefined,
        categoryId: completionForm.outcome === 'Returned' ? completionForm.categoryId : undefined,
        note: completionForm.outcome === 'Returned' ? completionForm.note : undefined,
      });

      setCompletionOrder(null);
      setCompletionForm(createCompletionForm());
      toast.success(
        completionForm.outcome === 'Returned'
          ? `Order #${completionOrder.orderNumber} marked as returned`
          : `Order #${completionOrder.orderNumber} marked as delivered`
      );
    } catch (err) {
      console.error('Failed to finalize order:', err);
      toast.error('Failed to finalize order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const extractSteadfastTrackingFromHistory = (historyText?: string) => {
    const text = String(historyText || '').trim();
    if (!text) return '';
    const patterns = [
      /tracking(?:\s*code)?\s*[:#-]?\s*([a-z0-9-]+)/i,
      /consignment(?:\s*id)?\s*[:#-]?\s*([a-z0-9-]+)/i,
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) return String(match[1]).trim();
    }
    return '';
  };

  const handleOpenTracking = (order: Order) => {
    const steadfastTracking = String(
      order.steadfastConsignmentId || extractSteadfastTrackingFromHistory(order.history?.courier) || ''
    ).trim();
    const carryBeeConsignment = String(order.carrybeeConsignmentId || '').trim();
    const paperflyTracking = String(order.paperflyTrackingNumber || '').trim();
    const courierHistory = String(order.history?.courier || '').toLowerCase();

    if (steadfastTracking) {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(steadfastTracking).catch(() => undefined);
      }
      toast.success(`Steadfast tracking code copied: ${steadfastTracking}`);
      window.open('https://steadfast.com.bd/tracking', '_blank', 'noopener,noreferrer');
      return;
    }

    if (carryBeeConsignment) {
      window.open(`https://merchant.carrybee.com/order-track/${encodeURIComponent(carryBeeConsignment)}`, '_blank', 'noopener,noreferrer');
      return;
    }

    if (paperflyTracking) {
      window.open(`https://go.paperfly.com.bd/track/order/${encodeURIComponent(paperflyTracking)}`, '_blank', 'noopener,noreferrer');
      return;
    }

    if (courierHistory.includes('steadfast')) {
      toast.warning('Steadfast tracking code is missing for this order');
      return;
    }

    toast.warning('Tracking unavailable');
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="md:text-2xl text-xl font-black text-gray-900 tracking-tight">Orders</h2>
        </div>
        <Button
          onClick={() => navigate('/orders/new')}
          variant="primary"
          size="md"
          icon={ICONS.Plus}
        >
          New Order
        </Button>
      </div>
      {/* Pagination controls moved below the table to match other pages */}

      <FilterBar 
        title="Orders"
        filterRange={effectiveFilterRange}
        setFilterRange={handleFilterRangeChange}
        customDates={effectiveCustomDates}
        setCustomDates={handleCustomDatesChange}
        statusTab={effectiveStatusTab}
        setStatusTab={handleStatusTabChange}
        statusOptions={Object.values(OrderStatus)}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-bold text-gray-700">Created By:</label>
          <select
            value={effectiveCreatedByFilter}
            onChange={(e) => handleCreatedByFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Users</option>
            {users.some(u => hasAdminAccess(u.role)) && <option value="admins">Admin Access</option>}
            {users.some(u => isEmployeeRole(u.role)) && <option value="employees">All Employees</option>}
            <optgroup label="Specific Users">
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </optgroup>
          </select>
          {isEmployee && (
            <p className="text-xs font-semibold text-gray-500">
              You can review all team orders here. Edit remains limited to your own draft orders.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Created By</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Net Amount</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] sm:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ordersLoading ? (
                <TableLoadingSkeleton columns={5} rows={8} />
              ) : displayedOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic font-medium">No sales orders found for this period.</td></tr>
              ) : displayedOrders.map((order) => {
                const isOwner = order.createdBy === user?.id;
                const custName = order.customerName ?? 'Unknown';
                const courierHistory = String(order.history?.courier || '').toLowerCase();
                const sentToSteadfast = courierHistory.includes('steadfast') || !!order.steadfastConsignmentId;
                const sentToCarryBee = courierHistory.includes('carrybee') || !!order.carrybeeConsignmentId;
                const sentToPaperfly = courierHistory.includes('paperfly') || !!order.paperflyTrackingNumber;
                const sentToAnyCourier = sentToSteadfast || sentToCarryBee || sentToPaperfly;
                const hasEmployeeActions = sentToAnyCourier || (isOwner && order.status === OrderStatus.ON_HOLD);
                return (
                  <tr 
                    key={order.id} 
                    onMouseEnter={() => setHoveredRow(order.id)} 
                    onMouseLeave={() => setHoveredRow(null)} 
                    onClick={() => navigate(`/orders/${order.id}`, { state: buildHistoryBackState(location) })} 
                    className="group relative hover:bg-[#ebf4ff]/20 cursor-pointer transition-all"
                  >
                    <td className="px-6 py-5">
                      <span className="font-black text-gray-900">#{order.orderNumber}</span>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{formatDate(getOrderActivityDate(order))}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-gray-700">{custName}</span>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{order.customerPhone || ''}</p>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-gray-500">{getCreatorName(order) || '—'}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>{order.status}</span>
                      {(order.status === OrderStatus.PROCESSING || order.status === OrderStatus.PICKED) && sentToSteadfast && (
                        <img src="/uploads/steadfast.png" alt="Steadfast" className="inline-block w-5 h-5 rounded-full ml-2" />
                      )}
                      {(order.status === OrderStatus.PROCESSING || order.status === OrderStatus.PICKED) && sentToCarryBee && (
                        <img src="/uploads/carrybee.png" alt="CarryBee" className="inline-block w-5 h-5 rounded-full ml-2" />
                      )}
                      {(order.status === OrderStatus.PROCESSING || order.status === OrderStatus.PICKED) && sentToPaperfly && (
                        <img src="/uploads/paperfly.png" alt="Paperfly" className="inline-block w-5 h-5 rounded-full ml-2" />
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-black text-gray-900 text-base">{formatCurrency(order.total)}</span>
                      {order.paidAmount > 0 && (
                        <p className={`text-[10px] font-black uppercase tracking-tighter mt-1 text-green-500`}>
                          {`Paid: ${formatCurrency(order.paidAmount)}`}
                        </p>
                      )}
                    </td>

                    {/* Mobile Actions Dropdown */}
                    <td className="px-6 py-5 sm:hidden relative z-[999]" onClick={e => e.stopPropagation()}>
                      {(!isEmployee || hasEmployeeActions) && (
                        <div className="relative z-[999]">
                          <button 
                            onClick={(e) => {
                              const target = e.currentTarget as HTMLElement;
                              if (openActionsMenu === order.id) {
                                setOpenActionsMenu(null);
                                setAnchorEl(null);
                              } else {
                                setOpenActionsMenu(order.id);
                                setAnchorEl(target);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-lg transition-all"
                          >
                            {ICONS.More}
                          </button>
                          <PortalMenu anchorEl={anchorEl} open={openActionsMenu === order.id} onClose={() => { setOpenActionsMenu(null); setAnchorEl(null); }}>
                            {isEmployee ? (
                              <>
                                {isOwner && order.status === OrderStatus.ON_HOLD && (
                                  <>
                                    <button onClick={() => { navigate(`/orders/edit/${order.id}`); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Edit} Edit</button>
                                  </>
                                )}
                                {sentToAnyCourier && (
                                  <>
                                    <div className="border-t my-1"></div>
                                    <button
                                      onClick={() => { handleOpenTracking(order); setOpenActionsMenu(null); setAnchorEl(null); }}
                                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"
                                    >
                                      {ICONS.Courier} Tracking
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <button onClick={() => { navigate(`/orders/edit/${order.id}`); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Edit} Edit</button>
                                {order.status === OrderStatus.PICKED && (
                                  <button onClick={() => { openCompletionModal(order); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Check} Mark as Completed</button>
                                )}
                                <div className="border-t my-1"></div>
                                <button onClick={() => { handlePrintOrder(order.id, navigate); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Print} Print</button>
                                {sentToAnyCourier && (
                                  <button
                                    onClick={() => { handleOpenTracking(order); setOpenActionsMenu(null); setAnchorEl(null); }}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"
                                  >
                                    {ICONS.Courier} Tracking
                                  </button>
                                )}
                                {order.status !== OrderStatus.PICKED && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.RETURNED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.ON_HOLD && !sentToAnyCourier && (
                                  <>
                                    <div className="border-t my-1"></div>
                                    <button onClick={() => { setShowSteadfast(order.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"><img src="../uploads/steadfast.png" alt="Steadfast" className="w-5 h-5 rounded-full"/> <span>Add to Steadfast</span></button>
                                    <button onClick={() => { setShowCarryBee(order.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"><img src="../uploads/carrybee.png" alt="CarryBee" className="w-5 h-5 rounded-full"/> <span>Add to CarryBee</span></button>
                                    <button onClick={() => { setShowPaperfly(order.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"><img src="/uploads/paperfly.png" alt="Paperfly" className="w-5 h-5 rounded-full"/> <span>Add to Paperfly</span></button>
                                  </>
                                )}
                              </>
                            )}
                          </PortalMenu>
                        </div>
                      )}
                    </td>

                    {/* Desktop Hover Actions: admins keep row actions; employees see Edit on their own drafts, otherwise tracking only */}
                    {hoveredRow === order.id && (isAdmin || (isEmployee && (sentToAnyCourier || (isOwner && order.status === OrderStatus.ON_HOLD)))) && (
                      <td className="absolute right-6 top-1/2 -translate-y-1/2 z-10 animate-in fade-in slide-in-from-right-2 duration-200 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#ebf4ff]">
                          {isEmployee ? (
                            <>
                              {isOwner && order.status === OrderStatus.ON_HOLD && (
                                <>
                                  <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Edit">{ICONS.Edit}</button>
                                </>
                              )}
                              {sentToAnyCourier && (
                                <button onClick={() => handleOpenTracking(order)} className="p-2.5 text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Tracking">{ICONS.Courier}</button>
                              )}
                            </>
                          ) : (
                            <>
                              <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Edit">{ICONS.Edit}</button>
                              {order.status === OrderStatus.PICKED && (
                                <button onClick={() => openCompletionModal(order)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Mark as Completed">{ICONS.Check}</button>
                              )}
                              <button onClick={() => handlePrintOrder(order.id, navigate)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Print">{ICONS.Print}</button>
                              {sentToAnyCourier && (
                                <button onClick={() => handleOpenTracking(order)} className="p-2.5 text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Tracking">{ICONS.Courier}</button>
                              )}
                              {order.status !== OrderStatus.PICKED && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.RETURNED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.ON_HOLD && !sentToAnyCourier && (
                                <>
                                  <div className="h-5 w-px bg-gray-100 mx-1"></div>
                                  <button onClick={() => setShowSteadfast(order.id)} className="px-1 py-1 text-[9px] font-black hover:bg-[#ebf4ff] rounded-lg" title="Send to Steadfast"><img src="/uploads/steadfast.png" alt="Steadfast" className="w-6 h-6 rounded-full"/></button>
                                  <button onClick={() => setShowCarryBee(order.id)} className="px-1 py-1 text-[9px] font-black hover:bg-orange-50 rounded-lg" title="Send to CarryBee"><img src="/uploads/carrybee.png" alt="CarryBee" className="w-6 h-6 rounded-full"/></button>
                                  <button onClick={() => setShowPaperfly(order.id)} className="px-1 py-1 text-[9px] font-black hover:bg-[#ebf4ff] rounded-lg" title="Send to Paperfly"><img src="/uploads/paperfly.png" alt="Paperfly" className="w-6 h-6 rounded-full"/></button>
                                  <div className="h-5 w-px bg-gray-100 mx-1"></div>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            {`Showing ${Math.min((effectivePage - 1) * pageSize + 1, totalOrdersCount || 0)} - ${Math.min(effectivePage * pageSize, totalOrdersCount || 0)} of ${totalOrdersCount} orders`}
          </div>
          <Pagination
            page={effectivePage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={(p) => setPage(p)}
            disabled={ordersLoading}
          />
        </div>
      <OrderCompletionModal
        isOpen={!!completionOrder}
        onClose={() => setCompletionOrder(null)}
        onSubmit={handleCompletePickedOrder}
        order={completionOrder}
        form={completionForm}
        setForm={setCompletionForm}
        isLoading={completePickedOrderMutation.isPending}
      />

      <SteadfastModal 
        isOpen={!!showSteadfast} 
        onClose={() => setShowSteadfast(null)}
        order={showSteadfast ? orders.find(o => o.id === showSteadfast) : null}
        customer={
          showSteadfast
            ? (() => {
                const o = orders.find(o => o.id === showSteadfast);
                return o
                  ? { id: o.customerId, name: o.customerName || '', phone: o.customerPhone || '', address: o.customerAddress || '', totalOrders: 0, dueAmount: 0 }
                  : null;
              })()
            : null
        }
      />
      <CarryBeeModal 
        isOpen={!!showCarryBee} 
        onClose={() => setShowCarryBee(null)}
        order={showCarryBee ? orders.find(o => o.id === showCarryBee) : null}
        customer={
          showCarryBee
            ? (() => {
                const o = orders.find(o => o.id === showCarryBee);
                return o
                  ? { id: o.customerId, name: o.customerName || '', phone: o.customerPhone || '', address: o.customerAddress || '', totalOrders: 0, dueAmount: 0 }
                  : null;
              })()
            : null
        }
      />
      <PaperflyModal
        isOpen={!!showPaperfly}
        onClose={() => setShowPaperfly(null)}
        order={showPaperfly ? orders.find(o => o.id === showPaperfly) : null}
        customer={
          showPaperfly
            ? (() => {
                const o = orders.find(o => o.id === showPaperfly);
                return o
                  ? { id: o.customerId, name: o.customerName || '', phone: o.customerPhone || '', address: o.customerAddress || '', totalOrders: 0, dueAmount: 0 }
                  : null;
              })()
            : null
        }
      />
    </div>
  );
};

export default Orders;

