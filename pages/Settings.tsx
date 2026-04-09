
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { ICONS, formatCurrency } from '../constants';
import { Button } from '../components';
import { theme } from '../theme';
import { OrderStatus, hasAdminAccess, type Settings } from '../types';
import { 
  useCategories, usePaymentMethods, useUnits,
  useCompanySettings, useOrderSettings, useInvoiceSettings, 
  useSystemDefaults, useCourierSettings, useAccounts, useProducts, useWalletSettings
} from '../src/hooks/useQueries';
import { 
  useCreateCategory, useDeleteCategory, 
  useCreatePaymentMethod, useDeletePaymentMethod, 
  useCreateUnit, useDeleteUnit,
  useBatchUpdateSettings
} from '../src/hooks/useMutations';
import { useAuth } from '../src/contexts/AuthProvider';
import { useToastNotifications } from '../src/contexts/ToastContext';
import { LoadingOverlay } from '../components';
import { fetchCarryBeeStores } from '../src/services/supabaseQueries';

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('company');
  const [showModal, setShowModal] = useState<'category' | 'payment' | 'unit' | null>(null);
  const queryClient = useQueryClient();

  // Query data from React Query hooks
  const { data: companySettingsData, isPending: companyLoading } = useCompanySettings();
  const { data: orderSettingsData, isPending: orderLoading } = useOrderSettings();
  const { data: invoiceSettingsData, isPending: invoiceLoading } = useInvoiceSettings();
  const { data: systemDefaultsData, isPending: defaultsLoading } = useSystemDefaults();
  const { data: courierSettingsData, isPending: courierLoading } = useCourierSettings();
  const { data: walletSettingsData, isPending: walletLoading } = useWalletSettings();
  const { data: categories = [], isPending: loadingCategories } = useCategories();
  const { data: paymentMethods = [], isPending: loadingPaymentMethods } = usePaymentMethods();
  const { data: units = [], isPending: loadingUnits } = useUnits();
  const { data: accounts = [] } = useAccounts();
  
  // Mutations
  const createCategoryMutation = useCreateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  const createPaymentMutation = useCreatePaymentMethod();
  const deletePaymentMutation = useDeletePaymentMethod();
  const createUnitMutation = useCreateUnit();
  const deleteUnitMutation = useDeleteUnit();
  const batchUpdateMutation = useBatchUpdateSettings();
  const toast = useToastNotifications();

  // Local state for forms (these need to be maintained locally until save)
  const [companySettings, setCompanySettings] = useState({ name: '', phone: '', email: '', address: '', logo: '' });
  const [orderSettings, setOrderSettings] = useState({ prefix: 'ORD-', nextNumber: 1 });
  const [courierSettings, setCourierSettings] = useState({
    steadfast: { baseUrl: '', apiKey: '', secretKey: '' },
    carryBee: { baseUrl: '', clientId: '', clientSecret: '', clientContext: '', storeId: '' },
    paperfly: { baseUrl: '', username: '', password: '', paperflyKey: '', defaultShopName: '', maxWeightKg: 0.3 },
  });
  const PAYROLL_STATUS_OPTIONS = [
    OrderStatus.ON_HOLD,
    OrderStatus.PROCESSING,
    OrderStatus.PICKED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ] as OrderStatus[];
  const [walletSettings, setWalletSettings] = useState({
    unitAmount: 0,
    countedStatuses: PAYROLL_STATUS_OPTIONS,
  });
  const payrollSettings = walletSettings;
  const [invoiceSettings, setInvoiceSettings] = useState({ title: 'Invoice', logoWidth: 120, logoHeight: 120, footer: '' });
  const [systemDefaults, setSystemDefaults] = useState<Settings['defaults']>({ 
    defaultAccountId: '', 
    defaultPaymentMethod: '', 
    incomeCategoryId: '', 
    expenseCategoryId: '', 
    recordsPerPage: 10 
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'Income' as 'Income' | 'Expense' | 'Product' | 'Other', color: '#10B981', parentId: '' });
  const [paymentForm, setPaymentForm] = useState({ name: '', description: '' });
  const [unitForm, setUnitForm] = useState({ name: '', shortName: '', description: '' });

  // CarryBee Stores state
  const [carryBeeStores, setCarryBeeStores] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingCarryBeeStores, setLoadingCarryBeeStores] = useState(false);

  // Initialize forms when data loads from React Query
  React.useEffect(() => {
    if (companySettingsData) setCompanySettings(companySettingsData);
  }, [companySettingsData]);

  React.useEffect(() => {
    if (orderSettingsData) setOrderSettings(orderSettingsData);
  }, [orderSettingsData]);

  React.useEffect(() => {
    if (invoiceSettingsData) setInvoiceSettings(invoiceSettingsData);
  }, [invoiceSettingsData]);

  React.useEffect(() => {
    if (systemDefaultsData) setSystemDefaults(systemDefaultsData);
  }, [systemDefaultsData]);

  React.useEffect(() => {
    if (courierSettingsData) setCourierSettings(courierSettingsData);
  }, [courierSettingsData]);

  React.useEffect(() => {
    if (!walletSettingsData) return;
    const countedStatuses = (walletSettingsData.countedStatuses || []).filter((status): status is OrderStatus =>
      PAYROLL_STATUS_OPTIONS.includes(status as OrderStatus)
    );
    setWalletSettings({
      ...walletSettingsData,
      countedStatuses: countedStatuses.length > 0 ? countedStatuses : PAYROLL_STATUS_OPTIONS,
    });
  }, [walletSettingsData]);

  // Fetch CarryBee stores when credentials change (debounced to avoid rapid calls while typing)
  useEffect(() => {
    let timer: any = null;
    const fetchStores = async () => {
      const { baseUrl, clientId, clientSecret, clientContext } = courierSettings.carryBee;
      
      // Only fetch if all required fields are filled (trim whitespace)
      const trimmedBaseUrl = baseUrl?.trim();
      const trimmedClientId = clientId?.trim();
      const trimmedClientSecret = clientSecret?.trim();
      const trimmedClientContext = clientContext?.trim();
      
      if (!trimmedBaseUrl || !trimmedClientId || !trimmedClientSecret || !trimmedClientContext) {
        setCarryBeeStores([]);
        return;
      }

      setLoadingCarryBeeStores(true);
      try {
        const stores = await fetchCarryBeeStores({
          baseUrl: trimmedBaseUrl,
          clientId: trimmedClientId,
          clientSecret: trimmedClientSecret,
          clientContext: trimmedClientContext,
        });
        setCarryBeeStores(stores);
      } catch (err) {
        console.error('Failed to fetch CarryBee stores:', err);
        setCarryBeeStores([]);
      } finally {
        setLoadingCarryBeeStores(false);
      }
    };

    // Debounce: wait 700ms after last change
    timer = setTimeout(() => {
      fetchStores();
    }, 700);

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [courierSettings.carryBee.baseUrl, courierSettings.carryBee.clientId, courierSettings.carryBee.clientSecret, courierSettings.carryBee.clientContext]);

  const loading = companyLoading || orderLoading || invoiceLoading || defaultsLoading || courierLoading || walletLoading || loadingCategories || loadingPaymentMethods || loadingUnits;
  const toggleWalletStatus = (status: OrderStatus) => {
    setWalletSettings((current) => ({
      ...current,
      countedStatuses: current.countedStatuses.includes(status)
        ? current.countedStatuses.filter((value) => value !== status)
        : [...current.countedStatuses, status],
    }));
  };
  const togglePayrollStatus = toggleWalletStatus;

  const handleSave = async () => {
    try {
      // Show toast immediately (optimistic UI)
      const toastId = toast.loading('Saving all settings...');
      
      // Save all settings in background without waiting
      batchUpdateMutation.mutateAsync({
        company: companySettings,
        order: orderSettings,
        invoice: invoiceSettings,
        defaults: systemDefaults,
        courier: courierSettings,
        wallet: walletSettings,
      }).then(() => {
        // Update mock db for backward compatibility
        db.settings.company = companySettings;
        db.settings.order = orderSettings;
        db.settings.invoice = invoiceSettings;
        db.settings.defaults = systemDefaults;
        db.settings.courier = courierSettings;
        db.settings.payroll = {
          ...db.settings.payroll,
          unitAmount: walletSettings.unitAmount,
          countedStatuses: walletSettings.countedStatuses,
        };
        
        // Update toast to success
        toast.update(toastId, 'Settings saved successfully!', 'success');
      }).catch((err) => {
        console.error('Failed to save settings:', err);
        toast.update(toastId, 'Failed to save settings: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      });
    } catch (err) {
      console.error('Failed to initiate settings save:', err);
      toast.error('Failed to save settings: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCompanySettings({...companySettings, logo: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast.warning('Please enter a category name');
      return;
    }
    
    // Create new category object with temporary ID
    const newCategory = {
      id: crypto.randomUUID(),
      name: categoryForm.name,
      type: categoryForm.type,
      color: categoryForm.color,
      parentId: categoryForm.parentId || undefined,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Optimistically update React Query cache immediately
    const previousCategories = queryClient.getQueryData(['categories']);
    queryClient.setQueryData(['categories'], (old: any[] = []) => [...old, newCategory]);
    
    // Show toast immediately
    const toastId = toast.loading('Adding category...');
    
    // Reset form and close modal
    const formData = { ...categoryForm };
    setCategoryForm({ name: '', type: 'Income', color: '#10B981', parentId: '' });
    setShowModal(null);
    
    try {
      // Save to database
      await createCategoryMutation.mutateAsync({
        name: formData.name,
        type: formData.type,
        color: formData.color,
        parentId: formData.parentId || undefined,
      });
      
      // Update toast to success
      toast.update(toastId, 'Category added successfully!', 'success');
    } catch (err) {
      console.error('Failed to add category:', err);
      // Rollback cache on error
      queryClient.setQueryData(['categories'], previousCategories);
      
      // Show error toast
      toast.update(toastId, 'Failed to add category: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      
      // Reopen modal so user can try again
      setShowModal('category');
      setCategoryForm(formData);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await deleteCategoryMutation.mutateAsync(id);
      toast.success('Category deleted successfully!');
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast.error('Failed to delete category: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleAddPayment = async () => {
    if (!paymentForm.name.trim()) {
      toast.warning('Please enter a payment method name');
      return;
    }
    
    // Create new payment method object with temporary ID
    const newPaymentMethod = {
      id: crypto.randomUUID(),
      name: paymentForm.name,
      description: paymentForm.description || '',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Optimistically update React Query cache immediately
    const previousPaymentMethods = queryClient.getQueryData(['paymentMethods']);
    queryClient.setQueryData(['paymentMethods'], (old: any[] = []) => [...old, newPaymentMethod]);
    
    // Show toast immediately
    const toastId = toast.loading('Adding payment method...');
    
    // Reset form and close modal
    const formData = { ...paymentForm };
    setPaymentForm({ name: '', description: '' });
    setShowModal(null);
    
    try {
      // Save to database
      await createPaymentMutation.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
      });
      
      // Update toast to success
      toast.update(toastId, 'Payment method added successfully!', 'success');
    } catch (err) {
      console.error('Failed to add payment method:', err);
      // Rollback cache on error
      queryClient.setQueryData(['paymentMethods'], previousPaymentMethods);
      
      // Show error toast
      toast.update(toastId, 'Failed to add payment method: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      
      // Reopen modal so user can try again
      setShowModal('payment');
      setPaymentForm(formData);
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      await deletePaymentMutation.mutateAsync(id);
      toast.success('Payment method deleted successfully!');
    } catch (err) {
      console.error('Failed to delete payment method:', err);
      toast.error('Failed to delete payment method: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleAddUnit = async () => {
    if (!unitForm.name.trim() || !unitForm.shortName.trim()) {
      toast.warning('Please enter unit name and short name');
      return;
    }
    
    // Create new unit object with temporary ID
    const newUnit = {
      id: crypto.randomUUID(),
      name: unitForm.name,
      short_name: unitForm.shortName,
      description: unitForm.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Optimistically update React Query cache immediately
    const previousUnits = queryClient.getQueryData(['units']);
    queryClient.setQueryData(['units'], (old: any[] = []) => [...old, newUnit]);
    
    // Show toast immediately
    const toastId = toast.loading('Adding unit...');
    
    // Reset form and close modal
    const formData = { ...unitForm };
    setUnitForm({ name: '', shortName: '', description: '' });
    setShowModal(null);
    
    try {
      // Save to database
      await createUnitMutation.mutateAsync({
        name: formData.name,
        shortName: formData.shortName,
        description: formData.description || undefined,
      });
      
      // Update toast to success
      toast.update(toastId, 'Unit added successfully!', 'success');
    } catch (err) {
      console.error('Failed to add unit:', err);
      // Rollback cache on error
      queryClient.setQueryData(['units'], previousUnits);
      
      // Show error toast
      toast.update(toastId, 'Failed to add unit: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
      
      // Reopen modal so user can try again
      setShowModal('unit');
      setUnitForm(formData);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this unit?')) return;
    try {
      await deleteUnitMutation.mutateAsync(id);
      toast.success('Unit deleted successfully!');
    } catch (err) {
      console.error('Failed to delete unit:', err);
      toast.error('Failed to delete unit: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const tabs = [
    { id: 'company', label: 'Company', icon: ICONS.Dashboard },
    { id: 'order', label: 'Order & Invoice', icon: ICONS.Sales },
    { id: 'defaults', label: 'Defaults', icon: ICONS.Settings },
    { id: 'wallet', label: 'Wallet', icon: ICONS.Payroll },
    { id: 'categories', label: 'Categories', icon: ICONS.More },
    { id: 'payments', label: 'Payment Methods', icon: ICONS.Banking },
    { id: 'courier', label: 'Courier', icon: ICONS.Courier },
  ];

  if (!user) {
    return <div className="p-8 text-center text-gray-500">Loading settings access...</div>;
  }

  if (!hasAdminAccess(user.role)) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Admin Access Only</p>
          <h2 className="mt-3 text-2xl font-black text-gray-900">Settings are available to admin-access users only.</h2>
          <p className="mt-2 text-sm font-medium text-gray-500">
            Wallet configuration, order defaults, and courier credentials can only be managed by admin-access users.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <LoadingOverlay isLoading={loading} message="Loading settings..." />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="md:text-2xl text-xl font-bold text-gray-900">Settings</h2>
        </div>
        <Button
          onClick={handleSave}
          variant="primary"
          size="md"
        >
          Save Changes
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id 
                  ? `${theme.colors.primary[600]} text-white shadow-sm border border-gray-100 ring-1 ring-[#ebf4ff]` 
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white p-8 rounded-xl border border-gray-100 shadow-sm min-h-[500px]">
          {activeTab === 'company' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-xl font-bold text-gray-800 border-b pb-4">Company Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex items-center gap-6 p-6 bg-gray-50 rounded-lg">
                   <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border">
                      {companySettings.logo && (
                        <img src={companySettings.logo} className="w-full h-full object-cover" />
                      )}
                   </div>
                   <div className="space-y-2">
                     <p className="text-xs font-bold text-gray-400 uppercase">Company Logo</p>
                     <input type="file" id="logo-input" className="hidden" onChange={handleLogoUpload} />
                     <Button variant="primary" size="sm" onClick={() => document.getElementById('logo-input')?.click()}>Change Logo</Button>
                   </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Company Name</label>
                  <input 
                    type="text" 
                    value={companySettings.name} 
                    onChange={e => setCompanySettings({...companySettings, name: e.target.value})}
                    className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#3c5a82] transition-all`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone</label>
                  <input 
                    type="text" 
                    value={companySettings.phone} 
                    onChange={e => setCompanySettings({...companySettings, phone: e.target.value})}
                    className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#3c5a82] transition-all`} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Email</label>
                  <input 
                    type="email" 
                    value={companySettings.email} 
                    onChange={e => setCompanySettings({...companySettings, email: e.target.value})}
                    className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-[#3c5a82] transition-all`} 
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Office Address</label>
                  <textarea 
                    value={companySettings.address} 
                    onChange={e => setCompanySettings({...companySettings, address: e.target.value})}
                    className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl h-24 focus:ring-2 focus:ring-[#3c5a82] transition-all`} 
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
                      value={orderSettings.prefix} 
                      onChange={e => setOrderSettings({...orderSettings, prefix: e.target.value})}
                      className={`w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-mono`} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Next Number</label>
                    <input 
                      type="number" 
                      value={orderSettings.nextNumber} 
                      onChange={e => setOrderSettings({...orderSettings, nextNumber: parseInt(e.target.value)})}
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
                      value={invoiceSettings.title} 
                      onChange={e => setInvoiceSettings({...invoiceSettings, title: e.target.value})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Logo Width (px)</label>
                    <input 
                      type="number" 
                      value={invoiceSettings.logoWidth} 
                      onChange={e => setInvoiceSettings({...invoiceSettings, logoWidth: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Logo Height (px)</label>
                    <input 
                      type="number" 
                      value={invoiceSettings.logoHeight} 
                      onChange={e => setInvoiceSettings({...invoiceSettings, logoHeight: parseInt(e.target.value)})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Invoice Footer</label>
                    <textarea 
                      value={invoiceSettings.footer} 
                      onChange={e => setInvoiceSettings({...invoiceSettings, footer: e.target.value})}
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
                    value={systemDefaults.defaultAccountId}
                    onChange={e => setSystemDefaults({...systemDefaults, defaultAccountId: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    <option value="">Select an account...</option>
                    {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Payment Method</label>
                  <select 
                    value={systemDefaults.defaultPaymentMethod}
                    onChange={e => setSystemDefaults({...systemDefaults, defaultPaymentMethod: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    <option value="">Select a payment method...</option>
                    {paymentMethods.map(pm => <option key={pm.id} value={pm.name}>{pm.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Income Category</label>
                  <select 
                    value={systemDefaults.incomeCategoryId}
                    onChange={e => setSystemDefaults({...systemDefaults, incomeCategoryId: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    <option value="">Select a category...</option>
                    {categories.filter(c => c.type === 'Income').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Expense Category</label>
                  <select 
                    value={systemDefaults.expenseCategoryId}
                    onChange={e => setSystemDefaults({...systemDefaults, expenseCategoryId: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                  >
                    <option value="">Select a category...</option>
                    {categories.filter(c => c.type === 'Expense').map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Records Per Page</label>
                  <input 
                    type="number" 
                    value={systemDefaults.recordsPerPage} 
                    onChange={e => setSystemDefaults({...systemDefaults, recordsPerPage: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payroll' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <section className="space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-xl font-bold text-gray-800">Wallet Settings</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Unit Amount (BDT)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={walletSettings.unitAmount}
                      onChange={(event) =>
                        setWalletSettings((current) => ({
                          ...current,
                          unitAmount: Number.parseFloat(event.target.value || '0') || 0,
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                    />
                    <p className="text-xs font-medium text-gray-400">
                      Employees earn this amount only when their order matches one of the payable statuses below.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#d6e3f0] bg-[#f8fbff] px-5 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Current Preview</p>
                    <p className="mt-3 text-lg font-black text-gray-900">{formatCurrency(walletSettings.unitAmount)}</p>
                    <p className="mt-2 text-sm font-medium text-gray-500">
                      Applied to each new employee-created order as a wallet credit.
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-xl font-bold text-gray-800">Counted Order Statuses</h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Select the exact order statuses that should be included in payroll calculations.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PAYROLL_STATUS_OPTIONS.map((status) => {
                    const checked = payrollSettings.countedStatuses.includes(status);
                    return (
                      <button
                        type="button"
                        key={status}
                        onClick={() => togglePayrollStatus(status)}
                        className={`flex items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
                          checked
                            ? 'border-[#c7dff5] bg-[#f8fbff] shadow-sm'
                            : 'border-gray-100 bg-gray-50/70 hover:border-gray-200 hover:bg-white'
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border text-[11px] ${
                            checked
                              ? 'border-[#0f2f57] bg-[#0f2f57] text-white'
                              : 'border-gray-300 bg-white text-transparent'
                          }`}
                        >
                          ✓
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-black text-gray-900">{status}</p>
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            {checked ? 'Included in payroll calculations.' : 'Excluded from payroll calculations.'}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Selected Statuses</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {payrollSettings.countedStatuses.map((status) => (
                      <span
                        key={status}
                        className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${theme.colors.primary[50]} ${theme.colors.primary.text}`}
                      >
                        {status}
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <section className="space-y-6">
                <div className="border-b border-gray-100 pb-4">
                  <h3 className="text-xl font-bold text-gray-800">Wallet Settings</h3>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Unit Amount (BDT)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={walletSettings.unitAmount}
                      onChange={(event) =>
                        setWalletSettings((current) => ({
                          ...current,
                          unitAmount: Number.parseFloat(event.target.value || '0') || 0,
                        }))
                      }
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                    />
                    <p className="text-xs font-medium text-gray-400">
                      Employees earn this amount every time they create a new order.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#d6e3f0] bg-[#f8fbff] px-5 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Current Preview</p>
                    <p className="mt-3 text-lg font-black text-gray-900">{formatCurrency(walletSettings.unitAmount)}</p>
                    <p className="mt-2 text-sm font-medium text-gray-500">
                      Applied to employee orders that are currently in the selected payable statuses.
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="text-xl font-bold text-gray-800">Payable Orders</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      Choose which order statuses should add wallet credit to the corresponding employee. Multiple statuses can be selected at the same time.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {Object.values(OrderStatus).map((status) => {
                      const checked = walletSettings.countedStatuses.includes(status);

                      return (
                        <label
                          key={status}
                          className={`flex cursor-pointer items-start gap-4 rounded-2xl border px-4 py-4 transition-all ${
                            checked
                              ? 'border-[#c7dff5] bg-[#f8fbff] shadow-sm'
                              : 'border-gray-100 bg-gray-50/70 hover:border-gray-200 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWalletStatus(status)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#0f2f57] focus:ring-[#3c5a82]"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-black text-gray-900">{status}</p>
                            <p className="mt-1 text-xs font-medium text-gray-500">
                              {checked ? 'Orders in this status will credit the employee wallet.' : 'Orders in this status will not credit the employee wallet.'}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Selected Statuses</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {walletSettings.countedStatuses.length > 0 ? (
                        walletSettings.countedStatuses.map((status) => (
                          <span
                            key={status}
                            className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] ${theme.colors.primary[50]} ${theme.colors.primary.text}`}
                          >
                            {status}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm font-medium text-gray-500">
                          No payable statuses selected. No wallet credit will be added until at least one status is checked.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800">Categories</h3>
                <Button
                  onClick={() => setShowModal('category')}
                  variant="primary"
                  size="md"
                >
                  {ICONS.Plus} Add
                </Button>
              </div>
              {loadingCategories ? (
                <div className="text-center py-8 text-gray-500">Loading categories...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-4 p-4 border rounded-lg bg-gray-50/50 hover:shadow-sm transition-all">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{cat.name}</p>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{cat.type}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        {ICONS.Delete}
                      </button>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      No categories yet. Click "Add Category" to create one.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex items-center justify-between border-b pb-4">
                <h3 className="text-xl font-bold text-gray-800">Payment Methods</h3>
                <Button
                  onClick={() => setShowModal('payment')}
                  variant="primary"
                  size="md"
                >
                  {ICONS.Plus} Add
                </Button>
              </div>
              {loadingPaymentMethods ? (
                <div className="text-center py-8 text-gray-500">Loading payment methods...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentMethods.map(pm => (
                    <div key={pm.id} className="p-4 border rounded-lg bg-gray-50/50 hover:shadow-sm transition-all flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{pm.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{pm.description || 'No description'}</p>
                      </div>
                      <button
                        onClick={() => handleDeletePayment(pm.id)}
                        className="text-red-500 hover:text-red-700 px-2"
                      >
                        {ICONS.Delete}
                      </button>
                    </div>
                  ))}
                  {paymentMethods.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      No payment methods yet. Click "Add Method" to create one.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'courier' && (
            <div className="space-y-10 animate-in fade-in duration-300">
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 flex items-center gap-2">
                  <img src="/uploads/steadfast.png" alt="Steadfast" className="w-6 h-6 rounded-full" />
                  <span className="">Steadfast</span> Secrets
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base URL</label>
                    <input 
                      type="text" 
                      value={courierSettings.steadfast.baseUrl}
                      onChange={e => setCourierSettings({...courierSettings, steadfast: {...courierSettings.steadfast, baseUrl: e.target.value}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">API Key</label>
                      <input 
                        type="text" 
                        value={courierSettings.steadfast.apiKey}
                        onChange={e => setCourierSettings({...courierSettings, steadfast: {...courierSettings.steadfast, apiKey: e.target.value}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Secret Key</label>
                      <input 
                        type="text" 
                        value={courierSettings.steadfast.secretKey}
                        onChange={e => setCourierSettings({...courierSettings, steadfast: {...courierSettings.steadfast, secretKey: e.target.value}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 flex items-center gap-2">
                  <img src="/uploads/carrybee.png" alt="CarryBee" className="w-6 h-6 rounded-full" />
                  <span className="">CarryBee</span> Secrets
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base URL</label>
                    <input 
                      type="text" 
                      value={courierSettings.carryBee.baseUrl}
                      onChange={e => setCourierSettings({...courierSettings, carryBee: {...courierSettings.carryBee, baseUrl: e.target.value}})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client ID</label>
                      <input 
                        type="text" 
                        value={courierSettings.carryBee.clientId}
                        onChange={e => setCourierSettings({...courierSettings, carryBee: {...courierSettings.carryBee, clientId: e.target.value}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client Secret</label>
                      <input 
                        type="text" 
                        value={courierSettings.carryBee.clientSecret}
                        onChange={e => setCourierSettings({...courierSettings, carryBee: {...courierSettings.carryBee, clientSecret: e.target.value}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Client Context</label>
                      <input 
                        type="text" 
                        value={courierSettings.carryBee.clientContext}
                        onChange={e => setCourierSettings({...courierSettings, carryBee: {...courierSettings.carryBee, clientContext: e.target.value}})}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Store ID</label>
                      <select 
                        value={courierSettings.carryBee.storeId}
                        onChange={e => setCourierSettings({...courierSettings, carryBee: {...courierSettings.carryBee, storeId: e.target.value}})}
                        disabled={loadingCarryBeeStores || carryBeeStores.length === 0}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">
                          {loadingCarryBeeStores ? 'Loading stores...' : carryBeeStores.length === 0 ? 'Fill CarryBee credentials first' : 'Select Store'}
                        </option>
                        {carryBeeStores.map(store => (
                          <option key={store.id} value={store.id}>{store.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 border-b pb-4 flex items-center gap-2">
                  <img src="/uploads/paperfly.png" alt="Paperfly" className="w-6 h-6 rounded-full" />
                  <span className="">Paperfly</span> Secrets
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Base URL</label>
                    <input
                      type="text"
                      value={courierSettings.paperfly.baseUrl}
                      onChange={e => setCourierSettings({ ...courierSettings, paperfly: { ...courierSettings.paperfly, baseUrl: e.target.value } })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Username</label>
                      <input
                        type="text"
                        value={courierSettings.paperfly.username}
                        onChange={e => setCourierSettings({ ...courierSettings, paperfly: { ...courierSettings.paperfly, username: e.target.value } })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Password</label>
                      <input
                        type="text"
                        value={courierSettings.paperfly.password}
                        onChange={e => setCourierSettings({ ...courierSettings, paperfly: { ...courierSettings.paperfly, password: e.target.value } })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Paperfly Key</label>
                      <input
                        type="text"
                        value={courierSettings.paperfly.paperflyKey}
                        onChange={e => setCourierSettings({ ...courierSettings, paperfly: { ...courierSettings.paperfly, paperflyKey: e.target.value } })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Shop Name</label>
                      <input
                        type="text"
                        value={courierSettings.paperfly.defaultShopName}
                        onChange={e => setCourierSettings({ ...courierSettings, paperfly: { ...courierSettings.paperfly, defaultShopName: e.target.value } })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Max Weight (kg)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={courierSettings.paperfly.maxWeightKg ?? 0.3}
                      onChange={e => setCourierSettings({
                        ...courierSettings,
                        paperfly: {
                          ...courierSettings.paperfly,
                          maxWeightKg: Number.parseFloat(e.target.value || '0'),
                        }
                      })}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl"
                    />
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
              <Button onClick={() => setShowModal(null)} variant="ghost" className="flex-1">Cancel</Button>
              <Button onClick={handleAddCategory} variant="primary" size="md" className="flex-1">Add Category</Button>
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
              <Button onClick={() => setShowModal(null)} variant="ghost" className="flex-1">Cancel</Button>
              <Button onClick={handleAddPayment} variant="primary" size="md" className="flex-1">Add Method</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
