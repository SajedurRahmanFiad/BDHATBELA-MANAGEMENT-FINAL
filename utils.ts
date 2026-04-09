/**
 * Utility Functions for Common Operations
 * These functions are reused across many components to avoid repetition
 */

import type { Bill, Order, Transaction } from './types';

export type FilterRange = 'All Time' | 'Today' | 'This Week' | 'This Month' | 'This Year' | 'Custom';

const APP_TIME_ZONE = 'Asia/Dhaka';
const UTC_OFFSET_SUFFIX_PATTERN = /(?:[zZ]|[+-]\d{2}(?::?\d{2})?)$/;
const HISTORY_CREATED_PATTERNS = [
  /\bon\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}),\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)\b/i,
  /\bon\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}),\s+at\s+(\d{1,2}:\d{2}\s*[AP]M)\b/i,
];

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

export const normalizeUtcTimestamp = (value?: string | null): string => {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const normalized = UTC_OFFSET_SUFFIX_PATTERN.test(raw) ? raw : `${raw}Z`;
  const date = new Date(normalized);
  return isValidDate(date) ? date.toISOString() : raw;
};

export const buildLocalDateTime = (dateValue: string, timeValue: string = '00:00'): Date | null => {
  const baseDate = parseYmd(dateValue, false) || parseDateInput(dateValue);
  if (!baseDate) return null;

  const [hoursStr = '0', minutesStr = '0'] = String(timeValue || '').split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  baseDate.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return baseDate;
};

export const combineDateAndTimeToIso = (dateValue: string, timeValue: string = '00:00'): string => {
  const localDateTime = buildLocalDateTime(dateValue, timeValue);
  return localDateTime ? localDateTime.toISOString() : '';
};

export const parseCreatedHistoryTimestamp = (value?: string | null): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  for (const pattern of HISTORY_CREATED_PATTERNS) {
    const match = raw.match(pattern);
    if (!match?.[1] || !match?.[2]) continue;

    const parsed = new Date(`${match[1]} ${match[2]} +06:00`);
    if (isValidDate(parsed)) {
      return parsed.toISOString();
    }
  }

  return '';
};

const resolveActivityDate = (
  timestampValue?: string | null,
  dateOnlyValue?: string | null,
  historyCreatedValue?: string | null
): string => {
  return (
    normalizeUtcTimestamp(timestampValue) ||
    parseCreatedHistoryTimestamp(historyCreatedValue) ||
    String(dateOnlyValue || '').trim()
  );
};

export const getOrderActivityDate = (order: Pick<Order, 'createdAt' | 'orderDate' | 'history'>): string =>
  resolveActivityDate(order.createdAt, order.orderDate, order.history?.created);

export const getBillActivityDate = (bill: Pick<Bill, 'createdAt' | 'billDate' | 'history'>): string =>
  resolveActivityDate(bill.createdAt, bill.billDate, bill.history?.created);

export const getTransactionActivityDate = (
  transaction: Pick<Transaction, 'createdAt' | 'date' | 'history'>
): string => {
  const timeAwareDate = transaction.date && String(transaction.date).trim().length > 10
    ? normalizeUtcTimestamp(transaction.date)
    : '';

  return (
    normalizeUtcTimestamp(transaction.createdAt) ||
    timeAwareDate ||
    parseCreatedHistoryTimestamp(transaction.history?.created) ||
    String(transaction.date || '').trim()
  );
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
  const raw = String(dateStr || '').trim();
  if (!raw) return '';

  const normalized = raw.length > 10 ? normalizeUtcTimestamp(raw) || raw : raw;
  const date = parseDateInput(normalized);

  if (!date) return raw;

  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(raw.length > 10 ? { timeZone: APP_TIME_ZONE } : {}),
  });
};

export const formatDateTimeParts = (
  value?: string | null,
  locale: string = 'en-BD'
): { date: string; time: string } => {
  const raw = String(value || '').trim();
  if (!raw) return { date: '', time: '' };

  const normalized = raw.length > 10 ? normalizeUtcTimestamp(raw) || raw : raw;
  const date = parseDateInput(normalized);
  if (!date) return { date: raw, time: '' };

  if (raw.length <= 10) {
    return {
      date: date.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      time: '',
    };
  }

  return {
    date: date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: APP_TIME_ZONE,
    }),
    time: date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: APP_TIME_ZONE,
    }),
  };
};

export const openAttachmentPreview = (attachmentUrl?: string | null): boolean => {
  const raw = String(attachmentUrl || '').trim();
  if (!raw || typeof window === 'undefined') return false;

  let previewUrl = raw;
  let shouldRevoke = false;

  try {
    if (raw.startsWith('data:')) {
      const [metadata, encodedPayload = ''] = raw.split(',', 2);
      const mimeType = metadata.match(/^data:([^;]+)/i)?.[1] || 'application/octet-stream';
      const isBase64 = /;base64/i.test(metadata);
      const decodedPayload = isBase64 ? atob(encodedPayload) : decodeURIComponent(encodedPayload);
      const bytes = new Uint8Array(decodedPayload.length);

      for (let index = 0; index < decodedPayload.length; index += 1) {
        bytes[index] = decodedPayload.charCodeAt(index);
      }

      previewUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
      shouldRevoke = true;
    }

    const openedWindow = window.open(previewUrl, '_blank', 'noopener,noreferrer');

    if (!openedWindow) {
      const fallbackLink = document.createElement('a');
      fallbackLink.href = previewUrl;
      fallbackLink.target = '_blank';
      fallbackLink.rel = 'noopener noreferrer';
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      fallbackLink.remove();
    }

    if (shouldRevoke) {
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    }

    return true;
  } catch (_error) {
    if (shouldRevoke) {
      URL.revokeObjectURL(previewUrl);
    }
    return false;
  }
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

export const normalizePhoneSearchValue = (value: string): string => (
  sanitizePhoneInput(value).replace(/[\u09E6-\u09EF]/g, (digit) => String(digit.charCodeAt(0) - 0x09E6))
);

export const matchesNamePhoneSearch = (
  candidate: { name?: string | null; phone?: string | null },
  rawQuery: string
): boolean => {
  const query = String(rawQuery || '').trim().toLowerCase();
  if (!query) return true;

  const normalizedQueryPhone = normalizePhoneSearchValue(rawQuery);
  const candidateName = String(candidate.name || '').toLowerCase();
  const candidatePhone = String(candidate.phone || '').toLowerCase();
  const normalizedCandidatePhone = normalizePhoneSearchValue(String(candidate.phone || ''));

  return (
    candidateName.includes(query) ||
    candidatePhone.includes(query) ||
    (!!normalizedQueryPhone && normalizedCandidatePhone.includes(normalizedQueryPhone))
  );
};
