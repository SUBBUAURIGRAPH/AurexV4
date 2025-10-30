/**
 * Technical Data Processor
 * Extracts technical features from OHLCV data for GNN input
 *
 * Features:
 * - Technical indicator calculation
 * - Pattern recognition
 * - Volatility measures
 * - Momentum analysis
 */

const EventEmitter = require('events');

/**
 * Technical Indicators
 */
const TechnicalIndicators = {
  SMA_5: 'sma_5',
  SMA_20: 'sma_20',
  SMA_50: 'sma_50',
  SMA_200: 'sma_200',
  EMA_12: 'ema_12',
  EMA_26: 'ema_26',
  RSI_14: 'rsi_14',
  MACD: 'macd',
  MACD_SIGNAL: 'macd_signal',
  MACD_HISTOGRAM: 'macd_histogram',
  BOLLINGER_UPPER: 'bollinger_upper',
  BOLLINGER_LOWER: 'bollinger_lower',
  BOLLINGER_MIDDLE: 'bollinger_middle',
  ATR_14: 'atr_14',
  VOLUME_SMA: 'volume_sma'
};

/**
 * Technical Data Processor
 */
class TechnicalDataProcessor extends EventEmitter {
  constructor(config = {}) {
    super();

    this.logger = config.logger || console;
  }

  /**
   * Extract technical features from OHLCV data
   * @param {Array} ohlcvData - Array of OHLCV bars
   * @returns {Promise<Object>} Technical features
   */
  async extractFeatures(ohlcvData) {
    try {
      if (!ohlcvData || ohlcvData.length < 200) {
        throw new Error('Need at least 200 bars of data');
      }

      // Calculate indicators
      const indicators = {
        sma_5: this.calculateSMA(ohlcvData, 5),
        sma_20: this.calculateSMA(ohlcvData, 20),
        sma_50: this.calculateSMA(ohlcvData, 50),
        sma_200: this.calculateSMA(ohlcvData, 200),
        ema_12: this.calculateEMA(ohlcvData, 12),
        ema_26: this.calculateEMA(ohlcvData, 26),
        rsi_14: this.calculateRSI(ohlcvData, 14),
        macd: this.calculateMACD(ohlcvData),
        bollinger: this.calculateBollingerBands(ohlcvData, 20),
        atr: this.calculateATR(ohlcvData, 14),
        volumeSMA: this.calculateVolumeSMA(ohlcvData, 20)
      };

      // Extract current values
      const currentBar = ohlcvData[ohlcvData.length - 1];
      const features = this.extractCurrentFeatures(currentBar, indicators);

      this.logger.debug(`📊 Technical features extracted`);
      this.emit('features:extracted', features);

      return features;
    } catch (error) {
      this.logger.error('Error extracting technical features:', error);
      throw error;
    }
  }

  /**
   * Calculate Simple Moving Average
   * @private
   */
  calculateSMA(data, period) {
    const result = [];

    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((acc, bar) => acc + bar.close, 0);
      result.push(sum / period);
    }

