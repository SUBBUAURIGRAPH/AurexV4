import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFramework, useOrgFrameworkMappings, useMapFramework, useUnmapFramework, type EsgIndicator } from '../../../hooks/useFrameworks';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

interface IndicatorSectionProps {
  category: string;
  indicators: Array<{ id: string; code: string; title: string; description: string | null }>;
  open: boolean;
  onToggle: () => void;
}

function IndicatorSection({ category, indicators, open, onToggle }: IndicatorSectionProps) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      borderRadius: '0.75rem',
      overflow: 'hidden',
      marginBottom: '0.75rem',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {category}
          </span>
          <span style={{
            fontSize: '0.75rem', fontWeight: 600,
            padding: '0.15rem 0.5rem', borderRadius: '9999px',
            backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)',
          }}>
            {indicators.length}
          </span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ color: 'var(--text-tertiary)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-primary)' }}>
          {indicators.map((ind, i) => (
            <div
              key={ind.id}
              style={{
                padding: '0.875rem 1.25rem',
                borderBottom: i < indicators.length - 1 ? '1px solid var(--border-primary)' : 'none',
                backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', marginBottom: '0.25rem' }}>
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700,
                  padding: '0.125rem 0.4375rem', borderRadius: '0.25rem',
                  backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  whiteSpace: 'nowrap',
                }}>
                  {ind.code}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {ind.title}
                </span>
              </div>
              {ind.description && (
                <p style={{
                  fontSize: '0.8125rem', color: 'var(--text-secondary)',
                  margin: '0.375rem 0 0', lineHeight: 1.5,
                }}>
                  {ind.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FrameworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useFramework(id ?? null);
  const { data: mappings } = useOrgFrameworkMappings();
  const map = useMapFramework();
  const unmap = useUnmapFramework();
  const { success: toastSuccess, error: toastError } = useToast();
  const { user } = useAuth();

  const canManage = ['org_admin', 'super_admin', 'administrator'].includes(user?.role ?? '');

  const framework = data?.data;
  const isMapped = useMemo(
    () => !!id && (mappings?.data ?? []).some((f) => f.id === id),
    [id, mappings],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, EsgIndicator[]>();
    if (!framework) return m;
    for (const ind of framework.indicators) {
      const key = ind.category ?? 'General';
      const existing = m.get(key);
      if (existing) existing.push(ind);
      else m.set(key, [ind]);
    }
    return m;
  }, [framework]);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const toggle = (cat: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleAll = () => {
    if (openSections.size === grouped.size) setOpenSections(new Set());
    else setOpenSections(new Set(grouped.keys()));
  };

  if (isLoading) {
    return <p style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading…</p>;
  }

  if (error || !framework) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', fontWeight: 600 }}>Framework not found</p>
        <button
          onClick={() => navigate('/frameworks')}
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' }}
        >
          Back to Frameworks
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/frameworks')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.8125rem', color: 'var(--text-tertiary)',
          fontFamily: 'inherit', padding: '0.375rem 0',
          marginBottom: '0.75rem',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Frameworks
      </button>

      {/* Header */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
              <span style={{
                fontSize: '0.8125rem', fontWeight: 700,
                padding: '0.25rem 0.75rem', borderRadius: '0.375rem',
                backgroundColor: '#1a5d3d', color: '#fff',
              }}>
                {framework.code}
              </span>
              {framework.version && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  v{framework.version}
                </span>
              )}
              {isMapped && (
                <span style={{
                  fontSize: '0.6875rem', fontWeight: 700,
                  padding: '0.2rem 0.625rem', borderRadius: '9999px',
                  backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Mapped
                </span>
              )}
            </div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
              {framework.name}
            </h1>
            {framework.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {framework.description}
              </p>
            )}
          </div>

          {canManage && (
            <button
              onClick={() => {
                const action = isMapped ? unmap : map;
                action.mutate(framework.id, {
                  onSuccess: () => toastSuccess(isMapped ? 'Framework unmapped' : 'Framework mapped to organisation'),
                  onError: (e: Error) => toastError(e.message),
                });
              }}
              disabled={map.isPending || unmap.isPending}
              style={{
                padding: '0.5rem 1rem', borderRadius: '0.5rem',
                border: isMapped ? '1px solid #ef4444' : 'none',
                background: isMapped ? 'transparent' : '#1a5d3d',
                color: isMapped ? '#ef4444' : '#fff',
                fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {isMapped ? 'Unmap from Org' : 'Map to Organisation'}
            </button>
          )}
        </div>
      </div>

      {/* Indicators */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Indicators ({framework.indicators.length})
        </h2>
        {grouped.size > 1 && (
          <button
            onClick={toggleAll}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '0.8125rem', color: '#1a5d3d', fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            {openSections.size === grouped.size ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {framework.indicators.length === 0 ? (
        <div style={{
          padding: '2rem', textAlign: 'center',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-primary)',
          borderRadius: '0.75rem',
          color: 'var(--text-tertiary)',
          fontSize: '0.875rem',
        }}>
          No indicators have been defined for this framework.
        </div>
      ) : (
        Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, indicators]) => (
            <IndicatorSection
              key={category}
              category={category}
              indicators={indicators}
              open={openSections.has(category)}
              onToggle={() => toggle(category)}
            />
          ))
      )}
    </div>
  );
}
