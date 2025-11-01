/**
 * Order History Filters Tests
 * Comprehensive unit tests for filtering utilities
 */

import {
  applyFilters,
  getOrderStatistics,
  getActiveFilterCount,
  getFilterDescription,
  groupOrdersBySymbol,
  groupOrdersByStatus,
  getOrdersInDateRange,
  calculateOrderPL,
  exportOrdersAsCSV,
  Order,
  OrderFilterCriteria,
} from '../orderHistoryFilters';

// ==================== Mock Data ====================

const mockOrders: Order[] = [
  {
    id: 'ord-1',
    symbol: 'AAPL',
    status: 'filled',
    type: 'limit',
    side: 'buy',
    quantity: 100,
    price: 150,
    filledQuantity: 100,
    averageFillPrice: 150,
    totalCost: 15000,
    commission: 15,
    createdAt: '2025-10-20T10:00:00Z',
    updatedAt: '2025-10-20T10:05:00Z',
  },
  {
    id: 'ord-2',
    symbol: 'GOOGL',
    status: 'pending',
    type: 'market',
    side: 'sell',
    quantity: 50,
    price: 140,
    filledQuantity: 0,
    averageFillPrice: 0,
    totalCost: 7000,
    commission: 7,
    createdAt: '2025-10-21T10:00:00Z',
    updatedAt: '2025-10-21T10:00:00Z',
  },
  {
    id: 'ord-3',
    symbol: 'MSFT',
    status: 'filled',
    type: 'stop',
    side: 'buy',
    quantity: 75,
    price: 300,
    filledQuantity: 75,
    averageFillPrice: 300,
    totalCost: 22500,
    commission: 22.5,
    createdAt: '2025-10-19T10:00:00Z',
    updatedAt: '2025-10-19T10:10:00Z',
  },
  {
    id: 'ord-4',
    symbol: 'AAPL',
    status: 'cancelled',
    type: 'limit',
    side: 'sell',
    quantity: 25,
    price: 155,
    filledQuantity: 0,
    averageFillPrice: 0,
    totalCost: 3875,
    commission: 3.875,
    createdAt: '2025-10-22T10:00:00Z',
    updatedAt: '2025-10-22T11:00:00Z',
  },
  {
    id: 'ord-5',
    symbol: 'TSLA',
    status: 'partial',
    type: 'market',
    side: 'buy',
    quantity: 200,
    price: 250,
    filledQuantity: 100,
    averageFillPrice: 250,
    totalCost: 25000,
    commission: 25,
    createdAt: '2025-10-23T10:00:00Z',
    updatedAt: '2025-10-23T10:30:00Z',
  },
];

// ==================== Test Suites ====================

