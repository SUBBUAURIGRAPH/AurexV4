import { randomUUID } from 'node:crypto';
import type {
  BcrRegistryAdapter,
  BcrVccStatus,
  ConfirmLockParams,
  ConfirmLockResult,
  GetStatusParams,
  GetStatusResult,
  LockVccParams,
  LockVccResult,
  NotifyBurnParams,
  NotifyBurnResult,
  NotifyMintParams,
  NotifyMintResult,
  NotifyTransferParams,
  NotifyTransferResult,
  RetireVccParams,
  RetireVccResult,
  UnlockVccParams,
  UnlockVccResult,
} from './bcr-adapter.js';

/**
 * In-memory mock implementation of `BcrRegistryAdapter` for tests and the
 * Aurigraph DLT V12 sandbox tenant. Faithfully reproduces the BCR §5.5
 * lock-then-mint state machine without any network calls:
 *
 *   free → locked          (lockVCC)
 *   locked → tokenized     (notifyMint — only valid when locked)
 *   tokenized → retired    (notifyBurn reason=RETIRE)
 *   tokenized → free       (notifyBurn reason=DELIST  — two-way bridge)
 *   locked → free          (unlockVCC reason=DELIST  — two-way bridge)
 *   * → status read        (getStatus)
 *
 * Backed by two maps keyed off `bcrSerialId` and `bcrLockId` respectively.
 * Calls that violate the state machine return `ok: false` with a clear
 * `reason` rather than throwing, matching the disabled adapter contract.
 *
 * This adapter is intended for unit tests, integration smoke tests, and
 * the Aurigraph DLT sandbox. NEVER use in production — `live-v1` adapter
 * is the production target once BCR Third-Party authorisation lands.
 */

interface MockVccRecord {
  bcrSerialId: string;
  status: BcrVccStatus;
  units: number;
  vintage: number;
  projectId: string;
  recipientAccount: string;
  bcrLockId: string | null;
  /** Mint metadata, set on successful notifyMint. */
  mint: {
    chain: string;
    tokenContract: string;
    tokenId: string;
    serialFirst: string;
    serialLast: string;
  } | null;
  /** Retirement metadata, set on retire path. */
  retirement: {
    beneficiaryName: string;
    beneficiaryCountry: string;
    purpose: string;
    retiredAt: string;
  } | null;
}

interface MockLockRecord {
  bcrLockId: string;
  bcrSerialId: string;
  confirmed: boolean;
  expiresAt: string;
}

const DEFAULT_LOCK_TTL_MS = 24 * 60 * 60 * 1000; // 24h, BCR SOP §5.5 step 7 default

export class MockBcrAdapter implements BcrRegistryAdapter {
  readonly adapterName = 'mock';
  readonly isActive = true;

  private readonly vccs = new Map<string, MockVccRecord>();
  private readonly locks = new Map<string, MockLockRecord>();

  /** Test helper — wipe in-memory state. Not part of the public adapter
   *  contract. */
  __reset(): void {
    this.vccs.clear();
    this.locks.clear();
  }

  /** Test helper — preload a VCC in `free` state so tests don't have to
   *  drive the full life-cycle. Returns the serial id. */
  __seedFreeVcc(opts: {
    bcrSerialId?: string;
    units: number;
    vintage: number;
    projectId: string;
  }): string {
    const bcrSerialId = opts.bcrSerialId ?? `BCR-${randomUUID()}`;
    this.vccs.set(bcrSerialId, {
      bcrSerialId,
      status: 'free',
      units: opts.units,
      vintage: opts.vintage,
      projectId: opts.projectId,
      recipientAccount: '',
      bcrLockId: null,
      mint: null,
      retirement: null,
    });
    return bcrSerialId;
  }

