/**
 * AAT-367 / AV4-367 — federation-auth middleware.
 *
 * Wrap any inbound route that should accept partner-signed JWTs (instead
 * of user-bearer JWTs) with `requireFederation('AWD2' | 'HCE2' | 'AURIGRAPH')`.
 * Successful verification stores the resolved keyId + claims on the
 * request as `req.federation`. Failed verification responds with an
 * RFC 7807 401 — the precise reason is logged but never leaked to the
 * caller (defence in depth — the partner shouldn't learn whether the
 * key is unknown vs. the signature is wrong).
 *
 * Every call (success or failure) writes a row to `FederationCallLog`
 * so ops can see federation health on `/api/v1/federation/peer-pings`.
 */

import type { Request, Response, NextFunction } from 'express';
import type { FederationPartner } from '@aurex/database';
import {
  FederationVerificationError,
  verifyInboundJwt,
  writeCallLog,
  type InboundJwtClaims,
} from '../services/federation/identity.service.js';
import { logger } from '../lib/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      federation?: {
        partner: FederationPartner;
        keyId: string;
        claims: InboundJwtClaims;
      };
    }
  }
}

export function requireFederation(partner: FederationPartner) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const start = Date.now();
    const authHeader = req.headers.authorization;
    const endpoint = `${req.method} ${req.originalUrl}`;

    try {
      const result = await verifyInboundJwt(authHeader, partner);
      req.federation = {
        partner,
        keyId: result.keyId,
        claims: result.claims,
      };

      // Best-effort success log — fire-and-forget so we don't block the
      // request hot path.
      void writeCallLog({
        direction: 'INBOUND',
        partner,
        keyId: result.keyId,
        endpoint,
        status: 'SUCCESS',
        requestId:
          typeof result.claims.jti === 'string' ? result.claims.jti : null,
        latencyMs: Date.now() - start,
      });

      next();
    } catch (err) {
      const reason =
        err instanceof FederationVerificationError ? err.reason : 'unexpected';
      const safeDetail =
        err instanceof FederationVerificationError
          ? err.safeDetail
          : 'Federation JWT could not be verified';

      logger.warn(
        { reason, partner, endpoint },
        'Federation JWT rejected',
      );

      // Persist the rejection — operator visibility into bad
      // signatures, forged tokens, expired clock skew, etc.
      await writeCallLog({
        direction: 'INBOUND',
        partner,
        endpoint,
        status: 'REJECTED',
        errorMessage: reason,
        latencyMs: Date.now() - start,
      });

      res.status(401).json({
        type: 'https://aurex.in/errors/federation-unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: safeDetail,
        instance: req.originalUrl,
      });
    }
  };
}
