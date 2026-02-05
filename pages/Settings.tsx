
import React, { useState } from 'react';
import { db, saveDb } from '../db';
import { ICONS, formatCurrency } from '../constants';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState(db.settings);
  const [showModal, setShowModal] = useState<'category' | 'payment' | null>(null);

  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'Income' as 'Income' | 'Expense' | 'Product', color: '#10B981', parentId: '' });
  const [paymentForm, setPaymentForm] = useState({ name: '', description: '' });

  const handleSave = () => {
    db.settings = settings;
    saveDb();
    alert('Settings saved successfully!');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSettings({...settings, company: {...settings.company, logo: reader.result as string}});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCategory = () => {
    const newCat = { id: Math.random().toString(36).substr(2, 9), ...categoryForm };
    const updatedSettings = { ...settings, categories: [...settings.categories, newCat] };
    setSettings(updatedSettings);
    setShowModal(null);
  };

  const handleAddPayment = () => {
    const newPM = { id: Math.random().toString(36).substr(2, 9), ...paymentForm };
    const updatedSettings = { ...settings, paymentMethods: [...settings.paymentMethods, newPM] };
    setSettings(updatedSettings);
    setShowModal(null);
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: ICONS.Dashboard },
    { id: 'order', label: 'Order & Invoice', icon: ICONS.Sales },
    { id: 'defaults', label: 'Defaults', icon: ICONS.Settings },
    { id: 'categories', label: 'Categories', icon: ICONS.More },
    { id: 'payments', label: 'Payment Methods', icon: ICONS.Banking },
    { id: 'courier', label: 'Courier', icon: ICONS.Courier },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <p className="text-gray-500 text-sm">Configure your accounting environment and business rules</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
        >
          Save All Changes
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id 
                  ? 'bg-white text-emerald-600 shadow-sm border border-gray-100 ring-1 ring-emerald-50' 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-[500px]">
          {activeTab === 'company' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Company Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex items-center gap-6 p-6 bg-gray-50 rounded-2xl">
                   <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border">
                      <img src={settings.company.logo} className="w-full h-full object-cover" />
                   </div>
                   <div className="space-y-2">
                     <p className="text-xs font-bold text-gray-400 uppercase">Company Logo</p>
                     <input type="file" id="logo-input" className="hidden" onChange={handleLogoUpload} />
                     <label htmlFor="logo-input" className="cursor-pointer px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">Change Logo</label>
                   </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Company Name</label>
                  <input 
                    type="text" 
                    value={settings.company.name} 
                    onChange={e => setSettings({...settings, company: {...settings.company, name: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                  <input 
                    type="text" 
                    value={settings.company.phone} 
                    onChange={e => setSettings({...settings, company: {...settings.company, phone: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email</label>
                  <input 
                    type="email" 
                    value={settings.company.email} 
                    onChange={e => setSettings({...settings, company: {...settings.company, email: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all" 
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Office Address</label>
                  <textarea 
                    value={settings.company.address} 
                    onChange={e => setSettings({...settings, company: {...settings.company, address: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl h-24 focus:ring-2 focus:ring-emerald-500 transition-all" 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'order' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Order Logic</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Order Prefix</label>
                    <input 
                      type="text" 
                      value={settings.order.prefix} 
                      onChange={e => setSettings({...settings, order: {...settings.order, prefix: e.target.value}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono text-emerald-600" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Next Number</label>
                    <input 
                      type="number" 
                      value={settings.order.nextNumber} 
                      onChange={e => setSettings({...settings, order: {...settings.order, nextNumber: parseInt(e.target.value)}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Invoice Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Invoice Title</label>
                    <input 
                      type="text" 
                      value={settings.invoice.title} 
                      onChange={e => setSettings({...settings, invoice: {...settings.invoice, title: e.target.value}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Logo Width (px)</label>
                    <input 
                      type="number" 
                      value={settings.invoice.logoWidth} 
                      onChange={e => setSettings({...settings, invoice: {...settings.invoice, logoWidth: parseInt(e.target.value)}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Logo Height (px)</label>
                    <input 
                      type="number" 
                      value={settings.invoice.logoHeight} 
                      onChange={e => setSettings({...settings, invoice: {...settings.invoice, logoHeight: parseInt(e.target.value)}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Invoice Footer</label>
                    <textarea 
                      value={settings.invoice.footer} 
                      onChange={e => setSettings({...settings, invoice: {...settings.invoice, footer: e.target.value}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl h-24" 
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'defaults' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4">System Defaults</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Account</label>
                  <select 
                    value={settings.defaults.accountId}
                    onChange={e => setSettings({...settings, defaults: {...settings.defaults, accountId: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    {db.accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Payment Method</label>
                  <select 
                    value={settings.defaults.paymentMethod}
                    onChange={e => setSettings({...settings, defaults: {...settings.defaults, paymentMethod: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    {settings.paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Income Category</label>
                  <select 
                    value={settings.defaults.incomeCategoryId}
                    onChange={e => setSettings({...settings, defaults: {...settings.defaults, incomeCategoryId: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    {settings.categories.filter(c => c.type === 'Income').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Expense Category</label>
                  <select 
                    value={settings.defaults.expenseCategoryId}
                    onChange={e => setSettings({...settings, defaults: {...settings.defaults, expenseCategoryId: e.target.value}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    {settings.categories.filter(c => c.type === 'Expense').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Records Per Page</label>
                  <input 
                    type="number" 
                    value={settings.defaults.recordsPerPage} 
                    onChange={e => setSettings({...settings, defaults: {...settings.defaults, recordsPerPage: parseInt(e.target.value)}})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800">Categories</h3>
                <button onClick={() => setShowModal('category')} className="text-emerald-600 font-bold text-sm flex items-center gap-1 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all">
                  {ICONS.Plus} Add Category
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-4 p-4 border rounded-2xl bg-gray-50/50">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{cat.name}</p>
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{cat.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800">Payment Methods</h3>
                <button onClick={() => setShowModal('payment')} className="text-emerald-600 font-bold text-sm flex items-center gap-1 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-all">
                  {ICONS.Plus} Add Method
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settings.paymentMethods.map(pm => (
                  <div key={pm.id} className="p-4 border rounded-2xl bg-gray-50/50">
                    <p className="font-bold text-gray-800">{pm.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{pm.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'courier' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 flex items-center gap-2">
                  <span className="text-blue-600">Steadfast</span> Logistics
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base URL</label>
                    <input 
                      type="text" 
                      value={settings.courier.steadfast.baseUrl}
                      onChange={e => setSettings({...settings, courier: {...settings.courier, steadfast: {...settings.courier.steadfast, baseUrl: e.target.value}}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">API Key</label>
                      <input 
                        type="password" 
                        value={settings.courier.steadfast.apiKey}
                        onChange={e => setSettings({...settings, courier: {...settings.courier, steadfast: {...settings.courier.steadfast, apiKey: e.target.value}}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Secret Key</label>
                      <input 
                        type="password" 
                        value={settings.courier.steadfast.secretKey}
                        onChange={e => setSettings({...settings, courier: {...settings.courier, steadfast: {...settings.courier.steadfast, secretKey: e.target.value}}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 flex items-center gap-2">
                  <span className="text-orange-600">CarryBee</span> Fulfillment
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base URL</label>
                    <input 
                      type="text" 
                      value={settings.courier.carryBee.baseUrl}
                      onChange={e => setSettings({...settings, courier: {...settings.courier, carryBee: {...settings.courier.carryBee, baseUrl: e.target.value}}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client ID</label>
                      <input 
                        type="text" 
                        value={settings.courier.carryBee.clientId}
                        onChange={e => setSettings({...settings, courier: {...settings.courier, carryBee: {...settings.courier.carryBee, clientId: e.target.value}}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client Secret</label>
                      <input 
                        type="password" 
                        value={settings.courier.carryBee.clientSecret}
                        onChange={e => setSettings({...settings, courier: {...settings.courier, carryBee: {...settings.courier.carryBee, clientSecret: e.target.value}}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {showModal === 'category' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowModal(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-8 space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Add Category</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Type</label>
                <select 
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl"
                  value={categoryForm.type}
                  onChange={e => setCategoryForm({...categoryForm, type: e.target.value as any})}
                >
                  <option value="Income">Income</option>
                  <option value="Expense">Expense</option>
                  <option value="Product">Product</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Color</label>
                <input 
                  type="color" 
                  className="w-full h-12 bg-gray-50 border rounded-xl cursor-pointer"
                  value={categoryForm.color}
                  onChange={e => setCategoryForm({...categoryForm, color: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowModal(null)} className="flex-1 py-3 font-bold text-gray-500">Cancel</button>
              <button onClick={handleAddCategory} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Add Category</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'payment' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowModal(null)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 p-8 space-y-6">
            <h3 className="text-xl font-bold text-gray-900">Add Payment Method</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Method Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl"
                  value={paymentForm.name}
                  onChange={e => setPaymentForm({...paymentForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Description</label>
                <textarea 
                  className="w-full px-4 py-3 bg-gray-50 border rounded-xl h-24"
                  value={paymentForm.description}
                  onChange={e => setPaymentForm({...paymentForm, description: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowModal(null)} className="flex-1 py-3 font-bold text-gray-500">Cancel</button>
              <button onClick={handleAddPayment} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold">Add Method</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
