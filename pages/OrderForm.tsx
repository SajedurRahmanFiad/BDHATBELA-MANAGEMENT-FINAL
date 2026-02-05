
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Order, OrderStatus, OrderItem, UserRole } from '../types';
import { formatCurrency, ICONS } from '../constants';

const OrderForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = db.currentUser;
  const isAdmin = user.role === UserRole.ADMIN;
  const isEdit = Boolean(id);

  const [customerId, setCustomerId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [orderNumber, setOrderNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(60);
  const [notes, setNotes] = useState('');
  
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [custSearchTerm, setCustSearchTerm] = useState('');

  useEffect(() => {
    if (isEdit) {
      const order = db.orders.find(o => o.id === id);
      if (order) {
        if (!isAdmin && order.status !== OrderStatus.ON_HOLD) {
          alert('Employees can only edit orders that are currently "On Hold".');
          navigate('/orders');
          return;
        }
        setCustomerId(order.customerId);
        setOrderDate(order.orderDate);
        setOrderNumber(order.orderNumber);
        setItems(order.items);
        setDiscount(order.discount);
        setShipping(order.shipping);
        setNotes(order.notes || '');
      }
    } else {
      setOrderNumber(`${db.settings.order.prefix}${db.settings.order.nextNumber}`);
    }
  }, [id, isEdit, isAdmin, navigate]);

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal - discount + shipping;

  const addItem = (productId: string) => {
    const product = db.products.find(p => p.id === productId);
    if (!product) return;

    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      rate: product.salePrice,
      quantity: 1,
      amount: product.salePrice
    };
    setItems([...items, newItem]);
    setShowProductSearch(false);
    setSearchTerm('');
  };

  const updateQuantity = (index: number, qty: number) => {
    const newItems = [...items];
    newItems[index].quantity = Math.max(1, qty);
    newItems[index].amount = newItems[index].rate * newItems[index].quantity;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!customerId || items.length === 0) {
      alert('Please select a customer and add at least one product.');
      return;
    }

    const orderData: Order = {
      id: isEdit ? id! : Math.random().toString(36).substr(2, 9),
      orderNumber,
      orderDate,
      customerId,
      createdBy: isEdit ? db.orders.find(o => o.id === id)?.createdBy || user.name : user.name,
      status: isEdit ? db.orders.find(o => o.id === id)?.status || OrderStatus.ON_HOLD : OrderStatus.ON_HOLD,
      items,
      subtotal,
      discount,
      shipping,
      total,
      notes,
      paidAmount: isEdit ? db.orders.find(o => o.id === id)?.paidAmount || 0 : 0,
      history: isEdit 
        ? db.orders.find(o => o.id === id)!.history 
        : { created: `${db.currentUser.name} created this order on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}` }
    };

    if (isEdit) {
      const idx = db.orders.findIndex(o => o.id === id);
      db.orders[idx] = orderData;
    } else {
      db.orders.unshift(orderData);
      db.settings.order.nextNumber += 1;
    }

    saveDb();
    navigate('/orders');
  };

  const selectedCustomer = db.customers.find(c => c.id === customerId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Order' : 'New Order'}</h2>
        <button onClick={() => navigate('/orders')} className="text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2 border border-gray-200 rounded-lg bg-white transition-all">
          Cancel
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1 relative md:col-span-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Customer</label>
            <div className="relative">
              <button 
                onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                className="w-full text-left px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white focus:ring-2 focus:ring-emerald-500 transition-all flex justify-between items-center group"
              >
                {selectedCustomer ? (
                  <div className="flex-1 overflow-hidden">
                    <span className="font-bold block text-sm text-gray-900">{selectedCustomer.name}</span>
                    <p className="text-[10px] text-gray-500 leading-none mt-0.5">{selectedCustomer.phone}</p>
                    <p className="text-[10px] text-emerald-600 italic truncate mt-1">{selectedCustomer.address}</p>
                  </div>
                ) : <span className="text-gray-400 text-sm">Select Customer...</span>}
                <div className={`transition-transform duration-200 ${showCustomerSearch ? 'rotate-90' : ''}`}>
                   {ICONS.ChevronRight}
                </div>
              </button>
              
              {showCustomerSearch && (
                <div className="absolute top-full left-0 mt-2 w-full max-w-xs bg-white border border-gray-200 shadow-2xl rounded-2xl z-[110] p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="relative mb-2">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-300">
                      {ICONS.Search}
                    </div>
                    <input 
                      autoFocus 
                      type="text" 
                      placeholder="Search name or phone..." 
                      className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium" 
                      value={custSearchTerm} 
                      onChange={(e) => setCustSearchTerm(e.target.value)} 
                    />
                  </div>
                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 custom-scrollbar">
                    {db.customers
                      .filter(c => c.name.toLowerCase().includes(custSearchTerm.toLowerCase()) || c.phone.includes(custSearchTerm))
                      .map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => { setCustomerId(c.id); setShowCustomerSearch(false); setCustSearchTerm(''); }} 
                        className="w-full px-4 py-2.5 text-left hover:bg-emerald-50 rounded-lg group transition-colors"
                      >
                        <p className="text-sm font-bold text-gray-800 group-hover:text-emerald-700">{c.name}</p>
                        <p className="text-[10px] text-gray-400 group-hover:text-emerald-600/60">{c.phone}</p>
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => { setShowCustomerSearch(false); navigate('/customers/new'); }} 
                    className="w-full mt-2 py-3 text-emerald-600 text-[10px] font-black uppercase tracking-widest border-t border-gray-50 hover:bg-emerald-50 transition-colors"
                  >
                    + Add New Customer
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Order Date</label>
            <input 
              type="date" 
              value={orderDate} 
              onChange={(e) => setOrderDate(e.target.value)} 
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all cursor-pointer font-bold text-sm" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Order Number</label>
            <input 
              type="text" 
              readOnly 
              value={orderNumber} 
              className="w-full px-4 py-3 bg-gray-100 border border-gray-100 rounded-xl font-mono text-emerald-800 text-sm font-bold" 
            />
          </div>
        </div>

        <div className="border border-gray-100 rounded-2xl overflow-visible bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Item</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Rate</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item, idx) => (
                <tr key={idx} className="group hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img src={db.products.find(p => p.id === item.productId)?.image || ''} className="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-sm" />
                      <span className="font-bold text-gray-800 text-sm">{item.productName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-sm font-bold text-gray-600">{formatCurrency(item.rate)}</td>
                  <td className="px-4 py-4 text-center">
                    <input 
                      type="number" 
                      value={item.quantity} 
                      onChange={(e) => updateQuantity(idx, parseInt(e.target.value))} 
                      className="w-16 text-center py-2 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 font-bold outline-none" 
                    />
                  </td>
                  <td className="px-6 py-4 text-right font-black text-gray-900 text-sm">{formatCurrency(item.amount)}</td>
                  <td className="px-4 py-4 text-right">
                    <button onClick={() => removeItem(idx)} className="p-2 text-red-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      {ICONS.Delete}
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} className="px-6 py-5 relative">
                  <div className="relative">
                    <button 
                      onClick={() => setShowProductSearch(!showProductSearch)} 
                      className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-100 transition-all"
                    >
                      {ICONS.Plus} Add an item
                    </button>
                    
                    {showProductSearch && (
                      <div className="absolute top-full left-0 mt-3 w-full max-w-md bg-white border border-gray-200 shadow-2xl rounded-2xl z-[100] p-2 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <div className="relative mb-2">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-300">
                            {ICONS.Search}
                          </div>
                          <input 
                            autoFocus 
                            type="text" 
                            placeholder="Search catalog..." 
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                          />
                        </div>
                        <div className="max-h-[260px] overflow-y-auto space-y-0.5 custom-scrollbar">
                          {db.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                            <button 
                              key={p.id} 
                              onClick={() => addItem(p.id)} 
                              className="flex items-center gap-4 w-full px-4 py-3 text-left hover:bg-emerald-50 rounded-xl group transition-all"
                            >
                              <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-gray-100 shadow-sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 group-hover:text-emerald-700 truncate">{p.name}</p>
                                <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-widest">{formatCurrency(p.salePrice)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-12 pt-6">
          <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Order Notes / Terms</label>
            <textarea 
              placeholder="Internal notes or special instructions for this order..." 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl h-32 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none font-medium text-sm transition-all" 
            />
          </div>
          <div className="w-full md:w-96 space-y-4 bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100">
            <div className="flex justify-between items-center text-gray-500 text-sm font-bold uppercase tracking-widest">
              <span>Subtotal</span>
              <span className="text-gray-900 font-black">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-gray-500 text-sm font-bold uppercase tracking-widest">
              <span>Discount</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 font-black">৳</span>
                <input 
                  type="number" 
                  value={discount} 
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} 
                  className="w-24 text-right px-3 py-1.5 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 font-black text-gray-900 bg-white" 
                />
              </div>
            </div>
            <div className="flex justify-between items-center text-gray-500 text-sm font-bold uppercase tracking-widest">
              <span>Shipping</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-300 font-black">৳</span>
                <input 
                  type="number" 
                  value={shipping} 
                  onChange={(e) => setShipping(parseFloat(e.target.value) || 0)} 
                  className="w-24 text-right px-3 py-1.5 border border-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 font-black text-gray-900 bg-white" 
                />
              </div>
            </div>
            <div className="pt-6 border-t-4 border-emerald-100 flex justify-between items-center">
              <span className="text-lg font-black text-gray-900 uppercase tracking-tighter">Grand Total</span>
              <span className="text-3xl font-black text-emerald-600">{formatCurrency(total)}</span>
            </div>
            <button 
              onClick={handleSave} 
              className="w-full py-5 bg-emerald-600 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all mt-4"
            >
              {isEdit ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderForm;
