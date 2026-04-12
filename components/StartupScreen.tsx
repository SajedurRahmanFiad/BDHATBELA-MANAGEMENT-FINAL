import React, { useState } from 'react';
import { db } from '../db';
import type { StartupStatus } from '../src/contexts/AuthProvider';
import { Button } from './Button';

interface StartupScreenProps {
  status: Extract<StartupStatus, 'idle' | 'checking' | 'timeout' | 'offline' | 'error'>;
  error?: string | null;
  onRetry?: () => Promise<void> | void;
  onBackToLogin?: () => Promise<void> | void;
}

const STATUS_COPY: Record<StartupScreenProps['status'], { title: string; description: string }> = {
  idle: {
    title: 'Restoring your session...',
    description: 'We are getting your workspace ready.',
  },
  checking: {
    title: 'Restoring your session...',
    description: 'We are verifying your access and loading your workspace.',
  },
  timeout: {
    title: 'Connection is taking too long',
    description: 'The app did not get a startup response in time. You can retry, or go back to login safely.',
  },
  offline: {
    title: 'No Internet Connection',
    description: 'Reconnect to the internet, then retry restoring your session.',
  },
  error: {
    title: 'Unable to reach the server',
    description: 'The app could not finish startup right now. Please retry, or go back to login.',
  },
};

const StartupScreen: React.FC<StartupScreenProps> = ({
  status,
  error,
  onRetry,
  onBackToLogin,
}) => {
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const companyName = db.settings.company.name?.trim() || 'BD Hatbela';
  const companyLogo = db.settings.company.logo?.trim() || '';
  const copy = STATUS_COPY[status];
  const isChecking = status === 'idle' || status === 'checking';

  const handleRetry = async () => {
    if (!onRetry) return;
    try {
      setRetrying(true);
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  const handleBackToLogin = async () => {
    if (!onBackToLogin) return;
    try {
      setSigningOut(true);
      await onBackToLogin();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#e2e8f0_100%)] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-[28px] border border-white/80 bg-white/90 shadow-[0_30px_80px_rgba(15,47,87,0.18)] backdrop-blur-xl overflow-hidden">
        <div className="bg-[#0f2f57] px-8 py-7 text-white">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center overflow-hidden">
              {companyLogo ? (
                <img src={companyLogo} alt={`${companyName} logo`} className="h-full w-full object-cover" />
              ) : (
                <span className="text-lg font-black tracking-wide">{companyName.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-100">Startup</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight">{companyName}</h1>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          <div className="flex items-start gap-4">
            <div className={`mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isChecking ? 'bg-[#ebf4ff]' : status === 'offline' ? 'bg-red-50' : 'bg-amber-50'}`}>
              {isChecking ? (
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b1c7e3] border-t-[#0f2f57]" />
              ) : (
                <div className={`text-2xl ${status === 'offline' ? 'text-red-600' : 'text-amber-600'}`}>
                  {status === 'offline' ? '!' : 'i'}
                </div>
              )}
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-black tracking-tight text-gray-900">{copy.title}</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-gray-600">{copy.description}</p>
              {error && !isChecking ? (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                  {error}
                </div>
              ) : null}
            </div>
          </div>

          {!isChecking ? (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button type="button" onClick={handleRetry} loading={retrying} className="sm:min-w-[180px]">
                Retry Session Restore
              </Button>
              <Button type="button" variant="outline" onClick={handleBackToLogin} loading={signingOut} className="sm:min-w-[160px]">
                Back To Login
              </Button>
            </div>
          ) : (
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
              Secure startup in progress
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default StartupScreen;
