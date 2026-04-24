import { useCreditAccounts } from '../../../hooks/useCredits';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ACTIVITY_PARTICIPANT: 'Activity participant',
  HOST_PARTY: 'Host Party',
  ADAPTATION_FUND: 'Adaptation Fund (SOP)',
  OMGE_CANCELLATION: 'OMGE cancellation',
  REVERSAL_BUFFER: 'Reversal buffer',
  RETIREMENT_NDC: 'Retirement — NDC',
  RETIREMENT_OIMP: 'Retirement — OIMP',
  RETIREMENT_VOLUNTARY: 'Retirement — voluntary',
};

export function CreditsPage() {
  const { data, isLoading, error } = useCreditAccounts();

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Credits & Registry
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
          A6.4ER holdings across your activity participant accounts. 5% SOP is levied to the Adaptation
          Fund and 2% OMGE is cancelled at issuance — net 93% lands here.
        </p>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>Loading…</div>
      ) : error ? (
        <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239,68,68,0.08)', borderRadius: '0.5rem' }}>
          {(error as Error).message}
        </div>
      ) : data && data.data.length > 0 ? (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {data.data.map((acc) => (
            <div
              key={acc.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-primary)',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {acc.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                  {ACCOUNT_TYPE_LABELS[acc.accountType] ?? acc.accountType}
                  {acc.hostCountry ? ` • ${acc.hostCountry}` : ''}
                  {acc.activity ? ` • ${acc.activity.title}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1a5d3d' }}>
                  {acc._count?.holdings ?? 0} block{acc._count?.holdings === 1 ? '' : 's'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)', border: '1px dashed var(--border-primary)', borderRadius: '0.75rem' }}>
          No credit accounts yet. Create an Article 6.4 activity to provision your first participant account.
        </div>
      )}
    </div>
  );
}
