import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchAccounts, fetchBootstrapSession, fetchSystemDefaults, loginUser } from '../services/supabaseQueries';
import { ApiError, clearAuthToken, getAuthToken, setAuthToken } from '../services/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import type { PermissionsSettings, User } from '../../types';
import { db, saveDb } from '../../db';

export type StartupStatus = 'idle' | 'checking' | 'ready' | 'anonymous' | 'timeout' | 'offline' | 'error';

type AuthContextType = {
  user: User | null;
  profile?: User | null;
  isLoading: boolean;
  startupStatus: StartupStatus;
  startupError: string | null;
  signIn: (phoneOrEmail: string, password: string) => Promise<{ error?: any; data?: any }>;
  signOut: () => Promise<void>;
  retrySessionRestore: () => Promise<void>;
};

type BootstrapSessionData = {
  user: User;
  permissions: PermissionsSettings;
};

type BootstrapFailure = {
  status: Extract<StartupStatus, 'timeout' | 'offline' | 'error'>;
  message: string;
};

type BootstrapResult =
  | { kind: 'success'; data: BootstrapSessionData }
  | { kind: 'anonymous' }
  | { kind: 'failure'; failure: BootstrapFailure };

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const BOOTSTRAP_TIMEOUT_MS = 6000;
const LEGACY_SESSION_KEYS = ['currentUserId', 'isLoggedIn', 'userProfile', 'userData', 'currentUser'] as const;

function clearLegacySessionStorage(): void {
  for (const key of LEGACY_SESSION_KEYS) {
    localStorage.removeItem(key);
  }
}

function classifyBootstrapError(error: unknown): BootstrapFailure {
  if (error instanceof ApiError && error.code === 'TIMEOUT') {
    return {
      status: 'timeout',
      message: 'Restoring your session took too long. Please try again.',
    };
  }

  if (!navigator.onLine) {
    return {
      status: 'offline',
      message: 'No internet connection. Reconnect and try again.',
    };
  }

  return {
    status: 'error',
    message: 'The server did not respond. Please try again.',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [startupStatus, setStartupStatus] = useState<StartupStatus>(() => (getAuthToken() ? 'checking' : 'anonymous'));
  const [startupError, setStartupError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const mountedRef = useRef(true);

  const isLoading = startupStatus === 'idle' || startupStatus === 'checking';

  const applyAuthenticatedState = useCallback((session: BootstrapSessionData) => {
    setUser(session.user);
    db.currentUser = session.user;
    queryClient.setQueryData(['settings', 'permissions'], session.permissions);
    setStartupError(null);
    setStartupStatus('ready');
    saveDb();
  }, [queryClient]);

  const setAnonymousState = useCallback((clearToken: boolean) => {
    setUser(null);
    db.currentUser = null;
    queryClient.removeQueries({ queryKey: ['settings', 'permissions'], exact: true });
    setStartupError(null);
    setStartupStatus('anonymous');

    if (clearToken) {
      clearAuthToken();
    }

    clearLegacySessionStorage();
    saveDb();
  }, [queryClient]);

  const prefetchPostBootstrap = useCallback(() => {
    try {
      queryClient.prefetchQuery({
        queryKey: ['accounts'],
        queryFn: () => fetchAccounts(),
        staleTime: 15 * 60 * 1000,
      }).catch(() => {});

      queryClient.prefetchQuery({
        queryKey: ['settings', 'defaults'],
        queryFn: () => fetchSystemDefaults(),
        staleTime: 60 * 60 * 1000,
      }).catch(() => {});
    } catch (error) {
      console.warn('[Auth] Background prefetch failed to start:', error);
    }
  }, [queryClient]);

  const bootstrapFromToken = useCallback(async (): Promise<BootstrapResult> => {
    const token = getAuthToken();

    if (!token) {
      if (mountedRef.current) {
        setAnonymousState(false);
      }
      return { kind: 'anonymous' };
    }

    if (mountedRef.current) {
      setStartupStatus('checking');
      setStartupError(null);
    }

    try {
      const session = await fetchBootstrapSession({ timeoutMs: BOOTSTRAP_TIMEOUT_MS });

      if (!mountedRef.current) {
        return { kind: 'success', data: session };
      }

      applyAuthenticatedState(session);
      prefetchPostBootstrap();
      window.dispatchEvent(new Event('authChange'));
      return { kind: 'success', data: session };
    } catch (error) {
      if (!mountedRef.current) {
        return { kind: 'failure', failure: classifyBootstrapError(error) };
      }

      if (error instanceof ApiError && error.status === 401) {
        console.warn('[Auth] Stored token is invalid, clearing session');
        setAnonymousState(true);
        window.dispatchEvent(new Event('authChange'));
        return { kind: 'anonymous' };
      }

      const failure = classifyBootstrapError(error);
      console.error('[Auth] Session bootstrap failed:', error);
      setUser(null);
      db.currentUser = null;
      queryClient.removeQueries({ queryKey: ['settings', 'permissions'], exact: true });
      setStartupStatus(failure.status);
      setStartupError(failure.message);
      saveDb();
      return { kind: 'failure', failure };
    }
  }, [applyAuthenticatedState, prefetchPostBootstrap, queryClient, setAnonymousState]);

  useEffect(() => {
    mountedRef.current = true;
    void bootstrapFromToken();

    return () => {
      mountedRef.current = false;
    };
  }, [bootstrapFromToken]);

  const retrySessionRestore = useCallback(async () => {
    await bootstrapFromToken();
  }, [bootstrapFromToken]);

  const signIn = useCallback(async (phoneOrEmail: string, password: string) => {
    const phone = (phoneOrEmail.includes('@') ? phoneOrEmail.split('@')[0] : phoneOrEmail).trim();

    try {
      const { user: loginUserData, token, error: loginError } = await loginUser(phone, password);

      if (loginError || !loginUserData) {
        return { error: { message: loginError || 'Login failed' } };
      }

      if (!token || !token.trim()) {
        return { error: { message: 'Login succeeded but no session token was returned.' } };
      }

      await queryClient.cancelQueries();
      queryClient.clear();

      setAuthToken(token);
      clearLegacySessionStorage();

      const bootstrapResult = await bootstrapFromToken();
      if (bootstrapResult.kind === 'success') {
        return { data: { user: bootstrapResult.data.user, profileLoaded: true }, error: null };
      }

      if (bootstrapResult.kind === 'anonymous') {
        return { error: { message: 'Your session expired. Please sign in again.' } };
      }

      return { error: { message: bootstrapResult.failure.message } };
    } catch (error: any) {
      console.error('[Auth] signIn exception:', error?.message || error);
      return { error: { message: error?.message || 'Login failed' } };
    }
  }, [bootstrapFromToken, queryClient]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    setAnonymousState(true);
    window.dispatchEvent(new Event('authChange'));
  }, [queryClient, setAnonymousState]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: user,
        isLoading,
        startupStatus,
        startupError,
        signIn,
        signOut,
        retrySessionRestore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    console.warn('[Auth] useAuth called without AuthProvider, falling back to db.currentUser');
    return {
      user: db.currentUser ?? null,
      profile: db.currentUser ?? null,
      isLoading: false,
      startupStatus: 'anonymous' as StartupStatus,
      startupError: null,
      signIn: async () => ({ error: { message: 'AuthProvider missing' } }),
      signOut: async () => {},
      retrySessionRestore: async () => {},
    };
  }
  return ctx;
}

export { AuthContext };
