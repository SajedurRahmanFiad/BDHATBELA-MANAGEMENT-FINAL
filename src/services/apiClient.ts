const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api/';
const AUTH_TOKEN_KEY = 'authToken';

export type ApiActionOptions = {
  timeoutMs?: number;
};

type ApiErrorCode = 'TIMEOUT' | 'NETWORK' | 'HTTP_ERROR';

export class ApiError extends Error {
  status?: number;
  code: ApiErrorCode | string;

  constructor(message: string, options?: { status?: number; code?: ApiErrorCode | string }) {
    super(message);
    this.name = 'ApiError';
    this.status = options?.status;
    this.code = options?.code || 'HTTP_ERROR';
  }
}

function normalizeApiBaseUrl(value: string): string {
  if (value === '') {
    return '/api/';
  }

  if (value.includes('?') || /\.php$/i.test(value)) {
    return value;
  }

  return value.endsWith('/') ? value : `${value}/`;
}

const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);

function buildActionUrl(action: string): string {
  const separator = API_BASE_URL.includes('?') ? '&' : '?';
  return `${API_BASE_URL}${separator}action=${encodeURIComponent(action)}`;
}

export function getAuthToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthToken(token: string | null | undefined): void {
  if (token && token.trim()) {
    localStorage.setItem(AUTH_TOKEN_KEY, token.trim());
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function apiAction<T>(action: string, payload?: unknown, options?: ApiActionOptions): Promise<T> {
  const token = getAuthToken();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = Math.max(0, Number(options?.timeoutMs || 0));
  const timeoutId = controller && timeoutMs > 0
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let response: Response;
  try {
    response = await fetch(buildActionUrl(action), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload ?? {}),
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (error: any) {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }

    if (error?.name === 'AbortError') {
      throw new ApiError('Request timed out.', { code: 'TIMEOUT' });
    }

    if (error instanceof TypeError) {
      throw new ApiError('Network request failed.', { code: 'NETWORK' });
    }

    throw error;
  }

  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
  }

  const rawText = await response.text();
  let parsed: any = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { error: rawText };
    }
  }

  if (!response.ok) {
    throw new ApiError(parsed?.error || `Request failed with status ${response.status}`, {
      status: response.status,
      code: parsed?.code || 'HTTP_ERROR',
    });
  }

  return parsed as T;
}
