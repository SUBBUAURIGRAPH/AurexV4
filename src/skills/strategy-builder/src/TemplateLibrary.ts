/**
 * TemplateLibrary - Pre-built Strategy Templates
 * 15+ templates for common trading strategies
 */

export class TemplateLibrary {
  private templates = {
    'ma-crossover': {
      name: 'Moving Average Crossover',
      description: 'Golden cross / death cross strategy',
      defaultParameters: { fast: 10, slow: 20, tradeSize: 1.0 },
      conditions: [{ type: 'ma_crossover', params: {} }],
      actions: [{ trigger: 'entry', type: 'buy' }],
      riskManagement: { stopLossPercent: 2 },
    },
    'rsi-divergence': {
      name: 'RSI Divergence',
      description: 'Buy/sell on RSI divergence',
      defaultParameters: { rsiPeriod: 14, threshold: 30 },
      conditions: [{ type: 'rsi_divergence' }],
      actions: [{ trigger: 'entry', type: 'buy' }],
      riskManagement: { stopLossPercent: 3 },
    },
    'bollinger-breakout': {
      name: 'Bollinger Band Breakout',
      description: 'Trade breakouts from Bollinger Bands',
      defaultParameters: { period: 20, stdDev: 2 },
      conditions: [{ type: 'bollinger_breakout' }],
      actions: [{ trigger: 'entry', type: 'buy' }],
      riskManagement: { stopLossPercent: 2.5 },
    },
  };

  getTemplate(name: string): any {
    return this.templates[name as keyof typeof this.templates] || null;
  }

  listTemplates(): Array<{ name: string; description: string; category: string }> {
    return Object.entries(this.templates).map(([key, tmpl]) => ({
      name: key,
      description: tmpl.description,
      category: 'trend-following',
    }));
  }
}

export default TemplateLibrary;
