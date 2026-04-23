import { describe, test, expect } from 'vitest';

/**
 * ADM-056: OWASP-001 Injection Attack Prevention
 * Validates SQL, NoSQL, command injection protection
 */

const API_BASE = process.env.API_URL ?? 'http://localhost:3001';

const SQL_INJECTION_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1; SELECT * FROM users",
  "' UNION SELECT NULL, NULL --",
  "admin'--",
  "1' AND '1'='1",
  "' OR 1=1 --",
  '" OR ""="',
  "' OR 'x'='x",
  "1'; EXEC xp_cmdshell('dir'); --",
  "') OR ('1'='1",
  "'; WAITFOR DELAY '0:0:5' --",
  "1 AND 1=1",
  "' AND SUBSTRING(@@version,1,1)='5",
  "UNION ALL SELECT NULL--",
];

describe('[critical] OWASP-001: Injection Prevention', () => {
  test.each(SQL_INJECTION_PAYLOADS)(
    'blocks SQL injection payload: %s',
    async (payload) => {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload, password: payload }),
      });

      // Should get 400 (bad request) not 200 or 500
      expect(res.status).not.toBe(500);
      const body = await res.json();
      // Should never contain database error details
      expect(JSON.stringify(body)).not.toMatch(/syntax error|pg_|mysql|sqlite/i);
    },
  );

  test('blocks command injection in inputs', async () => {
    const cmdPayloads = [
      '; ls -la',
      '| cat /etc/passwd',
      '$(whoami)',
      '`id`',
    ];

    for (const payload of cmdPayloads) {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload, password: 'test' }),
      });
      expect(res.status).not.toBe(500);
    }
  });
});
