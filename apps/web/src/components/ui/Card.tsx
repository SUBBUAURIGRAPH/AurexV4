import React from 'react';

interface CardProps {
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}

const paddingMap = {
  none: '0',
  sm: '1rem',
  md: '1.5rem',
  lg: '2rem',
};

export function Card({ children, padding = 'md', hover = false, style, className, onClick }: CardProps) {
  const [hovered, setHovered] = React.useState(false);

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: '0.75rem',
    padding: paddingMap[padding],
    boxShadow: 'var(--shadow-sm)',
    transition: 'all 200ms ease',
    ...(hover && hovered
      ? {
          boxShadow: 'var(--shadow-lg)',
          transform: 'translateY(-2px)',
          borderColor: 'var(--border-secondary)',
        }
      : {}),
    ...(onClick ? { cursor: 'pointer' } : {}),
    ...style,
  };

  return (
    <div
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  );
}
