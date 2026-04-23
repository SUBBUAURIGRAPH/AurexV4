import React from 'react';

interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0',
    borderBottom: '1px solid var(--border-primary)',
  };

  const getTabStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    fontSize: '0.875rem',
    fontWeight: isActive ? 600 : 400,
    fontFamily: 'inherit',
    color: isActive ? 'var(--brand-emerald)' : 'var(--text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid var(--brand-emerald)' : '2px solid transparent',
    marginBottom: '-1px',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
  });

  const countBadgeStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '1.25rem',
    height: '1.25rem',
    padding: '0 0.375rem',
    fontSize: '0.6875rem',
    fontWeight: 600,
    borderRadius: '9999px',
    backgroundColor: isActive ? 'var(--brand-emerald)' : 'var(--bg-secondary)',
    color: isActive ? '#ffffff' : 'var(--text-tertiary)',
  });

  return (
    <div style={containerStyle} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            style={getTabStyle(isActive)}
            onClick={() => onTabChange(tab.key)}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span style={countBadgeStyle(isActive)}>{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
