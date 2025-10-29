/**
 * Market Data Client
 * Fetches and caches real-time market data from multiple providers
 * @version 1.0.0
 */

const https = require('https');
const crypto = require('crypto');

/**
 * Market Data Client
 * @class MarketDataClient
 * @description Fetches real-time market data with caching
 */
class MarketDataClient {
  /**
   * Initialize Market Data Client
   * @param {Object} config - Configuration object
   * @param {string} config.provider - Data provider ('alpha-vantage' or 'iex-cloud')
   * @param {string} config.apiKey - API key for the provider
   * @param {number} config.cacheTTL - Cache time-to-live in seconds (default: 60)
   * @param {Object} config.logger - Logger instance
   */
  constructor(config = {}) {
    this.provider = config.provider || 'alpha-vantage';
    this.apiKey = config.apiKey;
    this.cacheTTL = config.cacheTTL || 60;
    this.logger = config.logger || console;

    // Data cache
    this.cache = new Map();
    this.priceHistory = new Map();

    // Provider-specific configurations
    this.providers = {
      'alpha-vantage': {
        baseURL: 'www.alphavantage.co',
        endpoints: {
          quote: '/query',
          intraday: '/query'
        }
      },
      'iex-cloud': {
        baseURL: 'cloud.iexapis.com',
        endpoints: {
          quote: '/stable/stock/:symbol/quote',
          intraday: '/stable/stock/:symbol/intraday'
        }
      }
    };

    if (!this.providers[this.provider]) {
      throw new Error(`Unknown provider: ${this.provider}`);
    }

    this.config = this.providers[this.provider];
  }

