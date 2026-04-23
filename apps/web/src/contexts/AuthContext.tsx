import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role?: string;
  organization?: string;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_BASE = '/api/v1/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const scheduleRefresh = useCallback((expiresInMs: number) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // Refresh 60s before expiry, minimum 10s
    const refreshIn = Math.max(expiresInMs - 60000, 10000);
    refreshTimerRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('aurex_refresh_token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: token }),
        });
        if (res.ok) {
          const data = await res.json();
          localStorage.setItem('aurex_token', data.access_token);
          if (data.refresh_token) {
            localStorage.setItem('aurex_refresh_token', data.refresh_token);
          }
          // Schedule next refresh (default 15min)
          scheduleRefresh(data.expires_in ? data.expires_in * 1000 : 900000);
        } else {
          localStorage.removeItem('aurex_token');
          localStorage.removeItem('aurex_refresh_token');
          setUser(null);
        }
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
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || data);
        scheduleRefresh(900000); // 15 min default
      } else {
        localStorage.removeItem('aurex_token');
        localStorage.removeItem('aurex_refresh_token');
        setUser(null);
      }
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
      localStorage.setItem('aurex_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('aurex_refresh_token', data.refresh_token);
      }
      setUser(data.user);
      scheduleRefresh(data.expires_in ? data.expires_in * 1000 : 900000);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRefresh]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Registration failed');
      }
      if (data.access_token) {
        localStorage.setItem('aurex_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('aurex_refresh_token', data.refresh_token);
        }
        setUser(data.user);
        scheduleRefresh(data.expires_in ? data.expires_in * 1000 : 900000);
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [scheduleRefresh]);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('aurex_token');
    try {
      if (token) {
        await fetch(`${API_BASE}/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
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
