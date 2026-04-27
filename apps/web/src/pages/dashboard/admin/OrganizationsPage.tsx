import { useState, useMemo, useCallback } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Table } from '../../../components/ui/Table';
import type { TableColumn } from '../../../components/ui/Table';
import { useToast } from '../../../contexts/ToastContext';
import {
  useOrganizationTree,
  useOrganizationsList,
  useCreateOrganization,
  useOrgMembers,
  useAddMember,
  useUpdateMember,
  useRemoveMember,
  type OrganizationTreeNode,
  type CreateOrganizationInput,
  type OrgMember,
} from '../../../hooks/useOrganization';

/* ============================================
   Role config (9 values incl. 4 workflow roles)
   ============================================ */

const MEMBER_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
  { value: 'maker', label: 'Maker' },
  { value: 'checker', label: 'Checker' },
  { value: 'approver', label: 'Approver' },
  { value: 'auditor', label: 'Auditor' },
];

function roleBadgeColor(role: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    // Existing 5 roles — palette reused from OrganizationPage.tsx
    super_admin: { bg: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: 'rgba(34, 197, 94, 0.2)' },
    org_admin: { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.2)' },
    manager: { bg: 'rgba(168, 85, 247, 0.1)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.2)' },
    analyst: { bg: 'rgba(20, 184, 166, 0.1)', color: '#0d9488', border: 'rgba(20, 184, 166, 0.2)' },
    viewer: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border-primary)' },
    // New workflow roles — sensible tones
    maker: { bg: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', border: 'rgba(14, 165, 233, 0.2)' },
    checker: { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: 'rgba(245, 158, 11, 0.2)' },
    approver: { bg: 'rgba(217, 70, 239, 0.1)', color: '#c026d3', border: 'rgba(217, 70, 239, 0.2)' },
    auditor: { bg: 'rgba(100, 116, 139, 0.1)', color: '#475569', border: 'rgba(100, 116, 139, 0.2)' },
  };
  const s = map[role] || map['viewer']!;
  return { backgroundColor: s.bg, color: s.color, borderColor: s.border };
}

function formatRoleLabel(role: string): string {
  const match = MEMBER_ROLE_OPTIONS.find((r) => r.value === role);
  if (match) return match.label;
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ============================================
   Helpers
   ============================================ */

function flatten(nodes: OrganizationTreeNode[], depth = 0): Array<OrganizationTreeNode & { depth: number }> {
  const out: Array<OrganizationTreeNode & { depth: number }> = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    if (n.children?.length) {
      out.push(...flatten(n.children, depth + 1));
    }
  }
  return out;
}

function countDescendants(node: OrganizationTreeNode): number {
  let c = 0;
  for (const ch of node.children ?? []) {
    c += 1 + countDescendants(ch);
  }
  return c;
}

/* ============================================
   Members Modal
   ============================================ */

interface MembersModalProps {
  orgId: string;
  orgName: string;
  isOpen: boolean;
  onClose: () => void;
}

