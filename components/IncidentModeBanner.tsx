import React from 'react';
import { WRITE_FREEZE_ENABLED, WRITE_FREEZE_MESSAGE, WRITE_FREEZE_TITLE } from '../src/config/incidentMode';

const IncidentModeBanner: React.FC = () => {
  if (!WRITE_FREEZE_ENABLED) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <div className="pt-0.5 text-lg" aria-hidden="true">
          !
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide">{WRITE_FREEZE_TITLE}</p>
          <p className="text-sm text-amber-900">{WRITE_FREEZE_MESSAGE}</p>
        </div>
      </div>
    </div>
  );
};

export default IncidentModeBanner;
