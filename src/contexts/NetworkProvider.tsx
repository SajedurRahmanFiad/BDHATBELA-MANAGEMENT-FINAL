import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface NetworkContextType {
  isOnline: boolean;
  wasOffline: boolean;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

/**
 * NetworkProvider monitors internet connectivity using browser online/offline events.
 * When connection is lost, it sets isOnline=false to trigger UI changes (banner appears).
 * When connection is restored, it refreshes only active stale queries and banner disappears.
 * 
 * This prevents user confusion when network fails by displaying a clear offline message.
 */
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [wasOffline, setWasOffline] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);

      // Avoid a reconnect storm by refetching only visible stale work.
      queryClient.refetchQueries({ type: 'active', stale: true }).catch(() => {});
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [queryClient]);

  return (
    <NetworkContext.Provider value={{ isOnline, wasOffline }}>
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return ctx;
}

export { NetworkContext };
