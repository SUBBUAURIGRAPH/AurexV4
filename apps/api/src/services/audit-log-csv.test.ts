/**
 * AAT-10A (Wave 10a): unit tests for the inline CSV escaper / row
 * serializer used by the audit-logs export endpoint.
 */

import { describe, it, expect } from 'vitest';

import {
  AUDIT_CSV_HEADER,
  AUDIT_CSV_ROW_CAP,
  buildAuditCsv,
  escapeCsvCell,
  rowToCsv,
  summarizeChange,
} from './audit-log-csv.js';
import type { AuditLogEntry } from './audit-log.service.js';

describe('escapeCsvCell', () => {
  it('returns plain strings unchanged', () => {
    expect(escapeCsvCell('hello')).toBe('hello');
    expect(escapeCsvCell('user.update')).toBe('user.update');
  });

  it('quotes cells with commas', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
  });

  it('doubles and quotes embedded double-quotes', () => {
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes cells containing newlines', () => {
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvCell('cr\rlf')).toBe('"cr\rlf"');
  });

  it('preserves the empty string', () => {
    expect(escapeCsvCell('')).toBe('');
  });
});

describe('summarizeChange', () => {
  it('returns empty when both sides are nullish', () => {
    expect(summarizeChange(null, null)).toBe('');
    expect(summarizeChange(undefined, undefined)).toBe('');
  });

  it('formats a "set=" summary when only newValue is present', () => {
    expect(summarizeChange(null, { name: 'Acme' })).toBe('set={"name":"Acme"}');
  });

  it('formats a "before=…; after=…" summary on full diffs', () => {
    expect(summarizeChange({ a: 1 }, { a: 2 })).toBe(
      'before={"a":1}; after={"a":2}',
    );
  });

  it('truncates summaries longer than 200 chars with an ellipsis', () => {
    const big = { value: 'x'.repeat(500) };
    const summary = summarizeChange(null, big);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith('…')).toBe(true);
  });

  it('falls back gracefully when JSON.stringify throws (circular ref)', () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(summarizeChange(null, circ)).toBe('[unserializable]');
  });
});

describe('rowToCsv + buildAuditCsv', () => {
  function makeEntry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
    return {
      id: 'a1',
      userId: 'u1',
      userEmail: 'jane@aurex.in',
      action: 'user.update',
      resource: 'User',
      resourceId: 'r1',
      oldValue: null,
      newValue: { email: 'new@aurex.in' },
      ipAddress: '203.0.113.4',
      createdAt: new Date('2026-04-01T12:34:56.000Z'),
      ...overrides,
    };
  }

  it('serializes a row in header order with ISO-8601 timestamp', () => {
    const csv = rowToCsv(makeEntry());
    const cells = csv.split(',');
    expect(cells[0]).toBe('2026-04-01T12:34:56.000Z');
    expect(cells[1]).toBe('jane@aurex.in');
    expect(cells[2]).toBe('user.update');
    expect(cells[3]).toBe('User');
    expect(cells[4]).toBe('r1');
    expect(cells[cells.length - 1]).toBe('203.0.113.4');
  });

  it('uses "system" as the actor when userId & userEmail are null', () => {
    const csv = rowToCsv(makeEntry({ userId: null, userEmail: null }));
    expect(csv.split(',')[1]).toBe('system');
  });

  it('emits the canonical 7-column header followed by CRLF rows', () => {
    const csv = buildAuditCsv([makeEntry()]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'timestamp,actor,action,resourceKind,resourceId,changeSummary,ipAddress',
    );
    expect(lines[0]).toBe(AUDIT_CSV_HEADER.join(','));
    // Header + 1 data row + trailing empty (because of the final CRLF).
    expect(lines).toHaveLength(3);
  });

  it('caps the row export at 10,000 rows', () => {
    expect(AUDIT_CSV_ROW_CAP).toBe(10_000);
  });
});
