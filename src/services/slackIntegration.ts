/**
 * Slack Integration Service
 * Sends analytics alerts and reports to Slack
 * @version 1.0.0
 */

import { AnalyticsAlert, AlertLevel } from '../analytics';

export interface SlackConfig {
  webhookUrl: string;
  defaultChannel?: string;
  botName?: string;
  botIcon?: string;
}

export interface SlackMessage {
  channel?: string;
  text?: string;
  blocks?: any[];
  attachments?: any[];
  thread_ts?: string;
}

export class SlackIntegration {
  private config: SlackConfig;
  private isConfigured: boolean = false;
  private messageQueue: SlackMessage[] = [];
  private failedMessages: SlackMessage[] = [];
  private maxRetries: number = 3;
  private retryDelay: number = 5000; // 5 seconds

  constructor(config?: SlackConfig) {
    if (config) {
      this.config = config;
      this.isConfigured = true;
    }
  }

  /**
   * Configure Slack integration
   */
  configure(config: SlackConfig): void {
    this.config = config;
    this.isConfigured = true;
  }

  /**
   * Send alert to Slack
   */
  async sendAlert(
    alert: AnalyticsAlert,
    channel?: string
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Slack not configured');
      return false;
    }

    try {
      const message = this.createAlertMessage(alert, channel);
      await this.sendMessage(message);
      return true;
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
      return false;
    }
  }

  /**
   * Send daily summary to Slack
   */
  async sendDailySummary(
    data: {
      date: Date;
      return: number;
      sharpeRatio: number;
      trades: number;
      winRate: number;
      alerts: AnalyticsAlert[];
    },
    channel?: string
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Slack not configured');
      return false;
    }

    try {
      const message = this.createDailySummaryMessage(data, channel);
      await this.sendMessage(message);
      return true;
    } catch (error) {
      console.error('Failed to send daily summary:', error);
      return false;
    }
  }

  /**
   * Send analytics report to Slack
   */
  async sendReport(
    data: {
      period: string;
      return: number;
      sharpeRatio: number;
      maxDrawdown: number;
      totalTrades: number;
      winRate: number;
      recommendation?: string;
    },
    channel?: string
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Slack not configured');
      return false;
    }

    try {
      const message = this.createReportMessage(data, channel);
      await this.sendMessage(message);
      return true;
    } catch (error) {
      console.error('Failed to send report:', error);
      return false;
    }
  }

  /**
   * Send team notification
   */
  async sendTeamNotification(
    title: string,
    message: string,
    color?: string,
    channel?: string
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.warn('Slack not configured');
      return false;
    }

    try {
      const slackMessage: SlackMessage = {
        channel: channel || this.config.defaultChannel,
        attachments: [
          {
            color: color || '#0066cc',
            title: title,
            text: message,
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };

      await this.sendMessage(slackMessage);
      return true;
    } catch (error) {
      console.error('Failed to send team notification:', error);
      return false;
    }
  }

  /**
   * Create alert message
   */
  private createAlertMessage(alert: AnalyticsAlert, channel?: string): SlackMessage {
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

    const getAlertEmoji = () => {
      switch (alert.alertLevel) {
        case AlertLevel.CRITICAL:
          return '🚨';
        case AlertLevel.WARNING:
          return '⚠️';
        case AlertLevel.INFO:
          return 'ℹ️';
        default:
          return '📌';
      }
    };

    return {
      channel: channel || this.config.defaultChannel,
      text: `${getAlertEmoji()} ${alert.title}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${getAlertEmoji()} ${alert.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Type:*\n${alert.alertType}`
            },
            {
              type: 'mrkdwn',
              text: `*Level:*\n${alert.alertLevel}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: alert.description
          }
        },
        ...(alert.metricName
          ? [
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Current:*\n${alert.metricValue?.toFixed(2)}`
                },
                {
                  type: 'mrkdwn',
                  text: `*Threshold:*\n${alert.thresholdValue?.toFixed(2)}`
                }
              ]
            }
          ]
          : []),
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `_${new Date().toLocaleString()}_`
            }
          ]
        }
      ]
    };
  }

  /**
   * Create daily summary message
   */
  private createDailySummaryMessage(
    data: {
      date: Date;
      return: number;
      sharpeRatio: number;
      trades: number;
      winRate: number;
      alerts: AnalyticsAlert[];
    },
    channel?: string
  ): SlackMessage {
    return {
      channel: channel || this.config.defaultChannel,
      text: `Daily Summary - ${data.date.toLocaleDateString()}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `📊 Daily Summary - ${data.date.toLocaleDateString()}`,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Return*\n${(data.return * 100).toFixed(2)}%`
            },
            {
              type: 'mrkdwn',
              text: `*Sharpe Ratio*\n${data.sharpeRatio.toFixed(2)}`
            },
            {
              type: 'mrkdwn',
              text: `*Win Rate*\n${(data.winRate * 100).toFixed(2)}%`
            },
            {
              type: 'mrkdwn',
              text: `*Trades*\n${data.trades}`
            }
          ]
        },
        ...(data.alerts.length > 0
          ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Alerts (${data.alerts.length})*\n${data.alerts
                  .slice(0, 3)
                  .map((a) => `• ${a.title}`)
                  .join('\n')}`
              }
            }
          ]
          : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View Dashboard',
                emoji: true
              },
              url: 'https://hms.aurex.in/analytics',
              action_id: 'view_dashboard'
            }
          ]
        }
      ]
    };
  }

  /**
   * Create report message
   */
  private createReportMessage(
    data: {
      period: string;
      return: number;
      sharpeRatio: number;
      maxDrawdown: number;
      totalTrades: number;
      winRate: number;
      recommendation?: string;
    },
    channel?: string
  ): SlackMessage {
    const getReportColor = () => {
      if (data.return > 0.1) return '#10b981';
      if (data.return > 0) return '#3b82f6';
      return '#ef4444';
    };

    return {
      channel: channel || this.config.defaultChannel,
      attachments: [
        {
          color: getReportColor(),
          title: `📈 Analytics Report - ${data.period}`,
          fields: [
            {
              title: 'Return',
              value: `${(data.return * 100).toFixed(2)}%`,
              short: true
            },
            {
              title: 'Sharpe Ratio',
              value: data.sharpeRatio.toFixed(2),
              short: true
            },
            {
              title: 'Max Drawdown',
              value: `${(data.maxDrawdown * 100).toFixed(2)}%`,
              short: true
            },
            {
              title: 'Win Rate',
              value: `${(data.winRate * 100).toFixed(2)}%`,
              short: true
            },
            {
              title: 'Total Trades',
              value: data.totalTrades.toString(),
              short: true
            }
          ],
          ...(data.recommendation
            ? {
              text: `_Recommendation:_ ${data.recommendation}`
            }
            : {}),
          actions: [
            {
              type: 'button',
              text: 'View Full Report',
              url: 'https://hms.aurex.in/analytics'
            }
          ],
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Send message to Slack webhook
   */
  private async sendMessage(message: SlackMessage): Promise<void> {
    try {
      const payload = {
        ...message,
        username: this.config.botName || 'Analytics Bot',
        icon_emoji: this.config.botIcon || ':chart_with_upwards_trend:'
      };

      // Send to Slack webhook
      const response = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      console.log('[Slack] Message sent successfully:', message.text);

      // Also queue locally for tracking
      this.messageQueue.push(message);
    } catch (error) {
      console.error('[Slack] Failed to send message:', error);
      // Queue message for retry
      this.messageQueue.push(message);
      throw error;
    }
  }

  /**
   * Get queued messages (for testing)
   */
  getQueuedMessages(): SlackMessage[] {
    return this.messageQueue;
  }

  /**
   * Clear queue (for testing)
   */
  clearQueue(): void {
    this.messageQueue = [];
  }

  /**
   * Flush message queue (send all pending messages)
   */
  async flushQueue(): Promise<{ success: number; failed: number }> {
    let successCount = 0;
    let failedCount = 0;

    for (const message of this.messageQueue) {
      try {
        await this.sendMessage(message);
        successCount++;
      } catch (error) {
        this.failedMessages.push(message);
        failedCount++;
      }
    }

    this.messageQueue = [];
    return { success: successCount, failed: failedCount };
  }

  /**
   * Retry failed messages
   */
  async retryFailedMessages(): Promise<{ success: number; failed: number }> {
    let successCount = 0;
    let failedCount = 0;
    const stillFailed: SlackMessage[] = [];

    for (const message of this.failedMessages) {
      try {
        await this.sendMessage(message);
        successCount++;
      } catch (error) {
        stillFailed.push(message);
        failedCount++;
      }
    }

    this.failedMessages = stillFailed;
    return { success: successCount, failed: failedCount };
  }

  /**
   * Get failed messages
   */
  getFailedMessages(): SlackMessage[] {
    return this.failedMessages;
  }

  /**
   * Clear failed messages
   */
  clearFailedMessages(): void {
    this.failedMessages = [];
  }

  /**
   * Check if Slack is configured
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { queued: number; failed: number; total: number } {
    return {
      queued: this.messageQueue.length,
      failed: this.failedMessages.length,
      total: this.messageQueue.length + this.failedMessages.length
    };
  }
}

export default SlackIntegration;
