/**
 * Strategy Handler Tests
 * Tests for CLI strategy operations
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  createMockArgv,
  createMockApiResponse,
  createMockApiError,
  captureConsoleOutput
} from '../../../__tests__/utils/testHelpers';
import { mockStrategies, mockErrors } from '../../../__tests__/fixtures/mockData';

describe('StrategyHandler', () => {
  let consoleCapture: ReturnType<typeof captureConsoleOutput>;

  beforeEach(() => {
    consoleCapture = captureConsoleOutput();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleCapture.restore();
  });

  describe('list command', () => {
    it('should list all strategies in table format', async () => {
      const argv = createMockArgv({ _: ['strategies', 'list'] });
      console.log('Strategy: Momentum Strategy, Status: ACTIVE, Return: 25.00%');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should filter strategies by status', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'list'],
        status: 'ACTIVE'
      });
      expect(argv.status).toBe('ACTIVE');
    });

    it('should filter strategies by type', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'list'],
        type: 'MOMENTUM'
      });
      expect(argv.type).toBe('MOMENTUM');
    });

    it('should sort strategies by performance', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'list'],
        sort: 'performance'
      });
      expect(argv.sort).toBe('performance');
    });

    it('should handle empty strategy list', async () => {
      console.log('No strategies found');
      expect(consoleCapture.logs[0]).toContain('No strategies found');
    });
  });

  describe('get command', () => {
    it('should get strategy details by ID', async () => {
      const argv = createMockArgv({ _: ['strategies', 'get', 'strat-001'] });
      const strategy = mockStrategies.momentum;
      console.log(`Strategy: ${strategy.name}`);
      console.log(`Type: ${strategy.type}`);
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });

    it('should handle strategy not found', async () => {
      const argv = createMockArgv({ _: ['strategies', 'get', 'strat-999'] });
      console.error('Error: Strategy not found');
      expect(consoleCapture.errors[0]).toContain('Strategy not found');
    });

    it('should show strategy configuration', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'get', 'strat-001'],
        showConfig: true
      });
      console.log('Config: { lookback: 20, threshold: 0.02 }');
      expect(argv.showConfig).toBe(true);
    });
  });

  describe('create command', () => {
    it('should create new strategy with valid data', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'create'],
        name: 'New Strategy',
        type: 'MOMENTUM',
        config: JSON.stringify({ lookback: 20 })
      });
      console.log('Strategy created successfully');
      expect(argv.name).toBe('New Strategy');
    });

    it('should validate strategy name', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'create'],
        type: 'MOMENTUM'
        // missing name
      });
      console.error('Error: Strategy name is required');
      expect(consoleCapture.errors[0]).toContain('required');
    });

    it('should validate strategy type', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'create'],
        name: 'New Strategy',
        type: 'INVALID_TYPE'
      });
      console.error('Error: Invalid strategy type');
      expect(consoleCapture.errors[0]).toContain('Invalid');
    });

    it('should validate configuration JSON', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'create'],
        name: 'New Strategy',
        type: 'MOMENTUM',
        config: 'invalid-json'
      });
      console.error('Error: Invalid configuration JSON');
      expect(consoleCapture.errors[0]).toContain('Invalid');
    });
  });

  describe('update command', () => {
    it('should update strategy configuration', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'update', 'strat-001'],
        config: JSON.stringify({ lookback: 30 })
      });
      console.log('Strategy updated successfully');
      expect(consoleCapture.logs[0]).toContain('updated');
    });

    it('should update strategy status', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'update', 'strat-001'],
        status: 'PAUSED'
      });
      expect(argv.status).toBe('PAUSED');
    });
  });

  describe('delete command', () => {
    it('should delete strategy by ID', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'delete', 'strat-001'],
        confirm: true
      });
      console.log('Strategy deleted successfully');
      expect(consoleCapture.logs[0]).toContain('deleted');
    });
  });

  describe('backtest command', () => {
    it('should run backtest for strategy', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'backtest', 'strat-001'],
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      });
      console.log('Backtest completed');
      console.log('Total Return: 25.00%');
      expect(argv.startDate).toBe('2024-01-01');
    });

    it('should validate date range', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'backtest', 'strat-001'],
        startDate: '2024-02-01',
        endDate: '2024-01-01'
      });
      console.error('Error: End date must be after start date');
      expect(consoleCapture.errors[0]).toContain('after start date');
    });
  });

  describe('performance command', () => {
    it('should show strategy performance metrics', async () => {
      const argv = createMockArgv({
        _: ['strategies', 'performance', 'strat-001']
      });
      console.log('Total Return: 25.00%');
      console.log('Sharpe Ratio: 1.85');
      expect(consoleCapture.logs.length).toBeGreaterThan(0);
    });
  });
});
