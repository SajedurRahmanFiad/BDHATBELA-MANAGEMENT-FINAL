const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api/';
const AUTH_TOKEN_KEY = 'authToken';

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

export async function apiAction<T>(action: string, payload?: unknown): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(buildActionUrl(action), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload ?? {}),
  });

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
    throw new Error(parsed?.error || `Request failed with status ${response.status}`);
  }

  return parsed as T;
}
