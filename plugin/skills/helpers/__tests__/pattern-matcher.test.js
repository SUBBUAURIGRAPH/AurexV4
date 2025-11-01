/**
 * Unit tests for Pattern Matcher
 *
 * @module pattern-matcher.test
 */

const PatternMatcher = require('../pattern-matcher');
const { SEVERITY } = require('../pattern-matcher');

describe('PatternMatcher', () => {
  let matcher;

  beforeEach(() => {
    matcher = new PatternMatcher();
  });

  describe('matchSecretPatterns', () => {
    test('should detect AWS access keys', () => {
      const code = 'const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('secret');
      expect(findings[0].name).toBe('AWS Access Key');
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should detect hardcoded API keys', () => {
      const code = 'const api_key = "sk_live_EXAMPLE_KEY_DO_NOT_USE";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('API Key'))).toBe(true);
    });

    test('should detect GitHub tokens', () => {
      const code = 'token = "ghp_abcdefghijklmnopqrstuvwxyz123456";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('GitHub'))).toBe(true);
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should detect database connection strings', () => {
      const code = 'const DB_URL = "mongodb://user:password@localhost:27017/mydb";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('Database'))).toBe(true);
    });

    test('should detect JWT tokens', () => {
      const code = 'const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'JWT Token')).toBe(true);
    });

    test('should detect hardcoded passwords', () => {
      const code = 'password = "SuperSecret123!";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('Password'))).toBe(true);
    });

    test('should detect private keys', () => {
      const code = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].name).toBe('RSA Private Key');
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should mask detected secrets', () => {
      const code = 'const key = "AKIAIOSFODNN7EXAMPLE";';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings[0].match).not.toBe('AKIAIOSFODNN7EXAMPLE');
      expect(findings[0].match).toContain('***');
    });

    test('should provide line and column numbers', () => {
      const code = 'const x = 1;\nconst key = "AKIAIOSFODNN7EXAMPLE";\nconst y = 2;';

      const findings = matcher.matchSecretPatterns(code);

      expect(findings[0].line).toBe(2);
      expect(findings[0].column).toBeGreaterThan(0);
    });
  });

  describe('matchSQLInjectionPatterns', () => {
    test('should detect SQL string concatenation', () => {
      const code = 'query = "SELECT * FROM users WHERE id = " + userId;';

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].type).toBe('sql-injection');
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should detect SQL template literals', () => {
      const code = 'const query = `SELECT * FROM users WHERE name = ${userName}`;';

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('Template'))).toBe(true);
    });

    test('should detect unparameterized INSERT', () => {
      const code = 'sql = "INSERT INTO users (name) VALUES (\'" + name + "\')";';

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('INSERT'))).toBe(true);
    });

    test('should detect unparameterized UPDATE', () => {
      const code = 'query = "UPDATE users SET name = " + newName + " WHERE id = " + id;';

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('UPDATE'))).toBe(true);
    });

    test('should detect Python f-string SQL injection', () => {
      const code = 'cursor.execute(f"SELECT * FROM users WHERE name = {user_input}")';

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('Python'))).toBe(true);
    });

    test('should detect Java string concatenation SQL', () => {
      const code = 'stmt.executeQuery("SELECT * FROM users WHERE id = " + userId);';

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('Java'))).toBe(true);
    });

    test('should detect dynamic WHERE clauses', () => {
      const code = "SELECT * FROM users WHERE status = '" + " + status + " + "'";

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
    });

    test('should detect OR 1=1 pattern', () => {
      const code = "SELECT * FROM users WHERE id = 1 OR 1=1";

      const findings = matcher.matchSQLInjectionPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name.includes('OR 1=1'))).toBe(true);
      expect(findings.some(f => f.severity === SEVERITY.CRITICAL)).toBe(true);
    });
  });

  describe('matchSecurityPatterns', () => {
    test('should detect eval() in JavaScript', () => {
      const code = 'const result = eval(userInput);';

      const findings = matcher.matchSecurityPatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].name).toBe('eval() Usage');
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should detect innerHTML usage', () => {
      const code = 'element.innerHTML = userContent;';

      const findings = matcher.matchSecurityPatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'innerHTML Usage')).toBe(true);
    });

    test('should detect Python exec()', () => {
      const code = 'exec(user_code)';

      const findings = matcher.matchSecurityPatterns(code, 'python');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].name).toBe('exec() Usage');
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should detect pickle deserialization', () => {
      const code = 'import pickle\ndata = pickle.loads(untrusted_data)';

      const findings = matcher.matchSecurityPatterns(code, 'python');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'Pickle Deserialization')).toBe(true);
    });

    test('should detect weak cryptography', () => {
      const code = 'hash = hashlib.md5(password).hexdigest()';

      const findings = matcher.matchSecurityPatterns(code, 'python');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'Weak Crypto')).toBe(true);
    });

    test('should detect Java Runtime.exec()', () => {
      const code = 'Runtime.getRuntime().exec(command);';

      const findings = matcher.matchSecurityPatterns(code, 'java');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].name).toBe('Runtime.exec()');
      expect(findings[0].severity).toBe(SEVERITY.CRITICAL);
    });

    test('should detect hardcoded IP addresses', () => {
      const code = 'const server = "192.168.1.1";';

      const findings = matcher.matchSecurityPatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'Hardcoded IP Address')).toBe(true);
    });

    test('should detect TODO/FIXME comments', () => {
      const code = '// TODO: Fix security vulnerability here';

      const findings = matcher.matchSecurityPatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'TODO/FIXME Comment')).toBe(true);
    });
  });

  describe('matchPerformancePatterns', () => {
    test('should detect synchronous file operations in JavaScript', () => {
      const code = 'const data = fs.readFileSync("file.txt");';

      const findings = matcher.matchPerformancePatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].name).toBe('Synchronous File Operations');
    });

    test('should detect nested loops', () => {
      const code = 'for (let i = 0; i < n; i++) { for (let j = 0; j < m; j++) { } }';

      const findings = matcher.matchPerformancePatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'Nested Loops')).toBe(true);
    });

    test('should detect SELECT * in SQL', () => {
      const sql = 'SELECT * FROM large_table';

      const findings = matcher.matchPerformancePatterns(sql, 'sql');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'SELECT *')).toBe(true);
    });

    test('should detect DELETE without WHERE clause', () => {
      const sql = 'DELETE FROM users;';

      const findings = matcher.matchPerformancePatterns(sql, 'sql');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'Missing WHERE Clause')).toBe(true);
      expect(findings.some(f => f.severity === SEVERITY.HIGH)).toBe(true);
    });

    test('should detect deep nesting', () => {
      const code = '{ { { { { } } } } }';

      const findings = matcher.matchPerformancePatterns(code, 'javascript');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some(f => f.name === 'Deep Nesting')).toBe(true);
    });
  });

  describe('matchCustomPattern', () => {
    test('should match custom patterns', () => {
      const code = 'const mySecret = "custom-secret-value";';
      const customPatterns = [
        { name: 'Custom Secret', pattern: /custom-secret-\w+/, severity: SEVERITY.HIGH }
      ];

      const findings = matcher.matchCustomPattern(code, customPatterns);

      expect(findings.length).toBe(1);
      expect(findings[0].type).toBe('custom');
      expect(findings[0].name).toBe('Custom Secret');
      expect(findings[0].severity).toBe(SEVERITY.HIGH);
    });

    test('should use default severity for custom patterns without severity', () => {
      const code = 'test pattern here';
      const customPatterns = [
        { name: 'Test Pattern', pattern: /test pattern/ }
      ];

      const findings = matcher.matchCustomPattern(code, customPatterns);

      expect(findings[0].severity).toBe(SEVERITY.MEDIUM);
    });

    test('should handle multiple custom patterns', () => {
      const code = 'pattern1 and pattern2';
      const customPatterns = [
        { name: 'Pattern 1', pattern: /pattern1/, severity: SEVERITY.HIGH },
        { name: 'Pattern 2', pattern: /pattern2/, severity: SEVERITY.LOW }
      ];

      const findings = matcher.matchCustomPattern(code, customPatterns);

      expect(findings.length).toBe(2);
      expect(findings[0].name).toBe('Pattern 1');
      expect(findings[1].name).toBe('Pattern 2');
    });
  });

  describe('scoreSeverity', () => {
    test('should score CRITICAL as 100', () => {
      const finding = { severity: SEVERITY.CRITICAL };
      expect(matcher.scoreSeverity(finding)).toBe(100);
    });

    test('should score HIGH as 75', () => {
      const finding = { severity: SEVERITY.HIGH };
      expect(matcher.scoreSeverity(finding)).toBe(75);
    });

    test('should score MEDIUM as 50', () => {
      const finding = { severity: SEVERITY.MEDIUM };
      expect(matcher.scoreSeverity(finding)).toBe(50);
    });

    test('should score LOW as 25', () => {
      const finding = { severity: SEVERITY.LOW };
      expect(matcher.scoreSeverity(finding)).toBe(25);
    });

    test('should score INFO as 10', () => {
      const finding = { severity: SEVERITY.INFO };
      expect(matcher.scoreSeverity(finding)).toBe(10);
    });

    test('should return 0 for unknown severity', () => {
      const finding = { severity: 'unknown' };
      expect(matcher.scoreSeverity(finding)).toBe(0);
    });
  });

  describe('edge cases', () => {
    test('should handle empty content', () => {
      const findings = matcher.matchSecretPatterns('');
      expect(findings).toEqual([]);
    });

    test('should handle content with no matches', () => {
      const code = 'const x = 1; const y = 2;';
      const findings = matcher.matchSecretPatterns(code);
      expect(findings.length).toBe(0);
    });

    test('should handle multiline content', () => {
      const code = `
        line 1
        const key = "AKIAIOSFODNN7EXAMPLE"
        line 3
      `;

      const findings = matcher.matchSecretPatterns(code);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].line).toBe(3);
    });

    test('should handle very long matches gracefully', () => {
      const longString = 'SELECT ' + 'x '.repeat(100) + 'FROM table';
      const findings = matcher.matchSQLInjectionPatterns(longString);

      if (findings.length > 0) {
        expect(findings[0].match.length).toBeLessThanOrEqual(100);
      }
    });
  });
});
