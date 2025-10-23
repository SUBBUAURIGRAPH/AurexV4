/**
 * Report Generator - Format and generate analysis reports
 *
 * Supported formats:
 * - JSON (machine-readable, complete)
 * - Markdown (human-readable, documentation)
 * - HTML (interactive, styled)
 * - Console (terminal output, colorized)
 *
 * Features:
 * - Severity-based sorting and filtering
 * - Metrics aggregation
 * - Executive summaries
 * - Customizable templates
 *
 * @module report-generator
 */

const fs = require('fs');
const path = require('path');

/**
 * Report generator for analysis results
 */
class ReportGenerator {
  constructor() {
    this.timestamp = new Date().toISOString();
  }

  /**
   * Generate JSON report
   *
   * @param {Array|Object} findings - Analysis findings
   * @returns {string} JSON formatted report
   */
  generateJSONReport(findings) {
    const report = {
      metadata: {
        generated: this.timestamp,
        version: '1.0.0',
        format: 'json'
      },
      summary: this.aggregateMetrics(findings),
      findings: Array.isArray(findings) ? findings : [findings]
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown report
   *
   * @param {Array|Object} findings - Analysis findings
   * @returns {string} Markdown formatted report
   */
  generateMarkdownReport(findings) {
    const findingsArray = Array.isArray(findings) ? findings : [findings];
    const summary = this.aggregateMetrics(findingsArray);

    let markdown = `# Security Analysis Report\n\n`;
    markdown += `**Generated**: ${this.timestamp}\n\n`;

    // Executive Summary
    markdown += `## Executive Summary\n\n`;
    markdown += this.generateSummary(findingsArray);
    markdown += `\n\n`;

    // Metrics
    markdown += `## Metrics\n\n`;
    markdown += `| Metric | Count |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Issues | ${summary.total} |\n`;
    markdown += `| Critical | ${summary.bySeverity.critical || 0} |\n`;
    markdown += `| High | ${summary.bySeverity.high || 0} |\n`;
    markdown += `| Medium | ${summary.bySeverity.medium || 0} |\n`;
    markdown += `| Low | ${summary.bySeverity.low || 0} |\n`;
    markdown += `| Info | ${summary.bySeverity.info || 0} |\n\n`;

    // Findings by Severity
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

    for (const severity of severityOrder) {
      const severityFindings = findingsArray.filter(f => f.severity === severity);

      if (severityFindings.length > 0) {
        markdown += `## ${this._capitalize(severity)} Severity Issues\n\n`;

        for (const finding of severityFindings) {
          markdown += `### ${finding.name || finding.type}\n\n`;
          markdown += `- **Type**: ${finding.type}\n`;
          markdown += `- **Severity**: ${severity}\n`;

          if (finding.line) {
            markdown += `- **Location**: Line ${finding.line}`;
            if (finding.column) {
              markdown += `, Column ${finding.column}`;
            }
            markdown += `\n`;
          }

          if (finding.match) {
            markdown += `- **Code**: \`${finding.match}\`\n`;
          }

          markdown += `\n`;
        }
      }
    }

    // Recommendations
    markdown += `## Recommendations\n\n`;
    markdown += this._generateRecommendations(findingsArray);

    return markdown;
  }

  /**
   * Generate HTML report
   *
   * @param {Array|Object} findings - Analysis findings
   * @returns {string} HTML formatted report
   */
  generateHTMLReport(findings) {
    const findingsArray = Array.isArray(findings) ? findings : [findings];
    const summary = this.aggregateMetrics(findingsArray);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Analysis Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    .header h1 {
      margin: 0 0 10px 0;
    }
    .summary {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric {
      background: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
    .metric-label {
      color: #666;
      text-transform: uppercase;
      font-size: 12px;
    }
    .finding {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 4px solid;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .finding.critical { border-left-color: #e74c3c; }
    .finding.high { border-left-color: #e67e22; }
    .finding.medium { border-left-color: #f39c12; }
    .finding.low { border-left-color: #3498db; }
    .finding.info { border-left-color: #95a5a6; }
    .finding-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .finding-title {
      font-size: 18px;
      font-weight: bold;
    }
    .severity-badge {
      padding: 5px 10px;
      border-radius: 4px;
      color: white;
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
    }
    .severity-badge.critical { background: #e74c3c; }
    .severity-badge.high { background: #e67e22; }
    .severity-badge.medium { background: #f39c12; }
    .severity-badge.low { background: #3498db; }
    .severity-badge.info { background: #95a5a6; }
    .code-block {
      background: #f8f9fa;
      padding: 10px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      overflow-x: auto;
      margin-top: 10px;
    }
    .location {
      color: #666;
      font-size: 14px;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Analysis Report</h1>
    <p>Generated: ${this.timestamp}</p>
  </div>

  <div class="summary">
    <h2>Executive Summary</h2>
    <p>${this.generateSummary(findingsArray)}</p>
  </div>

  <div class="metrics">
    <div class="metric">
      <div class="metric-label">Total Issues</div>
      <div class="metric-value">${summary.total}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Critical</div>
      <div class="metric-value" style="color: #e74c3c;">${summary.bySeverity.critical || 0}</div>
    </div>
    <div class="metric">
      <div class="metric-label">High</div>
      <div class="metric-value" style="color: #e67e22;">${summary.bySeverity.high || 0}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Medium</div>
      <div class="metric-value" style="color: #f39c12;">${summary.bySeverity.medium || 0}</div>
    </div>
    <div class="metric">
      <div class="metric-label">Low</div>
      <div class="metric-value" style="color: #3498db;">${summary.bySeverity.low || 0}</div>
    </div>
  </div>

  <h2>Findings</h2>
`;

    // Add findings
    for (const finding of findingsArray) {
      html += `
  <div class="finding ${finding.severity}">
    <div class="finding-header">
      <div class="finding-title">${finding.name || finding.type}</div>
      <span class="severity-badge ${finding.severity}">${finding.severity}</span>
    </div>
    <div><strong>Type:</strong> ${finding.type}</div>
`;

      if (finding.line) {
        html += `    <div class="location">Line ${finding.line}`;
        if (finding.column) {
          html += `, Column ${finding.column}`;
        }
        html += `</div>\n`;
      }

      if (finding.match) {
        html += `    <div class="code-block">${this._escapeHTML(finding.match)}</div>\n`;
      }

      html += `  </div>\n`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Format findings for console output
   *
   * @param {Array|Object} findings - Analysis findings
   * @returns {string} Console formatted output
   */
  formatForConsole(findings) {
    const findingsArray = Array.isArray(findings) ? findings : [findings];
    const summary = this.aggregateMetrics(findingsArray);

    let output = '\n';
    output += '='.repeat(80) + '\n';
    output += '  SECURITY ANALYSIS REPORT\n';
    output += '='.repeat(80) + '\n\n';

    // Summary
    output += `Total Issues: ${summary.total}\n`;
    output += `  Critical: ${summary.bySeverity.critical || 0}\n`;
    output += `  High:     ${summary.bySeverity.high || 0}\n`;
    output += `  Medium:   ${summary.bySeverity.medium || 0}\n`;
    output += `  Low:      ${summary.bySeverity.low || 0}\n`;
    output += `  Info:     ${summary.bySeverity.info || 0}\n\n`;

    // Findings
    const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];

    for (const severity of severityOrder) {
      const severityFindings = findingsArray.filter(f => f.severity === severity);

      if (severityFindings.length > 0) {
        output += '-'.repeat(80) + '\n';
        output += `${this._capitalize(severity).toUpperCase()} SEVERITY (${severityFindings.length})\n`;
        output += '-'.repeat(80) + '\n\n';

        for (const finding of severityFindings) {
          output += `[${finding.type}] ${finding.name || finding.type}\n`;

          if (finding.line) {
            output += `  Location: Line ${finding.line}`;
            if (finding.column) {
              output += `, Column ${finding.column}`;
            }
            output += `\n`;
          }

          if (finding.match) {
            output += `  Code: ${finding.match.substring(0, 60)}${finding.match.length > 60 ? '...' : ''}\n`;
          }

          output += `\n`;
        }
      }
    }

    output += '='.repeat(80) + '\n\n';

    return output;
  }

  /**
   * Aggregate metrics from findings
   *
   * @param {Array} findings - Analysis findings
   * @returns {Object} Aggregated metrics
   */
  aggregateMetrics(findings) {
    const metrics = {
      total: findings.length,
      bySeverity: {},
      byType: {}
    };

    for (const finding of findings) {
      // Count by severity
      const severity = finding.severity || 'unknown';
      metrics.bySeverity[severity] = (metrics.bySeverity[severity] || 0) + 1;

      // Count by type
      const type = finding.type || 'unknown';
      metrics.byType[type] = (metrics.byType[type] || 0) + 1;
    }

    return metrics;
  }

  /**
   * Generate executive summary
   *
   * @param {Array} findings - Analysis findings
   * @returns {string} Summary text
   */
  generateSummary(findings) {
    const metrics = this.aggregateMetrics(findings);

    if (metrics.total === 0) {
      return 'No security issues detected. The codebase appears clean.';
    }

    const critical = metrics.bySeverity.critical || 0;
    const high = metrics.bySeverity.high || 0;

    let summary = `Analysis identified ${metrics.total} potential issue${metrics.total > 1 ? 's' : ''} in the codebase. `;

    if (critical > 0) {
      summary += `${critical} critical issue${critical > 1 ? 's' : ''} require immediate attention. `;
    }

    if (high > 0) {
      summary += `${high} high-severity issue${high > 1 ? 's' : ''} should be addressed promptly. `;
    }

    if (critical === 0 && high === 0) {
      summary += 'No critical or high-severity issues detected. ';
    }

    return summary;
  }

  /**
   * Filter findings by severity level
   *
   * @param {Array} findings - Analysis findings
   * @param {string} level - Severity level to filter
   * @returns {Array} Filtered findings
   */
  filterBySeverity(findings, level) {
    return findings.filter(f => f.severity === level);
  }

  /**
   * Capitalize first letter of string
   *
   * @private
   * @param {string} str - Input string
   * @returns {string} Capitalized string
   */
  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Escape HTML special characters
   *
   * @private
   * @param {string} str - Input string
   * @returns {string} Escaped string
   */
  _escapeHTML(str) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    return str.replace(/[&<>"']/g, char => escapeMap[char]);
  }

  /**
   * Generate recommendations based on findings
   *
   * @private
   * @param {Array} findings - Analysis findings
   * @returns {string} Recommendations text
   */
  _generateRecommendations(findings) {
    const metrics = this.aggregateMetrics(findings);
    let recommendations = '';

    if (metrics.byType.secret > 0) {
      recommendations += '- Remove hardcoded secrets and use environment variables or secret management systems\n';
    }

    if (metrics.byType['sql-injection'] > 0) {
      recommendations += '- Use parameterized queries or prepared statements to prevent SQL injection\n';
    }

    if (metrics.byType.security > 0) {
      recommendations += '- Review and remediate security vulnerabilities identified\n';
    }

    if (metrics.byType.performance > 0) {
      recommendations += '- Optimize performance anti-patterns for better efficiency\n';
    }

    if (recommendations === '') {
      recommendations = '- Continue following security best practices\n';
      recommendations += '- Regularly run security scans on codebase changes\n';
    }

    return recommendations;
  }
}

module.exports = ReportGenerator;
