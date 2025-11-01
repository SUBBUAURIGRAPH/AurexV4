/**
 * Order Validation Tests
 * Comprehensive unit tests for orderValidation utilities
 */

import {
  validateOrder,
  validateField,
  getRequiredFieldsForOrderType,
  getOrderTypeFieldConfig,
  calculateEstimatedCost,
  getOrderDescription,
  OrderInput,
} from '../orderValidation';

// ==================== Test Suites ====================

describe('Order Validation Utilities', () => {
  // ==================== validateOrder Tests ====================

  describe('validateOrder', () => {
    it('should validate a complete market order', () => {
      const order: OrderInput = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should validate a complete limit order', () => {
      const order: OrderInput = {
        symbol: 'GOOGL',
        side: 'sell',
        type: 'limit',
        quantity: 50,
        price: 150.5,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject order with missing symbol', () => {
      const order: Partial<OrderInput> = {
        side: 'buy',
        type: 'market',
        quantity: 100,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'symbol')).toBe(true);
    });

    it('should reject order with invalid symbol', () => {
      const order: Partial<OrderInput> = {
        symbol: 'aapl',
        side: 'buy',
        type: 'market',
        quantity: 100,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'symbol')).toBe(true);
    });

    it('should reject order with missing quantity', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
    });

    it('should reject order with non-integer quantity', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100.5,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
    });

    it('should reject limit order without price', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: 100,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'price')).toBe(true);
    });

    it('should reject stop order without stop price', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'stop',
        quantity: 100,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'stopPrice')).toBe(true);
    });

    it('should reject stop-limit order without both prices', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'stop-limit',
        quantity: 100,
      };

      const result = validateOrder(order);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should warn on suboptimal sell order prices', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'sell',
        type: 'stop-limit',
        quantity: 100,
        stopPrice: 150,
        limitPrice: 140,
      };

      const result = validateOrder(order);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate quantity range correctly', () => {
      const validOrders = [
        { quantity: 1 },
        { quantity: 100 },
        { quantity: 1000000 },
      ];

      validOrders.forEach((partial) => {
        const order: Partial<OrderInput> = {
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          ...partial,
        };
        const result = validateOrder(order);
        expect(result.errors.some((e) => e.field === 'quantity')).toBe(false);
      });
    });

    it('should reject quantity outside valid range', () => {
      const invalidOrders = [
        { quantity: 0 },
        { quantity: 1000001 },
      ];

      invalidOrders.forEach((partial) => {
        const order: Partial<OrderInput> = {
          symbol: 'AAPL',
          side: 'buy',
          type: 'market',
          ...partial,
        };
        const result = validateOrder(order);
        expect(result.errors.some((e) => e.field === 'quantity')).toBe(true);
      });
    });
  });

  // ==================== validateField Tests ====================

  describe('validateField', () => {
    it('should validate symbol field', () => {
      const error = validateField('symbol', 'aapl');
      expect(error).not.toBeNull();

      const valid = validateField('symbol', 'AAPL');
      expect(valid).toBeNull();
    });

    it('should validate quantity field', () => {
      const error = validateField('quantity', 100.5);
      expect(error).not.toBeNull();

      const valid = validateField('quantity', 100);
      expect(valid).toBeNull();
    });

    it('should validate price field based on context', () => {
      const limitContext = { type: 'limit' as const };
      const error = validateField('price', undefined, limitContext);
      expect(error).not.toBeNull();

      const valid = validateField('price', 150.5, limitContext);
      expect(valid).toBeNull();
    });

    it('should validate order type field', () => {
      const error = validateField('type', 'invalid');
      expect(error).not.toBeNull();

      const valid = validateField('type', 'limit');
      expect(valid).toBeNull();
    });
  });

  // ==================== getRequiredFieldsForOrderType Tests ====================

  describe('getRequiredFieldsForOrderType', () => {
    it('should return required fields for market order', () => {
      const fields = getRequiredFieldsForOrderType('market');
      expect(fields).toEqual(['symbol', 'side', 'quantity']);
    });

    it('should return required fields for limit order', () => {
      const fields = getRequiredFieldsForOrderType('limit');
      expect(fields).toContain('price');
    });

    it('should return required fields for stop order', () => {
      const fields = getRequiredFieldsForOrderType('stop');
      expect(fields).toContain('stopPrice');
    });

    it('should return required fields for stop-limit order', () => {
      const fields = getRequiredFieldsForOrderType('stop-limit');
      expect(fields).toContain('stopPrice');
      expect(fields).toContain('limitPrice');
    });

    it('should return required fields for trailing-stop order', () => {
      const fields = getRequiredFieldsForOrderType('trailing-stop');
      expect(fields).toContain('stopPrice');
    });
  });

  // ==================== getOrderTypeFieldConfig Tests ====================

  describe('getOrderTypeFieldConfig', () => {
    it('should hide price fields for market order', () => {
      const config = getOrderTypeFieldConfig('market');
      expect(config.showPrice).toBe(false);
      expect(config.showStopPrice).toBe(false);
      expect(config.showLimitPrice).toBe(false);
    });

    it('should show price field for limit order', () => {
      const config = getOrderTypeFieldConfig('limit');
      expect(config.showPrice).toBe(true);
      expect(config.priceRequired).toBe(true);
      expect(config.showStopPrice).toBe(false);
    });

    it('should show stop price field for stop order', () => {
      const config = getOrderTypeFieldConfig('stop');
      expect(config.showStopPrice).toBe(true);
      expect(config.stopPriceRequired).toBe(true);
      expect(config.showPrice).toBe(false);
    });

    it('should show both price fields for stop-limit order', () => {
      const config = getOrderTypeFieldConfig('stop-limit');
      expect(config.showStopPrice).toBe(true);
      expect(config.showLimitPrice).toBe(true);
      expect(config.stopPriceRequired).toBe(true);
      expect(config.limitPriceRequired).toBe(true);
    });
  });

  // ==================== calculateEstimatedCost Tests ====================

  describe('calculateEstimatedCost', () => {
    it('should calculate cost for limit order', () => {
      const cost = calculateEstimatedCost('limit', 100, 150.5);
      expect(cost).toBe(15050);
    });

    it('should calculate cost for stop order', () => {
      const cost = calculateEstimatedCost('stop', 100, undefined, 140);
      expect(cost).toBe(14000);
    });

    it('should calculate cost for stop-limit order using limit price', () => {
      const cost = calculateEstimatedCost('stop-limit', 100, undefined, 140, 145);
      expect(cost).toBe(14500);
    });

    it('should return 0 for market order', () => {
      const cost = calculateEstimatedCost('market', 100);
      expect(cost).toBe(0);
    });

    it('should return 0 when price is not provided', () => {
      const cost = calculateEstimatedCost('limit', 100);
      expect(cost).toBe(0);
    });

    it('should handle decimal quantities', () => {
      const cost = calculateEstimatedCost('limit', 50, 100.5);
      expect(cost).toBe(5025);
    });
  });

  // ==================== getOrderDescription Tests ====================

  describe('getOrderDescription', () => {
    it('should describe market order', () => {
      const description = getOrderDescription({
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100,
      });
      expect(description).toContain('AAPL');
      expect(description).toContain('market');
    });

    it('should describe limit order', () => {
      const description = getOrderDescription({
        symbol: 'GOOGL',
        side: 'sell',
        type: 'limit',
        quantity: 50,
        price: 150,
      });
      expect(description).toContain('GOOGL');
      expect(description).toContain('sell');
      expect(description).toContain('150');
    });

    it('should describe stop order', () => {
      const description = getOrderDescription({
        symbol: 'MSFT',
        side: 'buy',
        type: 'stop',
        quantity: 75,
        stopPrice: 300,
      });
      expect(description).toContain('MSFT');
      expect(description).toContain('stop');
    });

    it('should describe incomplete order', () => {
      const description = getOrderDescription({
        symbol: 'AAPL',
      });
      expect(description).toBe('Incomplete order');
    });

    it('should describe stop-limit order', () => {
      const description = getOrderDescription({
        symbol: 'TSLA',
        side: 'buy',
        type: 'stop-limit',
        quantity: 25,
        stopPrice: 200,
        limitPrice: 210,
      });
      expect(description).toContain('TSLA');
      expect(description).toContain('stop-limit');
      expect(description).toContain('200');
      expect(description).toContain('210');
    });
  });

  // ==================== Edge Cases ====================

  describe('Edge Cases', () => {
    it('should handle very large quantities', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 999999,
      };
      const result = validateOrder(order);
      expect(result.isValid).toBe(true);
    });

    it('should handle very small prices', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        price: 0.01,
      };
      const result = validateOrder(order);
      expect(result.isValid).toBe(true);
    });

    it('should handle very large prices', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        quantity: 100,
        price: 999999.99,
      };
      const result = validateOrder(order);
      expect(result.isValid).toBe(true);
    });

    it('should handle empty notes', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100,
        notes: '',
      };
      const result = validateOrder(order);
      expect(result.isValid).toBe(true);
    });

    it('should handle very long notes', () => {
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100,
        notes: 'A'.repeat(1000),
      };
      const result = validateOrder(order);
      expect(result.isValid).toBe(true);
    });
  });

  // ==================== Integration Scenarios ====================

  describe('Integration Scenarios', () => {
    it('should validate complete trading workflow', () => {
      // User wants to buy 100 shares of AAPL at market
      const order: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        quantity: 100,
      };

      const validation = validateOrder(order);
      const description = getOrderDescription(order);

      expect(validation.isValid).toBe(true);
      expect(description).toContain('AAPL');
    });

    it('should validate complete limit order workflow', () => {
      // User wants to sell 50 shares at a limit price
      const order: Partial<OrderInput> = {
        symbol: 'GOOGL',
        side: 'sell',
        type: 'limit',
        quantity: 50,
        price: 150.5,
      };

      const validation = validateOrder(order);
      const cost = calculateEstimatedCost(
        order.type as any,
        order.quantity as any,
        order.price
      );

      expect(validation.isValid).toBe(true);
      expect(cost).toBeGreaterThan(0);
    });

    it('should handle order type switching', () => {
      const baseOrder: Partial<OrderInput> = {
        symbol: 'AAPL',
        side: 'buy',
        quantity: 100,
      };

      const types: ('market' | 'limit' | 'stop' | 'stop-limit' | 'trailing-stop')[] = [
        'market',
        'limit',
        'stop',
        'stop-limit',
        'trailing-stop',
      ];

      types.forEach((type) => {
        const config = getOrderTypeFieldConfig(type);
        const requiredFields = getRequiredFieldsForOrderType(type);

        expect(config).toBeDefined();
        expect(requiredFields).toContain('symbol');
      });
    });
  });
});
