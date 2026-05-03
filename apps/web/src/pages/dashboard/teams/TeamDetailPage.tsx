import { useState, FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useToast } from '../../../contexts/ToastContext';
import {
  useTeam,
  useUpdateTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  type TeamStatus,
} from '../../../hooks/useTeams';

function statusBadgeVariant(status: TeamStatus): 'success' | 'warning' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'IN_REVIEW') return 'warning';
  return 'neutral';
}

function statusLabel(status: TeamStatus): string {
  if (status === 'ACTIVE') return 'Active';
  if (status === 'IN_REVIEW') return 'In Review';
  return 'Archived';
}

function roleLabel(role: string): string {
  if (!role) return 'Viewer';
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: team, isLoading, error } = useTeam(id);
  const updateTeam = useUpdateTeam(id ?? '');
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember(id ?? '');
  const removeMember = useRemoveTeamMember(id ?? '');
  const [addUserId, setAddUserId] = useState('');

  if (isLoading) {
    return (
      <div style={{ maxWidth: '900px' }}>
        <Card padding="md">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Loading team…</p>
        </Card>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div style={{ maxWidth: '900px' }}>
        <Card padding="md">
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>
            Could not load team. It may not exist or you may not have access.
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Link to="/teams" style={{ color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
              ← Back to teams
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const handleStatus = async (status: TeamStatus) => {
    try {
      await updateTeam.mutateAsync({ status });
      toast.success(`Team ${statusLabel(status).toLowerCase()}`);
    } catch {
      toast.error('Could not update status.');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete team "${team.name}"? Members are unaffected at the org level. This cannot be undone.`)) return;
    try {
      await deleteTeam.mutateAsync(team.id);
      toast.success('Team deleted');
      navigate('/teams', { replace: true });
    } catch {
      toast.error('Could not delete team.');
    }
  };

  const handleAddMember = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = addUserId.trim();
    if (!trimmed) return;
    try {
      await addMember.mutateAsync(trimmed);
      toast.success('Member added');
      setAddUserId('');
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : 'Could not add member';
      toast.error(detail);
    }
  };

  const handleRemoveMember = async (userId: string, userName: string) => {
    if (!confirm(`Remove ${userName} from "${team.name}"?`)) return;
    try {
      await removeMember.mutateAsync(userId);
      toast.success('Member removed');
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : 'Could not remove member';
      toast.error(detail);
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/teams" style={{ fontSize: '0.8125rem', color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
          ← Back to teams
        </Link>
      </div>

      <Card padding="md" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              {team.name}
            </h2>
            {team.description && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>
                {team.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge variant={statusBadgeVariant(team.status)}>{statusLabel(team.status)}</Badge>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Default role <Badge variant="neutral">{roleLabel(team.defaultRole)}</Badge>
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                Owner <strong style={{ color: 'var(--text-secondary)' }}>{team.ownerName}</strong>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            {team.status === 'ACTIVE' && (
              <Button size="sm" variant="outline" onClick={() => handleStatus('IN_REVIEW')}>
                Mark In Review
              </Button>
            )}
            {team.status === 'IN_REVIEW' && (
              <Button size="sm" variant="outline" onClick={() => handleStatus('ACTIVE')}>
                Mark Active
              </Button>
            )}
            {team.status !== 'ARCHIVED' && (
              <Button size="sm" variant="outline" onClick={() => handleStatus('ARCHIVED')}>
                Archive
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleDelete} style={{ color: '#dc2626', borderColor: '#dc2626' }}>
              Delete
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md">
        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
          Members <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>({team.memberCount})</span>
        </h3>

        <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '260px' }}>
            <Input
              label="Add by user id"
              type="text"
              placeholder="UUID of an existing org member"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              hint="The user must already be an active member of this organisation."
            />
          </div>
          <Button type="submit" loading={addMember.isPending}>
            Add
          </Button>
        </form>

        {team.members.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            No members yet — add one by user id above.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Name', 'Email', 'Added', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '0.625rem 0.5rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.members.map((m, i) => {
                const isOwner = m.userId === team.ownerId;
                return (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: i < team.members.length - 1 ? '1px solid var(--border-primary)' : 'none',
                    }}
                  >
                    <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {m.userName}
                      {isOwner && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          <Badge variant="success">Owner</Badge>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-secondary)' }}>{m.userEmail}</td>
                    <td style={{ padding: '0.625rem 0.5rem', color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                      {new Date(m.addedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.625rem 0.5rem', textAlign: 'right' }}>
                      {!isOwner && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveMember(m.userId, m.userName)}
                          style={{ color: '#dc2626' }}
                        >
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
