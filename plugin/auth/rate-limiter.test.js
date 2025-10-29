/**
 * Rate Limiter Tests
 * @version 1.0.0
 */

const { RateLimiter, createRateLimitMiddleware } = require('./rate-limiter');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      loginWindowMs: 60000,
      maxLoginAttempts: 5
    });
  });

  afterEach(() => {
    limiter.destroy();
  });

  describe('checkRateLimit', () => {
    test('should allow requests within limit', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      const result = limiter.checkRateLimit(req);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('should block requests exceeding limit', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.2' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      // Exceed limit
      for (let i = 0; i < 11; i++) {
        limiter.checkRateLimit(req);
      }

      const result = limiter.checkRateLimit(req);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should include rate limit headers', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.3' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      const result = limiter.checkRateLimit(req);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    test('should handle missing x-forwarded-for header', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
      };

      const result = limiter.checkRateLimit(req);
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkLoginLimit', () => {
    test('should allow login attempts within limit', () => {
      const result = limiter.checkLoginLimit('testuser', '192.168.1.1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test('should lock account after max attempts', () => {
      const identifier = 'testuser2';
      const ip = '192.168.1.2';

      // Exceed max attempts
      for (let i = 0; i < 6; i++) {
        limiter.checkLoginLimit(identifier, ip);
      }

      const result = limiter.checkLoginLimit(identifier, ip);
      expect(result.allowed).toBe(false);
      expect(result.lockedUntil).not.toBeNull();
    });

    test('should reset attempts on successful login', () => {
      const identifier = 'testuser3';
      const ip = '192.168.1.3';

      limiter.checkLoginLimit(identifier, ip);
      limiter.resetLoginAttempts(identifier, ip);

      const result = limiter.checkLoginLimit(identifier, ip);
      expect(result.remaining).toBe(4);
    });

    test('should track by identifier and IP combination', () => {
      // Same user, different IPs - should have separate limits
      const result1 = limiter.checkLoginLimit('testuser4', '192.168.1.4');
      const result2 = limiter.checkLoginLimit('testuser4', '192.168.1.5');

      expect(result1.remaining).toBe(4);
      expect(result2.remaining).toBe(4);
    });
  });

  describe('IP blocking', () => {
    test('should block IP after excessive requests', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.6' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      // Exceed limit by large margin to trigger blocking
      for (let i = 0; i < 21; i++) {
        limiter.checkRateLimit(req);
      }

      const status = limiter.getStatus('192.168.1.6');
      expect(status.isBlocked).toBe(true);
    });

    test('should unblock IP after timeout', (done) => {
      const ip = '192.168.1.7';
      limiter.blockIP(ip, 100); // 100ms

      expect(limiter.isIPBlocked(ip)).toBe(true);

      setTimeout(() => {
        expect(limiter.isIPBlocked(ip)).toBe(false);
        done();
      }, 150);
    });
  });

  describe('cleanup', () => {
    test('should remove expired records', (done) => {
      const limiter2 = new RateLimiter({
        windowMs: 100,
        maxRequests: 10
      });

      const req = {
        headers: { 'x-forwarded-for': '192.168.1.8' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      limiter2.checkRateLimit(req);
      expect(limiter2.requestCounts.size).toBe(1);

      setTimeout(() => {
        limiter2.cleanup();
        expect(limiter2.requestCounts.size).toBe(0);
        limiter2.destroy();
        done();
      }, 150);
    });
  });

  describe('reset', () => {
    test('should clear all records', () => {
      const req = {
        headers: { 'x-forwarded-for': '192.168.1.9' },
        socket: { remoteAddress: '127.0.0.1' }
      };

      limiter.checkRateLimit(req);
      expect(limiter.requestCounts.size).toBeGreaterThan(0);

      limiter.reset();
      expect(limiter.requestCounts.size).toBe(0);
      expect(limiter.loginAttempts.size).toBe(0);
      expect(limiter.blockedIPs.size).toBe(0);
    });
  });
});

describe('createRateLimitMiddleware', () => {
  test('should create middleware function', () => {
    const limiter = new RateLimiter();
    const middleware = createRateLimitMiddleware(limiter);
    expect(typeof middleware).toBe('function');
    limiter.destroy();
  });

  test('middleware should add rate limit headers', () => {
    const limiter = new RateLimiter();
    const middleware = createRateLimitMiddleware(limiter);

    const req = {
      headers: { 'x-forwarded-for': '192.168.1.10' },
      socket: { remoteAddress: '127.0.0.1' }
    };

    const res = {
      headers: {},
      setHeader(key, value) {
        this.headers[key] = value;
      }
    };

    const next = jest.fn();
    middleware(req, res, next);

    expect(res.headers['X-RateLimit-Limit']).toBeDefined();
    expect(res.headers['X-RateLimit-Remaining']).toBeDefined();
    expect(next).toHaveBeenCalled();

    limiter.destroy();
  });
});
