import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  disabled = false,
  id,
  style,
}: SelectProps) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

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

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
    backgroundColor: 'var(--bg-input)',
    border: `1.5px solid ${error ? '#ef4444' : 'var(--border-input)'}`,
    borderRadius: '0.5rem',
    transition: 'all 150ms ease',
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    paddingRight: '2.5rem',
    ...style,
  };

  const errorStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    color: '#ef4444',
  };

  return (
    <div style={wrapperStyle}>
      {label && (
        <label htmlFor={selectId} style={labelStyle}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          ...selectStyle,
          ...(disabled ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span style={errorStyle}>{error}</span>}
    </div>
  );
}
