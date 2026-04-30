/**
 * PricingPage — public pricing surface with the HEF Pune 2026 special
 * offer pinned at the top.
 *
 * Ports the V3 PricingSection pattern (3 tier cards) and adds a
 * dedicated "Special Offer" card for the HEF-PUNE-2026 voucher.
 *
 * The HEF card is the single source of truth for the offer copy on the
 * marketing surface — the trial duration / tier / discount tiers are
 * sourced from the live coupon-validate response so the card stays in
 * lockstep with the seed (`packages/database/src/seed-master-data.ts`)
 * and the prod row in `signup_coupons`.
 *
 * CTA goes to /signup/voucher?code=HEF-PUNE-2026 — that page enforces
 * the voucher-first signup gate (validate the code BEFORE collecting
 * user / org details).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useValidateCoupon, type ValidateCouponResult } from '../../hooks/useCoupons';

const HEF_CODE = 'HEF-PUNE-2026';

interface DiscountTier {
  from_redemption: number;
  to_redemption: number | null;
  discount_percentage: number;
  label: string;
  effective_price_inr?: number;
  gst_percentage?: number;
}

function readDiscountTiers(metadata: Record<string, unknown> | undefined): DiscountTier[] {
  if (!metadata) return [];
  const raw = metadata.discount_tiers;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (t): t is DiscountTier =>
      typeof t === 'object' && t !== null && typeof (t as DiscountTier).label === 'string',
  );
}

interface PlanCardProps {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
}

const STARTER: PlanCardProps = {
  name: 'Starter',
  price: '$49',
  cadence: '/ month',
  description: 'For small teams beginning their sustainability journey.',
  features: [
    'Up to 20 team members',
    'Up to 3 locations',
    'Scope 1 + 2 emissions',
    'BRSR (India) reporting',
    'Email support, 24h response',
    '1-year data retention',
  ],
  cta: 'Start free trial',
  ctaHref: '/register',
};

const PROFESSIONAL: PlanCardProps = {
  name: 'Professional',
  price: '$199',
  cadence: '/ month',
  description: 'For growing companies with full-spectrum sustainability needs.',
  features: [
    'Up to 100 team members',
    'Up to 10 locations',
    'Full Scope 1, 2 & 3 emissions',
    'BRSR + GRI + CDP reporting',
    'Advanced analytics & AI insights',
    'Priority support, 12h response',
    '3-year data retention',
  ],
  cta: 'Start free trial',
  ctaHref: '/register',
  highlighted: true,
};

const ENTERPRISE: PlanCardProps = {
  name: 'Enterprise',
  price: 'Custom',
  cadence: '',
  description: 'For large organisations with global operations.',
  features: [
    'Unlimited team members + locations',
    'Full GHG + supply-chain coverage',
    'BRSR + GRI + CDP + TCFD',
    'White-label customisation',
    'Dedicated CSM + 24/7 support',
    'Custom SLA (99.9% uptime)',
    'On-prem deployment option',
  ],
  cta: 'Contact sales',
  ctaHref: 'mailto:contact@aurex.in?subject=Enterprise%20pricing',
};

export function PricingPage() {
  const [hef, setHef] = useState<ValidateCouponResult | null>(null);
  const validate = useValidateCoupon();

  // Pull live HEF coupon details so the offer card always reflects what
  // the backend will actually grant — single round-trip on mount.
  useEffect(() => {
    validate.mutate(
      { code: HEF_CODE },
      { onSuccess: (data) => setHef(data) },
    );
    // useValidateCoupon's mutate identity is stable per TanStack Query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-secondary)', padding: '4rem 1.5rem' }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            Simple, transparent pricing
          </h1>
          <p style={{ fontSize: '1.0625rem', color: 'var(--text-tertiary)', maxWidth: '640px', margin: '0 auto' }}>
            Pick the plan that fits. Start a free trial in minutes — no credit card required.
          </p>
        </div>

        {/* HEF Pune 2026 special offer — pinned above the standard tiers */}
        <HefSpecialOfferCard hef={hef} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginTop: '2.5rem',
          }}
        >
          <PlanCard {...STARTER} />
          <PlanCard {...PROFESSIONAL} />
          <PlanCard {...ENTERPRISE} />
        </div>

        <p style={{ textAlign: 'center', marginTop: '3rem', fontSize: '0.875rem', color: 'var(--text-tertiary)' }}>
          Have a different voucher? Enter it on the{' '}
          <Link to="/signup/voucher" style={{ color: '#10b981', fontWeight: 600 }}>
            voucher signup page
          </Link>{' '}
          before creating your organisation.
        </p>
      </div>
    </div>
  );
}

// ─── HEF special-offer card ──────────────────────────────────────────────

