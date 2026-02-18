import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginUser } from '../services/supabaseQueries';
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

  /**
   * Create a minimal fallback profile for users without a DB record
   * This ensures we always have a profile object, preventing null reference errors
   */
  const createFallbackProfile = (userId: string, email?: string) => {
    const phone = email?.split('@')[0].replace(/[^0-9]/g, '') || '';
    return {
      id: userId,
      name: email?.split('@')[0] || 'User',
      phone: phone || 'unknown',
      role: 'Employee',
      image: null,
      created_at: new Date().toISOString(),
      is_fallback: true // Mark this as a fallback for debugging
    };
  };

  /**
   * Fetch user profile from database with extended timeout and fallback
   * Tries to return database profile, falls back to saved profile, then minimal profile
   * NEVER returns null - always returns a valid profile object
   */
  // Note: fetchProfile is now simplified - mostly used for fallback since user data comes from users table
  const fetchProfile = async (userId?: string, savedProfileFallback?: any): Promise<any> => {
    if (!userId) {
      console.warn('[Auth] No userId provided to fetchProfile');
      if (savedProfileFallback) {
        console.log('[Auth] Using saved profile as fallback');
        return savedProfileFallback;
      }
      return createFallbackProfile('unknown');
    }

    // If we have a saved profile, use it (since loginUser already fetched from DB)
    if (savedProfileFallback) {
      console.log('[Auth] Using saved profile for userId:', userId);
      return savedProfileFallback;
    }

    // Last resort: create minimal fallback
    console.warn('[Auth] No saved profile available, creating minimal fallback for:', userId);
    return createFallbackProfile(userId);
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    let initCompleted = false;

    const init = async () => {
      try {
        console.log('[Auth] Initializing - attempting to restore session from localStorage...');

        // Check if we have a saved session in localStorage (DB-driven auth, no Supabase Auth)
        const savedProfile = localStorage.getItem('userProfile');
        const savedUser = localStorage.getItem('userData');
        let parsedSavedProfile: any = null;

        if (savedProfile && savedUser) {
          try {
            parsedSavedProfile = JSON.parse(savedProfile);
            const parsedUser = JSON.parse(savedUser);
            console.log('[Auth] Restored session from localStorage:', parsedSavedProfile.name);
            if (mounted) {
              setUser(parsedUser);
              setProfile(parsedSavedProfile);
              db.currentUser = parsedSavedProfile as any;
              saveDb();
            }
          } catch (e) {
            console.warn('[Auth] Failed to parse saved session data');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userData');
          }
        }

        // No Supabase Auth session check - we rely entirely on localStorage for direct table auth
        if (!parsedSavedProfile) {
          console.log('[Auth] No saved profile - user is logged out');
          if (mounted) {
            setUser(null);
            setProfile(null);
            db.currentUser = null as any;
            saveDb();
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userData');
          }
        }

        initCompleted = true;
        if (mounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        initCompleted = true;
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Start initialization
    init();

    // No Supabase Auth subscription - direct table auth via localStorage
    unsubscribe = () => {};

    return () => {
      console.log('[Auth] Cleaning up auth provider');
      mounted = false;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (err) {
          console.error('[Auth] Error unsubscribing from auth changes:', err);
        }
      }
    };
  }, []);

  const signIn = async (phoneOrEmail: string, password: string) => {
    // Extract phone number from phoneOrEmail
    const phone = phoneOrEmail.includes('@') ? phoneOrEmail.split('@')[0] : phoneOrEmail;

    console.log('[Auth] signIn called with phone:', phone);

    try {
      // Direct table authentication - no Supabase Auth
      const { user: dbUser, error: loginError } = await loginUser(phone, password);

      if (loginError || !dbUser) {
        console.error('[Auth] signIn failed:', loginError);
        return { error: { message: loginError || 'Login failed' } };
      }

      // Sign in succeeded - update state immediately
      console.log('[Auth] signIn successful for:', dbUser.phone);
      setUser(dbUser as any);
      setProfile(dbUser);
      db.currentUser = dbUser as any;
      saveDb();
      localStorage.setItem('userProfile', JSON.stringify(dbUser));
      localStorage.setItem('userData', JSON.stringify(dbUser));
      localStorage.setItem('isLoggedIn', 'true');
      setIsLoading(false);
      window.dispatchEvent(new Event('authChange'));

      console.log('[Auth] User profile loaded:', dbUser.name);
      return { data: { user: dbUser }, error: null, profileLoaded: true };
    } catch (err: any) {
      console.error('[Auth] signIn exception:', err?.message || err);
      return { error: { message: err?.message || 'Login failed' } };
    }
  };

  const signOut = async () => {
    console.log('[Auth] signOut called');

    // Direct table auth - just clear local state (no Supabase Auth to sign out from)
    setUser(null);
    setProfile(null);
    db.currentUser = null as any;
    saveDb();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userData');
    localStorage.removeItem('currentUser');
    window.dispatchEvent(new Event('authChange'));

    console.log('[Auth] signOut completed - state cleared');
  };

  console.log('[AuthProvider] Rendering with state:', { userEmail: user?.email, profileName: profile?.name, isLoading });

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export { AuthContext };
