import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToastNotifications } from '../contexts/ToastContext';

type ServiceBlockedEvent = CustomEvent<{
  code?: string;
  message?: string;
}>;

const GlobalApiEventWatcher: React.FC = () => {
  const toast = useToastNotifications();
  const queryClient = useQueryClient();
  const lastMessageRef = React.useRef<{ message: string; at: number } | null>(null);

  React.useEffect(() => {
    const handleServiceBlocked = (event: Event) => {
      const customEvent = event as ServiceBlockedEvent;
      const message = String(customEvent.detail?.message || '').trim();
      if (!message) {
        return;
      }

      const now = Date.now();
      const previous = lastMessageRef.current;
      if (previous && previous.message === message && now - previous.at < 3500) {
        return;
      }

      lastMessageRef.current = { message, at: now };
      toast.warning(message);
      queryClient.invalidateQueries({ queryKey: ['service-subscription'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['notifications'], exact: false });
    };

    window.addEventListener('api:service-blocked', handleServiceBlocked);
    return () => window.removeEventListener('api:service-blocked', handleServiceBlocked);
  }, [queryClient, toast]);

  return null;
};

export default GlobalApiEventWatcher;
