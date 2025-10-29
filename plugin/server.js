#!/usr/bin/env node

/**
 * HMS J4C Agent - HTTP Server
 * Wraps the Aurigraph plugin as a web service
 * @version 1.0.0
 */

const http = require('http');
const path = require('path');
const AurigraphAgentsPlugin = require('./index');

// Configuration
const PORT = process.env.PORT || 9003;
const NODE_ENV = process.env.NODE_ENV || 'development';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;

  try {
    // Health check endpoint
    if (pathname === '/health' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', message: 'HMS Agent - OK' }));
      return;
    }

    // Metrics endpoint
    if (pathname === '/metrics' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        environment: NODE_ENV
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

    // Root endpoint
    if (pathname === '/' && method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        name: plugin.name,
        version: plugin.version,
        status: 'running',
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
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
  console.log(`🔧 API Docs: http://localhost:${PORT}/`);
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
