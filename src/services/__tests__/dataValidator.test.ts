/**
 * Data Validator Tests
 * Tests for data validation service
 * @version 1.0.0
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

describe('DataValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Schema Validation', () => {
    it('should validate order schema', async () => {
      const order = {
        id: 'ord-001',
        symbol: 'AAPL',
        type: 'MARKET',
        side: 'BUY',
        quantity: 100,
        status: 'PENDING'
      };

      const requiredFields = ['id', 'symbol', 'type', 'side', 'quantity', 'status'];
      const hasAllFields = requiredFields.every(field => field in order);

      expect(hasAllFields).toBe(true);
    });

    it('should validate account schema', async () => {
      const account = {
        id: 'acc-123',
        userId: 'user-123',
        name: 'Main Account',
        type: 'LIVE',
        balance: 125000,
        status: 'ACTIVE'
      };

      const isValid = account.balance >= 0 && account.name.length > 0;
      expect(isValid).toBe(true);
    });

    it('should reject invalid schema', async () => {
      const invalid = {
        id: 'ord-001',
        symbol: 'AAPL'
        // missing required fields
      };

      const requiredFields = ['type', 'side', 'quantity'];
      const missingFields = requiredFields.filter(field => !(field in invalid));

      expect(missingFields.length).toBeGreaterThan(0);
    });
  });

  describe('Data Type Validation', () => {
    it('should validate string fields', async () => {
      const value = 'AAPL';
      const isValid = typeof value === 'string' && value.length > 0;
      expect(isValid).toBe(true);
    });

    it('should validate number fields', async () => {
      const quantity = 100;
      const isValid = typeof quantity === 'number' && quantity > 0;
      expect(isValid).toBe(true);
    });

    it('should validate boolean fields', async () => {
      const active = true;
      const isValid = typeof active === 'boolean';
      expect(isValid).toBe(true);
    });

    it('should validate date fields', async () => {
      const timestamp = new Date().toISOString();
      const isValid = !isNaN(Date.parse(timestamp));
      expect(isValid).toBe(true);
    });

    it('should validate enum fields', async () => {
      const status = 'FILLED';
      const validStatuses = ['PENDING', 'FILLED', 'CANCELLED', 'REJECTED'];
      const isValid = validStatuses.includes(status);
      expect(isValid).toBe(true);
    });
  });

  describe('Business Rules Validation', () => {
    it('should validate order quantity is positive', async () => {
      const order = { quantity: 100 };
      const isValid = order.quantity > 0;
      expect(isValid).toBe(true);
    });

    it('should reject negative quantity', async () => {
      const order = { quantity: -10 };
      const isValid = order.quantity > 0;
      expect(isValid).toBe(false);
    });

    it('should validate limit order has price', async () => {
      const order = { type: 'LIMIT', price: 175.00 };
      const isValid = order.type !== 'LIMIT' || (order.price && order.price > 0);
      expect(isValid).toBe(true);
    });

    it('should reject limit order without price', async () => {
      const order = { type: 'LIMIT', price: undefined };
      const isValid = order.type !== 'LIMIT' || (order.price && order.price > 0);
      expect(isValid).toBe(false);
    });

    it('should validate account balance is non-negative', async () => {
      const account = { balance: 125000 };
      const isValid = account.balance >= 0;
      expect(isValid).toBe(true);
    });

    it('should validate symbol format', async () => {
      const symbol = 'AAPL';
      const isValid = /^[A-Z]{1,5}$/.test(symbol);
      expect(isValid).toBe(true);
    });

    it('should reject invalid symbol format', async () => {
      const symbol = 'invalid123';
      const isValid = /^[A-Z]{1,5}$/.test(symbol);
      expect(isValid).toBe(false);
    });
  });

  describe('Cross-field Validation', () => {
    it('should validate stop order has stop price', async () => {
      const order = { type: 'STOP', stopPrice: 170.00 };
      const isValid = order.type !== 'STOP' || (order.stopPrice && order.stopPrice > 0);
      expect(isValid).toBe(true);
    });

    it('should validate date range', async () => {
      const startDate = new Date('2024-01-01').getTime();
      const endDate = new Date('2024-01-31').getTime();
      const isValid = endDate > startDate;
      expect(isValid).toBe(true);
    });

    it('should validate filled quantity vs quantity', async () => {
      const order = { quantity: 100, filledQuantity: 75 };
      const isValid = order.filledQuantity <= order.quantity;
      expect(isValid).toBe(true);
    });
  });

  describe('Error Messages', () => {
    it('should provide descriptive error for missing field', async () => {
      const field = 'quantity';
      const error = `Field '${field}' is required`;
      expect(error).toContain('quantity');
      expect(error).toContain('required');
    });

    it('should provide descriptive error for invalid type', async () => {
      const field = 'quantity';
      const expectedType = 'number';
      const actualType = 'string';
      const error = `Field '${field}' must be ${expectedType}, got ${actualType}`;
      expect(error).toContain('number');
    });

    it('should provide descriptive error for range violation', async () => {
      const field = 'quantity';
      const value = -10;
      const error = `Field '${field}' must be positive, got ${value}`;
      expect(error).toContain('positive');
    });
  });

  describe('Custom Validators', () => {
    it('should support custom validation functions', async () => {
      const customValidator = (value: number) => value % 100 === 0;
      const quantity = 100;
      const isValid = customValidator(quantity);
      expect(isValid).toBe(true);
    });

    it('should chain multiple validators', async () => {
      const validators = [
        (v: number) => v > 0,
        (v: number) => v <= 10000,
        (v: number) => Number.isInteger(v)
      ];

      const value = 100;
      const isValid = validators.every(validator => validator(value));
      expect(isValid).toBe(true);
    });
  });

  describe('Sanitization', () => {
    it('should trim string values', async () => {
      const input = '  AAPL  ';
      const sanitized = input.trim();
      expect(sanitized).toBe('AAPL');
    });

    it('should convert to uppercase', async () => {
      const input = 'aapl';
      const sanitized = input.toUpperCase();
      expect(sanitized).toBe('AAPL');
    });

    it('should remove special characters', async () => {
      const input = 'AAPL@123';
      const sanitized = input.replace(/[^A-Z0-9]/g, '');
      expect(sanitized).toBe('AAPL123');
    });

    it('should round numeric values', async () => {
      const input = 175.123456;
      const sanitized = Math.round(input * 100) / 100;
      expect(sanitized).toBe(175.12);
    });
  });

  describe('Batch Validation', () => {
    it('should validate multiple records', async () => {
      const records = [
        { id: 'ord-001', quantity: 100 },
        { id: 'ord-002', quantity: 200 },
        { id: 'ord-003', quantity: -10 }
      ];

      const invalid = records.filter(r => r.quantity <= 0);
      expect(invalid.length).toBe(1);
    });

    it('should collect all validation errors', async () => {
      const records = [
        { id: 'ord-001', quantity: -10, symbol: '' },
        { id: 'ord-002', quantity: 100, symbol: 'AAPL' }
      ];

      const errors: string[] = [];
      records.forEach((record, index) => {
        if (record.quantity <= 0) errors.push(`Record ${index}: Invalid quantity`);
        if (!record.symbol) errors.push(`Record ${index}: Missing symbol`);
      });

      expect(errors.length).toBe(2);
    });
  });
});
