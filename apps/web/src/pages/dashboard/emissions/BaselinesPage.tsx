import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableColumn } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import {
  useBaselines,
  useCreateBaseline,
  useUpdateBaseline,
  useDeleteBaseline,
  Baseline,
  CreateBaselineData,
  Scope,
} from '../../../hooks/useBaselines';

const SCOPE_OPTIONS = [
  { value: 'SCOPE_1', label: 'Scope 1 - Direct' },
  { value: 'SCOPE_2', label: 'Scope 2 - Indirect' },
  { value: 'SCOPE_3', label: 'Scope 3 - Value Chain' },
];

const SCOPE_LABEL: Record<Scope, string> = {
  SCOPE_1: 'Scope 1',
  SCOPE_2: 'Scope 2',
  SCOPE_3: 'Scope 3',
};

const SCOPE_VARIANT: Record<Scope, 'error' | 'info' | 'success'> = {
  SCOPE_1: 'error',
  SCOPE_2: 'info',
  SCOPE_3: 'success',
};

const INITIAL_FORM: CreateBaselineData = {
  name: '',
  scope: '',
  baseYear: new Date().getFullYear(),
  value: 0,
  unit: 'tCO2e',
  methodology: '',
  isActive: true,
};

export function BaselinesPage() {
  const toast = useToast();
  const { data: baselinesData, isLoading } = useBaselines();
  const createBaseline = useCreateBaseline();
  const updateBaseline = useUpdateBaseline();
  const deleteBaseline = useDeleteBaseline();

  const baselines = baselinesData?.data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateBaselineData>(INITIAL_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalOpen(true);
  };

  const openEdit = (baseline: Baseline) => {
    setEditingId(baseline.id);
    setForm({
      name: baseline.name,
      scope: baseline.scope,
      baseYear: baseline.baseYear,
      value: Number(baseline.value),
      unit: baseline.unit,
      methodology: baseline.methodology ?? '',
      isActive: baseline.isActive,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.scope) {
      toast.error('Scope is required');
      return;
    }
    try {
      const payload = {
        ...form,
        scope: form.scope as Scope,
        methodology: form.methodology?.trim() ? form.methodology : undefined,
      };
      if (editingId) {
        await updateBaseline.mutateAsync({ id: editingId, ...payload });
        toast.success('Baseline updated successfully');
      } else {
        await createBaseline.mutateAsync(payload);
        toast.success('Baseline created successfully');
      }
      setModalOpen(false);
      setForm(INITIAL_FORM);
      setEditingId(null);
    } catch {
      toast.error('Failed to save baseline');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteBaseline.mutateAsync(deleteConfirmId);
      toast.success('Baseline deleted');
      setDeleteConfirmId(null);
    } catch {
      toast.error('Failed to delete baseline');
    }
  };

  const columns: TableColumn<Baseline>[] = [
    { key: 'name', label: 'Name' },
    {
      key: 'scope',
      label: 'Scope',
      render: (val) => {
        const s = val as Scope;
        return <Badge variant={SCOPE_VARIANT[s]}>{SCOPE_LABEL[s]}</Badge>;
      },
    },
    { key: 'baseYear', label: 'Base Year' },
    {
      key: 'value',
      label: 'Value',
      render: (val) => `${Number(val).toLocaleString()} tCO₂e`,
    },
    { key: 'unit', label: 'Unit' },
    { key: 'methodology', label: 'Methodology', render: (val) => (val as string | null) ?? '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (val) =>
        val ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="neutral">Inactive</Badge>
        ),
    },
    {
      key: 'id',
      label: 'Actions',
      width: '120px',
      render: (_val, row) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(row.id)} style={{ color: '#ef4444' }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const isSaving = createBaseline.isPending || updateBaseline.isPending;
  const canSubmit = !!form.name.trim() && !!form.scope && form.baseYear > 0 && form.value > 0;

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Emissions Baselines
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Manage your baseline emissions data for reduction tracking.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={openCreate}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Set Baseline
        </Button>
      </div>

      {/* Table */}
      <Card padding="none">
        {!isLoading && baselines.length === 0 ? (
          <EmptyState
            title="No baselines set"
            description="Create your first emissions baseline to start tracking reductions."
            action={{ label: 'Set Baseline', onClick: openCreate }}
          />
        ) : (
          <Table columns={columns} data={baselines} loading={isLoading} emptyMessage="No baselines found" />
        )}
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Baseline' : 'Set Baseline'}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={isSaving}
              disabled={!canSubmit}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g., 2020 Scope 1 Baseline"
          />
          <Select
            label="Scope"
            value={form.scope}
            onChange={(v) => setForm({ ...form, scope: v as Scope })}
            options={SCOPE_OPTIONS}
            placeholder="Select scope"
          />
          <Input
            label="Base Year"
            type="number"
            min={1990}
            max={2050}
            value={form.baseYear}
            onChange={(e) => setForm({ ...form, baseYear: Number(e.target.value) })}
          />
          <Input
            label="Value"
            type="number"
            min={0}
            step="0.01"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
            hint="Emissions value in the specified unit"
          />
          <Input
            label="Unit"
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
          />
          <Input
            label="Methodology"
            value={form.methodology ?? ''}
            onChange={(e) => setForm({ ...form, methodology: e.target.value })}
            hint="e.g., GHG Protocol, ISO 14064"
          />
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Delete Baseline"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleteBaseline.isPending}>
              Delete
            </Button>
          </>
        }
      >
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Are you sure you want to delete this baseline? This action cannot be undone and may affect
          associated targets.
        </p>
      </Modal>
    </div>
  );
}
