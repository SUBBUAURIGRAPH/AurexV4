/**
 * Candlestick Chart Component
 * Renders OHLCV data as interactive candlestick charts
 * @version 1.0.0
 */

const { TechnicalIndicators, OHLCParser } = require('./technical-indicators');

/**
 * Candlestick Chart
 * @class CandlestickChart
 * @description Handles candlestick chart rendering and data management
 */
class CandlestickChart {
  /**
   * Initialize candlestick chart
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.symbol = config.symbol || 'UNKNOWN';
    this.period = config.period || '1D'; // 1M, 5M, 15M, 1H, 1D, 1W
    this.theme = config.theme || 'light'; // light, dark
    this.logger = config.logger || console;

    // Data storage
    this.ohlcData = [];
    this.indicators = null;
    this.cache = new Map();

    // Chart configuration
    this.chartConfig = {
      width: config.width || 1200,
      height: config.height || 600,
      padding: config.padding || { top: 20, right: 60, bottom: 40, left: 60 },
      candleWidth: config.candleWidth || 4,
      wickColor: config.wickColor || '#333',
      upColor: config.upColor || '#26a69a',
      downColor: config.downColor || '#ef5350'
    };

    // Interaction state
    this.viewState = {
      startIndex: 0,
      endIndex: null,
      zoomLevel: 1.0,
      hoveredIndex: null,
      selectedIndex: null
    };
  }

  /**
   * Load OHLCV data
   * @param {Array<Object>} ohlcData - Array of {o, h, l, c, v, t} objects
   */
  loadData(ohlcData) {
    if (!Array.isArray(ohlcData) || ohlcData.length === 0) {
      throw new Error('OHLCV data must be non-empty array');
    }

    this.ohlcData = ohlcData.map((candle, index) => ({
      index,
      date: candle.t || candle.date || new Date(),
      open: parseFloat(candle.o || candle.open),
      high: parseFloat(candle.h || candle.high),
      low: parseFloat(candle.l || candle.low),
      close: parseFloat(candle.c || candle.close),
      volume: parseFloat(candle.v || candle.volume || 0)
    }));

    // Initialize technical indicators
    const closes = OHLCParser.getClosingPrices(this.ohlcData);
    this.indicators = new TechnicalIndicators(closes);

    // Reset view state
    this.viewState.endIndex = this.ohlcData.length - 1;
    this.cache.clear();

    this.logger.info(`Loaded ${this.ohlcData.length} candles for ${this.symbol}`);
  }

  /**
   * Add new candle to chart
   * @param {Object} candle - New OHLCV candle
   */
  addCandle(candle) {
    const newCandle = {
      index: this.ohlcData.length,
      date: candle.t || candle.date || new Date(),
      open: parseFloat(candle.o || candle.open),
      high: parseFloat(candle.h || candle.high),
      low: parseFloat(candle.l || candle.low),
      close: parseFloat(candle.c || candle.close),
      volume: parseFloat(candle.v || candle.volume || 0)
    };

    this.ohlcData.push(newCandle);
    this.indicators.addPrice(newCandle.close);
    this.viewState.endIndex = this.ohlcData.length - 1;
    this.cache.clear();
  }

