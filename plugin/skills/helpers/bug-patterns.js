/**
 * Bug Pattern Library for Code Analysis
 *
 * Comprehensive collection of bug patterns across multiple languages
 * Used by code analyzers to detect common issues, security vulnerabilities,
 * and code quality problems.
 *
 * @version 1.0.0
 * @author Aurigraph Development Team
 */

/**
 * Bug pattern definition structure
 * @typedef {Object} BugPattern
 * @property {string} id - Unique pattern identifier
 * @property {string} name - Human-readable pattern name
 * @property {string} category - Pattern category (security, performance, quality, etc.)
 * @property {string} severity - 'critical', 'high', 'medium', 'low'
 * @property {string} description - Detailed description
 * @property {string[]} languages - Languages this pattern applies to
 * @property {RegExp|Function} detection - Pattern detection logic
 * @property {string} remedy - How to fix the issue
 * @property {string} cwe - CWE identifier if security-related
 */

const BugPatterns = {
  // ============================================================================
  // SECURITY PATTERNS (CWE-based)
  // ============================================================================

  // CWE-89: SQL Injection
  SQL_INJECTION: {
    id: 'SEC-001',
    name: 'SQL Injection Vulnerability',
    category: 'security',
    severity: 'critical',
    description: 'Unsanitized user input in SQL queries can lead to SQL injection attacks',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'sql'],
    detection: (code) => {
      const patterns = [
        /query\s*\(\s*["`].*\$\{.*\}.*["`]/i, // Template literals with variables
        /execute\s*\(\s*["`].*\+.*["`]/i,     // String concatenation
        /db\.run\s*\(\s*["`].*\+/i,            // SQLite concatenation
      ];
      return patterns.some(p => p.test(code));
    },
    remedy: 'Use parameterized queries or prepared statements with bound parameters',
    cwe: 89
  },

  // CWE-79: Cross-Site Scripting (XSS)
  XSS_VULNERABILITY: {
    id: 'SEC-002',
    name: 'Cross-Site Scripting (XSS) Vulnerability',
    category: 'security',
    severity: 'high',
    description: 'User input rendered in HTML without proper escaping allows XSS attacks',
    languages: ['javascript', 'typescript', 'python', 'java'],
    detection: (code) => {
      const patterns = [
        /innerHTML\s*=\s*(?!sanitize|escape)/i,
        /dangerouslySetInnerHTML/i,
        /v-html=/i,
        /[{]\s*@html\s*\}/i,
        /render_to_string.*user_input/i,
      ];
      return patterns.some(p => p.test(code));
    },
    remedy: 'Use textContent/innerText instead of innerHTML, or sanitize HTML input with libraries like DOMPurify',
    cwe: 79
  },

  // CWE-798: Hardcoded Credentials
  HARDCODED_CREDENTIALS: {
    id: 'SEC-003',
    name: 'Hardcoded Credentials',
    category: 'security',
    severity: 'critical',
    description: 'API keys, passwords, or tokens hardcoded in source code can be exposed',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      const patterns = [
        /password\s*[:=]\s*["`][^"`]{1,50}["`]/i,
        /api[_-]?key\s*[:=]\s*["`][^"`]{1,50}["`]/i,
        /secret\s*[:=]\s*["`][^"`]{1,50}["`]/i,
        /token\s*[:=]\s*["`](sk_|pk_|ghp_|gho_|ghu_)[^"`]+["`]/i,
        /private[_-]?key\s*[:=]\s*["`]/i,
      ];
      return patterns.some(p => p.test(code));
    },
    remedy: 'Move credentials to environment variables using .env files or secrets management systems',
    cwe: 798
  },

  // CWE-20: Improper Input Validation
  MISSING_INPUT_VALIDATION: {
    id: 'SEC-004',
    name: 'Missing Input Validation',
    category: 'security',
    severity: 'high',
    description: 'Function accepts user input without validation or type checking',
    languages: ['javascript', 'typescript', 'python', 'java'],
    detection: (code) => {
      const patterns = [
        /function\s+\w+\s*\([^)]*\)\s*{(?!.*if.*\||.*assert|.*typeof|.*isValid)/,
        /def\s+\w+\s*\([^)]*\):\s*(?!.*if|.*assert|.*isinstance)/,
      ];
      return patterns.some(p => p.test(code));
    },
    remedy: 'Validate all user inputs at entry points using type checking, regex validation, or schema validation libraries',
    cwe: 20
  },

  // ============================================================================
  // PERFORMANCE PATTERNS
  // ============================================================================

  // Performance: Inefficient loops
  NESTED_LOOPS: {
    id: 'PERF-001',
    name: 'Deeply Nested Loops',
    category: 'performance',
    severity: 'medium',
    description: 'Multiple nested loops can cause O(n^3+) time complexity',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      // Count nesting depth
      let depth = 0;
      let maxDepth = 0;
      for (const char of code) {
        if (char === '{' || char === '[' || char === '(') depth++;
        if (char === '}' || char === ']' || char === ')') depth--;
        maxDepth = Math.max(maxDepth, depth);
      }
      return maxDepth > 5; // More than 5 levels of nesting
    },
    remedy: 'Extract nested logic into separate functions, use data structures like Sets/Maps for O(1) lookups',
    cwe: null
  },

  // Performance: Missing memoization
  MISSING_MEMOIZATION: {
    id: 'PERF-002',
    name: 'Missing Memoization in Recursive Function',
    category: 'performance',
    severity: 'medium',
    description: 'Recursive function without memoization recalculates same values',
    languages: ['javascript', 'typescript', 'python', 'java'],
    detection: (code) => {
      const hasRecursion = /return\s+\w+\s*\(/.test(code);
      const hasMemo = /memo|cache|Map|dict|@lru_cache|@functools/.test(code);
      return hasRecursion && !hasMemo;
    },
    remedy: 'Implement memoization using a Map/dict to cache computed results',
    cwe: null
  },

  // Performance: Synchronous I/O in async code
  SYNC_IO_IN_ASYNC: {
    id: 'PERF-003',
    name: 'Synchronous I/O in Async Function',
    category: 'performance',
    severity: 'high',
    description: 'Using synchronous I/O operations blocks the event loop',
    languages: ['javascript', 'typescript', 'python'],
    detection: (code) => {
      const hasAsync = /async\s+\w+|async\s*\(/.test(code);
      const hasSync = /fs\.readFileSync|requests\.|\.read\(\)|sleep\(/i.test(code);
      return hasAsync && hasSync;
    },
    remedy: 'Replace synchronous operations with async alternatives (fs.promises, aiohttp, etc.)',
    cwe: null
  },

  // ============================================================================
  // CODE QUALITY PATTERNS
  // ============================================================================

  // Code Quality: Unused variables
  UNUSED_VARIABLE: {
    id: 'QUAL-001',
    name: 'Unused Variable',
    category: 'quality',
    severity: 'low',
    description: 'Variable is declared but never used',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      // Look for declared variables that aren't referenced
      const varMatch = /(?:const|let|var|def|int|String)\s+(\w+)\s*[=:]/g;
      const vars = new Set();
      let match;
      while ((match = varMatch.exec(code)) !== null) {
        vars.add(match[1]);
      }

      // Check if each variable is used
      const unusedVars = [];
      for (const v of vars) {
        if ((code.match(new RegExp(v, 'g')) || []).length <= 1) {
          unusedVars.push(v);
        }
      }
      return unusedVars.length > 0;
    },
    remedy: 'Remove unused variables or prefix with underscore if intentionally unused',
    cwe: null
  },

  // Code Quality: Missing error handling
  MISSING_ERROR_HANDLING: {
    id: 'QUAL-002',
    name: 'Missing Error Handling',
    category: 'quality',
    severity: 'medium',
    description: 'Function call without try-catch or error checking',
    languages: ['javascript', 'typescript', 'python', 'java'],
    detection: (code) => {
      const hasFunctionCall = /\.\w+\(|await\s+\w+\(|fetch\(|open\(/i.test(code);
      const hasErrorHandling = /try\s*{|catch|except|\.then\(.*error|\.catch\(/i.test(code);
      return hasFunctionCall && !hasErrorHandling;
    },
    remedy: 'Add try-catch blocks or .catch() handlers for operations that can fail',
    cwe: null
  },

  // Code Quality: Function too long
  FUNCTION_TOO_LONG: {
    id: 'QUAL-003',
    name: 'Function Too Long',
    category: 'quality',
    severity: 'medium',
    description: 'Function exceeds 100 lines (should be broken into smaller functions)',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      const lines = code.split('\n');
      return lines.length > 100;
    },
    remedy: 'Extract complex logic into separate, smaller functions',
    cwe: null
  },

  // Code Quality: High cyclomatic complexity
  HIGH_COMPLEXITY: {
    id: 'QUAL-004',
    name: 'High Cyclomatic Complexity',
    category: 'quality',
    severity: 'medium',
    description: 'Function has too many conditional branches (>10)',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      const conditions = (code.match(/if\s*\(|else\s*if|switch|case|&&|\|\||\?/g) || []).length;
      return conditions > 10;
    },
    remedy: 'Refactor using polymorphism, strategy pattern, or separate functions',
    cwe: null
  },

  // ============================================================================
  // MAINTAINABILITY PATTERNS
  // ============================================================================

  // Maintainability: Missing documentation
  MISSING_DOCUMENTATION: {
    id: 'MAINT-001',
    name: 'Missing Function Documentation',
    category: 'maintainability',
    severity: 'low',
    description: 'Public function lacks JSDoc/docstring documentation',
    languages: ['javascript', 'typescript', 'python', 'java'],
    detection: (code) => {
      const hasPublicFunction = /^(function|def|public)\s+\w+/m.test(code);
      const hasDocstring = /\/\*\*|"""|\*\/|'''/m.test(code);
      return hasPublicFunction && !hasDocstring;
    },
    remedy: 'Add JSDoc comments or docstrings describing function purpose, parameters, and return type',
    cwe: null
  },

  // Maintainability: Magic numbers
  MAGIC_NUMBERS: {
    id: 'MAINT-002',
    name: 'Magic Numbers',
    category: 'maintainability',
    severity: 'low',
    description: 'Hard-coded numeric values without explanation',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      // Look for numbers that aren't 0, 1, 2, or obvious array indices
      const patterns = /[^\w]\d{2,}[^\w]/g;
      const matches = code.match(patterns) || [];
      return matches.length > 2;
    },
    remedy: 'Extract magic numbers into named constants with clear meaning',
    cwe: null
  },

  // Maintainability: Inconsistent naming
  INCONSISTENT_NAMING: {
    id: 'MAINT-003',
    name: 'Inconsistent Naming Convention',
    category: 'maintainability',
    severity: 'low',
    description: 'Variables mix camelCase, snake_case, and PascalCase',
    languages: ['javascript', 'typescript', 'python', 'java'],
    detection: (code) => {
      const camelCaseVars = (code.match(/\w+[a-z]+[A-Z]\w*/g) || []).length;
      const snakeCaseVars = (code.match(/_[a-z_]+/g) || []).length;
      const pascalCaseVars = (code.match(/[A-Z][a-zA-Z]+/g) || []).length;

      const styles = [camelCaseVars > 0, snakeCaseVars > 0, pascalCaseVars > 0].filter(Boolean).length;
      return styles > 2; // More than 2 naming styles = inconsistent
    },
    remedy: 'Choose one naming convention and apply consistently throughout the codebase',
    cwe: null
  },

  // ============================================================================
  // RELIABILITY PATTERNS
  // ============================================================================

  // Reliability: Null pointer dereference risk
  NULL_POINTER_RISK: {
    id: 'REL-001',
    name: 'Potential Null Pointer Dereference',
    category: 'reliability',
    severity: 'high',
    description: 'Variable used without null check after optional operation',
    languages: ['javascript', 'typescript', 'java', 'go'],
    detection: (code) => {
      const patterns = [
        /\?\.|\.|\[.*\].*\.\w+/, // Optional chaining followed by access
        /\.\w+\(\).*\.\w+\(/,     // Chained calls without null checks
      ];
      return patterns.some(p => p.test(code));
    },
    remedy: 'Add null/undefined checks before accessing properties or use optional chaining (?.)' ,
    cwe: null
  },

  // Reliability: Race condition risk
  RACE_CONDITION_RISK: {
    id: 'REL-002',
    name: 'Potential Race Condition',
    category: 'reliability',
    severity: 'high',
    description: 'Shared state accessed without synchronization in concurrent code',
    languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
    detection: (code) => {
      const hasConcurrency = /Promise\.all|async\s+function|setTimeout|thread|goroutine|spawn|Arc|Mutex/i.test(code);
      const hasSharedState = /this\.\w+\s*=|global\.|shared/i.test(code);
      const hasNoLock = !/lock|mutex|atomic|critical|synchronized/i.test(code);
      return hasConcurrency && hasSharedState && hasNoLock;
    },
    remedy: 'Use locks, mutexes, or atomic operations to protect shared state access',
    cwe: null
  },

  // Reliability: Unhandled promise rejection
  UNHANDLED_PROMISE_REJECTION: {
    id: 'REL-003',
    name: 'Unhandled Promise Rejection',
    category: 'reliability',
    severity: 'high',
    description: 'Promise created without .catch() or try-catch handler',
    languages: ['javascript', 'typescript'],
    detection: (code) => {
      const hasPromise = /new\s+Promise|\.then\(|fetch\(|axios\.|async.*await/i.test(code);
      const hasErrorHandler = /\.catch|try.*catch|\.finally/i.test(code);
      return hasPromise && !hasErrorHandler;
    },
    remedy: 'Add .catch() handlers or wrap await expressions in try-catch blocks',
    cwe: null
  },
};

/**
 * Get patterns for a specific language
 * @param {string} language - Programming language
 * @returns {Object[]} Array of relevant patterns
 */
function getPatternsForLanguage(language) {
  return Object.values(BugPatterns).filter(pattern =>
    pattern.languages.includes(language.toLowerCase())
  );
}

/**
 * Get patterns by severity level
 * @param {string} severity - 'critical', 'high', 'medium', 'low'
 * @returns {Object[]} Array of patterns with matching severity
 */
function getPatternsBySeverity(severity) {
  return Object.values(BugPatterns).filter(pattern =>
    pattern.severity === severity.toLowerCase()
  );
}

/**
 * Get patterns by category
 * @param {string} category - 'security', 'performance', 'quality', etc.
 * @returns {Object[]} Array of patterns in the category
 */
function getPatternsByCategory(category) {
  return Object.values(BugPatterns).filter(pattern =>
    pattern.category === category.toLowerCase()
  );
}

/**
 * Detect all matching patterns in code
 * @param {string} code - Source code to analyze
 * @param {Object} options - Detection options
 * @returns {Object[]} Array of detected issues
 */
function detectPatterns(code, options = {}) {
  const {
    language = 'javascript',
    severityFilter = null,
    categoryFilter = null
  } = options;

  const patterns = getPatternsForLanguage(language);
  const detected = [];

  for (const pattern of patterns) {
    // Apply severity filter if specified
    if (severityFilter && pattern.severity !== severityFilter) {
      continue;
    }

    // Apply category filter if specified
    if (categoryFilter && pattern.category !== categoryFilter) {
      continue;
    }

    try {
      const match = pattern.detection(code);
      if (match) {
        detected.push({
          id: pattern.id,
          name: pattern.name,
          category: pattern.category,
          severity: pattern.severity,
          description: pattern.description,
          remedy: pattern.remedy,
          cwe: pattern.cwe
        });
      }
    } catch (error) {
      // Skip patterns that fail during detection
      console.warn(`Error detecting pattern ${pattern.id}:`, error.message);
    }
  }

  return detected;
}

module.exports = {
  BugPatterns,
  getPatternsForLanguage,
  getPatternsBySeverity,
  getPatternsByCategory,
  detectPatterns
};
