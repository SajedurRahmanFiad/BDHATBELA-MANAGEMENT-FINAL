
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { db, saveDb } from '../db';
import { Transaction } from '../types';
// Fixed: Added formatCurrency to the imports from constants to resolve "Cannot find name 'formatCurrency'" errors on lines 76 and 82.
import { ICONS, formatCurrency } from '../constants';
import { Button } from '../components';
import { theme } from '../theme';
import { useAccounts } from '../src/hooks/useQueries';
import { useCreateTransaction, useUpdateAccount } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';

const Transfer: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = db.currentUser;
  const { data: accounts = [] } = useAccounts();
  const createTransactionMutation = useCreateTransaction();
  const updateAccountMutation = useUpdateAccount();
  const toast = useToastNotifications();
  
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: false }),
    fromAccountId: '',
    toAccountId: '',
    amount: 0,
    description: '',
  });

  const handleSave = async () => {
    if (!form.amount || !form.fromAccountId || !form.toAccountId) {
      toast.warning('Please fill in all fields.');
      return;
    }
    if (form.fromAccountId === form.toAccountId) {
      toast.warning('Cannot transfer to the same account.');
      return;
    }

    const fromAccount = accounts.find(a => a.id === form.fromAccountId);
    const toAccount = accounts.find(a => a.id === form.toAccountId);

    if (fromAccount && toAccount) {
      if (fromAccount.currentBalance < form.amount) {
        toast.warning('Insufficient balance in source account.');
        return;
      }

      try {
        // Create full ISO datetime from date and time
        const [hours, minutes] = form.time.split(':').map(Number);
        const fullDatetime = new Date(form.date);
        fullDatetime.setHours(hours, minutes, 0, 0);
        const isoDatetime = fullDatetime.toISOString();

        // Create transaction and update both accounts in parallel
        await Promise.all([
          createTransactionMutation.mutateAsync({
            type: 'Transfer',
            date: isoDatetime,
            accountId: form.fromAccountId,
            toAccountId: form.toAccountId,
            amount: form.amount,
            description: form.description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
            category: 'Transfer',
            paymentMethod: 'Internal Transfer',
            createdBy: user.id,
          }),
          // Update both accounts in parallel
          Promise.all([
            updateAccountMutation.mutateAsync({
              id: form.fromAccountId,
              updates: { currentBalance: fromAccount.currentBalance - form.amount }
            }),
            updateAccountMutation.mutateAsync({
              id: form.toAccountId,
              updates: { currentBalance: toAccount.currentBalance + form.amount }
            }),
          ]),
        ]);

        toast.success('Transfer completed successfully');
        // Invalidate to refresh data instead of navigating away
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        setForm({
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit', hour12: false }),
          fromAccountId: '',
          toAccountId: '',
          amount: 0,
          description: '',
        });
      } catch (err) {
        console.error('Transfer failed:', err);
        toast.error('Failed to complete transfer: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="md:text-2xl text-xl font-black text-gray-900 tracking-tight">Fund Transfer</h2>
          <p className="text-gray-500 font-medium">Move balances between your business accounts</p>
        </div>
      </div>

      <div className="bg-white p-8 lg:p-12 rounded-lg border border-gray-100 shadow-xl space-y-8">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount to Transfer (BDT)</label>
          <input type="number" className={`w-full text-xl font-black px-6 py-4 bg-[#ebf4ff] border-2 border-transparent focus:border-[#3c5a82] rounded-xl transition-all outline-none ${theme.colors.primary[600]}`} value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} placeholder="0.00" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">From Account (Source)</label>
            <select className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-bold`} value={form.fromAccountId} onChange={e => setForm({...form, fromAccountId: e.target.value})}>
              <option value="">Select an account</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">To Account (Destination)</label>
            <select className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-bold`} value={form.toAccountId} onChange={e => setForm({...form, toAccountId: e.target.value})}>
              <option value="">Select an account</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Transfer Date</label>
            <input type="date" className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg text-lg font-bold`} value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Transfer Time</label>
            <input type="time" className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg text-lg font-bold`} value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Memo / Description</label>
          <textarea className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-medium h-32 outline-none`} placeholder="Reason for transfer..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>

        <Button onClick={handleSave} variant="primary" size="lg" className="w-full" disabled={createTransactionMutation.isPending || updateAccountMutation.isPending}>
          {createTransactionMutation.isPending || updateAccountMutation.isPending ? 'Processing Transfer...' : 'Execute Transfer'}
        </Button>
      </div>
    </div>
  );
};

export default Transfer;
