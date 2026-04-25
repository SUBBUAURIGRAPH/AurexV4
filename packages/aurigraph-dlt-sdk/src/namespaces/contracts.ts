/**
 * Contracts namespace — Ricardian active contracts + composite/derived token
 * binding operations.
 *
 * Wraps:
 *   - GET  /api/v11/active-contracts/{id}/tokens
 *   - POST /api/v11/contract-bindings/composite
 *   - POST /api/v11/contract-bindings/issue-derived
 *   - GET  /api/v11/contract-bindings/contract/{id}
 *   - GET  /api/v11/contract-bindings/token/{id}
 */

import type {
  BindingResult,
  CompositeBindRequest,
  CompositeBinding,
  IssuanceReceipt,
  IssueDerivedRequest,
  TokenBinding,
} from '../types.js';

export interface ContractsTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class ContractsApi {
  constructor(private readonly transport: ContractsTransport) {}

  /** List tokens bound to an active contract. */
  async getTokens(contractId: string): Promise<TokenBinding[]> {
    return this.transport.unwrapList<TokenBinding>(
      this.transport.get<unknown>(
        `/active-contracts/${encodeURIComponent(contractId)}/tokens`,
      ),
      'tokens',
    );
  }

  /** Bind a composite token to an active contract. */
  async bindComposite(req: CompositeBindRequest): Promise<BindingResult> {
    return this.transport.post<BindingResult>('/contract-bindings/composite', req);
  }

  /** Issue a derived token from an already-bound composite token. */
  async issueDerivedFromComposite(req: IssueDerivedRequest): Promise<IssuanceReceipt> {
    return this.transport.post<IssuanceReceipt>(
      '/contract-bindings/issue-derived',
      req,
    );
  }

  /** All composite/derived bindings for a contract. */
  async getBindingsForContract(contractId: string): Promise<CompositeBinding[]> {
    return this.transport.unwrapList<CompositeBinding>(
      this.transport.get<unknown>(
        `/contract-bindings/contract/${encodeURIComponent(contractId)}`,
      ),
      'bindings',
    );
  }

  /** All composite/derived bindings for a token. */
  async getBindingsForToken(tokenId: string): Promise<CompositeBinding[]> {
    return this.transport.unwrapList<CompositeBinding>(
      this.transport.get<unknown>(
        `/contract-bindings/token/${encodeURIComponent(tokenId)}`,
      ),
      'bindings',
    );
  }
}
