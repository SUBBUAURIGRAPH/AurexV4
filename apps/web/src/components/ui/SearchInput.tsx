import React, { useRef, useEffect, useCallback } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedOnChange = useCallback(
    (val: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(val);
      }, 300);
    },
    [onChange]
  );

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalValue(val);
    debouncedOnChange(val);
  };

  const handleClear = () => {
    setLocalValue('');
    onChange('');
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '0.75rem',
    color: 'var(--text-tertiary)',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.875rem',
    paddingLeft: '2.5rem',
    paddingRight: localValue ? '2.5rem' : '0.875rem',
    fontSize: '0.9375rem',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-input)',
    border: '1.5px solid var(--border-input)',
    borderRadius: '0.5rem',
    transition: 'all 150ms ease',
  };

  const clearButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '0.5rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: '0.25rem',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-tertiary)',
    cursor: 'pointer',
    transition: 'all 150ms',
  };

  return (
    <div style={wrapperStyle}>
      <span style={iconStyle}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        style={inputStyle}
      />
      {localValue && (
        <button
          style={clearButtonStyle}
          onClick={handleClear}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--text-tertiary)';
          }}
          aria-label="Clear search"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
