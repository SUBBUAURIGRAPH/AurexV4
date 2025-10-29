/**
 * Technical Indicators Tests
 * @version 1.0.0
 */

const { TechnicalIndicators, OHLCParser } = require('./technical-indicators');

describe('TechnicalIndicators', () => {
  let indicators;
  const samplePrices = [
    100, 102, 101, 103, 105, 104, 106, 108, 107, 109,
    111, 110, 112, 114, 113, 115, 117, 116, 118, 120,
    119, 121, 123, 122, 124, 126, 125, 127, 129, 128
  ];

  beforeEach(() => {
    indicators = new TechnicalIndicators(samplePrices);
  });

  describe('SMA Calculation', () => {
    test('should calculate SMA correctly', () => {
      const sma20 = indicators.sma(20);

      expect(sma20.length).toBe(samplePrices.length);
      expect(sma20[0]).toBeNull(); // First 19 values should be null
      expect(sma20[19]).not.toBeNull(); // 20th value should exist

      // Verify calculation: sum of first 20 prices / 20
      const manualSMA = samplePrices.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
      expect(Math.abs(sma20[19] - manualSMA)).toBeLessThan(0.01);
    });

    test('should return different SMAs for different periods', () => {
      const sma20 = indicators.sma(20);
      const sma50 = indicators.sma(50);

      expect(sma20[19]).not.toEqual(sma50[19]);
    });

    test('should handle insufficient data', () => {
      const shortData = new TechnicalIndicators([100, 101, 102]);
      const sma20 = shortData.sma(20);

      expect(sma20.every(v => v === null)).toBe(true);
    });

    test('should use cache for repeated calls', () => {
      const sma20First = indicators.sma(20);
      const sma20Second = indicators.sma(20);

      expect(sma20First).toBe(sma20Second); // Same reference
      expect(indicators.cache.has('sma_20')).toBe(true);
    });
  });

  describe('EMA Calculation', () => {
    test('should calculate EMA correctly', () => {
      const ema12 = indicators.ema(12);

      expect(ema12.length).toBe(samplePrices.length);
      expect(ema12[0]).toBeNull();
      expect(ema12[11]).not.toBeNull(); // First EMA at position 11

      // EMA should be smoother than raw prices
      const variance = this.calculateVariance(ema12.filter(v => v !== null));
      expect(variance).toBeGreaterThan(0);
    });

    test('should have EMA > SMA during uptrend', () => {
      const ema12 = indicators.ema(12);
      const sma12 = indicators.sma(12);

      // In strong uptrend, EMA should be higher (more responsive)
      const lastValidIndex = sma12.length - 1;
      if (ema12[lastValidIndex] !== null && sma12[lastValidIndex] !== null) {
        expect(ema12[lastValidIndex]).toBeGreaterThan(sma12[lastValidIndex]);
      }
    });
  });

  describe('RSI Calculation', () => {
    test('should calculate RSI in range 0-100', () => {
      const rsi = indicators.rsi(14);

      const validRSIs = rsi.filter(v => v !== null);
      validRSIs.forEach(val => {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      });
    });

    test('should return high RSI for strong uptrend', () => {
      const uptrend = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115];
      const upIndicators = new TechnicalIndicators(uptrend);
      const rsi = upIndicators.rsi(14);

      const lastRSI = rsi[rsi.length - 1];
      expect(lastRSI).toBeGreaterThan(70); // Overbought
    });

    test('should return low RSI for strong downtrend', () => {
      const downtrend = [150, 149, 148, 147, 146, 145, 144, 143, 142, 141, 140, 139, 138, 137, 136, 135];
      const downIndicators = new TechnicalIndicators(downtrend);
      const rsi = downIndicators.rsi(14);

      const lastRSI = rsi[rsi.length - 1];
      expect(lastRSI).toBeLessThan(30); // Oversold
    });

    test('should have RSI around 50 for neutral market', () => {
      const neutral = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
      const neuIndicators = new TechnicalIndicators(neutral);
      const rsi = neuIndicators.rsi(14);

      const lastRSI = rsi[rsi.length - 1];
      expect(lastRSI).toBeCloseTo(50, 1); // Close to 50
    });
  });

  describe('MACD Calculation', () => {
    test('should calculate MACD with line, signal, and histogram', () => {
      const macd = indicators.macd();

      expect(macd.line).toBeDefined();
      expect(macd.signal).toBeDefined();
      expect(macd.histogram).toBeDefined();

      expect(macd.line.length).toBe(samplePrices.length);
      expect(macd.signal.length).toBe(samplePrices.length);
      expect(macd.histogram.length).toBe(samplePrices.length);
    });

    test('should calculate histogram as line - signal', () => {
      const macd = indicators.macd();

      for (let i = 0; i < macd.line.length; i++) {
        if (macd.line[i] !== null && macd.signal[i] !== null) {
          const expectedHistogram = macd.line[i] - macd.signal[i];
          expect(Math.abs(macd.histogram[i] - expectedHistogram)).toBeLessThan(0.001);
        }
      }
    });

    test('MACD should lag price action', () => {
      // First valid MACD value should be after max period (26)
      const macd = indicators.macd();
      expect(macd.line[25]).toBeNull(); // Position 25 is after 26 data points
    });
  });

  describe('Signal Analysis', () => {
    test('should identify overbought conditions', () => {
      const uptrend = new Array(30).fill(100).map((v, i) => v + i * 2);
      const upIndicators = new TechnicalIndicators(uptrend);
      const signals = upIndicators.getSignals();

      const hasOverbought = signals.signals.some(s => s.type === 'OVERBOUGHT');
      expect(hasOverbought).toBe(true);
    });

    test('should identify oversold conditions', () => {
      const downtrend = new Array(30).fill(150).map((v, i) => v - i * 2);
      const downIndicators = new TechnicalIndicators(downtrend);
      const signals = downIndicators.getSignals();

      const hasOversold = signals.signals.some(s => s.type === 'OVERSOLD');
      expect(hasOversold).toBe(true);
    });

    test('should identify uptrend', () => {
      const uptrend = new Array(30).fill(100).map((v, i) => v + i);
      const upIndicators = new TechnicalIndicators(uptrend);
      const signals = upIndicators.getSignals();

      expect(signals.trend).toBe('UPTREND');
    });

    test('should identify downtrend', () => {
      const downtrend = new Array(30).fill(150).map((v, i) => v - i);
      const downIndicators = new TechnicalIndicators(downtrend);
      const signals = downIndicators.getSignals();

      expect(signals.trend).toBe('DOWNTREND');
    });
  });

  describe('All Indicators', () => {
    test('should calculate all indicators', () => {
      const all = indicators.calculateAll();

      expect(all.sma20).toBeDefined();
      expect(all.sma50).toBeDefined();
      expect(all.sma200).toBeDefined();
      expect(all.ema12).toBeDefined();
      expect(all.ema26).toBeDefined();
      expect(all.rsi14).toBeDefined();
      expect(all.macd).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should calculate indicators quickly for 1000 candles', () => {
      const largeDataset = new Array(1000).fill(100).map((v, i) => v + Math.sin(i / 10) * 10);
      const perfIndicators = new TechnicalIndicators(largeDataset);

      const startTime = Date.now();
      perfIndicators.sma(20);
      perfIndicators.ema(12);
      perfIndicators.rsi(14);
      perfIndicators.macd();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });
  });

  describe('Cache Management', () => {
    test('should cache calculation results', () => {
      expect(indicators.cache.size).toBe(0);

      indicators.sma(20);
      expect(indicators.cache.size).toBe(1);

      indicators.sma(20);
      expect(indicators.cache.size).toBe(1); // Same cache entry

      indicators.sma(50);
      expect(indicators.cache.size).toBe(2);
    });

    test('should clear cache on addPrice', () => {
      indicators.sma(20);
      expect(indicators.cache.size).toBeGreaterThan(0);

      indicators.addPrice(130);
      expect(indicators.cache.size).toBe(0);

      expect(indicators.prices.length).toBe(samplePrices.length + 1);
    });
  });

  describe('Error Handling', () => {
    test('should throw error for non-array prices', () => {
      expect(() => new TechnicalIndicators('not-an-array')).toThrow();
    });

    test('should handle empty array', () => {
      const empty = new TechnicalIndicators([]);
      const sma = empty.sma(20);
      expect(sma).toEqual([]);
    });

    test('should handle single price', () => {
      const single = new TechnicalIndicators([100]);
      const sma = single.sma(20);
      expect(sma[0]).toBeNull();
    });
  });

  describe('Helper Methods', () => {
    test('should return metrics', () => {
      indicators.sma(20);
      indicators.rsi(14);

      const metrics = indicators.getMetrics();
      expect(metrics.dataPoints).toBe(samplePrices.length);
      expect(metrics.cacheSize).toBeGreaterThan(0);
      expect(metrics.cachedIndicators).toContain('sma_20');
      expect(metrics.cachedIndicators).toContain('rsi_14');
    });
  });
});

