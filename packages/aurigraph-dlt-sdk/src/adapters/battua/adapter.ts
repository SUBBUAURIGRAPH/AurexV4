/**
 * BattuaAdapter — wraps `AurigraphClient` for Battua wallet/P2P operations.
 * Records stablecoin transfers and settlements as DMRV events tagged with
 * `metadata.framework = 'ISO_14064'` (carbon attribution per transfer).
 */

import { AurigraphClient } from '../../client.js';
import { ValidationError } from '../../errors.js';
import type { DmrvEvent, DmrvReceipt, BattuaToken, BattuaNodeRegistration, BattuaNodeStats } from '../../types.js';
import {
  DmrvFramework,
  isAurWallet,
} from '../common.js';
import {
  BATTUA_SYMBOLS,
  BattuaNodeStatus,
  BattuaSettlementEvent,
  BattuaSymbol,
  BattuaTransferEvent,
} from './types.js';

const FRAMEWORK: DmrvFramework = 'ISO_14064';

export class BattuaAdapter {
  constructor(private readonly client: AurigraphClient) {}

  /** Record a stablecoin transfer as an ISO_14064 DMRV event. */
  async recordTransferEvent(event: BattuaTransferEvent): Promise<DmrvReceipt> {
    this.validateTransferEvent(event);
    const quantity = this.parseAmount(event.amount);
    const dmrvEvent: DmrvEvent = {
      deviceId: event.txHash,
      eventType: 'StablecoinTransfer',
      quantity,
      unit: event.symbol,
      timestamp: event.timestamp,
      metadata: {
        framework: FRAMEWORK,
        domain: 'battua',
        fromWallet: event.fromWallet,
        toWallet: event.toWallet,
        amount: event.amount,
        symbol: event.symbol,
        blockHeight: event.blockHeight,
        memo: event.memo,
      },
    };
    return this.client.dmrv.recordEvent(dmrvEvent);
  }

  /** Record a settlement finality event as an ISO_14064 DMRV event. */
  async recordSettlementEvent(event: BattuaSettlementEvent): Promise<DmrvReceipt> {
    this.validateSettlementEvent(event);
    const dmrvEvent: DmrvEvent = {
      deviceId: event.txHash,
      eventType: 'SettlementFinality',
      quantity: 1,
      unit: 'event',
      timestamp: event.timestamp,
      metadata: {
        framework: FRAMEWORK,
        domain: 'battua',
        symbol: event.symbol,
        finalityStatus: event.finalityStatus,
        blockHeight: event.blockHeight,
      },
    };
    return this.client.dmrv.recordEvent(dmrvEvent);
  }

  /** Look up the live status of a Battua wallet node. */
  async getNodeStatus(nodeId: string): Promise<BattuaNodeStatus> {
    if (!nodeId) throw new ValidationError('nodeId is required', 'nodeId');
    const nodes = await this.client.registries.battua.nodes();
    const match = nodes.find((n) => n.nodeId === nodeId);
    if (!match) {
      return { nodeId, status: 'UNKNOWN' };
    }
    return {
      nodeId: match.nodeId,
      status: match.status ?? 'UNKNOWN',
      lastHeartbeat: match.lastHeartbeat,
      version: match.version,
      nodeLabel: match.nodeLabel,
    };
  }

  /** Register or upsert a Battua node heartbeat. */
  async registerNodeHeartbeat(nodeId: string): Promise<void> {
    if (!nodeId) throw new ValidationError('nodeId is required', 'nodeId');
    await this.client.registries.battua.registerNodeHeartbeat({
      nodeId,
      lastHeartbeat: new Date().toISOString(),
    });
  }

  /** Look up a single Battua token by its ID. */
  async getToken(tokenId: string): Promise<BattuaToken> {
    if (!tokenId) throw new ValidationError('tokenId is required', 'tokenId');
    return this.client.registries.battua.getToken(tokenId);
  }

  /** Look up a Battua token by its originating transaction hash. */
  async getTokenByTxHash(txHash: string): Promise<BattuaToken> {
    if (!txHash) throw new ValidationError('txHash is required', 'txHash');
    return this.client.registries.battua.getTokenByTxHash(txHash);
  }

  /** Mint a new Battua token (admin, requires auth). */
  async mintToken(symbol: BattuaSymbol, amount: string, recipient?: string): Promise<BattuaToken> {
    if (!symbol) throw new ValidationError('symbol is required', 'symbol');
    if (!amount) throw new ValidationError('amount is required', 'amount');
    if (!this.isValidSymbol(symbol)) {
      throw new ValidationError(
        `symbol must be one of ${BATTUA_SYMBOLS.join(', ')} (got "${symbol}")`,
        'symbol',
      );
    }
    return this.client.registries.battua.mint({ symbol, amount, recipient });
  }

  /** Get Battua node registry statistics. */
  async getNodeRegistryStats(): Promise<BattuaNodeStats> {
    return this.client.registries.battua.nodeStats();
  }

  /** Look up a single Battua node by its ID (direct API call, not filtered from list). */
  async getNode(nodeId: string): Promise<BattuaNodeRegistration> {
    if (!nodeId) throw new ValidationError('nodeId is required', 'nodeId');
    return this.client.registries.battua.getNode(nodeId);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private validateTransferEvent(event: BattuaTransferEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.txHash) throw new ValidationError('txHash is required', 'txHash');
    if (!event.amount) throw new ValidationError('amount is required', 'amount');
    if (!this.isValidSymbol(event.symbol)) {
      throw new ValidationError(
        `symbol must be one of ${BATTUA_SYMBOLS.join(', ')} (got "${event.symbol}")`,
        'symbol',
      );
    }
    if (!isAurWallet(event.fromWallet)) {
      throw new ValidationError(
        `fromWallet must start with "aur1" prefix (got "${event.fromWallet}")`,
        'fromWallet',
      );
    }
    if (!isAurWallet(event.toWallet)) {
      throw new ValidationError(
        `toWallet must start with "aur1" prefix (got "${event.toWallet}")`,
        'toWallet',
      );
    }
  }

  private validateSettlementEvent(event: BattuaSettlementEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.txHash) throw new ValidationError('txHash is required', 'txHash');
    if (!event.symbol) throw new ValidationError('symbol is required', 'symbol');
    if (!event.finalityStatus) {
      throw new ValidationError('finalityStatus is required', 'finalityStatus');
    }
  }

  private isValidSymbol(symbol: string): symbol is BattuaSymbol {
    return (BATTUA_SYMBOLS as readonly string[]).includes(symbol);
  }

  private parseAmount(amount: string): number {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      throw new ValidationError(
        `amount must be a non-negative decimal string (got "${amount}")`,
        'amount',
      );
    }
    return n;
  }
}
