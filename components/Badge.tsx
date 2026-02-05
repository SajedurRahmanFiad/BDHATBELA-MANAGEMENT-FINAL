import React from 'react';
import { theme } from '../theme';

interface BadgeProps {
  status: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const statusKey = status.toUpperCase().replace(/-/g, '_');
  const statusStyle = (theme.status as any)[statusKey] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${statusStyle} ${className}`}>
      {status}
    </span>
  );
};
