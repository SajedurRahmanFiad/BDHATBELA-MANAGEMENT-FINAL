import React, { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import supabase from '../services/supabaseClient';

interface RealtimeContextType {
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

/**
 * RealtimeProvider sets up Supabase Realtime subscriptions for orders, bills, and transactions.
 * When any of these tables change in the database, React Query caches are automatically invalidated
 * so the UI refetches fresh data without user intervention.
 * 
 * This ensures the UI stays in sync with the database without polling or manual refreshes.
 */
export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = React.useState(false);

  useEffect(() => {
    console.log('[Realtime] Initializing subscriptions for orders, bills, transactions...');

    // Subscribe to orders changes (INSERT, UPDATE, DELETE)
    const ordersChannel = supabase
      .channel('public:orders', { 
        config: { broadcast: { self: true }, presence: { key: '' } } 
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload: any) => {
          console.log('[Realtime] Orders change detected:', payload.eventType, payload.new?.id);
          
          if (payload.eventType === 'INSERT') {
            // For new orders, add to cache immediately (user might be on the list)
            const orders = queryClient.getQueryData<any[]>(['orders']) || [];
            // Check if this order is already in the list (from optimistic update)
            if (!orders.find(o => o.id === payload.new.id)) {
              queryClient.setQueryData(['orders'], [payload.new, ...orders]);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing order in cache
            queryClient.setQueryData(['orders'], (old: any[] = []) =>
              old.map(o => o.id === payload.new.id ? payload.new : o)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted order from cache
            queryClient.setQueryData(['orders'], (old: any[] = []) =>
              old.filter(o => o.id !== payload.new.id)
            );
          }
          
          // Also invalidate related queries for safety
          queryClient.invalidateQueries({ queryKey: ['ordersByCustomerId'] });
          if (payload.new?.id) {
            queryClient.invalidateQueries({ queryKey: ['order', payload.new.id] });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Orders channel subscribed');
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' && err) {
          console.error('[Realtime] Orders channel error:', err);
          setIsConnected(false);
        }
      });

    // Subscribe to bills changes
    const billsChannel = supabase
      .channel('public:bills', { 
        config: { broadcast: { self: true }, presence: { key: '' } } 
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bills' },
        (payload: any) => {
          console.log('[Realtime] Bills change detected:', payload.eventType, payload.new?.id);
          
          if (payload.eventType === 'INSERT') {
            // For new bills, add to cache immediately (user might be on the list)
            const bills = queryClient.getQueryData<any[]>(['bills']) || [];
            // Check if this bill is already in the list (from optimistic update)
            if (!bills.find(b => b.id === payload.new.id)) {
              queryClient.setQueryData(['bills'], [payload.new, ...bills]);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing bill in cache
            queryClient.setQueryData(['bills'], (old: any[] = []) =>
              old.map(b => b.id === payload.new.id ? payload.new : b)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted bill from cache
            queryClient.setQueryData(['bills'], (old: any[] = []) =>
              old.filter(b => b.id !== payload.new.id)
            );
          }
          
          // Also invalidate specific bill if known (for detail view)
          if (payload.new?.id) {
            queryClient.invalidateQueries({ queryKey: ['bill', payload.new.id] });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Bills channel subscribed');
        } else if (status === 'CHANNEL_ERROR' && err) {
          console.error('[Realtime] Bills channel error:', err);
        }
      });

    // Subscribe to transactions changes
    const transactionsChannel = supabase
      .channel('public:transactions', { 
        config: { broadcast: { self: true }, presence: { key: '' } } 
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload: any) => {
          console.log('[Realtime] Transactions change detected:', payload.eventType, payload.new?.id);
          
          if (payload.eventType === 'INSERT') {
            // For new transactions, add to cache immediately
            const transactions = queryClient.getQueryData<any[]>(['transactions']) || [];
            if (!transactions.find(t => t.id === payload.new.id)) {
              // Prepend new transaction and sort by created_at DESC
              const updated = [payload.new, ...transactions].sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt || 0).getTime();
                const dateB = new Date(b.date || b.createdAt || 0).getTime();
                return dateB - dateA; // Descending order (newest first)
              });
              queryClient.setQueryData(['transactions'], updated);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing transaction in cache
            queryClient.setQueryData(['transactions'], (old: any[] = []) =>
              old.map(t => t.id === payload.new.id ? payload.new : t)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted transaction from cache
            queryClient.setQueryData(['transactions'], (old: any[] = []) =>
              old.filter(t => t.id !== payload.new.id)
            );
          }
          
          // Also invalidate specific transaction if known
          if (payload.new?.id) {
            queryClient.invalidateQueries({ queryKey: ['transaction', payload.new.id] });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Transactions channel subscribed');
        } else if (status === 'CHANNEL_ERROR' && err) {
          console.error('[Realtime] Transactions channel error:', err);
        }
      });

    // Subscribe to accounts changes (balance updates)
    const accountsChannel = supabase
      .channel('public:accounts', { 
        config: { broadcast: { self: true }, presence: { key: '' } } 
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts' },
        (payload: any) => {
          console.log('[Realtime] Accounts change detected:', payload.eventType, payload.new?.id);
          
          if (payload.eventType === 'INSERT') {
            // For new accounts, add to cache immediately
            const accounts = queryClient.getQueryData<any[]>(['accounts']) || [];
            if (!accounts.find(a => a.id === payload.new.id)) {
              queryClient.setQueryData(['accounts'], [payload.new, ...accounts]);
            }
          } else if (payload.eventType === 'UPDATE') {
            // Update existing account in cache
            queryClient.setQueryData(['accounts'], (old: any[] = []) =>
              old.map(a => a.id === payload.new.id ? payload.new : a)
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted account from cache
            queryClient.setQueryData(['accounts'], (old: any[] = []) =>
              old.filter(a => a.id !== payload.new.id)
            );
          }
          
          // Also invalidate specific account if known
          if (payload.new?.id) {
            queryClient.invalidateQueries({ queryKey: ['account', payload.new.id] });
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Accounts channel subscribed');
        } else if (status === 'CHANNEL_ERROR' && err) {
          console.error('[Realtime] Accounts channel error:', err);
        }
      });

    // Cleanup subscriptions on unmount
    return () => {
      console.log('[Realtime] Cleaning up all subscriptions');
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(billsChannel);
      supabase.removeChannel(transactionsChannel);
      supabase.removeChannel(accountsChannel);
      setIsConnected(false);
    };
  }, [queryClient]);

  return (
    <RealtimeContext.Provider value={{ isConnected }}>
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
