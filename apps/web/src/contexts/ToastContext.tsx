import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

/* ============================================
   Toast System — Pure React, inline styles,
   CSS variables from index.css
   ============================================ */

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface ToastContextType {
  toasts: Toast[];
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 4000;

let toastCounter = 0;

/* ---------- SVG Icons ---------- */

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M16.667 5L7.5 14.167 3.333 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M12.5 7.5L7.5 12.5M7.5 7.5l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M10 9v4M10 7h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 3L18 17H2L10 3z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M10 8v4M10 14h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const TOAST_ICON: Record<Toast['type'], React.FC> = {
  success: CheckIcon,
  error: XCircleIcon,
  info: InfoIcon,
  warning: WarningIcon,
};

const TOAST_COLOR: Record<Toast['type'], string> = {
  success: 'var(--success)',
  error: 'var(--error)',
  info: 'var(--info)',
  warning: 'var(--warning)',
};

/* ---------- Single Toast Component ---------- */

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startExit = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  }, [onDismiss, toast.id]);

  useEffect(() => {
    timerRef.current = setTimeout(startExit, AUTO_DISMISS_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [startExit]);

  const Icon = TOAST_ICON[toast.type];
  const color = TOAST_COLOR[toast.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '14px 16px',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-card)',
        borderLeft: `4px solid ${color}`,
        boxShadow: 'var(--shadow-lg)',
        minWidth: '320px',
        maxWidth: '420px',
        animation: exiting ? 'toastFadeOut 0.3s ease forwards' : 'toastSlideIn 0.3s ease forwards',
        pointerEvents: 'auto',
      }}
      role="alert"
    >
      <span style={{ color, flexShrink: 0, marginTop: '1px' }}>
        <Icon />
      </span>
      <span
        style={{
          flex: 1,
          fontSize: '14px',
          lineHeight: '1.5',
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
        }}
      >
        {toast.message}
      </span>
      <button
        onClick={() => startExit()}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          color: 'var(--text-tertiary)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'color 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
        }}
        aria-label="Dismiss"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/* ---------- Keyframe injection (once) ---------- */

let stylesInjected = false;

function injectKeyframes() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes toastFadeOut {
      from { opacity: 1; transform: translateX(0); }
      to   { opacity: 0; transform: translateX(40px); }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Provider ---------- */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    injectKeyframes();
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    setToasts((prev) => {
      const next = [...prev, { id, type, message }];
      // Keep only the last MAX_TOASTS
      return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next;
    });
  }, []);

  const success = useCallback((msg: string) => addToast('success', msg), [addToast]);
  const error = useCallback((msg: string) => addToast('error', msg), [addToast]);
  const info = useCallback((msg: string) => addToast('info', msg), [addToast]);
  const warning = useCallback((msg: string) => addToast('warning', msg), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, success, error, info, warning, dismiss }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Hook ---------- */

export function useToast(): Omit<ToastContextType, 'toasts'> {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  const { success, error, info, warning, dismiss } = ctx;
  return { success, error, info, warning, dismiss };
}

export type { Toast, ToastContextType };
