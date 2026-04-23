import { useState } from 'react';
import { useApprovals, useApproval, useDecideApproval, useAddApprovalComment, type ApprovalRequest } from '../../hooks/useApprovals';
import { useToast } from '../../contexts/ToastContext';

type StatusKey = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

const STATUS_STYLES: Record<StatusKey, { bg: string; color: string; label: string }> = {
  PENDING: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'Pending' },
  APPROVED: { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Approved' },
  REJECTED: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Rejected' },
  CANCELLED: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status as StatusKey] ?? STATUS_STYLES.PENDING;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '0.2rem 0.625rem', borderRadius: '9999px',
      fontSize: '0.75rem', fontWeight: 600,
      backgroundColor: s.bg, color: s.color,
    }}>
      {s.label}
    </span>
  );
}

interface DecideModalProps {
  approval: ApprovalRequest;
  action: 'APPROVED' | 'REJECTED';
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isPending: boolean;
}

function DecideModal({ approval, action, onClose, onSubmit, isPending }: DecideModalProps) {
  const [reason, setReason] = useState('');
  const isReject = action === 'REJECTED';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        boxShadow: 'var(--shadow-xl)',
        padding: '1.5rem',
        width: '480px',
        maxWidth: '90vw',
      }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
          {isReject ? 'Reject Approval Request' : 'Approve Request'}
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          {approval.resource} / {approval.resourceId}
        </p>

        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
          {isReject ? 'Reason (required)' : 'Note (optional)'}
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={isReject ? 'Explain why this request is rejected…' : 'Optional approval note…'}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '0.625rem 0.75rem',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            fontFamily: 'inherit', fontSize: '0.875rem',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
          <button
            onClick={onClose}
            disabled={isPending}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              border: '1px solid var(--border-primary)',
              background: 'none', cursor: 'pointer',
              fontSize: '0.875rem', color: 'var(--text-secondary)',
              fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(reason)}
            disabled={isPending || (isReject && !reason.trim())}
            style={{
              padding: '0.5rem 1rem', borderRadius: '0.5rem',
              border: 'none', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
              fontFamily: 'inherit',
              backgroundColor: isReject ? '#ef4444' : '#1a5d3d',
              color: '#fff',
              opacity: (isPending || (isReject && !reason.trim())) ? 0.5 : 1,
            }}
          >
            {isPending ? 'Saving…' : (isReject ? 'Reject' : 'Approve')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DetailPanelProps {
  id: string;
  onClose: () => void;
}

function DetailPanel({ id, onClose }: DetailPanelProps) {
  const { data, isLoading } = useApproval(id);
  const addComment = useAddApprovalComment();
  const decide = useDecideApproval();
  const { success: toastSuccess, error: toastError } = useToast();
  const [commentText, setCommentText] = useState('');
  const [decideAction, setDecideAction] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const approval = data?.data;

  const handleDecide = (reason: string) => {
    if (!decideAction) return;
    decide.mutate(
      { id, status: decideAction, reason: reason || undefined },
      {
        onSuccess: () => {
          toastSuccess(`Request ${decideAction.toLowerCase()} successfully`);
          setDecideAction(null);
        },
        onError: (e: Error) => {
          toastError(e.message);
          setDecideAction(null);
        },
      },
    );
  };

  const handleComment = () => {
    const body = commentText.trim();
    if (!body) return;
    addComment.mutate(
      { requestId: id, body },
      {
        onSuccess: () => setCommentText(''),
        onError: (e: Error) => toastError(e.message),
      },
    );
  };

  return (
    <>
      {decideAction && approval && (
        <DecideModal
          approval={approval}
          action={decideAction}
          onClose={() => setDecideAction(null)}
          onSubmit={handleDecide}
          isPending={decide.isPending}
        />
      )}

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '480px',
        backgroundColor: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-primary)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        zIndex: 200,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Panel header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-primary)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
            Approval Detail
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0.25rem' }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          {isLoading ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Loading…</p>
          ) : !approval ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>Not found</p>
          ) : (
            <>
              {/* Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                {[
                  ['Resource', approval.resource],
                  ['Resource ID', approval.resourceId],
                  ['Status', <StatusBadge status={approval.status} />],
                  ['Requested by', approval.requesterEmail ?? approval.requestedBy],
                  ['Submitted', new Date(approval.createdAt).toLocaleString()],
                  approval.decidedAt ? ['Decided', new Date(approval.decidedAt).toLocaleString()] : null,
                  approval.deciderEmail ? ['Decided by', approval.deciderEmail] : null,
                  approval.reason ? ['Reason', approval.reason] : null,
                ].filter(Boolean).map((row) => {
                  const [label, value] = row as [string, React.ReactNode];
                  return (
                    <div key={label}>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                        {label}
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>{value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              {approval.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                  <button
                    onClick={() => setDecideAction('APPROVED')}
                    style={{
                      flex: 1, padding: '0.625rem', borderRadius: '0.5rem',
                      border: 'none', cursor: 'pointer',
                      backgroundColor: '#1a5d3d', color: '#fff',
                      fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => setDecideAction('REJECTED')}
                    style={{
                      flex: 1, padding: '0.625rem', borderRadius: '0.5rem',
                      border: '1px solid #ef4444', cursor: 'pointer',
                      backgroundColor: 'transparent', color: '#ef4444',
                      fontWeight: 600, fontSize: '0.875rem', fontFamily: 'inherit',
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}

              {/* Comments */}
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                  Comments ({approval.comments?.length ?? 0})
                </p>
                {(approval.comments ?? []).map((c) => (
                  <div key={c.id} style={{
                    padding: '0.75rem', borderRadius: '0.5rem',
                    backgroundColor: 'var(--bg-secondary)',
                    marginBottom: '0.625rem',
                    border: '1px solid var(--border-primary)',
                  }}>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>
                      {c.userEmail ?? c.userId} · {new Date(c.createdAt).toLocaleString()}
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                  </div>
                ))}

                {/* Comment input */}
                <div style={{ marginTop: '0.875rem' }}>
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    rows={3}
                    placeholder="Add a comment…"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '0.625rem 0.75rem',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '0.5rem',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit', fontSize: '0.875rem',
                      resize: 'vertical',
                    }}
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || addComment.isPending}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.5rem 1rem', borderRadius: '0.5rem',
                      border: 'none', cursor: 'pointer',
                      backgroundColor: '#1a5d3d', color: '#fff',
                      fontWeight: 600, fontSize: '0.8125rem', fontFamily: 'inherit',
                      opacity: (!commentText.trim() || addComment.isPending) ? 0.5 : 1,
                    }}
                  >
                    {addComment.isPending ? 'Posting…' : 'Post Comment'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export function ApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useApprovals({ status: statusFilter || undefined, page, pageSize: 20 });

  const approvals = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Approvals
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Review and action pending approval requests
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
              border: '1px solid var(--border-primary)',
              cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.8125rem', fontWeight: 500,
              backgroundColor: statusFilter === s ? '#1a5d3d' : 'var(--bg-card)',
              color: statusFilter === s ? '#fff' : 'var(--text-secondary)',
              transition: 'all 150ms',
            }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        borderRadius: '0.75rem',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Resource', 'Resource ID', 'Requested By', 'Status', 'Submitted', ''].map((h) => (
                <th key={h} style={{
                  padding: '0.75rem 1rem', textAlign: 'left',
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--text-tertiary)', textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: 'var(--bg-secondary)',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  Loading…
                </td>
              </tr>
            ) : approvals.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  No approval requests found
                </td>
              </tr>
            ) : approvals.map((a, i) => (
              <tr
                key={a.id}
                style={{
                  borderBottom: i < approvals.length - 1 ? '1px solid var(--border-primary)' : 'none',
                  transition: 'background 150ms',
                  cursor: 'pointer',
                  backgroundColor: selectedId === a.id ? 'rgba(26,93,61,0.06)' : 'transparent',
                }}
                onClick={() => setSelectedId(a.id)}
                onMouseEnter={(e) => { if (selectedId !== a.id) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (selectedId !== a.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {a.resource}
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {a.resourceId.slice(0, 12)}…
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {a.requesterEmail ?? a.requestedBy.slice(0, 8) + '…'}
                </td>
                <td style={{ padding: '0.875rem 1rem' }}>
                  <StatusBadge status={a.status} />
                </td>
                <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedId(a.id); }}
                    style={{
                      background: 'none', border: '1px solid var(--border-primary)',
                      borderRadius: '0.375rem', cursor: 'pointer',
                      padding: '0.3125rem 0.625rem',
                      fontSize: '0.75rem', color: 'var(--text-secondary)',
                      fontFamily: 'inherit',
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.875rem 1rem',
            borderTop: '1px solid var(--border-primary)',
            backgroundColor: 'var(--bg-secondary)',
          }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
                  border: '1px solid var(--border-primary)',
                  background: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', color: 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= pagination.totalPages}
                style={{
                  padding: '0.4375rem 0.875rem', borderRadius: '0.5rem',
                  border: '1px solid var(--border-primary)',
                  background: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', color: 'var(--text-secondary)',
                  fontFamily: 'inherit',
                  opacity: page >= pagination.totalPages ? 0.4 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedId && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setSelectedId(null)}
          />
          <DetailPanel id={selectedId} onClose={() => setSelectedId(null)} />
        </>
      )}
    </div>
  );
}
