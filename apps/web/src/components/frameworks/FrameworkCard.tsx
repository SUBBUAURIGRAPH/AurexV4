import { useNavigate } from 'react-router-dom';
import type { EsgFramework } from '../../hooks/useFrameworks';

interface FrameworkCardProps {
  framework: EsgFramework;
  isMapped: boolean;
  onMap: () => void;
  onUnmap: () => void;
  isPending: boolean;
  canManage: boolean;
}

export function FrameworkCard({ framework, isMapped, onMap, onUnmap, isPending, canManage }: FrameworkCardProps) {
  const navigate = useNavigate();

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-card)',
        border: `1px solid ${isMapped ? '#1a5d3d' : 'var(--border-primary)'}`,
        borderRadius: '0.75rem',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        position: 'relative',
        transition: 'all 150ms',
      }}
    >
      {isMapped && (
        <span
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            fontSize: '0.6875rem', fontWeight: 700,
            padding: '0.2rem 0.625rem', borderRadius: '9999px',
            backgroundColor: 'rgba(16,185,129,0.12)', color: '#10b981',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}
        >
          Mapped
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <span
          style={{
            fontSize: '0.75rem', fontWeight: 700,
            padding: '0.25rem 0.625rem', borderRadius: '0.375rem',
            backgroundColor: '#1a5d3d', color: '#fff',
            letterSpacing: '0.03em',
          }}
        >
          {framework.code}
        </span>
        {framework.version && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
            v{framework.version}
          </span>
        )}
      </div>

      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: 1.3 }}>
        {framework.name}
      </h3>

      {framework.description && (
        <p style={{
          fontSize: '0.8125rem', color: 'var(--text-secondary)',
          margin: 0, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {framework.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
        <button
          onClick={() => navigate(`/frameworks/${framework.id}`)}
          style={{
            flex: 1,
            padding: '0.4375rem 0.75rem', borderRadius: '0.5rem',
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          View Indicators
        </button>
        {canManage && (
          <button
            onClick={isMapped ? onUnmap : onMap}
            disabled={isPending}
            style={{
              flex: 1,
              padding: '0.4375rem 0.75rem', borderRadius: '0.5rem',
              border: isMapped ? '1px solid #ef4444' : 'none',
              background: isMapped ? 'transparent' : '#1a5d3d',
              color: isMapped ? '#ef4444' : '#fff',
              fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
              cursor: 'pointer',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            {isPending ? '...' : isMapped ? 'Unmap' : 'Map to Org'}
          </button>
        )}
      </div>
    </div>
  );
}
