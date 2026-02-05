
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { BillStatus, Bill, Transaction } from '../types';
import { formatCurrency, ICONS } from '../constants';
import { theme } from '../theme';

const BillDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState<Bill | undefined>(db.bills.find(b => b.id === id));
  const [isActionOpen, setIsActionOpen] = useState(false);

  if (!bill) return <div className="p-8 text-center text-gray-500">Bill not found.</div>;

  const vendor = db.vendors.find(v => v.id === bill.vendorId);

  const updateStatus = (newStatus: BillStatus) => {
    if (!bill) return;
    const updatedBill = { ...bill, status: newStatus };
    const idx = db.bills.findIndex(b => b.id === id);
    db.bills[idx] = updatedBill;
    setBill(updatedBill);
    saveDb();
    setIsActionOpen(false);
  };

  const handlePayment = () => {
    if (!bill) return;
    
    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      type: 'Expense',
      category: 'Purchases',
      accountId: db.settings.defaults.accountId,
      amount: bill.total,
      description: `Payment for Bill #${bill.billNumber}`,
      referenceId: bill.id,
      contactId: bill.vendorId,
      paymentMethod: 'Cash',
    };

    db.transactions.push(newTransaction);
    
    const idx = db.bills.findIndex(b => b.id === id);
    db.bills[idx] = { ...bill, paidAmount: bill.total };
    setBill(db.bills[idx]);
    
    saveDb();
    alert('Payment recorded and transaction added to Purchases category.');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bills')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Bill #{bill.billNumber}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
            bill.status === BillStatus.RECEIVED ? 'bg-green-100 text-green-600' : `bg-[#e6f0ff] ${theme.colors.secondary[600]}`
          }`}>
            {bill.status}
          </span>
        </div>
        <div className="flex items-center gap-2 relative">
          <button className="flex items-center gap-2 px-4 py-2 text-sm font-semibold border rounded-lg bg-white hover:bg-gray-50 transition-all">
            {ICONS.Print} Print Bill
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
                <div className="absolute right-0 mt-2 w-48 bg-white border rounded-xl shadow-xl z-50 py-2">
                  <button onClick={() => updateStatus(BillStatus.PROCESSING)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Mark Processing</button>
                  <button onClick={() => updateStatus(BillStatus.RECEIVED)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Mark Received</button>
                  <div className="border-t my-1"></div>
                  <button onClick={handlePayment} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600 font-bold">Record Payment</button>
                  <button onClick={() => navigate(`/bills/edit/${bill.id}`)} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Edit Bill</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-8 space-y-8">
            <div className="flex justify-between items-start">
              <div>
                <img src={db.settings.company.logo} className="rounded-xl object-cover mb-4 border" style={{ width: db.settings.invoice.logoWidth, height: db.settings.invoice.logoHeight }} />
                <h1 className="text-2xl font-extrabold ${theme.colors.secondary[600]} uppercase tracking-tighter">Purchase Bill</h1>
                <p className="text-sm text-gray-500">{db.settings.company.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">Bill No: #{bill.billNumber}</p>
                <p className="text-sm text-gray-500">Date: {bill.billDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 border-y border-gray-100 py-8">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Bill From (Vendor)</p>
                <h3 className="text-lg font-bold text-gray-900">{vendor?.name}</h3>
                <p className="text-sm text-gray-600">{vendor?.address}</p>
                <p className="text-sm text-gray-600">{vendor?.phone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Status</p>
                <p className="text-lg font-bold ${theme.colors.secondary[600]}">{bill.status}</p>
              </div>
            </div>

            <table className="w-full text-left">
              <thead>
                <tr className="border-b-2 border-gray-100">
                  <th className="py-4 text-xs font-bold text-gray-400 uppercase">Description</th>
                  <th className="py-4 text-center text-xs font-bold text-gray-400 uppercase">Cost</th>
                  <th className="py-4 text-center text-xs font-bold text-gray-400 uppercase">Qty</th>
                  <th className="py-4 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bill.items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-5 font-bold text-gray-800">{item.productName}</td>
                    <td className="py-5 text-center text-gray-600 font-medium">{formatCurrency(item.rate)}</td>
                    <td className="py-5 text-center text-gray-600 font-medium">{item.quantity}</td>
                    <td className="py-5 text-right font-black text-gray-900">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end pt-4">
              <div className="w-full max-w-xs space-y-3">
                <div className="flex justify-between text-gray-500">
                  <span className="text-sm font-medium">Subtotal</span>
                  <span className="font-bold text-gray-900">{formatCurrency(bill.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span className="text-sm font-medium">Discount</span>
                  <span className="font-bold text-red-500">-{formatCurrency(bill.discount)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span className="text-sm font-medium">Shipping</span>
                  <span className="font-bold text-gray-900">{formatCurrency(bill.shipping)}</span>
                </div>
                <div className={`flex justify-between items-center py-4 border-t-2 border-[#3c5a82]`}>
                  <span className="text-lg font-black text-gray-900 uppercase">Total Payable</span>
                  <span className="text-2xl font-black ${theme.colors.secondary[600]}">{formatCurrency(bill.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillDetails;

