// API client: bearer-token fetch wrapper with 401 handling.

const API_BASE = import.meta.env.VITE_API_URL ?? '';

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function getToken(): string | null {
  return localStorage.getItem('lip_token');
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem('lip_token', token);
  else localStorage.removeItem('lip_token');
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as any) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    onUnauthorized?.();
  }
  const isCsv = res.headers.get('Content-Type')?.includes('text/csv');
  const body = isCsv ? await res.text() : await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as any).error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });
export const put = <T = any>(path: string, data?: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(data) });

/** Downloads a CSV report through the authenticated API. */
export async function downloadCsv(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError('Export failed', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
