import React from 'react';
import { useToast } from '../src/contexts/ToastContext';
import { ICONS } from '../constants';

const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  const getIconAndColor = (type: string) => {
    switch (type) {
      case 'success':
        return { icon: ICONS.Check, bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon_color: 'text-green-600' };
      case 'error':
        return { icon: ICONS.AlertCircle, bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon_color: 'text-red-600' };
      case 'warning':
        return { icon: ICONS.AlertCircle, bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon_color: 'text-yellow-600' };
      case 'info':
        return { icon: ICONS.Info, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon_color: 'text-blue-600' };
      default:
        return { icon: ICONS.Info, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', icon_color: 'text-gray-600' };
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
      {toasts.map((toast) => {
        const { icon: Icon, bg, border, text, icon_color } = getIconAndColor(toast.type);
        return (
          <div
            key={toast.id}
            className={`${bg} ${border} border rounded-lg p-4 shadow-md flex items-start gap-3 min-w-[320px] max-w-md animate-in slide-in-from-right-5 fade-in duration-300`}
          >
            <div className={`${icon_color} flex-shrink-0 mt-0.5`}>
              {Icon}
            </div>
            <div className={`${text} flex-1 text-sm font-medium`}>
              {toast.message}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className={`${icon_color} flex-shrink-0 hover:opacity-70 transition-opacity`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
