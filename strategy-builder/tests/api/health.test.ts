/**
 * Health Check API Tests
 */

import request from 'supertest';
import app from '../../src/server';

describe('Health Check API', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'healthy',
          environment: expect.any(String),
          version: '5.0.0'
        }
      });
    });

    it('should return service status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.data.services).toBeDefined();
      expect(response.body.data.services.database).toBe('connected');
      expect(response.body.data.services.redis).toBe('connected');
    });

    it('should return timestamp', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.data.timestamp).toBeDefined();
      expect(new Date(response.body.data.timestamp)).toBeInstanceOf(Date);
    });
  });
});
