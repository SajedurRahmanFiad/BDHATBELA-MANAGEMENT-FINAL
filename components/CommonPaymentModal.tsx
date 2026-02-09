import React from 'react';
import { Button } from './index';
import { formatCurrency } from '../constants';
import { theme } from '../theme';
import { Account } from '../types';

interface CommonPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
  accounts: Account[];
  paymentForm: {
    date: string;
    accountId: string;
    amount: number;
  };
  setPaymentForm: (form: any) => void;
  isLoading: boolean;
  title?: string;
  buttonText?: string;
}

/**
 * CommonPaymentModal - A reusable payment modal component for orders and bills
 * Accepts custom title and button text for flexibility across different pages
 */
const CommonPaymentModal: React.FC<CommonPaymentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  accounts,
  paymentForm,
  setPaymentForm,
  isLoading,
  title = 'Record Payment',
  buttonText = 'Add Payment',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 z-[210] animate-in zoom-in-95 duration-200 border border-[#ebf4ff]">
        <h3 className="text-2xl font-black text-gray-900 mb-8">{title}</h3>
        <div className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Payment Date</label>
            <input 
              type="date" 
              value={paymentForm.date} 
              onChange={e => setPaymentForm({...paymentForm, date: e.target.value})}
              disabled={isLoading}
              className="w-full px-6 py-3.5 bg-gray-50 border border-gray-100 rounded-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Select Account</label>
            <select 
              value={paymentForm.accountId} 
              onChange={e => setPaymentForm({...paymentForm, accountId: e.target.value})}
              disabled={isLoading}
              className="w-full px-6 py-3.5 bg-gray-50 border border-gray-100 rounded-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
            >
              <option value="">Select an account...</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.currentBalance)})</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Amount (BDT)</label>
            <input 
              type="number" 
              value={paymentForm.amount} 
              onChange={e => setPaymentForm({...paymentForm, amount: parseFloat(e.target.value) || 0})}
              disabled={isLoading}
              className={`w-full px-6 py-4 bg-[#ebf4ff] border-2 border-[#c7dff5] rounded-lg font-black ${theme.colors.primary[600]} text-xl outline-none disabled:opacity-50`}
            />
          </div>

          <div className="pt-6 flex gap-4">
            <Button 
              onClick={onClose} 
              variant="ghost" 
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              onClick={onSubmit} 
              variant="primary" 
              size="md" 
              className="flex-1"
              disabled={isLoading} 
              loading={isLoading}
            >
              {buttonText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommonPaymentModal;
