import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Table, TableColumn } from '../../../components/ui/Table';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Stepper } from '../../../components/ui/Stepper';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
  useTargets,
  useCreateTarget,
  useApproveTarget,
  useTargetProgress,
  Target,
  CreateTargetData,
  Pathway,
} from '../../../hooks/useTargets';
import { useBaselines, Baseline, Scope } from '../../../hooks/useBaselines';
import { TargetProgressChart } from '../../../components/charts/TargetProgressChart';

/* ============================================
   Constants
   ============================================ */

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

const PATHWAY_OPTIONS: { value: Pathway; label: string }[] = [
  { value: 'CELSIUS_1_5', label: '1.5°C' },
  { value: 'WELL_BELOW_2', label: 'Well Below 2°C' },
  { value: 'CELSIUS_2', label: '2°C' },
];

const PATHWAY_DESCRIPTIONS: Record<Pathway, string> = {
  CELSIUS_1_5: 'Aligned with limiting global warming to 1.5°C above pre-industrial levels. Most ambitious pathway.',
  WELL_BELOW_2: 'Aligned with keeping warming well below 2°C. Recommended by the Paris Agreement.',
  CELSIUS_2: 'Aligned with limiting warming to 2°C. Minimum acceptable ambition for science-based targets.',
};

const PATHWAY_BADGE: Record<Pathway, 'success' | 'warning' | 'error'> = {
  CELSIUS_1_5: 'success',
  WELL_BELOW_2: 'warning',
  CELSIUS_2: 'error',
};

const PATHWAY_SHORT: Record<Pathway, string> = {
  CELSIUS_1_5: '1.5°C',
  WELL_BELOW_2: 'WB 2°C',
  CELSIUS_2: '2°C',
};

const WIZARD_STEPS = [
  { label: 'Scope & Baseline' },
  { label: 'Target Details' },
  { label: 'SBTi Pathway' },
  { label: 'Review' },
];

const ADMIN_ROLES = ['administrator', 'super_admin', 'org_admin'];

type WizardForm = CreateTargetData & { baseline_id?: string; pathway: Pathway };

const INITIAL_FORM: WizardForm = {
  name: '',
  scope: '',
  targetYear: 2030,
  reduction: 50,
  pathway: 'CELSIUS_1_5',
};

/* ============================================
   Component
   ============================================ */

