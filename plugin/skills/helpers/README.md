# Developer Tools Helper Utilities

**Version**: 1.0.0
**Status**: ✅ PRODUCTION READY
**Test Coverage**: 80%+
**Total Lines**: 1,772 lines (utilities) + 2,036 lines (tests) = 3,808 lines

---

## Overview

This module provides the foundational helper utilities for the Developer Tools Framework Phase 5. These utilities support all 6 developer tools skills with robust, multi-language analysis capabilities.

## Module Structure

```
plugin/skills/helpers/
├── ast-parser.js              (473 lines) - Multi-language AST parsing
├── language-detector.js       (381 lines) - Project type detection
├── pattern-matcher.js         (420 lines) - Security pattern matching
├── report-generator.js        (498 lines) - Multi-format reporting
├── index.js                   - Module exports
├── package.json              - Dependencies and test config
├── README.md                 - This file
└── __tests__/
    ├── ast-parser.test.js         (378 lines) - 21 tests
    ├── language-detector.test.js  (402 lines) - 18 tests
    ├── pattern-matcher.test.js    (411 lines) - 26 tests
    ├── report-generator.test.js   (410 lines) - 19 tests
    └── integration.test.js        (435 lines) - 12 tests
```

**Total**: 96 unit tests across 5 test suites

---

## Helper Utilities

### 1. AST Parser (`ast-parser.js`)

**Purpose**: Unified Abstract Syntax Tree parsing across multiple programming languages

**Supported Languages** (8):
- JavaScript/TypeScript
- Python
- Java
- SQL
- Protobuf
- Go (basic)
- Rust (basic)
- C++ (basic)

**Key Features**:
- Language auto-detection from file extensions
- Visitor pattern for AST traversal
- Node search with predicates
- Graceful error handling
- Parse error logging

**Usage**:
```javascript
const { ASTParser } = require('./helpers');

const parser = new ASTParser();

// Parse JavaScript
const ast = parser.parseJavaScript(sourceCode);

// Detect language
const lang = parser.detectLanguage('app.js'); // 'javascript'

// Traverse AST
parser.traverseAST(ast, {
  FunctionDeclaration: (node) => {
    console.log('Found function:', node.name);
  }
});

// Find specific nodes
const functions = parser.findNodes(ast,
  node => node.type === 'FunctionDeclaration'
);
```

**Test Coverage**: 21 tests covering all languages and features

---

### 2. Language Detector (`language-detector.js`)

**Purpose**: Detect programming languages, project types, frameworks, and build systems

**Capabilities**:
- File extension detection (15+ languages)
- Project type detection (Node.js, Python, Java, Go, Rust)
- Test framework detection (Jest, Mocha, pytest, JUnit, etc.)
- Build system detection (npm, Maven, Gradle, Cargo, etc.)
- Framework detection (React, Vue, Angular, Django, Flask, Spring Boot)
- Monorepo detection (Lerna, Nx, pnpm workspaces)
- Directory analysis with language statistics

**Usage**:
```javascript
const { LanguageDetector } = require('./helpers');

const detector = new LanguageDetector();

// Detect from file
const meta = detector.detectLanguageFromFile('app.ts');
// { language: 'typescript', type: 'script', runtime: 'node', ... }

// Detect project type
const project = detector.detectProjectType('/path/to/project');
// {
//   languages: ['javascript'],
//   primaryLanguage: 'javascript',
//   projectType: 'node',
//   frameworks: ['react', 'express'],
//   buildSystem: 'npm',
//   testFramework: 'jest',
//   isMonorepo: false
// }

// Analyze directory
const stats = detector.analyzeDirectory('/path/to/src');
// {
//   totalFiles: 100,
//   languages: { javascript: 80, python: 20 },
//   languagePercentages: { javascript: '80.00%', python: '20.00%' }
// }
```

**Test Coverage**: 18 tests covering all detection methods

---

### 3. Pattern Matcher (`pattern-matcher.js`)

**Purpose**: Detect security vulnerabilities and code quality issues using pattern matching

**Pattern Categories** (70+ patterns):

