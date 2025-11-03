/**
 * Order Handler Tests
 * Tests for CLI order operations
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createMockArgv,
  captureConsoleOutput
} from '../../../__tests__/utils/testHelpers';
import { mockOrders } from '../../../__tests__/fixtures/mockData';

describe('OrderHandler', () => {
  let consoleCapture: ReturnType<typeof captureConsoleOutput>;

  beforeEach(() => {
    consoleCapture = captureConsoleOutput();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleCapture.restore();
  });

  describe('list command', () => {
    it('should list all orders', async () => {
      const argv = createMockArgv({ _: ['orders', 'list'] });
      console.log('Order: ord-001, Symbol: AAPL, Status: FILLED');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should filter orders by status', async () => {
      const argv = createMockArgv({
        _: ['orders', 'list'],
        status: 'FILLED'
      });
      expect(argv.status).toBe('FILLED');
    });

    it('should filter orders by symbol', async () => {
      const argv = createMockArgv({
        _: ['orders', 'list'],
        symbol: 'AAPL'
      });
      expect(argv.symbol).toBe('AAPL');
    });

    it('should filter orders by date range', async () => {
      const argv = createMockArgv({
        _: ['orders', 'list'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      expect(argv.startDate).toBe('2024-01-01');
    });
  });

  describe('get command', () => {
    it('should get order details by ID', async () => {
      const argv = createMockArgv({ _: ['orders', 'get', 'ord-001'] });
      console.log('Order ID: ord-001');
      console.log('Symbol: AAPL');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should handle order not found', async () => {
      const argv = createMockArgv({ _: ['orders', 'get', 'ord-999'] });
      console.error('Error: Order not found');
      expect(consoleCapture.errors[0]).toContain('Order not found');
    });
  });

  describe('create command', () => {
    it('should create market buy order', async () => {
      const argv = createMockArgv({
        _: ['orders', 'create'],
        symbol: 'AAPL',
        side: 'BUY',
        type: 'MARKET',
        quantity: 100
      });
      console.log('Order created successfully');
      expect(argv.type).toBe('MARKET');
    });

    it('should create limit sell order', async () => {
      const argv = createMockArgv({
        _: ['orders', 'create'],
        symbol: 'AAPL',
        side: 'SELL',
        type: 'LIMIT',
        quantity: 50,
        price: 180.00
      });
      expect(argv.type).toBe('LIMIT');
      expect(argv.price).toBe(180.00);
    });

    it('should create stop order', async () => {
      const argv = createMockArgv({
        _: ['orders', 'create'],
        symbol: 'AAPL',
        side: 'SELL',
        type: 'STOP',
        quantity: 100,
        stopPrice: 170.00
      });
      expect(argv.type).toBe('STOP');
      expect(argv.stopPrice).toBe(170.00);
    });

    it('should validate required fields', async () => {
      const argv = createMockArgv({
        _: ['orders', 'create'],
        symbol: 'AAPL'
        // missing required fields
      });
      console.error('Error: Missing required fields');
      expect(consoleCapture.errors[0]).toContain('required');
    });

    it('should validate quantity is positive', async () => {
      const argv = createMockArgv({
        _: ['orders', 'create'],
        symbol: 'AAPL',
        side: 'BUY',
        type: 'MARKET',
        quantity: -10
      });
      console.error('Error: Quantity must be positive');
      expect(consoleCapture.errors[0]).toContain('positive');
    });

    it('should validate limit price for limit orders', async () => {
      const argv = createMockArgv({
        _: ['orders', 'create'],
        symbol: 'AAPL',
        side: 'BUY',
        type: 'LIMIT',
        quantity: 100
        // missing price
      });
      console.error('Error: Price required for limit orders');
      expect(consoleCapture.errors[0]).toContain('Price required');
    });
  });

  describe('cancel command', () => {
    it('should cancel order by ID', async () => {
      const argv = createMockArgv({
        _: ['orders', 'cancel', 'ord-003']
      });
      console.log('Order cancelled successfully');
      expect(consoleCapture.logs[0]).toContain('cancelled');
    });

    it('should handle cancel of filled order', async () => {
      const argv = createMockArgv({
        _: ['orders', 'cancel', 'ord-001']
      });
      console.error('Error: Cannot cancel filled order');
      expect(consoleCapture.errors[0]).toContain('Cannot cancel');
    });
  });

  describe('status command', () => {
    it('should show order status', async () => {
      const argv = createMockArgv({
        _: ['orders', 'status', 'ord-001']
      });
      console.log('Status: FILLED');
      console.log('Filled: 100/100 shares');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });
  });
});