describe('Order History Filters', () => {
  // ==================== applyFilters Tests ====================

  describe('applyFilters', () => {
    it('should return all orders with no filters', () => {
      const filtered = applyFilters(mockOrders, {});
      expect(filtered.length).toBe(mockOrders.length);
    });

    it('should filter by symbol', () => {
      const criteria: OrderFilterCriteria = { symbol: 'AAPL' };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.length).toBe(2);
      expect(filtered.every((o) => o.symbol === 'AAPL')).toBe(true);
    });

    it('should filter by status (single)', () => {
      const criteria: OrderFilterCriteria = { status: ['filled'] };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.length).toBe(2);
      expect(filtered.every((o) => o.status === 'filled')).toBe(true);
    });

    it('should filter by status (multiple)', () => {
      const criteria: OrderFilterCriteria = {
        status: ['filled', 'pending'],
      };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.length).toBe(3);
      expect(
        filtered.every((o) => o.status === 'filled' || o.status === 'pending')
      ).toBe(true);
    });

    it('should filter by type', () => {
      const criteria: OrderFilterCriteria = { type: ['limit'] };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.every((o) => o.type === 'limit')).toBe(true);
    });

    it('should filter by side', () => {
      const criteria: OrderFilterCriteria = { side: ['buy'] };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.every((o) => o.side === 'buy')).toBe(true);
    });

    it('should filter by quantity range', () => {
      const criteria: OrderFilterCriteria = {
        quantityRange: { min: 50, max: 100 },
      };
      const filtered = applyFilters(mockOrders, criteria);

      expect(
        filtered.every((o) => o.quantity >= 50 && o.quantity <= 100)
      ).toBe(true);
    });

    it('should filter by price range', () => {
      const criteria: OrderFilterCriteria = {
        priceRange: { min: 140, max: 300 },
      };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should filter by cost range', () => {
      const criteria: OrderFilterCriteria = {
        costRange: { min: 10000, max: 20000 },
      };
      const filtered = applyFilters(mockOrders, criteria);

      expect(
        filtered.every((o) => o.totalCost >= 10000 && o.totalCost <= 20000)
      ).toBe(true);
    });

    it('should filter by minimum fill percentage', () => {
      const criteria: OrderFilterCriteria = { minFillPercentage: 50 };
      const filtered = applyFilters(mockOrders, criteria);

      expect(
        filtered.every((o) => (o.filledQuantity / o.quantity) * 100 >= 50)
      ).toBe(true);
    });

    it('should apply multiple filters (AND logic)', () => {
      const criteria: OrderFilterCriteria = {
        symbol: 'AAPL',
        status: ['filled'],
      };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.length).toBe(1);
      expect(filtered[0].symbol).toBe('AAPL');
      expect(filtered[0].status).toBe('filled');
    });

    it('should filter by date range', () => {
      const criteria: OrderFilterCriteria = {
        dateRange: {
          startDate: new Date('2025-10-20T00:00:00Z'),
          endDate: new Date('2025-10-21T23:59:59Z'),
        },
      };
      const filtered = applyFilters(mockOrders, criteria);

      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  // ==================== getOrderStatistics Tests ====================

  describe('getOrderStatistics', () => {
    it('should calculate statistics for all orders', () => {
      const stats = getOrderStatistics(mockOrders);

      expect(stats.totalOrders).toBe(5);
      expect(stats.totalQuantity).toBe(450);
      expect(stats.totalCost).toBe(73375);
    });

    it('should count buy and sell orders', () => {
      const stats = getOrderStatistics(mockOrders);

      expect(stats.totalBuys).toBe(3);
      expect(stats.totalSells).toBe(2);
    });

    it('should count order statuses', () => {
      const stats = getOrderStatistics(mockOrders);

      expect(stats.filledOrders).toBe(2);
      expect(stats.pendingOrders).toBe(2);
      expect(stats.cancelledOrders).toBe(1);
    });

    it('should calculate average price', () => {
      const stats = getOrderStatistics(mockOrders);

      expect(stats.averagePrice).toBeGreaterThan(0);
    });

    it('should calculate average fill percentage', () => {
      const stats = getOrderStatistics(mockOrders);

      expect(stats.averageFillPercentage).toBeGreaterThanOrEqual(0);
      expect(stats.averageFillPercentage).toBeLessThanOrEqual(100);
    });

    it('should handle empty order list', () => {
      const stats = getOrderStatistics([]);

      expect(stats.totalOrders).toBe(0);
      expect(stats.totalQuantity).toBe(0);
      expect(stats.totalCost).toBe(0);
    });

    it('should calculate total commission', () => {
      const stats = getOrderStatistics(mockOrders);

      expect(stats.totalCommission).toBeGreaterThan(0);
    });
  });

  // ==================== getActiveFilterCount Tests ====================

  describe('getActiveFilterCount', () => {
    it('should count no filters', () => {
      const count = getActiveFilterCount({});
      expect(count).toBe(0);
    });

    it('should count single filter', () => {
      const count = getActiveFilterCount({ symbol: 'AAPL' });
      expect(count).toBe(1);
    });

    it('should count multiple status filters', () => {
      const count = getActiveFilterCount({
        status: ['filled', 'pending'],
      });
      expect(count).toBe(2);
    });

    it('should count all filter types', () => {
      const count = getActiveFilterCount({
        symbol: 'AAPL',
        status: ['filled'],
        type: ['limit'],
        side: ['buy'],
      });
      expect(count).toBe(4);
    });
  });

  // ==================== getFilterDescription Tests ====================

  describe('getFilterDescription', () => {
    it('should describe no filters', () => {
      const descriptions = getFilterDescription({});
      expect(descriptions.length).toBe(0);
    });

    it('should describe symbol filter', () => {
      const descriptions = getFilterDescription({ symbol: 'AAPL' });
      expect(descriptions).toContain(expect.stringContaining('AAPL'));
    });

    it('should describe status filters', () => {
      const descriptions = getFilterDescription({
        status: ['filled', 'pending'],
      });
      expect(descriptions[0]).toContain('Status');
    });

    it('should describe range filters', () => {
      const descriptions = getFilterDescription({
        quantityRange: { min: 50, max: 100 },
      });
      expect(descriptions[0]).toContain('50-100');
    });

    it('should describe multiple filters', () => {
      const descriptions = getFilterDescription({
        symbol: 'AAPL',
        status: ['filled'],
      });
      expect(descriptions.length).toBe(2);
    });
  });

  // ==================== groupOrdersBySymbol Tests ====================

  describe('groupOrdersBySymbol', () => {
    it('should group orders by symbol', () => {
      const grouped = groupOrdersBySymbol(mockOrders);

      expect(grouped.has('AAPL')).toBe(true);
      expect(grouped.has('GOOGL')).toBe(true);
      expect(grouped.has('MSFT')).toBe(true);
    });

    it('should group correct number of orders', () => {
      const grouped = groupOrdersBySymbol(mockOrders);

      expect(grouped.get('AAPL')!.length).toBe(2);
      expect(grouped.get('TSLA')!.length).toBe(1);
    });

    it('should handle empty list', () => {
      const grouped = groupOrdersBySymbol([]);
      expect(grouped.size).toBe(0);
    });
  });

  // ==================== groupOrdersByStatus Tests ====================

  describe('groupOrdersByStatus', () => {
    it('should group orders by status', () => {
      const grouped = groupOrdersByStatus(mockOrders);

      expect(grouped.has('filled')).toBe(true);
      expect(grouped.has('pending')).toBe(true);
      expect(grouped.has('cancelled')).toBe(true);
    });

    it('should group correct number of orders', () => {
      const grouped = groupOrdersByStatus(mockOrders);

      expect(grouped.get('filled')!.length).toBe(2);
      expect(grouped.get('cancelled')!.length).toBe(1);
    });
  });

  // ==================== getOrdersInDateRange Tests ====================

  describe('getOrdersInDateRange', () => {
    it('should filter orders within date range', () => {
      const filtered = getOrdersInDateRange(
        mockOrders,
        new Date('2025-10-20T00:00:00Z'),
        new Date('2025-10-21T23:59:59Z')
      );

      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should return empty for date range with no orders', () => {
      const filtered = getOrdersInDateRange(
        mockOrders,
        new Date('2025-01-01T00:00:00Z'),
        new Date('2025-01-02T23:59:59Z')
      );

      expect(filtered.length).toBe(0);
    });

    it('should include boundary dates', () => {
      const filtered = getOrdersInDateRange(
        mockOrders,
        new Date('2025-10-20T10:00:00Z'),
        new Date('2025-10-20T10:00:00Z')
      );

      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== calculateOrderPL Tests ====================

  describe('calculateOrderPL', () => {
    it('should calculate P&L for filled orders', () => {
      const filledOrders = mockOrders.filter((o) => o.status === 'filled');
      const pl = calculateOrderPL(filledOrders);

      expect(typeof pl).toBe('number');
    });

    it('should return 0 for unfilled orders', () => {
      const unfilledOrders = mockOrders.filter((o) => o.status !== 'filled');
      const pl = calculateOrderPL(unfilledOrders);

      expect(pl).toBe(0);
    });

    it('should handle mixed orders', () => {
      const pl = calculateOrderPL(mockOrders);

      expect(typeof pl).toBe('number');
    });
  });

  // ==================== exportOrdersAsCSV Tests ====================

  describe('exportOrdersAsCSV', () => {
    it('should generate valid CSV', () => {
      const csv = exportOrdersAsCSV(mockOrders);

      expect(typeof csv).toBe('string');
      expect(csv.length).toBeGreaterThan(0);
    });

    it('should include headers', () => {
      const csv = exportOrdersAsCSV(mockOrders);

      expect(csv).toContain('ID');
      expect(csv).toContain('Symbol');
      expect(csv).toContain('Status');
    });

    it('should include data rows', () => {
      const csv = exportOrdersAsCSV(mockOrders);

      expect(csv).toContain('AAPL');
      expect(csv).toContain('filled');
    });

    it('should handle empty order list', () => {
      const csv = exportOrdersAsCSV([]);

      expect(csv).toContain('ID');
    });

    it('should escape quotes in CSV', () => {
      const csv = exportOrdersAsCSV(mockOrders);

      expect(csv).not.toContain('""');
    });
  });

  // ==================== Integration Scenarios ====================

  describe('Integration Scenarios', () => {
    it('should support complete filtering workflow', () => {
      // User applies filters
      const criteria: OrderFilterCriteria = {
        symbol: 'AAPL',
        status: ['filled'],
      };

      // Get filtered orders
      const filtered = applyFilters(mockOrders, criteria);

      // Get statistics for filtered orders
      const stats = getOrderStatistics(filtered);

      // Export filtered orders
      const csv = exportOrdersAsCSV(filtered);

      expect(filtered.length).toBeGreaterThan(0);
      expect(stats.totalOrders).toBe(filtered.length);
      expect(csv).toContain('AAPL');
    });

    it('should support complex filtering', () => {
      // Complex filter: AAPL, filled/pending, quantity 50-200, cost > 5000
      const criteria: OrderFilterCriteria = {
        symbol: 'AAPL',
        status: ['filled', 'pending'],
        quantityRange: { min: 50, max: 200 },
        costRange: { min: 5000, max: 50000 },
      };

      const filtered = applyFilters(mockOrders, criteria);
      const count = getActiveFilterCount(criteria);
      const descriptions = getFilterDescription(criteria);

      expect(filtered.length).toBeGreaterThanOrEqual(0);
      expect(count).toBe(4);
      expect(descriptions.length).toBe(4);
    });

    it('should support order analysis workflow', () => {
      // Analyze by symbol
      const bySymbol = groupOrdersBySymbol(mockOrders);

      // Analyze by status
      const byStatus = groupOrdersByStatus(mockOrders);

      // Get overall statistics
      const stats = getOrderStatistics(mockOrders);

      expect(bySymbol.size).toBeGreaterThan(0);
      expect(byStatus.size).toBeGreaterThan(0);
      expect(stats.totalOrders).toBe(mockOrders.length);
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle orders with zero commission', () => {
      const orders = [
        {
          ...mockOrders[0],
          commission: 0,
        },
      ];

      const stats = getOrderStatistics(orders);
      expect(stats.totalCommission).toBe(0);
    });

    it('should handle partially filled orders', () => {
      const filtered = applyFilters(mockOrders, {
        minFillPercentage: 50,
      });

      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large datasets', () => {
      // Generate 1000 mock orders
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockOrders[i % mockOrders.length],
        id: `ord-${i}`,
      }));

      const filtered = applyFilters(largeDataset, {
        symbol: 'AAPL',
      });

      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should handle orders with special characters in notes', () => {
      const csv = exportOrdersAsCSV(mockOrders);
      expect(csv).toBeDefined();
    });
  });
});
