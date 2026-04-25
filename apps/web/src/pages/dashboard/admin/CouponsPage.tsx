import { useState, useCallback } from 'react';
import {
  useAdminCoupons,
  useCreateCoupon,
  useDeactivateCoupon,
  type CouponWithCount,
  type CreateCouponInput,
  type TrialTier,
} from '../../../hooks/useCoupons';
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

const TIER_OPTIONS: { value: TrialTier; label: string }[] = [
  { value: 'STARTER', label: 'Starter' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
];

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

interface CouponFormState {
  couponCode: string;
  chapterName: string;
  organizationName: string;
  trialDurationDays: string;
  trialTier: TrialTier;
  maxRedemptions: string;
  validUntil: string;
}

const INITIAL_FORM: CouponFormState = {
  couponCode: '',
  chapterName: '',
  organizationName: 'Hindu Economic Forum',
  trialDurationDays: '30',
  trialTier: 'PROFESSIONAL',
  maxRedemptions: '',
  validUntil: '',
};

function tierBadgeStyle(tier: TrialTier): React.CSSProperties {
  const map: Record<TrialTier, { bg: string; color: string; border: string }> = {
    STARTER: { bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: 'var(--border-primary)' },
    PROFESSIONAL: { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: 'rgba(59, 130, 246, 0.2)' },
    ENTERPRISE: { bg: 'rgba(168, 85, 247, 0.1)', color: '#9333ea', border: 'rgba(168, 85, 247, 0.2)' },
  };
  const s = map[tier];
  return { backgroundColor: s.bg, color: s.color, borderColor: s.border };
}

function formatRedemptions(coupon: CouponWithCount): string {
  if (coupon.maxRedemptions === null) {
    return `${coupon.currentRedemptions} / ∞`;
  }
  return `${coupon.currentRedemptions} / ${coupon.maxRedemptions}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export function CouponsPage() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponFormState>(INITIAL_FORM);

  const isActive = statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined;
  const { data, isLoading, isError } = useAdminCoupons({
    search: search || undefined,
    isActive,
    page,
    pageSize,
  });
  const createCoupon = useCreateCoupon();
  const deactivateCoupon = useDeactivateCoupon();

  const coupons = data?.items ?? [];
  const total = data?.total ?? 0;

  const openAddModal = useCallback(() => {
    setForm(INITIAL_FORM);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setForm(INITIAL_FORM);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.couponCode.trim() || !form.chapterName.trim() || !form.organizationName.trim()) {
      toast.error('Coupon code, chapter, and organization are required');
      return;
    }
    const trialDurationDays = parseInt(form.trialDurationDays, 10);
    if (Number.isNaN(trialDurationDays) || trialDurationDays < 1) {
      toast.error('Trial duration must be a positive integer');
      return;
    }
    const maxRedemptions = form.maxRedemptions.trim() === '' ? null : parseInt(form.maxRedemptions, 10);
    if (maxRedemptions !== null && (Number.isNaN(maxRedemptions) || maxRedemptions < 1)) {
      toast.error('Max redemptions must be a positive integer or blank for unlimited');
      return;
    }
    const payload: CreateCouponInput = {
      couponCode: form.couponCode.trim().toUpperCase(),
      chapterName: form.chapterName.trim(),
      organizationName: form.organizationName.trim(),
      trialDurationDays,
      trialTier: form.trialTier,
      maxRedemptions,
      validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : null,
    };
    try {
      await createCoupon.mutateAsync(payload);
      toast.success(`Coupon ${payload.couponCode} created`);
      closeModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create coupon';
      toast.error(message);
    }
  }, [form, createCoupon, closeModal, toast]);

  const handleDeactivate = useCallback(
    async (coupon: CouponWithCount) => {
      if (!window.confirm(`Deactivate ${coupon.couponCode}? Existing redemptions remain valid; new ones will be rejected.`)) return;
      try {
        await deactivateCoupon.mutateAsync(coupon.id);
        toast.success(`${coupon.couponCode} deactivated`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to deactivate coupon';
        toast.error(message);
      }
    },
    [deactivateCoupon, toast],
  );

  const columns: TableColumn<CouponWithCount>[] = [
    {
      key: 'couponCode',
      label: 'Code',
      render: (_val, c) => (
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.couponCode}</span>
      ),
    },
    {
      key: 'chapter',
      label: 'Chapter',
      render: (_val, c) => (
        <div>
          <div>{c.chapterName}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.organizationName}</div>
        </div>
      ),
    },
    {
      key: 'tier',
      label: 'Trial',
      render: (_val, c) => (
        <div>
          <Badge style={tierBadgeStyle(c.trialTier)}>{c.trialTier}</Badge>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            {c.trialDurationDays} days
          </div>
        </div>
      ),
    },
    {
      key: 'redemptions',
      label: 'Redemptions',
      render: (_val, c) => formatRedemptions(c),
    },
    {
      key: 'validity',
      label: 'Validity',
      render: (_val, c) => (
        <div style={{ fontSize: 13 }}>
          <div>From: {formatDate(c.validFrom)}</div>
          <div>Until: {formatDate(c.validUntil)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_val, c) =>
        c.isActive ? (
          <Badge style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderColor: 'rgba(34, 197, 94, 0.2)' }}>
            Active
          </Badge>
        ) : (
          <Badge style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderColor: 'var(--border-primary)' }}>
            Inactive
          </Badge>
        ),
    },
    {
      key: 'actions',
      label: '',
      render: (_val, c) =>
        c.isActive ? (
          <Button variant="ghost" onClick={() => handleDeactivate(c)} disabled={deactivateCoupon.isPending}>
            Deactivate
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Signup Coupons</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
            Trial-access vouchers (e.g., HEF chapter codes). Ported from AurexV3.
          </p>
        </div>
        <Button onClick={openAddModal}>+ New Coupon</Button>
      </div>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search coupon code or chapter…"
          />
          <Select
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={STATUS_FILTER_OPTIONS}
          />
        </div>
      </Card>

      {isLoading ? (
        <Card style={{ padding: 32, textAlign: 'center' }}>Loading…</Card>
      ) : isError ? (
        <Card style={{ padding: 32, textAlign: 'center', color: 'var(--text-error)' }}>
          Failed to load coupons. The HEF voucher API may not be deployed yet.
        </Card>
      ) : coupons.length === 0 ? (
        <EmptyState
          title="No coupons"
          description="Create your first coupon to grant trial access via a code."
          action={{ label: '+ New Coupon', onClick: openAddModal }}
        />
      ) : (
        <Card style={{ padding: 0 }}>
          <Table columns={columns} data={coupons} />
          <div style={{ padding: 12, borderTop: '1px solid var(--border-primary)' }}>
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={() => undefined}
            />
          </div>
        </Card>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title="New Coupon">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            label="Coupon code"
            value={form.couponCode}
            onChange={(e) => setForm({ ...form, couponCode: e.target.value })}
            placeholder="HEF-PUNE-2026"
            required
          />
          <Input
            label="Chapter"
            value={form.chapterName}
            onChange={(e) => setForm({ ...form, chapterName: e.target.value })}
            placeholder="Pune Chapter"
            required
          />
          <Input
            label="Organization"
            value={form.organizationName}
            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
            required
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Trial duration (days)"
              type="number"
              value={form.trialDurationDays}
              onChange={(e) => setForm({ ...form, trialDurationDays: e.target.value })}
              min="1"
              required
            />
            <Select
              label="Trial tier"
              value={form.trialTier}
              onChange={(v) => setForm({ ...form, trialTier: v as TrialTier })}
              options={TIER_OPTIONS}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Max redemptions"
              type="number"
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
              placeholder="Blank = unlimited"
              min="1"
            />
            <Input
              label="Valid until"
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
          <Button variant="secondary" onClick={closeModal} disabled={createCoupon.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createCoupon.isPending}>
            {createCoupon.isPending ? 'Creating…' : 'Create coupon'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
