/**
 * Aurigraph J4C well-known service URLs (path-mounted on `j4c.aurigraph.io`).
 * **OpenBao** = KMS / secrets; **Harbor** = Docker/OCI **image** registry — different systems.
 */

export const AURIGRAPH_J4C_OPENBAO_ADDR = 'https://j4c.aurigraph.io/openbao' as const;

/** Harbor (Docker / OCI registry) — not the OpenBao KMS. */
export const AURIGRAPH_J4C_HARBOR_BASE = 'https://j4c.aurigraph.io/harbor' as const;
