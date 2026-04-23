import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, hint, icon, style, id, ...props }: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  };

  const inputWrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    paddingLeft: icon ? '2.5rem' : '0.875rem',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-input)',
    border: `1.5px solid ${error ? '#ef4444' : 'var(--border-input)'}`,
    borderRadius: '0.5rem',
    transition: 'all 150ms ease',
    ...style,
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: '#ef4444',
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: 'var(--text-tertiary)',
  };

  return (
    <div style={wrapperStyle}>
      {label && <label htmlFor={inputId} style={labelStyle}>{label}</label>}
      <div style={inputWrapperStyle}>
        {icon && <span style={iconStyle}>{icon}</span>}
        <input id={inputId} {...props} style={inputStyle} />
      </div>
      {error && <span style={errorStyle}>{error}</span>}
      {hint && !error && <span style={hintStyle}>{hint}</span>}
    </div>
  );
}
