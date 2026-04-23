import { useState, useMemo } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Badge } from '../../../components/ui/Badge';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import {
  useOrganizationTree,
  useOrganizationsList,
  useCreateOrganization,
  type OrganizationTreeNode,
  type CreateOrganizationInput,
} from '../../../hooks/useOrganization';

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
   Page
   ============================================ */

export function OrganizationsPage() {
  const toast = useToast();
  const { data: treeData, isLoading } = useOrganizationTree();
  const { data: flatData } = useOrganizationsList(true);
  const createOrg = useCreateOrganization();

  const tree = treeData?.data ?? [];
  const flat = useMemo(() => flatten(tree), [tree]);
  const flatForParentOptions = flatData?.data ?? [];

  /* Create modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateOrganizationInput>({
    name: '',
    slug: '',
    parentOrgId: null,
  });

  const openCreate = (parentOrgId: string | null = null) => {
    setDefaultParentId(parentOrgId);
    setForm({ name: '', slug: '', parentOrgId });
    setModalOpen(true);
  };

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
    </div>
  );
}
