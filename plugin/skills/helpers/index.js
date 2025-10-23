/**
 * Helper Utilities for Developer Tools Framework Phase 5
 *
 * This module exports all helper utilities used by the developer tools skills:
 * - AST Parser: Multi-language abstract syntax tree parsing
 * - Language Detector: Project type and language detection
 * - Pattern Matcher: Security vulnerability and bug pattern detection
 * - Report Generator: Multi-format report generation
 *
 * @module helpers
 */

const ASTParser = require('./ast-parser');
const LanguageDetector = require('./language-detector');
const PatternMatcher = require('./pattern-matcher');
const ReportGenerator = require('./report-generator');

module.exports = {
  ASTParser,
  LanguageDetector,
  PatternMatcher,
  ReportGenerator,

  // Convenience exports
  SEVERITY: require('./pattern-matcher').SEVERITY
};
