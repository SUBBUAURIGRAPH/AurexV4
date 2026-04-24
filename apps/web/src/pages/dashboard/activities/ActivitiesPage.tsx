import { useState } from 'react';
import {
  useActivities,
  useMethodologies,
  useCreateActivity,
  type ActivityStatus,
  type CreditingPeriodType,
} from '../../../hooks/useActivities';
import { useToast } from '../../../contexts/ToastContext';

const STATUS_COLORS: Record<ActivityStatus, { bg: string; color: string }> = {
  DRAFT: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
  SUBMITTED: { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6' },
  VALIDATING: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  VALIDATED: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  AWAITING_HOST: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' },
  REGISTERED: { bg: 'rgba(16,185,129,0.1)', color: '#10b981' },
  ISSUING: { bg: 'rgba(26,93,61,0.1)', color: '#1a5d3d' },
  CLOSED: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280' },
  REJECTED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
};

function Badge({ status }: { status: ActivityStatus }) {
  const s = STATUS_COLORS[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        padding: '0.2rem 0.625rem',
        borderRadius: '9999px',
        fontSize: '0.6875rem',
        fontWeight: 700,
        backgroundColor: s.bg,
        color: s.color,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
      }}
    >
      {status}
    </span>
  );
}

export function ActivitiesPage() {
  const { data: activities, isLoading } = useActivities();
  const { data: methodologies } = useMethodologies();
  const createActivity = useCreateActivity();
  const { success, error } = useToast();
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    methodologyId: '',
    title: '',
    hostCountry: 'IN',
    sectoralScope: 1,
    technologyType: '',
    gasesCovered: ['CO2'] as string[],
    creditingPeriodType: 'FIXED_10YR' as CreditingPeriodType,
    isRemoval: false,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createActivity.mutate(form, {
      onSuccess: () => {
        success(`Activity "${form.title}" created`);
        setShowForm(false);
        setForm({ ...form, title: '', technologyType: '' });
      },
      onError: (e: Error) => error(e.message),
    });
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Article 6.4 Activities
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
            Project-level mitigation activities under the Paris Agreement Crediting Mechanism (PACM).
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '0.5rem 1rem',
            background: '#1a5d3d',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            fontFamily: 'inherit',
          }}
        >
          {showForm ? 'Cancel' : '+ New Activity'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          style={{
            background: 'var(--bg-card)',
            padding: '1.25rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-primary)',
            marginBottom: '1.5rem',
            display: 'grid',
            gap: '0.875rem',
            gridTemplateColumns: 'repeat(2, 1fr)',
          }}
        >
          <label style={{ gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Title *</div>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </label>
          <label>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Methodology *</div>
            <select
              required
              value={form.methodologyId}
              onChange={(e) => setForm({ ...form, methodologyId: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">— select —</option>
              {methodologies?.data.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Host country (ISO-2)</div>
            <input
              required
              maxLength={2}
              value={form.hostCountry}
              onChange={(e) => setForm({ ...form, hostCountry: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </label>
          <label>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Sectoral scope (1–15)</div>
            <input
              type="number"
              min={1}
              max={15}
              value={form.sectoralScope}
              onChange={(e) => setForm({ ...form, sectoralScope: parseInt(e.target.value, 10) })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </label>
          <label>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Technology type</div>
            <input
              required
              value={form.technologyType}
              onChange={(e) => setForm({ ...form, technologyType: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </label>
          <label>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.25rem' }}>Crediting period</div>
            <select
              value={form.creditingPeriodType}
              onChange={(e) => setForm({ ...form, creditingPeriodType: e.target.value as CreditingPeriodType })}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border-primary)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <option value="RENEWABLE_5YR">Renewable 5-year (max 15yr)</option>
              <option value="FIXED_10YR">Fixed 10-year</option>
              <option value="REMOVAL_15YR">Removal 15-year (max 45yr)</option>
            </select>
          </label>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', gridColumn: 'span 2', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              checked={form.isRemoval}
              onChange={(e) => setForm({ ...form, isRemoval: e.target.checked })}
            />
            <span style={{ fontSize: '0.8125rem' }}>Removal activity (triggers reversal-risk buffer pool requirements)</span>
          </label>
          <button
            type="submit"
            disabled={createActivity.isPending}
            style={{
              gridColumn: 'span 2',
              padding: '0.625rem',
              background: '#1a5d3d',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            {createActivity.isPending ? 'Creating…' : 'Create Activity'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : activities && activities.data.length > 0 ? (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Title</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Host</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Methodology</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Crediting</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {activities.data.map((a) => (
                <tr key={a.id} style={{ borderTop: '1px solid var(--border-primary)' }}>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {a.title}
                    {a.isRemoval && <span style={{ marginLeft: '0.5rem', fontSize: '0.6875rem', color: '#10b981' }}>(removal)</span>}
                    {a.cdmTransition && <span style={{ marginLeft: '0.5rem', fontSize: '0.6875rem', color: '#f59e0b' }}>(CDM transition)</span>}
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{a.hostCountry}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{a.methodology?.code ?? '—'}</td>
                  <td style={{ padding: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{a.creditingPeriodType.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <Badge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)', border: '1px dashed var(--border-primary)', borderRadius: '0.75rem' }}>
          No activities yet. Create your first Article 6.4 activity above.
        </div>
      )}
    </div>
  );
}
