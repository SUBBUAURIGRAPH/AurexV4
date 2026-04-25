/**
 * AWD2 → Aurex handoff receive route (AAT-ξ / AV4-361).
 *
 * AWD2 is a separate registry (legacy Polygon ERC-721 NFTs). The AWD2 emitter
 * (AV4-360, in the AWD2 repo — out of scope for this AAT) signs a handoff
 * manifest with its RS256 private key when a credit's ownership/management
 * transitions to Aurex.
 *
 *   POST /api/v1/awd2/handoff
 *   Authorization: Bearer <RS256-signed-jwt>
 *   Content-Type: application/json
 *
 * The route:
 *   1. Verifies the JWT signature with `AWD2_HANDOFF_PUBLIC_KEY` (PEM,
 *      RS256). If the env var is unset, returns 503 — Aurex hasn't onboarded
 *      the AWD2 federation yet (fail closed).
 *   2. Parses the body with the zod schema below.
 *   3. Dedupes on `handoffNonce` — duplicate POST returns 200
 *      `{ status: 'duplicate', issuanceId, awd2HandoffId }` without
 *      re-importing.
 *   4. Persists an `Awd2Handoff` row at status=RECEIVED, then calls
 *      `importAwd2Handoff` (see awd2-import.service.ts) which creates the
 *      Issuance + tokenization fields, marks the handoff IMPORTED, and
 *      audit-logs the action.
 *   5. On success returns 200 `{ status: 'imported', issuanceId,
 *      awd2HandoffId }`.
 *   6. On import failure (methodology not eligible / org missing / etc.)
 *      returns RFC 7807 422 with the failure reason.
 */

import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '@aurex/database';
import { AppError } from '../middleware/error-handler.js';
import { logger } from '../lib/logger.js';
import { importAwd2Handoff } from '../services/awd2-import.service.js';

export const awd2HandoffRouter: IRouter = Router();

// ── Body schema ────────────────────────────────────────────────────────────

const HEX_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const UINT256_DECIMAL_RE = /^[0-9]{1,78}$/;
const SHA256_HEX_RE = /^(0x)?[a-fA-F0-9]{64}$/;
const NONCE_RE = /^[A-Za-z0-9_-]{8,64}$/;

export const awd2HandoffBodySchema = z.object({
  awd2ContractAddress: z
    .string()
    .regex(HEX_ADDRESS_RE, 'awd2ContractAddress must be a 0x-prefixed 40-char hex string'),
  awd2TokenId: z
    .string()
    .regex(UINT256_DECIMAL_RE, 'awd2TokenId must be a base-10 uint256 string'),
  bcrSerialId: z.string().min(1).max(255),
  vintage: z.number().int().min(1990).max(2100),
  methodologyCode: z.string().min(1).max(64),
  projectId: z.string().min(1).max(255),
  projectTitle: z.string().min(1).max(500),
  // B11: whole tonnes only — strict integer check.
  tonnes: z.number().int().positive(),
  currentHolderOrgId: z.string().uuid(),
  provenanceHash: z
    .string()
    .regex(SHA256_HEX_RE, 'provenanceHash must be a 64-char hex SHA-256 (with or without 0x)'),
  handoffNonce: z
    .string()
    .regex(NONCE_RE, 'handoffNonce must be 8–64 chars [A-Za-z0-9_-]'),
  handoffEmittedAt: z
    .string()
    .datetime({ offset: true, message: 'handoffEmittedAt must be ISO 8601 with offset' }),
});

export type Awd2HandoffBody = z.infer<typeof awd2HandoffBodySchema>;

// ── JWT verification helpers (exported for tests) ──────────────────────────

/**
 * Read the AWD2 federation public key from env. Throws an `AppError(503)`
 * if unset — Aurex fails closed until an operator has installed the key.
 */
export function loadAwd2PublicKey(): string {
  const pem = process.env.AWD2_HANDOFF_PUBLIC_KEY;
  if (!pem || pem.trim().length === 0) {
    throw new AppError(
      503,
      'Service Unavailable',
      'AWD2 handoff federation is not configured (AWD2_HANDOFF_PUBLIC_KEY unset)',
    );
  }
  // Allow operators to encode literal newlines as `\n` in env files.
  return pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem;
}

/**
 * Verify a Bearer JWT using the AWD2 RS256 public key. Returns the decoded
 * payload on success; throws `AppError(401)` on signature / format failure.
 */
