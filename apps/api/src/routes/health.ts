import { Router, type IRouter } from 'express';

export const healthRouter: IRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'aurexv4-api',
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

healthRouter.get('/ready', (_req, res) => {
  // TODO: check DB, Redis connectivity
  res.json({ ready: true });
});
