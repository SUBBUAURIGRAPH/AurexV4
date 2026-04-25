/**
 * ProvenewsAdapter — thin wrapper over `AurigraphClient` that maps
 * Provenews-specific events (content registration, attribution, licensing)
 * to generic DMRV events tagged with the C2PA framework.
 */

import { AurigraphClient } from '../../client.js';
import { ValidationError } from '../../errors.js';
import type {
  DmrvEvent,
  DmrvReceipt,
  MintReceipt,
  AuditFilter,
  ProvenewsContract,
  ProvenewsContractCreateRequest,
  ProvenewsRevenueEvent,
  ProvenewsRevenueRequest,
  ProvenewsAsset,
  ProvenewsAssetRegisterRequest,
  ProvenewsMerkleProof,
  ProvenewsCheckpoint,
  ProvenewsOrg,
  ProvenewsCompositeToken,
  ProvenewsCompositeAssembleRequest,
  ProvenewsTokenVerification,
  ProvenewsDevice,
  ProvenewsDeviceRegisterRequest,
  ProvenewsTokenizationNode,
  ProvenewsAssignValidatorsRequest,
  ProvenewsTokenizationStatus,
} from '../../types.js';
import {
  DmrvFramework,
  isSha256Hex,
} from '../common.js';
import {
  ProvenewsAssetEvent,
  ProvenewsContractEvent,
} from './types.js';

const FRAMEWORK: DmrvFramework = 'C2PA';
/** Unit quantity=1 per event — Provenews events are discrete, not metered. */
const EVENT_QUANTITY = 1;

export class ProvenewsAdapter {
  constructor(private readonly client: AurigraphClient) {}

  /**
   * Record a Provenews asset event (content registered, attribution
   * verified, ownership transferred, licensed) as a DMRV event with
   * `metadata.framework = 'C2PA'`.
   */
  async recordAssetEvent(event: ProvenewsAssetEvent): Promise<DmrvReceipt> {
    this.validateAssetEvent(event);
    const dmrvEvent: DmrvEvent = {
      deviceId: event.assetId,
      eventType: event.eventType,
      quantity: EVENT_QUANTITY,
      unit: 'event',
      timestamp: event.timestamp,
      metadata: {
        framework: FRAMEWORK,
        domain: 'provenews',
        contentHash: event.contentHash,
        ownerId: event.ownerId,
        parentAssetId: event.parentAssetId,
        ...(event.metadata ?? {}),
      },
    };
    return this.client.dmrv.recordEvent(dmrvEvent);
  }

  /**
   * Record a Provenews contract lifecycle event (created, signed, revoked)
   * as a C2PA DMRV event. `contractId` is passed through as the DMRV
   * `contractId` field as well — enables active-contract routing.
   */
  async recordContractEvent(event: ProvenewsContractEvent): Promise<DmrvReceipt> {
    this.validateContractEvent(event);
    const dmrvEvent: DmrvEvent = {
      deviceId: event.contractId,
      eventType: event.eventType,
      quantity: EVENT_QUANTITY,
      unit: 'event',
      timestamp: event.timestamp,
      contractId: event.contractId,
      metadata: {
        framework: FRAMEWORK,
        domain: 'provenews',
        tokenId: event.tokenId,
        ownerId: event.ownerId,
        licenseType: event.licenseType,
        royaltyRateBps: event.royaltyRateBps,
      },
    };
    return this.client.dmrv.recordEvent(dmrvEvent);
  }

  /** Fetch the full asset provenance trail for a Provenews asset. */
  async getAssetTrail(assetId: string): Promise<ProvenewsAssetEvent[]> {
    if (!assetId) throw new ValidationError('assetId is required', 'assetId');
    const filter: AuditFilter = { deviceId: assetId };
    const events = await this.client.dmrv.getAuditTrail(filter);
    return events
      .filter((e) => this.isProvenewsAssetEvent(e))
      .map((e) => this.toAssetEvent(e, assetId));
  }

  /** Fetch the full contract lifecycle trail (create → sign → revoke). */
  async getContractTrail(contractId: string): Promise<ProvenewsContractEvent[]> {
    if (!contractId) throw new ValidationError('contractId is required', 'contractId');
    const filter: AuditFilter = { contractId };
    const events = await this.client.dmrv.getAuditTrail(filter);
    return events
      .filter((e) => this.isProvenewsContractEvent(e))
      .map((e) => this.toContractEvent(e, contractId));
  }

  /**
   * Mint an attribution token for a signed Provenews contract. The contract
   * id must be a UUID (enforced by `DmrvApi.triggerMint`).
   */
  async mintAttributionToken(contractId: string): Promise<MintReceipt> {
    if (!contractId) {
      throw new ValidationError('contractId is required', 'contractId');
    }
    return this.client.dmrv.triggerMint(contractId, 'AttributionMint', EVENT_QUANTITY);
  }

  // ── Contract management ─────────────────────────────────────────────────

