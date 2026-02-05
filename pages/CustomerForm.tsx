
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Customer } from '../types';

const CustomerForm: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const handleSave = () => {
    if (!form.name || !form.phone) return;
    const customer: Customer = {
      id: Math.random().toString(36).substr(2, 9),
      ...form,
      totalOrders: 0,
      dueAmount: 0
    };
    db.customers.unshift(customer);
    saveDb();
    navigate('/customers');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">New Customer</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
      </div>
      <div className="bg-white p-10 rounded-[2.5rem] border border-gray-100 shadow-xl space-y-8">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Name</label>
          <input 
            type="text" 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl font-bold transition-all outline-none"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Phone Number</label>
          <input 
            type="text" 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl font-bold transition-all outline-none"
            value={form.phone}
            onChange={e => setForm({...form, phone: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Address</label>
          <textarea 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-emerald-500 focus:bg-white rounded-2xl font-medium h-32 transition-all outline-none"
            value={form.address}
            onChange={e => setForm({...form, address: e.target.value})}
          />
        </div>
        <button 
          onClick={handleSave}
          className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-emerald-200 hover:bg-emerald-700 active:scale-95 transition-all"
        >
          Add Customer
        </button>
      </div>
    </div>
  );
};

export default CustomerForm;
