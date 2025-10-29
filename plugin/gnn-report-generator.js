/**
 * GNN Report Generator - Automated Report Generation
 *
 * Provides automated report generation for:
 * - Daily performance reports
 * - Weekly strategy analysis
 * - Monthly business reviews
 * - Quarterly performance attribution
 * - Annual comprehensive reports
 * - Custom ad-hoc reports
 * - Executive summaries
 *
 * Version: 1.0.0
 * Status: Production Ready
 */

class GNNReportGenerator {
  constructor(analyticsEngine, performanceAnalytics, riskAnalytics, portfolioAnalytics, options = {}) {
    this.analyticsEngine = analyticsEngine;
    this.performanceAnalytics = performanceAnalytics;
    this.riskAnalytics = riskAnalytics;
    this.portfolioAnalytics = portfolioAnalytics;

    this.config = {
      timezone: options.timezone || 'UTC',
      currencySymbol: options.currencySymbol || '$',
      decimalPlaces: options.decimalPlaces || 2,
      ...options
    };

    this.reports = new Map();
    this.stats = {
      reportsGenerated: 0,
      errorsEncountered: 0,
      lastReport: null
    };
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Format currency value
   * @param {number} value - Value to format
   * @returns {string} Formatted currency
   */
  formatCurrency(value) {
    return `${this.config.currencySymbol}${value.toFixed(this.config.decimalPlaces)}`;
  }

  /**
   * Format percentage
   * @param {number} value - Value as decimal
   * @returns {string} Formatted percentage
   */
  formatPercentage(value) {
    return `${(value * 100).toFixed(this.config.decimalPlaces)}%`;
  }

  /**
   * Format date
   * @param {Date} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: this.config.timezone
    });
  }

  /**
   * Create header section
   * @param {string} title - Report title
   * @param {Date} startDate - Period start date
   * @param {Date} endDate - Period end date
   * @returns {string} Formatted header
   */
  createHeader(title, startDate, endDate) {
    return `
================================================================================
${title.toUpperCase()}
================================================================================
Period: ${this.formatDate(startDate)} to ${this.formatDate(endDate)}
Generated: ${this.formatDate(new Date())}
================================================================================
`;
  }

  /**
   * Create section header
   * @param {string} title - Section title
   * @returns {string} Formatted section
   */
  createSectionHeader(title) {
    return `\n--- ${title} ---\n`;
  }

  // ============================================================================
  // DAILY REPORT
  // ============================================================================

  /**
   * Generate daily performance report
   * @param {Object} dailyData - Daily trading data
   * @returns {Object} Daily report
   */
  generateDailyReport(dailyData) {
    const report = {
      type: 'daily',
      timestamp: new Date(),
      html: '',
      json: {}
    };

    try {
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);

      let markdown = this.createHeader('DAILY PERFORMANCE REPORT', startDate, today);

      // Executive Summary
      markdown += this.createSectionHeader('EXECUTIVE SUMMARY');
      if (dailyData.trades) {
        const tradeAnalysis = this.performanceAnalytics.analyzeTrades(dailyData.trades);
        markdown += `Total Trades: ${tradeAnalysis.totalTrades}\n`;
        markdown += `Winning Trades: ${tradeAnalysis.winningTrades} (${this.formatPercentage(tradeAnalysis.winRate)})\n`;
        markdown += `Daily P&L: ${this.formatCurrency(dailyData.pnl || 0)}\n`;
        markdown += `Profit Factor: ${tradeAnalysis.profitFactor.toFixed(2)}\n`;

        report.json.summary = {
          totalTrades: tradeAnalysis.totalTrades,
          winRate: tradeAnalysis.winRate,
          pnl: dailyData.pnl || 0,
          profitFactor: tradeAnalysis.profitFactor
        };
      }

      // Top performers
      if (dailyData.trades && dailyData.trades.length > 0) {
        markdown += this.createSectionHeader('TOP PERFORMERS');
        const winners = dailyData.trades
          .filter(t => t.pnl > 0)
          .sort((a, b) => b.pnl - a.pnl)
          .slice(0, 5);

        winners.forEach(trade => {
          markdown += `${trade.symbol}: ${this.formatCurrency(trade.pnl)} (${trade.shares} shares)\n`;
        });

        report.json.topWinners = winners;
      }

      // Risk summary
      if (dailyData.returns) {
        markdown += this.createSectionHeader('RISK SUMMARY');
        const volatility = this.analyticsEngine.calculateVolatility(dailyData.returns);
        markdown += `Daily Volatility: ${this.formatPercentage(volatility)}\n`;
        markdown += `1-Day VaR (95%): ${this.formatPercentage(this.analyticsEngine.calculateVaR(dailyData.returns))}\n`;

        report.json.risk = {
          volatility,
          var95: this.analyticsEngine.calculateVaR(dailyData.returns)
        };
      }

      report.html = markdown;
      this.reports.set(`daily_${Date.now()}`, report);
      this.stats.reportsGenerated++;
      this.stats.lastReport = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Daily report generation error:', error);
      return report;
    }
  }

