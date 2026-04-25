/**
 * AAT-ν / AV4-356 — Public BioCarbon token detail (B13 + B14).
 *
 * NO-AUTH. Backed by GET /api/v1/biocarbon/tokens/:bcrSerialId.
 * 404 path renders an RFC-7807-aware "not found" card.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import {
  buildExplorerUrl,
  useTokenDetail,
  type TokenDetailDto,
  type TransactionEvent,
  type TransactionEventType,
} from '../../hooks/useBiocarbon';

type TabKey = 'overview' | 'history' | 'compliance';

const COMPLIANCE_DISCLOSURE =
  'This token is a 1:1 representation of a BioCarbon Verified Carbon Credit (VCC) issued under the BioCarbon Standard. The underlying VCC is locked on the BioCarbon Registry for the lifetime of this token.';

function statusVariant(status: TokenDetailDto['status']) {
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

export function TokenDetailPage() {
  const { bcrSerialId } = useParams<{ bcrSerialId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [isNarrow, setIsNarrow] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 720 : false,
  );

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 720);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { data, isLoading, error } = useTokenDetail(bcrSerialId);

  if (isLoading) {
    return <DetailSkeleton />;
  }

  if (error) {
    const apiErr = error as ApiError;
    if (apiErr && apiErr.status === 404) {
      return <NotFoundCard onBack={() => navigate('/biocarbon/marketplace')} serial={bcrSerialId} />;
    }
    return <DetailErrorPanel onBack={() => navigate('/biocarbon/marketplace')} message={apiErr?.message} />;
  }

  if (!data) {
    return <DetailSkeleton />;
  }

  const sv = statusVariant(data.status);
  const tabs: Array<{ key: TabKey; label: string; count?: number }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'history', label: 'Transaction history', count: data.transactionHistory.length },
    { key: 'compliance', label: 'Compliance' },
  ];

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border-primary)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => navigate('/biocarbon/marketplace')}
          style={{
            alignSelf: 'flex-start',
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--text-tertiary)',
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          ← Back to marketplace
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontSize: '1.875rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              flex: 1,
              minWidth: '14rem',
            }}
          >
            {data.projectTitle}
          </h1>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '9999px',
              backgroundColor: sv.bg,
              color: sv.fg,
            }}
          >
            {sv.label}
          </span>
          <BiocarbonBadge />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-tertiary)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {data.bcrSerialId}
          </span>
          {data.projectPageUrl && (
            <a
              href={data.projectPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '0.375rem 0.875rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#1a5d3d',
                border: '1.5px solid #1a5d3d',
                borderRadius: '0.5rem',
                textDecoration: 'none',
              }}
            >
              View project page ↗
            </a>
          )}
        </div>
      </header>

      {/* Tabs / accordion */}
      {isNarrow ? (
        <Accordion data={data} tabs={tabs} />
      ) : (
        <>
          <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
          <div style={{ marginTop: '1.5rem' }}>
            {activeTab === 'overview' && <OverviewTab data={data} />}
            {activeTab === 'history' && <HistoryTab events={data.transactionHistory} />}
            {activeTab === 'compliance' && <ComplianceTab data={data} />}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-views ─────────────────────────────────────────────────────────────

function BiocarbonBadge() {
  return (
    <span
      data-testid="biocarbon-attribution-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.25rem 0.75rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        backgroundColor: 'rgba(26, 93, 61, 0.08)',
        color: '#1a5d3d',
        borderRadius: '9999px',
        border: '1px solid rgba(26, 93, 61, 0.18)',
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6" />
      </svg>
      BioCarbon
    </span>
  );
}

function TabBar({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{ key: TabKey; label: string; count?: number }>;
  activeTab: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <div
      role="tablist"
      style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', gap: 0 }}
    >
      {tabs.map((t) => {
        const active = t.key === activeTab;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            style={{
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              fontWeight: active ? 700 : 500,
              fontFamily: 'inherit',
              color: active ? '#1a5d3d' : 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: active ? '2px solid #1a5d3d' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {t.label}
            {t.count !== undefined && (
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '0.0625rem 0.4375rem',
                  borderRadius: '9999px',
                  backgroundColor: active ? '#1a5d3d' : 'var(--bg-secondary)',
                  color: active ? '#fff' : 'var(--text-tertiary)',
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Accordion({
  data,
  tabs,
}: {
  data: TokenDetailDto;
  tabs: Array<{ key: TabKey; label: string; count?: number }>;
}) {
  const [open, setOpen] = useState<TabKey | null>('overview');
  const renderBody = (k: TabKey) => {
    if (k === 'overview') return <OverviewTab data={data} />;
    if (k === 'history') return <HistoryTab events={data.transactionHistory} />;
    return <ComplianceTab data={data} />;
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {tabs.map((t) => {
        const isOpen = open === t.key;
        return (
          <section
            key={t.key}
            style={{
              border: '1px solid var(--border-primary)',
              borderRadius: '0.625rem',
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setOpen(isOpen ? null : t.key)}
              aria-expanded={isOpen}
              style={{
                width: '100%',
                padding: '0.875rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card)',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <span>
                {t.label}
                {t.count !== undefined ? ` (${t.count})` : ''}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen && <div style={{ padding: '1rem', borderTop: '1px solid var(--border-primary)' }}>{renderBody(t.key)}</div>}
          </section>
        );
      })}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: TokenDetailDto }) {
  return (
    <section data-testid="overview-tab" style={{ display: 'grid', gap: '1.5rem' }}>
      <Carousel images={data.projectVisuals} alt={data.projectTitle} />

      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
          About the project
        </h2>
        <p style={{ margin: 0, lineHeight: 1.65, color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          {data.projectDescription ?? 'No project description provided yet.'}
        </p>
      </div>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          margin: 0,
        }}
      >
        <DetailField label="Methodology">
          {data.methodology.referenceUrl ? (
            <a href={data.methodology.referenceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1a5d3d', fontWeight: 600 }}>
              {data.methodology.code}
            </a>
          ) : (
            <span>{data.methodology.code}</span>
          )}
          <small style={{ display: 'block', color: 'var(--text-tertiary)', fontSize: '0.75rem', marginTop: '0.125rem' }}>
            {data.methodology.name} · v{data.methodology.version}
          </small>
        </DetailField>
        <DetailField label="Vintage">{data.vintage}</DetailField>
        <DetailField label="Tonnes">{data.tonnes.toLocaleString()} tCO₂e</DetailField>
        <DetailField label="Host country">{data.hostCountry}</DetailField>
        <DetailField label="Serial ID">
          <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{data.bcrSerialId}</code>
        </DetailField>
        {data.bcrLockId && (
          <DetailField label="Lock ID">
            <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{data.bcrLockId}</code>
          </DetailField>
        )}
        {data.tokenizationContractId && (
          <DetailField label="Token contract">
            <code style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}>{data.tokenizationContractId}</code>
          </DetailField>
        )}
        {data.mintedAt && <DetailField label="Minted">{formatDate(data.mintedAt)}</DetailField>}
      </dl>
    </section>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-tertiary)',
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </dt>
      <dd style={{ margin: 0, fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 500 }}>{children}</dd>
    </div>
  );
}

function Carousel({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  if (images.length === 0) {
    return (
      <div
        style={{
          aspectRatio: '16 / 7',
          background: 'linear-gradient(135deg, rgba(26, 93, 61, 0.18), rgba(16, 185, 129, 0.18))',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(26, 93, 61, 0.6)',
        }}
        aria-hidden="true"
      >
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
          <path d="M2 21c0-3 1.85-5.36 5.08-6" />
        </svg>
      </div>
    );
  }
  const safeIdx = ((idx % images.length) + images.length) % images.length;
  return (
    <div style={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden' }}>
      <img
        src={images[safeIdx]}
        alt={`${alt} — image ${safeIdx + 1} of ${images.length}`}
        style={{ width: '100%', aspectRatio: '16 / 7', objectFit: 'cover', display: 'block' }}
      />
      {images.length > 1 && (
        <>
          <button
            onClick={() => setIdx(safeIdx - 1)}
            aria-label="Previous image"
            style={carouselArrow('left')}
          >
            ‹
          </button>
          <button
            onClick={() => setIdx(safeIdx + 1)}
            aria-label="Next image"
            style={carouselArrow('right')}
          >
            ›
          </button>
          <div
            style={{
              position: 'absolute',
              bottom: '0.625rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '0.25rem',
            }}
          >
            {images.map((_, i) => (
              <span
                key={i}
                style={{
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  backgroundColor: i === safeIdx ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function carouselArrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: '0.625rem',
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    color: '#fff',
    fontSize: '1.25rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties;
}

// ── History ───────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<TransactionEventType, string> = {
  MINT: 'Minted',
  TRANSFER: 'Transferred',
  DELIST: 'Delist requested',
  RETIREMENT: 'Retired',
};

function HistoryTab({ events }: { events: TransactionEvent[] }) {
  if (events.length === 0) {
    return (
      <div
        data-testid="history-empty"
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          border: '1px dashed var(--border-primary)',
          borderRadius: '0.625rem',
          fontSize: '0.875rem',
        }}
      >
        No on-chain events recorded for this token yet.
      </div>
    );
  }
  return (
    <ol
      data-testid="history-tab"
      style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      {events.map((ev, i) => (
        <li
          key={`${ev.type}-${ev.occurredAt}-${i}`}
          style={{
            border: '1px solid var(--border-primary)',
            borderRadius: '0.625rem',
            padding: '0.875rem 1rem',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
              {EVENT_LABELS[ev.type] ?? ev.type}
              {ev.units !== undefined ? ` · ${ev.units.toLocaleString()} tCO₂e` : ''}
            </span>
            <time
              dateTime={ev.occurredAt}
              style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            >
              {formatDate(ev.occurredAt)}
            </time>
          </div>
          {ev.narrative && (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {ev.narrative}
            </p>
          )}
          {ev.retirementPurpose && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Retirement purpose: <strong>{ev.retirementPurpose}</strong>
              {ev.beneficiaryRefHash ? ` · ref ${ev.beneficiaryRefHash.slice(0, 12)}…` : ''}
            </p>
          )}
          {ev.txHash && (
            <a
              href={buildExplorerUrl(ev.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.75rem',
                color: '#1a5d3d',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-all',
              }}
            >
              tx · {ev.txHash} ↗
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

// ── Compliance ────────────────────────────────────────────────────────────

function ComplianceTab({ data }: { data: TokenDetailDto }) {
  return (
    <section data-testid="compliance-tab" style={{ display: 'grid', gap: '1.25rem' }}>
      <dl style={{ display: 'grid', gap: '1rem', margin: 0 }}>
        <DetailField label="Methodology code">{data.methodology.code}</DetailField>
        <DetailField label="Methodology version">{data.methodology.version}</DetailField>
        <DetailField label="Methodology name">{data.methodology.name}</DetailField>
        {data.methodology.referenceUrl && (
          <DetailField label="BCR reference">
            <a
              data-testid="bcr-reference-link"
              href={data.methodology.referenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1a5d3d', fontWeight: 600, wordBreak: 'break-all' }}
            >
              {data.methodology.referenceUrl}
            </a>
          </DetailField>
        )}
      </dl>

      <div
        data-testid="compliance-attribution-block"
        style={{
          padding: '1rem 1.125rem',
          borderRadius: '0.625rem',
          border: '1px solid rgba(26, 93, 61, 0.2)',
          backgroundColor: 'rgba(26, 93, 61, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <BiocarbonBadge />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            BCR §5.5 Step 9 disclosure
          </span>
        </div>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {COMPLIANCE_DISCLOSURE}
        </p>
        <a
          href={data.biocarbonAttribution.registryUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.8125rem', color: '#1a5d3d', fontWeight: 600 }}
        >
          {data.biocarbonAttribution.attribution} ↗
        </a>
      </div>
    </section>
  );
}

// ── States ────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div data-testid="detail-skeleton" style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ height: '1rem', width: '8rem', borderRadius: '0.25rem', backgroundColor: 'var(--bg-secondary)', marginBottom: '1rem' }} />
      <div style={{ height: '2rem', width: '60%', borderRadius: '0.375rem', backgroundColor: 'var(--bg-secondary)', marginBottom: '1.5rem' }} />
      <div style={{ aspectRatio: '16 / 7', backgroundColor: 'var(--bg-secondary)', borderRadius: '0.75rem', marginBottom: '1.5rem' }} />
      <div style={{ height: '1rem', width: '80%', borderRadius: '0.25rem', backgroundColor: 'var(--bg-secondary)', marginBottom: '0.5rem' }} />
      <div style={{ height: '1rem', width: '50%', borderRadius: '0.25rem', backgroundColor: 'var(--bg-secondary)' }} />
    </div>
  );
}

function NotFoundCard({ onBack, serial }: { onBack: () => void; serial?: string }) {
  return (
    <div style={{ maxWidth: '720px', margin: '4rem auto', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
      <div
        data-testid="token-not-found"
        style={{
          padding: '2.5rem 1.5rem',
          border: '1px dashed var(--border-primary)',
          borderRadius: '0.875rem',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Token not found
        </h2>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          We couldn't find a BioCarbon token with serial{' '}
          {serial ? <code>{serial}</code> : 'this identifier'}. It may not be tokenised yet, or the
          serial may be incorrect.
        </p>
        <button
          onClick={onBack}
          style={{
            padding: '0.625rem 1.5rem',
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
          Back to marketplace
        </button>
      </div>
    </div>
  );
}

function DetailErrorPanel({ onBack, message }: { onBack: () => void; message?: string }) {
  return (
    <div style={{ maxWidth: '720px', margin: '4rem auto', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
      <div
        data-testid="detail-error"
        style={{
          padding: '2.5rem 1.5rem',
          border: '1px dashed #ef4444',
          borderRadius: '0.875rem',
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 700, color: '#dc2626' }}>
          Couldn't load token
        </h2>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
          {message ?? 'An unexpected error occurred while loading this token.'}
        </p>
        <button
          onClick={onBack}
          style={{
            padding: '0.625rem 1.5rem',
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
          Back to marketplace
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
