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

// Configuration
const PORT = process.env.PORT || 9003;
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || undefined;

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
