import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import {
  usePendingOrgApprovals,
  useApproveOrg,
  useRejectOrg,
  type OrgApprovalRow,
} from '../../../hooks/useOrgApproval';
import { useToast } from '../../../contexts/ToastContext';

/**
 * FLOW-REWORK / Sprint 5 — admin org-approvals queue.
 * SUPER_ADMIN-only review of self-service org registrations.
 */
export function OrgApprovalsPage() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading, error } = usePendingOrgApprovals(showAll);
  const approve = useApproveOrg();
  const reject = useRejectOrg();
  const { success: toastSuccess, error: toastError } = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const rows = data?.data ?? [];

  const handleApprove = async (orgId: string, name: string) => {
    try {
      await approve.mutateAsync(orgId);
      toastSuccess(`Approved ${name}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  const handleReject = async (orgId: string, name: string) => {
    if (!rejectReason.trim()) {
      toastError('Rejection reason required');
      return;
    }
    try {
      await reject.mutateAsync({ orgId, reason: rejectReason.trim() });
      toastSuccess(`Rejected ${name}`);
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Reject failed');
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
            Organisation approvals
          </h1>
          <p
            style={{
              color: 'var(--text-tertiary)',
              fontSize: '0.875rem',
              margin: '0.25rem 0 0',
            }}
          >
            Review self-service registrations. Approving unblocks regulatory writes for the org.
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Show all (incl. approved/rejected)
        </label>
      </div>

      {isLoading && <Card padding="lg">Loading…</Card>}
      {error && (
        <Card padding="lg">
          <span style={{ color: '#dc2626' }}>Failed to load approvals.</span>
        </Card>
      )}

      {!isLoading && rows.length === 0 && (
        <Card padding="lg">
          <p style={{ margin: 0, color: 'var(--text-tertiary)' }}>
            {showAll ? 'No organisations registered yet.' : 'No pending registrations. ✓'}
          </p>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {rows.map((row) => (
          <ApprovalRow
            key={row.id}
            row={row}
            onApprove={() => handleApprove(row.id, row.name)}
            isPending={approve.isPending || reject.isPending}
            rejectingId={rejectingId}
            rejectReason={rejectReason}
            setRejectingId={setRejectingId}
            setRejectReason={setRejectReason}
            onConfirmReject={() => handleReject(row.id, row.name)}
          />
        ))}
      </div>
    </div>
  );
}

function ApprovalRow({
  row,
  onApprove,
  isPending,
  rejectingId,
  rejectReason,
  setRejectingId,
  setRejectReason,
  onConfirmReject,
}: {
  row: OrgApprovalRow;
  onApprove: () => void;
  isPending: boolean;
  rejectingId: string | null;
  rejectReason: string;
  setRejectingId: (id: string | null) => void;
  setRejectReason: (s: string) => void;
  onConfirmReject: () => void;
}) {
  const isReviewing = rejectingId === row.id;

  const badgeBg =
    row.approvalStatus === 'PENDING_REVIEW'
      ? 'rgba(251,191,36,0.15)'
      : row.approvalStatus === 'APPROVED'
        ? 'rgba(16,185,129,0.15)'
        : 'rgba(220,38,38,0.15)';
  const badgeColor =
    row.approvalStatus === 'PENDING_REVIEW'
      ? '#f59e0b'
      : row.approvalStatus === 'APPROVED'
        ? '#10b981'
        : '#dc2626';

  return (
    <Card padding="lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{row.name}</h3>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.125rem 0.5rem',
                borderRadius: '0.25rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                backgroundColor: badgeBg,
                color: badgeColor,
              }}
            >
              {row.approvalStatus.replace('_', ' ')}
            </span>
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
            slug: <code>{row.slug}</code>
            {' · '}
            {row.parentOrgId ? `subsidiary of ${row.parentOrgId.slice(0, 8)}…` : 'top-level'}
            {' · '}
            requested {row.approvalRequestedAt
              ? new Date(row.approvalRequestedAt).toLocaleString()
              : '—'}
          </div>
          {row.registeredBy && (
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Registered by:{' '}
              <strong>{row.registeredBy.name}</strong>{' '}
              <span style={{ color: 'var(--text-tertiary)' }}>({row.registeredBy.email})</span>
            </div>
          )}
          {row.rejectedReason && (
            <div
              style={{
                fontSize: '0.8125rem',
                color: '#dc2626',
                marginTop: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(220,38,38,0.06)',
                borderRadius: '0.375rem',
              }}
            >
              <strong>Rejected:</strong> {row.rejectedReason}
            </div>
          )}
        </div>
        {row.approvalStatus === 'PENDING_REVIEW' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '180px' }}>
            <Button onClick={onApprove} disabled={isPending}>
              ✓ Approve
            </Button>
            <Button variant="secondary" onClick={() => setRejectingId(row.id)} disabled={isPending}>
              Reject…
            </Button>
          </div>
        )}
      </div>

      {isReviewing && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-primary)', borderRadius: '0.5rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Rejection reason</span>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="The user will see this. e.g. 'Org name conflicts with an existing tenant; please re-register with a unique name.'"
              maxLength={1000}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--border-primary)',
                fontSize: '0.875rem',
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                resize: 'vertical',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button onClick={onConfirmReject} disabled={isPending || !rejectReason.trim()}>
              Confirm reject
            </Button>
            <Button variant="secondary" onClick={() => { setRejectingId(null); setRejectReason(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
