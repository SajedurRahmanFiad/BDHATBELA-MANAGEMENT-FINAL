
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { UserRole } from '../types';
import { ICONS } from '../constants';
import { theme } from '../theme';
import { useUser } from '../src/hooks/useQueries';
import { useDeleteUser } from '../src/hooks/useMutations';
import { useToastNotifications } from '../src/contexts/ToastContext';

const UserDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = db.currentUser;
  const { data: user, isPending: loading, error } = useUser(id);
  const deleteUserMutation = useDeleteUser();
  const toast = useToastNotifications();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading user...</div>;
  if (error || !user) return <div className="p-8 text-center text-gray-500">{error?.message || 'User not found.'}</div>;

  const canEdit = currentUser.role === UserRole.ADMIN || currentUser.id === id;
  const isAdmin = currentUser.role === UserRole.ADMIN;

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteUserMutation.mutateAsync(id);
      toast.success('User deleted successfully!');
      navigate('/users');
    } catch (err) {
      console.error('Failed to delete user:', err);
      toast.error('Failed to delete user: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/users')} className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-gray-200 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900">User Profile</h2>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <button 
              onClick={() => navigate(`/users/edit/${user.id}`)}
              className={`px-6 py-2 ${theme.colors.primary[600]} text-white rounded-xl font-bold hover:${theme.colors.primary[700]} shadow-md flex items-center gap-2`}
            >
              {ICONS.Edit} Edit Profile
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteUserMutation.isPending}
              className="px-6 py-2 bg-red-50 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Delete User
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className={`h-32 bg-gradient-to-r from-[#0f2f57] to-[#1a3a6e]`}></div>
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-8">
            <div className="p-1 bg-white rounded-full shadow-xl">
              <img 
                src={user.image || 'https://picsum.photos/200/200?random=' + user.id} 
                className="w-24 h-24 rounded-full object-cover border-1 border-black" 
              />
            </div>
            <span className={`px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
              user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {user.role}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Full Name</p>
                <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                <p className="text-lg font-medium text-gray-700">{user.phone}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Joining Date</p>
                <p className="text-lg font-medium text-gray-700">{user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</p>
              </div>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg space-y-4">
              <h4 className="font-bold text-gray-900">Account Security</h4>
              <p className="text-sm text-gray-500">Passwords are managed by system administrators. If you need to reset your password, please contact the IT department.</p>
              <div className={`flex items-center gap-2 text-emerald-700 text-sm font-bold`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                Active Status Verified
              </div>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete User?</h3>
              <p className="text-gray-600 text-sm">
                Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleteUserMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetails;
