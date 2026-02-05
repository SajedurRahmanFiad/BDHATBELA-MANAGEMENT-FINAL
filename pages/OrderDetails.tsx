
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { OrderStatus, Order, UserRole, Transaction } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button } from '../components';
import { theme } from '../theme';

const OrderDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = db.currentUser;
  const isAdmin = user.role === UserRole.ADMIN;
  const [order, setOrder] = useState<Order | undefined>(db.orders.find(o => o.id === id));
  const [isActionOpen, setIsActionOpen] = useState(false);

  // Modal State for Lifecycle Payment
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: db.settings.defaults.accountId || db.accounts[0]?.id || '',
    amount: 0
  });

  if (!order) return <div className="p-8 text-center text-gray-500">Order not found.</div>;

  const customer = db.customers.find(c => c.id === order.customerId);

  const updateStatus = (newStatus: OrderStatus, historyKey?: keyof Order['history'], historyText?: string) => {
    if (!order) return;
    const updatedOrder = { 
      ...order, 
      status: newStatus, 
      history: historyKey ? { ...order.history, [historyKey]: historyText } : order.history
    };
    const idx = db.orders.findIndex(o => o.id === id);
    db.orders[idx] = updatedOrder;
    setOrder(updatedOrder);
    saveDb();
    setIsActionOpen(false);
  };

  const markProcessing = () => {
    const historyText = `Marked as processing by ${user.name}, on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    updateStatus(OrderStatus.PROCESSING, 'processing', historyText);
  };

  const markPicked = () => {
    const historyText = `Marked as picked by courier, on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    updateStatus(OrderStatus.PICKED, 'picked', historyText);
  };

  const handleLifecyclePayment = () => {
    const transaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: paymentForm.date,
      type: 'Income',
      category: 'Sales',
      accountId: paymentForm.accountId,
      amount: paymentForm.amount,
      description: `Payment for Order #${order.orderNumber}`,
      referenceId: order.id,
      contactId: order.customerId,
      paymentMethod: 'Cash'
    };

    const account = db.accounts.find(a => a.id === paymentForm.accountId);
    if (account) account.currentBalance += paymentForm.amount;

    const updatedPaid = order.paidAmount + paymentForm.amount;
    const historyText = `Payment of ${formatCurrency(paymentForm.amount)} received by ${user.name} on ${new Date(paymentForm.date).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    
    const status = updatedPaid >= order.total ? OrderStatus.COMPLETED : order.status;
    
    const updatedOrder = { 
      ...order, 
      paidAmount: updatedPaid,
      status,
      history: { ...order.history, payment: historyText }
    };

    const idx = db.orders.findIndex(o => o.id === id);
    db.orders[idx] = updatedOrder;
    db.transactions.unshift(transaction);
    
    setOrder(updatedOrder);
    saveDb();
    setShowPaymentModal(false);
  };

  const openPayment = () => {
    setPaymentForm({ ...paymentForm, amount: order.total - order.paidAmount });
    setShowPaymentModal(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header with Top Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orders')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
            order.status === OrderStatus.COMPLETED ? 'bg-green-100 text-green-600' : 
            order.status === OrderStatus.CANCELLED ? 'bg-red-100 text-red-600' : `bg-[#e6f0ff] ${theme.colors.secondary[600]}`
          }`}>
            {order.status}
          </span>
        </div>
        
        <div className="flex items-center gap-2 relative">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-lg bg-white hover:bg-gray-50 transition-all shadow-sm">
            {ICONS.Print} Print
          </button>
          <div className="relative">
            <button 
              onClick={() => setIsActionOpen(!isActionOpen)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-lg ${theme.colors.primary[600]} text-white hover:${theme.colors.primary[700]} transition-all shadow-md`}
            >
              {ICONS.More} Actions
            </button>
            {isActionOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsActionOpen(false)}></div>
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in duration-150 origin-top-right">
                  <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
                    {ICONS.Edit} Edit Order
                  </button>
                  <button onClick={() => {
                     const duplicateOrder = { ...order, id: Math.random().toString(36).substr(2, 9), orderNumber: db.settings.order.prefix + db.settings.order.nextNumber };
                     db.settings.order.nextNumber++;
                     db.orders.unshift(duplicateOrder);
                     saveDb();
                     navigate('/orders');
                  }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
                    {ICONS.Duplicate} Duplicate Order
                  </button>
                  {order.paidAmount < order.total && (
                    <Button onClick={openPayment} variant="outline" className="w-full text-left justify-start">
                      {ICONS.Banking} Add Payment
                    </Button>
                  )}
                  <div className="border-t my-1"></div>
                  <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
                    {ICONS.Plus} Add to Steadfast
                  </button>
                  <button className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 font-bold text-gray-700">
                    {ICONS.Plus} Add to CarryBee
                  </button>
                  <div className="border-t my-1"></div>
                  <button onClick={() => updateStatus(OrderStatus.CANCELLED)} className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-50 flex items-center gap-2 text-red-500 font-bold">
                    {ICONS.Delete} Cancel Order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* On-Screen Invoice Format */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-10 space-y-10">
            <div className="flex justify-between items-start">
              <div>
                <img 
                  src={db.settings.company.logo} 
                  className="rounded-lg object-cover mb-4 shadow-sm border border-gray-100" 
                  style={{ width: db.settings.invoice.logoWidth, height: db.settings.invoice.logoHeight }}
                />
                <h1 className="text-2xl font-black ${theme.colors.primary[600]} uppercase tracking-tighter">{db.settings.company.name}</h1>
                <div className="mt-2 text-xs text-gray-400 font-medium space-y-1">
                  <p>{db.settings.company.address}</p>
                  <p>{db.settings.company.phone} • {db.settings.company.email}</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-5xl font-black text-gray-300 uppercase leading-none mb-4">{db.settings.invoice.title}</h2>
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-gray-900"><span className="text-gray-400 font-medium">Order No:&nbsp;&nbsp;</span> {order.orderNumber}</p>
                  <p className="text-sm font-bold text-gray-900"><span className="text-gray-400 font-medium">Date:&nbsp;&nbsp;</span> {order.orderDate}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 border-y border-gray-100 py-8">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Invoiced To</p>
                <h3 className="text-lg font-black text-gray-900">{customer?.name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{customer?.address}</p>
                <p className="text-sm font-bold ${theme.colors.primary[600]} mt-2">{customer?.phone}</p>
              </div>
              <div className="text-right">
                
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Description</th>
                  <th className="py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate</th>
                  <th className="py-4 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">Qty</th>
                  <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {order.items.map((item, idx) => {
                  const product = db.products.find(p => p.id === item.productId);
                  return (
                    <tr key={idx} className="group">
                      <td className="py-6">
                        <div className="flex items-center gap-4">
                          <img src={product?.image} className="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-sm" />
                          <span className="font-bold text-gray-900">{item.productName}</span>
                        </div>
                      </td>
                      <td className="py-6 text-center text-gray-500 font-bold">{formatCurrency(item.rate)}</td>
                      <td className="py-6 text-center text-gray-500 font-bold">{item.quantity}</td>
                      <td className="py-6 text-right font-black text-gray-900">{formatCurrency(item.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-end pt-6">
              <div className="w-full max-w-xs space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bold uppercase">Subtotal</span>
                  <span className="font-bold text-gray-900">{formatCurrency(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bold uppercase">Discount</span>
                  <span className="font-bold text-red-500">-{formatCurrency(order.discount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 font-bold uppercase">Shipping</span>
                  <span className="font-bold text-gray-900">{formatCurrency(order.shipping)}</span>
                </div>
                <div className="flex justify-between items-center py-6 border-t-4 border-[#0f2f57]">
                  <span className="text-lg font-black text-gray-900 uppercase tracking-tighter">Net Total</span>
                  <span className="text-3xl font-black ${theme.colors.primary[600]}">{formatCurrency(order.total)}</span>
                </div>
                {order.paidAmount > 0 && (
                  <div className="flex justify-between text-sm bg-[#ebf4ff] p-3 rounded-xl border border-[#c7dff5]">
                    <span className="${theme.colors.primary[700]} font-bold uppercase">Paid Amount</span>
                    <span className="font-black ${theme.colors.primary[700]}">{formatCurrency(order.paidAmount)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
              <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2">Terms & Notes</p>
              <p className="text-xs text-gray-600 font-medium italic leading-relaxed">{order.notes || 'No specific terms or notes mentioned.'}</p>
            </div>

            <div className="text-center pt-8 border-t border-gray-50">
              <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.3em]">{db.settings.invoice.footer}</p>
            </div>
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
                {order.history.created || `Created by ${order.createdBy} on ${order.orderDate}`}
              </p>
            </div>
          </div>

          {/* Process Section */}
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
                <>
                  <button 
                    disabled={order.status !== OrderStatus.ON_HOLD}
                    onClick={markProcessing}
                    className={`w-full py-3 ${theme.colors.secondary[600]} hover:${theme.colors.secondary[700]} disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                  >
                    Mark as Processing
                  </button>
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" className="flex-1">Steadfast</Button>
                    <Button variant="primary" size="sm" className="flex-1">CarryBee</Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Picked Section */}
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
                <button 
                  disabled={order.status !== OrderStatus.PROCESSING}
                  onClick={markPicked}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95"
                >
                  Mark as Picked
                </button>
              )}
            </div>
          </div>

          {/* Payment Section */}
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
                  {order.paidAmount < order.total && (
                     <Button onClick={openPayment} variant="primary" size="sm" className="w-full">Add Balance Payment</Button>
                  )}
                </div>
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPaymentModal(false)}></div>
          <div className="bg-white w-full max-w-md rounded-xl p-8 z-[130] animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Order Payment</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payment Date</label>
                <input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select Account</label>
                <select value={paymentForm.accountId} onChange={e => setPaymentForm({...paymentForm, accountId: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl">
                  {db.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Amount to Pay</label>
                <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold ${theme.colors.primary[600]}" />
              </div>
              <div className="pt-4 flex gap-3">
                <Button onClick={() => setShowPaymentModal(false)} variant="ghost" className="flex-1">Cancel</Button>
                <Button onClick={handleLifecyclePayment} variant="primary" size="md" className="flex-1">Save Payment</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetails;

