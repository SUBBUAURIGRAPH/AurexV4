import React from 'react';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  width?: string;
}

interface TableProps<T = Record<string, unknown>> {
  columns: TableColumn<T>[];
  data: T[];
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  loading?: boolean;
  emptyMessage?: string;
}

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} style={{ padding: '0.875rem 1.25rem' }}>
          <div
            style={{
              height: '1rem',
              width: `${50 + Math.random() * 40}%`,
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: '0.25rem',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </td>
      ))}
    </tr>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function Table<T extends Record<string, any>>({
  columns,
  data,
  sortKey,
  sortOrder,
  onSort,
  loading = false,
  emptyMessage = 'No data available',
}: TableProps<T>) {
  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.875rem',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '0.875rem 1.25rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-primary)',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const renderSortArrow = (key: string) => {
    if (sortKey !== key) {
      return (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ opacity: 0.3, marginLeft: '0.25rem', verticalAlign: 'middle' }}
        >
          <path d="M8 9l4-4 4 4" />
          <path d="M8 15l4 4 4-4" />
        </svg>
      );
    }
    return (
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }}
      >
        {sortOrder === 'asc' ? (
          <path d="M8 15l4-4 4 4" />
        ) : (
          <path d="M8 9l4 4 4-4" />
        )}
      </svg>
    );
  };

  if (!loading && data.length === 0) {
    return (
      <div
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
        }}
      >
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ margin: '0 auto 0.75rem', opacity: 0.4 }}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="3" x2="9" y2="21" />
        </svg>
        <p style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{emptyMessage}</p>
        <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
          Try adjusting your filters or add new entries.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...thStyle,
                  ...(col.sortable ? { cursor: 'pointer' } : {}),
                  ...(col.width ? { width: col.width } : {}),
                }}
                onClick={() => {
                  if (col.sortable && onSort) onSort(col.key);
                }}
              >
                {col.label}
                {col.sortable && renderSortArrow(col.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} colCount={columns.length} />
              ))
            : data.map((row, rowIndex) => (
                <tr
                  key={(row as Record<string, unknown>).id as string || rowIndex}
                  style={{
                    borderBottom:
                      rowIndex < data.length - 1
                        ? '1px solid var(--border-primary)'
                        : 'none',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = 'transparent')
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '0.875rem 1.25rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {col.render
                        ? col.render(row[col.key], row, rowIndex)
                        : (row[col.key] as React.ReactNode) ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
