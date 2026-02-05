/**
 * Utility Functions for Common Operations
 * These functions are reused across many components to avoid repetition
 */

export type FilterRange = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom';

/**
 * Check if a date string falls within the given filter range
 */
export const isWithinDateRange = (
  dateStr: string,
  filterRange: FilterRange,
  customDates: { from: string; to: string }
): boolean => {
  if (filterRange === 'All Time') return true;

  const date = new Date(dateStr);
  const now = new Date();

  if (filterRange === 'Today') {
    return date.toDateString() === now.toDateString();
  }

  if (filterRange === 'This Week') {
    const first = now.getDate() - now.getDay();
    const firstDay = new Date(new Date().setDate(first));
    const lastDay = new Date(new Date().setDate(first + 6));
    return date >= firstDay && date <= lastDay;
  }

  if (filterRange === 'This Month') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  if (filterRange === 'This Year') {
    return date.getFullYear() === now.getFullYear();
  }

  if (filterRange === 'Custom') {
    if (!customDates.from || !customDates.to) return true;
    return date >= new Date(customDates.from) && date <= new Date(customDates.to);
  }

  return true;
};

/**
 * Format a date string to readable format
 */
export const formatDate = (dateStr: string, locale: string = 'en-BD'): string => {
  return new Date(dateStr).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

/**
 * Get today's date in YYYY-MM-DD format
 */
export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

/**
 * Generate a random ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Clone and update an object while maintaining type safety
 */
export const cloneAndUpdate = <T extends Record<string, any>>(
  obj: T,
  updates: Partial<T>
): T => {
  return { ...obj, ...updates };
};
