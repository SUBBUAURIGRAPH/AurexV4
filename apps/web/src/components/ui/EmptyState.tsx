import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    textAlign: 'center',
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '48px',
    width: '48px',
    height: '48px',
    color: 'var(--text-tertiary)',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem 0',
  };

  const descriptionStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    margin: '0 0 1.5rem 0',
    maxWidth: '24rem',
    lineHeight: 1.5,
  };

  return (
    <div style={containerStyle}>
      {icon && <div style={iconStyle}>{icon}</div>}
      <h3 style={titleStyle}>{title}</h3>
      {description && <p style={descriptionStyle}>{description}</p>}
      {action && (
        <Button variant="primary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