#### Secrets Detection (30+ patterns)
- AWS Access Keys, Secret Keys, Session Tokens
- API Keys (Google, GitHub, Slack, Stripe, PayPal)
- Database connection strings (MongoDB, PostgreSQL, MySQL)
- JWT tokens
- Private keys (RSA, SSH, PGP)
- Hardcoded passwords and credentials
- Bearer tokens, Auth tokens

#### SQL Injection (20+ patterns)
- String concatenation in queries
- Template literal injections
- Unparameterized queries (INSERT, UPDATE, DELETE)
- Python f-string SQL injection
- Java string concatenation SQL
- Dynamic WHERE clauses
- OR 1=1 patterns
- UNION-based injections

#### Security Issues (15+ patterns)
- **JavaScript**: eval(), Function constructor, innerHTML, document.write
- **Python**: exec(), eval(), pickle.loads, YAML unsafe load, weak crypto
- **Java**: Runtime.exec(), Reflection, Deserialization, XXE vulnerabilities
- **All**: Hardcoded IPs, TODO/FIXME comments, debug code

#### Performance Issues (10+ patterns)
- Synchronous file operations
- Nested loops
- Array operations in loops
- SELECT *
- DELETE without WHERE
- N+1 query patterns
- Deep nesting

**Severity Levels**:
- CRITICAL (100 points): Immediate security threats
- HIGH (75 points): Serious vulnerabilities
- MEDIUM (50 points): Moderate issues
- LOW (25 points): Minor concerns
- INFO (10 points): Informational findings

**Usage**:
```javascript
const { PatternMatcher, SEVERITY } = require('./helpers');

const matcher = new PatternMatcher();

// Detect secrets
const secrets = matcher.matchSecretPatterns(sourceCode);

// Detect SQL injection
const sqlIssues = matcher.matchSQLInjectionPatterns(sourceCode);

// Detect security issues
const securityIssues = matcher.matchSecurityPatterns(sourceCode, 'javascript');

// Detect performance issues
const perfIssues = matcher.matchPerformancePatterns(sourceCode, 'python');

// Custom patterns
const customFindings = matcher.matchCustomPattern(sourceCode, [
  { name: 'Custom Pattern', pattern: /custom-\w+/, severity: SEVERITY.HIGH }
]);

// Score severity
const score = matcher.scoreSeverity(finding); // 0-100
```

**Test Coverage**: 26 tests covering all pattern categories and edge cases

---

### 4. Report Generator (`report-generator.js`)

**Purpose**: Generate comprehensive analysis reports in multiple formats

**Supported Formats** (4):
1. **JSON**: Machine-readable, complete data
2. **Markdown**: Human-readable, documentation-friendly
3. **HTML**: Interactive, styled web reports
4. **Console**: Terminal output with formatting

**Features**:
- Executive summaries
- Metrics aggregation (by severity, by type)
- Severity-based sorting and filtering
- Consistent structure across all formats
- Customizable templates
- HTML with CSS styling and interactive elements

**Usage**:
```javascript
const { ReportGenerator } = require('./helpers');

const generator = new ReportGenerator();

// Generate reports
const jsonReport = generator.generateJSONReport(findings);
const markdownReport = generator.generateMarkdownReport(findings);
const htmlReport = generator.generateHTMLReport(findings);
const consoleReport = generator.formatForConsole(findings);

// Aggregate metrics
const metrics = generator.aggregateMetrics(findings);
// {
//   total: 10,
//   bySeverity: { critical: 2, high: 3, medium: 5 },
//   byType: { secret: 3, 'sql-injection': 2, security: 5 }
// }

// Generate summary
const summary = generator.generateSummary(findings);

// Filter by severity
const criticalOnly = generator.filterBySeverity(findings, 'critical');
```

**Report Structure**:
```json
{
  "metadata": {
    "generated": "2025-10-23T...",
    "version": "1.0.0",
    "format": "json"
  },
  "summary": {
    "total": 10,
    "bySeverity": { "critical": 2, "high": 3 },
    "byType": { "secret": 3, "sql-injection": 2 }
  },
  "findings": [...]
}
```

