
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Customer } from '../types';
import { Button } from '../components';
import { theme } from '../theme';
import { useCustomer } from '../src/hooks/useQueries';
import { useCreateCustomer, useUpdateCustomer } from '../src/hooks/useMutations';

const CustomerForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  const [form, setForm] = useState({ name: '', phone: '', address: '' });
  const [error, setError] = useState<string | null>(null);

  const { data: customer, isPending: loading, error: fetchError } = useCustomer(isEdit ? id : undefined);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  useEffect(() => {
    if (customer) {
      setForm({ 
        name: customer.name, 
        phone: customer.phone, 
        address: customer.address 
      });
    }
  }, [customer]);

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      setError('Name and phone are required');
      return;
    }
    
    setError(null);
    
    try {
      if (isEdit) {
        const updates: Partial<Customer> = {
          name: form.name,
          phone: form.phone,
          address: form.address,
        };
        await updateMutation.mutateAsync({ id: id!, updates });
        navigate('/customers');
      } else {
        const newCustomer: Omit<Customer, 'id'> = {
          name: form.name,
          phone: form.phone,
          address: form.address,
          totalOrders: 0,
          dueAmount: 0,
        };

        // Await the mutation so we can catch AbortError and other failures
        try {
          await createMutation.mutateAsync(newCustomer);
          navigate('/customers');
        } catch (err: any) {
          console.error('Create customer failed:', err);
          setError(err instanceof Error ? err.message : 'Failed to create customer');
        }
      }
    } catch (err) {
      console.error(`Failed to ${isEdit ? 'update' : 'create'} customer:`, err);
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} customer`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="md:text-2xl text-xl font-black text-gray-900 tracking-tight">{isEdit ? 'Edit Customer' : 'New Customer'}</h2>
        <button onClick={() => navigate(-1)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-all">Cancel</button>
      </div>
      <div className="bg-white p-10 rounded-xl border border-gray-100 shadow-xl space-y-8">
        {isEdit && loading ? (
          <div className="text-center text-gray-500">Loading customer...</div>
        ) : (
          <>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-bold text-red-600">{error}</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Name</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-2xl font-bold transition-all outline-none"
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Phone Number</label>
              <input 
                type="text" 
                className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-2xl font-bold transition-all outline-none"
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Address</label>
              <textarea 
                className="w-full px-6 py-4 bg-gray-50 border-transparent focus:border-[#3c5a82] focus:bg-white rounded-lg font-medium h-32 transition-all outline-none"
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
              {(createMutation.isPending || updateMutation.isPending) ? (isEdit ? 'Updating...' : 'Adding...') : (isEdit ? 'Update Customer' : 'Add Customer')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default CustomerForm;
