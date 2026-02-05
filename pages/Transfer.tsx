
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Transaction } from '../types';
// Fixed: Added formatCurrency to the imports from constants to resolve "Cannot find name 'formatCurrency'" errors on lines 76 and 82.
import { ICONS, formatCurrency } from '../constants';
import { Button } from '../components';
import { theme } from '../theme';

const Transfer: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    fromAccountId: db.accounts[0]?.id || '',
    toAccountId: db.accounts[1]?.id || '',
    amount: 0,
    description: '',
  });

  const handleSave = () => {
    if (!form.amount || !form.fromAccountId || !form.toAccountId) {
      alert('Please fill in all fields.');
      return;
    }
    if (form.fromAccountId === form.toAccountId) {
      alert('Cannot transfer to the same account.');
      return;
    }

    const fromAccount = db.accounts.find(a => a.id === form.fromAccountId);
    const toAccount = db.accounts.find(a => a.id === form.toAccountId);

    if (fromAccount && toAccount) {
      if (fromAccount.currentBalance < form.amount) {
        alert('Insufficient balance in source account.');
        return;
      }
      fromAccount.currentBalance -= form.amount;
      toAccount.currentBalance += form.amount;

      const transfer: Transaction = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'Transfer',
        date: form.date,
        accountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        amount: form.amount,
        description: form.description || `Transfer from ${fromAccount.name} to ${toAccount.name}`,
        category: 'Transfer',
        paymentMethod: 'Internal Transfer',
      };

      db.transactions.unshift(transfer);
      saveDb();
      navigate('/banking/transactions');
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Fund Transfer</h2>
          <p className="text-gray-500 font-medium">Move balances between your business accounts</p>
        </div>
      </div>

      <div className="bg-white p-8 lg:p-12 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-8">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount to Transfer (BDT)</label>
          <input type="number" className={`w-full text-4xl font-black px-6 py-4 bg-[#ebf4ff] border-2 border-transparent focus:border-[#3c5a82] rounded-xl transition-all outline-none ${theme.colors.primary[600]}`} value={form.amount} onChange={e => setForm({...form, amount: parseFloat(e.target.value) || 0})} placeholder="0.00" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">From Account (Source)</label>
            <select className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-bold`} value={form.fromAccountId} onChange={e => setForm({...form, fromAccountId: e.target.value})}>
              {db.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">To Account (Destination)</label>
            <select className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-bold`} value={form.toAccountId} onChange={e => setForm({...form, toAccountId: e.target.value})}>
              {db.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Transfer Date</label>
          <input type="date" className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg text-lg font-bold`} value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Memo / Description</label>
          <textarea className={`w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-medium h-32 outline-none`} placeholder="Reason for transfer..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>

        <Button onClick={handleSave} variant="primary" size="lg" className="w-full">Execute Transfer</Button>
      </div>
    </div>
  );
};

export default Transfer;
