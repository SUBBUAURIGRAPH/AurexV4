/**
 * Governance namespace — Proposals, voting, and treasury.
 *
 * Wraps:
 *   - GET  /api/v11/governance/proposals
 *   - GET  /api/v11/governance/proposals/{id}
 *   - POST /api/v11/governance/proposals/{id}/vote
 *   - GET  /api/v11/governance/treasury
 */

import type {
  Proposal,
  VoteReceipt,
  TreasuryStats,
} from '../types.js';

export interface GovernanceTransport {
  get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  unwrapList<T>(p: Promise<unknown>, key: string): Promise<T[]>;
}

export class GovernanceApi {
  constructor(private readonly transport: GovernanceTransport) {}

  /** List all governance proposals. */
  async listProposals(): Promise<Proposal[]> {
    return this.transport.unwrapList<Proposal>(
      this.transport.get<unknown>('/governance/proposals'),
      'proposals',
    );
  }

  /** Get a single proposal by id. */
  async getProposal(proposalId: string): Promise<Proposal> {
    return this.transport.get<Proposal>(
      `/governance/proposals/${encodeURIComponent(proposalId)}`,
    );
  }

  /** Cast a vote on a proposal. */
  async vote(
    proposalId: string,
    approved: boolean,
    voterAddress?: string,
  ): Promise<VoteReceipt> {
    return this.transport.post<VoteReceipt>(
      `/governance/proposals/${encodeURIComponent(proposalId)}/vote`,
      { approved, voterAddress },
    );
  }

  /** Get treasury statistics. */
  async getTreasury(): Promise<TreasuryStats> {
    return this.transport.get<TreasuryStats>('/governance/treasury');
  }
}
