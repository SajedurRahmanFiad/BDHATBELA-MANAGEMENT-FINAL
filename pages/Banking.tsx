
import React, { useState } from 'react';
import { db, saveDb } from '../db';
import { Account } from '../types';
import { formatCurrency, ICONS } from '../constants';

const Banking: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>(db.accounts);
  const [showAddModal, setShowAddModal] = useState(false);
  // Fixed: Explicitly typed the state to allow both 'Bank' and 'Cash' types, avoiding type mismatch during state updates
  const [newAcc, setNewAcc] = useState<{ name: string; type: 'Bank' | 'Cash'; openingBalance: number }>({ 
    name: '', 
    type: 'Bank', 
    openingBalance: 0 
  });

  const handleAddAccount = () => {
    if (!newAcc.name) return;
    const account: Account = {
      id: Math.random().toString(36).substr(2, 9),
      name: newAcc.name,
      type: newAcc.type,
      openingBalance: newAcc.openingBalance,
      currentBalance: newAcc.openingBalance
    };
    db.accounts.push(account);
    saveDb();
    setAccounts([...db.accounts]);
    setShowAddModal(false);
    setNewAcc({ name: '', type: 'Bank', openingBalance: 0 });
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Banking & Accounts</h2>
          <p className="text-gray-500 text-sm">Monitor balances and manage cash flow across all accounts</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg"
        >
          {ICONS.Plus}
          Add Account
        </button>
      </div>

      {/* Summary Card */}
      <div className="bg-emerald-600 rounded-3xl p-8 text-white shadow-xl shadow-emerald-200/50 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-emerald-100 font-medium text-sm mb-1 uppercase tracking-wider">Total Combined Balance</p>
          <h1 className="text-4xl font-black">{formatCurrency(totalBalance)}</h1>
          <div className="mt-8 flex gap-6">
            <div>
              <p className="text-emerald-200 text-xs font-bold uppercase">Bank Accounts</p>
              <p className="text-xl font-bold">{accounts.filter(a => a.type === 'Bank').length}</p>
            </div>
            <div className="w-px bg-emerald-500/50 h-10"></div>
            <div>
              <p className="text-emerald-200 text-xs font-bold uppercase">Cash Accounts</p>
              <p className="text-xl font-bold">{accounts.filter(a => a.type === 'Cash').length}</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <div className="w-48 h-48 border-[24px] border-white rounded-full"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${acc.type === 'Bank' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                {acc.type === 'Bank' ? ICONS.Banking : ICONS.Banking}
              </div>
              <button className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                {ICONS.More}
              </button>
            </div>
            <h3 className="text-lg font-bold text-gray-900">{acc.name}</h3>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-tight mb-4">{acc.type} Account</p>
            <div className="space-y-2 pt-4 border-t border-gray-50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Opening Balance</span>
                <span className="font-semibold text-gray-700">{formatCurrency(acc.openingBalance)}</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-bold text-gray-900">Current Balance</span>
                <span className="text-xl font-black text-emerald-600">{formatCurrency(acc.currentBalance)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Add New Account</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Account Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. City Bank - 0987" 
                  className="w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  value={newAcc.name}
                  onChange={e => setNewAcc({...newAcc, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Account Type</label>
                <select 
                  className="w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  value={newAcc.type}
                  onChange={e => setNewAcc({...newAcc, type: e.target.value as 'Bank' | 'Cash'})}
                >
                  <option value="Bank">Bank</option>
                  <option value="Cash">Cash</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-gray-700">Opening Balance</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="w-full px-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  value={newAcc.openingBalance}
                  onChange={e => setNewAcc({...newAcc, openingBalance: parseFloat(e.target.value) || 0})}
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 rounded-b-2xl flex gap-3">
              <button 
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 font-bold text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddAccount}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Banking;
