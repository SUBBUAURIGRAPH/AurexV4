import { z } from 'zod';

/**
 * BCR Serial ID — opaque string; do not parse at the Aurex layer. Format
 * defined in BCR Standard Operating Procedures and encodes project /
 * country / vintage / type / verification-period.
 */
export const bcrSerialIdSchema = z.string().min(1).max(255);

export const biocarbonAssetMetadataSchema = z.object({
  // ── BCR mandatory (B6, never alter — preserved until burn) ──
  bcrSerialId: bcrSerialIdSchema,
  bcrSerialIdHash: z.string().regex(/^0x[0-9a-f]{64}$/i), // SHA-256 of bcrSerialId, hex-prefixed
  bcrProjectId: z.string().min(1).max(100),

  // ── Project / methodology (B6 surface attributes) ──
  projectTitle: z.string().min(1).max(255),
  projectPageUrl: z.string().url(), // links to BCR project page (B13 attribution)
  methodologyCode: z.string().min(1).max(100), // e.g. "VM0042"
  methodologyVersion: z.string().min(1).max(32),
  vintage: z.number().int().min(2000).max(2100),
  hostCountry: z.string().length(2), // ISO-3166 alpha-2

  // ── Issuance accounting (B7 1:1 + levy disclosure) ──
  grossUnits: z.number().int().nonnegative(), // tCO2e issued by BCR before levies
  sopUnits: z.number().int().nonnegative(), // 5% Adaptation Fund
  omgeUnits: z.number().int().nonnegative(), // 2% OMGE
  netUnits: z.number().int().positive(), // What this token represents (whole-ton, B11)

  // ── Verification (B16 audit trail surface) ──
  verificationReportUrl: z.string().url().optional(),
  verifierOrgName: z.string().min(1).max(255).optional(),
  verifiedAt: z.string().datetime().optional(),

  // ── Aurex linkage (so off-chain audit can resolve back) ──
  aurexActivityId: z.string().uuid(),
  aurexIssuanceId: z.string().uuid(),

  // ── Retirement (B17 payload prep — populated when burned) ──
  retiredAt: z.string().datetime().optional(),
  retiredFor: z.string().max(500).optional(), // beneficiary
  retiredBy: z.string().max(500).optional(), // organization name
  retirementPurpose: z.enum(['NDC', 'OIMP', 'VOLUNTARY']).optional(),
});

export type BioCarbonAssetMetadata = z.infer<typeof biocarbonAssetMetadataSchema>;

/**
 * Schema-immutability policy. After mint, only the retirement-related fields
 * may transition from undefined → set. Anything else changing post-mint is a
 * compliance violation (B6: "must never be altered").
 */
export const POST_MINT_MUTABLE_FIELDS = [
  'retiredAt',
  'retiredFor',
  'retiredBy',
  'retirementPurpose',
] as const;

export function assertMetadataImmutable(
  prev: BioCarbonAssetMetadata,
  next: BioCarbonAssetMetadata,
): void {
  for (const k of Object.keys(prev) as (keyof BioCarbonAssetMetadata)[]) {
    if ((POST_MINT_MUTABLE_FIELDS as readonly string[]).includes(k)) continue;
    if (prev[k] !== next[k]) {
      throw new Error(`BCR metadata immutability violation: field "${String(k)}" changed`);
    }
  }
}

/** Compute the BCR Serial ID hash (browser/node compatible). */
export async function hashBcrSerialId(bcrSerialId: string): Promise<string> {
  // Use Web Crypto API if available (browser + modern Node 20+).
  const g = globalThis as unknown as {
    crypto?: { subtle?: { digest: (alg: string, data: ArrayBuffer) => Promise<ArrayBuffer> } };
  };
  if (typeof g.crypto?.subtle !== 'undefined') {
    const buf = new TextEncoder().encode(bcrSerialId);
    const digest = await g.crypto.subtle.digest('SHA-256', buf.buffer as ArrayBuffer);
    return (
      '0x' +
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    );
  }
  // Node fallback (without requiring @types/node at build time).
  const nodeCrypto = (await import(/* @vite-ignore */ 'node:crypto')) as {
    createHash: (alg: string) => {
      update: (data: string) => { digest: (enc: string) => string };
    };
  };
  return '0x' + nodeCrypto.createHash('sha256').update(bcrSerialId).digest('hex');
}
