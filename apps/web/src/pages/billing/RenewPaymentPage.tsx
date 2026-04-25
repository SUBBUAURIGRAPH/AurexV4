/**
 * AAT-10B / Wave 10b: renewal payment landing page.
 *
 * Mounted at `/billing/renew/:renewalAttemptId`. The renewal-reminder email
 * (sent by the Wave 8c worker) deep-links here so the customer doesn't
 * have to navigate the dashboard to find their pending renewal.
 *
 * Flow:
 *   1. GET /billing/renewal-attempts/:id  — show plan + period + amount
 *   2. POST /billing/renewal-attempts/:id/checkout — mint or re-use the
 *      Razorpay order
 *   3. Open Razorpay Checkout modal
 *   4. POST /billing/checkout/success → /checkout/success route auto-detects
 *      that this order is renewal-tagged and dispatches to the renewal
 *      capture path (extends endsAt; does NOT reset to now)
 *   5. Success → toast + navigate to /billing/manage
 *
 * Auth required — but the page works for any active org member, not just
 * ORG_ADMIN. The customer who clicks the email link may not be the admin
 * who set up the subscription. The cancel-pay-here behaviour is identical
 * across roles.
 */
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { openRazorpayCheckout } from '../../lib/razorpay';
import {
  useRenewalAttempt,
  useStartRenewalCheckout,
  useFinaliseCheckout,
  type SubscriptionPlan,
} from '../../hooks/useBilling';

const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  MSME_INDIA: 'MSME India · ₹4,999/yr',
  ENTERPRISE_INDIA: 'Enterprise India · ₹9,999/site/yr',
  SME_INTERNATIONAL: 'SME International · $999/yr',
  ENTERPRISE_INTL: 'Enterprise International · $1,999/site/yr',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrencyMinor(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  if (currency === 'INR') {
    return `₹${major.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (currency === 'USD') {
    return `$${major.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function RenewPaymentPage() {
  const { renewalAttemptId } = useParams<{ renewalAttemptId: string }>();
  const { data, isLoading, error } = useRenewalAttempt(renewalAttemptId);
  const startRenewalCheckout = useStartRenewalCheckout();
  const finalise = useFinaliseCheckout();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  if (isLoading) {
    return (
      <div style={{ maxWidth: '720px', margin: '2rem auto', padding: '0 1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Renew your subscription</h2>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
      </div>
    );
  }

  if (error || !data?.data) {
    return (
      <div style={{ maxWidth: '720px', margin: '2rem auto', padding: '0 1.5rem' }}>
        <Card padding="lg">
          <EmptyState
            title="Renewal not found"
            description="This renewal link is invalid or has expired. Return to billing to start a new renewal."
            action={{
              label: 'Go to billing',
              onClick: () => navigate('/billing/manage'),
            }}
          />
        </Card>
      </div>
    );
  }

  const attempt = data.data;
  const planLabel = PLAN_LABEL[attempt.subscription.plan] ?? attempt.subscription.plan;
  const alreadyPaid = attempt.status === 'PAID';
  const cancelled = attempt.status === 'CANCELLED';

  const handleRenew = () => {
    if (!renewalAttemptId) return;
    startRenewalCheckout.mutate(renewalAttemptId, {
      onSuccess: async (init) => {
        try {
          await openRazorpayCheckout({
            keyId: init.keyId,
            orderId: init.orderId,
            amount: init.amount,
            currency: init.currency,
            name: 'Aurex',
            description: `${planLabel} renewal`,
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
                    toast.success('Renewal payment received — your subscription has been extended.');
                    navigate('/billing/manage');
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
    });
  };

  return (
    <div style={{ maxWidth: '720px', margin: '2rem auto', padding: '0 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Renew your subscription
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
          Pay to extend your Aurex subscription for another period.
        </p>
      </div>

      <Card padding="lg">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <p
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                letterSpacing: '0.05em',
              }}
            >
              Plan
            </p>
            <h3 style={{ fontSize: '1.125rem', color: 'var(--text-primary)', marginTop: '0.5rem' }}>
              {planLabel}
            </h3>
          </div>
          <Badge
            variant={
              alreadyPaid ? 'success' : cancelled ? 'neutral' : attempt.status === 'FAILED' ? 'error' : 'info'
            }
          >
            {attempt.status}
          </Badge>
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
          <Field label="Period start" value={formatDate(attempt.periodStart)} />
          <Field label="Period end" value={formatDate(attempt.periodEnd)} />
          <Field
            label="Amount"
            value={formatCurrencyMinor(attempt.amountMinor, attempt.currency)}
            emphasize
          />
        </div>

        {alreadyPaid && (
          <p
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
            }}
          >
            This renewal has already been paid. Your subscription is extended through
            {' '}
            <strong>{formatDate(attempt.periodEnd)}</strong>.
          </p>
        )}

        {cancelled && (
          <p
            style={{
              marginTop: '1.25rem',
              padding: '0.75rem',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
            }}
          >
            This renewal was cancelled. Please contact support if you'd like to reactivate it.
          </p>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            disabled={alreadyPaid || cancelled}
            loading={startRenewalCheckout.isPending || finalise.isPending}
            onClick={handleRenew}
          >
            Renew now
          </Button>
          <Button variant="outline" onClick={() => navigate('/billing/manage')}>
            Back to billing
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p
        style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          letterSpacing: '0.05em',
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: emphasize ? '1rem' : '0.875rem',
          fontWeight: emphasize ? 700 : 600,
          color: emphasize ? '#1a5d3d' : 'var(--text-primary)',
        }}
      >
        {value}
      </p>
    </div>
  );
}