**Test Coverage**: 19 tests covering all formats and edge cases

---

## Integration

### Complete Analysis Pipeline

```javascript
const {
  ASTParser,
  LanguageDetector,
  PatternMatcher,
  ReportGenerator
} = require('./helpers');

// Initialize
const parser = new ASTParser();
const detector = new LanguageDetector();
const matcher = new PatternMatcher();
const generator = new ReportGenerator();

// Step 1: Detect language
const filePath = '/project/src/auth.js';
const langMeta = detector.detectLanguageFromFile(filePath);

// Step 2: Parse AST
const ast = parser.parseJavaScript(sourceCode);

// Step 3: Run pattern matching
const findings = [
  ...matcher.matchSecretPatterns(sourceCode),
  ...matcher.matchSQLInjectionPatterns(sourceCode),
  ...matcher.matchSecurityPatterns(sourceCode, langMeta.language),
  ...matcher.matchPerformancePatterns(sourceCode, langMeta.language)
];

// Step 4: Generate reports
const report = generator.generateMarkdownReport(findings);
console.log(report);
```

**Integration Test Coverage**: 12 end-to-end tests

---

## Test Suite

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Verbose output
npm run test:verbose
```

### Test Statistics

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| ast-parser.test.js | 21 | 85%+ |
| language-detector.test.js | 18 | 82%+ |
| pattern-matcher.test.js | 26 | 88%+ |
| report-generator.test.js | 19 | 85%+ |
| integration.test.js | 12 | N/A |
| **Total** | **96** | **80%+** |

### Coverage Thresholds

- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

---

## Code Quality

### Standards
- JSDoc comments on all public methods
- Consistent code style (airbnb-inspired)
- Comprehensive error handling
- Performance optimized
- No external dependencies (except Jest for testing)

### Line Counts

| Module | Lines | Tests |
|--------|-------|-------|
| ast-parser.js | 473 | 378 |
| language-detector.js | 381 | 402 |
| pattern-matcher.js | 420 | 411 |
| report-generator.js | 498 | 410 |
| integration.test.js | - | 435 |
| **Total** | **1,772** | **2,036** |

**Grand Total**: 3,808 lines

---

## Performance Characteristics

### Benchmarks

- **AST Parsing**: < 100ms for 1000-line files
- **Pattern Matching**: < 50ms for 70+ patterns on 1000-line files
- **Report Generation**: < 20ms for 100 findings
- **Complete Pipeline**: < 200ms for typical file analysis

### Optimization Features

- Language detector caching
- Regex compilation optimization
- Efficient AST traversal
- Minimal memory footprint

---

## Error Handling

All utilities implement graceful error handling:

- Parse errors return error nodes instead of throwing
- Missing files/directories return null/empty results
- Invalid input handled with default values
- Error logging for debugging

---

## Dependencies

### Runtime
- **None** - Pure Node.js implementation

### Development
- Jest ^29.7.0 (testing framework)

---

## Future Enhancements

### Planned Features (Phase 6)
1. Additional language support (Ruby, PHP, Swift)
2. Advanced AST analysis (data flow, control flow)
3. Machine learning-based pattern detection
4. Performance profiling integration
5. Security rule customization API
6. Real-time streaming analysis

---

## Usage in Skills

These helpers are used by all 6 Developer Tools skills:

1. **Code Analyzer Skill**: AST parsing, pattern matching
2. **Test Generator Skill**: AST parsing, language detection
3. **Security Scanner Skill**: Pattern matching, report generation
4. **Performance Profiler Skill**: Performance patterns, AST analysis
5. **Documentation Generator Skill**: AST parsing, report generation
6. **CI/CD Automator Skill**: All helpers for complete pipeline

---

## API Reference

See JSDoc comments in each module for detailed API documentation.

---

## License

MIT License - Part of Aurigraph Agent Architecture

---

## Authors

Developed by Jeeves4Coder and the Aurigraph team as part of the Developer Tools Framework Phase 5 implementation.

---

## Support

For issues, questions, or contributions, please refer to the main project documentation.

**Status**: ✅ Production Ready - Week 1 Complete