  /**
   * Get quote for a symbol
   * @param {string} symbol - Stock symbol (e.g., AAPL)
   * @param {boolean} useCache - Use cached data if available (default: true)
   * @returns {Promise<Object>} Quote data
   */
  async getQuote(symbol, useCache = true) {
    try {
      // Check cache
      const cacheKey = `quote_${symbol}`;
      if (useCache && this.isCacheValid(cacheKey)) {
        this.logger.info(`[Cache] Quote hit for ${symbol}`);
        return this.cache.get(cacheKey).data;
      }

      // Fetch from provider
      let quoteData;
      if (this.provider === 'alpha-vantage') {
        quoteData = await this.fetchFromAlphaVantage(symbol, 'quote');
      } else if (this.provider === 'iex-cloud') {
        quoteData = await this.fetchFromIEX(symbol, 'quote');
      }

      // Normalize to common format
      const normalized = this.normalizeQuote(quoteData, this.provider);

      // Cache the result
      this.setCache(cacheKey, normalized);

      // Record price history
      this.recordPriceHistory(symbol, normalized);

      return normalized;
    } catch (error) {
      this.logger.error(`Failed to get quote for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get intraday data for a symbol
   * @param {string} symbol - Stock symbol
   * @param {string} interval - Time interval (1min, 5min, 15min, 30min, 60min)
   * @returns {Promise<Array>} Array of OHLCV data
   */
  async getIntraday(symbol, interval = '5min') {
    try {
      const cacheKey = `intraday_${symbol}_${interval}`;
      if (this.isCacheValid(cacheKey)) {
        this.logger.info(`[Cache] Intraday hit for ${symbol}`);
        return this.cache.get(cacheKey).data;
      }

      let intradayData;
      if (this.provider === 'alpha-vantage') {
        intradayData = await this.fetchIntradayAlphaVantage(symbol, interval);
      } else if (this.provider === 'iex-cloud') {
        intradayData = await this.fetchIntradayIEX(symbol, interval);
      }

      const normalized = this.normalizeIntraday(intradayData, this.provider);
      this.setCache(cacheKey, normalized);

      return normalized;
    } catch (error) {
      this.logger.error(`Failed to get intraday data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple quotes in parallel
   * @param {Array<string>} symbols - Array of symbols
   * @returns {Promise<Object>} Keyed by symbol
   */
  async getQuotes(symbols) {
    const quotes = {};
    const promises = symbols.map(symbol =>
      this.getQuote(symbol)
        .then(quote => { quotes[symbol] = quote; })
        .catch(error => { quotes[symbol] = { error: error.message }; })
    );

    await Promise.all(promises);
    return quotes;
  }

  /**
   * Get price history for a symbol
   * @param {string} symbol - Stock symbol
   * @param {number} limit - Maximum entries (default: 100)
   * @returns {Array} Price history
   */
  getPriceHistory(symbol, limit = 100) {
    const history = this.priceHistory.get(symbol) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Search for symbols
   * @param {string} keywords - Search keywords
   * @returns {Promise<Array>} Search results
   */
  async search(keywords) {
    try {
      if (this.provider === 'alpha-vantage') {
        return await this.searchAlphaVantage(keywords);
      } else if (this.provider === 'iex-cloud') {
        return await this.searchIEX(keywords);
      }
    } catch (error) {
      this.logger.error(`Search failed for ${keywords}:`, error);
      throw error;
    }
  }

  /**
   * Fetch from Alpha Vantage API
   * @private
   */
  async fetchFromAlphaVantage(symbol, type) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        function: type === 'quote' ? 'GLOBAL_QUOTE' : 'TIME_SERIES_INTRADAY',
        symbol: symbol.toUpperCase(),
        apikey: this.apiKey,
        interval: '5min'
      });

      const url = `https://${this.config.baseURL}${this.config.endpoints.quote}?${params}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed['Error Message']) {
              reject(new Error(parsed['Error Message']));
            } else {
              resolve(parsed);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Fetch intraday data from Alpha Vantage
   * @private
   */
  async fetchIntradayAlphaVantage(symbol, interval) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        function: 'TIME_SERIES_INTRADAY',
        symbol: symbol.toUpperCase(),
        interval: interval,
        apikey: this.apiKey
      });

      const url = `https://${this.config.baseURL}${this.config.endpoints.intraday}?${params}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed['Error Message']) {
              reject(new Error(parsed['Error Message']));
            } else {
              resolve(parsed);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Fetch from IEX Cloud API
   * @private
   */
  async fetchFromIEX(symbol, type) {
    return new Promise((resolve, reject) => {
      const endpoint = this.config.endpoints[type].replace(':symbol', symbol.toUpperCase());
      const url = `https://${this.config.baseURL}${endpoint}?token=${this.apiKey}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Fetch intraday data from IEX Cloud
   * @private
   */
  async fetchIntradayIEX(symbol, interval) {
    return new Promise((resolve, reject) => {
      const endpoint = `/stable/stock/${symbol.toUpperCase()}/intraday?token=${this.apiKey}`;
      const url = `https://${this.config.baseURL}${endpoint}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Search symbols on Alpha Vantage
   * @private
   */
  async searchAlphaVantage(keywords) {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        function: 'SYMBOL_SEARCH',
        keywords,
        apikey: this.apiKey
      });

      const url = `https://${this.config.baseURL}/query?${params}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.bestMatches || []);
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Search symbols on IEX Cloud
   * @private
   */
  async searchIEX(keywords) {
    return new Promise((resolve, reject) => {
      const url = `https://${this.config.baseURL}/stable/search?q=${keywords}&token=${this.apiKey}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', reject);
    });
  }

  /**
   * Normalize quote data to common format
   * @private
   */
  normalizeQuote(data, provider) {
    if (provider === 'alpha-vantage') {
      const quote = data['Global Quote'] || {};
      return {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        open: parseFloat(quote['02. open']),
        volume: parseInt(quote['06. volume']),
        timestamp: new Date(),
        source: provider
      };
    } else if (provider === 'iex-cloud') {
      return {
        symbol: data.symbol,
        price: data.latestPrice,
        change: data.change,
        changePercent: data.changePercent,
        high: data.high,
        low: data.low,
        open: data.open,
        volume: data.volume,
        timestamp: new Date(),
        source: provider
      };
    }
  }

  /**
   * Normalize intraday data
   * @private
   */
  normalizeIntraday(data, provider) {
    const result = [];

    if (provider === 'alpha-vantage') {
      const timeSeries = Object.entries(data)
        .find(([key]) => key.startsWith('Time Series'))?.[1] || {};

      for (const [time, ohlc] of Object.entries(timeSeries)) {
        result.push({
          timestamp: new Date(time),
          open: parseFloat(ohlc['1. open']),
          high: parseFloat(ohlc['2. high']),
          low: parseFloat(ohlc['3. low']),
          close: parseFloat(ohlc['4. close']),
          volume: parseInt(ohlc['5. volume'])
        });
      }
    } else if (provider === 'iex-cloud' && Array.isArray(data)) {
      for (const candle of data) {
        result.push({
          timestamp: new Date(candle.date),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        });
      }
    }

    return result.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Record price history
   * @private
   */
  recordPriceHistory(symbol, quote) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol);
    history.push({
      timestamp: quote.timestamp,
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent
    });

    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.shift();
    }
  }

  /**
   * Check if cache is valid
   * @private
   */
  isCacheValid(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = (Date.now() - entry.timestamp) / 1000;
    return age < this.cacheTTL;
  }

  /**
   * Set cache entry
   * @private
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.cacheTTL,
      provider: this.provider,
      priceHistorySymbols: this.priceHistory.size
    };
  }

  /**
   * Validate API key
   * @returns {Promise<boolean>} True if API key is valid
   */
  async validateAPIKey() {
    try {
      const quote = await this.getQuote('AAPL', false);
      return quote && quote.symbol !== undefined;
    } catch (error) {
      return false;
    }
  }
}

module.exports = MarketDataClient;
