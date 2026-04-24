import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';

type ExportKind = 'emissions' | 'audit-logs';

const EXPORTS: Array<{ kind: ExportKind; label: string; description: string; path: string }> = [
  {
    kind: 'emissions',
    label: 'Emissions records',
    description: 'All scope 1/2/3 emissions for your organisation in CSV format.',
    path: '/api/v1/emissions/export?includeSubsidiaries=true',
  },
  {
    kind: 'audit-logs',
    label: 'Audit log',
    description: 'Complete change history — who did what and when.',
    path: '/api/v1/audit-logs?export=csv',
  },
];

export function ExportMenu() {
  const [inFlight, setInFlight] = useState<ExportKind | null>(null);
  const { success: toastSuccess, error: toastError } = useToast();

  const handleExport = async (kind: ExportKind, path: string) => {
    setInFlight(kind);
    try {
      const token = localStorage.getItem('aurex_token');
      const res = await fetch(path, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body.slice(0, 200) || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toastSuccess(`${kind} export downloaded`);
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setInFlight(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {EXPORTS.map((exp) => (
        <div
          key={exp.kind}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            gap: '1rem',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              {exp.label}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', margin: '0.2rem 0 0' }}>
              {exp.description}
            </p>
          </div>
          <button
            onClick={() => handleExport(exp.kind, exp.path)}
            disabled={inFlight === exp.kind}
            style={{
              padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
              border: '1px solid var(--border-primary)', cursor: 'pointer',
              background: 'var(--bg-card)', color: 'var(--text-primary)',
              fontSize: '0.8125rem', fontFamily: 'inherit', fontWeight: 500,
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              whiteSpace: 'nowrap',
              opacity: inFlight === exp.kind ? 0.6 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {inFlight === exp.kind ? 'Preparing…' : 'Download CSV'}
          </button>
        </div>
      ))}
    </div>
  );
}
