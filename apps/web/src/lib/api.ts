const API_BASE = '/api/v1';

/**
 * AAT-WORKFLOW (Wave 9a): Onboarding-incomplete RFC 7807 marker.
 *
 * The API returns 412 with this `type` when the caller's org hasn't finished
 * the onboarding wizard (see apps/api/src/middleware/onboarding-gate.ts).
 * The interceptor below intercepts that response, shows a toast, and
 * redirects the browser to `nextStep` (defaulting to `/onboarding`).
 */
export const ONBOARDING_INCOMPLETE_TYPE =
  'https://aurex.in/errors/onboarding-incomplete';

/**
 * AAT-378 / AV4-378: Tier quota exceeded marker. The API returns 429
 * with this `type` when a write would push the org past its tier
 * quota. The interceptor below toasts and (when nextStep is provided)
 * redirects to /billing/manage so the user can upgrade.
 */
export const QUOTA_EXCEEDED_TYPE = 'https://aurex.in/errors/quota-exceeded';

interface OnboardingIncompleteBody {
  type: string;
  title?: string;
  detail?: string;
  nextStep?: string;
}

interface QuotaExceededBody {
  type: string;
  title?: string;
  detail?: string;
  nextStep?: string;
  resource?: string;
  used?: number;
  limit?: number;
}

function isOnboardingIncompleteBody(value: unknown): value is OnboardingIncompleteBody {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && v.type === ONBOARDING_INCOMPLETE_TYPE;
}

function isQuotaExceededBody(value: unknown): value is QuotaExceededBody {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === 'string' && v.type === QUOTA_EXCEEDED_TYPE;
}

/**
 * Pluggable onboarding-incomplete handler. The frontend wires this once at
 * app boot from the ToastContext + react-router so we can surface a toast
 * and redirect without coupling api.ts to React.
 */
type OnboardingIncompleteHandler = (info: {
  detail: string;
  nextStep: string;
}) => void;

let onboardingIncompleteHandler: OnboardingIncompleteHandler | null = null;

export function setOnboardingIncompleteHandler(
  handler: OnboardingIncompleteHandler | null,
): void {
  onboardingIncompleteHandler = handler;
}

/**
 * AAT-378 / AV4-378: pluggable quota-exceeded handler. Symmetric to
 * the onboarding handler — wired once at app boot from ToastContext +
 * react-router so the toast + optional redirect-to-billing UX stays
 * decoupled from api.ts.
 */
type QuotaExceededHandler = (info: {
  detail: string;
  resource: string | null;
  used: number | null;
  limit: number | null;
  nextStep: string | null;
}) => void;

let quotaExceededHandler: QuotaExceededHandler | null = null;

export function setQuotaExceededHandler(
  handler: QuotaExceededHandler | null,
): void {
  quotaExceededHandler = handler;
}

/**
 * Pure helper used by both the live `request()` interceptor and the unit
 * tests. Given a parsed JSON body + status, decides whether this is the
 * onboarding-incomplete signal and (if so) invokes the registered handler.
 * Returns `{ handled, nextStep }` so callers can short-circuit further error
 * processing.
 */
export function maybeHandleOnboardingIncomplete(
  status: number,
  body: unknown,
): { handled: boolean; nextStep: string | null } {
  if (status !== 412) return { handled: false, nextStep: null };
  if (!isOnboardingIncompleteBody(body)) return { handled: false, nextStep: null };

  const nextStep = body.nextStep ?? '/onboarding';
  const detail = body.detail ?? 'Please complete onboarding first';

  if (onboardingIncompleteHandler) {
    onboardingIncompleteHandler({ detail, nextStep });
  } else if (typeof window !== 'undefined') {
    // Fallback: hard navigate when no React-aware handler is wired yet (e.g.
    // very early boot or unit-test envs without the provider).
    window.location.href = nextStep;
  }
  return { handled: true, nextStep };
}

/**
 * AAT-378 / AV4-378 — quota-exceeded interceptor helper. Mirrors
 * `maybeHandleOnboardingIncomplete` shape: pure function that returns
 * `{ handled, nextStep }`, side-effects through the registered
 * handler (preferred) or a hard window.location nav (fallback).
 *
 * Returns a default upgrade-CTA copy when the API body omits
 * `detail`. If `nextStep` is missing we still toast but skip the
 * redirect so the user stays on the page they tried to write from.
 */
export function maybeHandleQuotaExceeded(
  status: number,
  body: unknown,
): { handled: boolean; nextStep: string | null } {
  if (status !== 429) return { handled: false, nextStep: null };
  if (!isQuotaExceededBody(body)) return { handled: false, nextStep: null };

  const resource = body.resource ?? null;
  const used = typeof body.used === 'number' ? body.used : null;
  const limit = typeof body.limit === 'number' ? body.limit : null;
  const nextStep = body.nextStep ?? null;
  const detail =
    body.detail ??
    (resource
      ? `Quota exceeded for ${resource}. Upgrade your plan to continue.`
      : 'Quota exceeded. Upgrade your plan to continue.');

  if (quotaExceededHandler) {
    quotaExceededHandler({ detail, resource, used, limit, nextStep });
  } else if (nextStep && typeof window !== 'undefined') {
    // Fallback: hard navigate to the upgrade page when no React-aware
    // handler is wired yet (early boot / non-provider test env). When
    // there is no nextStep we just mark handled so the calling
    // mutation surfaces the API error message verbatim.
    window.location.href = nextStep;
  }
  return { handled: true, nextStep };
}

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
    // AAT-WORKFLOW (Wave 9a): intercept 412 onboarding-incomplete before the
    // generic error path. Trigger a toast + nav-redirect via the registered
    // handler, then still throw so the calling react-query mutation/query
    // resolves to an error state (the user has been told what to do; we just
    // don't want a misleading "Internal Server Error" toast on top).
    maybeHandleOnboardingIncomplete(response.status, data);
    // AAT-378 / AV4-378: same pattern for 429 quota-exceeded — toast +
    // optional redirect to /billing/manage. Still throws so calling
    // react-query mutations transition to error state.
    maybeHandleQuotaExceeded(response.status, data);

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

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

export { ApiError };
