const API_BASE = '/api/v1';

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, ...fetchOptions } = options;

  // Build URL with query params (filter out undefined)
  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  // Build headers
  const token = localStorage.getItem('aurex_token');
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Auto-add Content-Type for POST/PATCH/PUT
  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    serializedBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: serializedBody,
  });

  // Handle 401 -> clear tokens, redirect to /login
  if (response.status === 401) {
    localStorage.removeItem('aurex_token');
    localStorage.removeItem('aurex_refresh_token');
    window.location.href = '/login';
    throw new ApiError('Unauthorized', 401);
  }

  // Parse response body
  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  // Throw on non-ok status
  if (!response.ok) {
    const message =
      (data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : null) ||
      (data && typeof data === 'object' && 'message' in data
        ? (data as { message: string }).message
        : null) ||
      (data && typeof data === 'object' && 'error' in data
        ? (data as { error: string }).error
        : null) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
    request<T>(path, { method: 'GET', params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
