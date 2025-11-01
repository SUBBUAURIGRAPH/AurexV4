/**
 * Technical Indicators Calculator
 * Calculates SMA, EMA, RSI, and MACD indicators
 * @version 1.0.0
 */

/**
 * Technical Indicators
 * @class TechnicalIndicators
 * @description Calculates technical analysis indicators for trading
 */
class TechnicalIndicators {
  /**
   * Initialize with price data
   * @param {Array<number>} prices - Array of closing prices [price1, price2, ...]
   * @param {Object} config - Configuration object
   */
  constructor(prices = [], config = {}) {
    if (!Array.isArray(prices)) {
      throw new Error('Prices must be an array of numbers');
    }

    this.prices = prices.map(p => parseFloat(p));
    this.config = {
      smaperiods: config.smaPeriods || [20, 50, 200],
      emaPeriods: config.emaPeriods || [12, 26],
      rsiPeriod: config.rsiPeriod || 14,
      macdFastPeriod: config.macdFastPeriod || 12,
      macdSlowPeriod: config.macdSlowPeriod || 26,
      macdSignalPeriod: config.macdSignalPeriod || 9,
      ...config
    };

    this.cache = new Map();
  }

  /**
   * Add new price data
   * @param {number} price - New closing price
   */
  addPrice(price) {
    this.prices.push(parseFloat(price));
    this.cache.clear(); // Invalidate cache
  }

