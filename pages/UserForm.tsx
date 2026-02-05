
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, saveDb } from '../db';
import { User, UserRole } from '../types';

const UserForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const currentUser = db.currentUser;
  const isAdmin = currentUser.role === UserRole.ADMIN;
  const isSelf = currentUser.id === id;

  const [form, setForm] = useState<Partial<User>>({
    name: '',
    phone: '',
    password: '',
    role: UserRole.EMPLOYEE,
    image: ''
  });

  useEffect(() => {
    if (isEdit) {
      const user = db.users.find(u => u.id === id);
      if (user) setForm(user);
    }
  }, [id, isEdit]);

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

  const handleSave = () => {
    if (!form.name || !form.phone || (isAdmin && !isEdit && !form.password)) {
      alert('Please fill mandatory fields (Name, Phone, Password)');
      return;
    }

    const userData: User = {
      id: isEdit ? id! : Math.random().toString(36).substr(2, 9),
      name: form.name || '',
      phone: form.phone || '',
      role: form.role || UserRole.EMPLOYEE,
      image: form.image || '',
      password: form.password || ''
    };

    if (isEdit) {
      const idx = db.users.findIndex(u => u.id === id);
      if (!isAdmin) {
        const old = db.users[idx];
        userData.password = old.password;
        userData.role = old.role;
      }
      db.users[idx] = userData;
      if (isSelf) db.currentUser = userData;
    } else {
      if (!isAdmin) {
        alert("Only admins can add users");
        return;
      }
      db.users.push(userData);
    }

    saveDb();
    navigate('/users');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Profile' : 'Add System User'}</h2>
        <button onClick={() => navigate('/users')} className="px-4 py-2 border rounded-xl font-bold bg-white text-gray-500 hover:bg-gray-50">Cancel</button>
      </div>

      <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-6">
        <div className="space-y-6">
          <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-2xl">
             <div className="w-20 h-20 rounded-xl overflow-hidden bg-white border">
                <img src={form.image || `https://ui-avatars.com/api/?name=${form.name || 'User'}&background=10b981&color=fff`} className="w-full h-full object-cover" />
             </div>
             <div className="space-y-2">
               <p className="text-xs font-bold text-gray-400 uppercase">Profile Photo</p>
               <input type="file" id="user-pfp" className="hidden" onChange={handleFileUpload} />
               <label htmlFor="user-pfp" className="cursor-pointer px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">Upload Picture</label>
             </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Full Name</label>
            <input type="text" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-emerald-500" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phone Number</label>
            <input type="text" className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-emerald-500" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
          </div>

          {isAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Password (Admin Only Access)</label>
              <input type="password" className="w-full px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl focus:ring-2 focus:ring-purple-500" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Secure system password" />
              <p className="text-[10px] text-purple-400 font-medium">Only administrators can set or change passwords.</p>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">System Role</label>
              <select className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-emerald-500" value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})}>
                <option value={UserRole.EMPLOYEE}>Employee</option>
                <option value={UserRole.ADMIN}>Administrator</option>
              </select>
            </div>
          )}
        </div>
        <div className="pt-6">
          <button onClick={handleSave} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg hover:bg-emerald-700">Save User Details</button>
        </div>
      </div>
    </div>
  );
};

export default UserForm;
