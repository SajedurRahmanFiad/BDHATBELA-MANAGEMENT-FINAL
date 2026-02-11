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
  const fetchProfile = async (userId?: string, email?: string, savedProfileFallback?: any): Promise<any> => {
    if (!userId && !email) {
      console.warn('[Auth] No userId or email provided to fetchProfile');
      if (savedProfileFallback) {
        console.log('[Auth] Using saved profile as fallback');
        return savedProfileFallback;
      }
      return createFallbackProfile('unknown', email);
    }

    try {
      let query: any;
      if (userId) {
        console.log('[Auth] Fetching profile for userId:', userId);
        query = supabase.from('users').select('*').eq('id', userId).single();
      } else {
        const phone = email!.split('@')[0].replace(/[^0-9]/g, '');
        console.log('[Auth] Fetching profile for phone:', phone);
        query = supabase.from('users').select('*').eq('phone', phone).single();
      }

      // Extended timeout: 15 seconds for slower databases
      const { data, error } = await Promise.race([
        query,
        new Promise<any>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error('profile_fetch_timeout') }), 15000)
        )
      ]) as any;

      if (data) {
        console.log('[Auth] Profile fetched successfully from database:', data.name);
        return data;
      }

      // If fetch failed, try to use saved profile
      if (savedProfileFallback) {
        console.warn('[Auth] Profile fetch failed (' + error?.message + '), using saved profile:', savedProfileFallback.name);
        return savedProfileFallback;
      }

      // Last resort: create minimal fallback profile
      console.warn('[Auth] Profile fetch failed and no saved profile available, creating minimal fallback');
      const fallback = createFallbackProfile(userId || 'unknown', email);
      return fallback;
    } catch (err) {
      console.error('[Auth] Profile fetch exception:', err);
      // Even on exception, try to use saved profile first
      if (savedProfileFallback) {
        console.log('[Auth] Exception during fetch, using saved profile:', savedProfileFallback.name);
        return savedProfileFallback;
      }
      return createFallbackProfile(userId || 'unknown', email);
    }
  };

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;
    let initCompleted = false;

    const init = async () => {
      try {
        console.log('[Auth] Initializing - attempting to restore session...');

        // Step 1: Check if we have a saved session in localStorage
        const savedProfile = localStorage.getItem('userProfile');
        const savedUser = localStorage.getItem('userData');
        let parsedSavedProfile: any = null;

        // Step 2: Immediately restore from localStorage if available
        // This provides instant UI without waiting for Supabase
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

        // Step 3: Get current session from Supabase
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          console.log('[Auth] Active Supabase session found:', session.user.email);
          setUser(session.user);
          localStorage.setItem('userData', JSON.stringify(session.user));

          // Step 4: Fetch profile from database (guaranteed to return profile object)
          // Pass saved profile as fallback in case fetch fails
          const profile = await fetchProfile(session.user.id, session.user.email || undefined, parsedSavedProfile);

          if (mounted) {
            console.log('[Auth] Setting profile:', profile.name);
            setProfile(profile);
            db.currentUser = profile as any;
            saveDb();
            localStorage.setItem('userProfile', JSON.stringify(profile));
            localStorage.setItem('isLoggedIn', 'true');
          }
        } else if (!session?.user && !parsedSavedProfile) {
          // No session and no saved profile - user is logged out
          console.log('[Auth] No session found and no saved profile - user is logged out');
          if (mounted) {
            setUser(null);
            setProfile(null);
            db.currentUser = null as any;
            saveDb();
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userData');
          }
        } else if (!session?.user && parsedSavedProfile) {
          // No current session but we have saved profile - keep it for now
          // The onAuthStateChange listener will handle clearing it if needed
          console.log('[Auth] No current session but keeping saved profile from localStorage');
          // Profile is already set from Step 2 above
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

    // Subscribe to auth state changes for real-time updates
    const subscription = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] Auth state changed - event:', _event, 'hasSession:', !!session?.user);

      // Skip updates while init is still running to prevent race conditions
      if (!initCompleted) {
        console.log('[Auth] Ignoring auth change during initialization');
        return;
      }

      try {
        if (session?.user) {
          // User just signed in or session was restored
          console.log('[Auth] User authenticated via listener:', session.user.email);
          if (mounted) {
            setUser(session.user);
            localStorage.setItem('userData', JSON.stringify(session.user));

            // Get the saved profile to use as fallback if fetch fails
            let savedProfile: any = null;
            const savedProfileStr = localStorage.getItem('userProfile');
            if (savedProfileStr) {
              try {
                savedProfile = JSON.parse(savedProfileStr);
              } catch (e) {
                console.warn('[Auth] Failed to parse saved profile for fallback');
              }
            }

            // Fetch fresh profile from database, with saved profile as fallback
            const profile = await fetchProfile(session.user.id, session.user.email || undefined, savedProfile);
            if (mounted) {
              console.log('[Auth] Setting profile from listener:', profile.name);
              setProfile(profile);
              db.currentUser = profile as any;
              saveDb();
              localStorage.setItem('userProfile', JSON.stringify(profile));
              localStorage.setItem('isLoggedIn', 'true');
              window.dispatchEvent(new Event('authChange'));
            }
          }
        } else {
          // User signed out
          console.log('[Auth] User signed out via listener');
          if (mounted) {
            setUser(null);
            setProfile(null);
            db.currentUser = null as any;
            saveDb();
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userData');
            window.dispatchEvent(new Event('authChange'));
          }
        }
      } catch (err) {
        console.error('[Auth] Error handling auth state change:', err);
      }
    });

    unsubscribe = subscription.data?.subscription?.unsubscribe || (() => {});

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
    // Support phone-based sign-in using phoneToEmail helper
    let email = phoneOrEmail;
    if (!phoneOrEmail.includes('@')) {
      email = phoneToEmail(phoneOrEmail);
    }

    console.log('[Auth] signIn called with email:', email);

    try {
      const res = await supabase.auth.signInWithPassword({ email, password });

      if (res.error) {
        console.error('[Auth] signIn failed:', res.error.message);
        // Check if this is an email confirmation issue
        if (res.error.message?.includes('Email not confirmed') || res.error.status === 422) {
          res.error.message = 'Email confirmation required. Please have administrator disable email confirmation in Supabase dashboard under Authentication > Providers > Email, then toggle off "Confirm email"';
        }
        return res;
      }

      // Sign in succeeded - update state immediately
      if (res.data?.user) {
        console.log('[Auth] signIn successful for:', res.data.user.email);
        setUser(res.data.user);

        // Get saved profile for fallback
        let savedProfile: any = null;
        const savedProfileStr = localStorage.getItem('userProfile');
        if (savedProfileStr) {
          try {
            savedProfile = JSON.parse(savedProfileStr);
          } catch (e) {
            console.warn('[Auth] Failed to parse saved profile for signIn fallback');
          }
        }

        // Fetch profile - this is REQUIRED for dashboard access
        // Pass saved profile as fallback
        const profile = await fetchProfile(res.data.user.id, res.data.user.email || undefined, savedProfile);

        setProfile(profile);
        db.currentUser = profile as any;
        saveDb();
        localStorage.setItem('userProfile', JSON.stringify(profile));
        localStorage.setItem('userData', JSON.stringify(res.data.user));
        localStorage.setItem('isLoggedIn', 'true');
        setIsLoading(false);
        window.dispatchEvent(new Event('authChange'));

        console.log('[Auth] User profile loaded:', profile.name);
        return { ...res, profileLoaded: true };
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
    } catch (err) {
      console.error('[Auth] Supabase signOut error:', err);
    }

    // Clear state regardless of Supabase result
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
