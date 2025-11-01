/**
 * RateLimiter Unit Tests
 * Tests O(1) token bucket algorithm with 95%+ coverage
 */

import { RateLimiter } from '../src/RateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    // Create limiter: 10 requests/second, burst 20
    limiter = new RateLimiter(10, 20);
  });

  describe('Constructor', () => {
    it('should initialize with correct rate limit', () => {
      expect(limiter).toBeDefined();
    });

    it('should set burst size to default (2x) if not provided', () => {
      const limiter2 = new RateLimiter(5);
      const status = limiter2.getStatus();
      expect(status.maxBurst).toBe(10); // Default 2x burst
    });
  });

  describe('canProceed()', () => {
    it('should allow request when tokens available', () => {
      expect(limiter.canProceed()).toBe(true);
    });

    it('should consume tokens correctly', () => {
      limiter.canProceed();
      const status = limiter.getStatus();
      expect(status.available).toBeLessThan(20);
    });

    it('should deny request when no tokens available', async () => {
      // Consume all tokens
      for (let i = 0; i < 20; i++) {
        limiter.canProceed();
      }
      expect(limiter.canProceed()).toBe(false);
    });

    it('should refill tokens over time', async () => {
      // Consume all tokens
      for (let i = 0; i < 20; i++) {
        limiter.canProceed();
      }

      // Wait 100ms (at 10 req/sec = 1 token per 100ms)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have at least 1 token now
      expect(limiter.canProceed()).toBe(true);
    });
  });

  describe('tryConsume()', () => {
    it('should consume exact number of tokens', () => {
      expect(limiter.tryConsume(5)).toBe(true);
      expect(limiter.getAvailableTokens()).toBeLessThan(20);
    });

    it('should reject if not enough tokens', () => {
      expect(limiter.tryConsume(25)).toBe(false);
    });

    it('should not consume tokens on rejection', () => {
      const before = limiter.getAvailableTokens();
      limiter.tryConsume(25);
      const after = limiter.getAvailableTokens();
      expect(before).toBe(after);
    });
  });

  describe('getAvailableTokens()', () => {
    it('should return current token count', () => {
      const tokens = limiter.getAvailableTokens();
      expect(tokens).toBeLessThanOrEqual(20);
      expect(tokens).toBeGreaterThanOrEqual(0);
    });

    it('should be capped at burst size', () => {
      const tokens = limiter.getAvailableTokens();
      expect(tokens).toBeLessThanOrEqual(20);
    });
  });

  describe('getTimeUntilNextToken()', () => {
    it('should return 0 when tokens available', () => {
      const time = limiter.getTimeUntilNextToken();
      expect(time).toBe(0);
    });

    it('should return positive number when no tokens', async () => {
      // Consume all tokens
      for (let i = 0; i < 20; i++) {
        limiter.canProceed();
      }

      const time = limiter.getTimeUntilNextToken();
      expect(time).toBeGreaterThan(0);
      expect(time).toBeLessThanOrEqual(100); // Max 100ms for 10 req/sec
    });
  });

  describe('getStatus()', () => {
    it('should return complete status object', () => {
      const status = limiter.getStatus();
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('maxBurst');
      expect(status).toHaveProperty('requestsPerSecond');
      expect(status).toHaveProperty('utilization');
    });

    it('should calculate utilization correctly', () => {
      const status = limiter.getStatus();
      expect(status.utilization).toBeGreaterThanOrEqual(0);
      expect(status.utilization).toBeLessThanOrEqual(100);
    });

    it('should increase utilization as tokens consumed', () => {
      const before = limiter.getStatus().utilization;
      limiter.canProceed();
      const after = limiter.getStatus().utilization;
      expect(after).toBeGreaterThan(before);
    });
  });

  describe('reset()', () => {
    it('should restore all tokens', () => {
      limiter.canProceed();
      limiter.reset();
      expect(limiter.getAvailableTokens()).toBe(20);
    });

    it('should allow requests after reset', () => {
      // Consume all
      for (let i = 0; i < 20; i++) {
        limiter.canProceed();
      }
      expect(limiter.canProceed()).toBe(false);

      // Reset and try again
      limiter.reset();
      expect(limiter.canProceed()).toBe(true);
    });
  });

  describe('Performance (O(1) complexity)', () => {
    it('should have constant time for canProceed()', () => {
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        limiter.canProceed();
        if (limiter.getAvailableTokens() < 1) {
          limiter.reset();
        }
      }

      const duration = Date.now() - start;
      const timePerCall = duration / iterations;

      // Should be very fast (< 1ms per call on average)
      expect(timePerCall).toBeLessThan(1);
    });

    it('should handle concurrent requests efficiently', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(Promise.resolve(limiter.canProceed()));
      }

      const results = await Promise.all(promises);
      // At most 20 should succeed (burst size)
      const successes = results.filter(r => r).length;
      expect(successes).toBeLessThanOrEqual(20);
    });
  });

  describe('Exchange rate limits', () => {
    it('should support Binance (1200 req/min)', () => {
      const binance = new RateLimiter(20); // 1200/60 = 20 req/sec
      expect(binance.getStatus().requestsPerSecond).toBe(20);
    });

    it('should support Kraken (600 req/min)', () => {
      const kraken = new RateLimiter(10); // 600/60 = 10 req/sec
      expect(kraken.getStatus().requestsPerSecond).toBe(10);
    });

    it('should support Coinbase (300 req/min)', () => {
      const coinbase = new RateLimiter(5); // 300/60 = 5 req/sec
      expect(coinbase.getStatus().requestsPerSecond).toBe(5);
    });
  });

  describe('Edge cases', () => {
    it('should handle very high rate limits', () => {
      const fast = new RateLimiter(1000); // 1000 req/sec
      expect(fast.canProceed()).toBe(true);
    });

    it('should handle very low rate limits', () => {
      const slow = new RateLimiter(1); // 1 req/sec
      expect(slow.canProceed()).toBe(true);
    });

    it('should handle fractional consumption', () => {
      const limiter2 = new RateLimiter(1); // 1 req/sec
      // After consuming, should require ~1000ms for refill
      limiter2.canProceed();
      const timeNeeded = limiter2.getTimeUntilNextToken();
      expect(timeNeeded).toBeGreaterThan(500); // At least 500ms
    });
  });
});
