import React from 'react';
import { theme } from '../theme';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', children, icon, loading = false, className = '', ...props }, ref) => {
    const variantStyles = {
      primary: `${theme.colors.primary[600]} text-white hover:${theme.colors.primary[700]} shadow-lg shadow-[#0f2f57]/20`,
      secondary: theme.buttons.secondary,
      danger: `${theme.colors.danger[600]} text-white hover:${theme.colors.danger[700]} shadow-lg`,
      outline: theme.buttons.outline,
      ghost: 'text-gray-600 hover:bg-gray-50',
    };

    const sizeStyles = {
      sm: theme.buttons.sizes.sm,
      md: theme.buttons.sizes.md,
      lg: theme.buttons.sizes.lg,
    };

    return (
      <button
        ref={ref}
        className={`${theme.buttons.base} ${variantStyles[variant]} ${sizeStyles[size]} ${loading ? 'opacity-75 cursor-wait' : ''} ${className}`}
        disabled={loading || (props as any).disabled}
        {...props}
      >
        <span className="flex items-center gap-2">
          {loading && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {icon && !loading && <span>{icon}</span>}
          {children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * IconButton - Compact button for icon-only actions (edit, delete, etc.)
 */
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'danger' | 'secondary' | 'neutral';
  icon: React.ReactNode;
  title?: string;
}

const iconButtonVariants = {
  primary: `p-2.5 text-gray-400 hover:${theme.colors.primary[600]} hover:bg-[#ebf4ff] rounded-lg transition-all`,
  danger: 'p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all',
  secondary: `p-2.5 text-gray-400 hover:${theme.colors.secondary[600]} hover:bg-[#e6f0ff] rounded-lg transition-all`,
  neutral: 'p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all',
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = 'primary', icon, title, className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`${iconButtonVariants[variant]} ${className}`}
      title={title}
      {...props}
    >
      {icon}
    </button>
  )
);

IconButton.displayName = 'IconButton';