  /**
   * Calculate Simple Moving Average (SMA)
   * @param {number} period - Number of periods (default: 20)
   * @returns {Array<number>} Array of SMA values (null for insufficient data)
   */
  sma(period = 20) {
    const cacheKey = `sma_${period}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = [];
    for (let i = 0; i < this.prices.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else {
        const slice = this.prices.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Calculate Exponential Moving Average (EMA)
   * @param {number} period - Number of periods (default: 12)
   * @returns {Array<number>} Array of EMA values
   */
  ema(period = 12) {
    const cacheKey = `ema_${period}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const multiplier = 2 / (period + 1);
    const result = [];

    for (let i = 0; i < this.prices.length; i++) {
      if (i < period - 1) {
        // Not enough data, accumulate SMA
        result.push(null);
      } else if (i === period - 1) {
        // First EMA is SMA
        const slice = this.prices.slice(0, period);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        result.push(sma);
      } else {
        // EMA = Price × Multiplier + EMA(previous) × (1 - Multiplier)
        const emaValue = this.prices[i] * multiplier + result[i - 1] * (1 - multiplier);
        result.push(emaValue);
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Calculate Relative Strength Index (RSI)
   * Measures momentum on a scale of 0-100
   * >70 = Overbought, <30 = Oversold
   * @param {number} period - Number of periods (default: 14)
   * @returns {Array<number>} Array of RSI values (0-100)
   */
  rsi(period = 14) {
    const cacheKey = `rsi_${period}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = [];
    const gains = [];
    const losses = [];

    // Calculate price changes
    for (let i = 1; i < this.prices.length; i++) {
      const change = this.prices[i] - this.prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    // Calculate average gains and losses
    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        result.push(null);
      } else if (i === period - 1) {
        // First RSI uses simple average
        const avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      } else {
        // Subsequent RSI uses exponential average
        const prevAvgGain = this.getLastAverageGain(gains, period, i);
        const prevAvgLoss = this.getLastAverageLoss(losses, period, i);

        const avgGain = (prevAvgGain * (period - 1) + gains[i]) / period;
        const avgLoss = (prevAvgLoss * (period - 1) + losses[i]) / period;

        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        result.push(100 - (100 / (1 + rs)));
      }
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get last average gain (internal helper)
   * @private
   */
  getLastAverageGain(gains, period, index) {
    if (index === period - 1) {
      return gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    }

    // Calculate from previous index (simplified)
    const recentGains = gains.slice(index - period + 1, index);
    return recentGains.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Get last average loss (internal helper)
   * @private
   */
  getLastAverageLoss(losses, period, index) {
    if (index === period - 1) {
      return losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    }

    // Calculate from previous index (simplified)
    const recentLosses = losses.slice(index - period + 1, index);
    return recentLosses.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   * Returns MACD line, signal line, and histogram
   * @returns {Object} { line: [], signal: [], histogram: [] }
   */
  macd() {
    const cacheKey = 'macd';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Calculate 12-day and 26-day EMAs
    const ema12 = this.ema(this.config.macdFastPeriod);
    const ema26 = this.ema(this.config.macdSlowPeriod);

    // Calculate MACD line
    const macdLine = [];
    for (let i = 0; i < this.prices.length; i++) {
      if (ema12[i] === null || ema26[i] === null) {
        macdLine.push(null);
      } else {
        macdLine.push(ema12[i] - ema26[i]);
      }
    }

    // Calculate signal line (9-day EMA of MACD line)
    const validMacdLine = macdLine.filter(v => v !== null);
    const tempIndicators = new TechnicalIndicators(validMacdLine);
    const signalLineRaw = tempIndicators.ema(this.config.macdSignalPeriod);

    // Map signal line back to original length
    const signalLine = [];
    let validIndex = 0;
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null) {
        signalLine.push(null);
      } else {
        signalLine.push(signalLineRaw[validIndex] === null ? null : signalLineRaw[validIndex]);
        validIndex++;
      }
    }

    // Calculate histogram
    const histogram = [];
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] === null || signalLine[i] === null) {
        histogram.push(null);
      } else {
        histogram.push(macdLine[i] - signalLine[i]);
      }
    }

    const result = { line: macdLine, signal: signalLine, histogram };
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Calculate all indicators (convenience method)
   * @returns {Object} All indicators: { sma20, sma50, sma200, rsi, macd }
   */
  calculateAll() {
    return {
      sma20: this.sma(20),
      sma50: this.sma(50),
      sma200: this.sma(200),
      ema12: this.ema(12),
      ema26: this.ema(26),
      rsi14: this.rsi(14),
      macd: this.macd()
    };
  }

  /**
   * Get signal analysis based on indicators
   * Returns potential buy/sell signals
   * @returns {Object} { trend, strength, signals: [] }
   */
  getSignals() {
    const sma20 = this.sma(20);
    const sma50 = this.sma(50);
    const rsi = this.rsi(14);
    const macd = this.macd();

    const lastIndex = this.prices.length - 1;
    const signals = [];

    // Golden Cross / Death Cross
    if (lastIndex > 0) {
      const prev20 = sma20[lastIndex - 1];
      const curr20 = sma20[lastIndex];
      const prev50 = sma50[lastIndex - 1];
      const curr50 = sma50[lastIndex];

      if (prev20 !== null && curr20 !== null && prev50 !== null && curr50 !== null) {
        if (prev20 <= prev50 && curr20 > curr50) {
          signals.push({ type: 'GOLDEN_CROSS', strength: 'STRONG_BUY', description: 'SMA20 crossed above SMA50' });
        } else if (prev20 >= prev50 && curr20 < curr50) {
          signals.push({ type: 'DEATH_CROSS', strength: 'STRONG_SELL', description: 'SMA20 crossed below SMA50' });
        }
      }
    }

    // RSI signals
    const currRSI = rsi[lastIndex];
    if (currRSI !== null) {
      if (currRSI > 70) {
        signals.push({ type: 'OVERBOUGHT', strength: 'SELL', description: 'RSI > 70 (Overbought)' });
      } else if (currRSI < 30) {
        signals.push({ type: 'OVERSOLD', strength: 'BUY', description: 'RSI < 30 (Oversold)' });
      }
    }

    // MACD signals
    const macdLine = macd.line;
    const macdSignal = macd.signal;
    if (lastIndex > 0 && macdLine[lastIndex] !== null && macdSignal[lastIndex] !== null) {
      const prevHist = macdLine[lastIndex - 1] - macdSignal[lastIndex - 1];
      const currHist = macdLine[lastIndex] - macdSignal[lastIndex];

      if (prevHist < 0 && currHist > 0) {
        signals.push({ type: 'MACD_BULLISH', strength: 'BUY', description: 'MACD histogram crossed above zero' });
      } else if (prevHist > 0 && currHist < 0) {
        signals.push({ type: 'MACD_BEARISH', strength: 'SELL', description: 'MACD histogram crossed below zero' });
      }
    }

    // Trend determination
    let trend = 'NEUTRAL';
    if (sma20[lastIndex] !== null && sma50[lastIndex] !== null && sma200[lastIndex] !== null) {
      if (sma20[lastIndex] > sma50[lastIndex] && sma50[lastIndex] > sma200[lastIndex]) {
        trend = 'UPTREND';
      } else if (sma20[lastIndex] < sma50[lastIndex] && sma50[lastIndex] < sma200[lastIndex]) {
        trend = 'DOWNTREND';
      }
    }

    return {
      trend,
      rsiLevel: currRSI,
      macdMomentum: macdLine[lastIndex] - macdSignal[lastIndex],
      signals,
      timestamp: new Date(),
      priceLevel: this.prices[lastIndex]
    };
  }

  /**
   * Clear cache (useful if data changes)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get calculation performance metrics
   * @returns {Object} Performance stats
   */
  getMetrics() {
    return {
      dataPoints: this.prices.length,
      cacheSize: this.cache.size,
      cachedIndicators: Array.from(this.cache.keys())
    };
  }
}

/**
 * OHLC Data Parser
 * Converts OHLCV data to price arrays
 */
class OHLCParser {
  /**
   * Extract closing prices from OHLC data
   * @param {Array<Object>} ohlcData - Array of {o, h, l, c, v} objects
   * @returns {Array<number>} Closing prices
   */
  static getClosingPrices(ohlcData) {
    return ohlcData.map(candle => candle.c || candle.close);
  }

  /**
   * Extract high prices from OHLC data
   */
  static getHighPrices(ohlcData) {
    return ohlcData.map(candle => candle.h || candle.high);
  }

  /**
   * Extract low prices from OHLC data
   */
  static getLowPrices(ohlcData) {
    return ohlcData.map(candle => candle.l || candle.low);
  }

  /**
   * Extract open prices from OHLC data
   */
  static getOpenPrices(ohlcData) {
    return ohlcData.map(candle => candle.o || candle.open);
  }

  /**
   * Calculate typical price (H+L+C)/3
   */
  static getTypicalPrices(ohlcData) {
    return ohlcData.map(candle => {
      const h = candle.h || candle.high;
      const l = candle.l || candle.low;
      const c = candle.c || candle.close;
      return (h + l + c) / 3;
    });
  }
}

module.exports = {
  TechnicalIndicators,
  OHLCParser
};
