import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'auto';
export type EffectiveTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: EffectiveTheme;
  configuredTheme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isSystemTheme: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'auto',
  storageKey = 'aurex-theme',
}: ThemeProviderProps) {
  const [configuredTheme, setConfiguredTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    const stored = localStorage.getItem(storageKey);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
    return defaultTheme;
  });

  const [systemTheme, setSystemTheme] = useState<EffectiveTheme>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = (isDark: boolean) => setSystemTheme(isDark ? 'dark' : 'light');
    apply(media.matches);

    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme: EffectiveTheme = configuredTheme === 'auto' ? systemTheme : configuredTheme;

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback(
    (nextTheme: ThemeMode) => {
      setConfiguredTheme(nextTheme);
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, nextTheme);
      }
    },
    [storageKey]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      configuredTheme,
      setTheme,
      toggleTheme,
      isSystemTheme: configuredTheme === 'auto',
    }),
    [theme, configuredTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
