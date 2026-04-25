/**
 * AAT-10B / Wave 10b: subscription manage page.
 *
 * Mounted at `/billing/manage`. The legacy `/billing` route redirects
 * here (see App.tsx). Composed from:
 *
 *   - <CurrentSubscriptionCard>  — plan label + status badge + endsAt countdown
 *   - <TrialBanner>              — only when status === TRIAL
 *   - <ChangePlanModal>          — 4-plan picker, opens fresh checkout
 *   - <CancelSubscriptionModal>  — destructive confirm, calls cancel mutation
 *   - <EmptyState>               — when the org has no subscription at all
 *
 * The page intentionally keeps the cancel + change-plan flows in modals
 * so they don't leak state into the page-level URL — these are short
 * confirmation flows, not their own routes.
 */
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { openRazorpayCheckout } from '../../../lib/razorpay';
import {
  useMySubscription,
  useCancelSubscription,
  useChangePlan,
  useFinaliseCheckout,
  type MySubscription,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '../../../hooks/useBilling';

// ── Plan catalogue (mirrors docs/PRICING.md + apps/api plans.ts) ─────────
//
// Kept inline rather than re-exported from the wizard so the manage page
// can rev independently. Keep the four entries in sync with PRICING.md.

interface PlanCard {
  code: SubscriptionPlan;
  label: string;
  priceLabel: string;
  perSiteScaling: boolean;
  region: 'INDIA' | 'INTERNATIONAL';
  scope: string;
}

const PLAN_CATALOGUE: PlanCard[] = [
  {
    code: 'MSME_INDIA',
    label: 'MSME India',
    priceLabel: '₹4,999 / yr',
    perSiteScaling: false,
    region: 'INDIA',
    scope: 'Scope 1+2',
  },
  {
    code: 'ENTERPRISE_INDIA',
    label: 'Enterprise India',
    priceLabel: '₹9,999 / site / yr',
    perSiteScaling: true,
    region: 'INDIA',
    scope: 'Scope 1+2',
  },
  {
    code: 'SME_INTERNATIONAL',
    label: 'SME International',
    priceLabel: '$999 / yr',
    perSiteScaling: false,
    region: 'INTERNATIONAL',
    scope: 'Scope 1+2',
  },
  {
    code: 'ENTERPRISE_INTL',
    label: 'Enterprise International',
    priceLabel: '$1,999 / site / yr',
    perSiteScaling: true,
    region: 'INTERNATIONAL',
    scope: 'Scope 1+2',
  },
];

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  MSME_INDIA: 'MSME India · ₹4,999/yr',
  ENTERPRISE_INDIA: 'Enterprise India · ₹9,999/site/yr',
  SME_INTERNATIONAL: 'SME International · $999/yr',
  ENTERPRISE_INTL: 'Enterprise International · $1,999/site/yr',
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  if (ms < 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function statusBadgeVariant(s: SubscriptionStatus): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (s) {
    case 'ACTIVE':
      return 'success';
    case 'TRIAL':
      return 'info';
    case 'PENDING':
      return 'warning';
    case 'PAYMENT_FAILED':
    case 'EXPIRED':
      return 'error';
    case 'CANCELLED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

// ── Page ─────────────────────────────────────────────────────────────────

export function BillingPage() {
  const { data, isLoading } = useMySubscription();
  const sub = data?.data ?? null;
  const cancel = useCancelSubscription();
  const changePlan = useChangePlan();
  const finalise = useFinaliseCheckout();
  const { user } = useAuth();
  const toast = useToast();

  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [confirmPlan, setConfirmPlan] = useState<{ plan: PlanCard; perSiteCount: number } | null>(null);

  const trialDays = useMemo(() => {
    if (sub?.status !== 'TRIAL') return null;
    return daysUntil(sub.endsAt);
  }, [sub]);

  if (isLoading) {
    return (
      <div style={{ maxWidth: '1200px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Billing and Subscription</h2>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      </div>
    );
  }

  if (!sub) {
    return (
      <div style={{ maxWidth: '1200px' }}>
        <PageHeader />
        <Card padding="lg">
          <EmptyState
            title="No active subscription"
            description="You don't have an active subscription. Start your trial via /onboarding."
            action={{
              label: 'Go to onboarding',
              onClick: () => {
                window.location.href = '/onboarding';
              },
            }}
          />
        </Card>
      </div>
    );
  }

  const handlePlanSelected = (plan: PlanCard, perSiteCount: number) => {
    setConfirmPlan({ plan, perSiteCount });
  };

  const handleConfirmChangePlan = () => {
    if (!confirmPlan) return;
    const { plan, perSiteCount } = confirmPlan;

    changePlan.mutate(
      { plan: plan.code, perSiteCount: plan.perSiteScaling ? perSiteCount : undefined },
      {
        onSuccess: async (init) => {
          if (init.skippedRazorpay) {
            toast.success('New plan activated.');
            setConfirmPlan(null);
            setPlanModalOpen(false);
            return;
          }
          if (!init.orderId || !init.keyId) {
            toast.error('Checkout session was not created — please retry.');
            return;
          }
          try {
            await openRazorpayCheckout({
              keyId: init.keyId,
              orderId: init.orderId,
              amount: init.amount,
              currency: init.currency,
              name: 'Aurex',
              description: `${plan.label} subscription`,
              prefill: {
                name: user?.name,
                email: user?.email,
              },
              themeColor: '#1a5d3d',
              onSuccess: (resp) => {
                finalise.mutate(
                  {
                    razorpayOrderId: resp.razorpay_order_id,
                    razorpayPaymentId: resp.razorpay_payment_id,
                    razorpaySignature: resp.razorpay_signature,
                  },
                  {
                    onSuccess: () => {
                      toast.success('Payment received — your new plan is live.');
                      setConfirmPlan(null);
                      setPlanModalOpen(false);
                    },
                    onError: (e: Error) => toast.error(e.message),
                  },
                );
              },
              onFailure: (failure) => {
                if (failure.reason === 'modal_closed') {
                  toast.error('Payment cancelled — try again when ready.');
                } else {
                  toast.error(failure.description ?? 'Payment failed — please try again.');
                }
              },
            });
          } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to open payment modal';
            toast.error(message);
          }
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const handleCancel = () => {
    cancel.mutate(undefined, {
      onSuccess: () => {
        toast.success('Subscription cancelled.');
        setCancelModalOpen(false);
      },
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <div style={{ maxWidth: '1200px' }}>
      <PageHeader />

      {sub.status === 'TRIAL' && (
        <TrialBanner days={trialDays} onChoosePlan={() => setPlanModalOpen(true)} />
      )}

      <CurrentSubscriptionCard sub={sub} />

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        {sub.status === 'ACTIVE' && (
          <Button variant="primary" onClick={() => setPlanModalOpen(true)}>
            Change plan
          </Button>
        )}
        {(sub.status === 'ACTIVE' || sub.status === 'TRIAL') && (
          <Button variant="danger" onClick={() => setCancelModalOpen(true)}>
            Cancel subscription
          </Button>
        )}
        <Link
          to="/billing/invoices"
          style={{ textDecoration: 'none' }}
        >
          <Button variant="outline">View invoices</Button>
        </Link>
      </div>

      <ChangePlanModal
        isOpen={planModalOpen && !confirmPlan}
        onClose={() => setPlanModalOpen(false)}
        onSelect={handlePlanSelected}
        currentPlan={sub.plan}
      />

      <ConfirmChangePlanModal
        isOpen={Boolean(confirmPlan)}
        onClose={() => setConfirmPlan(null)}
        targetPlan={confirmPlan?.plan ?? null}
        perSiteCount={confirmPlan?.perSiteCount ?? 1}
        currentEndsAt={sub.endsAt}
        onConfirm={handleConfirmChangePlan}
        loading={changePlan.isPending}
      />

      <CancelSubscriptionModal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        endsAt={sub.endsAt}
        onConfirm={handleCancel}
        loading={cancel.isPending}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        Billing and Subscription
      </h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
        Plan, contract status, invoices, and payment controls.
      </p>
    </div>
  );
}

function TrialBanner({ days, onChoosePlan }: { days: number | null; onChoosePlan: () => void }) {
  const copy =
    days === null
      ? 'Your free trial is active. Lock in a paid plan to keep using Aurex.'
      : days <= 0
        ? 'Your free trial has ended. Lock in a paid plan to keep using Aurex.'
        : `Your free trial ends in ${days} day${days === 1 ? '' : 's'}. Lock in a paid plan to keep using Aurex.`;
  return (
    <Card
      padding="md"
      style={{
        marginBottom: '1rem',
        borderColor: 'rgba(59, 130, 246, 0.3)',
        backgroundColor: 'rgba(59, 130, 246, 0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            Free trial active
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{copy}</p>
        </div>
        <Button variant="primary" onClick={onChoosePlan} aria-label="Choose plan">
          Choose plan
        </Button>
      </div>
    </Card>
  );
}

function CurrentSubscriptionCard({ sub }: { sub: MySubscription }) {
  const planLabel = PLAN_LABEL[sub.plan] ?? sub.plan;
  const endsCountdown = daysUntil(sub.endsAt);
  const countdownLabel =
    endsCountdown === null
      ? '—'
      : endsCountdown === 0
        ? 'Today'
        : `${endsCountdown} day${endsCountdown === 1 ? '' : 's'}`;
  return (
    <Card padding="lg">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
            Current plan
          </p>
          <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>{planLabel}</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {sub.perSiteCount > 1 ? `${sub.perSiteCount} sites · ` : ''}
            {sub.region === 'INDIA' ? 'India region' : 'International region'}
          </p>
        </div>
        <Badge variant={statusBadgeVariant(sub.status)}>{sub.status}</Badge>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginTop: '1.5rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid var(--border-primary)',
        }}
      >
        <FieldBlock label="Started" value={formatDate(sub.startsAt)} />
        <FieldBlock label="Ends" value={formatDate(sub.endsAt)} />
        <FieldBlock label="Time remaining" value={countdownLabel} />
        <FieldBlock label="Coupon" value={sub.appliedCouponCode ?? '—'} />
      </div>
    </Card>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (plan: PlanCard, perSiteCount: number) => void;
  currentPlan: SubscriptionPlan;
}

function ChangePlanModal({ isOpen, onClose, onSelect, currentPlan }: ChangePlanModalProps) {
  const [perSiteCount, setPerSiteCount] = useState(1);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change plan" size="lg">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        {PLAN_CATALOGUE.map((plan) => {
          const isCurrent = plan.code === currentPlan;
          return (
            <Card
              key={plan.code}
              padding="md"
              style={{
                borderColor: isCurrent ? '#1a5d3d' : undefined,
                opacity: isCurrent ? 0.6 : 1,
              }}
            >
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>{plan.label}</p>
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1a5d3d', marginTop: '0.25rem' }}>{plan.priceLabel}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                {plan.region === 'INDIA' ? 'India' : 'International'} · {plan.scope}
              </p>
              {plan.perSiteScaling && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Sites</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={perSiteCount}
                    onChange={(e) => setPerSiteCount(Math.max(1, Number(e.target.value) || 1))}
                    style={{
                      width: '100%',
                      padding: '0.375rem',
                      marginTop: '0.25rem',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              )}
              <div style={{ marginTop: '1rem' }}>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  disabled={isCurrent}
                  onClick={() => onSelect(plan, perSiteCount)}
                  aria-label={`Select ${plan.label}`}
                >
                  {isCurrent ? 'Current plan' : 'Select'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </Modal>
  );
}

interface ConfirmChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPlan: PlanCard | null;
  perSiteCount: number;
  currentEndsAt: string | null;
  onConfirm: () => void;
  loading: boolean;
}

function ConfirmChangePlanModal({
  isOpen,
  onClose,
  targetPlan,
  perSiteCount,
  currentEndsAt,
  onConfirm,
  loading,
}: ConfirmChangePlanModalProps) {
  if (!targetPlan) return null;
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm plan change"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={loading}>
            Confirm and continue to payment
          </Button>
        </>
      }
    >
      <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
        You're switching to <strong>{targetPlan.label}</strong>
        {targetPlan.perSiteScaling ? ` (${perSiteCount} site${perSiteCount === 1 ? '' : 's'})` : ''}.
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
        Your current subscription will end at <strong>{formatDate(currentEndsAt)}</strong>; the new plan
        will take over after payment is confirmed.
      </p>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
        You will be redirected to Razorpay to complete payment for {targetPlan.priceLabel}.
      </p>
    </Modal>
  );
}

interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  endsAt: string | null;
  onConfirm: () => void;
  loading: boolean;
}

function CancelSubscriptionModal({
  isOpen,
  onClose,
  endsAt,
  onConfirm,
  loading,
}: CancelSubscriptionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cancel subscription?"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep subscription
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            Cancel subscription
          </Button>
        </>
      }
    >
      <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
        Are you sure?
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        Your current period continues until <strong>{formatDate(endsAt)}</strong>; no refund is issued for
        the unused portion. After that date, your access will be downgraded to read-only.
      </p>
    </Modal>
  );
}
