/**
 * Unit tests for Report Generator
 *
 * @module report-generator.test
 */

const ReportGenerator = require('../report-generator');

describe('ReportGenerator', () => {
  let generator;
  let sampleFindings;

  beforeEach(() => {
    generator = new ReportGenerator();

    sampleFindings = [
      {
        type: 'secret',
        name: 'AWS Access Key',
        severity: 'critical',
        match: 'AKIA***AMPLE',
        line: 10,
        column: 15
      },
      {
        type: 'sql-injection',
        name: 'SQL String Concatenation',
        severity: 'high',
        match: 'SELECT * FROM users WHERE id = " + userId',
        line: 25,
        column: 8
      },
      {
        type: 'security',
        name: 'eval() Usage',
        severity: 'critical',
        match: 'eval(userInput)',
        line: 42,
        column: 5
      },
      {
        type: 'performance',
        name: 'Nested Loops',
        severity: 'low',
        match: 'for (let i = 0; i < n; i++) { for (let j = 0;',
        line: 55,
        column: 3
      },
      {
        type: 'security',
        name: 'TODO Comment',
        severity: 'info',
        match: '// TODO: Fix this',
        line: 60,
        column: 1
      }
    ];
  });

  describe('generateJSONReport', () => {
    test('should generate valid JSON report', () => {
      const report = generator.generateJSONReport(sampleFindings);
      const parsed = JSON.parse(report);

      expect(parsed).toHaveProperty('metadata');
      expect(parsed).toHaveProperty('summary');
      expect(parsed).toHaveProperty('findings');
      expect(parsed.findings).toEqual(sampleFindings);
    });

    test('should include metadata in JSON report', () => {
      const report = generator.generateJSONReport(sampleFindings);
      const parsed = JSON.parse(report);

      expect(parsed.metadata.format).toBe('json');
      expect(parsed.metadata.version).toBe('1.0.0');
      expect(parsed.metadata.generated).toBeDefined();
    });

    test('should include aggregated metrics', () => {
      const report = generator.generateJSONReport(sampleFindings);
      const parsed = JSON.parse(report);

      expect(parsed.summary.total).toBe(5);
      expect(parsed.summary.bySeverity.critical).toBe(2);
      expect(parsed.summary.bySeverity.high).toBe(1);
      expect(parsed.summary.bySeverity.low).toBe(1);
      expect(parsed.summary.bySeverity.info).toBe(1);
    });

    test('should handle single finding object', () => {
      const singleFinding = sampleFindings[0];
      const report = generator.generateJSONReport(singleFinding);
      const parsed = JSON.parse(report);

      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0]).toEqual(singleFinding);
    });

    test('should handle empty findings', () => {
      const report = generator.generateJSONReport([]);
      const parsed = JSON.parse(report);

      expect(parsed.findings).toEqual([]);
      expect(parsed.summary.total).toBe(0);
    });
  });

  describe('generateMarkdownReport', () => {
    test('should generate valid Markdown report', () => {
      const report = generator.generateMarkdownReport(sampleFindings);

      expect(report).toContain('# Security Analysis Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Metrics');
      expect(report).toContain('## Recommendations');
    });

    test('should include metrics table', () => {
      const report = generator.generateMarkdownReport(sampleFindings);

      expect(report).toContain('| Metric | Count |');
      expect(report).toContain('| Total Issues | 5 |');
      expect(report).toContain('| Critical | 2 |');
      expect(report).toContain('| High | 1 |');
    });

    test('should organize findings by severity', () => {
      const report = generator.generateMarkdownReport(sampleFindings);

      expect(report).toContain('## Critical Severity Issues');
      expect(report).toContain('## High Severity Issues');
      expect(report).toContain('## Low Severity Issues');
      expect(report).toContain('## Info Severity Issues');
    });

    test('should include finding details', () => {
      const report = generator.generateMarkdownReport(sampleFindings);

      expect(report).toContain('AWS Access Key');
      expect(report).toContain('Line 10');
      expect(report).toContain('AKIA***AMPLE');
    });

    test('should not include severity sections with no findings', () => {
      const criticalOnly = [sampleFindings[0]];
      const report = generator.generateMarkdownReport(criticalOnly);

      expect(report).toContain('## Critical Severity Issues');
      expect(report).not.toContain('## Medium Severity Issues');
    });
  });

  describe('generateHTMLReport', () => {
    test('should generate valid HTML report', () => {
      const report = generator.generateHTMLReport(sampleFindings);

      expect(report).toContain('<!DOCTYPE html>');
      expect(report).toContain('<html lang="en">');
      expect(report).toContain('</html>');
    });

    test('should include CSS styles', () => {
      const report = generator.generateHTMLReport(sampleFindings);

      expect(report).toContain('<style>');
      expect(report).toContain('.header');
      expect(report).toContain('.finding');
      expect(report).toContain('.severity-badge');
    });

    test('should include metrics in HTML', () => {
      const report = generator.generateHTMLReport(sampleFindings);

      expect(report).toContain('Total Issues');
      expect(report).toContain('<div class="metric-value">5</div>');
      expect(report).toContain('Critical');
      expect(report).toContain('<div class="metric-value" style="color: #e74c3c;">2</div>');
    });

    test('should create finding cards with severity styling', () => {
      const report = generator.generateHTMLReport(sampleFindings);

      expect(report).toContain('<div class="finding critical">');
      expect(report).toContain('<span class="severity-badge critical">critical</span>');
    });

    test('should escape HTML in code snippets', () => {
      const findingWithHTML = [{
        type: 'test',
        name: 'Test',
        severity: 'medium',
        match: '<script>alert("xss")</script>',
        line: 1
      }];

      const report = generator.generateHTMLReport(findingWithHTML);

      expect(report).toContain('&lt;script&gt;');
      expect(report).not.toContain('<script>alert');
    });

    test('should include timestamp in header', () => {
      const report = generator.generateHTMLReport(sampleFindings);

      expect(report).toContain('Generated:');
      expect(report).toContain(generator.timestamp);
    });
  });

  describe('formatForConsole', () => {
    test('should format findings for console output', () => {
      const output = generator.formatForConsole(sampleFindings);

      expect(output).toContain('SECURITY ANALYSIS REPORT');
      expect(output).toContain('Total Issues: 5');
      expect(output).toContain('Critical: 2');
    });

    test('should organize by severity with separators', () => {
      const output = generator.formatForConsole(sampleFindings);

      expect(output).toContain('CRITICAL SEVERITY');
      expect(output).toContain('HIGH SEVERITY');
      expect(output).toContain('LOW SEVERITY');
      expect(output).toMatch(/={80}/);
      expect(output).toMatch(/-{80}/);
    });

    test('should include finding details', () => {
      const output = generator.formatForConsole(sampleFindings);

      expect(output).toContain('[secret] AWS Access Key');
      expect(output).toContain('Location: Line 10, Column 15');
      expect(output).toContain('Code: AKIA***AMPLE');
    });

    test('should truncate long code snippets', () => {
      const longFinding = [{
        type: 'test',
        name: 'Test',
        severity: 'medium',
        match: 'x'.repeat(100),
        line: 1
      }];

      const output = generator.formatForConsole(longFinding);

      expect(output).toContain('...');
    });
  });

  describe('aggregateMetrics', () => {
    test('should aggregate findings by severity', () => {
      const metrics = generator.aggregateMetrics(sampleFindings);

      expect(metrics.bySeverity.critical).toBe(2);
      expect(metrics.bySeverity.high).toBe(1);
      expect(metrics.bySeverity.low).toBe(1);
      expect(metrics.bySeverity.info).toBe(1);
    });

    test('should aggregate findings by type', () => {
      const metrics = generator.aggregateMetrics(sampleFindings);

      expect(metrics.byType.secret).toBe(1);
      expect(metrics.byType['sql-injection']).toBe(1);
      expect(metrics.byType.security).toBe(2);
      expect(metrics.byType.performance).toBe(1);
    });

    test('should count total findings', () => {
      const metrics = generator.aggregateMetrics(sampleFindings);

      expect(metrics.total).toBe(5);
    });

    test('should handle empty findings', () => {
      const metrics = generator.aggregateMetrics([]);

      expect(metrics.total).toBe(0);
      expect(metrics.bySeverity).toEqual({});
      expect(metrics.byType).toEqual({});
    });
  });

  describe('generateSummary', () => {
    test('should generate summary for findings with critical issues', () => {
      const summary = generator.generateSummary(sampleFindings);

      expect(summary).toContain('5 potential issues');
      expect(summary).toContain('2 critical issue');
      expect(summary).toContain('immediate attention');
    });

    test('should mention high-severity issues', () => {
      const summary = generator.generateSummary(sampleFindings);

      expect(summary).toContain('1 high-severity issue');
      expect(summary).toContain('addressed promptly');
    });

    test('should return clean message for no issues', () => {
      const summary = generator.generateSummary([]);

      expect(summary).toContain('No security issues detected');
      expect(summary).toContain('codebase appears clean');
    });

    test('should handle findings with no critical or high issues', () => {
      const lowSeverity = [
        { type: 'test', severity: 'low', name: 'Test 1' },
        { type: 'test', severity: 'info', name: 'Test 2' }
      ];

      const summary = generator.generateSummary(lowSeverity);

      expect(summary).toContain('No critical or high-severity issues detected');
    });
  });

  describe('filterBySeverity', () => {
    test('should filter critical findings', () => {
      const critical = generator.filterBySeverity(sampleFindings, 'critical');

      expect(critical).toHaveLength(2);
      expect(critical.every(f => f.severity === 'critical')).toBe(true);
    });

    test('should filter high severity findings', () => {
      const high = generator.filterBySeverity(sampleFindings, 'high');

      expect(high).toHaveLength(1);
      expect(high[0].name).toBe('SQL String Concatenation');
    });

    test('should return empty array when no findings match', () => {
      const medium = generator.filterBySeverity(sampleFindings, 'medium');

      expect(medium).toEqual([]);
    });
  });

  describe('report format consistency', () => {
    test('all formats should include the same findings count', () => {
      const jsonReport = JSON.parse(generator.generateJSONReport(sampleFindings));
      const markdownReport = generator.generateMarkdownReport(sampleFindings);
      const htmlReport = generator.generateHTMLReport(sampleFindings);
      const consoleReport = generator.formatForConsole(sampleFindings);

      expect(jsonReport.summary.total).toBe(5);
      expect(markdownReport).toContain('| Total Issues | 5 |');
      expect(htmlReport).toContain('<div class="metric-value">5</div>');
      expect(consoleReport).toContain('Total Issues: 5');
    });

    test('all formats should include the same severity breakdown', () => {
      const jsonReport = JSON.parse(generator.generateJSONReport(sampleFindings));
      const markdownReport = generator.generateMarkdownReport(sampleFindings);

      expect(jsonReport.summary.bySeverity.critical).toBe(2);
      expect(markdownReport).toContain('| Critical | 2 |');
    });
  });

  describe('edge cases', () => {
    test('should handle findings without line numbers', () => {
      const findingsNoLines = [{
        type: 'test',
        name: 'Test Finding',
        severity: 'medium',
        match: 'test code'
      }];

      const markdown = generator.generateMarkdownReport(findingsNoLines);
      const html = generator.generateHTMLReport(findingsNoLines);

      expect(markdown).toBeDefined();
      expect(html).toBeDefined();
    });

    test('should handle findings without matches', () => {
      const findingsNoMatch = [{
        type: 'test',
        name: 'Test Finding',
        severity: 'medium',
        line: 10
      }];

      const console = generator.formatForConsole(findingsNoMatch);

      expect(console).toContain('Test Finding');
      expect(console).not.toContain('Code:');
    });

    test('should handle special characters in finding names', () => {
      const specialFindings = [{
        type: 'test',
        name: 'Test <script>alert("xss")</script>',
        severity: 'high',
        line: 1
      }];

      const html = generator.generateHTMLReport(specialFindings);

      expect(html).not.toContain('<script>alert');
      expect(html).toContain('&lt;script&gt;');
    });
  });
});
