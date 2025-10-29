/**
 * Portfolio Visualizations
 * Creates various chart data for portfolio analysis
 * @version 1.0.0
 */

/**
 * Portfolio Visualizations
 * @class PortfolioVisualizations
 * @description Generates chart data for portfolio analysis
 */
class PortfolioVisualizations {
  /**
   * Create allocation pie chart data
   * Shows portfolio allocation by position
   * @param {Array<Object>} positions - Array of position objects
   * @returns {Object} Chart.js pie chart data
   */
  static createAllocationChart(positions) {
    if (!Array.isArray(positions) || positions.length === 0) {
      throw new Error('Positions must be non-empty array');
    }

    const totalValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);

    const labels = positions.map(p => p.symbol);
    const data = positions.map(p => (p.marketValue / totalValue) * 100);
    const colors = this.generateColors(positions.length);

    return {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.label}: ${context.parsed}%`;
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create sector allocation chart
   * Shows portfolio allocation by sector
   * @param {Array<Object>} positions - Array of positions with sector info
   * @returns {Object} Chart.js bar chart data
   */
  static createSectorChart(positions) {
    // Group by sector
    const sectorMap = new Map();

    positions.forEach(p => {
      const sector = p.sector || 'Other';
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, 0);
      }
      sectorMap.set(sector, sectorMap.get(sector) + (p.marketValue || 0));
    });

    const labels = Array.from(sectorMap.keys());
    const data = Array.from(sectorMap.values());
    const colors = this.generateColors(labels.length);

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Sector Allocation',
          data,
          backgroundColor: colors,
          borderColor: '#333',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create performance bar chart
   * Shows return % for each position
   * @param {Array<Object>} positions - Array of positions with returns
   * @returns {Object} Chart.js bar chart data
   */
  static createPerformanceChart(positions) {
    const labels = positions.map(p => p.symbol);
    const data = positions.map(p => p.unrealizedPLPercent || 0);
    const colors = data.map(val => val >= 0 ? '#26a69a' : '#ef5350');

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Return %',
          data,
          backgroundColor: colors,
          borderColor: '#333',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toFixed(2) + '%';
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create portfolio value line chart
   * Shows portfolio value over time
   * @param {Array<Object>} history - Array of {date, value} objects
   * @returns {Object} Chart.js line chart data
   */
  static createPortfolioValueChart(history) {
    if (!Array.isArray(history) || history.length === 0) {
      throw new Error('History must be non-empty array');
    }

    const labels = history.map(h => this.formatDate(h.date));
    const values = history.map(h => h.value);

    // Calculate color based on trend
    const startValue = values[0];
    const endValue = values[values.length - 1];
    const lineColor = endValue >= startValue ? '#26a69a' : '#ef5350';

    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Portfolio Value',
          data: values,
          borderColor: lineColor,
          backgroundColor: `${lineColor}20`,
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return '$' + context.parsed.y.toLocaleString();
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create gain/loss comparison chart
   * Shows winners vs losers
   * @param {Array<Object>} positions - Array of positions
   * @returns {Object} Chart.js bar chart data
   */
  static createGainLossChart(positions) {
    const gainers = positions.filter(p => (p.unrealizedPL || 0) >= 0);
    const losers = positions.filter(p => (p.unrealizedPL || 0) < 0);

    const totalGains = gainers.reduce((sum, p) => sum + (p.unrealizedPL || 0), 0);
    const totalLosses = losers.reduce((sum, p) => sum + Math.abs(p.unrealizedPL || 0), 0);

    return {
      type: 'bar',
      data: {
        labels: ['Gains', 'Losses'],
        datasets: [{
          label: 'P&L',
          data: [totalGains, totalLosses],
          backgroundColor: ['#26a69a', '#ef5350'],
          borderColor: '#333',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create risk/return scatter chart
   * Shows risk (volatility) vs return for each position
   * @param {Array<Object>} positions - Array of positions with risk metrics
   * @returns {Object} Chart.js scatter chart data
   */
  static createRiskReturnChart(positions) {
    const data = positions.map(p => ({
      x: p.volatility || 0, // Risk
      y: p.unrealizedPLPercent || 0, // Return
      label: p.symbol,
      value: p.marketValue || 0
    }));

    const colors = data.map(d => d.y >= 0 ? 'rgba(38, 166, 154, 0.6)' : 'rgba(239, 83, 80, 0.6)');

    return {
      type: 'bubble',
      data: {
        datasets: [{
          label: 'Risk vs Return',
          data: data.map(d => ({
            x: d.x,
            y: d.y,
            r: Math.sqrt(d.value / 1000) + 5
          })),
          backgroundColor: colors,
          borderColor: '#333',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = positions[context.dataIndex].symbol;
                return `${label}: ${context.raw.y.toFixed(2)}% return, ${context.raw.x.toFixed(2)}% volatility`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Risk (Volatility %)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Return %'
            }
          }
        }
      }
    };
  }

  /**
   * Create cumulative return chart
   * Shows how portfolio value evolved over time
   * @param {Array<Object>} history - Array of {date, value, invested} objects
   * @returns {Object} Chart.js line chart data
   */
  static createCumulativeReturnChart(history) {
    const labels = history.map(h => this.formatDate(h.date));
    const portfolioValues = history.map(h => h.value);
    const investedAmounts = history.map(h => h.invested || portfolioValues[0]);

    // Calculate cumulative returns
    const returns = portfolioValues.map((val, idx) =>
      investedAmounts[idx] > 0 ? ((val - investedAmounts[idx]) / investedAmounts[idx]) * 100 : 0
    );

    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Cumulative Return %',
          data: returns,
          borderColor: returns[returns.length - 1] >= returns[0] ? '#26a69a' : '#ef5350',
          backgroundColor: 'rgba(38, 166, 154, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.parsed.y.toFixed(2) + '%';
              }
            }
          }
        },
        scales: {
          y: {
            ticks: {
              callback: function(value) {
                return value.toFixed(2) + '%';
              }
            }
          }
        }
      }
    };
  }

  /**
   * Create drawdown chart
   * Shows maximum drawdown from peak
   * @param {Array<Object>} history - Array of {date, value} objects
   * @returns {Object} Chart.js area chart data
   */
  static createDrawdownChart(history) {
    const values = history.map(h => h.value);
    const drawdowns = [];

    let maxValue = values[0];
    for (const value of values) {
      maxValue = Math.max(maxValue, value);
      const drawdown = ((value - maxValue) / maxValue) * 100;
      drawdowns.push(drawdown);
    }

    const labels = history.map(h => this.formatDate(h.date));

    return {
      type: 'area',
      data: {
        labels,
        datasets: [{
          label: 'Drawdown %',
          data: drawdowns,
          borderColor: '#ef5350',
          backgroundColor: 'rgba(239, 83, 80, 0.2)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            max: 0,
            ticks: {
              callback: function(value) {
                return value.toFixed(2) + '%';
              }
            }
          }
        }
      }
    };
  }

  /**
   * Generate colors for charts
   * @private
   */
  static generateColors(count) {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1',
      '#FFA07A', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E2', '#F8B88B',
      '#ABEBC6', '#D5A6BD', '#F9E79F'
    ];

    const result = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  }

  /**
   * Format date for display
   * @private
   */
  static formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  /**
   * Create comprehensive portfolio dashboard data
   * All charts in one call
   * @param {Object} portfolioData - Complete portfolio data
   * @returns {Object} All chart data
   */
  static createDashboard(portfolioData) {
    const {
      positions = [],
      history = [],
      investedAmount = 0
    } = portfolioData;

    return {
      allocation: this.createAllocationChart(positions),
      performance: this.createPerformanceChart(positions),
      portfolioValue: this.createPortfolioValueChart(history),
      cumulativeReturn: this.createCumulativeReturnChart(
        history.map(h => ({ ...h, invested: investedAmount }))
      ),
      gainLoss: this.createGainLossChart(positions),
      drawdown: this.createDrawdownChart(history)
    };
  }
}

module.exports = {
  PortfolioVisualizations
};
