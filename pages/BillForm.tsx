
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Bill, BillStatus, OrderItem, Vendor } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { Button } from '../components';
import { theme } from '../theme';

const BillForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [vendorId, setVendorId] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billNumber, setBillNumber] = useState('');
  const [items, setItems] = useState<OrderItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [notes, setNotes] = useState('');
  
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [showVendorSearch, setShowVendorSearch] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  useEffect(() => {
    if (isEdit) {
      const bill = db.bills.find(b => b.id === id);
      if (bill) {
        setVendorId(bill.vendorId);
        setBillDate(bill.billDate);
        setBillNumber(bill.billNumber);
        setItems(bill.items);
        setDiscount(bill.discount);
        setShipping(bill.shipping);
        setNotes(bill.notes || '');
      }
    } else {
      setBillNumber(`PUR-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [id, isEdit]);

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const total = subtotal - discount + shipping;

  const addItem = (productId: string) => {
    const product = db.products.find(p => p.id === productId);
    if (!product) return;

    const newItem: OrderItem = {
      productId: product.id,
      productName: product.name,
      rate: product.purchasePrice,
      quantity: 1,
      amount: product.purchasePrice
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
    if (!vendorId || items.length === 0) {
      alert('Please select a vendor and add at least one product.');
      return;
    }

    const billData: Bill = {
      id: isEdit ? id! : Math.random().toString(36).substr(2, 9),
      billNumber,
      billDate,
      vendorId,
      createdBy: db.currentUser.name,
      status: isEdit ? db.bills.find(b => b.id === id)?.status || BillStatus.ON_HOLD : BillStatus.ON_HOLD,
      items,
      subtotal,
      discount,
      shipping,
      total,
      notes,
      paidAmount: isEdit ? db.bills.find(b => b.id === id)?.paidAmount || 0 : 0,
    };

    if (isEdit) {
      const idx = db.bills.findIndex(b => b.id === id);
      db.bills[idx] = billData;
    } else {
      db.bills.unshift(billData);
    }

    saveDb();
    navigate('/bills');
  };

  const selectedVendor = db.vendors.find(v => v.id === vendorId);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Bill' : 'New Purchase Bill'}</h2>
        <button onClick={() => navigate('/bills')} className="text-gray-500 hover:text-gray-700 font-medium text-sm px-4 py-2 border border-gray-200 rounded-lg bg-white transition-all">
          Cancel
        </button>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1 relative md:col-span-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Select Vendor</label>
            <div className="relative">
              <button 
                onClick={() => setShowVendorSearch(!showVendorSearch)}
                className="w-full text-left px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white focus:ring-2 focus:ring-[#3c5a82] transition-all flex justify-between items-center group"
              >
                {selectedVendor ? (
                  <div className="flex-1 overflow-hidden">
                    <span className="font-bold block text-sm text-gray-900">{selectedVendor.name}</span>
                    <p className="text-[10px] text-gray-500 leading-none mt-0.5">{selectedVendor.phone}</p>
                    <p className="text-[10px] ${theme.colors.secondary[600]} italic truncate mt-1">{selectedVendor.address}</p>
                  </div>
                ) : <span className="text-gray-400 text-sm">Select Vendor...</span>}
                <div className={`transition-transform duration-200 ${showVendorSearch ? 'rotate-90' : ''}`}>
                   {ICONS.ChevronRight}
                </div>
              </button>
              
              {showVendorSearch && (
                <div className="absolute top-full left-0 mt-2 w-full max-w-xs bg-white border border-gray-200 shadow-2xl rounded-lg z-[110] p-2 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="relative mb-2">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-300">
                      {ICONS.Search}
                    </div>
                    <input autoFocus type="text" placeholder="Search business..." className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-[#3c5a82] text-sm font-medium" value={vendorSearchTerm} onChange={(e) => setVendorSearchTerm(e.target.value)} />
                  </div>
                  <div className="max-h-[220px] overflow-y-auto space-y-0.5 custom-scrollbar">
                    {db.vendors
                      .filter(v => v.name.toLowerCase().includes(vendorSearchTerm.toLowerCase()) || v.phone.includes(vendorSearchTerm))
                      .map(v => (
                      <button key={v.id} onClick={() => { setVendorId(v.id); setShowVendorSearch(false); setVendorSearchTerm(''); }} className="w-full px-4 py-2.5 text-left hover:bg-[#e6f0ff] rounded-lg group transition-colors">
                        <p className="text-sm font-bold text-gray-800 group-hover:${theme.colors.secondary[700]}">{v.name}</p>
                        <p className="text-[10px] text-gray-400 group-hover:${theme.colors.secondary[600]}/60">{v.phone}</p>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => { setShowVendorSearch(false); navigate('/vendors/new'); }} variant="secondary" size="sm" className="w-full mt-2 text-[10px]" icon={ICONS.Plus}>Add New Vendor</Button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bill Date</label>
            <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#3c5a82] focus:bg-white transition-all cursor-pointer font-bold text-sm" />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bill Number</label>
            <input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono ${theme.colors.secondary[700]} text-sm font-bold" />
          </div>
        </div>

        <div className="border border-gray-100 rounded-lg overflow-visible bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product Item</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Cost Rate</th>
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
                    <input type="number" value={item.quantity} onChange={(e) => updateQuantity(idx, parseInt(e.target.value))} className="w-16 text-center py-2 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#3c5a82] font-bold outline-none" />
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
                    <Button onClick={() => setShowProductSearch(!showProductSearch)} variant="secondary" size="sm" icon={ICONS.Plus} className="border-2 border-dashed border-[#c7e0f5]">Add an item</Button>
                    {showProductSearch && (
                      <div className="absolute top-full left-0 mt-3 w-full max-w-md bg-white border border-gray-200 shadow-2xl rounded-lg z-[100] p-2 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                        <div className="relative mb-2">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-300">
                            {ICONS.Search}
                          </div>
                          <input autoFocus type="text" placeholder="Search product..." className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-[#3c5a82] text-sm font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="max-h-[260px] overflow-y-auto space-y-0.5 custom-scrollbar">
                          {db.products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                            <button key={p.id} onClick={() => addItem(p.id)} className="flex items-center gap-4 w-full px-4 py-3 text-left hover:bg-[#e6f0ff] rounded-xl group transition-all">
                              <img src={p.image} className="w-10 h-10 rounded-lg object-cover border border-gray-100 shadow-sm" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 group-hover:${theme.colors.secondary[700]} truncate">{p.name}</p>
                                <p className="text-[10px] font-bold ${theme.colors.secondary[600]}/60 uppercase tracking-widest">Cost: {formatCurrency(p.purchasePrice)}</p>
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
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Purchase Memo</label>
            <textarea placeholder="Bill details, vendor instructions, or delivery notes..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-lg h-32 focus:ring-2 focus:ring-[#3c5a82] focus:bg-white outline-none font-medium text-sm transition-all" />
          </div>
          <div className="w-full md:w-96 space-y-4 bg-gray-50/50 p-8 rounded-[2rem] border border-gray-100">
            <div className="flex justify-between items-center text-gray-500 text-sm font-bold uppercase tracking-widest"><span>Subtotal</span><span className="text-gray-900 font-black">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between items-center text-gray-500 text-sm font-bold uppercase tracking-widest"><span>Discount</span><input type="number" value={discount} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-24 text-right px-3 py-1.5 border border-gray-100 rounded-lg focus:ring-2 focus:ring-[#3c5a82] font-black text-gray-900 bg-white" /></div>
            <div className="flex justify-between items-center text-gray-500 text-sm font-bold uppercase tracking-widest"><span>Shipping</span><input type="number" value={shipping} onChange={(e) => setShipping(parseFloat(e.target.value) || 0)} className="w-24 text-right px-3 py-1.5 border border-gray-100 rounded-lg focus:ring-2 focus:ring-[#3c5a82] font-black text-gray-900 bg-white" /></div>
            <div className="pt-6 border-t-4 border-[#c7e0f5] flex justify-between items-center"><span className="text-lg font-bold text-gray-900 uppercase tracking-tighter">Total Bill</span><span className="text-3xl font-black">{formatCurrency(total)}</span></div>
            <Button 
              onClick={handleSave}
              variant="primary"
              size="lg"
              className="w-full mt-4"
            >
              Save Purchase Bill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillForm;



