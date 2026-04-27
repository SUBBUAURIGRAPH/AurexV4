import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  organization?: string;
  emailVerifiedAt?: string | null;
}

export interface RegisterTrialPayload {
  trialStart: string;
  trialEnd: string;
  trialTier: string;
  trialDurationDays: number;
  appliedCouponCode: string;
}

export interface RegisterResultPayload {
  trial?: RegisterTrialPayload;
  couponWarning?: string;
  /** Dev-only: surfaced when NODE_ENV !== 'production' on the API. */
  _devVerificationToken?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    couponCode?: string,
  ) => Promise<RegisterResultPayload>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const API_BASE = '/api/v1/auth';

function pickUser(payload: unknown): User | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const candidate = (root.data as Record<string, unknown> | undefined) ?? (root.user as Record<string, unknown> | undefined) ?? root;
  if (!candidate || typeof candidate !== 'object') return null;

  const id = candidate.id ? String(candidate.id) : '';
  const email = candidate.email ? String(candidate.email) : '';
  const name = candidate.name ? String(candidate.name) : '';
  if (!id || !email) return null;

  return {
    id,
    email,
    name,
    role: candidate.role ? String(candidate.role).toLowerCase() : undefined,
    organization: candidate.organization ? String(candidate.organization) : undefined,
    emailVerifiedAt:
      candidate.emailVerifiedAt === null || candidate.emailVerifiedAt === undefined
        ? null
        : String(candidate.emailVerifiedAt),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const scheduleRefresh = useCallback((expiresInMs: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const refreshIn = Math.max(expiresInMs - 60000, 10000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('aurex_refresh_token');
        if (!token) return;

        const res = await fetch(`${API_BASE}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: token }),
        });

        if (!res.ok) {
          localStorage.removeItem('aurex_token');
          localStorage.removeItem('aurex_refresh_token');
          setUser(null);
          return;
        }

        const data = await res.json();
        const accessToken = data.accessToken ?? data.access_token;
        const refreshToken = data.refreshToken ?? data.refresh_token;

        if (accessToken) localStorage.setItem('aurex_token', accessToken);
        if (refreshToken) localStorage.setItem('aurex_refresh_token', refreshToken);
        scheduleRefresh(data.expires_in ? data.expires_in * 1000 : 900000);
      } catch {
        // Silent fail on refresh
      }
    }, refreshIn);
  }, []);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('aurex_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        localStorage.removeItem('aurex_token');
        localStorage.removeItem('aurex_refresh_token');
        setUser(null);
        return;
      }

      const data = await res.json();
      setUser(pickUser(data));
      scheduleRefresh(900000);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRefresh]);

  useEffect(() => {
    fetchUser();
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [fetchUser]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }

      const accessToken = data.accessToken ?? data.access_token;
      const refreshToken = data.refreshToken ?? data.refresh_token;
      if (accessToken) localStorage.setItem('aurex_token', accessToken);
      if (refreshToken) localStorage.setItem('aurex_refresh_token', refreshToken);

      setUser(pickUser(data));
      scheduleRefresh(data.expires_in ? data.expires_in * 1000 : 900000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRefresh]);

  const register = useCallback(async (
    name: string,
    email: string,
    password: string,
    couponCode?: string,
  ): Promise<RegisterResultPayload> => {
    setError(null);
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { name, email, password };
      if (couponCode && couponCode.trim().length > 0) {
        body.couponCode = couponCode.trim().toUpperCase();
      }
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || data.error || 'Registration failed');
      }

      const accessToken = data.accessToken ?? data.access_token;
      const refreshToken = data.refreshToken ?? data.refresh_token;
      if (accessToken) {
        localStorage.setItem('aurex_token', accessToken);
        if (refreshToken) localStorage.setItem('aurex_refresh_token', refreshToken);
        setUser(pickUser(data));
        scheduleRefresh(data.expires_in ? data.expires_in * 1000 : 900000);
      } else {
        await fetchUser();
      }

      // Surface trial / warning / dev-token to the caller so the
      // RegisterPage can display the appropriate post-signup state.
      const result: RegisterResultPayload = {};
      if (data.trial) result.trial = data.trial as RegisterTrialPayload;
      if (data.couponWarning) result.couponWarning = String(data.couponWarning);
      if (data._devVerificationToken) {
        result._devVerificationToken = String(data._devVerificationToken);
      }
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchUser, scheduleRefresh]);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('aurex_token');
    const refreshToken = localStorage.getItem('aurex_refresh_token');

    try {
      if (token) {
        await fetch(`${API_BASE}/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Silent fail
    } finally {
      localStorage.removeItem('aurex_token');
      localStorage.removeItem('aurex_refresh_token');
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        error,
        clearError,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
