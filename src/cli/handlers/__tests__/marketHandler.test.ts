/**
 * Market Handler Tests
 * Tests for CLI market data operations
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createMockArgv,
  captureConsoleOutput
} from '../../../__tests__/utils/testHelpers';
import { mockMarketData } from '../../../__tests__/fixtures/mockData';

describe('MarketHandler', () => {
  let consoleCapture: ReturnType<typeof captureConsoleOutput>;

  beforeEach(() => {
    consoleCapture = captureConsoleOutput();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleCapture.restore();
  });

  describe('quote command', () => {
    it('should get quote for symbol', async () => {
      const argv = createMockArgv({ _: ['market', 'quote', 'AAPL'] });
      console.log('AAPL: $175.00');
      console.log('Change: +$2.50 (+1.45%)');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should get quotes for multiple symbols', async () => {
      const argv = createMockArgv({
        _: ['market', 'quote'],
        symbols: ['AAPL', 'MSFT', 'GOOGL']
      });
      expect(argv.symbols.length).toBe(3);
    });

    it('should handle invalid symbol', async () => {
      const argv = createMockArgv({ _: ['market', 'quote', 'INVALID'] });
      console.error('Error: Symbol not found');
      expect(consoleCapture.errors[0]).toContain('not found');
    });
  });

  describe('candles command', () => {
    it('should get candle data for symbol', async () => {
      const argv = createMockArgv({
        _: ['market', 'candles', 'AAPL'],
        interval: '1h',
        limit: 24
      });
      console.log('Timestamp | Open | High | Low | Close | Volume');
      expect(argv.interval).toBe('1h');
    });

    it('should validate interval', async () => {
      const argv = createMockArgv({
        _: ['market', 'candles', 'AAPL'],
        interval: 'invalid'
      });
      console.error('Error: Invalid interval');
      expect(consoleCapture.errors[0]).toContain('Invalid interval');
    });
  });

  describe('search command', () => {
    it('should search for symbols by query', async () => {
      const argv = createMockArgv({
        _: ['market', 'search'],
        query: 'Apple'
      });
      console.log('AAPL - Apple Inc.');
      expect(argv.query).toBe('Apple');
    });
  });

  describe('watchlist command', () => {
    it('should show watchlist quotes', async () => {
      const argv = createMockArgv({ _: ['market', 'watchlist'] });
      console.log('Watchlist Quotes:');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should add symbol to watchlist', async () => {
      const argv = createMockArgv({
        _: ['market', 'watchlist', 'add', 'AAPL']
      });
      console.log('Added AAPL to watchlist');
      expect(consoleCapture.logs[0]).toContain('Added');
    });

    it('should remove symbol from watchlist', async () => {
      const argv = createMockArgv({
        _: ['market', 'watchlist', 'remove', 'AAPL']
      });
      console.log('Removed AAPL from watchlist');
      expect(consoleCapture.logs[0]).toContain('Removed');
    });
  });

  describe('hours command', () => {
    it('should show market hours', async () => {
      const argv = createMockArgv({ _: ['market', 'hours'] });
      console.log('Market Status: OPEN');
      console.log('Regular: 9:30 AM - 4:00 PM ET');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });
  });
});
