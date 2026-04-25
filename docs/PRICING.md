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
