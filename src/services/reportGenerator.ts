/**
 * Analytics Report Generator
 * Creates PDF and HTML reports from analytics data
 * @version 1.0.0
 */

import { AnalyticsUtils } from '../analytics';

export interface ReportData {
  userId: string;
  strategyId?: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalValue: number;
    return: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    riskLevel: string;
    riskScore: number;
  };
  performance: {
    data: any[];
    chart?: string; // Base64 encoded chart image
  };
  risk: {
    data: any[];
    chart?: string;
  };
  portfolio: {
    allocation: any[];
    diversification: {
      concentrationIndex: number;
      diversificationRatio: number;
      largestPosition: number;
    };
    chart?: string;
  };
  trades: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
  };
  alerts: any[];
  recommendations?: string[];
}

export interface ReportOptions {
  includeCharts?: boolean;
  includeTables?: boolean;
  includeRecommendations?: boolean;
  format?: 'html' | 'pdf';
  title?: string;
  footerText?: string;
}

export class ReportGenerator {
  /**
   * Generate HTML report
   */
  static generateHTMLReport(
    data: ReportData,
    options: ReportOptions = {}
  ): string {
    const {
      includeCharts = true,
      includeTables = true,
      includeRecommendations = true,
      title = 'Analytics Report',
      footerText = 'Confidential - HMS Analytics'
    } = options;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            line-height: 1.6;
            background: white;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            border-bottom: 3px solid #0066cc;
            margin-bottom: 30px;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #0066cc;
            margin-bottom: 10px;
        }
        .header-info {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #666;
        }
        .section {
            margin-bottom: 40px;
            page-break-inside: avoid;
        }
        .section h2 {
            color: #0066cc;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 18px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 15px;
            margin-bottom: 20px;
        }
        .summary-card {
            background: #f8f9fa;
            border-left: 4px solid #0066cc;
            padding: 15px;
            border-radius: 4px;
        }
        .summary-card .label {
            font-size: 12px;
            color: #999;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .summary-card .value {
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        .summary-card.positive .value {
            color: #10b981;
        }
        .summary-card.negative .value {
            color: #ef4444;
        }
        .summary-card.neutral .value {
            color: #f59e0b;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background: #f8f9fa;
            border-bottom: 2px solid #ddd;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #333;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #eee;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .chart-container {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 4px;
            margin-bottom: 20px;
            page-break-inside: avoid;
        }
        .chart-container img {
            max-width: 100%;
            height: auto;
        }
        .alert {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
        }
        .alert.critical {
            background: #f8d7da;
            border-left-color: #dc3545;
        }
        .alert.info {
            background: #d1ecf1;
            border-left-color: #17a2b8;
        }
        .recommendations {
            background: #e8f4f8;
            border-left: 4px solid #0066cc;
            padding: 20px;
            border-radius: 4px;
        }
        .recommendations h3 {
            color: #0066cc;
            margin-bottom: 15px;
        }
        .recommendations ul {
            list-style-position: inside;
            line-height: 1.8;
        }
        .recommendations li {
            margin-bottom: 10px;
        }
        .footer {
            border-top: 1px solid #eee;
            margin-top: 40px;
            padding-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #999;
            page-break-before: avoid;
        }
        @media print {
            body { margin: 0; padding: 0; }
            .container { max-width: 100%; margin: 0; padding: 20mm; }
            .section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>${title}</h1>
            <div class="header-info">
                <span>Generated: ${new Date().toLocaleDateString()}</span>
                <span>Strategy: ${data.strategyId || 'All Strategies'}</span>
                <span>Period: ${data.period.startDate.toLocaleDateString()} - ${data.period.endDate.toLocaleDateString()}</span>
            </div>
        </div>

        <!-- Executive Summary -->
        <div class="section">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-card ${data.summary.return >= 0 ? 'positive' : 'negative'}">
                    <div class="label">Total Value</div>
                    <div class="value">${AnalyticsUtils.formatCurrency(data.summary.totalValue)}</div>
                </div>
                <div class="summary-card ${data.summary.return >= 0 ? 'positive' : 'negative'}">
                    <div class="label">Return</div>
                    <div class="value">${AnalyticsUtils.formatPercentage(data.summary.return)}</div>
                </div>
                <div class="summary-card">
                    <div class="label">Sharpe Ratio</div>
                    <div class="value">${data.summary.sharpeRatio.toFixed(2)}</div>
                </div>
                <div class="summary-card ${data.summary.maxDrawdown <= -0.2 ? 'negative' : 'neutral'}">
                    <div class="label">Max Drawdown</div>
                    <div class="value">${AnalyticsUtils.formatPercentage(data.summary.maxDrawdown)}</div>
                </div>
            </div>
        </div>

        <!-- Performance Charts -->
        ${includeCharts ? `
        <div class="section">
            <h2>Performance Analysis</h2>
            ${data.performance.chart ? `
            <div class="chart-container">
                <img src="${data.performance.chart}" alt="Performance Chart" />
            </div>
            ` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Win Rate</td>
                        <td>${AnalyticsUtils.formatPercentage(data.summary.winRate)}</td>
                    </tr>
                    <tr>
                        <td>Sharpe Ratio</td>
                        <td>${data.summary.sharpeRatio.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Max Drawdown</td>
                        <td>${AnalyticsUtils.formatPercentage(data.summary.maxDrawdown)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Risk Analysis -->
        ${includeCharts ? `
        <div class="section">
            <h2>Risk Analysis</h2>
            ${data.risk.chart ? `
            <div class="chart-container">
                <img src="${data.risk.chart}" alt="Risk Chart" />
            </div>
            ` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Risk Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Risk Score</td>
                        <td>${data.summary.riskScore.toFixed(1)}/100</td>
                    </tr>
                    <tr>
                        <td>Risk Level</td>
                        <td>${data.summary.riskLevel}</td>
                    </tr>
                    <tr>
                        <td>Max Drawdown</td>
                        <td>${AnalyticsUtils.formatPercentage(data.summary.maxDrawdown)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Portfolio -->
        ${includeTables ? `
        <div class="section">
            <h2>Portfolio Allocation</h2>
            ${data.portfolio.chart ? `
            <div class="chart-container">
                <img src="${data.portfolio.chart}" alt="Portfolio Chart" />
            </div>
            ` : ''}
            <table>
                <thead>
                    <tr>
                        <th>Asset</th>
                        <th>Value</th>
                        <th>Allocation %</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.portfolio.allocation.map((a: any) => `
                    <tr>
                        <td>${a.symbol}</td>
                        <td>${AnalyticsUtils.formatCurrency(a.value)}</td>
                        <td>${AnalyticsUtils.formatPercentage(a.percentage)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
            <table>
                <thead>
                    <tr>
                        <th>Diversification Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Concentration Index</td>
                        <td>${data.portfolio.diversification.concentrationIndex.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Diversification Ratio</td>
                        <td>${data.portfolio.diversification.diversificationRatio.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Largest Position</td>
                        <td>${AnalyticsUtils.formatPercentage(data.portfolio.diversification.largestPosition)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Trade Statistics -->
        ${includeTables ? `
        <div class="section">
            <h2>Trade Statistics</h2>
            <table>
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total Trades</td>
                        <td>${data.trades.totalTrades}</td>
                    </tr>
                    <tr>
                        <td>Winning Trades</td>
                        <td>${data.trades.winningTrades}</td>
                    </tr>
                    <tr>
                        <td>Losing Trades</td>
                        <td>${data.trades.losingTrades}</td>
                    </tr>
                    <tr>
                        <td>Win Rate</td>
                        <td>${AnalyticsUtils.formatPercentage(data.trades.winRate)}</td>
                    </tr>
                    <tr>
                        <td>Average Win</td>
                        <td>${AnalyticsUtils.formatCurrency(data.trades.avgWin)}</td>
                    </tr>
                    <tr>
                        <td>Average Loss</td>
                        <td>${AnalyticsUtils.formatCurrency(data.trades.avgLoss)}</td>
                    </tr>
                    <tr>
                        <td>Profit Factor</td>
                        <td>${data.trades.profitFactor.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        ` : ''}

        <!-- Recent Alerts -->
        ${data.alerts.length > 0 ? `
        <div class="section">
            <h2>Recent Alerts</h2>
            ${data.alerts.map((alert: any) => `
            <div class="alert ${alert.alertLevel.toLowerCase()}">
                <strong>${alert.alertType}</strong> - ${alert.title}
                <p>${alert.description}</p>
            </div>
            `).join('')}
        </div>
        ` : ''}

        <!-- Recommendations -->
        ${includeRecommendations && data.recommendations && data.recommendations.length > 0 ? `
        <div class="section recommendations">
            <h3>Recommendations</h3>
            <ul>
                ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
        ` : ''}

        <!-- Footer -->
        <div class="footer">
            <p>${footerText}</p>
            <p>© ${new Date().getFullYear()} HMS Analytics. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Generate PDF report using html-to-pdf
   * In production, would use libraries like puppeteer, wkhtmltopdf, or pdfkit
   */
  static async generatePDFReport(
    data: ReportData,
    options: ReportOptions = {}
  ): Promise<Buffer> {
    const htmlContent = this.generateHTMLReport(data, options);

    // In production, would implement actual PDF generation
    // Example using puppeteer:
    // const browser = await puppeteer.launch();
    // const page = await browser.newPage();
    // await page.setContent(htmlContent);
    // const pdf = await page.pdf({ format: 'A4' });
    // await browser.close();
    // return pdf;

    // For now, return a placeholder
    return Buffer.from(htmlContent);
  }

  /**
   * Generate recommendations based on analytics data
   */
  static generateRecommendations(data: ReportData): string[] {
    const recommendations: string[] = [];

    // Based on return
    if (data.summary.return < 0.05) {
      recommendations.push('Consider reviewing your strategy parameters to improve returns.');
    }

    // Based on Sharpe ratio
    if (data.summary.sharpeRatio < 0.5) {
      recommendations.push('Risk-adjusted returns are low. Focus on improving the risk-return profile.');
    }

    // Based on max drawdown
    if (data.summary.maxDrawdown < -0.2) {
      recommendations.push('Maximum drawdown is significant. Consider implementing stronger risk management controls.');
    }

    // Based on win rate
    if (data.trades.winRate < 0.5) {
      recommendations.push('Win rate is below 50%. Reassess trade selection criteria or entry/exit rules.');
    }

    // Based on risk level
    if (data.summary.riskScore > 75) {
      recommendations.push('Risk level is high. Consider reducing position sizes or diversifying further.');
    }

    // Based on portfolio diversification
    if (data.portfolio.diversification.concentrationIndex < 0.5) {
      recommendations.push('Portfolio is concentrated. Diversification could reduce portfolio risk.');
    }

    // Based on profit factor
    if (data.trades.profitFactor < 1.5) {
      recommendations.push('Profit factor indicates weak trading edge. Consider strategy improvements.');
    }

    return recommendations;
  }

  /**
   * Export report to file
   */
  static async exportReportToFile(
    data: ReportData,
    filename: string,
    format: 'html' | 'pdf' = 'html',
    options?: ReportOptions
  ): Promise<Buffer> {
    if (format === 'html') {
      const html = this.generateHTMLReport(data, options);
      return Buffer.from(html);
    } else if (format === 'pdf') {
      return this.generatePDFReport(data, options);
    }

    throw new Error('Unsupported format');
  }

  /**
   * Schedule daily/weekly report generation
   */
  static createScheduledReportGenerator(intervalMinutes: number = 1440) {
    // This would be used to generate reports on a schedule
    return setInterval(() => {
      console.log('Scheduled report generation triggered');
      // Implementation would fetch data and generate reports
    }, intervalMinutes * 60 * 1000);
  }
}

export default ReportGenerator;
