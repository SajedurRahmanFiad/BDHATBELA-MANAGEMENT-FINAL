
import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db';
import { Transaction } from '../types';
import { ICONS } from '../constants';
import { Button } from '../components';
import { theme } from '../theme';
import { useAccounts, useCategories, usePaymentMethods, useSystemDefaults } from '../src/hooks/useQueries';
import { useCreateTransaction, useUpdateAccount } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';

const TransactionForm: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const user = db.currentUser;
  const isIncome = type === 'income';

  const { data: accounts = [] } = useAccounts();
  const { data: systemDefaults } = useSystemDefaults();
  const { data: paymentMethods = [] } = usePaymentMethods();
  const { data: allCategories = [] } = useCategories();
  const createTransactionMutation = useCreateTransaction();
  const updateAccountMutation = useUpdateAccount();
  const toast = useToastNotifications();

  const categories = useMemo(() => allCategories.filter(c => c.type === (isIncome ? 'Income' : 'Expense')), [allCategories, isIncome]);

  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    paymentMethod: systemDefaults?.paymentMethod || 'Cash',
    accountId: systemDefaults?.accountId || accounts[0]?.id || '',
    amount: 0,
    description: '',
    category: isIncome ? (systemDefaults?.incomeCategoryId || '') : (systemDefaults?.expenseCategoryId || ''),
    attachmentName: '',
    attachmentUrl: ''
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setForm({...form, attachmentName: file.name, attachmentUrl: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const isLoading = createTransactionMutation.isPending || updateAccountMutation.isPending;

  const handleSave = async () => {
    // Validate mandatory fields
    if (form.amount <= 0) {
      toast.warning('Amount must be greater than 0');
      return;
    }
    if (!form.accountId) {
      toast.warning('Please select an account');
      return;
    }
    if (!form.category) {
      toast.warning('Please select a category');
      return;
    }

    if (!user?.id) {
      toast.warning('User session expired. Please log in again.');
      return;
    }

    try {
      const dateObj = new Date(form.date);
      const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const transaction: Omit<Transaction, 'id'> = {
        type: isIncome ? 'Income' : 'Expense',
        date: form.date,
        paymentMethod: form.paymentMethod,
        accountId: form.accountId,
        amount: form.amount,
        description: form.description,
        category: form.category,
        attachmentName: form.attachmentName,
        attachmentUrl: form.attachmentUrl,
        createdBy: user.id,
        history: {
          created: `Created by ${user.name} on ${dateStr}`
        }
      };

      // Create transaction in Supabase
      await createTransactionMutation.mutateAsync(transaction);

      // Update account balance in Supabase
      const account = accounts.find(a => a.id === form.accountId);
      if (account) {
        const newBalance = isIncome ? account.currentBalance + form.amount : account.currentBalance - form.amount;
        await updateAccountMutation.mutateAsync({ id: form.accountId, updates: { currentBalance: newBalance } });
      }

      navigate('/transactions');
    } catch (err) {
      console.error('Failed to save transaction:', err);
      toast.error('Failed to save transaction: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Record {isIncome ? 'Income' : 'Expense'}</h2>
          <p className="text-gray-500 font-medium">Log a new financial movement in your accounts</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-3 text-gray-400 hover:text-gray-600 bg-white border border-gray-100 rounded-lg shadow-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l18 18"></path></svg>
        </button>
      </div>

      <div className="bg-white p-8 lg:p-12 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-gray-200/20 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount (BDT)</label>
            <input 
              type="number" 
              className={`w-full text-3xl font-black px-6 py-4 bg-gray-50 border-2 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-xl transition-all outline-none ${isIncome ? '${theme.colors.primary[600]}' : 'text-red-600'}`}
              value={form.amount}
              onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Date</label>
            <input 
              type="date" 
              className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg text-lg font-bold"
              value={form.date}
              onChange={e => setForm({...form, date: e.target.value})}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Connected Account</label>
            <select 
              className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-xl font-bold"
              value={form.accountId}
              onChange={e => setForm({...form, accountId: e.target.value})}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Category</label>
            <select 
              className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-xl font-bold"
              value={form.category}
              onChange={e => setForm({...form, category: e.target.value})}
            >
              <option value="">-- Select a category --</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Payment Method</label>
            <select 
              className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-xl font-bold"
              value={form.paymentMethod}
              onChange={e => setForm({...form, paymentMethod: e.target.value})}
            >
              {paymentMethods.map(pm => (
                <option key={pm.id} value={pm.name}>{pm.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Attachment</label>
            <div className="relative">
              <input 
                type="file" 
                className="hidden"
                id="file-upload"
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="file-upload"
                className="w-full px-6 py-4 bg-gray-50 border-transparent hover:bg-gray-100 rounded-lg font-bold pl-14 flex items-center cursor-pointer transition-colors"
              >
                {form.attachmentName || 'Choose file to upload'}
              </label>
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400">
                {ICONS.Print}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Description</label>
          <textarea 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-medium h-32 outline-none"
            placeholder="What was this transaction for?"
            value={form.description}
            onChange={e => setForm({...form, description: e.target.value})}
          />
        </div>

        <Button 
          onClick={handleSave}
          variant={isIncome ? "primary" : "danger"}
          size="lg"
          className="w-full"
          disabled={isLoading}
          loading={isLoading}
        >
          Finalize {isIncome ? 'Income' : 'Expense'}
        </Button>
      </div>
    </div>
  );
};

export default TransactionForm;