function HefSpecialOfferCard({ hef }: { hef: ValidateCouponResult | null }) {
  const valid = hef?.valid === true && hef?.coupon != null;
  const c = valid ? hef!.coupon! : null;
  const tiers = readDiscountTiers(c?.metadata);

  return (
    <section
      aria-label="Hindu Economic Forum Pune 2026 special offer"
      style={{
        position: 'relative',
        padding: '2rem',
        borderRadius: '1rem',
        border: '1px solid rgba(16, 185, 129, 0.4)',
        background:
          'linear-gradient(135deg, rgba(16, 185, 129, 0.10), rgba(26, 93, 61, 0.10))',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-0.75rem',
          left: '1.5rem',
          backgroundColor: '#10b981',
          color: '#fff',
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          padding: '0.25rem 0.625rem',
          borderRadius: '999px',
          textTransform: 'uppercase',
        }}
      >
        Special Offer
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#047857', marginBottom: '0.25rem' }}>
            Hindu Economic Forum · Pune 2026
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {c
              ? `${c.trialDurationDays}-day ${c.trialTier.charAt(0)}${c.trialTier.slice(1).toLowerCase()} trial`
              : '365-day Professional trial'}
          </h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {tiers.length >= 2 ? (
              <>
                <strong>First {tiers[0]!.to_redemption ?? 100} redemptions:</strong>{' '}
                {tiers[0]!.label.toLowerCase()}.<br />
                <strong>Beyond that:</strong> {tiers[1]!.label.toLowerCase()}
                {typeof tiers[1]!.effective_price_inr === 'number'
                  ? ` — ₹${tiers[1]!.effective_price_inr.toLocaleString('en-IN')}`
                  : ''}
                {typeof tiers[1]!.gst_percentage === 'number' ? ` + ${tiers[1]!.gst_percentage}% GST.` : '.'}
              </>
            ) : (
              <>First 100 redemptions: free for the first year. Beyond that: 50% off — ₹2,499 + 18% GST.</>
            )}
          </p>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.875rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              backgroundColor: 'rgba(255, 255, 255, 0.5)',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: '#047857',
            }}
          >
            <span style={{ opacity: 0.7 }}>Code</span>
            <span style={{ letterSpacing: '0.06em' }}>{HEF_CODE}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '220px' }}>
          <Link
            to={`/signup/voucher?code=${HEF_CODE}`}
            style={{
              padding: '0.875rem 1.5rem',
              backgroundColor: '#10b981',
              color: '#fff',
              borderRadius: '0.5rem',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.9375rem',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            Claim with {HEF_CODE}
          </Link>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'center', margin: 0 }}>
            Voucher submitted before account creation.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Standard plan card ──────────────────────────────────────────────────

function PlanCard({ name, price, cadence, description, features, cta, ctaHref, highlighted }: PlanCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '2rem 1.5rem',
        borderRadius: '1rem',
        backgroundColor: 'var(--bg-card)',
        border: highlighted ? '1.5px solid #10b981' : '1px solid var(--border-primary)',
        boxShadow: highlighted ? '0 12px 32px rgba(16, 185, 129, 0.15)' : 'var(--shadow-md)',
        transform: highlighted ? 'translateY(-4px)' : undefined,
      }}
    >
      {highlighted && (
        <div
          style={{
            position: 'absolute',
            top: '-0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10b981',
            color: '#fff',
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '0.25rem 0.75rem',
            borderRadius: '999px',
            textTransform: 'uppercase',
          }}
        >
          Most Popular
        </div>
      )}
      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
        {name}
      </h3>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', marginBottom: '1.25rem', minHeight: '2.5rem' }}>
        {description}
      </p>
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{price}</span>
        {cadence && (
          <span style={{ fontSize: '0.9375rem', color: 'var(--text-tertiary)', marginLeft: '0.25rem' }}>{cadence}</span>
        )}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1.75rem' }}>
        {features.map((f) => (
          <li
            key={f}
            style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.625rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
          >
            <span style={{ color: '#10b981', fontWeight: 700, lineHeight: 1.3 }}>✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {ctaHref.startsWith('mailto:') ? (
        <a
          href={ctaHref}
          style={{
            display: 'block',
            padding: '0.75rem 1rem',
            backgroundColor: highlighted ? '#10b981' : 'var(--bg-secondary)',
            color: highlighted ? '#fff' : 'var(--text-primary)',
            border: highlighted ? 'none' : '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
            textAlign: 'center',
          }}
        >
          {cta}
        </a>
      ) : (
        <Link
          to={ctaHref}
          style={{
            display: 'block',
            padding: '0.75rem 1rem',
            backgroundColor: highlighted ? '#10b981' : 'var(--bg-secondary)',
            color: highlighted ? '#fff' : 'var(--text-primary)',
            border: highlighted ? 'none' : '1px solid var(--border-primary)',
            borderRadius: '0.5rem',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9375rem',
            textAlign: 'center',
          }}
        >
          {cta}
        </Link>
      )}
    </div>
  );
}
