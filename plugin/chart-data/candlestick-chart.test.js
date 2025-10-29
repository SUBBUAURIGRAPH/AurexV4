/**
 * Candlestick Chart Tests
 * @version 1.0.0
 */

const { CandlestickChart } = require('./candlestick-chart');

describe('CandlestickChart', () => {
  let chart;
  const sampleOHLCData = [
    { o: 100, h: 105, l: 98, c: 102, v: 1000000, t: new Date('2025-10-01') },
    { o: 102, h: 107, l: 101, c: 105, v: 1200000, t: new Date('2025-10-02') },
    { o: 105, h: 110, l: 103, c: 108, v: 1100000, t: new Date('2025-10-03') },
    { o: 108, h: 112, l: 106, c: 110, v: 1300000, t: new Date('2025-10-04') },
    { o: 110, h: 115, l: 108, c: 112, v: 1500000, t: new Date('2025-10-05') }
  ];

  beforeEach(() => {
    chart = new CandlestickChart({ symbol: 'AAPL', period: '1D' });
    chart.loadData(sampleOHLCData);
  });

  describe('Data Loading', () => {
    test('should load OHLCV data correctly', () => {
      expect(chart.ohlcData.length).toBe(sampleOHLCData.length);
      expect(chart.ohlcData[0].open).toBe(100);
      expect(chart.ohlcData[0].close).toBe(102);
    });

    test('should initialize technical indicators', () => {
      expect(chart.indicators).toBeDefined();
      expect(typeof chart.indicators.sma).toBe('function');
    });

    test('should throw error for invalid data', () => {
      const emptyChart = new CandlestickChart();
      expect(() => emptyChart.loadData([])).toThrow();
      expect(() => emptyChart.loadData('not-an-array')).toThrow();
    });

    test('should add new candles', () => {
      const initialCount = chart.ohlcData.length;
      chart.addCandle({ o: 112, h: 117, l: 110, c: 115, v: 1600000 });

      expect(chart.ohlcData.length).toBe(initialCount + 1);
      expect(chart.ohlcData[initialCount].open).toBe(112);
    });
  });

  describe('Chart Data Formatting', () => {
    test('should format chart data for rendering', () => {
      const chartData = chart.getChartData();

      expect(chartData.labels).toBeDefined();
      expect(chartData.datasets).toBeDefined();
      expect(chartData.datasets.length).toBeGreaterThan(0);
    });

    test('should include candlestick data', () => {
      const chartData = chart.getChartData();
      const candleDataset = chartData.datasets[0];

      expect(candleDataset.label).toContain('OHLC');
      expect(candleDataset.data.length).toBeGreaterThan(0);
      expect(candleDataset.data[0]).toHaveProperty('o');
      expect(candleDataset.data[0]).toHaveProperty('h');
      expect(candleDataset.data[0]).toHaveProperty('l');
      expect(candleDataset.data[0]).toHaveProperty('c');
    });

    test('should include volume data', () => {
      const chartData = chart.getChartData();
      const volumeDataset = chartData.datasets.find(ds => ds.label === 'Volume');

      expect(volumeDataset).toBeDefined();
      expect(volumeDataset.type).toBe('bar');
    });
  });

  describe('Indicator Overlays', () => {
    test('should get SMA indicator data', () => {
      const indicators = chart.getIndicatorData(['sma20']);

      expect(indicators.datasets).toBeDefined();
      expect(indicators.datasets.length).toBeGreaterThan(0);
    });

    test('should get multiple indicators', () => {
      const indicators = chart.getIndicatorData(['sma20', 'sma50', 'ema12']);

      expect(indicators.datasets.length).toBeGreaterThanOrEqual(3);
    });

    test('should get RSI data', () => {
      const rsiData = chart.getRSIData();

      expect(rsiData.labels).toBeDefined();
      expect(rsiData.datasets).toBeDefined();
      expect(rsiData.datasets.some(ds => ds.label === 'RSI 14')).toBe(true);
    });

    test('should get MACD data', () => {
      const macdData = chart.getMACDData();

      expect(macdData.labels).toBeDefined();
      expect(macdData.datasets.some(ds => ds.label === 'MACD Line')).toBe(true);
      expect(macdData.datasets.some(ds => ds.label === 'Signal Line')).toBe(true);
      expect(macdData.datasets.some(ds => ds.label === 'Histogram')).toBe(true);
    });
  });

  describe('Signal Analysis', () => {
    test('should generate trading signals', () => {
      const signals = chart.getSignals();

      expect(signals).toBeDefined();
      expect(signals.trend).toMatch(/UPTREND|DOWNTREND|NEUTRAL/);
    });

    test('should identify signals array', () => {
      const signals = chart.getSignals();
      expect(Array.isArray(signals.signals)).toBe(true);
    });
  });

  describe('Navigation', () => {
    test('should zoom in', () => {
      const initialZoom = chart.viewState.zoomLevel;
      chart.zoomIn();

      expect(chart.viewState.zoomLevel).toBeGreaterThan(initialZoom);
    });

    test('should zoom out', () => {
      chart.zoomIn();
      const zoomedZoom = chart.viewState.zoomLevel;
      chart.zoomOut();

      expect(chart.viewState.zoomLevel).toBeLessThan(zoomedZoom);
    });

    test('should pan left', () => {
      const initialStart = chart.viewState.startIndex;
      chart.panLeft();

      expect(chart.viewState.startIndex).toBeLessThan(initialStart);
    });

    test('should pan right', () => {
      const initialEnd = chart.viewState.endIndex;
      chart.panRight();

      expect(chart.viewState.endIndex).toBeGreaterThanOrEqual(initialEnd);
    });

    test('should reset view', () => {
      chart.zoomIn();
      chart.panLeft();
      chart.resetView();

      expect(chart.viewState.startIndex).toBe(0);
      expect(chart.viewState.zoomLevel).toBe(1.0);
    });
  });

  describe('Price Statistics', () => {
    test('should calculate price stats', () => {
      const stats = chart.getPriceStats();

      expect(stats).toBeDefined();
      expect(stats.highestHigh).toBeGreaterThanOrEqual(112);
      expect(stats.lowestLow).toBeLessThanOrEqual(98);
      expect(stats.averagePrice).toBeGreaterThan(0);
    });

    test('should show price change', () => {
      const stats = chart.getPriceStats();

      expect(stats.priceChange).toBeDefined();
      expect(stats.priceChangePercent).toBeDefined();
    });
  });

  describe('Data Queries', () => {
    test('should get candle by index', () => {
      const candle = chart.getCandle(0);

      expect(candle).toBeDefined();
      expect(candle.open).toBe(100);
    });

    test('should return null for invalid index', () => {
      const candle = chart.getCandle(1000);
      expect(candle).toBeNull();
    });

    test('should get candles by date range', () => {
      const startDate = new Date('2025-10-02');
      const endDate = new Date('2025-10-04');

      const candles = chart.getCandlesByDateRange(startDate, endDate);
      expect(candles.length).toBeGreaterThan(0);
    });
  });

  describe('Export', () => {
    test('should export as JSON', () => {
      const json = chart.export('json');

      expect(typeof json).toBe('string');
      const parsed = JSON.parse(json);
      expect(parsed.symbol).toBe('AAPL');
      expect(parsed.data.length).toBe(sampleOHLCData.length);
    });

    test('should export as CSV', () => {
      const csv = chart.export('csv');

      expect(typeof csv).toBe('string');
      expect(csv).toContain('Date,Open,High,Low,Close,Volume');
      expect(csv.split('\n').length).toBeGreaterThan(1);
    });

    test('should throw error for unsupported format', () => {
      expect(() => chart.export('xml')).toThrow();
    });
  });

  describe('Caching', () => {
    test('should cache chart data', () => {
      chart.getChartData();
      const cacheSize1 = chart.cache.size;

      chart.getChartData();
      const cacheSize2 = chart.cache.size;

      expect(cacheSize2).toBe(cacheSize1);
    });

    test('should clear cache on data changes', () => {
      chart.getChartData();
      expect(chart.cache.size).toBeGreaterThan(0);

      chart.addCandle({ o: 115, h: 120, l: 113, c: 118, v: 1700000 });
      expect(chart.cache.size).toBe(0);
    });
  });

  describe('Metrics', () => {
    test('should return chart metrics', () => {
      const metrics = chart.getMetrics();

      expect(metrics.totalCandles).toBe(sampleOHLCData.length);
      expect(metrics.zoomLevel).toBe(1.0);
      expect(metrics.priceStats).toBeDefined();
    });
  });

  describe('Large Dataset Performance', () => {
    test('should handle 1000+ candles efficiently', () => {
      const largeData = [];
      let price = 100;

      for (let i = 0; i < 1000; i++) {
        const change = (Math.random() - 0.49) * 2;
        price += change;

        largeData.push({
          o: price - Math.random(),
          h: price + Math.random(),
          l: price - Math.random() * 2,
          c: price,
          v: Math.random() * 2000000,
          t: new Date(2025, 0, 1 + i)
        });
      }

      const largeChart = new CandlestickChart({ symbol: 'TEST' });
      const startTime = Date.now();
      largeChart.loadData(largeData);
      largeChart.getChartData();
      largeChart.getIndicatorData(['sma20', 'rsi14']);
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(500); // Should complete in <500ms
    });
  });
});
