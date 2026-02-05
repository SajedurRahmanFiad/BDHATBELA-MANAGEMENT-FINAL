
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';
import { Vendor } from '../types';
import { Button } from '../components';
import { theme } from '../theme';

const VendorForm: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', address: '' });

  const handleSave = () => {
    if (!form.name || !form.phone) return;
    const vendor: Vendor = {
      id: Math.random().toString(36).substr(2, 9),
      ...form,
      totalPurchases: 0,
      dueAmount: 0
    };
    db.vendors.unshift(vendor);
    saveDb();
    navigate('/vendors');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">New Vendor</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
      </div>
      <div className="bg-white p-10 rounded-xl border border-gray-100 shadow-xl space-y-8">
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Business Name</label>
          <input 
            type="text" 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white rounded-lg font-bold transition-all outline-none"
            value={form.name}
            onChange={e => setForm({...form, name: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Contact Person / Phone</label>
          <input 
            type="text" 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white rounded-lg font-bold transition-all outline-none"
            value={form.phone}
            onChange={e => setForm({...form, phone: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Office Address</label>
          <textarea 
            className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-blue-500 focus:bg-white rounded-lg font-medium h-32 transition-all outline-none"
            value={form.address}
            onChange={e => setForm({...form, address: e.target.value})}
          />
        </div>
        <Button 
          onClick={handleSave}
          variant="primary"
          size="lg"
          className="w-full"
        >
          Add Vendor
        </Button>
      </div>
    </div>
  );
};

export default VendorForm;
