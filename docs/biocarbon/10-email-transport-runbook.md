# 10 — Email Transport Runbook (Amazon SES)

**Purpose:** Operational runbook for Aurex's transactional outbound email pipeline. Covers first-time SES + DNS setup, daily ops commands, failure recovery, and template change-management.
**Audience:** Aurex DevOps (deploys + DNS), Aurex Compliance (template approval), Aurex Engineering on-call (failure triage).
**Owner:** AAT-11C / Wave 11c — operational glue around the AAT-EMAIL transport.
**Companion docs:** [`./08-change-management.md`](./08-change-management.md); the SES façade lives at `apps/api/src/services/email/email.service.ts`; the diagnostic endpoint lives at `apps/api/src/routes/health.ts` (`GET /api/v1/health/email`).

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
├── awsCredentialsResolved == false
│       → §2.1: re-check env vars / instance profile.
│
├── sesIdentityVerified == false
│       → §1.1: identity not verified in SES (or wrong region).
│
├── sesIdentityVerified == "unknown"
│       → SES probe failed; check creds, then re-run.
│
├── outboundQueue24h.failed > 0
│       → §2.2: pull failures, group by error_message, follow §3.x.
│
└── all-green       → no action.
```