  async lockVCC(params: LockVccParams): Promise<LockVccResult> {
    if (!Number.isInteger(params.units) || params.units <= 0) {
      return {
        ok: false,
        externalRef: null,
        reason: 'whole-ton enforcement (B11): units must be a positive integer',
      };
    }

    const bcrSerialId = params.bcrSerialId ?? `BCR-${randomUUID()}`;
    const existing = this.vccs.get(bcrSerialId);

    if (existing && existing.status !== 'free') {
      return {
        ok: false,
        externalRef: null,
        reason: `cannot lock VCC in status=${existing.status} (only free → locked is permitted)`,
      };
    }

    const bcrLockId = `BCR-LOCK-${randomUUID()}`;
    const expiresAt = new Date(Date.now() + DEFAULT_LOCK_TTL_MS).toISOString();

    this.vccs.set(bcrSerialId, {
      bcrSerialId,
      status: 'locked',
      units: params.units,
      vintage: params.vintage,
      projectId: params.projectId,
      recipientAccount: params.recipientAccount,
      bcrLockId,
      mint: null,
      retirement: null,
    });

    this.locks.set(bcrLockId, {
      bcrLockId,
      bcrSerialId,
      confirmed: false,
      expiresAt,
    });

    return {
      ok: true,
      externalRef: bcrLockId,
      data: {
        bcrLockId,
        bcrSerialId,
        lockedUnits: params.units,
        expiresAt,
      },
    };
  }

