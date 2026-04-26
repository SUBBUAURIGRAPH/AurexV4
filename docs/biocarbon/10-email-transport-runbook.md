# 10 — Email Transport Runbook (Amazon SES + Mandrill)

**Purpose:** Operational runbook for Aurex's transactional outbound email pipeline. Covers first-time SES + DNS setup, daily ops commands, failure recovery, template change-management, and provider switching between SES and Mandrill (Mailchimp Transactional).
**Audience:** Aurex DevOps (deploys + DNS), Aurex Compliance (template approval), Aurex Engineering on-call (failure triage).
**Owner:** AAT-11C / Wave 11c — operational glue around the AAT-EMAIL transport. Mandrill provider added under AAT-MANDRILL.
**Companion docs:** [`./08-change-management.md`](./08-change-management.md); the SES façade lives at `apps/api/src/services/email/email.service.ts`; per-provider transports at `apps/api/src/services/email/transport.ts` (SES) and `apps/api/src/services/email/mandrill-transport.ts` (Mandrill); the diagnostic endpoint lives at `apps/api/src/routes/health.ts` (`GET /api/v1/health/email`).

---

## 1. First-time setup checklist

This section is run **once per AWS account / domain pair**. Re-run only when the sender domain or the AWS account changes.

### 1.1 SES — verify the sender identity

1. Sign in to the AWS console for the account that owns the deploy IAM role, region **`ap-south-1`** (Mumbai).
2. Open **Amazon SES → Identities → Create identity**.
3. Choose **Email address**, enter `noreply@aurex.in`, click **Create**.
4. AWS sends a verification email to `noreply@aurex.in`. Click the link from the inbox / forwarded message.
5. Reload the SES console — the identity must show `Verified` before any production traffic.
6. Repeat for the reply-to identity `contact@aurex.in` (operationally optional but recommended so SES doesn't rewrite the Reply-To header).

### 1.2 DNS — SPF, DKIM, DMARC on `aurex.in`

Add the following records at the DNS provider for `aurex.in`. SPF + DKIM are **required** for production traffic; DMARC is **strongly recommended** to keep reputation healthy.

| Record | Host | Type | Value |
|---|---|---|---|
| SPF | `aurex.in` | `TXT` | `v=spf1 include:amazonses.com ~all` |
| DKIM 1 | `<token1>._domainkey.aurex.in` | `CNAME` | `<token1>.dkim.amazonses.com` |
| DKIM 2 | `<token2>._domainkey.aurex.in` | `CNAME` | `<token2>.dkim.amazonses.com` |
| DKIM 3 | `<token3>._domainkey.aurex.in` | `CNAME` | `<token3>.dkim.amazonses.com` |
| DMARC | `_dmarc.aurex.in` | `TXT` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@aurex.in; pct=100` |

The 3 DKIM tokens are generated **per identity** by AWS — open the SES identity, expand **DKIM**, and copy the three CNAME pairs verbatim. Keep the existing SPF record if one is already present and merge the `include:amazonses.com` term in (a domain may only publish ONE SPF record).

Validate with `dig`:

```bash
dig +short txt aurex.in | grep spf1
dig +short cname <token1>._domainkey.aurex.in
dig +short txt _dmarc.aurex.in
```

### 1.3 Lift SES out of sandbox mode

By default a fresh SES region is in sandbox mode (200 emails/day, recipients must also be verified). Submit a sending-quota increase via **SES → Account dashboard → Request production access**:

- **Mail type:** Transactional
- **Website URL:** `https://aurex.in`
- **Use case:** "Transactional emails to authenticated Aurex users — verification, welcome, payment receipts. Bounce + complaint handling via SES default mailboxes; dedicated `dmarc@aurex.in` for DMARC reports."
- **Daily volume target:** request at least **50 000/day**, peak **5/sec**. The minimum production grant is usually 50 000/day.

AWS replies within 24h. Until the request is approved, the system can still send to **verified** recipients only, which is enough for QA.

### 1.4 Deploy environment variables

Add these to the deploy environment (production + staging). Defaults from the service are listed for reference:

| Variable | Required? | Default | Notes |
|---|---|---|---|
| `AWS_REGION` | yes | `ap-south-1` | Must match the SES region the identity is verified in. |
| `AURIGRAPH_EMAIL_FROM` | yes | `noreply@aurex.in` | Must equal the verified SES identity. |
| `AURIGRAPH_EMAIL_REPLY_TO` | recommended | `contact@aurex.in` | Set empty (`""`) to send without a Reply-To header. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | yes (or instance profile) | — | Inherited from the existing S3 setup; do not duplicate. |
| `AWS_SES_MOCK_MODE` | no | unset | Set to `1` only in CI / smoke environments to bypass SES. |

### 1.5 IAM policy — minimum permissions for the deploy role

Attach the following inline policy fragment to the IAM role used by the API runtime. Each line is the minimum the system uses; do not grant `ses:*`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AurexSesSend",
      "Effect": "Allow",
      "Action": [
        "ses:SendEmail",
        "ses:GetEmailIdentity",
        "ses:GetSendQuota",
        "ses:GetSendStatistics"
      ],
      "Resource": "*"
    }
  ]
}
```

| Action | Why we need it |
|---|---|
| `ses:SendEmail` | Outbound transport — the `email.service` calls SES v2 `SendEmail` from the auth + billing flows. |
| `ses:GetEmailIdentity` | `/health/email` calls this to surface `sesIdentityVerified` to ops without grepping the SES console. |
| `ses:GetSendQuota` | Reserved for the next health-endpoint enhancement (per-account daily quota / peak-rate). Not yet wired. |
| `ses:GetSendStatistics` | Reserved for the bounce/complaint trend dashboard. Not yet wired. |

The two `Get*` actions on the second tier (`SendQuota`, `SendStatistics`) are listed now so the IAM policy doesn't need a second review pass when those probes ship.

---

## 2. Daily operational commands

### 2.1 Health check — `/health/email`

The endpoint is auth-gated to `SUPER_ADMIN`; mint a short-lived JWT for an admin account and call:

```bash
curl -sS \
  -H "Authorization: Bearer <admin-jwt>" \
  https://aurex.in/api/v1/health/email | jq
