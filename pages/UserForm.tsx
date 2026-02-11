
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User, UserRole } from '../types';
import { Button } from '../components';
import { theme } from '../theme';
import { useUser } from '../src/hooks/useQueries';
import { useCreateUser, useUpdateUser, useDeleteUser } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';

const UserForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  
  // Query user if editing
  const { data: existingUser, isPending: userLoading, error: userError } = useUser(isEdit ? id : undefined);
  
  // Mutations
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const toast = useToastNotifications();
  
  // Form state
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [form, setForm] = useState<Partial<User>>({
    name: '',
    phone: '',
    password: '',
    role: UserRole.EMPLOYEE,
    image: ''
  });

  // Initialize form with existing user data when loaded
  React.useEffect(() => {
    if (existingUser) {
      setForm(existingUser);
    }
  }, [existingUser]);

  // Get current user from localStorage (basic approach)
  const currentUserStr = localStorage.getItem('currentUser');
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isSelf = currentUser?.id === id;

  const loading = userLoading;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setForm({...form, image: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.phone || (isAdmin && !isEdit && !form.password)) {
      toast.warning('Please fill mandatory fields (Name, Phone, Password)');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && id) {
        // Update existing user
        const updates: Partial<User> = {
          name: form.name,
          phone: form.phone,
          image: form.image,
        };
        
        // Only allow password and role changes if admin
        if (isAdmin) {
          if (form.password) updates.password = form.password;
          if (form.role) updates.role = form.role;
        }
        
        await updateMutation.mutateAsync({ id, updates });
        
        // Update currentUser in localStorage if editing self
        if (isSelf && currentUser) {
          const updated = { ...currentUser, ...updates };
          localStorage.setItem('currentUser', JSON.stringify(updated));
        }
      } else {
        // Create new user
        if (!isAdmin) {
          toast.error('Only admins can add users');
          setSaving(false);
          return;
        }
        
        await createMutation.mutateAsync({
          name: form.name || '',
          phone: form.phone || '',
          password: form.password || '',
          role: form.role || UserRole.EMPLOYEE,
          image: form.image || ''
        } as any);
      }

      toast.success(isEdit ? 'User updated successfully!' : 'User created successfully!');
      navigate('/users');
    } catch (err) {
      console.error('Failed to save user:', err);
      toast.error('Failed to save user: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    setSaving(true);
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('User deleted successfully!');
      navigate('/users');
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('Failed to delete user: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="md:text-2xl text-xl font-bold text-gray-900">{isEdit ? 'Edit Profile' : 'Add User'}</h2>
        <button onClick={() => navigate('/users')} className="px-4 py-2 border rounded-xl font-bold bg-white text-gray-500 hover:bg-gray-50">Cancel</button>
      </div>

      {isEdit && loading && (
        <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm text-center text-gray-500">
          Loading user details...
        </div>
      )}

      {userError && (
        <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-red-700">
          {userError.message || 'User not found'}
        </div>
      )}

      {(!isEdit || !loading) && (
        <div className="bg-white p-8 rounded-lg border border-gray-100 shadow-sm space-y-6">
          <div className="space-y-6">
            <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-lg">
              <div className="w-20 h-20 rounded-[50%] overflow-hidden bg-white border">
                <img src={form.image || `https://ui-avatars.com/api/?name=${form.name || 'User'}&background=10b981&color=fff`} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Profile Photo</p>
                <input type="file" id="user-pfp" className="hidden" onChange={handleFileUpload} />
                <label htmlFor="user-pfp" className={`cursor-pointer px-4 py-2 ${theme.colors.primary[600]} text-white text-xs font-bold rounded-lg hover:${theme.colors.primary[700]}`}>Upload Picture</label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
              <input type="text" className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#3c5a82]`} value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
              <input type="text" className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#3c5a82]`} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>

            {isAdmin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Password (Admin Only Access)</label>
                <input type="password" className="w-full px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-500" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder={isEdit ? "Leave blank to keep current password" : "Secure system password"} />
                <p className="text-[10px] text-purple-400 font-medium">Only administrators can set or change passwords.</p>
              </div>
            )}

            {isAdmin && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">System Role</label>
                <select className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-[#3c5a82]`} value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})}>
                  <option value={UserRole.EMPLOYEE}>Employee</option>
                  <option value={UserRole.ADMIN}>Administrator</option>
                </select>
              </div>
            )}
          </div>
          <div className="pt-6 space-y-3">
            <Button 
              onClick={handleSave}
              variant="primary"
              size="lg"
              className="w-full"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Details'}
            </Button>
            
            {isEdit && isAdmin && (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                disabled={saving}
                className="w-full px-4 py-3 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete User
              </button>
            )}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User?</h3>
              <p className="text-gray-600 text-sm">
                Are you sure you want to delete <strong>{form.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserForm;
