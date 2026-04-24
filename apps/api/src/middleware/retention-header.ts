import type { Request, Response, NextFunction } from 'express';

/**
 * AV4-338 — `x-retention-policy` response header.
 *
 * A6.4-PROC-AC-002 requires that every response carrying raw monitoring data
 * (or verification metadata referencing it) be self-describing with respect
 * to the applicable retention rule — so downstream callers (host-country
 * auditors, DOEs, SB reviewers) don't have to infer it from out-of-band docs.
 *
 * This middleware adds:
 *   x-retention-policy: aurex-a6.4-min-2yr-post-crediting-period
 *
 * Scope: wire in front of the Article 6.4 routers that carry monitoring or
 * verification data. Applied in `index.ts` as:
 *   app.use('/api/v1/monitoring', retentionHeaderMiddleware, monitoringRouter)
 *   app.use('/api/v1/verification', retentionHeaderMiddleware, verificationRouter)
 *
 * The header value is a stable identifier; the full policy is documented in
 * `docs/A6_4_RETENTION_POLICY.md`. Value changes on policy revision.
 */
export const RETENTION_POLICY_HEADER = 'x-retention-policy';
export const RETENTION_POLICY_VALUE = 'aurex-a6.4-min-2yr-post-crediting-period';

export function retentionHeaderMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader(RETENTION_POLICY_HEADER, RETENTION_POLICY_VALUE);
  next();
}
