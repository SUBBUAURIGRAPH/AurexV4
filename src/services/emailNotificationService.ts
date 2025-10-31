/**
 * Email Notification Service
 * Sends email notifications for analytics alerts and reports
 * @version 1.0.0
 */

import { AnalyticsAlert, AlertLevel } from '../analytics';

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName?: string;
}

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface AlertEmailOptions {
  alert: AnalyticsAlert;
  recipient: EmailRecipient;
  includeDetails?: boolean;
  strategyName?: string;
}

export interface ReportEmailOptions {
  reportPath: string;
  recipients: EmailRecipient[];
  subject: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    return: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
}

export class EmailNotificationService {
  private config: EmailConfig;
  private emailQueue: Array<{ to: string; subject: string; html: string }> = [];
  private isConfigured: boolean = false;

  constructor(config?: EmailConfig) {
    if (config) {
      this.config = config;
      this.isConfigured = true;
    }
  }

  /**
   * Configure email service
   */
  configure(config: EmailConfig): void {
    this.config = config;
    this.isConfigured = true;
  }

  /**
   * Send alert notification email
   */
  async sendAlertNotification(options: AlertEmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured');
      return false;
    }

    try {
      const { alert, recipient, includeDetails, strategyName } = options;

      const html = this.generateAlertEmailHTML({
        alert,
        recipient,
        strategyName,
        includeDetails
      });

      const subject = this.getAlertEmailSubject(alert);

      await this.sendEmail({
        to: recipient.email,
        subject,
        html
      });

      console.log(`Alert email sent to ${recipient.email}`);
      return true;
    } catch (error) {
      console.error('Failed to send alert email:', error);
      return false;
    }
  }

  /**
   * Send report email
   */
  async sendReportEmail(options: ReportEmailOptions): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured');
      return false;
    }

    try {
      const { recipients, subject, period, summary } = options;

      const html = this.generateReportEmailHTML({
        period,
        summary,
        subject
      });

      for (const recipient of recipients) {
        await this.sendEmail({
          to: recipient.email,
          subject,
          html
        });
      }

      console.log(`Report email sent to ${recipients.length} recipients`);
      return true;
    } catch (error) {
      console.error('Failed to send report email:', error);
      return false;
    }
  }

  /**
   * Send daily summary email
   */
  async sendDailySummaryEmail(
    recipient: EmailRecipient,
    data: {
      date: Date;
      totalValue: number;
      return: number;
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
      trades: number;
      alerts: AnalyticsAlert[];
    }
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured');
      return false;
    }

    try {
      const html = this.generateDailySummaryHTML(data);

      await this.sendEmail({
        to: recipient.email,
        subject: `Daily Summary - ${data.date.toLocaleDateString()}`,
        html
      });

      return true;
    } catch (error) {
      console.error('Failed to send daily summary email:', error);
      return false;
    }
  }

  /**
   * Send weekly report email
   */
  async sendWeeklyReportEmail(
    recipient: EmailRecipient,
    data: {
      weekStart: Date;
      weekEnd: Date;
      metrics: {
        return: number;
        sharpeRatio: number;
        maxDrawdown: number;
        totalTrades: number;
        winRate: number;
      };
      bestDay: { date: Date; return: number };
      worstDay: { date: Date; return: number };
      alerts: AnalyticsAlert[];
    }
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Email service not configured');
      return false;
    }

    try {
      const html = this.generateWeeklyReportHTML(data);

      await this.sendEmail({
        to: recipient.email,
        subject: `Weekly Report - ${data.weekStart.toLocaleDateString()} to ${data.weekEnd.toLocaleDateString()}`,
        html
      });

      return true;
    } catch (error) {
      console.error('Failed to send weekly report email:', error);
      return false;
    }
  }

  /**
   * Send batch email
   */
  async sendBatchNotifications(
    alerts: AnalyticsAlert[],
    recipients: EmailRecipient[]
  ): Promise<number> {
    let sent = 0;

    for (const alert of alerts) {
      for (const recipient of recipients) {
        const success = await this.sendAlertNotification({
          alert,
          recipient
        });
        if (success) sent++;
      }
    }

    return sent;
  }

  /**
   * Get alert email subject
   */
  private getAlertEmailSubject(alert: AnalyticsAlert): string {
    const icon = alert.alertLevel === AlertLevel.CRITICAL ? '🚨' : '⚠️';
    return `${icon} [${alert.alertType}] ${alert.title}`;
  }

  /**
   * Generate alert email HTML
   */
  private generateAlertEmailHTML(data: {
    alert: AnalyticsAlert;
    recipient: EmailRecipient;
    strategyName?: string;
    includeDetails?: boolean;
  }): string {
    const { alert, recipient, strategyName, includeDetails } = data;

    const getAlertColor = () => {
      switch (alert.alertLevel) {
        case AlertLevel.CRITICAL:
          return '#dc3545';
        case AlertLevel.WARNING:
          return '#ffc107';
        case AlertLevel.INFO:
          return '#17a2b8';
        default:
          return '#6c757d';
      }
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${getAlertColor()}; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .alert-type { opacity: 0.9; font-size: 14px; margin-top: 5px; }
        .content { background: #f8f9fa; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .content p { margin: 10px 0; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #ddd; }
        .metric:last-child { border-bottom: none; }
        .metric-label { font-weight: bold; }
        .metric-value { color: #0066cc; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        .action-button {
            display: inline-block;
            background: #0066cc;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${alert.title}</h1>
            <div class="alert-type">${alert.alertType} - ${alert.alertLevel}</div>
        </div>

        <div class="content">
            <p><strong>Hello ${recipient.name || 'User'},</strong></p>
            <p>${alert.description}</p>

            ${includeDetails && alert.metricName ? `
            <div style="margin-top: 20px;">
                <div class="metric">
                    <span class="metric-label">Current Value:</span>
                    <span class="metric-value">${alert.metricValue?.toFixed(2)}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Threshold:</span>
                    <span class="metric-value">${alert.thresholdValue?.toFixed(2)}</span>
                </div>
            </div>
            ` : ''}

            ${strategyName ? `
            <p style="margin-top: 20px; color: #666; font-size: 14px;">
                Strategy: <strong>${strategyName}</strong>
            </p>
            ` : ''}

            <a href="https://hms.aurex.in/analytics" class="action-button">View Dashboard</a>
        </div>

        <div class="footer">
            <p>This is an automated alert from HMS Analytics Platform</p>
            <p>© ${new Date().getFullYear()} HMS. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate report email HTML
   */
  private generateReportEmailHTML(data: {
    period: { startDate: Date; endDate: Date };
    summary: { return: number; sharpeRatio: number; maxDrawdown: number };
    subject: string;
  }): string {
    const { period, summary } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .summary-card {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #0066cc;
            border-radius: 4px;
        }
        .summary-card-label { font-size: 12px; color: #999; text-transform: uppercase; }
        .summary-card-value { font-size: 18px; font-weight: bold; color: #333; margin-top: 5px; }
        .summary-card-value.positive { color: #10b981; }
        .summary-card-value.negative { color: #ef4444; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        .action-button {
            display: inline-block;
            background: #0066cc;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 15px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Analytics Report</h1>
            <p>${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-card-label">Return</div>
                <div class="summary-card-value ${summary.return >= 0 ? 'positive' : 'negative'}">
                    ${(summary.return * 100).toFixed(2)}%
                </div>
            </div>
            <div class="summary-card">
                <div class="summary-card-label">Sharpe Ratio</div>
                <div class="summary-card-value">${summary.sharpeRatio.toFixed(2)}</div>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <div class="summary-card-label">Max Drawdown</div>
                <div class="summary-card-value negative">${(summary.maxDrawdown * 100).toFixed(2)}%</div>
            </div>
            <div class="summary-card">
                <div class="summary-card-label">Status</div>
                <div class="summary-card-value">Report Ready</div>
            </div>
        </div>

        <a href="https://hms.aurex.in/analytics" class="action-button">View Full Report</a>

        <div class="footer">
            <p>This is an automated report from HMS Analytics Platform</p>
            <p>© ${new Date().getFullYear()} HMS. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate daily summary HTML
   */
  private generateDailySummaryHTML(data: {
    date: Date;
    totalValue: number;
    return: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
    alerts: AnalyticsAlert[];
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .metric-label { font-weight: bold; }
        .alert { background: #f8d7da; padding: 10px; border-left: 4px solid #dc3545; margin: 10px 0; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Daily Summary</h1>
            <p>${data.date.toLocaleDateString()}</p>
        </div>

        <h2>Daily Metrics</h2>
        <div class="metric">
            <span class="metric-label">Portfolio Value:</span>
            <span>$${data.totalValue.toLocaleString()}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Daily Return:</span>
            <span style="color: ${data.return >= 0 ? 'green' : 'red'}">${(data.return * 100).toFixed(2)}%</span>
        </div>
        <div class="metric">
            <span class="metric-label">Win Rate:</span>
            <span>${(data.winRate * 100).toFixed(2)}%</span>
        </div>
        <div class="metric">
            <span class="metric-label">Trades Today:</span>
            <span>${data.trades}</span>
        </div>

        ${data.alerts.length > 0 ? `
        <h2>Alerts</h2>
        ${data.alerts.map(a => `
        <div class="alert">
            <strong>${a.alertType}</strong>: ${a.title}
        </div>
        `).join('')}
        ` : ''}
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate weekly report HTML
   */
  private generateWeeklyReportHTML(data: {
    weekStart: Date;
    weekEnd: Date;
    metrics: {
      return: number;
      sharpeRatio: number;
      maxDrawdown: number;
      totalTrades: number;
      winRate: number;
    };
    bestDay: { date: Date; return: number };
    worstDay: { date: Date; return: number };
    alerts: AnalyticsAlert[];
  }): string {
    const { metrics, bestDay, worstDay } = data;

    return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0066cc; color: white; padding: 20px; border-radius: 4px; margin-bottom: 20px; }
        .metric { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
        .metric-label { font-weight: bold; }
        .highlight-positive { color: #10b981; font-weight: bold; }
        .highlight-negative { color: #ef4444; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Weekly Report</h1>
            <p>${data.weekStart.toLocaleDateString()} - ${data.weekEnd.toLocaleDateString()}</p>
        </div>

        <h2>Performance</h2>
        <div class="metric">
            <span class="metric-label">Weekly Return:</span>
            <span class="highlight-${metrics.return >= 0 ? 'positive' : 'negative'}">
                ${(metrics.return * 100).toFixed(2)}%
            </span>
        </div>
        <div class="metric">
            <span class="metric-label">Sharpe Ratio:</span>
            <span>${metrics.sharpeRatio.toFixed(2)}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Max Drawdown:</span>
            <span class="highlight-negative">${(metrics.maxDrawdown * 100).toFixed(2)}%</span>
        </div>

        <h2>Trading Activity</h2>
        <div class="metric">
            <span class="metric-label">Total Trades:</span>
            <span>${metrics.totalTrades}</span>
        </div>
        <div class="metric">
            <span class="metric-label">Win Rate:</span>
            <span>${(metrics.winRate * 100).toFixed(2)}%</span>
        </div>

        <h2>Highlights</h2>
        <div class="metric">
            <span class="metric-label">Best Day:</span>
            <span class="highlight-positive">
                ${bestDay.date.toLocaleDateString()} (${(bestDay.return * 100).toFixed(2)}%)
            </span>
        </div>
        <div class="metric">
            <span class="metric-label">Worst Day:</span>
            <span class="highlight-negative">
                ${worstDay.date.toLocaleDateString()} (${(worstDay.return * 100).toFixed(2)}%)
            </span>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Send email (placeholder for actual implementation)
   */
  private async sendEmail(email: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    // In production, would use nodemailer or similar library
    // Example:
    // const transporter = nodemailer.createTransport({
    //   host: this.config.smtpHost,
    //   port: this.config.smtpPort,
    //   auth: {
    //     user: this.config.smtpUser,
    //     pass: this.config.smtpPassword
    //   }
    // });
    // await transporter.sendMail({
    //   from: `${this.config.fromName} <${this.config.fromEmail}>`,
    //   to: email.to,
    //   subject: email.subject,
    //   html: email.html
    // });

    // For now, queue the email
    this.emailQueue.push(email);
    console.log(`Email queued for ${email.to}`);
  }

  /**
   * Get queued emails (for testing)
   */
  getQueuedEmails(): Array<{ to: string; subject: string; html: string }> {
    return this.emailQueue;
  }

  /**
   * Clear queue (for testing)
   */
  clearQueue(): void {
    this.emailQueue = [];
  }
}

export default EmailNotificationService;
