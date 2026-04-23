import { Router, type IRouter } from 'express';
import { prisma } from '@aurex/database';

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

healthRouter.get('/ready', async (_req, res) => {
  let dbReady = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }

  const checks = {
    database: dbReady ? 'up' : 'down',
    cache: process.env.REDIS_URL ? 'configured_not_checked' : 'disabled',
  };

  if (!dbReady) {
    return res.status(503).json({
      ready: false,
      checks,
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    ready: true,
    checks,
    timestamp: new Date().toISOString(),
  });
});
