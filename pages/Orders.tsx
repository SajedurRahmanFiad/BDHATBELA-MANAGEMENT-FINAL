
import React, { useState, useMemo } from 'react';
import PortalMenu from '../components/PortalMenu';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { Order, OrderStatus, UserRole, Transaction } from '../types';
import { formatCurrency, ICONS, getStatusColor } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';
import { Button, TableLoadingSkeleton, CommonPaymentModal, SteadfastModal, CarryBeeModal } from '../components';
import { theme } from '../theme';
import { useOrders, useCustomers, useAccounts, useUsers, useOrderSettings } from '../src/hooks/useQueries';
import { useCreateOrder, useDeleteOrder, useUpdateOrder, useCreateTransaction, useUpdateAccount } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { useSearch } from '../src/contexts/SearchContext';
import { handlePrintOrder } from '../src/utils/printUtils';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const { searchQuery } = useSearch();
  const user = db.currentUser;
  const isAdmin = user?.role === UserRole.ADMIN;
  const isEmployee = user?.role === UserRole.EMPLOYEE;

  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [statusTab, setStatusTab] = useState<OrderStatus | 'All'>('All');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [showSteadfast, setShowSteadfast] = useState<string | null>(null); // Order ID for Steadfast modal
  const [showCarryBee, setShowCarryBee] = useState<string | null>(null); // Order ID for CarryBee modal
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: false }),
    accountId: '',
    amount: 0
  });

  const { data: orders = [], isPending: ordersLoading } = useOrders();
  const { data: customers = [] } = useCustomers();
  const { data: accounts = [] } = useAccounts();
  const { data: users = [] } = useUsers();
  const { data: orderSettings } = useOrderSettings();

  const createOrderMutation = useCreateOrder();
  const deleteOrderMutation = useDeleteOrder();
  const updateOrderMutation = useUpdateOrder();
  const createTransactionMutation = useCreateTransaction();
  const updateAccountMutation = useUpdateAccount();

  // Create a Map for O(1) user lookups instead of O(n) array searching
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

  // Helper to get creator name from createdBy field or history
  const getCreatorName = (order: Order) => {
    // First try to lookup from createdBy database field using O(1) Map lookup
    if (order.createdBy?.trim()) {
      const user = userMap.get(order.createdBy);
      if (user?.name) return user.name;
    }
    
    // Fallback: extract from history for older records
    if (order.history?.created) {
      // Orders history format: "{name} created this order on ..."
      const match = order.history.created.match(/^(.+?)\s+created this order on/);
      if (match && match[1]) return match[1];
    }
    
    return null;
  };

  const filteredOrders = useMemo(() => {
    let results = orders
      .filter(o => isWithinRange(o.orderDate))
      .filter(o => statusTab === 'All' || o.status === statusTab);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(order => {
        const customer = customers.find(c => c.id === order.customerId);
        const creatorName = getCreatorName(order);
        return (
          order.orderNumber.toLowerCase().includes(query) ||
          customer?.name.toLowerCase().includes(query) ||
          customer?.phone.includes(query) ||
          creatorName?.toLowerCase().includes(query)
        );
      });
    }

    return results;
  }, [orders, filterRange, customDates, statusTab, searchQuery, customers]);

  const handleDuplicate = async (order: Order) => {
    if (!orderSettings) {
      toast.error('Unable to generate new order number. Please try again.');
      return;
    }

    const newOrderNumber = `${orderSettings.prefix}${orderSettings.nextNumber}`;
    const newOrder: Omit<Order, 'id'> = {
      orderNumber: newOrderNumber,
      orderDate: new Date().toISOString().split('T')[0],
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
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order duplicated successfully');
    } catch (err) {
      console.error('Failed to duplicate order', err);
      toast.error('Failed to duplicate order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    try {
      await deleteOrderMutation.mutateAsync(id);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      console.error('Failed to delete order', err);
    }
  };

  const openPaymentModal = (order: Order) => {
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: false }),
      accountId: '',
      amount: order.total - order.paidAmount
    });
    setShowPaymentModal(order);
  };

  const handleAddPayment = async () => {
    if (!showPaymentModal) return;
    const order = showPaymentModal;
    
    try {
      // Try to find account in cached data, fallback to provided ID if not found
      // (accounts might not have fully loaded when payment modal opens)
      let account = accounts.find(a => a.id === paymentForm.accountId);
      
      if (!account) {
        // If account not found in cache, it might not be in the list, so just verify it has an ID
        // The backend will validate that the account exists
        if (!paymentForm.accountId) {
          toast.error('Please select an account');
          return;
        }
        // Account not in visible list, but proceed with the ID provided by user
        // (backend RLS will validate it exists and belongs to user)
        account = { 
          id: paymentForm.accountId, 
          name: 'Selected Account',
          type: 'Bank',
          openingBalance: 0,
          currentBalance: 0
        };
      }

      // Check if this is a partial payment (indicates order has remaining balance to track)
      const shouldCreateShippingExpense = paymentForm.amount < order.total;

      // Create full ISO datetime from date and time
      const [hours, minutes] = paymentForm.time.split(':').map(Number);
      const fullDatetime = new Date(paymentForm.date);
      fullDatetime.setHours(hours, minutes, 0, 0);
      const isoDatetime = fullDatetime.toISOString();

      // Create transactions. If there are independent inserts (income + expense), run them in parallel
      const incomeTx = {
        date: isoDatetime,
        type: 'Income' as const,
        category: db.settings.defaults.incomeCategoryId || 'income_sales',
        accountId: paymentForm.accountId,
        amount: order.total,
        description: `Payment for Order #${order.orderNumber}`,
        referenceId: order.id,
        contactId: order.customerId,
        paymentMethod: db.settings.defaults.paymentMethod || 'Cash',
        createdBy: user.id,
      };

      if (shouldCreateShippingExpense) {
        const remainingAmount = order.total - paymentForm.amount;
        const expenseTx = {
          date: isoDatetime,
          type: 'Expense' as const,
          category: 'expense_shipping',
          accountId: paymentForm.accountId,
          amount: remainingAmount,
          description: `Shipping costs for Order #${order.orderNumber}`,
          paymentMethod: db.settings.defaults.paymentMethod || 'Cash',
          createdBy: user.id,
        };

        // Run both insertions in parallel to reduce overall latency
        await Promise.all([
          createTransactionMutation.mutateAsync(incomeTx),
          createTransactionMutation.mutateAsync(expenseTx),
        ]);
      } else {
        // Only income transaction required
        await createTransactionMutation.mutateAsync(incomeTx);
      }

      // PARALLEL: Step 3 - Update account balance and order status together
      const balanceChange = paymentForm.amount;
      const updatedPaid = (order.paidAmount ?? 0) + paymentForm.amount;
      const updatedStatus = OrderStatus.COMPLETED;
      
      await Promise.all([
        updateAccountMutation.mutateAsync({
          id: account.id,
          updates: {
            currentBalance: (account.currentBalance ?? 0) + balanceChange,
          },
        }),
        updateOrderMutation.mutateAsync({
          id: order.id,
          updates: {
            paidAmount: updatedPaid,
            status: updatedStatus,
          },
        })
      ]);

      // Close modal immediately - queries will auto-update via React Query
      setShowPaymentModal(null);
      // Invalidate to force fresh data (usually cached for 5 min)
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (err) {
      console.error('Failed to add payment:', err);
      toast.error('Failed to add payment: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
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

      <FilterBar 
        title="Orders"
        filterRange={filterRange}
        setFilterRange={setFilterRange}
        customDates={customDates}
        setCustomDates={setCustomDates}
        statusTab={statusTab}
        setStatusTab={setStatusTab}
        statusOptions={Object.values(OrderStatus)}
      />

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
                <TableLoadingSkeleton columns={6} rows={8} />
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-gray-400 italic font-medium">No sales orders found for this period.</td></tr>
              ) : filteredOrders.map((order) => {
                const isModifiable = isAdmin || order.status === OrderStatus.ON_HOLD;
                const isOwner = order.createdBy === user?.id;
                return (
                  <tr 
                    key={order.id} 
                    onMouseEnter={() => setHoveredRow(order.id)} 
                    onMouseLeave={() => setHoveredRow(null)} 
                    onClick={() => navigate(`/orders/${order.id}`)} 
                    className="group relative hover:bg-[#ebf4ff]/20 cursor-pointer transition-all"
                  >
                    <td className="px-6 py-5">
                      <span className="font-black text-gray-900">#{order.orderNumber}</span>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{new Date(order.orderDate).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-gray-700">{customers.find(c => c.id === order.customerId)?.name || 'Unknown'}</span>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{customers.find(c => c.id === order.customerId)?.phone}</p>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-gray-500">{getCreatorName(order) || '—'}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>{order.status}</span>
                      {order.status !== OrderStatus.COMPLETED && order.history?.courier?.includes('Steadfast') && (
                        <img src="/uploads/steadfast.png" alt="Steadfast" className="inline-block w-5 h-5 rounded-full ml-2" />
                      )}
                      {order.status !== OrderStatus.COMPLETED && order.history?.courier?.includes('CarryBee') && (
                        <img src="/uploads/carrybee.png" alt="CarryBee" className="inline-block w-5 h-5 rounded-full ml-2" />
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
                            isOwner ? (
                              <button onClick={() => { navigate(`/orders/edit/${order.id}`); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Edit} Edit</button>
                            ) : (
                              <button disabled className="w-full text-left px-4 py-2.5 text-sm text-gray-400 flex items-center gap-2 font-bold">{ICONS.More} No Actions</button>
                            )
                          ) : (
                            <>
                              <button onClick={() => { navigate(`/orders/edit/${order.id}`); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Edit} Edit</button>
                              {order.status !== OrderStatus.COMPLETED && (
                                <button onClick={() => { openPaymentModal(order); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Banking} Payment</button>
                              )}
                              <div className="border-t my-1"></div>
                              <button onClick={() => { handlePrintOrder(order.id, navigate); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Print} Print</button>
                              <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">{ICONS.Download} Download</button>
                              {order.status !== OrderStatus.PICKED && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.ON_HOLD && !order.history?.courier && (
                                <>
                                  <div className="border-t my-1"></div>
                                  <button onClick={() => { setShowSteadfast(order.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"><img src="../uploads/steadfast.png" alt="Steadfast" className="w-5 h-5 rounded-full"/> <span>Add to Steadfast</span></button>
                                  <button onClick={() => { setShowCarryBee(order.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-[#0f2f57]"><img src="../uploads/carrybee.png" alt="CarryBee" className="w-5 h-5 rounded-full"/> <span>Add to CarryBee</span></button>
                                </>
                              )}
                              <div className="border-t my-1"></div>
                              <button onClick={() => { handleDelete(order.id); setOpenActionsMenu(null); setAnchorEl(null); }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-2 font-bold text-red-600">{ICONS.Delete} Delete</button>
                            </>
                          )}
                        </PortalMenu>
                      </div>
                    </td>

                    {/* Desktop Hover Actions */}
                    {hoveredRow === order.id && (isAdmin || (isEmployee && isOwner)) && (
                      <td className="absolute right-6 top-1/2 -translate-y-1/2 z-10 animate-in fade-in slide-in-from-right-2 duration-200 hidden sm:table-cell" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#ebf4ff]">
                          {isEmployee ? (
                            isOwner ? (
                              <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Edit">{ICONS.Edit}</button>
                            ) : null
                          ) : (
                            <>
                              <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Edit">{ICONS.Edit}</button>
                              {order.status !== OrderStatus.COMPLETED && (
                                <button onClick={() => openPaymentModal(order)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Add Payment">{ICONS.Banking}</button>
                              )}
                              <button onClick={() => handlePrintOrder(order.id, navigate)} className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Print">{ICONS.Print}</button>
                              <button className="p-2.5 text-gray-400 hover:text-[#0f2f57] hover:bg-[#ebf4ff] rounded-xl transition-all" title="Download PDF">{ICONS.Download}</button>
                              {order.status !== OrderStatus.PICKED && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.ON_HOLD && !order.history?.courier && (
                                <>
                                  <div className="h-5 w-px bg-gray-100 mx-1"></div>
                                  <button onClick={() => setShowSteadfast(order.id)} className="px-1 py-1 text-[9px] font-black hover:bg-[#ebf4ff] rounded-lg" title="Send to Steadfast"><img src="/uploads/steadfast.png" alt="Steadfast" className="w-6 h-6 rounded-full"/></button>
                                  <button onClick={() => setShowCarryBee(order.id)} className="px-1 py-1 text-[9px] font-black hover:bg-orange-50 rounded-lg" title="Send to CarryBee"><img src="/uploads/carrybee.png" alt="CarryBee" className="w-6 h-6 rounded-full"/></button>
                                  <div className="h-5 w-px bg-gray-100 mx-1"></div>
                                </>
                              )}
                              {isModifiable && (
                                <button onClick={() => handleDelete(order.id)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">{ICONS.Delete}</button>
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

      <CommonPaymentModal
        isOpen={!!showPaymentModal}
        onClose={() => setShowPaymentModal(null)}
        onSubmit={handleAddPayment}
        accounts={accounts}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        isLoading={createTransactionMutation.isPending || updateAccountMutation.isPending || updateOrderMutation.isPending}
        title="Receive Payment"
        buttonText="Add Payment"
      />

      <SteadfastModal 
        isOpen={!!showSteadfast} 
        onClose={() => setShowSteadfast(null)}
        order={showSteadfast ? orders.find(o => o.id === showSteadfast) : null}
        customer={showSteadfast ? customers.find(c => c.id === orders.find(o => o.id === showSteadfast)?.customerId) : null}
      />
      <CarryBeeModal 
        isOpen={!!showCarryBee} 
        onClose={() => setShowCarryBee(null)}
        order={showCarryBee ? orders.find(o => o.id === showCarryBee) : null}
        customer={showCarryBee ? customers.find(c => c.id === orders.find(o => o.id === showCarryBee)?.customerId) : null}
      />
    </div>
  );
};

export default Orders;