function MembersModal({ orgId, orgName, isOpen, onClose }: MembersModalProps) {
  const toast = useToast();

  // Only fetch members when the modal is open and we have an orgId
  const {
    data: membersData,
    isLoading: membersLoading,
    isError: membersError,
  } = useOrgMembers(isOpen && orgId ? orgId : undefined);

  const members: OrgMember[] = isOpen ? (membersData?.data ?? []) : [];

  const addMember = useAddMember();
  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();

  // Add member form
  const [addForm, setAddForm] = useState<{ email: string; role: string }>({
    email: '',
    role: '',
  });

  const handleAddMember = useCallback(async () => {
    if (!addForm.email.trim() || !addForm.role) {
      toast.error('Email and role are required');
      return;
    }
    try {
      await addMember.mutateAsync({
        org_id: orgId,
        email: addForm.email.trim(),
        role: addForm.role,
      });
      toast.success('Member added');
      setAddForm({ email: '', role: '' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      toast.error(msg);
    }
  }, [addForm, orgId, addMember, toast]);

  const handleChangeRole = useCallback(
    async (member: OrgMember, newRole: string) => {
      if (!newRole || newRole === member.role) return;
      try {
        await updateMember.mutateAsync({
          org_id: orgId,
          member_id: member.id,
          role: newRole,
        });
        toast.success(`${member.name || member.email}'s role updated`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update role';
        toast.error(msg);
      }
    },
    [orgId, updateMember, toast]
  );

  const handleRemove = useCallback(
    async (member: OrgMember) => {
      const label = member.name || member.email;
      if (!window.confirm(`Remove ${label} from ${orgName}?`)) return;
      try {
        await removeMember.mutateAsync({
          org_id: orgId,
          member_id: member.id,
        });
        toast.success(`${label} has been removed`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to remove member';
        toast.error(msg);
      }
    },
    [orgId, orgName, removeMember, toast]
  );

  const columns: TableColumn<OrgMember>[] = useMemo(
    () => [
      {
        key: 'name',
        label: 'Name',
        render: (_v, row) => (
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {row.name || '—'}
          </span>
        ),
      },
      {
        key: 'email',
        label: 'Email',
        render: (_v, row) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {row.email}
          </span>
        ),
      },
      {
        key: 'role',
        label: 'Role',
        render: (_v, row) => (
          <Badge variant="neutral" style={roleBadgeColor(row.role)}>
            {formatRoleLabel(row.role)}
          </Badge>
        ),
      },
      {
        key: 'joined_at',
        label: 'Joined',
        render: (_v, row) => (
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
            {formatDate(row.joined_at)}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (_v, row) => (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <div style={{ minWidth: '140px' }}>
              <Select
                value={row.role}
                onChange={(v) => handleChangeRole(row, v)}
                options={MEMBER_ROLE_OPTIONS}
                disabled={updateMember.isPending}
              />
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleRemove(row)}
              disabled={removeMember.isPending}
            >
              Remove
            </Button>
          </div>
        ),
      },
    ],
    [handleChangeRole, handleRemove, updateMember.isPending, removeMember.isPending]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Members — ${orgName}`}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Add Member form */}
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            backgroundColor: 'var(--bg-tertiary)',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
            }}
          >
            Add Member
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px auto',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <Input
              label="Email"
              value={addForm.email}
              onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@example.com"
            />
            <Select
              label="Role"
              value={addForm.role}
              onChange={(v) => setAddForm((f) => ({ ...f, role: v }))}
              options={MEMBER_ROLE_OPTIONS}
              placeholder="Select a role"
            />
            <Button
              variant="primary"
              onClick={handleAddMember}
              loading={addMember.isPending}
              disabled={!addForm.email.trim() || !addForm.role || addMember.isPending}
            >
              Add
            </Button>
          </div>
        </div>

        {/* Members list */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            <h4
              style={{
                fontSize: '0.9375rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Current Members
            </h4>
            <Badge variant="neutral">{membersData?.total ?? members.length}</Badge>
          </div>

          {membersError ? (
            <EmptyState
              title="Failed to load members"
              description="An error occurred while fetching team members."
            />
          ) : !membersLoading && members.length === 0 ? (
            <EmptyState
              title="No members yet"
              description="Add the first member using the form above."
            />
          ) : (
            <div
              style={{
                border: '1px solid var(--border-primary)',
                borderRadius: '0.5rem',
                overflow: 'hidden',
              }}
            >
              <Table columns={columns} data={members} loading={membersLoading} />
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ============================================
   Page
   ============================================ */

export function OrganizationsPage() {
  const toast = useToast();
  const { data: treeData, isLoading } = useOrganizationTree();
  const { data: flatData } = useOrganizationsList(true);
  const createOrg = useCreateOrganization();

  const tree = useMemo(() => treeData?.data ?? [], [treeData?.data]);
  const flat = useMemo(() => flatten(tree), [tree]);
  const flatForParentOptions = useMemo(() => flatData?.data ?? [], [flatData?.data]);

  /* Create modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateOrganizationInput>({
    name: '',
    slug: '',
    parentOrgId: null,
  });

  /* Members modal state */
  const [membersOrg, setMembersOrg] = useState<{ id: string; name: string } | null>(null);

  const openCreate = (parentOrgId: string | null = null) => {
    setDefaultParentId(parentOrgId);
    setForm({ name: '', slug: '', parentOrgId });
    setModalOpen(true);
  };

  const openMembers = (node: OrganizationTreeNode) => {
    setMembersOrg({ id: node.id, name: node.name });
  };

  const closeMembers = () => setMembersOrg(null);

  const parentOptions = useMemo(
    () => [
      { value: '', label: '(top-level — super_admin only)' },
      ...flatForParentOptions.map((o) => ({ value: o.id, label: o.name })),
    ],
    [flatForParentOptions],
  );

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    try {
      await createOrg.mutateAsync({
        name: form.name.trim(),
        slug: form.slug?.trim() || undefined,
        parentOrgId: form.parentOrgId || null,
      });
      toast.success('Organization created');
      setModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create organization';
      toast.error(msg);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Organizations
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Parent organizations and their subsidiaries. Analytics and reports can optionally roll up subsidiaries.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => openCreate(null)}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Add Organization
        </Button>
      </div>

      <Card padding="none">
        {!isLoading && flat.length === 0 ? (
          <EmptyState
            title="No organizations visible"
            description="Create your first organization to get started. Subsidiaries can be added under any organization you administer."
            action={{ label: 'Add Organization', onClick: () => openCreate(null) }}
          />
        ) : (
          <div style={{ padding: '0.5rem' }}>
            {flat.map((node) => (
              <div
                key={node.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 0.75rem',
                  paddingLeft: `${0.75 + node.depth * 1.5}rem`,
                  borderBottom: '1px solid var(--border-primary)',
                }}
              >
                {/* Indent / tree glyph */}
                {node.depth > 0 && (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>↳</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{node.name}</span>
                    {node.depth === 0 && <Badge variant="info">Parent</Badge>}
                    {node.depth > 0 && <Badge variant="neutral">Subsidiary</Badge>}
                    {node.isActive === false && <Badge variant="warning">Inactive</Badge>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
                    {node.slug}
                    {node.children?.length ? ` · ${countDescendants(node)} descendant${countDescendants(node) === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => openMembers(node)}>
                  Members
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openCreate(node.id)}>
                  + Subsidiary
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={defaultParentId ? 'Add Subsidiary' : 'Add Organization'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={createOrg.isPending}
              disabled={!form.name.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., Aurigraph Europe Ltd"
          />
          <Input
            label="Slug (optional)"
            value={form.slug ?? ''}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="auto-generated from name if blank"
            hint="Lowercase letters, numbers, and hyphens only"
          />
          <Select
            label="Parent Organization"
            value={form.parentOrgId ?? ''}
            onChange={(v) => setForm({ ...form, parentOrgId: v || null })}
            options={parentOptions}
            placeholder=""
          />
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>
            You'll be added as <strong>Org Admin</strong> of the new organization. Subsidiaries can be created by the parent org's admins.
          </p>
        </div>
      </Modal>

      {/* Per-org Members modal */}
      {membersOrg && (
        <MembersModal
          orgId={membersOrg.id}
          orgName={membersOrg.name}
          isOpen={membersOrg !== null}
          onClose={closeMembers}
        />
      )}
    </div>
  );
}
