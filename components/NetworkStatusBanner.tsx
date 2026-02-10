import React, { useEffect, useState } from 'react';
import { useNetwork } from '../src/contexts/NetworkProvider';
import { ICONS } from '../constants';

/**
 * NetworkStatusBanner displays a sticky banner at the top when user loses internet connection.
 * It automatically disappears when connection is restored.
 * Shows a pulsing indicator to indicate waiting for connection.
 */
const NetworkStatusBanner: React.FC = () => {
  const { isOnline } = useNetwork();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowBanner(true);
    } else {
      // Keep banner visible for 2 seconds after reconnection for user confirmation
      const timer = setTimeout(() => {
        setShowBanner(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-red-50 border-b-2 shadow-lg transition-all duration-300"
      style={{ borderColor: isOnline ? '#10b981' : '#ef4444', backgroundColor: isOnline ? '#ecfdf5' : '#fee2e2' }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3 flex-1">
          <div className={`text-xl ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
            {isOnline ? '✅' : '⚠️'}
          </div>
          <div>
            <p className={`font-bold ${isOnline ? 'text-green-900' : 'text-red-900'}`}>
              {isOnline ? 'Connection Restored' : 'No Internet Connection'}
            </p>
            <p className={`text-sm ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
              {isOnline ? 'Data is syncing with the server' : 'Your changes will be saved when connection is restored'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isOnline && (
            <>
              <div className="animate-pulse w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-xs font-medium text-red-600">Waiting for connection...</span>
            </>
          )}
          {isOnline && (
            <span className="text-xs font-medium text-green-600">Syncing...</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkStatusBanner;
