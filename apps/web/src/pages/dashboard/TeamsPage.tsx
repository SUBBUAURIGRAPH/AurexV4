import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../contexts/ToastContext';
import {
  useTeams,
  useCreateTeam,
  type TeamStatus,
} from '../../hooks/useTeams';

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

export function TeamsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, error } = useTeams();
  const createTeam = useCreateTeam();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [defaultRole, setDefaultRole] = useState('VIEWER');

  const teams = data ?? [];

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Team name is required');
      return;
    }
    try {
      await createTeam.mutateAsync({
        name: trimmed,
        description: description.trim() || null,
        defaultRole,
      });
      toast.success(`Team "${trimmed}" created`);
      setName('');
      setDescription('');
      setDefaultRole('VIEWER');
      setShowCreate(false);
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : 'Could not create team';
      toast.error(detail);
    }
  };

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Teams and Access
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
            Manage departments, user roles, and workspace access policies.
          </p>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? 'Cancel' : 'Add Team'}
        </Button>
      </div>

      {showCreate && (
        <Card padding="md" style={{ marginBottom: '1.25rem' }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Create a new team
            </h3>
            <Input
              label="Team name"
              type="text"
              placeholder="e.g. Sustainability Office"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              maxLength={200}
            />
            <Input
              label="Description"
              type="text"
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
            <div>
              <label
                htmlFor="team-default-role"
                style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.375rem' }}
              >
                Default Role
              </label>
              <select
                id="team-default-role"
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                }}
              >
                <option value="VIEWER">Viewer</option>
                <option value="MAKER">Maker</option>
                <option value="CHECKER">Checker</option>
                <option value="APPROVER">Approver</option>
                <option value="AUDITOR">Auditor</option>
                <option value="ANALYST">Analyst</option>
                <option value="ORG_ADMIN">Org Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button variant="ghost" type="button" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createTeam.isPending}>
                Create team
              </Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading && (
        <Card padding="md">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>Loading teams…</p>
        </Card>
      )}

      {error && !isLoading && (
        <Card padding="md">
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>
            Could not load teams. Refresh, or check that you have access to this organisation.
          </p>
        </Card>
      )}

      {!isLoading && !error && teams.length === 0 && (
        <Card padding="md">
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              No teams yet.
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
              Create your first team to group org members by department or function.
            </p>
          </div>
        </Card>
      )}

      {!isLoading && !error && teams.length > 0 && (
        <Card padding="none">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  {['Team', 'Owner', 'Members', 'Default Role', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '0.875rem 1rem',
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
                {teams.map((team, i) => (
                  <tr
                    key={team.id}
                    style={{ borderBottom: i < teams.length - 1 ? '1px solid var(--border-primary)' : 'none' }}
                  >
                    <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {team.name}
                      {team.description && (
                        <div style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                          {team.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: 'var(--text-secondary)' }}>{team.ownerName}</td>
                    <td
                      style={{
                        padding: '0.875rem 1rem',
                        color: 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {team.memberCount}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant="neutral">{roleLabel(team.defaultRole)}</Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <Badge variant={statusBadgeVariant(team.status)}>{statusLabel(team.status)}</Badge>
                    </td>
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="outline" onClick={() => navigate(`/teams/${team.id}`)}>
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
