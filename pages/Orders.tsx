
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Order, OrderStatus, UserRole, Transaction } from '../types';
import { formatCurrency, ICONS } from '../constants';
import FilterBar, { FilterRange } from '../components/FilterBar';

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const user = db.currentUser;
  const isAdmin = user.role === UserRole.ADMIN;
  
  const [filterRange, setFilterRange] = useState<FilterRange>('All Time');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const [statusTab, setStatusTab] = useState<OrderStatus | 'All'>('All');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const [showPaymentModal, setShowPaymentModal] = useState<Order | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: db.settings.defaults.accountId || db.accounts[0]?.id || '',
    amount: 0
  });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case OrderStatus.ON_HOLD: return 'bg-gray-100 text-gray-600';
      case OrderStatus.PROCESSING: return 'bg-blue-100 text-blue-600';
      case OrderStatus.PICKED: return 'bg-purple-100 text-purple-600';
      case OrderStatus.COMPLETED: return 'bg-emerald-100 text-emerald-600';
      case OrderStatus.CANCELLED: return 'bg-red-100 text-red-600';
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

  const filteredOrders = useMemo(() => {
    return db.orders
      .filter(o => isWithinRange(o.orderDate))
      .filter(o => statusTab === 'All' || o.status === statusTab);
  }, [filterRange, customDates, statusTab]);

  const handleDuplicate = (order: Order) => {
    const newOrder: Order = {
      ...order,
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: `${db.settings.order.prefix}${db.settings.order.nextNumber}`,
      orderDate: new Date().toISOString().split('T')[0],
      status: OrderStatus.ON_HOLD,
      paidAmount: 0,
      history: { created: `${db.currentUser.name} created this order on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}` }
    };
    db.settings.order.nextNumber += 1;
    db.orders.unshift(newOrder);
    saveDb();
    navigate(0);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this order?')) return;
    db.orders = db.orders.filter(o => o.id !== id);
    saveDb();
    navigate(0);
  };

  const openPaymentModal = (order: Order) => {
    setPaymentForm({ ...paymentForm, amount: order.total - order.paidAmount });
    setShowPaymentModal(order);
  };

  const handleAddPayment = () => {
    if (!showPaymentModal) return;
    const order = showPaymentModal;
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
      paymentMethod: db.settings.defaults.paymentMethod || 'Cash'
    };
    const account = db.accounts.find(a => a.id === paymentForm.accountId);
    if (account) account.currentBalance += paymentForm.amount;
    const orderIdx = db.orders.findIndex(o => o.id === order.id);
    db.orders[orderIdx].paidAmount += paymentForm.amount;
    db.orders[orderIdx].history.payment = `Payment of ${formatCurrency(paymentForm.amount)} received by ${user.name} on ${new Date(paymentForm.date).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    if (db.orders[orderIdx].paidAmount >= db.orders[orderIdx].total) db.orders[orderIdx].status = OrderStatus.COMPLETED;
    db.transactions.unshift(transaction);
    saveDb();
    setShowPaymentModal(null);
    navigate(0);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Sales Orders</h2>
          <p className="text-gray-500 font-medium text-sm">Monitor and process your client fulfillment cycle</p>
        </div>
        <button 
          onClick={() => navigate('/orders/new')}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200"
        >
          {ICONS.Plus} New Order
        </button>
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

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Order Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Created By</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] text-right">Net Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-gray-400 italic font-medium">No sales orders found for this period.</td></tr>
              ) : filteredOrders.map((order) => {
                const isModifiable = isAdmin || order.status === OrderStatus.ON_HOLD;
                return (
                  <tr 
                    key={order.id} 
                    onMouseEnter={() => setHoveredRow(order.id)} 
                    onMouseLeave={() => setHoveredRow(null)} 
                    onClick={() => navigate(`/orders/${order.id}`)} 
                    className="group relative hover:bg-emerald-50/20 cursor-pointer transition-all"
                  >
                    <td className="px-6 py-5">
                      <span className="font-black text-gray-900">#{order.orderNumber}</span>
                      <p className="text-[10px] text-gray-400 font-bold mt-1 tracking-tight">{new Date(order.orderDate).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm font-bold text-gray-700">{db.customers.find(c => c.id === order.customerId)?.name || 'Unknown'}</span>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{db.customers.find(c => c.id === order.customerId)?.phone}</p>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-gray-500">{order.createdBy}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>{order.status}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="font-black text-gray-900 text-base">{formatCurrency(order.total)}</span>
                      {order.paidAmount > 0 && (
                        <p className={`text-[10px] font-black uppercase tracking-tighter mt-1 ${order.paidAmount >= order.total ? 'text-emerald-500' : 'text-orange-400'}`}>
                          {order.paidAmount >= order.total ? 'Paid Fully' : `Paid: ${formatCurrency(order.paidAmount)}`}
                        </p>
                      )}
                    </td>

                    {hoveredRow === order.id && (
                      <td className="absolute right-6 top-1/2 -translate-y-1/2 z-10 animate-in fade-in slide-in-from-right-2 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-emerald-100">
                          <button onClick={() => navigate(`/orders/edit/${order.id}`)} className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Edit">{ICONS.Edit}</button>
                          <button onClick={() => handleDuplicate(order)} className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Duplicate">{ICONS.Duplicate}</button>
                          {order.paidAmount < order.total && (
                            <button onClick={() => openPaymentModal(order)} className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Add Payment">{ICONS.Banking}</button>
                          )}
                          <button onClick={() => navigate(`/orders/${order.id}`)} className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Print">{ICONS.Print}</button>
                          <button className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Download PDF">{ICONS.Download}</button>
                          <div className="h-5 w-px bg-gray-100 mx-1"></div>
                          <button className="px-3 py-1 text-[9px] font-black text-blue-500 hover:bg-blue-50 rounded-lg" title="Add to Steadfast">ST</button>
                          <button className="px-3 py-1 text-[9px] font-black text-orange-500 hover:bg-orange-50 rounded-lg" title="Add to CarryBee">CB</button>
                          {isModifiable && (
                            <button onClick={() => handleDelete(order.id)} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">{ICONS.Delete}</button>
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

      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowPaymentModal(null)}></div>
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 z-[210] animate-in zoom-in-95 duration-200 border border-emerald-50">
            <h3 className="text-2xl font-black text-gray-900 mb-8">Receive Payment</h3>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Payment Date</label>
                <input type="date" value={paymentForm.date} onChange={e => setPaymentForm({...paymentForm, date: e.target.value})} className="w-full px-6 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Select Account</label>
                <select value={paymentForm.accountId} onChange={e => setPaymentForm({...paymentForm, accountId: e.target.value})} className="w-full px-6 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none">
                  {db.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Amount (BDT)</label>
                <input type="number" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})} className="w-full px-6 py-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl font-black text-emerald-600 text-xl outline-none" />
              </div>
              <div className="pt-6 flex gap-4">
                <button onClick={() => setShowPaymentModal(null)} className="flex-1 py-4 text-gray-400 font-bold hover:bg-gray-50 rounded-2xl transition-all">Cancel</button>
                <button onClick={handleAddPayment} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">Add Payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
