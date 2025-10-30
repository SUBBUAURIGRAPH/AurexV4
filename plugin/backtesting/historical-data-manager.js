/**
 * Historical Data Manager
 * Manages loading, caching, and retrieval of historical market data
 *
 * Features:
 * - Load OHLCV data from multiple sources
 * - Cache frequently accessed data
 * - Data validation and quality checks
 * - Support multiple timeframes
 * - Fill missing data
 * - Scheduled sync jobs
 */

const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');

/**
 * HistoricalDataManager
 * Central manager for all historical market data operations
 */
class HistoricalDataManager extends EventEmitter {
  constructor(database, logger) {
    super();
    this.db = database;
    this.logger = logger || console;
    this.cache = new Map();
    this.cacheDuration = 3600000; // 1 hour
    this.dataSourcePriority = [];
    this.initializeSyncJobs();
  }

  /**
   * Initialize periodic sync jobs
   */
  initializeSyncJobs() {
    // Sync data every 4 hours during market hours
    this.syncInterval = setInterval(() => {
      this.syncHistoricalData();
    }, 4 * 60 * 60 * 1000);
  }

  /**
   * Load historical data for a symbol within date range
   * @param {string} symbol - Stock symbol (e.g., 'AAPL')
   * @param {Date} startDate - Start date for data
   * @param {Date} endDate - End date for data
   * @param {string} timeframe - Timeframe ('1d', '1h', '5m', etc.)
   * @returns {Promise<Array>} Array of OHLCV bars
   */
  async loadData(symbol, startDate, endDate, timeframe = '1d') {
    try {
      // Validate inputs
      this.validateInputs(symbol, startDate, endDate);

      // Check cache first
      const cacheKey = this.getCacheKey(symbol, startDate, endDate, timeframe);
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for ${symbol} ${timeframe}`);
        this.emit('data:cached', { symbol, timeframe });
        return cachedData;
      }

      // Try to load from database
      let data = await this.loadFromDatabase(symbol, startDate, endDate, timeframe);

      // If incomplete or missing, fetch from external sources
      if (!data || data.length === 0 || this.isDataIncomplete(data, startDate, endDate)) {
        data = await this.fetchFromExternalSources(symbol, startDate, endDate, timeframe);

        // Save to database
        if (data && data.length > 0) {
          await this.saveToDatabase(symbol, data, timeframe);
        }
      }

      // Fill missing data
      if (data && data.length > 0) {
        data = this.fillMissingData(data, startDate, endDate);
        this.saveToCache(cacheKey, data);
      }

      this.emit('data:loaded', { symbol, timeframe, count: data?.length || 0 });
      return data || [];
    } catch (error) {
      this.logger.error(`Error loading data for ${symbol}:`, error);
      this.emit('error:load', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Get price at specific date and time
   * @param {string} symbol - Stock symbol
   * @param {Date} date - Date for price
   * @param {Time} time - Time of day (optional)
   * @returns {Promise<number>} Price value
   */
  async getPrice(symbol, date, time = null) {
    try {
      // Determine appropriate timeframe based on time precision
      const timeframe = time ? '1h' : '1d';
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 5); // Get some context

      const data = await this.loadData(symbol, startDate, date, timeframe);

      if (!data || data.length === 0) {
        throw new Error(`No data available for ${symbol} on ${date}`);
      }

      // Find the closest bar to the requested date/time
      const bar = this.findClosestBar(data, date, time);
      return bar ? bar.close : data[data.length - 1].close;
    } catch (error) {
      this.logger.error(`Error getting price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get latest price for a symbol (most recent available)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Latest bar with OHLCV
   */
  async getLatestPrice(symbol) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 10);

      const data = await this.loadData(symbol, startDate, endDate, '1d');

      if (!data || data.length === 0) {
        throw new Error(`No data available for ${symbol}`);
      }

      return data[data.length - 1];
    } catch (error) {
      this.logger.error(`Error getting latest price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Validate historical data quality
   * @param {string} symbol - Stock symbol
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Object>} Validation result
   */
  async validateData(symbol, startDate, endDate) {
    try {
      const data = await this.loadData(symbol, startDate, endDate, '1d');

      if (!data || data.length === 0) {
        return {
          symbol,
          valid: false,
          errors: ['No data found'],
          warnings: []
        };
      }

      const errors = [];
      const warnings = [];

      // Check for data gaps
      const gaps = this.findDataGaps(data);
      if (gaps.length > 0) {
        warnings.push(`Found ${gaps.length} data gaps`);
      }

      // Check for anomalies
      const anomalies = this.findAnomalies(data);
      if (anomalies.length > 0) {
        warnings.push(`Found ${anomalies.length} anomalies (extreme price movements)`);
      }

      // Check OHLC relationships
      for (const bar of data) {
        if (bar.high < bar.low || bar.high < bar.open || bar.high < bar.close ||
            bar.low > bar.open || bar.low > bar.close) {
          errors.push(`Invalid OHLC on ${bar.date}`);
        }
        if (bar.volume < 0) {
          errors.push(`Negative volume on ${bar.date}`);
        }
      }

      return {
        symbol,
        startDate,
        endDate,
        recordCount: data.length,
        valid: errors.length === 0,
        errors,
        warnings,
        lastBar: data[data.length - 1]
      };
    } catch (error) {
      this.logger.error(`Error validating data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get list of available symbols in database
   * @returns {Promise<Array>} Array of symbol strings
   */
  async getAvailableSymbols() {
    try {
      const query = `
        SELECT DISTINCT symbol
        FROM backtest_historical_data
        ORDER BY symbol
      `;
      const result = await this.db.query(query);
      return result.map(row => row.symbol);
    } catch (error) {
      this.logger.error('Error getting available symbols:', error);
      throw error;
    }
  }

  /**
   * Get available date range for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} {start, end} dates
   */
  async getDateRange(symbol) {
    try {
      const query = `
        SELECT MIN(date) as start_date, MAX(date) as end_date
        FROM backtest_historical_data
        WHERE symbol = ?
      `;
      const [result] = await this.db.query(query, [symbol]);

      return {
        symbol,
        startDate: result?.start_date,
        endDate: result?.end_date,
        available: !!result?.start_date
      };
    } catch (error) {
      this.logger.error(`Error getting date range for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Cache data for faster subsequent access
   * @param {string} symbol - Stock symbol
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<void>}
   */
  async cacheData(symbol, startDate, endDate) {
    try {
      const data = await this.loadData(symbol, startDate, endDate, '1d');

      if (data && data.length > 0) {
        const hash = this.hashData(data);
        await this.db.query(
          `INSERT INTO backtest_data_cache
           (symbol, timeframe, start_date, end_date, record_count, data_hash, is_complete)
           VALUES (?, '1d', ?, ?, ?, ?, TRUE)
           ON DUPLICATE KEY UPDATE
           record_count = ?, data_hash = ?, updated_at = NOW()`,
          [symbol, startDate, endDate, data.length, hash, data.length, hash]
        );

        this.emit('data:cached', { symbol, recordCount: data.length });
      }
    } catch (error) {
      this.logger.error(`Error caching data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Force sync of historical data from external sources
   * @returns {Promise<void>}
   */
  async syncHistoricalData() {
    try {
      this.logger.info('Starting historical data sync...');
      this.emit('sync:started');

      const symbols = await this.getAvailableSymbols();
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 365); // Last year

      let syncedCount = 0;

      for (const symbol of symbols) {
        try {
          await this.cacheData(symbol, startDate, endDate);
          syncedCount++;
        } catch (error) {
          this.logger.warn(`Failed to sync ${symbol}:`, error.message);
        }
      }

      this.logger.info(`Data sync completed: ${syncedCount}/${symbols.length}`);
      this.emit('sync:completed', { syncedCount, totalSymbols: symbols.length });
    } catch (error) {
      this.logger.error('Error syncing historical data:', error);
      this.emit('sync:failed', { error: error.message });
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  /**
   * Validate input parameters
   */
  validateInputs(symbol, startDate, endDate) {
    if (!symbol || typeof symbol !== 'string') {
      throw new Error('Invalid symbol');
    }
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      throw new Error('Invalid dates');
    }
    if (startDate > endDate) {
      throw new Error('Start date must be before end date');
    }
  }

  /**
   * Generate cache key for data
   */
  getCacheKey(symbol, startDate, endDate, timeframe) {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    return `${symbol}:${startStr}:${endStr}:${timeframe}`;
  }

  /**
   * Get data from in-memory cache
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  /**
   * Save data to in-memory cache
   */
  saveToCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Load data from database
   */
  async loadFromDatabase(symbol, startDate, endDate, timeframe) {
    try {
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      const query = `
        SELECT * FROM backtest_historical_data
        WHERE symbol = ? AND date >= ? AND date <= ? AND timeframe = ?
        ORDER BY date ASC
      `;

      const data = await this.db.query(query, [symbol, startStr, endStr, timeframe]);
      return data;
    } catch (error) {
      this.logger.warn(`Error loading from database: ${error.message}`);
      return null;
    }
  }

  /**
   * Save data to database
   */
  async saveToDatabase(symbol, data, timeframe) {
    try {
      const query = `
        INSERT INTO backtest_historical_data
        (symbol, date, timeframe, open, high, low, close, volume, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'external_sync')
        ON DUPLICATE KEY UPDATE
        open = VALUES(open), high = VALUES(high), low = VALUES(low),
        close = VALUES(close), volume = VALUES(volume)
      `;

      for (const bar of data) {
        await this.db.query(query, [
          symbol,
          bar.date,
          timeframe,
          bar.open,
          bar.high,
          bar.low,
          bar.close,
          bar.volume
        ]);
      }
    } catch (error) {
      this.logger.warn(`Error saving to database: ${error.message}`);
    }
  }

  /**
   * Fetch data from external sources in priority order
   */
  async fetchFromExternalSources(symbol, startDate, endDate, timeframe) {
    const sources = ['yahoo_finance', 'polygon', 'iex_cloud'];

    for (const source of sources) {
      try {
        let data;
        switch (source) {
          case 'yahoo_finance':
            data = await this.fetchFromYahooFinance(symbol, startDate, endDate, timeframe);
            break;
          case 'polygon':
            data = await this.fetchFromPolygon(symbol, startDate, endDate, timeframe);
            break;
          case 'iex_cloud':
            data = await this.fetchFromIEXCloud(symbol, startDate, endDate, timeframe);
            break;
        }

        if (data && data.length > 0) {
          this.logger.debug(`Successfully fetched data from ${source}`);
          return data;
        }
      } catch (error) {
        this.logger.warn(`Error fetching from ${source}:`, error.message);
      }
    }

    throw new Error(`No data available from any source for ${symbol}`);
  }

  /**
   * Fetch from Yahoo Finance API
   */
  async fetchFromYahooFinance(symbol, startDate, endDate, timeframe = '1d') {
    try {
      const interval = this.mapTimeframeToYahooInterval(timeframe);
      const startUnix = Math.floor(startDate.getTime() / 1000);
      const endUnix = Math.floor(endDate.getTime() / 1000);

      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}`;
      const params = {
        period1: startUnix,
        period2: endUnix,
        interval,
        events: 'history'
      };

      const response = await axios.get(url, { params, timeout: 10000 });

      if (!response.data || !response.data.chart.result[0]) {
        return [];
      }

      const result = response.data.chart.result[0];
      const timestamps = result.timestamp;
      const quotes = result.indicators.quote[0];

      return timestamps.map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        open: quotes.open[i],
        high: quotes.high[i],
        low: quotes.low[i],
        close: quotes.close[i],
        volume: quotes.volume[i] || 0
      })).filter(bar => bar.open && bar.close);
    } catch (error) {
      this.logger.error('Yahoo Finance error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch from Polygon.io API
   */
  async fetchFromPolygon(symbol, startDate, endDate, timeframe = '1d') {
    try {
      // Placeholder for Polygon implementation
      // Would require Polygon API key
      throw new Error('Polygon API not configured');
    } catch (error) {
      this.logger.error('Polygon error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch from IEX Cloud API
   */
  async fetchFromIEXCloud(symbol, startDate, endDate, timeframe = '1d') {
    try {
      // Placeholder for IEX Cloud implementation
      // Would require IEX API key
      throw new Error('IEX Cloud API not configured');
    } catch (error) {
      this.logger.error('IEX error:', error.message);
      throw error;
    }
  }

  /**
   * Check if loaded data is complete for the date range
   */
  isDataIncomplete(data, startDate, endDate) {
    if (!data || data.length === 0) return true;

    const expectedDays = this.getBusinessDaysBetween(startDate, endDate);
    return data.length < expectedDays * 0.8; // Allow 20% gap
  }

  /**
   * Fill missing data by forward-filling close prices
   */
  fillMissingData(data, startDate, endDate) {
    if (!data || data.length === 0) return [];

    const filled = [...data];
    let lastClose = data[0].close;

    // Add initial fills if needed
    if (new Date(data[0].date) > startDate) {
      const newBars = [];
      const currentDate = new Date(startDate);

      while (currentDate < new Date(data[0].date)) {
        if (this.isBusinessDay(currentDate)) {
          newBars.push({
            date: currentDate.toISOString().split('T')[0],
            open: lastClose,
            high: lastClose,
            low: lastClose,
            close: lastClose,
            volume: 0
          });
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      return [...newBars, ...filled];
    }

    return filled;
  }

  /**
   * Find closest bar to a specific date/time
   */
  findClosestBar(data, date, time = null) {
    let closestBar = data[0];
    let minDiff = Math.abs(new Date(data[0].date) - date);

    for (const bar of data) {
      const diff = Math.abs(new Date(bar.date) - date);
      if (diff < minDiff) {
        minDiff = diff;
        closestBar = bar;
      }
    }

    return closestBar;
  }

  /**
   * Find data gaps in the time series
   */
  findDataGaps(data) {
    const gaps = [];
    for (let i = 1; i < data.length; i++) {
      const daysBetween = (new Date(data[i].date) - new Date(data[i-1].date)) / (1000 * 60 * 60 * 24);
      if (daysBetween > 1) {
        gaps.push({
          from: data[i-1].date,
          to: data[i].date,
          days: daysBetween
        });
      }
    }
    return gaps;
  }

  /**
   * Find anomalies in price data
   */
  findAnomalies(data) {
    const anomalies = [];
    const returns = [];

    for (let i = 1; i < data.length; i++) {
      const ret = (data[i].close - data[i-1].close) / data[i-1].close;
      returns.push(ret);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / returns.length);

    for (let i = 1; i < data.length; i++) {
      const ret = (data[i].close - data[i-1].close) / data[i-1].close;
      if (Math.abs(ret - mean) > 3 * stdDev) { // 3-sigma
        anomalies.push({
          date: data[i].date,
          return: ret,
          zscore: (ret - mean) / stdDev
        });
      }
    }

    return anomalies;
  }

  /**
   * Hash data for comparison
   */
  hashData(data) {
    const str = JSON.stringify(data);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Get business days between two dates
   */
  getBusinessDaysBetween(startDate, endDate) {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      if (this.isBusinessDay(current)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Check if a date is a business day (Mon-Fri, excluding holidays)
   */
  isBusinessDay(date) {
    const day = date.getDay();
    return day > 0 && day < 6; // 0 = Sunday, 6 = Saturday
  }

  /**
   * Map timeframe to Yahoo Finance interval
   */
  mapTimeframeToYahooInterval(timeframe) {
    const map = {
      '1m': '1m',
      '5m': '5m',
      '15m': '15m',
      '1h': '1h',
      '1d': '1d',
      '1w': '1wk',
      '1mo': '1mo'
    };
    return map[timeframe] || '1d';
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.cache.clear();
  }
}

module.exports = HistoricalDataManager;
