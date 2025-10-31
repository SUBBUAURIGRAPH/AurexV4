/**
 * Analytics API Module
 * REST API and WebSocket handlers for analytics
 * @version 1.0.0
 */

export { AnalyticsService, createAnalyticsService } from './analyticsService';
export { AnalyticsRouter, createAnalyticsRouter } from './analyticsRoutes';
export {
  AnalyticsWebSocket,
  createAnalyticsWebSocket,
  AnalyticsSocketData
} from './analyticsWebSocket';

/**
 * Mount Analytics API to Express app
 */
export function mountAnalyticsAPI(app: any, service?: any): void {
  const { createAnalyticsRouter } = require('./analyticsRoutes');
  const router = createAnalyticsRouter(service);
  app.use('/api/analytics', router);
}