    return result[result.length - 1] || data[data.length - 1].close;
  }

  /**
   * Calculate Exponential Moving Average
   * @private
   */
  calculateEMA(data, period) {
    const k = 2 / (period + 1);
    let ema = data[0].close;

    for (let i = 1; i < data.length; i++) {
      ema = data[i].close * k + ema * (1 - k);
    }

    return ema;
  }

  /**
   * Calculate RSI (Relative Strength Index)
   * @private
   */
  calculateRSI(data, period) {
    const changes = [];

    for (let i = 1; i < data.length; i++) {
      changes.push(data[i].close - data[i - 1].close);
    }

    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    const rs = avgGain / (avgLoss || 1);
    const rsi = 100 - (100 / (1 + rs));

    return Number(rsi.toFixed(2));
  }

  /**
   * Calculate MACD
   * @private
   */
  calculateMACD(data) {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    const macd = ema12 - ema26;

    // Simple MACD signal (simplified)
    const signal = (ema12 + ema26) / 2;
    const histogram = macd - signal;

    return {
      macd: Number(macd.toFixed(4)),
      signal: Number(signal.toFixed(4)),
      histogram: Number(histogram.toFixed(4))
    };
  }

  /**
   * Calculate Bollinger Bands
   * @private
   */
  calculateBollingerBands(data, period, stdDev = 2) {
    const closes = data.slice(-period).map(b => b.close);
    const sma = closes.reduce((a, b) => a + b, 0) / period;

    const variance = closes.reduce((sum, price) => {
      return sum + Math.pow(price - sma, 2);
    }, 0) / period;

    const std = Math.sqrt(variance);

    return {
      upper: Number((sma + (std * stdDev)).toFixed(4)),
      middle: Number(sma.toFixed(4)),
      lower: Number((sma - (std * stdDev)).toFixed(4))
    };
  }

  /**
   * Calculate ATR (Average True Range)
   * @private
   */
  calculateATR(data, period) {
    const trueRanges = [];

    for (let i = 1; i < data.length; i++) {
      const curr = data[i];
      const prev = data[i - 1];

      const tr = Math.max(
        curr.high - curr.low,
        Math.abs(curr.high - prev.close),
        Math.abs(curr.low - prev.close)
      );

      trueRanges.push(tr);
    }

    const atr = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    return Number(atr.toFixed(4));
  }

  /**
   * Calculate Volume SMA
   * @private
   */
  calculateVolumeSMA(data, period) {
    const volumes = data.slice(-period).map(b => b.volume);
    const sma = volumes.reduce((a, b) => a + b, 0) / period;
    return Number(sma.toFixed(0));
  }

  /**
   * Extract current features from indicators
   * @private
   */
  extractCurrentFeatures(currentBar, indicators) {
    const close = currentBar.close;

    return {
      // Price levels
      close: close,
      high: currentBar.high,
      low: currentBar.low,
      open: currentBar.open,
      volume: currentBar.volume,

      // Moving averages
      sma_5: indicators.sma_5,
      sma_20: indicators.sma_20,
      sma_50: indicators.sma_50,
      sma_200: indicators.sma_200,
      ema_12: indicators.ema_12,
      ema_26: indicators.ema_26,

      // MA positions (normalized)
      price_vs_sma20: (close - indicators.sma_20) / indicators.sma_20,
      price_vs_sma50: (close - indicators.sma_50) / indicators.sma_50,
      price_vs_sma200: (close - indicators.sma_200) / indicators.sma_200,

      // Momentum
      rsi_14: indicators.rsi_14,
      macd: indicators.macd.macd,
      macd_signal: indicators.macd.signal,
      macd_histogram: indicators.macd.histogram,

      // Volatility
      bollinger_upper: indicators.bollinger.upper,
      bollinger_lower: indicators.bollinger.lower,
      bollinger_middle: indicators.bollinger.middle,
      bollinger_position: (close - indicators.bollinger.lower) /
                         (indicators.bollinger.upper - indicators.bollinger.lower),
      atr_14: indicators.atr,

      // Volume
      volume_sma: indicators.volumeSMA,
      volume_ratio: currentBar.volume / (indicators.volumeSMA || 1)
    };
  }

  /**
   * Extract GNN features (15-dimensional vector)
   * @param {Array} ohlcvData - OHLCV data
   * @returns {Promise<number[]>} Feature vector
   */
  async extractGNNFeatures(ohlcvData) {
    const features = await this.extractFeatures(ohlcvData);
    const close = features.close;

    return [
      // Trend indicators
      features.rsi_14 / 100,                        // RSI (0-1)
      (features.macd + 5) / 10,                     // MACD (normalized)
      features.price_vs_sma20,                      // Price vs SMA20
      features.price_vs_sma50,                      // Price vs SMA50
      features.price_vs_sma200,                     // Price vs SMA200

      // Volatility
      features.bollinger_position,                  // Bollinger position
      (features.atr_14 / close) * 100,              // ATR as % of price

      // Volume
      features.volume_ratio,                        // Volume vs SMA

      // Price patterns
      (features.high - features.low) / features.close,  // Daily range
      (features.close - features.open) / features.close, // Close vs open

      // Moving average alignment
      (features.sma_5 > features.sma_20 ? 1 : 0),
      (features.sma_20 > features.sma_50 ? 1 : 0),
      (features.sma_50 > features.sma_200 ? 1 : 0),

      // Momentum
      features.macd_histogram > 0 ? 1 : 0,

      // Volatility trend
      (features.atr_14 / (features.sma_20 / 20)) // ATR vs SMA
    ];
  }

  /**
   * Identify technical patterns
   * @param {Array} ohlcvData - OHLCV data
   * @returns {Object} Identified patterns
   */
  identifyPatterns(ohlcvData) {
    const patterns = {
      bullish: [],
      bearish: [],
      neutral: []
    };

    if (ohlcvData.length < 5) {
      return patterns;
    }

    const recent = ohlcvData.slice(-5);

    // Check for uptrend (higher highs, higher lows)
    const uptrend = recent[1].high > recent[0].high &&
                   recent[2].high > recent[1].high &&
                   recent[3].high > recent[2].high &&
                   recent[4].high > recent[3].high;

    if (uptrend) {
      patterns.bullish.push('UPTREND');
    }

    // Check for downtrend
    const downtrend = recent[1].low < recent[0].low &&
                     recent[2].low < recent[1].low &&
                     recent[3].low < recent[2].low &&
                     recent[4].low < recent[3].low;

    if (downtrend) {
      patterns.bearish.push('DOWNTREND');
    }

    // Check for hammer (small body, long lower wick)
    const lastBar = recent[4];
    const bodySize = Math.abs(lastBar.close - lastBar.open);
    const lowerWick = lastBar.open - lastBar.low;
    if (lowerWick > bodySize * 2) {
      patterns.bullish.push('HAMMER');
    }

    return patterns;
  }

  /**
   * Get technical analysis summary
   * @param {Array} ohlcvData - OHLCV data
   * @returns {Promise<string>} Summary
   */
  async getTechnicalSummary(ohlcvData) {
    const features = await this.extractFeatures(ohlcvData);
    const patterns = this.identifyPatterns(ohlcvData);

    let summary = 'Technical Analysis:\n';

    if (features.rsi_14 > 70) {
      summary += '⚠ Overbought (RSI > 70)\n';
    } else if (features.rsi_14 < 30) {
      summary += '💡 Oversold (RSI < 30)\n';
    }

    if (features.macd_histogram > 0) {
      summary += '📈 MACD positive momentum\n';
    } else {
      summary += '📉 MACD negative momentum\n';
    }

    if (features.price_vs_sma20 > 0) {
      summary += '↗ Price above 20-day MA\n';
    } else {
      summary += '↘ Price below 20-day MA\n';
    }

    if (patterns.bullish.length > 0) {
      summary += `✓ Bullish patterns: ${patterns.bullish.join(', ')}\n`;
    }

    if (patterns.bearish.length > 0) {
      summary += `✗ Bearish patterns: ${patterns.bearish.join(', ')}\n`;
    }

    return summary;
  }
}

// Export
module.exports = {
  TechnicalDataProcessor,
  TechnicalIndicators
};
