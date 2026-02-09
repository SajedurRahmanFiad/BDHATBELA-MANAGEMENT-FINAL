import React, { createContext, useContext, useEffect, useState } from 'react';
import supabase, { phoneToEmail } from '../services/supabaseClient';
import { db, saveDb } from '../../db';

type AuthContextType = {
  user: any | null;
  profile: any | null;
  isLoading: boolean;
  signIn: (phoneOrEmail: string, password: string) => Promise<{ error?: any; data?: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  console.log('[AuthProvider] Mounting - initializing context provider');

  const fetchProfile = async (userId?: string, email?: string) => {
    if (!userId && !email) {
      console.warn('[Auth] No userId or email provided to fetchProfile');
      return null;
    }
    try {
      // Prefer userId (more reliable), fall back to phone extraction from email
      let query: any;
      if (userId) {
        console.log('[Auth] Fetching profile for userId:', userId);
        query = supabase.from('users').select('*').eq('id', userId).single();
      } else {
        const phone = email!.split('@')[0].replace(/[^0-9]/g, '');
        console.log('[Auth] Fetching profile for phone:', phone);
        query = supabase.from('users').select('*').eq('phone', phone).single();
      }
      
      // Timeout after 3 seconds - if profile doesn't load, proceed without it
      const { data, error } = await Promise.race([
        query,
        new Promise<any>((resolve) => 
          setTimeout(() => resolve({ data: null, error: new Error('timeout') }), 3000)
        )
      ]) as any;
      
      if (error) {
        console.error('[Auth] Profile fetch error:', error.message);
        return null;
      }
      console.log('[Auth] Profile fetched successfully');
      return data;
    } catch (err) {
      console.error('[Auth] Profile fetch exception:', err);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      try {
        console.log('[Auth] Initializing - trying to restore session...');
        // Try to restore session with 3 second timeout
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<any>((resolve) => 
            setTimeout(() => resolve({ data: null }), 3000)
          )
        ]) as any;

        if (data?.session?.user && mounted) {
          console.log('[Auth] Session restored from storage:', data.session.user.email);
          setUser(data.session.user);
          const p = await fetchProfile(data.session.user.id, data.session.user.email || undefined);
          if (p && mounted) {
            console.log('[Auth] Session profile loaded');
            setProfile(p);
            db.currentUser = p as any;
            saveDb();
            localStorage.setItem('isLoggedIn', 'true');
          } else if (mounted) {
            console.warn('[Auth] Session exists but profile not found, proceeding without it');
          }
        }
        // Always clear loading after init attempt (success or timeout)
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Init error (non-fatal, waiting for onAuthStateChange):', err);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Start init immediately
    init();

    // Subscribe to auth state changes with proper unsubscribe handling
    const subscription = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] onAuthStateChange fired, event:', _event, 'has session:', !!session?.user);
      try {
        if (session?.user) {
          console.log('[Auth] User authenticated:', session.user.email, 'userId:', session.user.id);
          setUser(session.user);
          
          // Try to fetch profile with one retry
          let p = await fetchProfile(session.user.id, session.user.email || undefined);
          
          // Retry once if first attempt failed (profile might be creating)
          if (!p) {
            console.log('[Auth] First profile fetch failed, retrying after 1 second...');
            await new Promise(r => setTimeout(r, 1000));
            p = await fetchProfile(session.user.id, session.user.email || undefined);
          }
          
          if (p && mounted) {
            console.log('[Auth] Profile loaded successfully, updating state');
            setProfile(p);
            db.currentUser = p as any;
            saveDb();
            localStorage.setItem('isLoggedIn', 'true');
            window.dispatchEvent(new Event('authChange'));
          } else if (mounted) {
            console.warn('[Auth] Profile not found after retries');
            setProfile(null);
            localStorage.setItem('isLoggedIn', 'true');
            window.dispatchEvent(new Event('authChange'));
          }
          // Always clear loading when auth state is determined
          if (mounted) {
            setIsLoading(false);
          }
        } else {
          console.log('[Auth] No session - user logged out or never logged in');
          if (mounted) {
            setUser(null);
            setProfile(null);
            db.currentUser = null as any;
            saveDb();
            localStorage.removeItem('isLoggedIn');
            window.dispatchEvent(new Event('authChange'));
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('[Auth] onAuthStateChange error:', err);
        if (mounted) {
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    });

    // Store unsubscribe function properly - onAuthStateChange returns { data: { subscription: { unsubscribe } } }
    unsubscribe = subscription.data?.subscription?.unsubscribe || (() => {});

    return () => {
      console.log('[Auth] Cleanup function called');
      mounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          console.error('[Auth] Error unsubscribing:', err);
        }
      }
    };
  }, []);

  const signIn = async (phoneOrEmail: string, password: string) => {
    // Support phone-based sign-in using phoneToEmail helper
    let email = phoneOrEmail;
    if (!phoneOrEmail.includes('@')) {
      email = phoneToEmail(phoneOrEmail);
    }
    console.log('[Auth] signIn called with email:', email);
    try {
      const res = await supabase.auth.signInWithPassword({ email, password });
      console.log('[Auth] signInWithPassword response:', res.error ? 'Error' : 'Success');
      if (res.error) {
        // Check if this is an email confirmation issue
        if (res.error.message?.includes('Email not confirmed') || res.error.status === 422) {
          console.error('[Auth] Login blocked - Email confirmation required. Admin must disable email confirmation in Supabase:', res.error);
          res.error.message = 'Email confirmation required. Please have administrator disable email confirmation in Supabase dashboard under Authentication > Providers > Email, then toggle off "Confirm email"';
        } else {
          console.error('[Auth] signIn error:', res.error);
        }
        return res;
      }
      
      // SUCCESS: Manually update state immediately (don't wait for onAuthStateChange)
      if (res.data?.user) {
        console.log('[Auth] signIn successful, updating state immediately for user:', res.data.user.email);
        setUser(res.data.user);
        
        // Fetch profile without timeout - signIn succeeded so user should exist
        const p = await fetchProfile(res.data.user.id, res.data.user.email || undefined);
        if (p) {
          console.log('[Auth] Profile loaded after signIn');
          setProfile(p);
          db.currentUser = p as any;
          saveDb();
        } else {
          console.warn('[Auth] Profile not found after signIn, but proceeding with authenticated user');
          setProfile(null);
        }
        localStorage.setItem('isLoggedIn', 'true');
        setIsLoading(false);
        window.dispatchEvent(new Event('authChange'));
      }
      return res;
    } catch (err) {
      console.error('[Auth] signIn exception:', err);
      return { error: err };
    }
  };

  const signOut = async () => {
    console.log('[Auth] signOut called');
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      db.currentUser = null as any;
      saveDb();
      localStorage.removeItem('isLoggedIn');
      window.dispatchEvent(new Event('authChange'));
      console.log('[Auth] signOut completed successfully');
    } catch (err) {
      console.error('[Auth] signOut error:', err);
    }
  };

  console.log('[AuthProvider] Rendering with context value:', { user: !!user, profile: !!profile, isLoading });
  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  console.log('[useAuth] Called, checking context...');
  const ctx = useContext(AuthContext);
  console.log('[useAuth] Context value:', ctx ? 'exists' : 'undefined');
  if (!ctx) {
    console.error('[useAuth] ERROR: Context not available! This hook must be used within <AuthProvider>', {
      contextName: 'AuthContext',
      componentStack: new Error().stack
    });
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export { AuthContext };