  /**
   * Get candlestick chart data for rendering
   * @returns {Object} Chart data in Chart.js format
   */
  getChartData() {
    const cacheKey = `chart_${this.viewState.startIndex}_${this.viewState.endIndex}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const start = this.viewState.startIndex;
    const end = Math.min(this.viewState.endIndex + 1, this.ohlcData.length);
    const visibleData = this.ohlcData.slice(start, end);

    // Format candlestick data
    const candleData = visibleData.map((candle, idx) => ({
      x: this.formatDate(candle.date),
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close
    }));

    // Format volume data
    const volumeData = visibleData.map((candle, idx) => ({
      x: this.formatDate(candle.date),
      y: candle.volume
    }));

    const chartData = {
      labels: visibleData.map(c => this.formatDate(c.date)),
      datasets: [
        {
          label: `${this.symbol} OHLC`,
          data: candleData,
          borderColor: this.chartConfig.wickColor,
          backgroundColor: this.chartConfig.upColor,
          type: 'candlestick'
        },
        {
          label: 'Volume',
          data: volumeData,
          type: 'bar',
          backgroundColor: this.getVolumeColor(visibleData),
          yAxisID: 'volume'
        }
      ]
    };

    this.cache.set(cacheKey, chartData);
    return chartData;
  }

  /**
   * Get volume bar colors (green for up, red for down)
   * @private
   */
  getVolumeColor(data) {
    return data.map((candle, idx) => {
      if (idx === 0) return this.chartConfig.upColor;
      const prev = data[idx - 1];
      return candle.c >= prev.c ? this.chartConfig.upColor : this.chartConfig.downColor;
    });
  }

  /**
   * Get indicators overlay data
   * @param {Array<string>} indicators - List of indicators to include
   * @returns {Object} Indicator datasets
   */
  getIndicatorData(indicators = ['sma20', 'sma50']) {
    const cacheKey = `indicators_${indicators.join('_')}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const datasets = [];
    const dates = this.ohlcData.map(c => this.formatDate(c.date));

    // SMA 20
    if (indicators.includes('sma20')) {
      const sma20 = this.indicators.sma(20);
      datasets.push({
        label: 'SMA 20',
        data: sma20,
        borderColor: '#FF9900',
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        type: 'line'
      });
    }

    // SMA 50
    if (indicators.includes('sma50')) {
      const sma50 = this.indicators.sma(50);
      datasets.push({
        label: 'SMA 50',
        data: sma50,
        borderColor: '#0099FF',
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        type: 'line'
      });
    }

    // SMA 200
    if (indicators.includes('sma200')) {
      const sma200 = this.indicators.sma(200);
      datasets.push({
        label: 'SMA 200',
        data: sma200,
        borderColor: '#FF3333',
        borderWidth: 1,
        fill: false,
        pointRadius: 0,
        type: 'line'
      });
    }

    // EMA 12
    if (indicators.includes('ema12')) {
      const ema12 = this.indicators.ema(12);
      datasets.push({
        label: 'EMA 12',
        data: ema12,
        borderColor: '#9966FF',
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
        type: 'line',
        borderDash: [5, 5]
      });
    }

    const result = { datasets, dates };
    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get RSI indicator data
   * @returns {Object} RSI dataset
   */
  getRSIData() {
    const cacheKey = 'rsi_data';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const rsi = this.indicators.rsi(14);
    const dates = this.ohlcData.map(c => this.formatDate(c.date));

    const result = {
      labels: dates,
      datasets: [
        {
          label: 'RSI 14',
          data: rsi,
          borderColor: '#FF6B6B',
          backgroundColor: 'rgba(255, 107, 107, 0.1)',
          borderWidth: 2,
          fill: true
        },
        {
          label: 'Overbought (70)',
          data: new Array(rsi.length).fill(70),
          borderColor: '#FF0000',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Oversold (30)',
          data: new Array(rsi.length).fill(30),
          borderColor: '#00FF00',
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0
        }
      ]
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get MACD indicator data
   * @returns {Object} MACD datasets
   */
  getMACDData() {
    const cacheKey = 'macd_data';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const macd = this.indicators.macd();
    const dates = this.ohlcData.map(c => this.formatDate(c.date));

    // Get colors for histogram
    const histogramColors = macd.histogram.map((val, idx) => {
      if (val === null) return 'rgba(0, 0, 0, 0)';
      return val > 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)';
    });

    const result = {
      labels: dates,
      datasets: [
        {
          label: 'MACD Line',
          data: macd.line,
          borderColor: '#3F51B5',
          borderWidth: 2,
          fill: false,
          pointRadius: 0
        },
        {
          label: 'Signal Line',
          data: macd.signal,
          borderColor: '#FF9800',
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          borderDash: [5, 5]
        },
        {
          label: 'Histogram',
          data: macd.histogram,
          type: 'bar',
          backgroundColor: histogramColors,
          borderColor: 'transparent'
        }
      ]
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * Get signal analysis
   * @returns {Object} Trading signals
   */
  getSignals() {
    return this.indicators.getSignals();
  }

  /**
   * Zoom in (increase detail)
   */
  zoomIn() {
    const range = this.viewState.endIndex - this.viewState.startIndex;
    const newRange = Math.max(10, Math.floor(range * 0.7));
    const diff = range - newRange;

    this.viewState.startIndex = Math.max(0, this.viewState.startIndex + Math.floor(diff / 2));
    this.viewState.endIndex = Math.min(
      this.ohlcData.length - 1,
      this.viewState.endIndex - Math.ceil(diff / 2)
    );

    this.viewState.zoomLevel *= 1.3;
    this.cache.clear();
  }

  /**
   * Zoom out (decrease detail)
   */
  zoomOut() {
    const range = this.viewState.endIndex - this.viewState.startIndex;
    const newRange = Math.min(this.ohlcData.length - 1, Math.ceil(range / 0.7));
    const diff = newRange - range;

    this.viewState.startIndex = Math.max(0, this.viewState.startIndex - Math.floor(diff / 2));
    this.viewState.endIndex = Math.min(
      this.ohlcData.length - 1,
      this.viewState.endIndex + Math.ceil(diff / 2)
    );

    this.viewState.zoomLevel /= 1.3;
    this.cache.clear();
  }

  /**
   * Pan left (show older data)
   */
  panLeft() {
    const range = this.viewState.endIndex - this.viewState.startIndex;
    const shift = Math.floor(range * 0.25);

    this.viewState.startIndex = Math.max(0, this.viewState.startIndex - shift);
    this.viewState.endIndex = Math.max(range, this.viewState.startIndex + range);

    this.cache.clear();
  }

  /**
   * Pan right (show newer data)
   */
  panRight() {
    const range = this.viewState.endIndex - this.viewState.startIndex;
    const shift = Math.floor(range * 0.25);

    this.viewState.endIndex = Math.min(this.ohlcData.length - 1, this.viewState.endIndex + shift);
    this.viewState.startIndex = Math.max(0, this.viewState.endIndex - range);

    this.cache.clear();
  }

  /**
   * Reset view to show all data
   */
  resetView() {
    this.viewState.startIndex = 0;
    this.viewState.endIndex = this.ohlcData.length - 1;
    this.viewState.zoomLevel = 1.0;
    this.cache.clear();
  }

  /**
   * Get price statistics
   * @returns {Object} Min, max, average prices
   */
  getPriceStats() {
    if (this.ohlcData.length === 0) {
      return null;
    }

    const closes = this.ohlcData.map(c => c.close);
    const opens = this.ohlcData.map(c => c.open);
    const highs = this.ohlcData.map(c => c.high);
    const lows = this.ohlcData.map(c => c.low);

    return {
      highestHigh: Math.max(...highs),
      lowestLow: Math.min(...lows),
      averagePrice: closes.reduce((a, b) => a + b, 0) / closes.length,
      lastClose: closes[closes.length - 1],
      lastOpen: opens[opens.length - 1],
      priceChange: closes[closes.length - 1] - closes[0],
      priceChangePercent: ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
    };
  }

  /**
   * Get candle at index
   * @param {number} index - Candle index
   * @returns {Object} Candle data
   */
  getCandle(index) {
    if (index < 0 || index >= this.ohlcData.length) {
      return null;
    }
    return this.ohlcData[index];
  }

  /**
   * Find candles by date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Array} Matching candles
   */
  getCandlesByDateRange(startDate, endDate) {
    return this.ohlcData.filter(
      c => c.date >= startDate && c.date <= endDate
    );
  }

  /**
   * Format date for display
   * @private
   */
  formatDate(date) {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    if (this.period === '1D' || this.period === '1W') {
      return `${year}-${month}-${day}`;
    } else {
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
  }

  /**
   * Export chart data
   * @param {string} format - Format (json, csv)
   * @returns {string} Exported data
   */
  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify({
        symbol: this.symbol,
        period: this.period,
        count: this.ohlcData.length,
        data: this.ohlcData
      }, null, 2);
    }

    if (format === 'csv') {
      const headers = 'Date,Open,High,Low,Close,Volume';
      const rows = this.ohlcData.map(c =>
        `${c.date},${c.open},${c.high},${c.low},${c.close},${c.volume}`
      );
      return [headers, ...rows].join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Get chart metrics
   * @returns {Object} Metrics
   */
  getMetrics() {
    return {
      totalCandles: this.ohlcData.length,
      visibleCandles: this.viewState.endIndex - this.viewState.startIndex + 1,
      zoomLevel: this.viewState.zoomLevel,
      cacheSize: this.cache.size,
      priceStats: this.getPriceStats(),
      signals: this.getSignals()
    };
  }
}

module.exports = {
  CandlestickChart
};
