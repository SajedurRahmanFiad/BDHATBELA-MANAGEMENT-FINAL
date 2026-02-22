import React, { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, fetchUserById } from '../services/supabaseQueries';
import { db, saveDb } from '../../db';

type AuthContextType = {
  user: any | null;
  isLoading: boolean;
  signIn: (phoneOrEmail: string, password: string) => Promise<{ error?: any; data?: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const POLL_MS = 2500; // interval to poll for user details when only id stored

  console.log('[AuthProvider] Mounting - initializing context provider');

  // Initialize session from localStorage on mount
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        console.log('[Auth] Initializing - restoring session from localStorage...');
        const storedId = localStorage.getItem('currentUserId');

        if (!storedId) {
          console.log('[Auth] No saved session - user is logged out');
          if (mounted) {
            setUser(null);
            db.currentUser = null as any;
            saveDb();
            setIsLoading(false);
          }
          return;
        }

        // We have a stored user ID - fetch full profile
        console.log('[Auth] Found stored user ID, fetching full profile...');
        let retries = 0;
        const maxRetries = 5;

        const fetchWithRetry = async (): Promise<any> => {
          try {
            const fetched = await fetchUserById(storedId);
            if (fetched) {
              console.log('[Auth] Fetched user profile:', fetched.name);
              return fetched;
            }
          } catch (err) {
            console.warn('[Auth] Fetch attempt failed:', err);
            if (retries < maxRetries) {
              retries++;
              await new Promise(r => setTimeout(r, POLL_MS));
              return fetchWithRetry();
            }
          }
          return null;
        };

        const fetched = await fetchWithRetry();

        if (mounted) {
          if (fetched) {
            setUser(fetched);
            db.currentUser = fetched as any;
            saveDb();
            console.log('[Auth] Session restored:', fetched.name);
          } else {
            // Profile fetch failed after retries - clear session
            console.warn('[Auth] Could not restore profile, clearing session');
            setUser(null);
            db.currentUser = null as any;
            localStorage.removeItem('currentUserId');
            saveDb();
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (mounted) {
          setUser(null);
          db.currentUser = null as any;
          setIsLoading(false);
        }
      }
    };

    // Start init
    init();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (phoneOrEmail: string, password: string) => {
    const phone = phoneOrEmail.includes('@') ? phoneOrEmail.split('@')[0] : phoneOrEmail;
    console.log('[Auth] signIn called with phone:', phone);

    try {
      const { user: dbUser, error: loginError } = await loginUser(phone, password);

      if (loginError || !dbUser) {
        console.error('[Auth] signIn failed:', loginError);
        return { error: { message: loginError || 'Login failed' } };
      }

      // Sign in succeeded
      console.log('[Auth] signIn successful for:', dbUser.phone);
      setUser(dbUser);
      db.currentUser = dbUser as any;
      saveDb();

      // Store only user ID persistently (allows multi-device login)
      localStorage.setItem('currentUserId', dbUser.id);
      localStorage.setItem('isLoggedIn', 'true');
      setIsLoading(false);
      window.dispatchEvent(new Event('authChange'));

      console.log('[Auth] User logged in:', dbUser.name);
      return { data: { user: dbUser }, error: null };
    } catch (err: any) {
      console.error('[Auth] signIn exception:', err?.message || err);
      return { error: { message: err?.message || 'Login failed' } };
    }
  };

  const signOut = async () => {
    console.log('[Auth] signOut called');
    setUser(null);
    db.currentUser = null as any;
    saveDb();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('userData');
    localStorage.removeItem('currentUser');
    window.dispatchEvent(new Event('authChange'));
    console.log('[Auth] signOut completed');
  };

  console.log('[AuthProvider] Rendering with state:', { userName: user?.name, isLoading });

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
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
