import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  fontFamily: 'inherit',
  fontWeight: 600,
  borderRadius: '0.5rem',
  border: '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 200ms ease',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    backgroundColor: '#1a5d3d',
    color: '#ffffff',
    borderColor: '#1a5d3d',
  },
  secondary: {
    backgroundColor: '#10b981',
    color: '#ffffff',
    borderColor: '#10b981',
  },
  outline: {
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-secondary)',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: '#ef4444',
    color: '#ffffff',
    borderColor: '#ef4444',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '0.375rem 0.875rem', fontSize: '0.8125rem' },
  md: { padding: '0.625rem 1.25rem', fontSize: '0.875rem' },
  lg: { padding: '0.75rem 1.75rem', fontSize: '1rem' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  icon,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const [hovered, setHovered] = React.useState(false);

  const computedStyle: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(fullWidth ? { width: '100%' } : {}),
    ...(disabled || loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
    ...(hovered && !disabled && !loading
      ? {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(26, 93, 61, 0.2)',
          ...(variant === 'primary' ? { backgroundColor: '#22755a' } : {}),
          ...(variant === 'secondary' ? { backgroundColor: '#34d399' } : {}),
          ...(variant === 'outline' ? { borderColor: '#1a5d3d', color: '#1a5d3d' } : {}),
          ...(variant === 'ghost' ? { backgroundColor: 'var(--bg-hover)' } : {}),
        }
      : {}),
    ...style,
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={computedStyle}
      onMouseEnter={(e) => {
        setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        onMouseLeave?.(e);
      }}
    >
      {loading && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="30 10" />
        </svg>
      )}
      {icon && !loading && icon}
      {children}
    </button>
  );
}