```

Expected fields (all always present):

```json
{
  "from": "noreply@aurex.in",
  "replyTo": "contact@aurex.in",
  "region": "ap-south-1",
  "awsCredentialsResolved": true,
  "sesIdentityVerified": true,
  "lastSendOk": "2026-04-25T10:14:23.000Z",
  "lastSendError": null,
  "outboundQueue24h": { "sent": 142, "failed": 0, "pending": 0 }
}
```

Triage rules:

- `awsCredentialsResolved: false` — the runtime can't see AWS credentials. Re-check `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars, or the instance-profile attachment.
- `sesIdentityVerified: false` — the sender identity is not verified in SES. Re-run §1.1; this almost always means a typo on `AURIGRAPH_EMAIL_FROM`.
- `sesIdentityVerified: "unknown"` — couldn't reach SES (no creds, network, or throttling). Investigate creds before assuming it's a verification problem.
- `outboundQueue24h.failed > 0` and `lastSendError` non-null — see §3.

### 2.2 Last 24h failures — direct SQL

```sql
SELECT id, "to", subject, template_key, error_message, created_at
FROM   outbound_emails
WHERE  status = 'failed'
   AND created_at >= now() - interval '24 hours'
ORDER  BY created_at DESC
LIMIT  100;
```

`error_message` is truncated to 4 000 chars by the service. Common patterns:

| Pattern in `error_message` | Meaning | Action |
|---|---|---|
| `MessageRejected: Email address is not verified` | Sandbox mode — recipient unverified | §1.3 (or verify the test recipient temporarily) |
| `Throttling: Maximum sending rate exceeded` | SES per-second cap hit | Throttle the caller; raise the per-second cap via support |
| `AccessDenied` on `SendEmail` | IAM regression | Re-apply the policy in §1.5 |
| `ConfigurationSetDoesNotExist` | Stale config | We don't use configuration sets — this should never appear; file a bug. |

### 2.3 Send a test email — `scripts/email/send-test.ts`

```bash
AURIGRAPH_TEST_EMAIL_TO=ops@aurex.in \
  pnpm --filter @aurex/api tsx scripts/email/send-test.ts
```

The script calls the production `email.service.sendEmail(...)` with a minimal "Aurex SES connectivity test" payload and prints either the SES `MessageId` + `OutboundEmail.id` on success, or the error message on failure. Useful after any of the following:

- IAM policy change
- Env var change (`AWS_REGION`, `AURIGRAPH_EMAIL_FROM`, `AURIGRAPH_EMAIL_REPLY_TO`)
- Identity re-verification
- DNS propagation after SPF/DKIM/DMARC change

When SES is in sandbox mode, the test recipient must already be a verified identity in the same SES region.

---

## 3. Failure runbook

### 3.1 Bounce rate above 5%

Bounce rate is published by SES in the **Reputation metrics** dashboard. SES will pause sending automatically if the 14-day rolling bounce rate crosses 10% — we want to act at **5%** to stay well below the auto-pause threshold.

