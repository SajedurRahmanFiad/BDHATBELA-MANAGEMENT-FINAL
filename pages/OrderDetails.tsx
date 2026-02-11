
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { OrderStatus, Order, UserRole, Transaction } from '../types';
import { formatCurrency, ICONS, getStatusColor } from '../constants';
import { Button, CommonPaymentModal, SteadfastModal, CarryBeeModal } from '../components';
import { theme } from '../theme';
import { useOrder, useCustomers, useUsers, useProducts, useAccounts, useCompanySettings, useInvoiceSettings } from '../src/hooks/useQueries';
import { useUpdateOrder, useCreateOrder, useCreateTransaction, useUpdateAccount } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { LoadingOverlay } from '../components';
import { handlePrintOrder } from '../src/utils/printUtils';

const OrderDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToastNotifications();
  const user = db.currentUser;
  const isAdmin = user.role === UserRole.ADMIN;
  
  // Query data
  const { data: order, isPending: orderLoading, error: orderError } = useOrder(id || '');
  const { data: customers = [] } = useCustomers();
  const { data: users = [] } = useUsers();
  const { data: products = [] } = useProducts();
  const { data: accounts = [] } = useAccounts();
  const { data: companySettings } = useCompanySettings();
  const { data: invoiceSettings } = useInvoiceSettings();
  
  // Mutations
  const updateMutation = useUpdateOrder();
  const createOrderMutation = useCreateOrder();
  const createTransactionMutation = useCreateTransaction();
  const updateAccountMutation = useUpdateAccount();
  
  // Modal and form state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSteadfast, setShowSteadfast] = useState(false);
  const [showCarryBee, setShowCarryBee] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: db.settings.defaults.accountId || '',
    amount: 0
  });
  const [isActionOpen, setIsActionOpen] = useState(false);
  
  // Get customer and created by user from query results
  const customer = order ? customers.find(c => c.id === order.customerId) : undefined;
  const createdByUser = order ? users.find(u => u.id === order.createdBy) : undefined;
  const isEmployee = user.role === UserRole.EMPLOYEE;
  const isOwner = order ? order.createdBy === user.id : false;
  
  const loading = orderLoading;

  if (loading) return <div className="p-8 text-center text-gray-500">Loading order...</div>;
  if (orderError || !order) return <div className="p-8 text-center text-gray-500">{orderError?.message || 'Order not found.'}</div>;

  const updateStatus = async (newStatus: OrderStatus, historyKey?: keyof Order['history'], historyText?: string) => {
    if (!order) return;
    try {
      const updates = { 
        ...order, 
        status: newStatus, 
        history: historyKey ? { ...order.history, [historyKey]: historyText } : order.history
      };
      await updateMutation.mutateAsync({ id: id!, updates });
      
      // Explicitly invalidate the query cache after mutation succeeds to prevent stale data (FIX: prevents "not found" race condition)
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      
      setIsActionOpen(false);
    } catch (err) {
      console.error('Failed to update order status:', err);
      toast.error('Failed to update order status');
    }
  };

  const markProcessing = async () => {
    const historyText = `Marked as processing by ${user.name}, on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    await updateStatus(OrderStatus.PROCESSING, 'processing', historyText);
  };

  const markPicked = async () => {
    const historyText = `Marked as picked by courier, on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    await updateStatus(OrderStatus.PICKED, 'picked', historyText);
  };

  const handleLifecyclePayment = async () => {
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

    const updatedPaid = order.paidAmount + paymentForm.amount;
    const paymentDate = new Date(paymentForm.date);
    const historyText = `Payment of ${formatCurrency(paymentForm.amount)} received by ${user.name} on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    
    // Check if this is a partial payment (indicates order has remaining balance to track)
    const shouldCreateShippingExpense = paymentForm.amount < order.total;
    
    // Mark as completed when any payment is added
    const status = OrderStatus.COMPLETED;
    
    const updatedOrder = { 
      ...order, 
      paidAmount: updatedPaid,
      status,
      history: { ...order.history, payment: historyText }
    };

    // Use mutations with sequential flow
    try {
      // SEQUENTIAL: Step 1 - Create income transaction FIRST (record full order total for revenue recognition)
      const incomeTxn: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        date: paymentForm.date,
        type: 'Income',
        category: db.settings.defaults.incomeCategoryId || 'income_sales',
        accountId: paymentForm.accountId,
        amount: order.total,
        description: `Payment for Order #${order.orderNumber}`,
        referenceId: order.id,
        contactId: order.customerId,
        paymentMethod: db.settings.defaults.paymentMethod || 'Cash',
        createdBy: user.id
      };
      await createTransactionMutation.mutateAsync(incomeTxn as any);

      // SEQUENTIAL: Step 2 - Create expense transaction for remaining balance (including shipping et al)
      if (shouldCreateShippingExpense) {
        const remainingAmount = order.total - paymentForm.amount;
        const shippingExpenseTxn: Transaction = {
          id: Math.random().toString(36).substr(2, 9),
          date: paymentForm.date,
          type: 'Expense',
          category: 'expense_shipping',
          accountId: paymentForm.accountId,
          amount: remainingAmount,
          description: `Shipping costs for Order #${order.orderNumber}`,
          paymentMethod: db.settings.defaults.paymentMethod || 'Cash',
          createdBy: user.id
        };
        await createTransactionMutation.mutateAsync(shippingExpenseTxn as any);
      }

      // PARALLEL: Step 3 - Update account balance and order status together
      const balanceChange = paymentForm.amount;
      const results = await Promise.allSettled([
        updateMutation.mutateAsync({ id: id!, updates: updatedOrder }),
        updateAccountMutation.mutateAsync({
          id: paymentForm.accountId,
          updates: { currentBalance: account.currentBalance + balanceChange }
        })
      ]);
      
      // Check if both mutations succeeded
      if (results[0].status === 'rejected' || results[1].status === 'rejected') {
        const orderStatus = results[0].status === 'rejected' ? 'failed' : 'succeeded';
        const accountStatus = results[1].status === 'rejected' ? 'failed' : 'succeeded';
        throw new Error(`Payment update failed: Order update ${orderStatus}, Account update ${accountStatus}`);
      }

      // Explicitly invalidate the query cache to ensure fresh data is fetched (FIX: prevents "not found" race condition)
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      // Also invalidate orders list to reflect the payment in list view
      queryClient.invalidateQueries({ queryKey: ['orders'] });

      setShowPaymentModal(false);
      toast.success('Payment recorded successfully');
    } catch (err) {
      console.error('Failed to record payment:', err);
      toast.error('Failed to record payment');
    }
  };

  const openPayment = () => {
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      accountId: '',
      amount: order.total - order.paidAmount
    });
    setShowPaymentModal(true);
  };

  const handleDuplicate = async () => {
    if (!order) return;
    try {
      const duplicateOrder = { 
        orderNumber: db.settings.order.prefix + db.settings.order.nextNumber,
        orderDate: order.orderDate,
        customerId: order.customerId,
        createdBy: user.id,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        discount: order.discount,
        shipping: order.shipping,
        total: order.total,
        notes: order.notes,
        paidAmount: 0,
        history: { created: `${user.name} created this order as duplicate on ${new Date().toLocaleDateString('en-BD')}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}` }
      };
      await createOrderMutation.mutateAsync(duplicateOrder as any);
      navigate('/orders');
    } catch (err) {
      toast.error('Failed to duplicate order: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <LoadingOverlay isLoading={loading && !order} message="Loading order details..." />
      {/* Header with Top Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-md md:text-2xl font-bold text-gray-900">{order.orderNumber}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(order.status)}`}>
            {order.status}
          </span>
          {order.status !== OrderStatus.COMPLETED && order.history?.courier?.includes('Steadfast') && (
            <img src="/uploads/steadfast.png" alt="Steadfast" className="w-6 h-6 rounded-full" />
          )}
          {order.status !== OrderStatus.COMPLETED && order.history?.courier?.includes('CarryBee') && (
            <img src="/uploads/carrybee.png" alt="CarryBee" className="w-6 h-6 rounded-full" />
          )}
        </div>
        
        <div className="flex items-center gap-2 relative">
          <button onClick={() => handlePrintOrder(id!, navigate)} className="hidden md:flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-lg bg-white hover:bg-gray-50 transition-all shadow-sm">
            {ICONS.Print} Print
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsActionOpen(!isActionOpen)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-lg ${theme.colors.primary[600]} text-white hover:${theme.colors.primary[700]} transition-all shadow-md`}
            >
              {ICONS.More} <span className="hidden md:inline">Actions</span>
            </button>
            {isActionOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsActionOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in duration-150 origin-top-right">
                  <button onClick={() => { handlePrintOrder(id!, navigate); setIsActionOpen(false); }} className="md:hidden w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
                    {ICONS.Print} Print
                  </button>
                  <div className="md:hidden border-t my-1"></div>
                  {(isAdmin || isOwner || (isEmployee && order.status === OrderStatus.ON_HOLD)) && (
                    <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
                      {ICONS.Edit} Edit Order
                    </button>
                  )}
                  {isAdmin && order.status !== OrderStatus.COMPLETED && (
                    <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700" onClick={openPayment}>
                      {ICONS.Banking} Add Payment
                    </button>
                  )}
                  <div className="border-t my-1"></div>
                  {isAdmin && (
                    <button onClick={() => updateStatus(OrderStatus.CANCELLED)} disabled={order.status === OrderStatus.COMPLETED} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 disabled:hover:bg-gray-50 flex items-center gap-2 text-red-500 font-bold disabled:text-gray-300 disabled:cursor-not-allowed">
                      {ICONS.Delete} Cancel Order
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* On-Screen Invoice Format */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-3 sm:p-4 md:p-6 lg:p-10 space-y-3 sm:space-y-4 lg:space-y-5">
            <div className="flex flex-row justify-between items-start gap-3 sm:gap-4 lg:gap-6">
              <div className="flex-1 min-w-0">
                {(companySettings?.logo || db.settings.company.logo) && (
                  <img 
                    src={companySettings?.logo || db.settings.company.logo} 
                    className="rounded-lg object-cover mb-2 sm:mb-3 lg:mb-4 w-auto h-auto"
                    style={{ 
                      maxWidth: 'min(100px, 20%)',
                      maxHeight: 'auto'
                    }}
                  />
                )}
                <h1 className="text-sm sm:text-base lg:text-xl font-black text-blue-600 uppercase tracking-tighter break-words">{companySettings?.name || db.settings.company.name}</h1>
                <div className="mt-1 sm:mt-2 text-[9px] sm:text-[10px] lg:text-xs text-gray-400 font-medium space-y-0.5 sm:space-y-1">
                  <p className="break-words">{companySettings?.address || db.settings.company.address}</p>
                  <p className="text-[8px] sm:text-[9px] break-words">{companySettings?.phone || db.settings.company.phone} • {companySettings?.email || db.settings.company.email}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <h2 className="text-sm sm:text-2xl lg:text-3xl font-black text-gray-300 uppercase leading-none mb-1 sm:mb-2 break-words">{invoiceSettings?.title || db.settings.invoice.title}</h2>
                <div className="space-y-0.5 sm:space-y-1 lg:space-y-1.5 text-[9px] sm:text-sm">
                  <p className="text-[9px] sm:text-xs lg:text-sm font-bold text-gray-900"><span className="text-gray-400 font-medium">Order No:&nbsp;&nbsp;</span> <span className="break-all">{order.orderNumber}</span></p>
                  <p className="text-[9px] sm:text-xs lg:text-sm font-bold text-gray-900"><span className="text-gray-400 font-medium">Date:&nbsp;&nbsp;</span> {order.orderDate}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 py-2 sm:py-3 lg:py-4">
              <p className="text-[8px] sm:text-[9px] lg:text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-2 sm:mb-3 lg:mb-4">Billed To</p>
              <h3 className="text-sm sm:text-base lg:text-lg font-black text-gray-900 break-words">{customer?.name}</h3>
              <p className="text-[10px] sm:text-xs lg:text-sm text-gray-500 leading-relaxed break-words">{customer?.address}</p>
              <p className="text-[10px] sm:text-xs lg:text-sm font-bold text-cyan-600 mt-1 sm:mt-1.5 lg:mt-2 break-words">{customer?.phone}</p>
            </div>

            <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-10">
              <div className="px-3 sm:px-4 md:px-6 lg:px-10">
                <table className="w-full text-left text-[10px] sm:text-xs lg:text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      <th className="py-2 sm:py-3 lg:py-4 font-black text-gray-400 uppercase">Item Description</th>
                      <th className="py-2 sm:py-3 lg:py-4 text-center font-black text-gray-400 uppercase whitespace-nowrap px-1">Rate</th>
                      <th className="py-2 sm:py-3 lg:py-4 text-center font-black text-gray-400 uppercase whitespace-nowrap px-1">Qty</th>
                      <th className="py-2 sm:py-3 lg:py-4 text-right font-black text-gray-400 uppercase whitespace-nowrap px-1">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {order.items.map((item, idx) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <tr key={idx} className="group">
                          <td className="py-3 sm:py-4 lg:py-6">
                            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
                              <img src={product?.image} className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full object-cover border border-gray-100 shadow-sm flex-shrink-0" />
                              <span className="font-bold text-gray-900 text-[10px] sm:text-xs lg:text-base break-words">{item.productName}</span>
                            </div>
                          </td>
                          <td className="py-3 sm:py-4 lg:py-6 text-center text-gray-500 font-bold px-1 whitespace-nowrap">{formatCurrency(item.rate)}</td>
                          <td className="py-3 sm:py-4 lg:py-6 text-center text-gray-500 font-bold px-1 whitespace-nowrap">{item.quantity}</td>
                          <td className="py-3 sm:py-4 lg:py-6 text-right font-black text-gray-900 px-1 whitespace-nowrap">{formatCurrency(item.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col items-end pt-2 sm:pt-3 lg:pt-6 px-0">
              <div className="w-full sm:w-full md:w-98 lg:max-w-xs space-y-2 sm:space-y-3 lg:space-y-4">
                <div className="flex justify-between text-[10px] sm:text-xs lg:text-sm gap-2">
                  <span className="text-gray-400 font-bold uppercase flex-shrink-0">Subtotal</span>
                  <span className="font-bold text-gray-900 flex-shrink-0">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-[10px] sm:text-xs lg:text-sm gap-2">
                    <span className="text-gray-400 font-bold uppercase flex-shrink-0">Discount</span>
                    <span className="font-bold text-red-500 flex-shrink-0">-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                {order.shipping > 0 && (
                  <div className="flex justify-between text-[10px] sm:text-xs lg:text-sm gap-2">
                    <span className="text-gray-400 font-bold uppercase flex-shrink-0">Shipping</span>
                    <span className="font-bold text-gray-900 flex-shrink-0">{formatCurrency(order.shipping)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2 sm:py-3 lg:py-4 border-t-2 border-[#0f2f57] gap-2">
                  <span className="font-black text-gray-900 uppercase tracking-tighter text-[11px] sm:text-xs lg:text-sm flex-shrink-0">Net Total</span>
                  <span className="font-black text-sm sm:text-base lg:text-lg flex-shrink-0">{formatCurrency(order.total)}</span>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="bg-gray-50 p-3 sm:p-4 rounded-[10px] border border-gray-100">
                <p className="text-[8px] sm:text-[9px] lg:text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1 sm:mb-2">Terms & Notes</p>
                <p className="text-[9px] sm:text-[10px] lg:text-xs text-gray-600 font-medium italic leading-relaxed">{order.notes}</p>
              </div>
            )}

          </div>
        </div>

        {/* Sidebar Lifecycle Dropdowns */}
        <div className="space-y-6">
          {/* Create Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">1. Creation</h3>
              <div className="p-1 bg-[#ebf4ff]0 text-white rounded-full">{ICONS.Plus}</div>
            </div>
            <div className="p-5">
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                {order.history.created || `Created by ${createdByUser?.name || 'Unknown'} on ${order.orderDate}`}
              </p>
            </div>
          </div>

          {/* Process Section */}
          {order.history?.processing || !isEmployee ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">2. Processing</h3>
              <div className={`p-1 rounded-full ${order.history.processing ? 'bg-[#ebf4ff]0 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {ICONS.ChevronRight}
              </div>
            </div>
            <div className="p-5 space-y-4">
                {order.history.processing ? (
                  <p className="text-xs ${theme.colors.primary[600]} leading-relaxed font-bold bg-[#ebf4ff] p-3 rounded-xl">
                    {order.history.processing}
                  </p>
                ) : (
                  !isEmployee && (
                    <button 
                      disabled={order.status !== OrderStatus.ON_HOLD}
                      onClick={markProcessing}
                      className={`w-full py-3 ${theme.colors.secondary[600]} hover:${theme.colors.secondary[700]} disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                    >
                      Mark as Processing
                    </button>
                  )
                )}

                {order.history.courier ? (
                  <p className="text-xs text-gray-700 leading-relaxed font-bold bg-gray-50 p-3 rounded-xl">{order.history.courier}</p>
                ) : (
                  (!isEmployee && order.status !== OrderStatus.PICKED && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED && order.status !== OrderStatus.ON_HOLD && !order.history?.courier) && (
                    <>
                      <button 
                        onClick={() => setShowSteadfast(true)}
                        className="w-full py-3 bg-[#0f2f57] hover:bg-[#0a1f38] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <img src="/uploads/steadfast.png" alt="Steadfast" className="w-5 h-5 rounded-full" /> Add to Steadfast
                      </button>
                      <button 
                        onClick={() => setShowCarryBee(true)}
                        className="w-full py-3 bg-[#0f2f57] hover:bg-[#0a1f38] text-white font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        <img src="/uploads/carrybee.png" alt="CarryBee" className="w-5 h-5 rounded-full" /> Add to CarryBee
                      </button>
                    </>
                  )
                )}
            </div>
            </div>
          ) : null}

          {/* Picked Section */}
          {order.history.picked || !isEmployee ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">3. Courier Picked</h3>
              <div className={`p-1 rounded-full ${order.history.picked ? 'bg-[#ebf4ff]0 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {ICONS.Courier}
              </div>
            </div>
            <div className="p-5">
                {order.history.picked ? (
                  <p className="text-xs text-purple-600 leading-relaxed font-bold bg-purple-50 p-3 rounded-xl">
                    {order.history.picked}
                  </p>
                ) : (
                  !isEmployee && (
                    <button 
                      disabled={order.status !== OrderStatus.PROCESSING}
                      onClick={markPicked}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                    >
                      Mark as Picked
                    </button>
                  )
                )}
            </div>
            </div>
          ) : null}

          {/* Payment Section */}
          {order.history.payment || !isEmployee ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">4. Payment</h3>
                <div className={`p-1 rounded-full ${order.paidAmount >= order.total ? 'bg-[#ebf4ff]0 text-white' : 'bg-gray-200 text-gray-400'}`}>
                  {ICONS.Banking}
                </div>
              </div>
              <div className="p-5 space-y-3">
                {order.history.payment ? (
                  <div className="space-y-2">
                    <p className="text-xs ${theme.colors.primary[600]} leading-relaxed font-bold bg-[#ebf4ff] p-3 rounded-xl">
                      {order.history.payment}
                    </p>
                  </div>
                ) : (
                  !isEmployee && (
                    <div className="space-y-4 text-center">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[10px] font-black text-gray-400 uppercase">Amount Due</p>
                        <p className="text-2xl font-black text-gray-900">{formatCurrency(order.total - order.paidAmount)}</p>
                      </div>
                      <button 
                        onClick={openPayment}
                        className={`w-full py-3 ${theme.colors.primary[600]} hover:${theme.colors.primary[700]} text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                      >
                        Add Payment
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <CommonPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handleLifecyclePayment}
        accounts={accounts}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        isLoading={updateMutation.isPending || createTransactionMutation.isPending || updateAccountMutation.isPending}
        title="Record Payment"
        buttonText="Add Payment"
      />

      <SteadfastModal 
        isOpen={showSteadfast} 
        onClose={() => setShowSteadfast(false)}
        order={order}
        customer={customer}
      />
      <CarryBeeModal 
        isOpen={showCarryBee} 
        onClose={() => setShowCarryBee(false)}
        order={order}
        customer={customer}
      />
    </div>
  );
};

export default OrderDetails;

