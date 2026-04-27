import { useState, useCallback } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../../../hooks/useUsers';
import type { User, CreateUserData, UpdateUserData } from '../../../hooks/useUsers';
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
import { SearchInput } from '../../../components/ui/SearchInput';
import { EmptyState } from '../../../components/ui/EmptyState';
import { getErrorMessage } from '../../../lib/error';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'org_admin', label: 'Org Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'viewer', label: 'Viewer' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const ROLE_FORM_OPTIONS = ROLE_OPTIONS.filter((o) => o.value !== '');

function roleBadgeColor(role: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    super_admin: { bg: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: 'rgba(34, 197, 94, 0.2)' },
    org_admin: { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.2)' },
    manager: { bg: 'rgba(168, 85, 247, 0.1)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.2)' },
    analyst: { bg: 'rgba(20, 184, 166, 0.1)', color: '#0d9488', border: 'rgba(20, 184, 166, 0.2)' },
    viewer: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border-primary)' },
  };
  const s = map[role] ?? map.viewer!;
  return { backgroundColor: s!.bg, color: s!.color, borderColor: s!.border };
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatRoleLabel(role: string): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface UserFormState {
  name: string;
  email: string;
  role: string;
}

const INITIAL_FORM: UserFormState = { name: '', email: '', role: '' };

export function UsersPage() {
  const toast = useToast();

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(INITIAL_FORM);

  // Shown after a new user is created so the admin can share the one-time
  // temporary password. Cleared when dismissed.
  const [newUserCredentials, setNewUserCredentials] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);

  // Data
  const { data, isLoading, isError } = useUsers({
    search: search || undefined,
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    page,
    pageSize,
  });

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const users = data?.data ?? [];
  const total = data?.total ?? 0;

  const openAddModal = useCallback(() => {
    setEditingUser(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, role: user.role });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingUser(null);
    setForm(INITIAL_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name.trim() || !form.email.trim() || !form.role) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      if (editingUser) {
        const payload: UpdateUserData = { id: editingUser.id };
        if (form.name !== editingUser.name) payload.name = form.name;
        if (form.email !== editingUser.email) payload.email = form.email;
        if (form.role !== editingUser.role) payload.role = form.role;
        await updateUser.mutateAsync(payload);
        toast.success('User updated successfully');
      } else {
        const payload: CreateUserData = {
          name: form.name,
          email: form.email,
          role: form.role,
        };
        const result = await createUser.mutateAsync(payload);
        const created = result?.data;
        if (created?.temporaryPassword) {
          // Show the credentials modal; admin is responsible for sharing them.
          setNewUserCredentials({
            email: created.email,
            temporaryPassword: created.temporaryPassword,
          });
          toast.success('User created — share the temporary password');
        } else {
          toast.success('User linked to this organization');
        }
      }
      closeModal();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to save user'));
    }
  }, [form, editingUser, createUser, updateUser, closeModal, toast]);

  const handleToggleStatus = useCallback(
    async (user: User) => {
      const isActive = user.status === 'active';
      const action = isActive ? 'deactivate' : 'activate';
      if (!window.confirm(`Are you sure you want to ${action} ${user.name}?`)) return;

      try {
        if (isActive) {
          await deleteUser.mutateAsync(user.id);
          toast.success(`${user.name} has been deactivated`);
        } else {
          await updateUser.mutateAsync({ id: user.id, status: 'active' });
          toast.success(`${user.name} has been activated`);
        }
      } catch (err: unknown) {
        toast.error(getErrorMessage(err, `Failed to ${action} user`));
      }
    },
    [deleteUser, updateUser, toast]
  );

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_val, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.125rem' }}>
            {row.email}
          </div>
        </div>
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
      key: 'status',
      label: 'Status',
      render: (_val, row) => (
        <Badge variant={row.status === 'active' ? 'success' : 'error'}>
          {row.status === 'active' ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'last_login',
      label: 'Last Login',
      render: (_val, row) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
          {formatRelativeTime(row.last_login)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_val, row) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(row)}
            aria-label={`Edit ${row.name}`}
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            }
          >
            Edit
          </Button>
          <Button
            variant={row.status === 'active' ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => handleToggleStatus(row)}
          >
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      ),
    },
  ];

  const isMutating = createUser.isPending || updateUser.isPending;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          User Management
        </h1>
        <Button variant="primary" onClick={openAddModal}>
          Add User
        </Button>
      </div>

      {/* Filter bar */}
      <Card padding="sm" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 240px', minWidth: '200px' }}>
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search users..." />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select
              value={roleFilter}
              onChange={(v) => { setRoleFilter(v); setPage(1); }}
              options={ROLE_OPTIONS}
              placeholder="Filter by role"
            />
          </div>
          <div style={{ minWidth: '140px' }}>
            <Select
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
              options={STATUS_OPTIONS}
              placeholder="Filter by status"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        {isError ? (
          <EmptyState
            title="Failed to load users"
            description="An error occurred while fetching user data. Please try again."
            action={{ label: 'Retry', onClick: () => window.location.reload() }}
          />
        ) : !isLoading && users.length === 0 ? (
          <EmptyState
            title="No users found"
            description="Try adjusting your search or filter criteria, or add a new user."
            action={{ label: 'Add User', onClick: openAddModal }}
          />
        ) : (
          <>
            <Table columns={columns} data={users} loading={isLoading} />
            {total > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              />
            )}
          </>
        )}
      </Card>

      {/* One-time temp password modal */}
      <Modal
        isOpen={!!newUserCredentials}
        onClose={() => setNewUserCredentials(null)}
        title="User created — share credentials"
        size="sm"
        footer={
          <Button variant="primary" onClick={() => setNewUserCredentials(null)}>
            Done
          </Button>
        }
      >
        {newUserCredentials ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              This temporary password will not be shown again. Share it with the user through a secure channel.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>EMAIL</span>
              <code
                style={{
                  padding: '0.5rem 0.625rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.375rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                }}
              >
                {newUserCredentials.email}
              </code>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                TEMPORARY PASSWORD
              </span>
              <code
                style={{
                  padding: '0.5rem 0.625rem',
                  fontSize: '0.875rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '0.375rem',
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  wordBreak: 'break-all',
                }}
              >
                {newUserCredentials.temporaryPassword}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(newUserCredentials.temporaryPassword);
                  toast.success('Password copied to clipboard');
                }}
                style={{ alignSelf: 'flex-start' }}
              >
                Copy password
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingUser ? 'Edit User' : 'Add User'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={isMutating}
              disabled={isMutating}
            >
              {editingUser ? 'Save Changes' : 'Save'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Full name"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="user@example.com"
          />
          <Select
            label="Role"
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            options={ROLE_FORM_OPTIONS}
            placeholder="Select a role"
          />
        </div>
      </Modal>
    </div>
  );
}
