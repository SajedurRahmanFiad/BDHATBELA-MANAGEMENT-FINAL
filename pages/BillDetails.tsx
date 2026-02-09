
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { BillStatus, Bill, Transaction } from '../types';
import { formatCurrency, ICONS, getStatusColor } from '../constants';
import { theme } from '../theme';
import { useBill, useVendors, useUsers, useAccounts, useCompanySettings, useInvoiceSettings } from '../src/hooks/useQueries';
import { useUpdateBill, useCreateTransaction, useUpdateAccount } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { LoadingOverlay, CommonPaymentModal } from '../components';

const BillDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = db.currentUser;
  
  // Query data
  const { data: bill, isPending: billLoading, error: billError } = useBill(id || '');
  const { data: vendors = [] } = useVendors();
  const { data: users = [] } = useUsers();
  const { data: accounts = [] } = useAccounts();
  const { data: companySettings } = useCompanySettings();
  const { data: invoiceSettings } = useInvoiceSettings();
  
  // Mutations
  const updateMutation = useUpdateBill();
  const createTransactionMutation = useCreateTransaction();
  const updateAccountMutation = useUpdateAccount();
  const toast = useToastNotifications();
  const isPaymentLoading = updateMutation.isPending || createTransactionMutation.isPending || updateAccountMutation.isPending;
  
  // Get vendor and created by user from query results
  const vendor = bill ? vendors.find(v => v.id === bill.vendorId) : undefined;
  const createdByUser = bill ? users.find(u => u.id === bill.createdBy) : undefined;
  
  const loading = billLoading;
  
  // Modal states
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    date: new Date().toISOString().split('T')[0],
    accountId: db.settings.defaults.accountId || '',
    amount: 0
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading bill...</div>;
  if (billError || !bill) return <div className="p-8 text-center text-gray-500">{billError?.message || 'Bill not found.'}</div>;

  const updateStatus = async (newStatus: BillStatus, historyKey?: keyof Exclude<Bill['history'], undefined>, historyText?: string) => {
    if (!bill) return;
    try {
      const updates = { 
        ...bill, 
        status: newStatus, 
        history: historyKey ? { ...bill.history, [historyKey]: historyText } : bill.history
      };
      await updateMutation.mutateAsync({ id: id!, updates });
      // Explicitly invalidate the query cache after mutation succeeds to prevent stale data
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setIsActionOpen(false);
    } catch (err) {
      console.error('Failed to update bill status:', err);
      toast.error('Failed to update bill status');
    }
  };

  const markProcessing = async () => {
    const historyText = `Marked as processing by ${user.name}, on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    await updateStatus(BillStatus.PROCESSING, 'processing', historyText);
  };

  const markReceived = async () => {
    const historyText = `Marked as received by ${user.name}, on ${new Date().toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
    await updateStatus(BillStatus.RECEIVED, 'received', historyText);
  };

  const handlePayment = async () => {
    if (!bill) return;
    try {
      // Try to find account in cached data
      let account = accounts.find(a => a.id === paymentForm.accountId);
      
      if (!account) {
        if (!paymentForm.accountId) {
          toast.error('Please select an account');
          return;
        }
        // Account not in visible list, but proceed with the ID provided
        account = { 
          id: paymentForm.accountId, 
          name: 'Selected Account',
          type: 'Bank' as const,
          openingBalance: 0,
          currentBalance: 0
        };
      }

      const updatedPaid = bill.paidAmount + paymentForm.amount;
      const historyText = `Payment of ${formatCurrency(paymentForm.amount)} received by ${user.name} on ${new Date(paymentForm.date).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}, at ${new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}`;
      
      // Determine if bill is fully paid
      const isFullyPaid = updatedPaid >= bill.total;
      const newStatus = isFullyPaid ? BillStatus.PAID : bill.status;
      
      const updatedBill = { 
        ...bill, 
        paidAmount: updatedPaid,
        status: newStatus,
        history: { ...bill.history, paid: historyText },
        paidAt: paymentForm.date // Track payment date
      };

      // Create expense transaction for the payment
      try {
        const expenseTxn: Transaction = {
          id: Math.random().toString(36).substr(2, 9),
          date: paymentForm.date,
          type: 'Expense',
          category: db.settings.defaults.expenseCategoryId || 'expense_purchases',
          accountId: paymentForm.accountId,
          amount: paymentForm.amount,
          description: `Payment for Bill #${bill.billNumber}`,
          referenceId: bill.id,
          contactId: bill.vendorId,
          paymentMethod: db.settings.defaults.paymentMethod || 'Cash',
          createdBy: user.id
        };
        await createTransactionMutation.mutateAsync(expenseTxn as any);
      } catch (err) {
        console.error('Failed to create transaction:', err);
        // Continue with bill update even if transaction fails
      }

      // Update account balance and bill
      const balanceChange = paymentForm.amount;
      const results = await Promise.allSettled([
        updateMutation.mutateAsync({ id: id!, updates: updatedBill }),
        updateAccountMutation.mutateAsync({
          id: paymentForm.accountId,
          updates: { currentBalance: account.currentBalance - balanceChange }
        })
      ]);
      
      // Check if both mutations succeeded
      if (results[0].status === 'rejected' || results[1].status === 'rejected') {
        const billStatus = results[0].status === 'rejected' ? 'failed' : 'succeeded';
        const accountStatus = results[1].status === 'rejected' ? 'failed' : 'succeeded';
        throw new Error(`Payment update failed: Bill update ${billStatus}, Account update ${accountStatus}`);
      }

      // Explicitly invalidate cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['bill', id] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });

      setShowPaymentModal(false);
      toast.success('Payment recorded successfully');
    } catch (err) {
      console.error('Failed to record payment:', err);
      toast.error('Failed to record payment');
    }
  };

  const openPayment = () => {
    if (!bill) return;
    setPaymentForm({
      date: new Date().toISOString().split('T')[0],
      accountId: '',
      amount: bill.total - bill.paidAmount
    });
    setShowPaymentModal(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <LoadingOverlay isLoading={loading && !bill} message="Loading bill details..." />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bills')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Purchase Bill #{bill.billNumber}</h2>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getStatusColor(bill.status)}`}>
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
                  <button onClick={() => { markProcessing(); setIsActionOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Mark Processing</button>
                  <button onClick={() => { markReceived(); setIsActionOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50">Mark Received</button>
                  <div className="border-t my-1"></div>
                  <button onClick={() => { openPayment(); setIsActionOpen(false); }} disabled={bill.paidAmount >= bill.total} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-red-600 font-bold disabled:text-gray-300 disabled:cursor-not-allowed">Record Payment</button>
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
                {(companySettings?.logo || db.settings.company.logo) && (
                  <img src={companySettings?.logo || db.settings.company.logo} className="rounded-xl object-cover mb-4 border" style={{ width: invoiceSettings?.logoWidth || db.settings.invoice.logoWidth, height: invoiceSettings?.logoHeight || db.settings.invoice.logoHeight }} />
                )}
                <h1 className="text-2xl font-extrabold ${theme.colors.secondary[600]} uppercase tracking-tighter">Purchase Bill</h1>
                <p className="text-sm text-gray-500">{companySettings?.name || db.settings.company.name}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">Bill No: #{bill.billNumber}</p>
                <p className="text-sm text-gray-500">Date: {bill.billDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 border-t border-gray-100 py-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-3">Bill From (Vendor)</p>
                <h3 className="text-lg font-bold text-gray-900">{vendor?.name}</h3>
                <p className="text-sm text-gray-600">{vendor?.address}</p>
                <p className="text-sm text-gray-600">{vendor?.phone}</p>
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
                {bill.discount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span className="text-sm font-medium">Discount</span>
                    <span className="font-bold text-red-500">-{formatCurrency(bill.discount)}</span>
                  </div>
                )}
                {bill.shipping > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span className="text-sm font-medium">Shipping</span>
                    <span className="font-bold text-gray-900">{formatCurrency(bill.shipping)}</span>
                  </div>
                )}
                <div className={`flex justify-between items-center py-4 border-t-2 border-[#3c5a82]`}>
                  <span className="text-lg font-black text-gray-900 uppercase">Total Payable</span>
                  <span className="text-2xl font-black ${theme.colors.secondary[600]}">{formatCurrency(bill.total)}</span>
                </div>
              </div>
            </div>

            {/* Footer from Settings */}
            {(invoiceSettings?.footer || db.settings.invoice.footer) && (
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500 whitespace-pre-wrap">{invoiceSettings?.footer || db.settings.invoice.footer}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Lifecycle Sections */}
        <div className="space-y-6">
          {/* Creation Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">1. Creation</h3>
              <div className="p-1 bg-[#ebf4ff] text-white rounded-full">{ICONS.Plus}</div>
            </div>
            <div className="p-5">
              <p className="text-xs text-gray-500 leading-relaxed font-medium">
                {createdByUser?.name ? `${bill.history.created} ` : (bill.history?.created || 'Creation information unavailable')}
              </p>
            </div>
          </div>

          {/* Processing Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">2. Processing</h3>
              <div className={`p-1 rounded-full ${bill.status === BillStatus.PROCESSING ? 'bg-[#ebf4ff] text-white' : 'bg-gray-200 text-gray-400'}`}>
                {ICONS.ChevronRight}
              </div>
            </div>
            <div className="p-5">
              {bill.history?.processing ? (
                <p className="text-xs text-blue-600 leading-relaxed font-bold bg-[#ebf4ff] p-3 rounded-xl">
                  {bill.history.processing}
                </p>
              ) : (
                <button 
                  disabled={bill.status === BillStatus.RECEIVED}
                  onClick={markProcessing}
                  className={`w-full py-3 ${theme.colors.secondary[600]} hover:${theme.colors.secondary[700]} disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                >
                  Mark as Processing
                </button>
              )}
            </div>
          </div>

          {/* Received Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">3. Received</h3>
              <div className={`p-1 rounded-full ${bill.status === BillStatus.RECEIVED ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}>
                {ICONS.ChevronRight}
              </div>
            </div>
            <div className="p-5">
              {bill.history?.received ? (
                <p className="text-xs text-green-600 leading-relaxed font-bold bg-green-50 p-3 rounded-xl">
                  {bill.history.received}
                </p>
              ) : (
                <button 
                  disabled={bill.status === BillStatus.ON_HOLD}
                  onClick={markReceived}
                  className={`w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                >
                  Mark as Received
                </button>
              )}
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">4. Payment</h3>
              <div className={`p-1 rounded-full ${bill.paidAmount > 0 ? 'bg-[#ebf4ff] text-white' : 'bg-gray-200 text-gray-400'}`}>
                {ICONS.Banking}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {bill.paidAmount > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-blue-600 leading-relaxed font-bold bg-[#ebf4ff] p-3 rounded-xl">
                    {bill.history?.paid}
                  </p>
                  {bill.paidAt && (
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Payment Date: {new Date(bill.paidAt).toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                  {bill.paidAmount < bill.total && (
                    <>
                      <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-100 mt-2">
                        <p className="text-[10px] font-black text-yellow-600 uppercase">Remaining Amount</p>
                        <p className="text-lg font-black text-yellow-700">{formatCurrency(bill.total - bill.paidAmount)}</p>
                      </div>
                      <button 
                        onClick={openPayment}
                        className={`w-full py-3 ${theme.colors.primary[600]} hover:${theme.colors.primary[700]} text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                      >
                        Add Balance Payment
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-[10px] font-black text-gray-400 uppercase">Amount Due</p>
                    <p className="text-2xl font-black text-gray-900">{formatCurrency(bill.total - bill.paidAmount)}</p>
                  </div>
                  <button 
                    onClick={openPayment}
                    className={`w-full py-3 ${theme.colors.primary[600]} hover:${theme.colors.primary[700]} text-white font-bold rounded-xl shadow-md transition-all active:scale-95`}
                  >
                    Record Payment
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <CommonPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handlePayment}
        accounts={accounts}
        paymentForm={paymentForm}
        setPaymentForm={setPaymentForm}
        isLoading={isPaymentLoading}
        title="Record Payment"
        buttonText="Add Payment"
      />
    </div>
  );
};

export default BillDetails;

