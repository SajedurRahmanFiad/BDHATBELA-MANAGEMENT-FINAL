
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Vendor } from '../types';
import { Button } from '../components';
import { theme } from '../theme';
import { useVendor } from '../src/hooks/useQueries';
import { useCreateVendor, useUpdateVendor } from '../src/hooks/useMutations';
import { useAuth } from '../src/contexts/AuthProvider';

const VendorForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoading: authLoading } = useAuth();
  const isEdit = Boolean(id);
  
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: vendor, isPending: loading, error: fetchError } = useVendor(isEdit ? id : undefined);
  const createMutation = useCreateVendor();
  const updateMutation = useUpdateVendor();

  useEffect(() => {
    if (vendor) {
      setForm({ 
        name: vendor.name, 
        phone: vendor.phone, 
        address: vendor.address 
      });
    }
  }, [vendor]);

  const handleSave = async () => {
    if (authLoading) {
      setError('Authenticating... Please wait');
      return;
    }
    
    if (!form.name || !form.phone) {
      setError('Business name and phone are required');
      return;
    }
    
    setError(null);
    
    try {
      if (isEdit) {
        const updates: Partial<Vendor> = {
          name: form.name,
          phone: form.phone,
          address: form.address,
        };
        await updateMutation.mutateAsync({ id: id!, updates });
        navigate('/vendors');
      } else {
        const newVendor: Omit<Vendor, 'id'> = {
          name: form.name,
          phone: form.phone,
          address: form.address,
          totalPurchases: 0,
          dueAmount: 0,
        };
        // Trigger mutation and navigate immediately (don't wait for background tasks)
        createMutation.mutateAsync(newVendor).then(
          () => {
            navigate('/vendors');
          },
          (err) => {
            setError(err instanceof Error ? err.message : 'Failed to create vendor');
          }
        );
      }
    } catch (err) {
      console.error(`Failed to ${isEdit ? 'update' : 'create'} vendor:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} vendor`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">{isEdit ? 'Edit Vendor' : 'New Vendor'}</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
      </div>
      <div className="bg-white p-10 rounded-xl border border-gray-100 shadow-xl space-y-8">
        {isEdit && loading ? (
          <div className="text-center text-gray-500">Loading vendor...</div>
        ) : (
          <>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-bold text-red-600">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Vendor/Business Name</label>
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
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Vendor' : 'Add Vendor')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VendorForm;