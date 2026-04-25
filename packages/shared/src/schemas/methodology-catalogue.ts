/**
 * AAT-π / AV4-368 — Methodology catalogue: single source of truth.
 *
 * Schema for the canonical, cross-system methodology catalogue. External
 * consumers (AWD2, BCR live adapter, Aurigraph DLT SDK) resolve a
 * methodology by code → metadata against this shape.
 *
 * Design notes:
 *   - `category` is intentionally `z.string()` (not z.enum) so the catalogue
 *     remains forward-compatible when registries publish new groupings.
 *     Aurex's current values are `A6_4` | `BCR` | `VOLUNTARY_OTHER`, but
 *     clients should treat the field as an opaque string token.
 *   - `etag` is server-computed (sha256 of the canonical JSON of the entry
 *     array). Clients receive it on the response envelope, not per entry —
 *     the per-entry shape omits it; the response wrapper carries it.
 *   - `effectiveUntil < effectiveFrom` is rejected (catalogue invariant).
 */

import { z } from 'zod';

/**
 * Known registry-of-origin categories. Forward-compatible: clients SHOULD
 * accept any string; Aurex emits one of these values.
 */
export const METHODOLOGY_CATEGORIES = [
  'A6_4',
  'BCR',
  'VOLUNTARY_OTHER',
] as const;

export type MethodologyCategory = (typeof METHODOLOGY_CATEGORIES)[number];

/**
 * One entry in the methodology catalogue. The shape is stable across all
 * external consumers — adding fields is allowed (additive only); removing
 * or renaming requires an API version bump.
 */
export const methodologyCatalogueEntrySchema = z
  .object({
    code: z.string().min(1).max(100),
    version: z.string().min(1).max(32),
    name: z.string().min(1).max(255),
    /**
     * Registry-of-origin category. Aurex emits A6_4 / BCR / VOLUNTARY_OTHER
     * but clients should accept any string for forward compatibility.
     */
    category: z.string().min(1).max(64),
    isBcrEligible: z.boolean(),
    isA64Eligible: z.boolean(),
    referenceUrl: z.string().url().max(500),
    gases: z.array(z.string().min(1).max(16)).default(['CO2']),
    /** UNFCCC sectoral scope: 1-15 (1=Energy, 14=AFOLU, etc.). */
    sectoralScope: z.number().int().min(1).max(15),
    /** ISO-8601 datetime — when the methodology became effective. */
    effectiveFrom: z.string().datetime(),
    /** ISO-8601 datetime — when the methodology was superseded; null = active. */
    effectiveUntil: z.string().datetime().nullable(),
    /** Free-text supplementary notes; null when none. */
    notes: z.string().max(4000).nullable(),
  })
  .superRefine((entry, ctx) => {
    if (entry.effectiveUntil) {
      const from = Date.parse(entry.effectiveFrom);
      const until = Date.parse(entry.effectiveUntil);
      if (Number.isFinite(from) && Number.isFinite(until) && until < from) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['effectiveUntil'],
          message: 'effectiveUntil must be on or after effectiveFrom',
        });
      }
    }
  });

export type MethodologyCatalogueEntry = z.infer<
  typeof methodologyCatalogueEntrySchema
>;

/**
 * Response envelope for the public catalogue endpoint.
 *   - `entries` are sorted by (category, code, version) on the server.
 *   - `etag` is a sha256 hex digest of the canonical JSON of `entries`,
 *     prefixed with `W/"…"` for HTTP weak-validator semantics by the
 *     transport layer (the schema carries the raw hex).
 *   - `generatedAt` is the ISO-8601 timestamp at which the server
 *     materialised the response (used for cache reasoning, not validation).
 */
export const methodologyCatalogueResponseSchema = z.object({
  entries: z.array(methodologyCatalogueEntrySchema),
  etag: z.string().min(1).max(128),
  generatedAt: z.string().datetime(),
});

export type MethodologyCatalogueResponse = z.infer<
  typeof methodologyCatalogueResponseSchema
>;
