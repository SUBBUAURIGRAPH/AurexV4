import { useState, useCallback, useMemo } from 'react';
import {
  useOrganization,
  useOrgMembers,
  useUpdateOrg,
  useAddMember,
  useUpdateMember,
  useRemoveMember,
} from '../../../hooks/useOrganization';
import type { OrgMember } from '../../../hooks/useOrganization';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { Table } from '../../../components/ui/Table';
import type { TableColumn } from '../../../components/ui/Table';
import { Pagination } from '../../../components/ui/Pagination';
import { EmptyState } from '../../../components/ui/EmptyState';
import { getErrorMessage } from '../../../lib/error';

const MEMBER_ROLE_OPTIONS = [
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
];

function roleBadgeColor(role: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    super_admin: { bg: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: 'rgba(34, 197, 94, 0.2)' },
    org_admin: { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.2)' },
    manager: { bg: 'rgba(168, 85, 247, 0.1)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.2)' },
    analyst: { bg: 'rgba(20, 184, 166, 0.1)', color: '#0d9488', border: 'rgba(20, 184, 166, 0.2)' },
    viewer: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border-primary)' },
  };
  const s = map[role] || map['viewer']!;
  return { backgroundColor: s!.bg, color: s!.color, borderColor: s!.border };
}

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function OrganizationPage() {
  const toast = useToast();

  // Org data
  const { data: org, isLoading: orgLoading, isError: orgError } = useOrganization();
  const updateOrg = useUpdateOrg();

  // Members
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(10);
  const {
    data: membersData,
    isLoading: membersLoading,
    isError: membersError,
  } = useOrgMembers(org?.id, { page: memberPage, pageSize: memberPageSize });

  const members = membersData?.data ?? [];
  const membersTotal = membersData?.total ?? 0;

  // Edit Org modal
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: '', slug: '' });

  const openEditOrg = useCallback(() => {
    if (org) {
      setOrgForm({ name: org.name, slug: org.slug });
    }
    setEditOrgOpen(true);
  }, [org]);

  const closeEditOrg = useCallback(() => {
    setEditOrgOpen(false);
  }, []);

  const handleOrgNameChange = useCallback((value: string) => {
    setOrgForm((f) => ({
      ...f,
      name: value,
      slug: slugify(value),
    }));
  }, []);

  const handleSaveOrg = useCallback(async () => {
    if (!orgForm.name.trim()) {
      toast.error('Organization name is required');
      return;
    }
    try {
      await updateOrg.mutateAsync({ id: org?.id || '', name: orgForm.name });
      toast.success('Organization updated successfully');
      closeEditOrg();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update organization'));
    }
  }, [orgForm, org, updateOrg, closeEditOrg, toast]);

  // Invite Member modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', role: '' });
  const addMember = useAddMember();

  const openInvite = useCallback(() => {
    setInviteForm({ email: '', role: '' });
    setInviteOpen(true);
  }, []);

  const closeInvite = useCallback(() => {
    setInviteOpen(false);
  }, []);

  const handleInvite = useCallback(async () => {
    if (!inviteForm.email.trim() || !inviteForm.role) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      await addMember.mutateAsync({
        org_id: org?.id || 'current',
        email: inviteForm.email,
        role: inviteForm.role,
      });
      toast.success('Member invited successfully');
      closeInvite();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to invite member'));
    }
  }, [inviteForm, org, addMember, closeInvite, toast]);

  // Edit member role modal
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [editMemberRole, setEditMemberRole] = useState('');

  const openEditMember = useCallback((member: OrgMember) => {
    setEditingMember(member);
    setEditMemberRole(member.role);
    setEditMemberOpen(true);
  }, []);

  const closeEditMember = useCallback(() => {
    setEditMemberOpen(false);
    setEditingMember(null);
  }, []);

  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();

  const handleSaveMemberRole = useCallback(async () => {
    if (!editingMember || !editMemberRole) return;
    try {
      await updateMember.mutateAsync({
        org_id: org?.id || 'current',
        member_id: editingMember.id,
        role: editMemberRole,
      });
      toast.success(`${editingMember.name}'s role updated`);
      closeEditMember();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to update member role'));
    }
  }, [editingMember, editMemberRole, org, updateMember, closeEditMember, toast]);

  const handleRemoveMember = useCallback(
    async (member: OrgMember) => {
      if (!window.confirm(`Remove ${member.name} from this organization?`)) return;
      try {
        await removeMember.mutateAsync({
          org_id: org?.id || 'current',
          member_id: member.id,
        });
        toast.success(`${member.name} has been removed`);
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, 'Failed to remove member'));
      }
    },
    [org, removeMember, toast]
  );

  // Table columns
  const memberColumns: TableColumn<OrgMember>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        render: (_val, row) => (
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</span>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        render: (_val, row) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{row.email}</span>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        render: (_val, row) => (
          <Badge variant="neutral" style={roleBadgeColor(row.role)}>
            {formatRoleLabel(row.role)}
          </Badge>
        ),
      },
      {
        key: 'joined_at',
        label: 'Joined',
        render: (_val, row) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {formatDate(row.joined_at)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (_val, row) => (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button variant="ghost" size="sm" onClick={() => openEditMember(row)}>
              Edit Role
            </Button>
            <Button variant="danger" size="sm" onClick={() => handleRemoveMember(row)}>
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [openEditMember, handleRemoveMember]
  );

  // Section label style
  const sectionLabel: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-tertiary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.25rem',
  };

  const sectionValue: React.CSSProperties = {
    fontSize: '0.9375rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Page header */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 1.5rem 0' }}>
        Organization
      </h1>

      {/* Card 1: Organization Details */}
      <Card padding="md" style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1.25rem',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Organization Details
          </h2>
          <Button variant="outline" size="sm" onClick={openEditOrg} disabled={orgLoading}>
            Edit
          </Button>
        </div>

        {orgLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: '1rem',
                  width: `${30 + i * 15}%`,
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: '0.25rem',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : orgError ? (
          <EmptyState
            title="Failed to load organization"
            description="An error occurred. Please try again."
          />
        ) : org ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div>
              <div style={sectionLabel}>Name</div>
              <div style={sectionValue}>{org.name}</div>
            </div>
            <div>
              <div style={sectionLabel}>Slug</div>
              <div style={{ ...sectionValue, color: 'var(--text-tertiary)' }}>{org.slug}</div>
            </div>
            <div>
              <div style={sectionLabel}>Created</div>
              <div style={sectionValue}>{formatDate(org.createdAt ?? org.created_at ?? '')}</div>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Card 2: Team Members */}
      <Card padding="none">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Team Members
            </h2>
            <Badge variant="neutral">{membersTotal}</Badge>
          </div>
          <Button variant="primary" size="sm" onClick={openInvite}>
            Invite Member
          </Button>
        </div>

        {membersError ? (
          <EmptyState
            title="Failed to load members"
            description="An error occurred while fetching team members."
          />
        ) : !membersLoading && members.length === 0 ? (
          <EmptyState
            title="No members yet"
            description="Invite team members to get started."
            action={{ label: 'Invite Member', onClick: openInvite }}
          />
        ) : (
          <>
            <Table columns={memberColumns} data={members} loading={membersLoading} />
            {membersTotal > 0 && (
              <Pagination
                page={memberPage}
                pageSize={memberPageSize}
                total={membersTotal}
                onPageChange={setMemberPage}
                onPageSizeChange={(size) => { setMemberPageSize(size); setMemberPage(1); }}
              />
            )}
          </>
        )}
      </Card>

      {/* Edit Organization Modal */}
      <Modal
        isOpen={editOrgOpen}
        onClose={closeEditOrg}
        title="Edit Organization"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeEditOrg}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveOrg}
              loading={updateOrg.isPending}
              disabled={updateOrg.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Organization Name"
            value={orgForm.name}
            onChange={(e) => handleOrgNameChange(e.target.value)}
            placeholder="Acme Inc."
          />
          <Input
            label="Slug"
            value={orgForm.slug}
            onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="acme-inc"
            hint="Auto-generated from name. You can customize it."
          />
        </div>
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        isOpen={inviteOpen}
        onClose={closeInvite}
        title="Invite Member"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeInvite}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleInvite}
              loading={addMember.isPending}
              disabled={addMember.isPending}
            >
              Invite
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="User ID or Email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="user@example.com"
          />
          <Select
            label="Role"
            value={inviteForm.role}
            onChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}
            options={MEMBER_ROLE_OPTIONS}
            placeholder="Select a role"
          />
        </div>
      </Modal>

      {/* Edit Member Role Modal */}
      <Modal
        isOpen={editMemberOpen}
        onClose={closeEditMember}
        title={`Edit Role - ${editingMember?.name || ''}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeEditMember}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveMemberRole}
              loading={addMember.isPending}
              disabled={addMember.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <Select
          label="Role"
          value={editMemberRole}
          onChange={setEditMemberRole}
          options={MEMBER_ROLE_OPTIONS}
          placeholder="Select a role"
        />
      </Modal>
    </div>
  );
}