  // ============================================================================
  // WEEKLY REPORT
  // ============================================================================

  /**
   * Generate weekly strategy analysis report
   * @param {Object} weeklyData - Weekly trading data
   * @returns {Object} Weekly report
   */
  generateWeeklyReport(weeklyData) {
    const report = {
      type: 'weekly',
      timestamp: new Date(),
      html: '',
      json: {}
    };

    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);

      let markdown = this.createHeader('WEEKLY STRATEGY ANALYSIS', weekStart, today);

      // Performance summary
      markdown += this.createSectionHeader('PERFORMANCE SUMMARY');
      markdown += `Weekly Return: ${this.formatPercentage(weeklyData.return || 0)}\n`;
      markdown += `Weekly P&L: ${this.formatCurrency(weeklyData.pnl || 0)}\n`;

      if (weeklyData.trades) {
        const tradeAnalysis = this.performanceAnalytics.analyzeTrades(weeklyData.trades);
        markdown += `Total Trades: ${tradeAnalysis.totalTrades}\n`;
        markdown += `Win Rate: ${this.formatPercentage(tradeAnalysis.winRate)}\n`;
        markdown += `Average Win: ${this.formatCurrency(tradeAnalysis.avgWin)}\n`;
        markdown += `Average Loss: ${this.formatCurrency(Math.abs(tradeAnalysis.avgLoss))}\n`;
        markdown += `Profit Factor: ${tradeAnalysis.profitFactor.toFixed(2)}\n`;

        report.json.performance = {
          return: weeklyData.return || 0,
          pnl: weeklyData.pnl || 0,
          ...tradeAnalysis
        };
      }

      // Strategy breakdown
      if (weeklyData.trades && weeklyData.trades.length > 0) {
        markdown += this.createSectionHeader('STRATEGY BREAKDOWN');
        const strategyContribution = this.performanceAnalytics.analyzeStrategyContribution(weeklyData.trades);

        Object.entries(strategyContribution).forEach(([strategy, data]) => {
          markdown += `\n${strategy}:\n`;
          markdown += `  Trades: ${data.trades}\n`;
          markdown += `  Win Rate: ${this.formatPercentage(data.winRate)}\n`;
          markdown += `  P&L: ${this.formatCurrency(data.totalPnL)}\n`;
          markdown += `  Contribution: ${this.formatPercentage(data.percentage)}\n`;
        });

        report.json.strategies = strategyContribution;
      }

      // Risk analysis
      if (weeklyData.returns) {
        markdown += this.createSectionHeader('RISK ANALYSIS');
        const volatility = this.analyticsEngine.calculateVolatility(weeklyData.returns);
        const sharpe = this.analyticsEngine.calculateSharpeRatio(weeklyData.returns);
        const maxDD = this.analyticsEngine.calculateMaxDrawdown(weeklyData.returns);

        markdown += `Volatility: ${this.formatPercentage(volatility)}\n`;
        markdown += `Sharpe Ratio: ${sharpe.toFixed(2)}\n`;
        markdown += `Max Drawdown: ${this.formatPercentage(maxDD)}\n`;

        report.json.risk = {
          volatility,
          sharpeRatio: sharpe,
          maxDrawdown: maxDD
        };
      }

