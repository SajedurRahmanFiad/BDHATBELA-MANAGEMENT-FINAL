import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, saveDb } from '../db';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = db.users.find(u => u.phone === phone);
    if (!user || !user.password || user.password !== password) {
      setError('Invalid phone or password');
      return;
    }

    localStorage.setItem('isLoggedIn', 'true');
    db.currentUser = user;
    saveDb();
    window.dispatchEvent(new Event('authChange'));
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <div className="flex items-center gap-4 mb-6">
          <img src={db.settings.company.logo} alt="Logo" className="w-12 h-12 rounded-md object-cover" />
          <div>
            <h1 className="text-xl font-bold">{db.settings.company.name}</h1>
            <p className="text-sm text-gray-500">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              placeholder="017XXXXXXXX"
              required
              className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              required
              className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Sign In</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
