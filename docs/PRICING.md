# Aurex Pricing — Subscription Tiers + HEF-Pune-2026 Voucher

Last updated: 2026-04-25.

## Standard subscription pricing

The default Aurex subscription covers **Scope 1 + 2 only**. Scope 3 is sold
separately as a custom add-on regardless of region or customer tier — every
customer must contact `contact@aurex.in` for Scope 3 pricing.

### India (INR)

| Customer | Annual | Coverage |
|---|---|---|
| **MSME** (Standard) | **₹4,999** | Scope 1 + 2 |
| **Large enterprise** (per site) | **₹9,999** | Scope 1 + 2 |
| **Scope 3** (any size) | Custom | `contact@aurex.in` |

INR prices are exclusive of GST (currently 18%).

### International (USD)

| Customer | Annual | Coverage |
|---|---|---|
| **SME** (Standard) | **$999** | Scope 1 + 2 |
| **Enterprise** (per site) | **$1,999** | Scope 1 + 2 |
| **Scope 3** (any size) | Custom | `contact@aurex.in` |

USD prices are exclusive of any local indirect taxes (VAT/GST/sales tax)
which are billed per the customer's invoicing jurisdiction.

## HEF-Pune-2026 voucher

The Hindu Economic Forum (HEF), Pune Chapter, signup voucher for 2026.

**Code:** `HEF-PUNE-2026`
**Validity:** Until 2027-12-31
**Tier:** Professional — full Aurex feature set, Scope 1 + 2 (Scope 3 remains contact-us)

### Two redemption tiers

| Tier | Redemption window | Effective price | Trial |
|---|---|---|---|
| **First 100 users** | Redemptions 1–100 | **Free** for the first year | 365-day Professional trial |
| **Early-bird** | Redemptions 101+ | **50% off → ₹2,499 + 18% GST** | 365-day Professional trial, billed at end |

After the trial ends or the discount period expires, customers are billed at the standard MSME rate (₹4,999) unless they switch to a different plan.

### Eligibility

- Members of the Hindu Economic Forum, Pune Chapter
- Verified via the chapter coordinator's distribution of the voucher code (the platform does not perform external HEF membership verification)
- Per binding requirement: one redemption per email address (enforced by `CouponRedemption.@@unique([couponId, userEmail])`)

### Operational notes

- Voucher metadata captures the `discount_tiers` array; tier-aware billing logic is **deferred** until Aurex billing is wired (no Razorpay/Stripe integration yet — see ADM follow-up)
- Once Aurex billing is built, the redemption flow should:
  1. Read `currentRedemptions`
  2. Match the redemption count against `metadata.discount_tiers[].from..to`
  3. Apply the matching `discount_percentage` (or `price_inr`) to the user's first-year invoice
- Until billing is live, the voucher grants the trial window; trial-to-paid conversion is manual via `POST /api/v1/admin/coupons/:id/redemptions/:redemptionId/mark-converted`

### Distribution channel

- HEF Pune Chapter coordinator distributes the voucher code via the chapter mailing list / events
- The platform does not generate physical or digital "voucher artifacts" — the code itself is the voucher

### Contact

- Voucher questions: `contact@aurex.in`
- HEF chapter liaison: TBD (placeholder — Aurex Compliance to confirm)

## Payment processing

Aurex uses **Razorpay** as the single payment gateway for both INR and
USD checkouts. Razorpay's multi-currency settlement covers both markets,
so we deliberately do **not** integrate Stripe — one gateway, one set of
keys, one webhook surface.

### Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/v1/billing/checkout` | JWT (ORG_ADMIN) | Create a subscription + Razorpay order; returns `{ orderId, keyId, amount, currency }` for the client-side Checkout modal |
| `POST /api/v1/billing/checkout/success` | JWT | Verify the client-side payment signature + activate (belt-and-braces) |
| `POST /api/v1/billing/webhook/razorpay` | None (HMAC-signed) | Authoritative payment-state source; idempotent on `X-Razorpay-Event-Id` |
| `GET /api/v1/billing/subscriptions/me` | JWT | Caller-org's active subscription |
| `GET /api/v1/billing/invoices` | JWT | Caller-org's invoices |

### Webhook URL

Production: `https://aurex.in/api/v1/billing/webhook/razorpay`

The handler verifies `X-Razorpay-Signature` (HMAC-SHA256 of the raw body
with `RAZORPAY_WEBHOOK_SECRET`) before any state change. **Always
returns HTTP 200** even on processing failures — Razorpay retries
non-2xx for up to 24 hours, and we already persist every event for
audit. Idempotency is enforced on `razorpayEventId`.

### Money handling

All amounts stored as integer minor units:
- INR → paise. ₹4,999 = `499900`.
- USD → cents. $999 = `99900`.

INR plans add 18% GST at checkout; international plans defer tax to the
customer's invoicing jurisdiction.

### Coupon integration

When `couponCode` is supplied to `/checkout`:
1. The coupon is validated (existence, active, valid-window, dedup).
2. `couponService.redeemCoupon` runs atomically and increments `currentRedemptions`.
3. The post-increment redemption count picks the matching tier in `metadata.discount_tiers`.
4. The discount is applied to the subtotal; tax is recomputed on the discounted amount.
5. **Edge case** — when the resulting total is `0` (e.g. HEF first-100 free tier),
   the service short-circuits past Razorpay (which rejects `amount=0` orders),
   activates the subscription directly, and issues a `₹0` PAID invoice. The
   `/checkout` response carries `skippedRazorpay: true` so the client renders a
   confirmation instead of opening the Razorpay modal.
6. On payment capture (or short-circuit), `couponService.markConverted` is called,
   flipping the redemption row to `CONVERTED`.

### Production keys

The following env vars are managed via the deploy environment and
**never** committed:

```
RAZORPAY_KEY_ID         # rzp_live_… or rzp_test_…
RAZORPAY_KEY_SECRET     # server-side secret (do NOT expose to web)
RAZORPAY_WEBHOOK_SECRET # HMAC secret for webhook verification
```

In test / CI the keys are stubbed via vitest fixtures. If any of the
three is missing in non-test runtime, the API throws at first checkout
attempt — billing routes refuse to silently launch with empty creds.
