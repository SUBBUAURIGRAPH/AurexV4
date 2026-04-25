import { beforeEach, describe, expect, it } from 'vitest';

import { MockKycAdapter } from './mock-kyc-adapter.js';

// ─── MockKycAdapter — state machine ──────────────────────────────────
// AAT-θ / AV4-354 — KYC / CDD / AML / CTF adapter (BCR binding requirement
// B15). The mock implements the vendor-style state machine in-memory:
//
//   pending → approved          (auto-approves on first getVerificationStatus
//                                unless seeded otherwise)
//   pending → rejected          (driven by __seedStatus)
//   approved → revoked          (revokeVerification)
//   pending → revoked           (revokeVerification before approval)
//
// Approved verifications can additionally be tagged with a beneficiary
// reference + attestations via `markBeneficiaryVerified` (B16).

describe('MockKycAdapter — state machine', () => {
  let adapter: MockKycAdapter;

  beforeEach(() => {
    adapter = new MockKycAdapter();
  });

  it('exposes adapterName=mock and isActive=true', () => {
    expect(adapter.adapterName).toBe('mock');
    expect(adapter.isActive).toBe(true);
  });

  it('startVerification returns synced=true with verificationId + status=pending', async () => {
    const result = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: '00000000-0000-4000-8000-000000000001',
      level: 'basic',
      metadata: { country: 'IN' },
    });

    expect(result.synced).toBe(true);
    expect(result.data?.verificationId).toBeTruthy();
    expect(result.data?.status).toBe('pending');
    expect(result.data?.vendorRef).toMatch(/^MOCK-KYC-/);
  });

  it('startVerification rejects empty subjectRef with synced=false', async () => {
    const result = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: '   ',
      level: 'basic',
      metadata: {},
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/subjectRef is required/);
  });

  it('startVerification refuses double-start for an active subject', async () => {
    const first = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-1',
      level: 'basic',
      metadata: {},
    });
    expect(first.synced).toBe(true);

    const second = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-1',
      level: 'basic',
      metadata: {},
    });
    expect(second.synced).toBe(false);
    expect(second.reason).toMatch(/already has an active verification/);
  });

  it('getVerificationStatus auto-approves a pending verification with no sanctions hit', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-2',
      level: 'basic',
      metadata: {},
    });
    expect(start.synced).toBe(true);
    const verificationId = start.data!.verificationId;

    const status = await adapter.getVerificationStatus({ verificationId });
    expect(status.synced).toBe(true);
    expect(status.data?.status).toBe('approved');
    expect(status.data?.riskScore).toBe(10);
    expect(status.data?.sanctionsHit).toBe(false);
    expect(status.data?.lastCheckedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('getVerificationStatus on unknown verificationId returns synced=false', async () => {
    const status = await adapter.getVerificationStatus({
      verificationId: 'nope-not-real',
    });
    expect(status.synced).toBe(false);
    expect(status.reason).toMatch(/no such verificationId/);
  });

  it('__seedStatus("rejected") preserves the seeded status — no auto-approval', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-rejected',
      level: 'enhanced',
      metadata: {},
    });
    const verificationId = start.data!.verificationId;
    expect(
      adapter.__seedStatus(verificationId, 'rejected', { sanctionsHit: true }),
    ).toBe(true);

    const status = await adapter.getVerificationStatus({ verificationId });
    expect(status.synced).toBe(true);
    expect(status.data?.status).toBe('rejected');
    expect(status.data?.sanctionsHit).toBe(true);
  });

  it('markBeneficiaryVerified binds beneficiaryRef + attestations to an approved verification', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'beneficiary',
      subjectRef: 'beneficiary-1',
      level: 'basic',
      metadata: {},
    });
    const verificationId = start.data!.verificationId;
    // Auto-approve via status read.
    await adapter.getVerificationStatus({ verificationId });

    const mark = await adapter.markBeneficiaryVerified({
      verificationId,
      beneficiaryRef: 'Acme Sustainability Inc.',
      attestations: [
        { kind: 'aml_screening_v1', value: 'clean', signedAt: '2026-04-25T00:00:00Z' },
      ],
    });
    expect(mark.synced).toBe(true);
    expect(mark.data?.verificationId).toBe(verificationId);
    expect(mark.data?.beneficiaryRef).toBe('Acme Sustainability Inc.');
    expect(mark.data?.attestationCount).toBe(1);
  });

  it('markBeneficiaryVerified fails cleanly on a pending (not-yet-approved) verification (B16 retirement guard)', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'beneficiary',
      subjectRef: 'beneficiary-2',
      level: 'basic',
      metadata: {},
    });
    const verificationId = start.data!.verificationId;
    // Force-keep the verification in pending — DON'T poll status.
    adapter.__seedStatus(verificationId, 'pending');

    const mark = await adapter.markBeneficiaryVerified({
      verificationId,
      beneficiaryRef: 'Beneficiary Co.',
      attestations: [
        { kind: 'aml_screening_v1', value: 'clean', signedAt: '2026-04-25T00:00:00Z' },
      ],
    });
    expect(mark.synced).toBe(false);
    expect(mark.reason).toMatch(/status=approved/);
  });

  it('listForSubject filters by subjectKind+subjectRef and includes revoked entries', async () => {
    const a = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-list',
      level: 'basic',
      metadata: {},
    });
    const aId = a.data!.verificationId;
    // Approve, then revoke.
    await adapter.getVerificationStatus({ verificationId: aId });
    await adapter.revokeVerification({
      verificationId: aId,
      reason: 'sanctions list update',
    });

    // Different subject — should not appear in listForSubject(subject-list).
    await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'other-subject',
      level: 'basic',
      metadata: {},
    });

    const list = await adapter.listForSubject({
      subjectKind: 'user',
      subjectRef: 'subject-list',
    });
    expect(list.synced).toBe(true);
    expect(list.data?.entries.length).toBe(1);
    expect(list.data?.entries[0]?.verificationId).toBe(aId);
    expect(list.data?.entries[0]?.status).toBe('revoked');
  });

  it('revokeVerification flips an approved verification to revoked + records the reason', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-revoke',
      level: 'basic',
      metadata: {},
    });
    const verificationId = start.data!.verificationId;
    await adapter.getVerificationStatus({ verificationId }); // auto-approve

    const revoke = await adapter.revokeVerification({
      verificationId,
      reason: 'sanctions list match',
    });
    expect(revoke.synced).toBe(true);
    expect(revoke.data?.status).toBe('revoked');

    const status = await adapter.getVerificationStatus({ verificationId });
    expect(status.data?.status).toBe('revoked');
  });

  it('revokeVerification on an already-revoked verification is a no-op (synced=false with clear reason)', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-double-revoke',
      level: 'basic',
      metadata: {},
    });
    const verificationId = start.data!.verificationId;
    await adapter.getVerificationStatus({ verificationId }); // auto-approve

    const first = await adapter.revokeVerification({
      verificationId,
      reason: 'first revoke',
    });
    expect(first.synced).toBe(true);

    const second = await adapter.revokeVerification({
      verificationId,
      reason: 'duplicate revoke attempt',
    });
    expect(second.synced).toBe(false);
    expect(second.reason).toMatch(/already revoked/);
  });

  it('revokeVerification requires a non-empty reason', async () => {
    const start = await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-revoke-noreason',
      level: 'basic',
      metadata: {},
    });
    const verificationId = start.data!.verificationId;
    await adapter.getVerificationStatus({ verificationId });

    const result = await adapter.revokeVerification({
      verificationId,
      reason: '   ',
    });
    expect(result.synced).toBe(false);
    expect(result.reason).toMatch(/reason is required/);
  });

  it('__reset clears all in-memory state', async () => {
    await adapter.startVerification({
      subjectKind: 'user',
      subjectRef: 'subject-reset',
      level: 'basic',
      metadata: {},
    });

    const beforeReset = await adapter.listForSubject({
      subjectKind: 'user',
      subjectRef: 'subject-reset',
    });
    expect(beforeReset.data?.entries.length).toBe(1);

    adapter.__reset();

    const afterReset = await adapter.listForSubject({
      subjectKind: 'user',
      subjectRef: 'subject-reset',
    });
    expect(afterReset.data?.entries.length).toBe(0);
  });
});
