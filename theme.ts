/**
 * Global Theme Configuration
 * Update values here to change the entire app's appearance
 */

export const theme = {
  // Primary Colors
  colors: {
    // Brand colors - change these to update entire app theme
    primary: {
      50: 'bg-[#ebf4ff]',
      100: 'bg-[#b1c7e3]',
      200: 'bg-[#6e8db5]',
      500: 'bg-[#3c5a82]',
      600: 'bg-[#0f2f57]',
      700: 'bg-[#0c203b]',
      text: 'text-[#0f2f57]',
      textLight: 'text-[#0f2f57]',
    },
    secondary: {
      50: 'bg-blue-50',
      100: 'bg-blue-100',
      600: 'bg-blue-600',
      700: 'bg-blue-700',
      text: 'text-blue-600',
    },
    danger: {
      50: 'bg-red-50',
      100: 'bg-red-100',
      600: 'bg-red-600',
      700: 'bg-red-700',
      text: 'text-red-600',
    },
    warning: {
      50: 'bg-orange-50',
      100: 'bg-orange-100',
      600: 'bg-orange-600',
      text: 'text-orange-600',
    },
    success: {
      50: 'bg-green-50',
      100: 'bg-green-100',
      600: 'bg-green-600',
      text: 'text-green-600',
    },
    info: {
      50: 'bg-purple-50',
      100: 'bg-purple-100',
      600: 'bg-purple-600',
      text: 'text-purple-600',
    },

    // Neutral
    bg: {
      primary: 'bg-white',
      secondary: 'bg-gray-50',
      tertiary: 'bg-gray-100',
    },
    text: {
      primary: 'text-gray-900',
      secondary: 'text-gray-500',
      tertiary: 'text-gray-400',
      light: 'text-gray-300',
    },
    border: {
      primary: 'border-gray-100',
      secondary: 'border-gray-200',
    },
  },

  // Spacing - use these consistently
  spacing: {
    xs: 'p-1.5',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
    xl: 'p-12',
  },

  // Border Radius - use these consistently
  radius: {
    sm: 'rounded-lg',
    md: 'rounded-xl',
    lg: 'rounded-2xl',
    full: 'rounded-full',
  },

  // Typography
  typography: {
    title: {
      lg: 'text-3xl font-black tracking-tight',
      md: 'text-2xl font-bold',
      sm: 'text-lg font-bold',
    },
    label: {
      default: 'text-sm font-medium text-gray-400 uppercase tracking-wider',
      strong: 'text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]',
    },
    body: {
      default: 'text-sm font-medium',
      small: 'text-xs font-medium',
      tiny: 'text-[10px] font-bold',
    },
  },

  // Shadows
  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
    hoverGlow: 'hover:shadow-lg hover:scale-[1.02]',
  },

  // Transitions
  transitions: {
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-300',
    slow: 'transition-all duration-500',
  },

  // Button styles
  buttons: {
    base: 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-300 cursor-pointer',
    primary: 'bg-[#0f2f57] text-white hover:bg-[#0c203b] shadow-lg shadow-blue-100',
    secondary: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    outline: 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50',
    sizes: {
      sm: 'px-3 py-2 text-xs',
      md: 'px-4 py-2.5 text-sm',
      lg: 'px-6 py-3.5 text-sm',
    },
  },

  // Input styles
  inputs: {
    base: 'w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#3c5a82] focus:border-transparent transition-all',
    label: 'block text-sm font-semibold text-gray-700 mb-2',
    error: 'border-red-500 focus:ring-red-500',
  },

  // Table styles
  table: {
    header: 'bg-gray-50 border-b border-gray-100',
    headerCell: 'px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]',
    bodyCell: 'px-6 py-5',
    row: 'border-b border-gray-50 hover:bg-[#ebf4ff]/50 cursor-pointer transition-all',
  },

  // Card styles
  card: {
    base: 'bg-white rounded-2xl shadow-sm border border-gray-100 transition-all',
    elevated: 'bg-white rounded-2xl shadow-md border border-gray-100',
    hoverScale: 'hover:scale-[1.02] hover:shadow-md',
  },

  // Status colors mapping
  status: {
    'ON_HOLD': 'bg-gray-100 text-gray-600',
    'PROCESSING': 'bg-blue-100 text-blue-600',
    'PICKED': 'bg-purple-100 text-purple-600',
    'COMPLETED': 'bg-green-100 text-green-600',
    'CANCELLED': 'bg-red-100 text-red-600',
    'RECEIVED': 'bg-green-100 text-green-600',
    'PENDING': 'bg-yellow-100 text-yellow-600',
  },
};

export type Theme = typeof theme;
