import React, { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncCarryBeeTransferStatuses, syncPaperflyOrderStatuses, syncSteadfastDeliveryStatuses } from '../services/supabaseQueries';
import { useAuth } from './AuthProvider';
import { ENABLE_CLIENT_COURIER_SYNC } from '../config/incidentMode';

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const syncingRef = React.useRef(false);

  useEffect(() => {
    if (!ENABLE_CLIENT_COURIER_SYNC || !user?.id) return;

    let cancelled = false;
    const INTERVAL_MS = 10 * 60_000;

    const runSync = async () => {
      if (cancelled || syncingRef.current) return;
      syncingRef.current = true;
      try {
        const [carryBeeResult, paperflyResult, steadfastResult] = await Promise.all([
          syncCarryBeeTransferStatuses(),
          syncPaperflyOrderStatuses(),
          syncSteadfastDeliveryStatuses(),
        ]);

        if (!cancelled && (carryBeeResult.updated > 0 || paperflyResult.updated > 0 || steadfastResult.updated > 0)) {
          queryClient.invalidateQueries({ queryKey: ['orders'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['wallet'], exact: false });
          queryClient.invalidateQueries({ queryKey: ['payroll'], exact: false });
        }
      } catch (err) {
        console.error('[Realtime] Courier sync failed:', err);
      } finally {
        syncingRef.current = false;
      }
    };

    runSync();
    const timer = window.setInterval(runSync, INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user?.id, queryClient]);

  return (
    <RealtimeContext.Provider value={{ isConnected: false }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return ctx;
}

export { RealtimeContext };