  /** Create a new monetization contract. */
  async createContract(req: ProvenewsContractCreateRequest): Promise<ProvenewsContract> {
    if (!req) throw new ValidationError('request is required');
    if (!req.tokenId) throw new ValidationError('tokenId is required', 'tokenId');
    if (!req.ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    if (!req.title) throw new ValidationError('title is required', 'title');
    return this.client.registries.provenews.createContract(req);
  }

  /** Get a contract by ID. */
  async getContract(contractId: string): Promise<ProvenewsContract> {
    if (!contractId) throw new ValidationError('contractId is required', 'contractId');
    return this.client.registries.provenews.getContract(contractId);
  }

  /** Get a contract by its associated token ID. */
  async getContractByToken(tokenId: string): Promise<ProvenewsContract> {
    if (!tokenId) throw new ValidationError('tokenId is required', 'tokenId');
    return this.client.registries.provenews.getContractByToken(tokenId);
  }

  /** List contracts owned by a specific owner. */
  async getContractsByOwner(ownerId: string): Promise<ProvenewsContract[]> {
    if (!ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    return this.client.registries.provenews.getContractsByOwner(ownerId);
  }

  /** Record a revenue event against a contract. */
  async recordRevenue(contractId: string, req: ProvenewsRevenueRequest): Promise<ProvenewsRevenueEvent> {
    if (!contractId) throw new ValidationError('contractId is required', 'contractId');
    if (!req?.amount) throw new ValidationError('amount is required', 'amount');
    return this.client.registries.provenews.recordRevenue(contractId, req);
  }

  /** List revenue events for a contract. */
  async listRevenue(contractId: string): Promise<ProvenewsRevenueEvent[]> {
    if (!contractId) throw new ValidationError('contractId is required', 'contractId');
    return this.client.registries.provenews.listRevenue(contractId);
  }

  /** Suspend an active contract. */
  async suspendContract(contractId: string): Promise<ProvenewsContract> {
    if (!contractId) throw new ValidationError('contractId is required', 'contractId');
    return this.client.registries.provenews.suspendContract(contractId);
  }

  /** Terminate a contract permanently. */
  async terminateContract(contractId: string): Promise<ProvenewsContract> {
    if (!contractId) throw new ValidationError('contractId is required', 'contractId');
    return this.client.registries.provenews.terminateContract(contractId);
  }

  // ── Ledger asset management ─────────────────────────────────────────────

  /** Register a new asset (PRIMARY/SECONDARY/COMPOSITE) on the ledger. */
  async registerAsset(req: ProvenewsAssetRegisterRequest): Promise<ProvenewsAsset> {
    if (!req) throw new ValidationError('request is required');
    if (!req.contentHash) throw new ValidationError('contentHash is required', 'contentHash');
    if (!req.ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    return this.client.registries.provenews.registerAsset(req);
  }

  /** Get a ledger asset by ID. */
  async getAsset(assetId: string): Promise<ProvenewsAsset> {
    if (!assetId) throw new ValidationError('assetId is required', 'assetId');
    return this.client.registries.provenews.getAsset(assetId);
  }

  /** Get the Merkle inclusion proof for an asset. */
  async getAssetProof(assetId: string): Promise<ProvenewsMerkleProof> {
    if (!assetId) throw new ValidationError('assetId is required', 'assetId');
    return this.client.registries.provenews.getAssetProof(assetId);
  }

  /** List tree checkpoints. */
  async listCheckpoints(): Promise<ProvenewsCheckpoint[]> {
    return this.client.registries.provenews.checkpoints();
  }

  /** Get a specific checkpoint by type. */
  async getCheckpoint(type: string): Promise<ProvenewsCheckpoint> {
    if (!type) throw new ValidationError('type is required', 'type');
    return this.client.registries.provenews.getCheckpoint(type);
  }

  /** Get the Provenews org record. */
  async getOrg(): Promise<ProvenewsOrg> {
    return this.client.registries.provenews.org();
  }

  // ── Composite tokens ────────────────────────────────────────────────────

  /** Assemble a new composite token from component asset IDs. */
  async assembleCompositeToken(req: ProvenewsCompositeAssembleRequest): Promise<ProvenewsCompositeToken> {
    if (!req) throw new ValidationError('request is required');
    if (!req.ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    if (!req.components?.length) throw new ValidationError('components must not be empty', 'components');
    return this.client.registries.provenews.tokens.assembleComposite(req);
  }

  /** Get a composite token by ID. */
  async getCompositeToken(tokenId: string): Promise<ProvenewsCompositeToken> {
    if (!tokenId) throw new ValidationError('tokenId is required', 'tokenId');
    return this.client.registries.provenews.tokens.getToken(tokenId);
  }

  /** Verify a composite token bundle integrity. */
  async verifyCompositeToken(tokenId: string): Promise<ProvenewsTokenVerification> {
    if (!tokenId) throw new ValidationError('tokenId is required', 'tokenId');
    return this.client.registries.provenews.tokens.verifyToken(tokenId);
  }

  /** List composite tokens owned by a user. */
  async listCompositeTokensByOwner(ownerId: string): Promise<ProvenewsCompositeToken[]> {
    if (!ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    return this.client.registries.provenews.tokens.listByOwner(ownerId);
  }

  // ── Device management ───────────────────────────────────────────────────

  /** Register a device for content attestation. */
  async registerDevice(req: ProvenewsDeviceRegisterRequest): Promise<ProvenewsDevice> {
    if (!req) throw new ValidationError('request is required');
    if (!req.userId) throw new ValidationError('userId is required', 'userId');
    return this.client.registries.provenews.devices.register(req);
  }

  /** List devices registered by a user. */
  async listDevicesByUser(userId: string): Promise<ProvenewsDevice[]> {
    if (!userId) throw new ValidationError('userId is required', 'userId');
    return this.client.registries.provenews.devices.listByUser(userId);
  }

  /** Get a device by its ID. */
  async getDevice(deviceId: string): Promise<ProvenewsDevice> {
    if (!deviceId) throw new ValidationError('deviceId is required', 'deviceId');
    return this.client.registries.provenews.devices.get(deviceId);
  }

  // ── Tokenization management ─────────────────────────────────────────────

  /** List tokenization nodes. */
  async listTokenizationNodes(): Promise<ProvenewsTokenizationNode[]> {
    return this.client.registries.provenews.tokenization.nodes();
  }

  /** Assign validator nodes to an asset for tokenization. */
  async assignValidators(assetId: string, req: ProvenewsAssignValidatorsRequest): Promise<Record<string, unknown>> {
    if (!assetId) throw new ValidationError('assetId is required', 'assetId');
    if (!req?.validatorNodeIds?.length) {
      throw new ValidationError('validatorNodeIds must not be empty', 'validatorNodeIds');
    }
    return this.client.registries.provenews.tokenization.assignValidators(assetId, req);
  }

  /** Get tokenization summary status. */
  async getTokenizationStatus(): Promise<ProvenewsTokenizationStatus> {
    return this.client.registries.provenews.tokenization.status();
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private validateAssetEvent(event: ProvenewsAssetEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.assetId) throw new ValidationError('assetId is required', 'assetId');
    if (!event.eventType) throw new ValidationError('eventType is required', 'eventType');
    if (!event.ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    if (!event.timestamp) throw new ValidationError('timestamp is required', 'timestamp');
    if (!isSha256Hex(event.contentHash)) {
      throw new ValidationError(
        `contentHash must be a 64-char SHA-256 hex string (got "${event.contentHash}")`,
        'contentHash',
      );
    }
  }

  private validateContractEvent(event: ProvenewsContractEvent): void {
    if (!event) throw new ValidationError('event is required');
    if (!event.contractId) throw new ValidationError('contractId is required', 'contractId');
    if (!event.tokenId) throw new ValidationError('tokenId is required', 'tokenId');
    if (!event.ownerId) throw new ValidationError('ownerId is required', 'ownerId');
    if (!event.eventType) throw new ValidationError('eventType is required', 'eventType');
    if (!event.licenseType) throw new ValidationError('licenseType is required', 'licenseType');
    if (
      event.royaltyRateBps !== undefined &&
      (event.royaltyRateBps < 0 || event.royaltyRateBps > 10000)
    ) {
      throw new ValidationError(
        `royaltyRateBps must be between 0 and 10000 (got ${event.royaltyRateBps})`,
        'royaltyRateBps',
      );
    }
  }

  private isProvenewsAssetEvent(e: DmrvEvent): boolean {
    const meta = e.metadata ?? {};
    return meta['domain'] === 'provenews' && typeof meta['contentHash'] === 'string';
  }

  private isProvenewsContractEvent(e: DmrvEvent): boolean {
    const meta = e.metadata ?? {};
    return meta['domain'] === 'provenews' && typeof meta['tokenId'] === 'string';
  }

  private toAssetEvent(e: DmrvEvent, fallbackId: string): ProvenewsAssetEvent {
    const meta = e.metadata ?? {};
    return {
      assetId: e.deviceId ?? fallbackId,
      eventType: (e.eventType as ProvenewsAssetEvent['eventType']) ?? 'ContentRegistered',
      contentHash: String(meta['contentHash'] ?? ''),
      ownerId: String(meta['ownerId'] ?? ''),
      parentAssetId: meta['parentAssetId'] as string | undefined,
      metadata: meta,
      timestamp: e.timestamp ?? new Date(0).toISOString(),
    };
  }

  private toContractEvent(e: DmrvEvent, fallbackId: string): ProvenewsContractEvent {
    const meta = e.metadata ?? {};
    return {
      contractId: e.contractId ?? e.deviceId ?? fallbackId,
      eventType: (e.eventType as ProvenewsContractEvent['eventType']) ?? 'ContractCreated',
      tokenId: String(meta['tokenId'] ?? ''),
      ownerId: String(meta['ownerId'] ?? ''),
      licenseType:
        (meta['licenseType'] as ProvenewsContractEvent['licenseType']) ?? 'OPEN',
      royaltyRateBps: meta['royaltyRateBps'] as number | undefined,
      timestamp: e.timestamp,
    };
  }
}
