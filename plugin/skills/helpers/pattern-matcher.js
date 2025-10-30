/**
 * Pattern Matcher - Security vulnerability and bug pattern detection
 *
 * Features:
 * - 30+ secret detection patterns (API keys, passwords, tokens)
 * - 20+ SQL injection patterns
 * - 10+ hardcoded credential patterns
 * - 15+ security anti-patterns (XSS, CSRF, etc.)
 * - 10+ performance anti-patterns
 * - Severity scoring system
 * - Custom pattern support
 * - Language-specific pattern matching
 *
 * @module pattern-matcher
 */

/**
 * Severity levels for findings
 */
const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * Pattern matcher for security vulnerabilities and code issues
 */
class PatternMatcher {
  constructor() {
    this.secretPatterns = this._initSecretPatterns();
    this.sqlInjectionPatterns = this._initSQLInjectionPatterns();
    this.securityPatterns = this._initSecurityPatterns();
    this.performancePatterns = this._initPerformancePatterns();
  }

  /**
   * Initialize secret detection patterns (30+ patterns)
   *
   * @private
   * @returns {Array} Secret patterns
   */
  _initSecretPatterns() {
    return [
      // AWS
      { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/, severity: SEVERITY.CRITICAL },
      { name: 'AWS Secret Key', pattern: /aws[_-]?secret[_-]?access[_-]?key["\s:=]+[a-zA-Z0-9/+=]{40}/i, severity: SEVERITY.CRITICAL },
      { name: 'AWS Session Token', pattern: /aws[_-]?session[_-]?token["\s:=]+[a-zA-Z0-9/+=]{100,}/i, severity: SEVERITY.HIGH },

      // API Keys
      { name: 'Generic API Key', pattern: /api[_-]?key["\s:=]+[a-zA-Z0-9_\-]{20,}/i, severity: SEVERITY.HIGH },
      { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_\-]{35}/, severity: SEVERITY.HIGH },
      { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{32,}/, severity: SEVERITY.CRITICAL },
      { name: 'GitHub Personal Access Token', pattern: /ghp_[a-zA-Z0-9]{32,}/, severity: SEVERITY.CRITICAL },
      { name: 'Slack Token', pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/, severity: SEVERITY.HIGH },
      { name: 'Slack Webhook', pattern: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]+\/B[a-zA-Z0-9_]+\/[a-zA-Z0-9_]+/, severity: SEVERITY.MEDIUM },

      // Cloud Services
      { name: 'Azure Storage Key', pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[a-zA-Z0-9/+=]{88}/, severity: SEVERITY.CRITICAL },
      { name: 'Heroku API Key', pattern: /heroku[_-]?api[_-]?key["\s:=]+[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i, severity: SEVERITY.HIGH },

      // Database
      { name: 'Database Connection String', pattern: /(mongodb|mysql|postgresql):\/\/[^:]+:[^@]+@[^\/]+\/[^\s"']+/, severity: SEVERITY.CRITICAL },
      { name: 'PostgreSQL Connection', pattern: /postgres:\/\/[^:]+:[^@]+@[^\/]+\/[^\s"']+/, severity: SEVERITY.CRITICAL },
      { name: 'MySQL Connection', pattern: /mysql:\/\/[^:]+:[^@]+@[^\/]+\/[^\s"']+/, severity: SEVERITY.CRITICAL },

      // JWT
      { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/, severity: SEVERITY.HIGH },

      // Private Keys
      { name: 'RSA Private Key', pattern: /-----BEGIN RSA PRIVATE KEY-----/, severity: SEVERITY.CRITICAL },
      { name: 'SSH Private Key', pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/, severity: SEVERITY.CRITICAL },
      { name: 'PGP Private Key', pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/, severity: SEVERITY.CRITICAL },

      // Passwords
      { name: 'Hardcoded Password', pattern: /password["\s:=]+["'][^"'\s]{8,}["']/i, severity: SEVERITY.HIGH },
      { name: 'Auth Password', pattern: /auth[_-]?pass(?:word)?["\s:=]+["'][^"'\s]+["']/i, severity: SEVERITY.HIGH },
      { name: 'DB Password', pattern: /db[_-]?pass(?:word)?["\s:=]+["'][^"'\s]+["']/i, severity: SEVERITY.HIGH },

      // Tokens
      { name: 'Bearer Token', pattern: /bearer\s+[a-zA-Z0-9_\-\.=]+/i, severity: SEVERITY.HIGH },
      { name: 'Auth Token', pattern: /auth[_-]?token["\s:=]+["'][a-zA-Z0-9_\-\.=]{20,}["']/i, severity: SEVERITY.HIGH },
      { name: 'Access Token', pattern: /access[_-]?token["\s:=]+["'][a-zA-Z0-9_\-\.=]{20,}["']/i, severity: SEVERITY.HIGH },

      // Payment
      { name: 'Stripe API Key', pattern: /sk_live_[0-9a-zA-Z]{24,}/, severity: SEVERITY.CRITICAL },
      { name: 'PayPal Token', pattern: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/, severity: SEVERITY.CRITICAL },

      // Social Media
      { name: 'Twitter API Key', pattern: /twitter[_-]?api[_-]?key["\s:=]+[a-zA-Z0-9]{25,}/i, severity: SEVERITY.MEDIUM },
      { name: 'Facebook Access Token', pattern: /EAACEdEose0cBA[0-9A-Za-z]+/, severity: SEVERITY.MEDIUM },

      // Generic Secrets
      { name: 'Secret Key', pattern: /secret[_-]?key["\s:=]+["'][^"'\s]{16,}["']/i, severity: SEVERITY.HIGH },
      { name: 'Private Key', pattern: /private[_-]?key["\s:=]+["'][^"'\s]{16,}["']/i, severity: SEVERITY.HIGH },
      { name: 'Encryption Key', pattern: /encryption[_-]?key["\s:=]+["'][^"'\s]{16,}["']/i, severity: SEVERITY.HIGH }
    ];
  }

  /**
   * Initialize SQL injection patterns (20+ patterns)
   *
   * @private
   * @returns {Array} SQL injection patterns
   */
  _initSQLInjectionPatterns() {
    return [
      // Direct concatenation
      { name: 'SQL String Concatenation', pattern: /"(?:SELECT|INSERT|UPDATE|DELETE)[^"]*"\s*\+/i, severity: SEVERITY.CRITICAL },
      { name: 'SQL Template Literal', pattern: /`(?:SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{[^}]+\}[^`]*`/i, severity: SEVERITY.CRITICAL },
      { name: 'String Format SQL', pattern: /\.format\s*\([^)]*SELECT/i, severity: SEVERITY.HIGH },

      // Unparameterized queries
      { name: 'Unparameterized INSERT', pattern: /INSERT\s+INTO\s+\w+.*VALUES\s*\([^?)]*\+/i, severity: SEVERITY.CRITICAL },
      { name: 'Unparameterized UPDATE', pattern: /UPDATE\s+\w+\s+SET.*\+/i, severity: SEVERITY.CRITICAL },
      { name: 'Unparameterized DELETE', pattern: /DELETE\s+FROM\s+\w+.*WHERE.*\+/i, severity: SEVERITY.CRITICAL },

      // Python-specific
      { name: 'Python String Format SQL', pattern: /execute\s*\(\s*[f"']SELECT.*%s/i, severity: SEVERITY.CRITICAL },
      { name: 'Python F-String SQL', pattern: /execute\s*\(\s*f["']SELECT/i, severity: SEVERITY.CRITICAL },

      // JavaScript-specific
      { name: 'JS String Interpolation SQL', pattern: /query\s*\(\s*`SELECT.*\${/i, severity: SEVERITY.CRITICAL },
      { name: 'Dynamic Table Name', pattern: /FROM\s+\${.*}|FROM\s+\+/i, severity: SEVERITY.HIGH },

      // Java-specific
      { name: 'Java String Concatenation SQL', pattern: /executeQuery\s*\(\s*"(?:SELECT|INSERT|UPDATE|DELETE)[^"]*"\s*\+/i, severity: SEVERITY.CRITICAL },
      { name: 'PreparedStatement Misuse', pattern: /prepareStatement\s*\([^)]*\+/i, severity: SEVERITY.HIGH },

      // Raw SQL execution
      { name: 'Raw SQL Execution', pattern: /exec\s*\(\s*["'](?:SELECT|INSERT|UPDATE|DELETE)/i, severity: SEVERITY.HIGH },
      { name: 'Execute Raw', pattern: /executeRaw\s*\(/i, severity: SEVERITY.MEDIUM },

      // ORM bypasses
      { name: 'Raw Query in ORM', pattern: /\.raw\s*\(\s*["']SELECT/i, severity: SEVERITY.MEDIUM },
      { name: 'Unsafe SQL Fragment', pattern: /SQL\s*\(\s*["'][^"']*\+/i, severity: SEVERITY.HIGH },

      // WHERE clause issues
      { name: 'Dynamic WHERE Clause', pattern: /WHERE.*=\s*["'][^"']*["']\s*\+|WHERE.*\+.*["']/i, severity: SEVERITY.HIGH },
      { name: 'OR 1=1 Pattern', pattern: /OR\s+1\s*=\s*1/i, severity: SEVERITY.CRITICAL },

      // UNION-based
      { name: 'UNION Injection', pattern: /UNION\s+SELECT/i, severity: SEVERITY.CRITICAL },

      // Comment-based
      { name: 'SQL Comment Injection', pattern: /--\s*$|\/\*.*\*\//m, severity: SEVERITY.MEDIUM }
    ];
  }

  /**
   * Initialize security anti-patterns (15+ patterns)
   *
   * @private
   * @returns {Object} Security patterns by language
   */
  _initSecurityPatterns() {
    return {
      javascript: [
        { name: 'eval() Usage', pattern: /\beval\s*\(/, severity: SEVERITY.CRITICAL },
        { name: 'Function Constructor', pattern: /new\s+Function\s*\(/, severity: SEVERITY.HIGH },
        { name: 'innerHTML Usage', pattern: /\.innerHTML\s*=/, severity: SEVERITY.HIGH },
        { name: 'document.write', pattern: /document\.write\s*\(/, severity: SEVERITY.MEDIUM },
        { name: 'Unvalidated Redirect', pattern: /window\.location\s*=.*\+/, severity: SEVERITY.HIGH }
      ],
      python: [
        { name: 'exec() Usage', pattern: /\bexec\s*\(/, severity: SEVERITY.CRITICAL },
        { name: 'eval() Usage', pattern: /\beval\s*\(/, severity: SEVERITY.CRITICAL },
        { name: 'Pickle Deserialization', pattern: /pickle\.loads?\s*\(/, severity: SEVERITY.HIGH },
        { name: 'YAML Unsafe Load', pattern: /yaml\.load\s*\([^,)]*\)/, severity: SEVERITY.HIGH },
        { name: 'Weak Crypto', pattern: /hashlib\.(md5|sha1)\s*\(/, severity: SEVERITY.MEDIUM }
      ],
      java: [
        { name: 'Runtime.exec()', pattern: /Runtime\.getRuntime\(\)\.exec\s*\(/, severity: SEVERITY.CRITICAL },
        { name: 'Reflection Usage', pattern: /Class\.forName\s*\(/, severity: SEVERITY.HIGH },
        { name: 'Deserialization', pattern: /ObjectInputStream.*readObject\s*\(/, severity: SEVERITY.CRITICAL },
        { name: 'XXE Vulnerability', pattern: /DocumentBuilderFactory.*newInstance\(\)/, severity: SEVERITY.HIGH }
      ],
      all: [
        { name: 'Hardcoded IP Address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/, severity: SEVERITY.LOW },
        { name: 'TODO/FIXME Comment', pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX)/i, severity: SEVERITY.INFO },
        { name: 'Debug Code', pattern: /console\.log|print\s*\(|System\.out\.println/i, severity: SEVERITY.INFO }
      ]
    };
  }

  /**
   * Initialize performance anti-patterns (10+ patterns)
   *
   * @private
   * @returns {Object} Performance patterns by language
   */
  _initPerformancePatterns() {
    return {
      javascript: [
        { name: 'Synchronous File Operations', pattern: /fs\.readFileSync|fs\.writeFileSync/, severity: SEVERITY.MEDIUM },
        { name: 'Nested Loops', pattern: /for\s*\([^)]*\)[^{]*{[^}]*for\s*\([^)]*\)/, severity: SEVERITY.LOW },
        { name: 'Array in Loop', pattern: /for\s*\([^)]*\)[^{]*{[^}]*\.push\s*\(/, severity: SEVERITY.LOW }
      ],
      python: [
        { name: 'List Comprehension in Loop', pattern: /for\s+\w+\s+in.*:\s*\[[^\]]*for\s+/, severity: SEVERITY.LOW },
        { name: 'String Concatenation in Loop', pattern: /for\s+\w+\s+in.*:\s*\w+\s*\+=\s*["']/, severity: SEVERITY.MEDIUM }
      ],
      sql: [
        { name: 'SELECT *', pattern: /SELECT\s+\*\s+FROM/i, severity: SEVERITY.LOW },
        { name: 'Missing WHERE Clause', pattern: /DELETE\s+FROM\s+\w+\s*;/i, severity: SEVERITY.HIGH },
        { name: 'N+1 Query', pattern: /for\s*\([^)]*\)[^{]*{[^}]*SELECT.*FROM/, severity: SEVERITY.MEDIUM }
      ],
      all: [
        { name: 'Deep Nesting', pattern: /{[^}]*{[^}]*{[^}]*{[^}]*{/, severity: SEVERITY.LOW }
      ]
    };
  }

  /**
   * Match secret patterns in content
   *
   * @param {string} content - Source code content
   * @returns {Array} Detected secrets
   */
  matchSecretPatterns(content) {
    const findings = [];

    for (const { name, pattern, severity } of this.secretPatterns) {
      const matches = content.matchAll(new RegExp(pattern, 'gm'));

      for (const match of matches) {
        findings.push({
          type: 'secret',
          name,
          severity,
          match: this._maskSecret(match[0]),
          line: this._getLineNumber(content, match.index),
          column: this._getColumnNumber(content, match.index)
        });
      }
    }

    return findings;
  }

  /**
   * Match SQL injection patterns
   *
   * @param {string} content - Source code content
   * @returns {Array} Detected SQL injection vulnerabilities
   */
  matchSQLInjectionPatterns(content) {
    const findings = [];

    for (const { name, pattern, severity } of this.sqlInjectionPatterns) {
      const matches = content.matchAll(new RegExp(pattern, 'gm'));

      for (const match of matches) {
        findings.push({
          type: 'sql-injection',
          name,
          severity,
          match: match[0].substring(0, 100),
          line: this._getLineNumber(content, match.index),
          column: this._getColumnNumber(content, match.index)
        });
      }
    }

    return findings;
  }

  /**
   * Match security patterns for specific language
   *
   * @param {string} content - Source code content
   * @param {string} language - Programming language
   * @returns {Array} Detected security issues
   */
  matchSecurityPatterns(content, language) {
    const findings = [];
    const patterns = [
      ...(this.securityPatterns[language] || []),
      ...this.securityPatterns.all
    ];

    for (const { name, pattern, severity } of patterns) {
      const matches = content.matchAll(new RegExp(pattern, 'gm'));

      for (const match of matches) {
        findings.push({
          type: 'security',
          name,
          severity,
          match: match[0].substring(0, 100),
          line: this._getLineNumber(content, match.index),
          column: this._getColumnNumber(content, match.index)
        });
      }
    }

    return findings;
  }

  /**
   * Match performance anti-patterns
   *
   * @param {string} content - Source code content
   * @param {string} language - Programming language
   * @returns {Array} Detected performance issues
   */
  matchPerformancePatterns(content, language) {
    const findings = [];
    const patterns = [
      ...(this.performancePatterns[language] || []),
      ...this.performancePatterns.all
    ];

    for (const { name, pattern, severity } of patterns) {
      const matches = content.matchAll(new RegExp(pattern, 'gm'));

      for (const match of matches) {
        findings.push({
          type: 'performance',
          name,
          severity,
          match: match[0].substring(0, 100),
          line: this._getLineNumber(content, match.index),
          column: this._getColumnNumber(content, match.index)
        });
      }
    }

    return findings;
  }

  /**
   * Match custom patterns
   *
   * @param {string} content - Source code content
   * @param {Array} patterns - Custom pattern definitions
   * @returns {Array} Matches
   */
  matchCustomPattern(content, patterns) {
    const findings = [];

    for (const { name, pattern, severity } of patterns) {
      const regex = new RegExp(pattern, 'gm');
      const matches = content.matchAll(regex);

      for (const match of matches) {
        findings.push({
          type: 'custom',
          name,
          severity: severity || SEVERITY.MEDIUM,
          match: match[0].substring(0, 100),
          line: this._getLineNumber(content, match.index),
          column: this._getColumnNumber(content, match.index)
        });
      }
    }

    return findings;
  }

  /**
   * Score severity of finding
   *
   * @param {Object} finding - Finding object
   * @returns {number} Severity score (0-100)
   */
  scoreSeverity(finding) {
    const scores = {
      [SEVERITY.CRITICAL]: 100,
      [SEVERITY.HIGH]: 75,
      [SEVERITY.MEDIUM]: 50,
      [SEVERITY.LOW]: 25,
      [SEVERITY.INFO]: 10
    };

    return scores[finding.severity] || 0;
  }

  /**
   * Get line number from content index
   *
   * @private
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {number} Line number
   */
  _getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Get column number from content index
   *
   * @private
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {number} Column number
   */
  _getColumnNumber(content, index) {
    const lastNewline = content.lastIndexOf('\n', index);
    return index - lastNewline;
  }

  /**
   * Mask secret value for safe display
   *
   * @private
   * @param {string} secret - Secret value
   * @returns {string} Masked secret
   */
  _maskSecret(secret) {
    if (secret.length <= 8) return '***';
    return secret.substring(0, 4) + '***' + secret.substring(secret.length - 4);
  }
}

module.exports = PatternMatcher;
module.exports.SEVERITY = SEVERITY;
