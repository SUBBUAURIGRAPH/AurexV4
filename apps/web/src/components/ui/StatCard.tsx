import React from 'react';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
  color?: string;
}

export function StatCard({ label, value, icon, trend, color = '#1a5d3d' }: StatCardProps) {
  return (
    <Card padding="md" hover>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-tertiary)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {value}
          </p>
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: trend.positive ? '#22c55e' : '#ef4444' }}>
                {trend.positive ? '\u2191' : '\u2193'} {trend.value}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>vs last month</span>
            </div>
          )}
        </div>
        <div
          style={{
            width: '3rem',
            height: '3rem',
            borderRadius: '0.75rem',
            backgroundColor: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
