/**
 * AAT-ν / AV4-356 — Public BioCarbon marketplace listing (B14).
 *
 * NO-AUTH. Backed by GET /api/v1/biocarbon/marketplace.
 * Every card carries the B13 BioCarbon attribution badge — non-optional
 * binding requirement.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BCR_METHODOLOGIES,
  STATUS_OPTIONS,
  useMarketplace,
  type ListingDto,
  type MarketplaceQuery,
  type PublicListingStatus,
} from '../../hooks/useBiocarbon';

const PAGE_SIZE = 24;
const DEBOUNCE_MS = 300;

interface FilterState {
  methodologyCode: string;
  vintage: number | undefined;
  statuses: PublicListingStatus[];
  search: string;
}

const INITIAL_FILTERS: FilterState = {
  methodologyCode: '',
  vintage: undefined,
  statuses: [],
  search: '',
};

const CURRENT_YEAR = new Date().getFullYear();

function statusVariant(status: PublicListingStatus): {
  bg: string;
  fg: string;
  label: string;
} {
  switch (status) {
    case 'MINTED':
      return { bg: 'rgba(34, 197, 94, 0.12)', fg: '#16a34a', label: 'Minted' };
    case 'RETIRED':
      return { bg: 'rgba(100, 116, 139, 0.14)', fg: '#475569', label: 'Retired' };
    case 'DELISTED_IN_FLIGHT':
      return { bg: 'rgba(245, 158, 11, 0.14)', fg: '#b45309', label: 'Delist in flight' };
    default:
      return { bg: 'rgba(100, 116, 139, 0.14)', fg: '#475569', label: status };
  }
}

export function MarketplacePage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [debounced, setDebounced] = useState<FilterState>(INITIAL_FILTERS);
  const [page, setPage] = useState(1);

  // 300ms debounce on the entire filter object — single re-fetch trigger.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filters]);

  // Reset to page 1 whenever debounced filters change.
  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const query: MarketplaceQuery = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      methodologyCode: debounced.methodologyCode || undefined,
      vintage: debounced.vintage,
      // Backend supports a single status filter; if a single chip is selected
      // we forward it. If multiple are selected we hand back the first
      // (this is a UI convenience — backend would otherwise need OR support).
      status: debounced.statuses.length === 1 ? debounced.statuses[0] : undefined,
      search: debounced.search.trim() || undefined,
    }),
    [debounced, page],
  );

  const { data, isLoading, isError, refetch, isFetching } = useMarketplace(query);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const onClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const onCardClick = (serial: string) => {
    navigate(`/biocarbon/tokens/${encodeURIComponent(serial)}`);
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      {/* Hero */}
      <section style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1
          style={{
            fontSize: '2.25rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '-0.025em',
          }}
        >
          BioCarbon Tokenized Credits
        </h1>
        <p
          style={{
            maxWidth: '640px',
            margin: '1rem auto 1.5rem',
            fontSize: '1rem',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          Each listing is a 1:1 on-chain shadow of a BioCarbon Verified Carbon Credit (VCC) issued
          under the{' '}
          <a
            href="https://biocarbonstandard.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1a5d3d', fontWeight: 600 }}
          >
            BioCarbon Standard
          </a>
          . The underlying VCC stays locked on the BioCarbon Registry for the lifetime of the
          token; ICROA-aligned, publicly verifiable, immutable.
        </p>
        <div
          aria-label="Standards strip"
          style={{
            display: 'inline-flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          <span>BioCarbon Standard</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>ICROA-aligned</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>Aurigraph DLT</span>
        </div>
      </section>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Results */}
      <section style={{ marginTop: '1.5rem' }}>
        {isLoading ? (
          <SkeletonGrid />
        ) : isError ? (
          <ErrorPanel onRetry={() => refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyPanel onClear={onClearFilters} />
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: 'var(--text-tertiary)',
              }}
            >
              <span>
                {data.total} listing{data.total === 1 ? '' : 's'}
                {isFetching ? ' · refreshing…' : ''}
              </span>
            </div>
            <CardGrid items={data.items} onSelect={onCardClick} />
            {totalPages > 1 && (
              <PageBar
                page={page}
                totalPages={totalPages}
                onChange={setPage}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
}

function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        padding: '1.25rem',
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
      }}
    >
      <FilterField label="Search">
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Project title…"
          aria-label="Search by project title"
          style={inputStyle}
        />
      </FilterField>

      <FilterField label="Methodology">
        <select
          value={filters.methodologyCode}
          onChange={(e) => onChange({ ...filters, methodologyCode: e.target.value })}
          aria-label="Methodology filter"
          style={selectStyle}
        >
          <option value="">All methodologies</option>
          {BCR_METHODOLOGIES.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label={`Vintage${filters.vintage !== undefined ? ` · ${filters.vintage}` : ''}`}>
        <input
          type="range"
          min={2010}
          max={CURRENT_YEAR}
          step={1}
          value={filters.vintage ?? CURRENT_YEAR}
          onChange={(e) => onChange({ ...filters, vintage: Number(e.target.value) })}
          aria-label="Vintage year"
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
          <span>2010</span>
          <span>{CURRENT_YEAR}</span>
        </div>
        {filters.vintage !== undefined && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, vintage: undefined })}
            style={{
              alignSelf: 'flex-start',
              fontSize: '0.6875rem',
              padding: '0.125rem 0.375rem',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.25rem',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            Clear vintage
          </button>
        )}
      </FilterField>

      <FilterField label="Status">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {STATUS_OPTIONS.map((opt) => {
            const active = filters.statuses.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  const next = active
                    ? filters.statuses.filter((s) => s !== opt.value)
                    : [...filters.statuses, opt.value];
                  onChange({ ...filters, statuses: next });
                }}
                style={{
                  padding: '0.3125rem 0.625rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  border: '1px solid',
                  borderColor: active ? '#1a5d3d' : 'var(--border-primary)',
                  backgroundColor: active ? 'rgba(26, 93, 61, 0.08)' : 'transparent',
                  color: active ? '#1a5d3d' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </FilterField>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  color: 'var(--text-primary)',
  backgroundColor: 'var(--bg-input)',
  border: '1.5px solid var(--border-input)',
  borderRadius: '0.5rem',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

// ── CardGrid ──────────────────────────────────────────────────────────────

interface CardGridProps {
  items: ListingDto[];
  onSelect: (bcrSerialId: string) => void;
}

function CardGrid({ items, onSelect }: CardGridProps) {
  return (
    <div
      data-testid="marketplace-card-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {items.map((item) => (
        <ListingCard key={item.bcrSerialId} listing={item} onClick={() => onSelect(item.bcrSerialId)} />
      ))}
    </div>
  );
}

function ListingCard({ listing, onClick }: { listing: ListingDto; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const sv = statusVariant(listing.status);

  return (
    <article
      data-testid="marketplace-card"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${listing.projectTitle} — ${listing.tonnes} tonnes, ${listing.methodologyCode}`}
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.875rem',
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        transition: 'all 200ms ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ProjectVisual src={listing.projectVisual} alt={listing.projectTitle} />

      <div style={{ padding: '1rem 1.125rem 1.125rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <h3
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {listing.projectTitle}
          </h3>
          <span
            style={{
              padding: '0.1875rem 0.5rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              borderRadius: '9999px',
              backgroundColor: sv.bg,
              color: sv.fg,
              whiteSpace: 'nowrap',
            }}
          >
            {sv.label}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          <span
            style={{
              padding: '0.1875rem 0.625rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '9999px',
              backgroundColor: 'rgba(26, 93, 61, 0.08)',
              color: '#1a5d3d',
            }}
          >
            {listing.tonnes.toLocaleString()} tCO₂e
          </span>
          <span
            style={{
              padding: '0.1875rem 0.625rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '9999px',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            {listing.methodologyCode}
          </span>
          <span
            style={{
              padding: '0.1875rem 0.625rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '9999px',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            Vintage {listing.vintage}
          </span>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          {listing.hostCountry} · Serial {truncateSerial(listing.bcrSerialId)}
        </div>

        {/* B13 attribution badge — required on every card. */}
        <div
          data-testid="biocarbon-attribution-badge"
          style={{
            marginTop: 'auto',
            paddingTop: '0.625rem',
            borderTop: '1px dashed var(--border-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: '#1a5d3d',
            }}
          >
            <BioCarbonLeafIcon />
            BioCarbon
          </span>
          <a
            href={listing.projectPageUrl}
            onClick={(e) => e.stopPropagation()}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.6875rem',
              color: 'var(--text-tertiary)',
              textDecoration: 'underline',
            }}
          >
            Project page ↗
          </a>
        </div>
      </div>
    </article>
  );
}

function ProjectVisual({ src, alt }: { src?: string; alt: string }) {
  const fallbackStyle: React.CSSProperties = {
    aspectRatio: '16 / 9',
    background:
      'linear-gradient(135deg, rgba(26, 93, 61, 0.18), rgba(16, 185, 129, 0.18))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(26, 93, 61, 0.6)',
  };

  if (!src) {
    return (
      <div style={fallbackStyle} aria-hidden="true">
        <BioCarbonLeafIcon size={42} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      style={{
        width: '100%',
        aspectRatio: '16 / 9',
        objectFit: 'cover',
        display: 'block',
      }}
    />
  );
}

function BioCarbonLeafIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

function truncateSerial(s: string, max = 18): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ── States ────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  const skeletons = Array.from({ length: 6 });
  return (
    <div
      data-testid="marketplace-skeleton"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.25rem',
      }}
    >
      {skeletons.map((_, i) => (
        <div
          key={i}
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.875rem',
            overflow: 'hidden',
          }}
        >
          <div style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--bg-secondary)' }} />
          <div style={{ padding: '1rem' }}>
            <div style={{ height: '1rem', width: '70%', borderRadius: '0.25rem', backgroundColor: 'var(--bg-secondary)', marginBottom: '0.625rem' }} />
            <div style={{ height: '0.75rem', width: '90%', borderRadius: '0.25rem', backgroundColor: 'var(--bg-secondary)', marginBottom: '0.5rem' }} />
            <div style={{ height: '0.75rem', width: '40%', borderRadius: '0.25rem', backgroundColor: 'var(--bg-secondary)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      data-testid="marketplace-error"
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        border: '1px dashed #ef4444',
        borderRadius: '0.875rem',
        color: '#dc2626',
        backgroundColor: 'rgba(239, 68, 68, 0.04)',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700 }}>
        Marketplace unavailable
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
        We couldn't load the BioCarbon listings. Please try again.
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '0.5rem 1.25rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          backgroundColor: '#1a5d3d',
          color: '#fff',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}

function EmptyPanel({ onClear }: { onClear: () => void }) {
  return (
    <div
      data-testid="marketplace-empty"
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        border: '1px dashed var(--border-primary)',
        borderRadius: '0.875rem',
        color: 'var(--text-secondary)',
      }}
    >
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        No matching listings
      </h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem' }}>
        No BioCarbon-tokenized credits match these filters.
      </p>
      <button
        onClick={onClear}
        style={{
          padding: '0.5rem 1.25rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          backgroundColor: 'transparent',
          color: '#1a5d3d',
          border: '1.5px solid #1a5d3d',
          borderRadius: '0.5rem',
          cursor: 'pointer',
        }}
      >
        Clear filters
      </button>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────

function PageBar({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (n: number) => void;
}) {
  const visible = (() => {
    const out: Array<number | 'ellipsis'> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) out.push(i);
      return out;
    }
    out.push(1);
    if (page > 3) out.push('ellipsis');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) out.push(i);
    if (page < totalPages - 2) out.push('ellipsis');
    out.push(totalPages);
    return out;
  })();

  const btn = (active: boolean, disabled: boolean): React.CSSProperties => ({
    minWidth: '2rem',
    height: '2rem',
    padding: '0 0.5rem',
    borderRadius: '0.375rem',
    border: '1px solid var(--border-primary)',
    backgroundColor: active ? '#1a5d3d' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    fontFamily: 'inherit',
    fontSize: '0.8125rem',
    fontWeight: active ? 700 : 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  });

  return (
    <nav
      data-testid="marketplace-pagination"
      style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', marginTop: '2rem' }}
      aria-label="Pagination"
    >
      <button
        style={btn(false, page <= 1)}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        Prev
      </button>
      {visible.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} style={{ padding: '0 0.375rem', alignSelf: 'center', color: 'var(--text-tertiary)' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            style={btn(p === page, false)}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        style={btn(false, page >= totalPages)}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
}