export function TargetsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { data: targetsData, isLoading } = useTargets();
  const { data: baselinesData } = useBaselines();
  const createTarget = useCreateTarget();
  const approveTarget = useApproveTarget();

  const targets = targetsData?.data ?? [];
  const baselines = baselinesData?.data ?? [];

  const isAdmin = user?.role ? ADMIN_ROLES.includes(user.role) : false;

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(INITIAL_FORM);
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);

  const openWizard = () => {
    setWizardStep(0);
    setForm(INITIAL_FORM);
    setWizardOpen(true);
  };

  const handleBaselineSelect = (baselineId: string) => {
    const bl = baselines.find((b: Baseline) => b.id === baselineId);
    if (bl) {
      setForm((f) => ({
        ...f,
        baseline_id: baselineId,
        scope: bl.scope,
      }));
    }
  };

  const canAdvance = (): boolean => {
    switch (wizardStep) {
      case 0:
        return !!form.scope;
      case 1:
        return !!form.name && form.targetYear > new Date().getFullYear() && form.reduction > 0 && form.reduction <= 100;
      case 2:
        return !!form.pathway;
      default:
        return true;
    }
  };

  const handleCreate = async () => {
    if (!form.scope) return;
    try {
      const { baseline_id: _unused, ...rest } = form;
      const payload: CreateTargetData = {
        name: rest.name,
        scope: rest.scope,
        targetYear: rest.targetYear,
        reduction: rest.reduction,
        pathway: rest.pathway,
      };
      await createTarget.mutateAsync(payload);
      toast.success('Target created successfully');
      setWizardOpen(false);
    } catch {
      toast.error('Failed to create target');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveTarget.mutateAsync(id);
      toast.success('Target approved');
    } catch {
      toast.error('Failed to approve target');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTargetId(expandedTargetId === id ? null : id);
  };

  const columns: TableColumn<Target>[] = [
    { key: 'name', label: 'Name' },
    {
      key: 'scope',
      label: 'Scope',
      render: (val) => {
        const s = val as Scope;
        return <Badge variant={SCOPE_VARIANT[s]}>{SCOPE_LABEL[s]}</Badge>;
      },
    },
    { key: 'targetYear', label: 'Target Year' },
    {
      key: 'reduction',
      label: 'Reduction %',
      render: (val) => `${val}%`,
    },
    {
      key: 'pathway',
      label: 'SBTi Pathway',
      render: (val) => {
        if (!val) return <span style={{ color: 'var(--text-tertiary)' }}>—</span>;
        const p = val as Pathway;
        return <Badge variant={PATHWAY_BADGE[p]}>{PATHWAY_SHORT[p]}</Badge>;
      },
    },
    {
      key: 'isApproved',
      label: 'Status',
      render: (val, row) => {
        if (val) {
          return <Badge variant="success">Approved</Badge>;
        }
        if (isAdmin) {
          return (
            <Button variant="outline" size="sm" onClick={() => handleApprove(row.id)}>
              Approve
            </Button>
          );
        }
        return <Badge variant="warning">Pending</Badge>;
      },
    },
    {
      key: 'id',
      label: 'Actions',
      width: '80px',
      render: (_val, row) => (
        <Button variant="ghost" size="sm" onClick={() => toggleExpanded(row.id)}>
          {expandedTargetId === row.id ? 'Hide' : 'Details'}
        </Button>
      ),
    },
  ];

  const baselineOptions = baselines.map((b: Baseline) => ({
    value: b.id,
    label: `${SCOPE_LABEL[b.scope]} — ${b.baseYear} (${Number(b.value).toLocaleString()} ${b.unit})`,
  }));

  const selectedPathwayDesc = PATHWAY_DESCRIPTIONS[form.pathway];

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Reduction Targets
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Set science-based reduction targets and track progress.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={openWizard}
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          }
        >
          Add Target
        </Button>
      </div>

      {/* Table */}
      <Card padding="none">
        {!isLoading && targets.length === 0 ? (
          <EmptyState
            title="No targets defined"
            description="Create your first reduction target to begin your decarbonization journey."
            action={{ label: 'Add Target', onClick: openWizard }}
          />
        ) : (
          <>
            <Table columns={columns} data={targets} loading={isLoading} emptyMessage="No targets found" />
            {expandedTargetId && (
              <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-primary)' }}>
                <TargetProgressDetail targetId={expandedTargetId} />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Wizard Modal */}
      <Modal
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        title="Add Reduction Target"
        size="lg"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <div>
              {wizardStep > 0 && (
                <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                  Back
                </Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="outline" onClick={() => setWizardOpen(false)}>
                Cancel
              </Button>
              {wizardStep < 3 ? (
                <Button
                  variant="primary"
                  onClick={() => setWizardStep(wizardStep + 1)}
                  disabled={!canAdvance()}
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleCreate}
                  loading={createTarget.isPending}
                >
                  Confirm & Create
                </Button>
              )}
            </div>
          </div>
        }
      >
        <Stepper steps={WIZARD_STEPS} currentStep={wizardStep} />

        {wizardStep === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Select
              label="Scope"
              value={form.scope}
              onChange={(v) => setForm({ ...form, scope: v as Scope })}
              options={SCOPE_OPTIONS}
              placeholder="Select scope"
            />
            {baselines.length > 0 && (
              <Select
                label="Link to Baseline (optional)"
                value={form.baseline_id || ''}
                onChange={handleBaselineSelect}
                options={baselineOptions}
                placeholder="Select a baseline"
              />
            )}
            {baselines.length === 0 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No baselines available. You can still set a target manually.
              </p>
            )}
          </div>
        )}

        {wizardStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              label="Target Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Net Zero Scope 1 by 2030"
            />
            <Input
              label="Target Year"
              type="number"
              min={new Date().getFullYear() + 1}
              max={2100}
              value={form.targetYear}
              onChange={(e) => setForm({ ...form, targetYear: Number(e.target.value) })}
            />
            <Input
              label="Reduction Percentage"
              type="number"
              min={1}
              max={100}
              value={form.reduction}
              onChange={(e) => setForm({ ...form, reduction: Number(e.target.value) })}
              hint="Percentage reduction from baseline"
            />
          </div>
        )}

        {wizardStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Select the Science Based Targets initiative pathway for this reduction target.
            </p>
            {PATHWAY_OPTIONS.map((pw) => {
              const isSelected = form.pathway === pw.value;
              return (
                <div
                  key={pw.value}
                  onClick={() => setForm({ ...form, pathway: pw.value })}
                  style={{
                    padding: '1rem 1.25rem',
                    borderRadius: '0.625rem',
                    border: isSelected ? '2px solid #1a5d3d' : '1.5px solid var(--border-secondary)',
                    backgroundColor: isSelected ? 'rgba(26, 93, 61, 0.04)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.375rem' }}>
                    <div
                      style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        borderRadius: '50%',
                        border: isSelected ? '6px solid #1a5d3d' : '2px solid var(--border-secondary)',
                        transition: 'all 150ms',
                      }}
                    />
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                      {pw.label}
                    </span>
                    <Badge variant={PATHWAY_BADGE[pw.value]}>{pw.label}</Badge>
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginLeft: '2rem', lineHeight: 1.5 }}>
                    {PATHWAY_DESCRIPTIONS[pw.value]}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {wizardStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Review Your Target
            </h4>
            <ReviewRow label="Name" value={form.name} />
            <ReviewRow label="Scope" value={form.scope ? SCOPE_LABEL[form.scope as Scope] : '—'} />
            <ReviewRow label="Target Year" value={String(form.targetYear)} />
            <ReviewRow label="Reduction" value={`${form.reduction}%`} />
            <ReviewRow
              label="SBTi Pathway"
              value={PATHWAY_OPTIONS.find((p) => p.value === form.pathway)?.label ?? ''}
            />
            {selectedPathwayDesc && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', lineHeight: 1.5 }}>
                {selectedPathwayDesc}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ============================================
   Sub-components
   ============================================ */

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-primary)' }}>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function TargetProgressDetail({ targetId }: { targetId: string }) {
  const { data: progressData, isLoading } = useTargetProgress(targetId);
  const progress = progressData?.data ?? [];

  if (isLoading) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
        Loading progress data...
      </div>
    );
  }

  if (progress.length === 0) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
        No progress recorded yet for this target.
      </div>
    );
  }

  return <TargetProgressChart data={progress} title="Progress Tracking" />;
}