  async confirmLock(params: ConfirmLockParams): Promise<ConfirmLockResult> {
    const lock = this.locks.get(params.bcrLockId);
    if (!lock) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrLockId=${params.bcrLockId}`,
      };
    }

    lock.confirmed = true;
    const vcc = this.vccs.get(lock.bcrSerialId);
    return {
      ok: true,
      externalRef: lock.bcrLockId,
      data: {
        confirmed: true,
        status: vcc ? vcc.status : 'locked',
      },
    };
  }

  async notifyMint(params: NotifyMintParams): Promise<NotifyMintResult> {
    const vcc = this.vccs.get(params.bcrSerialId);
    if (!vcc) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrSerialId=${params.bcrSerialId}`,
      };
    }
    if (vcc.status !== 'locked') {
      return {
        ok: false,
        externalRef: null,
        reason: `notifyMint requires VCC in status=locked, got status=${vcc.status} (B5 lock-then-mint guard)`,
      };
    }
    const lock = this.locks.get(params.bcrLockId);
    if (!lock || lock.bcrSerialId !== params.bcrSerialId) {
      return {
        ok: false,
        externalRef: null,
        reason: `bcrLockId=${params.bcrLockId} does not bind to bcrSerialId=${params.bcrSerialId}`,
      };
    }
    if (!lock.confirmed) {
      return {
        ok: false,
        externalRef: null,
        reason: `bcrLockId=${params.bcrLockId} not confirmed; confirmLock must succeed before mint`,
      };
    }

    vcc.status = 'tokenized';
    vcc.mint = {
      chain: params.chain,
      tokenContract: params.tokenContract,
      tokenId: params.tokenId,
      serialFirst: params.serialFirst,
      serialLast: params.serialLast,
    };

    const bcrConfirmation = `BCR-MINT-${randomUUID()}`;
    return {
      ok: true,
      externalRef: bcrConfirmation,
      data: { bcrConfirmation },
    };
  }

  async notifyTransfer(
    params: NotifyTransferParams,
  ): Promise<NotifyTransferResult> {
    const vcc = this.vccs.get(params.bcrSerialId);
    if (!vcc) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrSerialId=${params.bcrSerialId}`,
      };
    }
    if (vcc.status !== 'tokenized') {
      return {
        ok: false,
        externalRef: null,
        reason: `notifyTransfer requires VCC in status=tokenized, got status=${vcc.status}`,
      };
    }
    const bcrConfirmation = `BCR-XFER-${randomUUID()}`;
    return {
      ok: true,
      externalRef: bcrConfirmation,
      data: { bcrConfirmation },
    };
  }

  async notifyBurn(params: NotifyBurnParams): Promise<NotifyBurnResult> {
    const vcc = this.vccs.get(params.bcrSerialId);
    if (!vcc) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrSerialId=${params.bcrSerialId}`,
      };
    }

    if (params.reason === 'RETIRE') {
      // Retire path: caller must have already locked (and typically minted)
      // the tranche. Both `locked` and `tokenized` are valid sources — the
      // ones-step retire convenience does not always go through mint.
      if (vcc.status !== 'locked' && vcc.status !== 'tokenized') {
        return {
          ok: false,
          externalRef: null,
          reason: `notifyBurn(RETIRE) requires VCC in status=locked|tokenized, got status=${vcc.status}`,
        };
      }
      if (!params.beneficiary) {
        return {
          ok: false,
          externalRef: null,
          reason: 'notifyBurn(RETIRE) requires beneficiary (B16)',
        };
      }
      vcc.status = 'retired';
      vcc.retirement = {
        beneficiaryName: params.beneficiary.name,
        beneficiaryCountry: params.beneficiary.country,
        purpose: 'BURN_ON_RETIREMENT',
        retiredAt: new Date().toISOString(),
      };
    } else if (params.reason === 'DELIST') {
      // Delist path: `tokenized → free` two-way bridge (B18).
      if (vcc.status !== 'tokenized' && vcc.status !== 'locked') {
        return {
          ok: false,
          externalRef: null,
          reason: `notifyBurn(DELIST) requires VCC in status=tokenized|locked, got status=${vcc.status}`,
        };
      }
      vcc.status = 'free';
      vcc.mint = null;
      if (vcc.bcrLockId) {
        this.locks.delete(vcc.bcrLockId);
        vcc.bcrLockId = null;
      }
    } else {
      // Exhaustive check — TypeScript catches this at compile time.
      return {
        ok: false,
        externalRef: null,
        reason: `unknown burn reason: ${String((params as { reason: unknown }).reason)}`,
      };
    }

    const bcrConfirmation = `BCR-BURN-${randomUUID()}`;
    return {
      ok: true,
      externalRef: bcrConfirmation,
      data: { bcrConfirmation },
    };
  }

  async unlockVCC(params: UnlockVccParams): Promise<UnlockVccResult> {
    const lock = this.locks.get(params.bcrLockId);
    if (!lock) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrLockId=${params.bcrLockId}`,
      };
    }
    const vcc = this.vccs.get(lock.bcrSerialId);
    if (!vcc) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrSerialId=${lock.bcrSerialId}`,
      };
    }
    if (vcc.status !== 'locked') {
      return {
        ok: false,
        externalRef: null,
        reason: `unlockVCC requires VCC in status=locked, got status=${vcc.status}`,
      };
    }

    vcc.status = 'free';
    vcc.bcrLockId = null;
    this.locks.delete(lock.bcrLockId);

    return {
      ok: true,
      externalRef: lock.bcrLockId,
      data: { bcrSerialId: vcc.bcrSerialId },
    };
  }

  async retireVCC(params: RetireVccParams): Promise<RetireVccResult> {
    const vcc = this.vccs.get(params.bcrSerialId);
    if (!vcc) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrSerialId=${params.bcrSerialId}`,
      };
    }
    if (vcc.status === 'retired' || vcc.status === 'cancelled') {
      return {
        ok: false,
        externalRef: null,
        reason: `retireVCC requires VCC in status=free|locked|tokenized, got status=${vcc.status}`,
      };
    }
    if (!params.beneficiary) {
      return {
        ok: false,
        externalRef: null,
        reason: 'retireVCC requires beneficiary (B16)',
      };
    }

    vcc.status = 'retired';
    vcc.retirement = {
      beneficiaryName: params.beneficiary.name,
      beneficiaryCountry: params.beneficiary.country,
      purpose: params.purpose,
      retiredAt: new Date().toISOString(),
    };

    const retirementId = `BCR-RETIRE-${randomUUID()}`;
    const retirementStatementUrl = `https://mock.biocarbonstandard.com/retirements/${retirementId}`;
    return {
      ok: true,
      externalRef: retirementId,
      data: { retirementStatementUrl },
    };
  }

  async getStatus(params: GetStatusParams): Promise<GetStatusResult> {
    const vcc = this.vccs.get(params.bcrSerialId);
    if (!vcc) {
      return {
        ok: false,
        externalRef: null,
        reason: `no such bcrSerialId=${params.bcrSerialId}`,
      };
    }
    return {
      ok: true,
      externalRef: vcc.bcrSerialId,
      data: { status: vcc.status },
    };
  }
}