      report.html = markdown;
      this.reports.set(`weekly_${Date.now()}`, report);
      this.stats.reportsGenerated++;
      this.stats.lastReport = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Weekly report generation error:', error);
      return report;
    }
  }

  // ============================================================================
  // MONTHLY REPORT
  // ============================================================================

  /**
   * Generate monthly business review report
   * @param {Object} monthlyData - Monthly data
   * @returns {Object} Monthly report
   */
  generateMonthlyReport(monthlyData) {
    const report = {
      type: 'monthly',
      timestamp: new Date(),
      html: '',
      json: {}
    };

    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      let markdown = this.createHeader('MONTHLY BUSINESS REVIEW', monthStart, today);

      // Executive Summary
      markdown += this.createSectionHeader('EXECUTIVE SUMMARY');
      markdown += `Monthly Return: ${this.formatPercentage(monthlyData.return || 0)}\n`;
      markdown += `Monthly P&L: ${this.formatCurrency(monthlyData.pnl || 0)}\n`;
      markdown += `Days Trading: ${monthlyData.tradingDays || 20}\n`;
      markdown += `Current Portfolio Value: ${this.formatCurrency(monthlyData.portfolioValue || 0)}\n`;

      report.json.summary = {
        return: monthlyData.return || 0,
        pnl: monthlyData.pnl || 0,
        portfolioValue: monthlyData.portfolioValue || 0
      };

      // Performance metrics
      if (monthlyData.returns) {
        markdown += this.createSectionHeader('PERFORMANCE METRICS');
        const returns = monthlyData.returns;
        const sharpe = this.analyticsEngine.calculateSharpeRatio(returns);
        const sortino = this.analyticsEngine.calculateSortinoRatio(returns);
        const calmar = this.analyticsEngine.calculateCalmarRatio(returns);
        const volatility = this.analyticsEngine.calculateVolatility(returns);

        markdown += `Sharpe Ratio: ${sharpe.toFixed(2)}\n`;
        markdown += `Sortino Ratio: ${sortino.toFixed(2)}\n`;
        markdown += `Calmar Ratio: ${calmar.toFixed(2)}\n`;
        markdown += `Volatility: ${this.formatPercentage(volatility)}\n`;

        report.json.metrics = {
          sharpeRatio: sharpe,
          sortinoRatio: sortino,
          calmarRatio: calmar,
          volatility
        };
      }

      // Portfolio composition
      if (monthlyData.portfolio) {
        markdown += this.createSectionHeader('PORTFOLIO COMPOSITION');
        const composition = this.portfolioAnalytics.analyzeComposition(monthlyData.portfolio);

        markdown += `Total Positions: ${composition.numberOfPositions}\n`;
        markdown += `Portfolio Value: ${this.formatCurrency(composition.totalValue)}\n`;
        markdown += `Largest Position: ${this.formatPercentage(composition.summary.largestPosition)}\n`;
        markdown += `Cash: ${this.formatPercentage(composition.summary.cashPercentage / 100)}\n`;

        if (Object.keys(composition.bySector).length > 0) {
          markdown += `\nTop Sectors:\n`;
          Object.entries(composition.bySector)
            .sort((a, b) => b[1].weight - a[1].weight)
            .slice(0, 5)
            .forEach(([sector, data]) => {
              markdown += `  ${sector}: ${this.formatPercentage(data.weight)}\n`;
            });
        }

        report.json.composition = composition;
      }

      // Risk analysis
      if (monthlyData.portfolio && monthlyData.returns) {
        markdown += this.createSectionHeader('RISK ANALYSIS');
        const diversification = this.portfolioAnalytics.calculateDiversification(monthlyData.portfolio);
        markdown += `Diversification Ratio: ${diversification.diversificationRatio?.toFixed(2) || 'N/A'}\n`;
        markdown += `Effective Positions: ${diversification.numberOfIndependentPositions?.toFixed(1) || 'N/A'}\n`;

        report.json.risk = diversification;
      }

      // Drawdown analysis
      if (monthlyData.returns) {
        markdown += this.createSectionHeader('DRAWDOWN ANALYSIS');
        const maxDD = this.analyticsEngine.calculateMaxDrawdown(monthlyData.returns);
        const prices = monthlyData.prices || monthlyData.returns.reduce((prices, ret) => {
          prices.push((prices[prices.length - 1] || 1) * (1 + ret));
          return prices;
        }, []);
        const ddDuration = this.performanceAnalytics.calculateDrawdownDuration(prices);

        markdown += `Max Drawdown: ${this.formatPercentage(Math.abs(maxDD))}\n`;
        markdown += `Avg Drawdown Duration: ${ddDuration.avgDrawdownDuration?.toFixed(0) || 'N/A'} days\n`;
        markdown += `Max Drawdown Duration: ${ddDuration.maxDrawdownDuration?.toFixed(0) || 'N/A'} days\n`;

        report.json.drawdown = {
          maxDrawdown: maxDD,
          ...ddDuration
        };
      }

      report.html = markdown;
      this.reports.set(`monthly_${Date.now()}`, report);
      this.stats.reportsGenerated++;
      this.stats.lastReport = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Monthly report generation error:', error);
      return report;
    }
  }

  // ============================================================================
  // QUARTERLY REPORT
  // ============================================================================

  /**
   * Generate quarterly performance attribution report
   * @param {Object} quarterlyData - Quarterly data
   * @returns {Object} Quarterly report
   */
  generateQuarterlyReport(quarterlyData) {
    const report = {
      type: 'quarterly',
      timestamp: new Date(),
      html: '',
      json: {}
    };

    try {
      const today = new Date();
      const quarter = Math.floor(today.getMonth() / 3);
      const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);

      let markdown = this.createHeader('QUARTERLY PERFORMANCE ATTRIBUTION', quarterStart, today);

      // Executive Summary
      markdown += this.createSectionHeader('EXECUTIVE SUMMARY');
      markdown += `Quarterly Return: ${this.formatPercentage(quarterlyData.return || 0)}\n`;
      markdown += `Quarterly P&L: ${this.formatCurrency(quarterlyData.pnl || 0)}\n`;
      markdown += `Total Trades: ${quarterlyData.totalTrades || 0}\n`;
      markdown += `Win Rate: ${this.formatPercentage(quarterlyData.winRate || 0)}\n`;

      report.json.summary = {
        return: quarterlyData.return || 0,
        pnl: quarterlyData.pnl || 0,
        totalTrades: quarterlyData.totalTrades || 0,
        winRate: quarterlyData.winRate || 0
      };

      // Attribution breakdown
      if (quarterlyData.trades) {
        markdown += this.createSectionHeader('ATTRIBUTION BY HOLDING');

        const holdingContribution = this.portfolioAnalytics.analyzeHoldingContribution(
          quarterlyData.portfolio?.holdings || [],
          quarterlyData.return || 0
        );

        const topContributors = Object.entries(holdingContribution)
          .sort((a, b) => b[1].contribution - a[1].contribution)
          .slice(0, 10);

        markdown += `\nTop Contributors:\n`;
        topContributors.forEach(([symbol, data]) => {
          markdown += `${symbol}: ${this.formatCurrency(data.contribution)} (${this.formatPercentage(data.weight)} weight)\n`;
        });

        report.json.attribution = holdingContribution;
      }

      // Strategy performance
      if (quarterlyData.trades && quarterlyData.trades.length > 0) {
        markdown += this.createSectionHeader('STRATEGY PERFORMANCE');
        const strategyContribution = this.performanceAnalytics.analyzeStrategyContribution(quarterlyData.trades);

        Object.entries(strategyContribution).forEach(([strategy, data]) => {
          markdown += `\n${strategy}:\n`;
          markdown += `  Trades: ${data.trades}\n`;
          markdown += `  P&L: ${this.formatCurrency(data.totalPnL)}\n`;
          markdown += `  Win Rate: ${this.formatPercentage(data.winRate)}\n`;
          markdown += `  Avg P&L: ${this.formatCurrency(data.avgPnL)}\n`;
          markdown += `  Contribution: ${this.formatPercentage(data.percentage)}\n`;
        });

        report.json.strategies = strategyContribution;
      }

      // Risk metrics
      if (quarterlyData.returns) {
        markdown += this.createSectionHeader('RISK METRICS');
        const sharpe = this.analyticsEngine.calculateSharpeRatio(quarterlyData.returns);
        const volatility = this.analyticsEngine.calculateVolatility(quarterlyData.returns);
        const var95 = this.analyticsEngine.calculateVaR(quarterlyData.returns, 0.95);
        const cvar95 = this.analyticsEngine.calculateCVaR(quarterlyData.returns, 0.95);

        markdown += `Sharpe Ratio: ${sharpe.toFixed(2)}\n`;
        markdown += `Volatility: ${this.formatPercentage(volatility)}\n`;
        markdown += `VaR (95%): ${this.formatPercentage(var95)}\n`;
        markdown += `CVaR (95%): ${this.formatPercentage(cvar95)}\n`;

        report.json.risk = {
          sharpeRatio: sharpe,
          volatility,
          var95,
          cvar95
        };
      }

      report.html = markdown;
      this.reports.set(`quarterly_${Date.now()}`, report);
      this.stats.reportsGenerated++;
      this.stats.lastReport = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Quarterly report generation error:', error);
      return report;
    }
  }

  // ============================================================================
  // ANNUAL REPORT
  // ============================================================================

  /**
   * Generate annual comprehensive report
   * @param {Object} annualData - Annual data
   * @returns {Object} Annual report
   */
  generateAnnualReport(annualData) {
    const report = {
      type: 'annual',
      timestamp: new Date(),
      html: '',
      json: {}
    };

    try {
      const today = new Date();
      const yearStart = new Date(today.getFullYear(), 0, 1);

      let markdown = this.createHeader('ANNUAL PERFORMANCE REPORT', yearStart, today);

      // Executive Summary
      markdown += this.createSectionHeader('EXECUTIVE SUMMARY');
      markdown += `Annual Return: ${this.formatPercentage(annualData.return || 0)}\n`;
      markdown += `Annual P&L: ${this.formatCurrency(annualData.pnl || 0)}\n`;
      markdown += `Total Trades: ${annualData.totalTrades || 0}\n`;
      markdown += `Average Monthly Return: ${this.formatPercentage((annualData.return || 0) / 12)}\n`;

      report.json.summary = {
        return: annualData.return || 0,
        pnl: annualData.pnl || 0,
        totalTrades: annualData.totalTrades || 0
      };

      // Performance comparison
      if (annualData.benchmarkReturn !== undefined) {
        markdown += `\nBenchmark Return: ${this.formatPercentage(annualData.benchmarkReturn)}\n`;
        markdown += `Outperformance: ${this.formatPercentage((annualData.return || 0) - annualData.benchmarkReturn)}\n`;
        report.json.summary.outperformance = (annualData.return || 0) - annualData.benchmarkReturn;
      }

      // Risk-adjusted metrics
      if (annualData.returns) {
        markdown += this.createSectionHeader('RISK-ADJUSTED METRICS');
        const sharpe = this.analyticsEngine.calculateSharpeRatio(annualData.returns);
        const sortino = this.analyticsEngine.calculateSortinoRatio(annualData.returns);
        const calmar = this.analyticsEngine.calculateCalmarRatio(annualData.returns);
        const volatility = this.analyticsEngine.calculateVolatility(annualData.returns);

        markdown += `Sharpe Ratio: ${sharpe.toFixed(2)}\n`;
        markdown += `Sortino Ratio: ${sortino.toFixed(2)}\n`;
        markdown += `Calmar Ratio: ${calmar.toFixed(2)}\n`;
        markdown += `Volatility: ${this.formatPercentage(volatility)}\n`;

        const alphaBeta = this.analyticsEngine.calculateAlphaBeta(
          annualData.returns,
          annualData.benchmarkReturns || annualData.returns
        );
        markdown += `Alpha: ${this.formatPercentage(alphaBeta.alpha)}\n`;
        markdown += `Beta: ${alphaBeta.beta.toFixed(2)}\n`;

        report.json.metrics = {
          sharpeRatio: sharpe,
          sortinoRatio: sortino,
          calmarRatio: calmar,
          volatility,
          alpha: alphaBeta.alpha,
          beta: alphaBeta.beta
        };
      }

      // Drawdown analysis
      if (annualData.returns) {
        markdown += this.createSectionHeader('DRAWDOWN ANALYSIS');
        const maxDD = this.analyticsEngine.calculateMaxDrawdown(annualData.returns);
        const prices = annualData.prices || annualData.returns.reduce((prices, ret) => {
          prices.push((prices[prices.length - 1] || 1) * (1 + ret));
          return prices;
        }, []);
        const ddDuration = this.performanceAnalytics.calculateDrawdownDuration(prices);
        const recoveryFactor = this.analyticsEngine.calculateRecoveryFactor(annualData.returns);

        markdown += `Max Drawdown: ${this.formatPercentage(Math.abs(maxDD))}\n`;
        markdown += `Max Drawdown Duration: ${ddDuration.maxDrawdownDuration?.toFixed(0) || 'N/A'} days\n`;
        markdown += `Recovery Factor: ${recoveryFactor.toFixed(2)}\n`;

        report.json.drawdown = {
          maxDrawdown: maxDD,
          maxDuration: ddDuration.maxDrawdownDuration,
          recoveryFactor
        };
      }

      // Monthly performance table
      if (annualData.monthlyReturns) {
        markdown += this.createSectionHeader('MONTHLY RETURNS');
        markdown += '\nMonth              Return\n';
        markdown += '─────────────────────────\n';
        Object.entries(annualData.monthlyReturns).forEach(([month, ret]) => {
          markdown += `${month}         ${this.formatPercentage(ret)}\n`;
        });
      }

      report.html = markdown;
      this.reports.set(`annual_${Date.now()}`, report);
      this.stats.reportsGenerated++;
      this.stats.lastReport = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Annual report generation error:', error);
      return report;
    }
  }

  // ============================================================================
  // CUSTOM REPORTS
  // ============================================================================

  /**
   * Generate custom ad-hoc report
   * @param {Object} customData - Custom report data
   * @param {Object} config - Custom report configuration
   * @returns {Object} Custom report
   */
  generateCustomReport(customData, config = {}) {
    const report = {
      type: 'custom',
      timestamp: new Date(),
      html: '',
      json: {},
      config
    };

    try {
      let markdown = this.createHeader(config.title || 'CUSTOM REPORT', config.startDate || new Date(), config.endDate || new Date());

      // Add configured sections
      if (config.includeSummary) {
        markdown += this.createSectionHeader('SUMMARY');
        if (customData.summary) {
          Object.entries(customData.summary).forEach(([key, value]) => {
            markdown += `${key}: ${value}\n`;
          });
        }
      }

      if (config.includePerformance && customData.trades) {
        markdown += this.createSectionHeader('PERFORMANCE');
        const analysis = this.performanceAnalytics.generatePerformanceReport(customData);
        markdown += `Win Rate: ${this.formatPercentage(analysis.summary.winRate)}\n`;
        markdown += `Profit Factor: ${analysis.summary.profitFactor.toFixed(2)}\n`;
        markdown += `Expectancy: ${this.formatCurrency(analysis.summary.expectancy)}\n`;
      }

      if (config.includeRisk && customData.returns) {
        markdown += this.createSectionHeader('RISK ANALYSIS');
        const sharpe = this.analyticsEngine.calculateSharpeRatio(customData.returns);
        markdown += `Sharpe Ratio: ${sharpe.toFixed(2)}\n`;
      }

      if (config.includePortfolio && customData.portfolio) {
        markdown += this.createSectionHeader('PORTFOLIO');
        const composition = this.portfolioAnalytics.analyzeComposition(customData.portfolio);
        markdown += `Positions: ${composition.numberOfPositions}\n`;
        markdown += `Portfolio Value: ${this.formatCurrency(composition.totalValue)}\n`;
      }

      report.html = markdown;
      this.reports.set(`custom_${Date.now()}`, report);
      this.stats.reportsGenerated++;
      this.stats.lastReport = new Date();

      return report;
    } catch (error) {
      this.stats.errorsEncountered++;
      console.error('Custom report generation error:', error);
      return report;
    }
  }

  // ============================================================================
  // REPORT MANAGEMENT
  // ============================================================================

  /**
   * Get report by ID
   * @param {string} reportId - Report identifier
   * @returns {Object|null} Report or null if not found
   */
  getReport(reportId) {
    return this.reports.get(reportId) || null;
  }

  /**
   * List all generated reports
   * @returns {Array} Array of report summaries
   */
  listReports() {
    const list = [];
    this.reports.forEach((report, id) => {
      list.push({
        id,
        type: report.type,
        timestamp: report.timestamp
      });
    });
    return list;
  }

  /**
   * Get report statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      totalReports: this.reports.size
    };
  }

  /**
   * Clear old reports
   * @param {number} daysOld - Reports older than N days to remove
   */
  clearOldReports(daysOld = 30) {
    const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let removed = 0;

    for (const [id, report] of this.reports.entries()) {
      if (report.timestamp.getTime() < cutoff) {
        this.reports.delete(id);
        removed++;
      }
    }

    return removed;
  }
}

module.exports = GNNReportGenerator;