describe('OHLCParser', () => {
  const ohlcData = [
    { o: 100, h: 105, l: 98, c: 102, v: 1000000 },
    { o: 102, h: 107, l: 101, c: 105, v: 1200000 },
    { o: 105, h: 110, l: 103, c: 108, v: 1100000 },
    { o: 108, h: 112, l: 106, c: 110, v: 1300000 }
  ];

  test('should extract closing prices', () => {
    const closes = OHLCParser.getClosingPrices(ohlcData);
    expect(closes).toEqual([102, 105, 108, 110]);
  });

  test('should extract high prices', () => {
    const highs = OHLCParser.getHighPrices(ohlcData);
    expect(highs).toEqual([105, 107, 110, 112]);
  });

  test('should extract low prices', () => {
    const lows = OHLCParser.getLowPrices(ohlcData);
    expect(lows).toEqual([98, 101, 103, 106]);
  });

  test('should extract open prices', () => {
    const opens = OHLCParser.getOpenPrices(ohlcData);
    expect(opens).toEqual([100, 102, 105, 108]);
  });

  test('should calculate typical prices', () => {
    const typicals = OHLCParser.getTypicalPrices(ohlcData);

    expect(typicals[0]).toBeCloseTo((105 + 98 + 102) / 3, 2);
    expect(typicals[1]).toBeCloseTo((107 + 101 + 105) / 3, 2);
  });

  test('should work with alternative field names', () => {
    const altData = [
      { open: 100, high: 105, low: 98, close: 102 },
      { open: 102, high: 107, low: 101, close: 105 }
    ];

    const closes = OHLCParser.getClosingPrices(altData);
    expect(closes).toEqual([102, 105]);
  });
});

// Helper function for variance calculation
function calculateVariance(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
}

describe('Integration: Indicators with Real Data', () => {
  test('should handle realistic market data', () => {
    // Simulate real market data with volatility
    const prices = [];
    let price = 100;
    for (let i = 0; i < 100; i++) {
      const change = (Math.random() - 0.48) * 2; // Slight bias upward
      price += change;
      prices.push(price);
    }

    const indicators = new TechnicalIndicators(prices);
    const all = indicators.calculateAll();

    // All indicators should be defined
    expect(all.sma20).toBeDefined();
    expect(all.rsi14).toBeDefined();
    expect(all.macd).toBeDefined();

    // Get signals
    const signals = indicators.getSignals();
    expect(signals.trend).toMatch(/UPTREND|DOWNTREND|NEUTRAL/);
  });
});
