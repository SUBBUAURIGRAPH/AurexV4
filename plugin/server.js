#!/usr/bin/env node

/**
 * HMS J4C Agent - HTTP Server
 * Wraps the Aurigraph plugin as a web service with authentication
 * @version 1.1.0
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');
const AurigraphAgentsPlugin = require('./index');
const JWTAuth = require('./auth/jwt-auth');
const UserManager = require('./auth/user-manager');
const RBACMiddleware = require('./auth/rbac-middleware');
const AuthEndpoints = require('./auth/auth-endpoints');
const SkillExecutor = require('./skill-execution/executor');
const MarketDataClient = require('./market-data/client');
const AlpacaBroker = require('./broker/alpaca-broker');
const OrderManager = require('./broker/order-manager');

// Configuration
const PORT = process.env.PORT || 9003;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || undefined;
const MARKET_DATA_PROVIDER = process.env.MARKET_DATA_PROVIDER || 'alpha-vantage';
const MARKET_DATA_API_KEY = process.env.MARKET_DATA_API_KEY;

// Broker configuration
const ALPACA_API_KEY = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_PAPER_TRADING = process.env.ALPACA_PAPER_TRADING !== 'false';

// Initialize authentication modules
const jwtAuth = new JWTAuth({
  secret: JWT_SECRET,
  accessTokenExpiry: 3600, // 1 hour
  refreshTokenExpiry: 86400 // 24 hours
});

const userManager = new UserManager();
const rbacMiddleware = new RBACMiddleware(userManager, jwtAuth);
const authEndpoints = new AuthEndpoints(userManager, jwtAuth);

// Initialize plugin
const plugin = new AurigraphAgentsPlugin({
  environment: NODE_ENV,
  logLevel: process.env.LOG_LEVEL || 'info'
});

// Initialize skill executor (after plugin is created)
const skillExecutor = new SkillExecutor({
  plugin,
  logger: console
});

// Initialize market data client (optional if API key provided)
let marketDataClient = null;
if (MARKET_DATA_API_KEY) {
  try {
    marketDataClient = new MarketDataClient({
      provider: MARKET_DATA_PROVIDER,
      apiKey: MARKET_DATA_API_KEY,
      cacheTTL: 60,
      logger: console
    });
    console.log(`✅ Market Data Client initialized: ${MARKET_DATA_PROVIDER}`);
  } catch (error) {
    console.warn('⚠️  Market Data Client initialization failed:', error.message);
  }
}

// Initialize broker (optional if API credentials provided)
let alpacaBroker = null;
let orderManager = null;
if (ALPACA_API_KEY && ALPACA_API_SECRET) {
  try {
    alpacaBroker = new AlpacaBroker({
      apiKey: ALPACA_API_KEY,
      apiSecret: ALPACA_API_SECRET,
      paperTrading: ALPACA_PAPER_TRADING,
      logger: console
    });

    orderManager = new OrderManager({
      broker: alpacaBroker,
      logger: console
    });

    console.log(`✅ Alpaca Broker initialized (Paper Trading: ${ALPACA_PAPER_TRADING})`);
  } catch (error) {
    console.warn('⚠️  Broker initialization failed:', error.message);
  }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedURL = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedURL.pathname;
  const method = req.method;

  try {
    // Check authorization
    const authResult = rbacMiddleware.authorize(req);
    if (!authResult.authorized) {
      res.writeHead(401);
      res.end(JSON.stringify({
        error: 'Unauthorized',
        reason: authResult.reason
      }));
      return;
    }

    const authenticatedUser = authResult.user;

    // ============== Authentication Endpoints ==============

    // Login endpoint
    if (pathname === '/auth/login' && method === 'POST') {
      await authEndpoints.handleLogin(req, res);
      return;
    }

    // Register endpoint
    if (pathname === '/auth/register' && method === 'POST') {
      await authEndpoints.handleRegister(req, res);
      return;
    }

    // Token refresh endpoint
    if (pathname === '/auth/refresh' && method === 'POST') {
      await authEndpoints.handleRefresh(req, res, authenticatedUser);
      return;
    }

    // Logout endpoint
    if (pathname === '/auth/logout' && method === 'POST') {
      await authEndpoints.handleLogout(req, res, authenticatedUser);
      return;
    }

    // ============== User Profile Endpoints ==============

    // Get user profile
    if (pathname === '/api/user/profile' && method === 'GET') {
      await authEndpoints.handleGetProfile(req, res, authenticatedUser);
      return;
    }

    // Update user profile
    if (pathname === '/api/user/profile' && method === 'PUT') {
      await authEndpoints.handleUpdateProfile(req, res, authenticatedUser);
      return;
    }

    // Change password
    if (pathname === '/api/user/password' && method === 'PUT') {
      await authEndpoints.handleChangePassword(req, res, authenticatedUser);
      return;
    }

    // List API keys
    if (pathname === '/api/user/api-keys' && method === 'GET') {
      await authEndpoints.handleListAPIKeys(req, res, authenticatedUser);
      return;
    }

    // Create API key
    if (pathname === '/api/user/api-keys' && method === 'POST') {
      await authEndpoints.handleCreateAPIKey(req, res, authenticatedUser);
      return;
    }

    // Revoke API key
    if (pathname.match(/^\/api\/user\/api-keys\/[^/]+$/) && method === 'DELETE') {
      const keyId = pathname.split('/').pop();
      await authEndpoints.handleRevokeAPIKey(req, res, authenticatedUser, keyId);
      return;
    }

    // ============== Health Check Endpoint ==============
    // Health check endpoint
    if (pathname === '/health' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', message: 'HMS Agent - OK' }));
      return;
    }

    // ============== Skill Execution Endpoints ==============

    // Execute skill with standard execution
    if (pathname === '/api/execute' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { agent, skill, task, parameters } = JSON.parse(body);

          const result = await skillExecutor.executeSkill({
            agentId: agent,
            skillId: skill,
            userId: authenticatedUser?.id,
            sessionId: authenticatedUser?._payload?.jti,
            parameters: parameters || {},
            metadata: { task, source: 'api' }
          });

          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Execute specific skill
    if (pathname.match(/^\/api\/skills\/[^/]+\/execute$/) && method === 'POST') {
      const skillId = pathname.split('/')[3];
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { parameters, timeout, retry } = JSON.parse(body);

          let result;

          // Apply retry if enabled
          if (retry?.enabled) {
            result = await skillExecutor.executeSkillWithRetry(
              {
                agentId: 'default-agent',
                skillId,
                userId: authenticatedUser?.id,
                parameters: parameters || {}
              },
              retry.maxAttempts || 3,
              retry.delayMs || 1000
            );
          }
          // Apply timeout if specified
          else if (timeout) {
            result = await skillExecutor.executeSkillWithTimeout(
              {
                agentId: 'default-agent',
                skillId,
                userId: authenticatedUser?.id,
                parameters: parameters || {}
              },
              timeout
            );
          }
          // Standard execution
          else {
            result = await skillExecutor.executeSkill({
              agentId: 'default-agent',
              skillId,
              userId: authenticatedUser?.id,
              parameters: parameters || {}
            });
          }

          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Batch execute skills
    if (pathname === '/api/executions/batch' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const { executions } = JSON.parse(body);

          if (!Array.isArray(executions)) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'executions must be an array' }));
            return;
          }

          const requests = executions.map(e => ({
            agentId: e.agent || 'default-agent',
            skillId: e.skill,
            userId: authenticatedUser?.id,
            parameters: e.parameters || {}
          }));

          const results = await skillExecutor.batchExecute(requests);

          res.writeHead(200);
          res.end(JSON.stringify({
            batchId: `batch_${Date.now()}`,
            status: 'completed',
            results
          }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Get execution history
    if (pathname === '/api/executions/history' && method === 'GET') {
      try {
        const query = new URL(req.url, `http://${req.headers.host}`).searchParams;

        const filters = {
          skillId: query.get('skillId'),
          agentId: query.get('agentId'),
          userId: query.get('userId') || authenticatedUser?.id,
          status: query.get('status'),
          startDate: query.get('startDate'),
          endDate: query.get('endDate'),
          limit: parseInt(query.get('limit') || '100')
        };

        // Remove null/undefined filters
        Object.keys(filters).forEach(k => filters[k] === null && delete filters[k]);

        const history = skillExecutor.getExecutionHistory(filters);

        res.writeHead(200);
        res.end(JSON.stringify({
          total: history.length,
          results: history
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Get specific execution
    if (pathname.match(/^\/api\/executions\/[^/]+$/) && method === 'GET') {
      const executionId = pathname.split('/').pop();
      const context = skillExecutor.getExecutionContext(executionId);

      if (!context) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Execution not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify(context));
      return;
    }

    // Get execution statistics (admin only)
    if (pathname === '/api/executions/stats' && method === 'GET') {
      if (!authenticatedUser || !userManager.hasRole(authenticatedUser.id, 'admin')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Admin access required' }));
        return;
      }

      const stats = skillExecutor.getStatistics();

      res.writeHead(200);
      res.end(JSON.stringify(stats));
      return;
    }

    // ============== Market Data Endpoints ==============

    // Get quote for single symbol
    if (pathname.match(/^\/api\/market\/quotes\/[^/]+$/) && method === 'GET') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      const symbol = pathname.split('/').pop();
      try {
        const quote = await marketDataClient.getQuote(symbol, true);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          ...quote
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Get quotes for multiple symbols
    if (pathname === '/api/market/quotes' && method === 'GET') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      try {
        const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const symbolsStr = query.get('symbols');

        if (!symbolsStr) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'symbols parameter required' }));
          return;
        }

        const symbols = symbolsStr.split(',').map(s => s.trim());
        const quotes = await marketDataClient.getQuotes(symbols);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          quotes
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Get intraday data
    if (pathname.match(/^\/api\/market\/intraday\/[^/]+$/) && method === 'GET') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      const symbol = pathname.split('/').pop();
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const interval = query.get('interval') || '5min';

      try {
        const data = await marketDataClient.getIntraday(symbol, interval);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          symbol,
          interval,
          dataPoints: data.length,
          data
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Get price history for symbol
    if (pathname.match(/^\/api\/market\/history\/[^/]+$/) && method === 'GET') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      const symbol = pathname.split('/').pop();
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const limit = parseInt(query.get('limit') || '100');

      try {
        const history = marketDataClient.getPriceHistory(symbol, limit);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          symbol,
          entries: history.length,
          history
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Search for symbols
    if (pathname === '/api/market/search' && method === 'GET') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      try {
        const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const keywords = query.get('q');

        if (!keywords) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'q parameter required' }));
          return;
        }

        const results = await marketDataClient.search(keywords);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          query: keywords,
          results
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Get cache statistics (admin only)
    if (pathname === '/api/market/cache' && method === 'GET') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      if (!authenticatedUser || !userManager.hasRole(authenticatedUser.id, 'admin')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Admin access required' }));
        return;
      }

      try {
        const stats = marketDataClient.getCacheStats();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          ...stats
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Clear cache (admin only)
    if (pathname === '/api/market/cache' && method === 'DELETE') {
      if (!marketDataClient) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Market data service not available' }));
        return;
      }

      if (!authenticatedUser || !userManager.hasRole(authenticatedUser.id, 'admin')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Admin access required' }));
        return;
      }

      try {
        marketDataClient.clearCache();
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: 'Cache cleared'
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // ============== Broker/Trading Endpoints ==============

    // Check broker connection status
    if (pathname === '/api/broker/status' && method === 'GET') {
      if (!alpacaBroker) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Broker not available' }));
        return;
      }

      const status = alpacaBroker.getStatus();
      const capabilities = alpacaBroker.getCapabilities();

      res.writeHead(200);
      res.end(JSON.stringify({
        status,
        capabilities
      }));
      return;
    }

    // Get account information
    if (pathname === '/api/account' && method === 'GET') {
      if (!alpacaBroker || !alpacaBroker.account) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Broker not connected' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({
        account: alpacaBroker.account
      }));
      return;
    }

    // Get all positions
    if (pathname === '/api/positions' && method === 'GET') {
      if (!alpacaBroker) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Broker not available' }));
        return;
      }

      const positions = Array.from(alpacaBroker.positions.values());
      res.writeHead(200);
      res.end(JSON.stringify({
        total: positions.length,
        positions
      }));
      return;
    }

    // Get position for specific symbol
    if (pathname.match(/^\/api\/positions\/[^/]+$/) && method === 'GET') {
      if (!alpacaBroker) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Broker not available' }));
        return;
      }

      const symbol = pathname.split('/').pop().toUpperCase();
      const position = alpacaBroker.positions.get(symbol);

      if (!position) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Position not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ position }));
      return;
    }

    // Close position
    if (pathname.match(/^\/api\/positions\/[^/]+$/) && method === 'DELETE') {
      if (!alpacaBroker) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Broker not available' }));
        return;
      }

      const symbol = pathname.split('/').pop().toUpperCase();
      try {
        const result = await alpacaBroker.closePosition(symbol);
        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          symbol,
          result
        }));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Calculate P&L for position
    if (pathname.match(/^\/api\/pnl\/[^/]+$/) && method === 'GET') {
      if (!alpacaBroker) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Broker not available' }));
        return;
      }

      const symbol = pathname.split('/').pop().toUpperCase();
      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const currentPrice = parseFloat(query.get('price'));

      if (isNaN(currentPrice)) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'price parameter required and must be a number' }));
        return;
      }

      const pnl = alpacaBroker.calculatePnL(symbol, currentPrice);
      if (!pnl) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Position not found' }));
        return;
      }

      res.writeHead(200);
      res.end(JSON.stringify({ pnl }));
      return;
    }

    // Place new order
    if (pathname === '/api/orders' && method === 'POST') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const orderRequest = JSON.parse(body);
          const userId = authenticatedUser?.id || 'system';

          const order = await orderManager.createOrder(orderRequest, userId);

          res.writeHead(201);
          res.end(JSON.stringify({
            success: true,
            order
          }));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Get all orders for user
    if (pathname === '/api/orders' && method === 'GET') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const userId = authenticatedUser?.id || 'system';
      const filters = {
        status: query.get('status'),
        symbol: query.get('symbol'),
        side: query.get('side')
      };

      // Remove null filters
      Object.keys(filters).forEach(k => filters[k] === null && delete filters[k]);

      const orders = orderManager.getOrdersByUser(userId, filters);

      res.writeHead(200);
      res.end(JSON.stringify({
        total: orders.length,
        orders
      }));
      return;
    }

    // Get specific order status
    if (pathname.match(/^\/api\/orders\/[^/]+$/) && method === 'GET') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      const orderId = pathname.split('/').pop();
      try {
        const order = await orderManager.getOrderStatus(orderId);
        res.writeHead(200);
        res.end(JSON.stringify({ order }));
      } catch (error) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Cancel specific order
    if (pathname.match(/^\/api\/orders\/[^/]+$/) && method === 'DELETE') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      const orderId = pathname.split('/').pop();
      const userId = authenticatedUser?.id || 'system';

      try {
        const result = await orderManager.cancelOrder(orderId, userId);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    // Get active orders
    if (pathname === '/api/orders/active' && method === 'GET') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      const orders = orderManager.getActiveOrders();
      res.writeHead(200);
      res.end(JSON.stringify({
        total: orders.length,
        orders
      }));
      return;
    }

    // Get order execution history
    if (pathname === '/api/orders/history' && method === 'GET') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      const query = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const filters = {
        userId: query.get('userId'),
        action: query.get('action'),
        limit: parseInt(query.get('limit') || '100')
      };

      // Only filter by own user if not admin
      if (!authenticatedUser || !userManager.hasRole(authenticatedUser.id, 'admin')) {
        filters.userId = authenticatedUser?.id;
      }

      const history = orderManager.getExecutionHistory(filters);
      res.writeHead(200);
      res.end(JSON.stringify({
        total: history.length,
        history
      }));
      return;
    }

    // Get order statistics
    if (pathname === '/api/orders/stats' && method === 'GET') {
      if (!orderManager) {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'Order management not available' }));
        return;
      }

      const userId = authenticatedUser?.id || 'system';
      const stats = orderManager.getStatistics(userId);

      res.writeHead(200);
      res.end(JSON.stringify({ stats }));
      return;
    }

    // ============== Admin Endpoints ==============

    // Get authentication stats
    if (pathname === '/api/admin/auth-stats' && method === 'GET') {
      if (!authenticatedUser || !userManager.hasRole(authenticatedUser.id, 'admin')) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Admin access required' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({
        jwtStats: jwtAuth.getStats(),
        users: {
          total: userManager.listUsers().length,
          list: userManager.listUsers()
        },
        auditLog: authEndpoints.getAuditLog().slice(-50) // Last 50 entries
      }));
      return;
    }

    // Metrics endpoint
    if (pathname === '/metrics' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: NODE_ENV,
        authentication: {
          enabled: true,
          activeTokens: jwtAuth.getStats().activeTokens,
          activeSessions: jwtAuth.getStats().activeSessions
        }
      }));
      return;
    }

    // List agents
    if (pathname === '/api/agents' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        agents: plugin.listAgents(),
        version: plugin.version
      }));
      return;
    }

    // List skills
    if (pathname === '/api/skills' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        skills: plugin.listSkills(),
        total: Object.keys(plugin.skills).length
      }));
      return;
    }

    // Get agent details
    if (pathname.match(/^\/api\/agents\/[^/]+$/) && method === 'GET') {
      const agentId = pathname.split('/').pop();
      const agent = plugin.getAgent(agentId);
      if (!agent) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Agent not found' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(agent));
      return;
    }

    // Get skill details
    if (pathname.match(/^\/api\/skills\/[^/]+$/) && method === 'GET') {
      const skillId = pathname.split('/').pop();
      const skill = plugin.getSkill(skillId);
      if (!skill) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Skill not found' }));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(skill));
      return;
    }

    // Execute skill
    if (pathname === '/api/execute' && method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const { agent, skill, task } = JSON.parse(body);
          const result = await plugin.invoke(agent, skill, { task });
          res.writeHead(200);
          res.end(JSON.stringify(result));
        } catch (error) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Root endpoint - serve dashboard UI
    if (pathname === '/' && method === 'GET') {
      const dashboardPath = path.join(__dirname, 'public', 'index.html');
      try {
        const html = fs.readFileSync(dashboardPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.writeHead(200);
        res.end(html);
      } catch (error) {
        // Fallback to JSON if dashboard not available
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          name: plugin.name,
          version: plugin.version,
          status: 'running',
          dashboard: '/dashboard',
          endpoints: {
            health: '/health',
            metrics: '/metrics',
            agents: '/api/agents',
            skills: '/api/skills',
            execute: '/api/execute'
          }
        }));
      }
      return;
    }

    // Serve static files from public directory
    if (pathname.startsWith('/public/')) {
      const filePath = path.join(__dirname, pathname);
      try {
        const content = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentType = {
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif'
        }[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.writeHead(200);
        res.end(content);
      } catch (error) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'File not found' }));
      }
      return;
    }

    // API documentation
    if (pathname === '/api' && method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({
        name: plugin.name,
        version: plugin.version,
        status: 'running',
        dashboard: '/',
        endpoints: {
          health: '/health',
          metrics: '/metrics',
          agents: '/api/agents',
          skills: '/api/skills',
          execute: '/api/execute'
        }
      }));
      return;
    }

    // 404 Not Found
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found', path: pathname }));

  } catch (error) {
    console.error('Error handling request:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: error.message }));
  }
});

// Start server
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`HMS J4C Agent Server v${plugin.version}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/`);
  console.log(`💻 Health: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔧 API Docs: http://localhost:${PORT}/api`);
  console.log(`\n🔐 Authentication Enabled`);
  console.log(`🔑 Default Admin: admin / admin123`);
  console.log(`📝 Login: POST /auth/login`);
  console.log(`📝 Register: POST /auth/register`);
  console.log(`📝 Refresh Token: POST /auth/refresh`);
  console.log(`\n⚡ Skill Execution Enabled`);
  console.log(`🎯 Execute: POST /api/execute`);
  console.log(`📊 History: GET /api/executions/history`);
  console.log(`📈 Stats: GET /api/executions/stats (admin)`);

  if (marketDataClient) {
    console.log(`\n📊 Market Data Enabled (${MARKET_DATA_PROVIDER})`);
    console.log(`💹 Quote: GET /api/market/quotes/:symbol`);
    console.log(`📈 Intraday: GET /api/market/intraday/:symbol`);
    console.log(`📉 History: GET /api/market/history/:symbol`);
    console.log(`🔍 Search: GET /api/market/search?q=keyword`);
  }

  if (alpacaBroker && orderManager) {
    console.log(`\n📈 Trading/Broker Enabled (Alpaca - Paper: ${ALPACA_PAPER_TRADING})`);
    console.log(`💼 Account: GET /api/account`);
    console.log(`📊 Broker Status: GET /api/broker/status`);
    console.log(`💰 Positions: GET /api/positions`);
    console.log(`💹 P&L: GET /api/pnl/:symbol?price=X`);
    console.log(`🛒 Place Order: POST /api/orders`);
    console.log(`📋 Orders: GET /api/orders`);
    console.log(`❌ Cancel Order: DELETE /api/orders/:orderId`);
    console.log(`📈 Active Orders: GET /api/orders/active`);
    console.log(`📑 History: GET /api/orders/history`);
    console.log(`📊 Stats: GET /api/orders/stats`);
  }
  console.log(`${'='.repeat(60)}\n`);

  // Initialize plugin environment in background
  plugin.initializeEnvironment({
    projectRoot: path.join(__dirname, '..'),
    environment: NODE_ENV,
    verbose: process.env.LOG_LEVEL === 'debug'
  }).catch(error => {
    console.warn('Warning: Plugin environment initialization failed:', error.message);
    console.warn('The server will continue to run with limited functionality');
  });

  // Start periodic cleanup of expired tokens and sessions
  setInterval(() => {
    jwtAuth.cleanup();
  }, 60000); // Every minute

  console.log(`✅ Token cleanup scheduled (every 60 seconds)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
