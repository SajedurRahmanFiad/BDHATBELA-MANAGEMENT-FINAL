/**
 * Utility Functions for Common Operations
 * These functions are reused across many components to avoid repetition
 */

export type FilterRange = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom';

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const formatYmd = (value: Date): string => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseYmd = (value: string, endOfDay: boolean): Date | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (!isValidDate(date)) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
};

const parseDateInput = (value: string): Date | null => {
  const ymd = parseYmd(value, false);
  if (ymd) return ymd;
  const date = new Date(value);
  return isValidDate(date) ? date : null;
};

const startOfToday = (now: Date): Date => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date): Date => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const buildDateRange = (
  filterRange: FilterRange,
  customDates: { from: string; to: string }
): { from?: Date; to?: Date } => {
  const now = new Date();

  if (filterRange === 'All Time') return {};

  if (filterRange === 'Today') {
    return { from: startOfToday(now), to: endOfDay(now) };
  }

  if (filterRange === 'This Week') {
    const first = new Date(now);
    first.setDate(now.getDate() - now.getDay());
    first.setHours(0, 0, 0, 0);
    return { from: first, to: endOfDay(now) };
  }

  if (filterRange === 'This Month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    return { from, to: endOfDay(now) };
  }

  if (filterRange === 'This Year') {
    const from = new Date(now.getFullYear(), 0, 1);
    from.setHours(0, 0, 0, 0);
    return { from, to: endOfDay(now) };
  }

  const from = parseYmd(customDates.from, false) || undefined;
  const to = parseYmd(customDates.to, true) || undefined;

  if (from && to && from.getTime() > to.getTime()) {
    return { from: to, to: from };
  }

  return { from, to };
};

export const getDateTimeFilters = (
  filterRange: FilterRange,
  customDates: { from: string; to: string }
): { from?: string; to?: string } => {
  const { from, to } = buildDateRange(filterRange, customDates);
  return {
    ...(from && { from: from.toISOString() }),
    ...(to && { to: to.toISOString() }),
  };
};

export const getDateOnlyFilters = (
  filterRange: FilterRange,
  customDates: { from: string; to: string }
): { from?: string; to?: string } => {
  const { from, to } = buildDateRange(filterRange, customDates);
  return {
    ...(from && { from: formatYmd(from) }),
    ...(to && { to: formatYmd(to) }),
  };
};

/**
 * Check if a date string falls within the given filter range
 */
export const isWithinDateRange = (
  dateStr: string,
  filterRange: FilterRange,
  customDates: { from: string; to: string }
): boolean => {
  const date = parseDateInput(dateStr);
  if (!date) return false;
  const { from, to } = buildDateRange(filterRange, customDates);
  if (from && date < from) return false;
  if (to && date > to) return false;
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
  return formatYmd(new Date());
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

/**
 * Normalize a phone input string by stripping out any characters that are
 * not English or Bengali digits and capping the result to 11 characters
 * (the max length used throughout the app).
 */
export const sanitizePhoneInput = (value: string): string => {
  // Allow standard 0‑9 digits and Bengali digits (U+09E6–U+09EF).
  const digits = value.match(/[0-9\u09E6-\u09EF]/g);
  // join and truncate to 11 characters
  return (digits ? digits.join('') : '').slice(0, 11);
};