1. Pause sending: set `AWS_SES_MOCK_MODE=1` on the API runtime to short-circuit `email.service` and stop new SES calls. Restart the API.
2. Pull the last 24h of failures (§2.2) — group by `error_message` to see whether the bounces are address-format issues (we send to a typo'd address pattern) or recipient-side rejections (mailbox full, blocked).
3. If the cause is internal — eg. a feature is creating users with malformed emails — fix the upstream validation and back-fill the `OutboundEmail` rows to FAILED so they don't get retried.
4. Once the cause is fixed, unset `AWS_SES_MOCK_MODE` and restart. Watch `/health/email` for an hour.

### 3.2 Spam-complaint rate above 0.1%

SES treats sustained complaint rates above 0.1% as a hard signal — the account moves to a probation list. Action:

1. Pause sending (as in §3.1).
2. Pull the templates the complaints came from (SES → **Reputation metrics → Complaints by configuration set**, or by looking at SES feedback notifications). Cross-reference with `OutboundEmail.template_key`.
3. Walk the offending template through Compliance + Marketing review (§4) before re-enabling.
4. Consider adding an explicit **List-Unsubscribe** header for any non-transactional content; transactional templates (verification / payment-receipt) are exempt but should still carry an opt-out for marketing-adjacent volumes.

### 3.3 SES is in sandbox mode

If `MessageRejected: Email address is not verified` appears on every send to a non-verified recipient, the account is still in sandbox. Two options:

- **Short-term:** verify the specific recipient via SES → Identities → Create identity → Email address.
- **Long-term:** request production access (§1.3). Approval typically arrives within 24h.

### 3.4 DKIM or SPF failure

Symptom: recipient inboxes flag messages as "could not verify sender" or messages land in spam unconditionally.

1. Re-check the records resolve to the SES-generated targets:
   ```bash
   dig +short txt aurex.in | grep spf1
   dig +short cname <token1>._domainkey.aurex.in
   dig +short cname <token2>._domainkey.aurex.in
   dig +short cname <token3>._domainkey.aurex.in
   ```
   If any DKIM CNAME resolves to NXDOMAIN, the DNS change wasn't published — re-add the record in §1.2.
2. Confirm SES still considers DKIM "Active" on the identity page. If the identity shows "Pending" or "Failed" for DKIM, AWS re-verified and didn't find the records — propagate again, then click **Restart DKIM signing**.
3. Send a test (§2.3) to a Gmail account, open the message → "Show original" → confirm both `SPF=pass` and `DKIM=pass`. DMARC alignment requires both.

### 3.5 SES regional outage

If SES Mumbai is unreachable but credentials are healthy:

- `email.service` already swallows errors and writes `OutboundEmail.status='FAILED'`. The user-facing flows (signup, payment) continue.
- Do **not** retry from inside the service — the next ops step is to point `AWS_REGION` at a fallback region where the SES identity is *also* verified, and bounce the API. Today this is not pre-staged; treat it as an Apr-2026 follow-up.

---

## 4. Template change-management

### 4.1 Where templates live

The transactional templates are TypeScript modules under:

```
apps/api/src/services/email/templates/
├── _shared.ts           # brand frame + footer + escapeHtml helper
├── verification.ts      # email-verification (signup, resend)
├── welcome.ts           # post-verification welcome
└── payment-receipt.ts   # billing — invoice paid
```

Each module exports a `render*` function returning `{ subject, html, text }`. The HTML uses inline styles only (Gmail / Outlook strip `<style>` blocks). Any change touches both the HTML and the text alternative — both are persisted on the `OutboundEmail` audit row via the `email.service` façade.

### 4.2 Required review process

Any change to a template — copy, layout, subject line, or new template — goes through this review chain **before** the change ships to production:

1. **Engineering** — implement the change as a PR; add a snapshot test under `templates.test.ts` that asserts subject + a visible string anchor. Lint + typecheck + test pass.
2. **Compliance review** — required for verification + payment-receipt (regulated flows). Compliance signs off in writing on the PR. Specifically reviews: legal entity name (`Aurigraph DLT Corp`), retention disclosure, and any reference to data the user can dispute.
3. **Marketing review** — required for the welcome template and any new template. Marketing signs off on copy + tone. Subject lines that materially change wording must be A/B-flagged (see §4.3).
4. **Deploy** — only after both reviews are green. The PR description must link to the Compliance + Marketing approvals (Jira / Confluence link, not email).

### 4.3 A/B testing — Wave 12+ TODO

A/B testing on subject lines (and on CTA copy in the welcome template) is **not yet implemented**. The shape we expect to ship:

- A new `templateVariant` column on `OutboundEmail` so we can attribute opens / clicks back to the variant that was sent.
- A `pickVariant()` helper in `_shared.ts` that does deterministic 50/50 splits keyed on the recipient hash so the same user always sees the same variant.
- An ops dashboard on top of `OutboundEmail` filtered by `(templateKey, templateVariant)`.

Filing this here so the ops cost is visible at planning time. Track under Wave 12 or later.

---

## 5. Quick reference — health-check decision tree

```
GET /api/v1/health/email
│
├── 401/403         → not authenticated as SUPER_ADMIN; mint correct JWT.
│
├── provider == "ses" branch:
│   ├── awsCredentialsResolved == false
│   │       → §2.1: re-check env vars / instance profile.
│   ├── sesIdentityVerified == false
│   │       → §1.1: identity not verified in SES (or wrong region).
│   ├── sesIdentityVerified == "unknown"
│   │       → SES probe failed; check creds, then re-run.
│   └── outboundQueue24h.failed > 0
│           → §2.2: pull failures, group by error_message, follow §3.x.
│
├── provider == "mandrill" branch:
│   ├── mandrillKeyResolved == false
│   │       → §6.1: MANDRILL_API_KEY env var missing on the runtime.
│   ├── mandrillIdentityVerified == false
│   │       → §6.1: key is set but Mandrill rejected ping (key revoked / typo).
│   ├── mandrillIdentityVerified == "unknown"
│   │       → network reach to mandrillapp.com failed; check egress firewall.
│   └── outboundQueue24h.failed > 0 with [mandrill:REJECTED] errors
│           → §6.2: address-level rejection; sender authentication on Mailchimp.
│
└── all-green       → no action.
```

---

## 6. Provider switching (AAT-MANDRILL)

Aurex supports two interchangeable outbound transports. The default is SES — switching to Mandrill is a deploy-time env var flip; no code change is required.

### 6.1 How to switch — runtime env vars

| Variable | SES default | Mandrill | Notes |
|---|---|---|---|
| `EMAIL_TRANSPORT` | unset / `ses` | `mandrill` | Selects which transport `email.service.sendEmail()` resolves at call time. |
| `MANDRILL_API_KEY` | n/a | required | Mailchimp Transactional API key. Format: `md-…`. |
| `MANDRILL_MOCK_MODE` | n/a | `1` for dev | Bypasses Mandrill HTTP; pushes onto an in-memory queue. Mirrors `AWS_SES_MOCK_MODE=1`. |

To enable Mandrill in production:

```bash
# Add to the API runtime env (e.g. /etc/aurex/api.env or systemd unit)
EMAIL_TRANSPORT=mandrill
MANDRILL_API_KEY=md-<paste-from-mailchimp-dashboard>

# Restart the API
sudo systemctl restart aurexv4-api
```

Verify via `/health/email`:

```bash
curl -sS -H "Authorization: Bearer <admin-jwt>" \
  https://aurex.in/api/v1/health/email | jq
```

Expected response (subset):

```json
{
  "provider": "mandrill",
  "mandrillKeyResolved": true,
  "mandrillIdentityVerified": true,
  ...
}
```

To roll back to SES, unset `EMAIL_TRANSPORT` (or set it to `ses`) and restart. There is no data migration required either way — both transports write the same `OutboundEmail` audit-row schema (no `provider` column was added; see §6.5 for the rationale).

### 6.2 Mandrill (Mailchimp Transactional) setup

Mandrill is the transactional arm of Mailchimp. The product page and API reference:

- Product: <https://mailchimp.com/developer/transactional/>
- API reference: <https://mailchimp.com/developer/transactional/api/>
- Pricing: pay-per-send credits; see <https://mailchimp.com/pricing/transactional-email/>. Aurex's transactional volume (verification + welcome + payment receipt) sits well within the entry tier; no commitment beyond credit top-ups is required.

**Important:** V3's Mandrill keys were already invalid by the AAT-EMAIL audit (Wave 8b). Fresh keys are required — the V3 secrets cannot be reused.

#### Step 1 — Obtain an API key

1. Sign in to Mailchimp at <https://login.mailchimp.com/>.
2. Open **Transactional → Settings → SMTP & API Info**.
3. Click **+New API Key**, label it `aurex-prod` (or `aurex-staging`).
4. Copy the generated key (`md-…`). It will only be shown once. Store it in the deploy secret store (1Password / Vault) under `MANDRILL_API_KEY`.

#### Step 2 — Sender authentication on Mailchimp side

Required for production deliverability. Without these records, Mandrill flags the messages as low-reputation and most receivers will spam-folder them.

1. In Mailchimp Transactional, open **Settings → Domains**.
2. Add `aurex.in`, click **Verify Domain**. Mailchimp emails a confirmation link to a `postmaster@`/`webmaster@`/`admin@` mailbox on `aurex.in`. Click the link.
3. Under the same domain entry, click **View Settings** → **DKIM**. Mailchimp publishes two DNS records to add at the DNS provider for `aurex.in`:

   | Host | Type | Value |
   |---|---|---|
   | `mte1._domainkey.aurex.in` | `TXT` | `<mailchimp-provided-DKIM>` |
   | `mte2._domainkey.aurex.in` | `TXT` | `<mailchimp-provided-DKIM>` |

4. Add a SPF record (or merge into the existing one — only one SPF record per domain):

   ```
   v=spf1 include:spf.mandrillapp.com include:amazonses.com ~all
   ```

   The `include:amazonses.com` term keeps SES sends valid in case of fallback; both transports are reachable from the same domain.

5. Set up the **Return-Path** (envelope From) custom domain so Mandrill can sign bounces under your domain rather than `bounces.mandrillapp.com`. In **Settings → Sending Domains**, add `bounces.aurex.in` as a CNAME pointing to `mailchimp-cname-target` (the exact target is shown in the Mailchimp dashboard).
6. Once DNS propagates (typically <1h, sometimes up to 24h), click **Test DNS Settings** in the Mailchimp dashboard. All three (DKIM-1, DKIM-2, Return-Path CNAME) must show **Valid** before production traffic.

DMARC continues to use the existing record from §1.2 — Mandrill respects DMARC alignment when DKIM passes for the From domain.

#### Step 3 — Pricing notes

- Transactional credits are sold in blocks (e.g. 25 000 sends / month). Aurex's expected volume is <5 000/month (verification + welcome + receipt). Buy the smallest block first.
- Mailchimp will downgrade reputation if the bounce rate exceeds 5% over 30 days — same threshold as SES (§3.1). The runbook for handling sustained bounces is identical: pause via `MANDRILL_MOCK_MODE=1`, investigate via `OutboundEmail.errorMessage` LIKE `%[mandrill:REJECTED]%`, fix upstream, unpause.

### 6.3 Health probe details

The `/health/email` endpoint executes a transport-specific probe in addition to the SES one already shipped under Wave 11c:

| Field | Source | Meaning |
|---|---|---|
| `provider` | `EMAIL_TRANSPORT` env | The active transport (`ses` or `mandrill`). |
| `mandrillKeyResolved` | `MANDRILL_API_KEY` env present? | Boolean — does the runtime see a key at all? |
| `mandrillIdentityVerified` | `POST /api/1.0/users/ping.json` | `true` when Mandrill returns `"PONG!"`, `false` when it returns 4xx, `'unknown'` when the network call fails. |

The two transports' probes run independently — even on a Mandrill-only deployment we still surface the SES status (and vice versa) so a planned rollback is never blocked on a missing probe.

### 6.4 Error mapping — `OutboundEmail.errorMessage`

Mandrill failures are tagged with a `[mandrill:<code>]` prefix on the audit row's `errorMessage` so SQL filters can distinguish them at a glance:

| Code | Origin | Action |
|---|---|---|
| `[mandrill:NETWORK]` | Connection refused / 5xx / DNS failure | Check egress firewall to `mandrillapp.com:443`; surface short-term outages on the status page. |
| `[mandrill:REJECTED]` | HTTP 200 with `status='rejected'` or `'invalid'` | Address-level reject. Inspect `errorMessage` for `reject_reason`; common values are `hard-bounce`, `soft-bounce`, `spam`, `unsub`. |
| `[mandrill:BAD_RESPONSE]` | HTTP 200 with malformed body | Mandrill API contract drift. File a bug — should not appear in steady state. |

The Mandrill transport does **not** retry — it mirrors the SES behaviour where the calling flow (signup, payment) must not be blocked. Future retry workers can re-process FAILED rows from `OutboundEmail` regardless of which transport originally tried.

### 6.5 Why no `provider` column on `OutboundEmail`?

We deliberately did **not** add a `provider` field to `OutboundEmail` under AAT-MANDRILL. The runtime always knows which transport is active (via `EMAIL_TRANSPORT`), and the structured logger emits a `provider` field on every send. Storing the column would be denormalised — the same row could only have been produced by one provider given a deployment's env. If a future cross-provider analytics need arises (e.g. blend deliverability across multiple deployments), the column can be added then; the migration is forward-compatible because every existing row was produced under exactly one of the two providers (SES, the old default).
