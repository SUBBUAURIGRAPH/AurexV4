/**
 * Battua adapter — wallet/payment event types.
 *
 * Battua is the Aurigraph stablecoin wallet & P2P payment service. Transfer
 * and settlement events are recorded on-chain via DMRV using the ISO_14064
 * framework (carbon attribution per stablecoin transfer).
 */

export type BattuaSymbol = 'USDT' | 'USDC' | 'EURC' | 'XSGD' | 'NXPC';

export const BATTUA_SYMBOLS: readonly BattuaSymbol[] = [
  'USDT',
  'USDC',
  'EURC',
  'XSGD',
  'NXPC',
] as const;

export interface BattuaTransferEvent {
  txHash: string;
  fromWallet: string;
  toWallet: string;
  /** BigDecimal-safe string, e.g. "1000.00". */
  amount: string;
  symbol: BattuaSymbol;
  blockHeight?: number;
  memo?: string;
  timestamp?: string;
}

export type BattuaFinalityStatus = 'PENDING' | 'FINALIZED' | 'FAILED';

export interface BattuaSettlementEvent {
  txHash: string;
  symbol: string;
  finalityStatus: BattuaFinalityStatus;
  blockHeight?: number;
  timestamp?: string;
}

export interface BattuaNodeStatus {
  nodeId: string;
  status: string;
  lastHeartbeat?: string;
  version?: string;
  nodeLabel?: string;
}
