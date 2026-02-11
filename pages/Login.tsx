import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useAuth } from '../src/contexts/AuthProvider';
import { fetchCompanySettings } from '../src/services/supabaseQueries';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, isLoading, user, profile } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [companySettings, setCompanySettings] = useState({
    name: 'BD Hatbela',
    logo: db.settings.company.logo
  });

  // Redirect to dashboard when user is fully authenticated
  // Profile is now GUARANTEED to exist when user exists (never null)
  useEffect(() => {
    console.log('[Login] Checking redirect - isLoading:', isLoading, 'authenticated:', !!user);
    if (!isLoading && user) {
      console.log('[Login] User authenticated, navigating to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await fetchCompanySettings();
        setCompanySettings({
          name: 'BD Hatbela',
          logo: settings.logo || db.settings.company.logo
        });
      } catch (err) {
        console.error('Failed to load company settings:', err);
        // Use default logo if fetch fails
        setCompanySettings({
          name: 'BD Hatbela',
          logo: db.settings.company.logo
        });
      }
    };
    loadSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    console.log('[Login] Form submitted with phone:', phone);

    try {
      // Sign in using phone number. The AuthProvider's signIn method
      // converts phone to email and handles auth + profile sync.
      console.log('[Login] Calling signIn...');
      const { error: signInError, data } = await signIn(phone, password);

      if (signInError) {
        console.error('[Login] Sign-in error:', signInError);
        const errorMsg = signInError?.message || 'Authentication failed';
        setError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      console.log('[Login] Sign-in successful, user:', data?.user?.email);
      
      // Check if profile was loaded successfully
      if (!data?.profileLoaded) {
        console.error('[Login] Sign-in succeeded but profile not loaded');
        setError(data?.error?.message || 'Failed to load user profile. Please try again or contact administrator.');
        setIsSubmitting(false);
        return;
      }
      
      // Navigation will happen automatically via useEffect when profile is ready
      console.log('[Login] Profile loaded, waiting for state to propagate...');
      // Don't set isSubmitting to false yet - let the loading state show until redirect
      
    } catch (err: any) {
      console.error('[Login] Sign-in exception:', err);
      setError(err?.message || 'Failed to sign in');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow p-8">
        <div className="flex items-center gap-4 mb-6">
          {companySettings.logo && (
            <img src={companySettings.logo} alt="Logo" className="w-12 h-12 rounded-md object-cover" />
          )}
          <div>
            <h1 className="text-xl font-bold">{companySettings.name}</h1>
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
              disabled={isSubmitting}
              className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              type="password"
              required
              disabled={isSubmitting}
              className="mt-1 block w-full border rounded px-3 py-2 focus:outline-none focus:ring disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 space-y-2">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
              {error.includes('Email confirmation') && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-xs">
                  <p className="font-semibold mb-1">Quick Fix:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to Supabase Dashboard</li>
                    <li>Project → Authentication → Providers</li>
                    <li>Click "Email" tab</li>
                    <li>Toggle OFF "Confirm email"</li>
                    <li>Save settings</li>
                    <li>Try logging in again</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          <div>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed font-medium hover:bg-blue-700 transition-colors"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
