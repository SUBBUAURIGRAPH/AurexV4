import React from 'react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const pageSizeOptions = [10, 20, 50];

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 0',
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    gap: '1rem',
    flexWrap: 'wrap',
  };

  const pageButtonBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '2rem',
    height: '2rem',
    padding: '0 0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--border-primary)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  const activePageButton: React.CSSProperties = {
    ...pageButtonBase,
    backgroundColor: 'var(--brand-emerald)',
    color: '#ffffff',
    borderColor: 'var(--brand-emerald)',
    fontWeight: 600,
  };

  const disabledButton: React.CSSProperties = {
    ...pageButtonBase,
    opacity: 0.4,
    cursor: 'not-allowed',
  };

  const selectStyle: React.CSSProperties = {
    padding: '0.375rem 0.5rem',
    fontSize: '0.8125rem',
    fontFamily: 'inherit',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  };

  const navGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  };

  const rightGroupStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  return (
    <div style={containerStyle}>
      <span>
        Showing {startItem}&ndash;{endItem} of {total} results
      </span>

      <div style={navGroupStyle}>
        <button
          style={page <= 1 ? disabledButton : pageButtonBase}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          onMouseEnter={(e) => {
            if (page > 1) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            if (page > 1) e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Previous page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {getPageNumbers().map((p, idx) =>
          p === 'ellipsis' ? (
            <span
              key={`ellipsis-${idx}`}
              style={{ padding: '0 0.25rem', color: 'var(--text-tertiary)' }}
            >
              ...
            </span>
          ) : (
            <button
              key={p}
              style={p === page ? activePageButton : pageButtonBase}
              onClick={() => onPageChange(p)}
              onMouseEnter={(e) => {
                if (p !== page) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                if (p !== page) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          style={page >= totalPages ? disabledButton : pageButtonBase}
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          onMouseEnter={(e) => {
            if (page < totalPages) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            if (page < totalPages) e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="Next page"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div style={rightGroupStyle}>
        <span>Rows per page</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          style={selectStyle}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