export function verifyAwd2HandoffJwt(token: string, publicKey: string): jwt.JwtPayload {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    if (typeof decoded === 'string') {
      throw new AppError(401, 'Unauthorized', 'AWD2 handoff JWT must be a JSON object');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const detail =
      err instanceof Error ? err.message : 'AWD2 handoff JWT verification failed';
    throw new AppError(401, 'Unauthorized', `Invalid AWD2 handoff JWT: ${detail}`);
  }
}

/**
 * Pull the Bearer token off the Authorization header. Throws `AppError(401)`
 * when missing/malformed.
 */
export function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError(
      401,
      'Unauthorized',
      'Missing or malformed Authorization header (expected Bearer <jwt>)',
    );
  }
  const token = header.slice(7).trim();
  if (token.length === 0) {
    throw new AppError(401, 'Unauthorized', 'Empty Bearer token');
  }
  return token;
}

// ── Route handler ──────────────────────────────────────────────────────────

/**
 * Resolve a duplicate handoff into a typed response — used both on idempotent
 * re-receive and when a previous attempt has already imported the row.
 */
function buildDuplicateResponse(row: {
  id: string;
  issuanceId: string | null;
  status: string;
}): { status: 'duplicate'; awd2HandoffId: string; issuanceId: string | null; previousStatus: string } {
  return {
    status: 'duplicate',
    awd2HandoffId: row.id,
    issuanceId: row.issuanceId,
    previousStatus: row.status,
  };
}

awd2HandoffRouter.post(
  '/handoff',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // ── Step 1: federation gate (fail closed when key unset) ────────
      const publicKey = loadAwd2PublicKey();

      // ── Step 2: signature verification ──────────────────────────────
      const token = extractBearerToken(req);
      verifyAwd2HandoffJwt(token, publicKey);

      // ── Step 3: body validation ─────────────────────────────────────
      const body = awd2HandoffBodySchema.parse(req.body);

      // ── Step 4: dedup on handoffNonce ───────────────────────────────
      const existing = await prisma.awd2Handoff.findUnique({
        where: { handoffNonce: body.handoffNonce },
      });
      if (existing) {
        // Whether the previous attempt was IMPORTED, FAILED, or RECEIVED
        // still in-flight, we surface the same "duplicate" envelope so the
        // AWD2 emitter never double-pays. If the previous attempt was
        // FAILED, the operator is expected to fix the underlying issue
        // (methodology eligibility / org provisioning) and re-emit with a
        // new nonce.
        res.status(200).json({
          data: buildDuplicateResponse({
            id: existing.id,
            issuanceId: existing.issuanceId,
            status: String(existing.status),
          }),
        });
        return;
      }

      // ── Step 5: persist Awd2Handoff (status=RECEIVED) ──────────────
      const handoffRow = await prisma.awd2Handoff.create({
        data: {
          handoffNonce: body.handoffNonce,
          awd2ContractAddress: body.awd2ContractAddress,
          awd2TokenId: body.awd2TokenId,
          bcrSerialId: body.bcrSerialId,
          vintage: body.vintage,
          methodologyCode: body.methodologyCode,
          projectId: body.projectId,
          projectTitle: body.projectTitle,
          tonnes: body.tonnes,
          currentHolderOrgId: body.currentHolderOrgId,
          provenanceHash: body.provenanceHash.startsWith('0x')
            ? body.provenanceHash.slice(2)
            : body.provenanceHash,
          handoffEmittedAt: new Date(body.handoffEmittedAt),
          status: 'RECEIVED' as never,
        },
      });

      // ── Step 6: backfill via the import service ─────────────────────
      const result = await importAwd2Handoff({
        awd2HandoffId: handoffRow.id,
        handoffNonce: body.handoffNonce,
        awd2ContractAddress: body.awd2ContractAddress,
        awd2TokenId: body.awd2TokenId,
        bcrSerialId: body.bcrSerialId,
        vintage: body.vintage,
        methodologyCode: body.methodologyCode,
        projectId: body.projectId,
        projectTitle: body.projectTitle,
        tonnes: body.tonnes,
        currentHolderOrgId: body.currentHolderOrgId,
        provenanceHash: body.provenanceHash,
        handoffEmittedAt: new Date(body.handoffEmittedAt),
      });

      logger.info(
        {
          awd2HandoffId: result.awd2HandoffId,
          issuanceId: result.issuanceId,
          handoffNonce: body.handoffNonce,
        },
        'AWD2 handoff received and imported',
      );

      res.status(200).json({
        data: {
          status: result.status,
          awd2HandoffId: result.awd2HandoffId,
          issuanceId: result.issuanceId,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
