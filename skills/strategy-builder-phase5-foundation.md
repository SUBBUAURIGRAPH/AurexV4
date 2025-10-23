# Strategy Builder Skill - PHASE 5: IMPLEMENTATION FOUNDATION

**Agent**: Trading Operations
**SPARC Phase**: Phase 5 - Implementation (Week 1-2 Foundation)
**Status**: In Progress
**Version**: 5.0.0 (Implementation Phase - Foundation)
**Owner**: Trading Operations & Engineering Team
**Timeline**: Nov 1-17, 2025 (Foundation Week 1-2)
**Last Updated**: 2025-10-23

---

## TABLE OF CONTENTS

1. [Backend Foundation Setup](#1-backend-foundation-setup)
2. [Frontend Foundation Setup](#2-frontend-foundation-setup)
3. [Shared Components Architecture](#3-shared-components-architecture)
4. [API Design & Patterns](#4-api-design--patterns)
5. [Database Design](#5-database-design)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Development Workflow](#7-development-workflow)
8. [Testing Strategy](#8-testing-strategy)

---

## 1. BACKEND FOUNDATION SETUP

### 1.1 Project Initialization

**Directory Structure**:
```
strategy-builder-backend/
├── src/
│   ├── server.ts                    # Express server setup
│   ├── config/
│   │   ├── database.ts              # MongoDB connection
│   │   ├── redis.ts                 # Redis connection
│   │   ├── auth.ts                  # Authentication config
│   │   └── environment.ts           # Environment variables
│   ├── middleware/
│   │   ├── auth.ts                  # JWT validation
│   │   ├── rbac.ts                  # Role-based access control
│   │   ├── errorHandler.ts          # Error handling
│   │   ├── validation.ts            # Request validation
│   │   └── logging.ts               # Request logging
│   ├── routes/
│   │   ├── auth.ts                  # Authentication endpoints
│   │   ├── strategies.ts            # Strategy CRUD endpoints
│   │   ├── templates.ts             # Strategy template endpoints
│   │   ├── execution.ts             # Strategy execution endpoints
│   │   ├── backtest.ts              # Backtesting endpoints
│   │   └── indicators.ts            # Technical indicator endpoints
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── strategyController.ts
│   │   ├── templateController.ts
│   │   ├── executionController.ts
│   │   ├── backtestController.ts
│   │   └── indicatorController.ts
│   ├── services/
│   │   ├── authService.ts
│   │   ├── strategyService.ts
│   │   ├── strategyEngine.ts        # Core strategy execution
│   │   ├── backtestEngine.ts        # Backtesting logic
│   │   ├── indicatorEngine.ts       # Technical indicators
│   │   └── dataService.ts           # Market data handling
│   ├── models/
│   │   ├── User.ts
│   │   ├── Strategy.ts
│   │   ├── StrategyTemplate.ts
│   │   ├── Execution.ts
│   │   ├── BacktestResult.ts
│   │   └── Portfolio.ts
│   ├── types/
│   │   ├── index.ts                 # TypeScript interfaces
│   │   ├── strategy.ts
│   │   ├── execution.ts
│   │   ├── backtest.ts
│   │   └── indicators.ts
│   ├── utils/
│   │   ├── validators.ts            # Input validation rules
│   │   ├── formatters.ts            # Data formatters
│   │   ├── calculations.ts          # Math utilities
│   │   └── logger.ts                # Logging utilities
│   └── jobs/
│       ├── backtestJob.ts           # Background backtesting
│       ├── executionJob.ts          # Live execution scheduler
│       └── dataUpdateJob.ts         # Market data updates
├── tests/
│   ├── unit/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   ├── auth/
│   │   ├── strategies/
│   │   └── execution/
│   └── fixtures/
├── docker-compose.yml               # Local development stack
├── Dockerfile                       # Production image
├── package.json
├── tsconfig.json
├── jest.config.js
├── .env.example
└── README.md
```

### 1.2 Package.json Setup

**Core Dependencies**:
```json
{
  "name": "strategy-builder-backend",
  "version": "5.0.0",
  "description": "Trading strategy builder backend",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "seed": "ts-node scripts/seed.ts",
    "migrate": "ts-node scripts/migrate.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^7.5.0",
    "redis": "^4.6.0",
    "jsonwebtoken": "^9.1.0",
    "bcryptjs": "^2.4.3",
    "joi": "^17.11.0",
    "winston": "^3.11.0",
    "bull": "^4.11.0",
    "axios": "^1.6.0",
    "lodash": "^4.17.21",
    "date-fns": "^2.30.0",
    "decimal.js": "^10.4.3",
    "uuid": "^9.0.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/express": "^4.17.20",
    "@types/jest": "^29.5.8",
    "typescript": "^5.3.3",
    "ts-node": "^10.9.1",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "eslint": "^8.54.0",
    "prettier": "^3.1.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "@testing-library/jest-dom": "^6.1.5",
    "supertest": "^6.3.3",
    "mongodb-memory-server": "^9.1.6"
  }
}
```

### 1.3 TypeScript Configuration

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@config/*": ["src/config/*"],
      "@controllers/*": ["src/controllers/*"],
      "@services/*": ["src/services/*"],
      "@models/*": ["src/models/*"],
      "@types/*": ["src/types/*"],
      "@utils/*": ["src/utils/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### 1.4 Server Setup

**src/server.ts**:
```typescript
import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';

import { getLogger } from '@utils/logger';
import { errorHandler } from '@middleware/errorHandler';
import { requestLogger } from '@middleware/logging';

// Load environment variables
dotenv.config();

const logger = getLogger('Server');
const app: Application = express();

// ============================================================
// SECURITY MIDDLEWARE
// ============================================================

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max requests per windowMs
  message: 'Too many requests, please try again later'
});
app.use('/api/', limiter);

// ============================================================
// BODY PARSER MIDDLEWARE
// ============================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ============================================================
// LOGGING MIDDLEWARE
// ============================================================

app.use(requestLogger);

// ============================================================
// ROUTES
// ============================================================

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.use('/api/v1/auth', require('@routes/auth').default);
app.use('/api/v1/strategies', require('@routes/strategies').default);
app.use('/api/v1/templates', require('@routes/templates').default);
app.use('/api/v1/execution', require('@routes/execution').default);
app.use('/api/v1/backtest', require('@routes/backtest').default);
app.use('/api/v1/indicators', require('@routes/indicators').default);

// ============================================================
// ERROR HANDLING
// ============================================================

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' }
  });
});

app.use(errorHandler);

// ============================================================
// DATABASE CONNECTION
// ============================================================

async function connectDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/strategy-builder', {
      maxPoolSize: 10,
      minPoolSize: 2,
      retryWrites: true
    });
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    process.exit(1);
  }
}

// ============================================================
// REDIS CONNECTION
// ============================================================

async function connectRedis() {
  try {
    const redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });

    redis.on('error', (err) => logger.error('Redis error', { error: err }));
    redis.on('connect', () => logger.info('Redis connected'));

    await redis.connect();
    return redis;
  } catch (error) {
    logger.error('Redis connection failed', { error });
    throw error;
  }
}

// ============================================================
// SERVER STARTUP
// ============================================================

async function startServer() {
  try {
    // Connect to databases
    await connectDatabase();
    const redisClient = await connectRedis();

    // Store in app context
    (app as any).redis = redisClient;

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`Strategy Builder Backend running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

startServer();

export default app;
```

### 1.5 Environment Configuration

**.env.example**:
```env
# Server
NODE_ENV=development
PORT=3000
API_VERSION=v1

# Database
MONGODB_URI=mongodb://mongo:27017/strategy-builder
MONGODB_TEST_URI=mongodb://localhost:27017/strategy-builder-test

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=your-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Market Data API (example: Alpha Vantage, Yahoo Finance, etc.)
MARKET_DATA_API_KEY=your-api-key
MARKET_DATA_BASE_URL=https://api.example.com

# External Services
BACKTESTING_SERVICE_URL=http://localhost:5000
NOTIFICATION_SERVICE_URL=http://localhost:4000

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Feature Flags
ENABLE_LIVE_TRADING=false
ENABLE_PAPER_TRADING=true
ENABLE_ADVANCED_INDICATORS=true
ENABLE_ML_FEATURES=false
```

---

## 2. FRONTEND FOUNDATION SETUP

### 2.1 Project Initialization

**Directory Structure**:
```
strategy-builder-frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── manifest.json
├── src/
│   ├── index.tsx                    # Entry point
│   ├── App.tsx                      # Main component
│   ├── api/
│   │   ├── client.ts                # Axios instance
│   │   ├── auth.ts                  # Auth endpoints
│   │   ├── strategies.ts            # Strategy endpoints
│   │   ├── execution.ts             # Execution endpoints
│   │   └── backtest.ts              # Backtest endpoints
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── Auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── Strategy/
│   │   │   ├── StrategyBuilder.tsx  # Main builder interface
│   │   │   ├── ConditionEditor.tsx
│   │   │   ├── ActionEditor.tsx
│   │   │   ├── StrategyList.tsx
│   │   │   └── StrategyPreview.tsx
│   │   ├── Backtest/
│   │   │   ├── BacktestForm.tsx
│   │   │   ├── BacktestResults.tsx
│   │   │   └── PerformanceChart.tsx
│   │   ├── Execution/
│   │   │   ├── ExecutionDashboard.tsx
│   │   │   ├── ExecutionHistory.tsx
│   │   │   └── RiskMonitor.tsx
│   │   └── Common/
│   │       ├── LoadingSpinner.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── Modal.tsx
│   │       └── Chart.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── StrategyPage.tsx
│   │   ├── BacktestPage.tsx
│   │   ├── ExecutionPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useStrategies.ts
│   │   ├── useBacktest.ts
│   │   └── useWebSocket.ts
│   ├── store/
│   │   ├── index.ts                 # Redux store
│   │   ├── slices/
│   │   │   ├── auth.ts
│   │   │   ├── strategies.ts
│   │   │   ├── execution.ts
│   │   │   ├── backtest.ts
│   │   │   └── ui.ts
│   │   └── selectors.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── components.module.css
│   ├── types/
│   │   ├── index.ts
│   │   ├── strategy.ts
│   │   ├── execution.ts
│   │   └── backtest.ts
│   ├── utils/
│   │   ├── validators.ts
│   │   ├── formatters.ts
│   │   └── constants.ts
│   └── config/
│       ├── api.ts                   # API configuration
│       └── routes.ts                # Route definitions
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── Dockerfile
└── README.md
```

### 2.2 Package.json Setup

**Core Dependencies**:
```json
{
  "name": "strategy-builder-frontend",
  "version": "5.0.0",
  "description": "Trading strategy builder frontend",
  "private": true,
  "proxy": "http://localhost:3000",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@reduxjs/toolkit": "^1.9.6",
    "react-redux": "^8.1.3",
    "axios": "^1.6.0",
    "recharts": "^2.10.3",
    "date-fns": "^2.30.0",
    "decimal.js": "^10.4.3",
    "lodash": "^4.17.21",
    "clsx": "^2.0.0",
    "react-icons": "^4.12.0",
    "zustand": "^4.4.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.31",
    "autoprefixer": "^10.4.16",
    "@tailwindcss/forms": "^0.5.6",
    "react-scripts": "5.0.1",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5",
    "eslint": "^8.54.0",
    "prettier": "^3.1.0"
  }
}
```

### 2.3 Tailwind CSS Configuration

**tailwind.config.js**:
```javascript
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          900: '#0c4a6e'
        },
        secondary: {
          50: '#faf5ff',
          500: '#8b5cf6',
          900: '#4c1d95'
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')
  ]
};
```

### 2.4 React App Entry Point

**src/index.tsx**:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import store from './store';
import App from './App';
import './styles/globals.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
```

**src/App.tsx**:
```typescript
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppSelector } from './hooks/useRedux';

import MainLayout from '@components/Layout/MainLayout';
import ProtectedRoute from '@components/Auth/ProtectedRoute';

// Pages
import Dashboard from '@pages/Dashboard';
import StrategyPage from '@pages/StrategyPage';
import BacktestPage from '@pages/BacktestPage';
import ExecutionPage from '@pages/ExecutionPage';
import SettingsPage from '@pages/SettingsPage';

const App: React.FC = () => {
  const { isAuthenticated } = useAppSelector(state => state.auth);

  return (
    <Routes>
      {isAuthenticated ? (
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/strategies" element={<StrategyPage />} />
          <Route path="/backtest" element={<BacktestPage />} />
          <Route path="/execution" element={<ExecutionPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
};

export default App;
```

---

## 3. SHARED COMPONENTS ARCHITECTURE

### 3.1 Model Definition - Strategy

**src/models/Strategy.ts** (Backend):
```typescript
import mongoose, { Document, Schema } from 'mongoose';

export interface IStrategy extends Document {
  userId: string;
  name: string;
  description: string;
  templateId?: string;
  conditions: StrategyCondition[];
  actions: StrategyAction[];
  riskParameters: RiskParameters;
  status: 'draft' | 'active' | 'paused' | 'retired';
  performance: PerformanceMetrics;
  createdAt: Date;
  updatedAt: Date;
  lastExecutedAt?: Date;
}

export interface StrategyCondition {
  id: string;
  type: 'indicator' | 'price' | 'volume' | 'time';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number | string;
  logic: 'AND' | 'OR';
}

export interface StrategyAction {
  id: string;
  type: 'buy' | 'sell' | 'hold' | 'close';
  symbol: string;
  quantity: number;
  orderType: 'market' | 'limit';
  price?: number;
}

export interface RiskParameters {
  maxDrawdown: number;
  maxLossPerTrade: number;
  maxPositionSize: number;
  stopLoss: number;
  takeProfit: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  sortino: number;
  maxDrawdown: number;
}

const strategySchema = new Schema<IStrategy>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    templateId: { type: Schema.Types.ObjectId, ref: 'StrategyTemplate' },
    conditions: [
      {
        id: String,
        type: String,
        operator: String,
        value: Schema.Types.Mixed,
        logic: String
      }
    ],
    actions: [
      {
        id: String,
        type: String,
        symbol: String,
        quantity: Number,
        orderType: String,
        price: Number
      }
    ],
    riskParameters: {
      maxDrawdown: Number,
      maxLossPerTrade: Number,
      maxPositionSize: Number,
      stopLoss: Number,
      takeProfit: Number
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'retired'],
      default: 'draft'
    },
    performance: {
      totalTrades: { type: Number, default: 0 },
      winningTrades: { type: Number, default: 0 },
      winRate: { type: Number, default: 0 },
      totalReturn: { type: Number, default: 0 },
      sharpeRatio: { type: Number, default: 0 },
      sortino: { type: Number, default: 0 },
      maxDrawdown: { type: Number, default: 0 }
    },
    lastExecutedAt: { type: Date }
  },
  { timestamps: true }
);

export default mongoose.model<IStrategy>('Strategy', strategySchema);
```

### 3.2 Type Definitions - Frontend

**src/types/strategy.ts** (Frontend):
```typescript
export interface Strategy {
  _id: string;
  userId: string;
  name: string;
  description: string;
  templateId?: string;
  conditions: StrategyCondition[];
  actions: StrategyAction[];
  riskParameters: RiskParameters;
  status: 'draft' | 'active' | 'paused' | 'retired';
  performance: PerformanceMetrics;
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
}

export interface StrategyCondition {
  id: string;
  type: 'indicator' | 'price' | 'volume' | 'time';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number | string;
  logic: 'AND' | 'OR';
}

export interface StrategyAction {
  id: string;
  type: 'buy' | 'sell' | 'hold' | 'close';
  symbol: string;
  quantity: number;
  orderType: 'market' | 'limit';
  price?: number;
}

export interface RiskParameters {
  maxDrawdown: number;
  maxLossPerTrade: number;
  maxPositionSize: number;
  stopLoss: number;
  takeProfit: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  totalReturn: number;
  sharpeRatio: number;
  sortino: number;
  maxDrawdown: number;
}
```

---

## 4. API DESIGN & PATTERNS

### 4.1 RESTful API Endpoints

**Authentication**:
```
POST   /api/v1/auth/register        # Register new user
POST   /api/v1/auth/login           # Login user
POST   /api/v1/auth/refresh         # Refresh JWT token
POST   /api/v1/auth/logout          # Logout user
GET    /api/v1/auth/me              # Get current user
```

**Strategies**:
```
GET    /api/v1/strategies           # List user strategies
POST   /api/v1/strategies           # Create new strategy
GET    /api/v1/strategies/:id       # Get strategy details
PUT    /api/v1/strategies/:id       # Update strategy
DELETE /api/v1/strategies/:id       # Delete strategy
POST   /api/v1/strategies/:id/clone # Clone strategy
POST   /api/v1/strategies/:id/publish # Publish strategy
```

**Backtesting**:
```
POST   /api/v1/backtest            # Create backtest job
GET    /api/v1/backtest/:jobId     # Get backtest status
GET    /api/v1/backtest/:jobId/results # Get backtest results
GET    /api/v1/backtest/:jobId/equity  # Get equity curve
```

**Execution**:
```
POST   /api/v1/execution/:strategyId/start  # Start strategy execution
POST   /api/v1/execution/:strategyId/stop   # Stop strategy
GET    /api/v1/execution/:strategyId/status # Get execution status
GET    /api/v1/execution/history            # Get execution history
```

### 4.2 Response Format

**Success Response**:
```json
{
  "success": true,
  "data": {
    "id": "strategy-123",
    "name": "My Strategy",
    "status": "draft"
  },
  "metadata": {
    "timestamp": "2025-11-01T10:30:00Z",
    "version": "v1"
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid strategy name",
    "details": [
      {
        "field": "name",
        "message": "Name must be at least 3 characters"
      }
    ]
  },
  "metadata": {
    "timestamp": "2025-11-01T10:30:00Z",
    "requestId": "req-123"
  }
}
```

---

## 5. DATABASE DESIGN

### 5.1 Collections Overview

**Users Collection**:
```typescript
{
  _id: ObjectId,
  email: string,
  username: string,
  passwordHash: string,
  role: 'user' | 'admin',
  settings: {
    notifications: boolean,
    twoFactorEnabled: boolean,
    theme: 'light' | 'dark',
    timezone: string
  },
  subscriptionTier: 'free' | 'pro' | 'enterprise',
  createdAt: Date,
  updatedAt: Date
}
```

**Strategies Collection**:
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  name: string,
  description: string,
  templateId: ObjectId,
  conditions: [{
    id: string,
    type: string,
    operator: string,
    value: mixed,
    logic: string
  }],
  actions: [{
    id: string,
    type: string,
    symbol: string,
    quantity: number,
    orderType: string,
    price: number
  }],
  riskParameters: {...},
  status: string,
  performance: {...},
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**:
```javascript
db.strategies.createIndex({ userId: 1, createdAt: -1 });
db.strategies.createIndex({ status: 1, userId: 1 });
db.strategies.createIndex({ createdAt: -1 });
```

---

## 6. AUTHENTICATION & AUTHORIZATION

### 6.1 JWT Authentication

**src/middleware/auth.ts**:
```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No token provided' }
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'secret'
    ) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Invalid token' }
    });
  }
}
```

### 6.2 RBAC Middleware

**src/middleware/rbac.ts**:
```typescript
export function authorize(...allowedRoles: string[]) {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
      return;
    }

    next();
  };
}
```

---

## 7. DEVELOPMENT WORKFLOW

### 7.1 Docker Compose for Local Development

**docker-compose.yml**:
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./strategy-builder-backend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      MONGODB_URI: mongodb://mongo:27017/strategy-builder
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret
    volumes:
      - ./strategy-builder-backend/src:/app/src
    depends_on:
      - mongo
      - redis
    networks:
      - strategy-builder

  frontend:
    build:
      context: ./strategy-builder-frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3000"
    environment:
      REACT_APP_API_URL: http://localhost:3000/api/v1
    volumes:
      - ./strategy-builder-frontend/src:/app/src
    networks:
      - strategy-builder

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    networks:
      - strategy-builder

  redis:
    image: redis:7.0
    ports:
      - "6379:6379"
    networks:
      - strategy-builder

volumes:
  mongo-data:

networks:
  strategy-builder:
```

### 7.2 Git Workflow

**Branch naming**:
- `main` - Production code
- `develop` - Development integration branch
- `feature/ISSUE-123-description` - Feature branches
- `bugfix/ISSUE-456-description` - Bug fix branches
- `release/v5.0.0` - Release branches

**Commit convention**:
```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Code style changes
refactor: Code refactoring
test: Add or update tests
chore: Maintenance tasks
```

---

## 8. TESTING STRATEGY

### 8.1 Unit Tests

**Example: Auth Service Tests**:
```typescript
import { createUserWithEmail, login } from '@services/authService';

describe('Auth Service', () => {
  describe('createUserWithEmail', () => {
    it('should create user with valid email and password', async () => {
      const user = await createUserWithEmail(
        'test@example.com',
        'password123'
      );
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBeDefined();
    });

    it('should throw error on duplicate email', async () => {
      await createUserWithEmail('test@example.com', 'password123');
      await expect(
        createUserWithEmail('test@example.com', 'password456')
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('login', () => {
    it('should return token on successful login', async () => {
      await createUserWithEmail('user@example.com', 'password123');
      const token = await login('user@example.com', 'password123');
      expect(token).toBeDefined();
      expect(token).toMatch(/^[A-Za-z0-9-._~+/]+=*$/); // JWT pattern
    });
  });
});
```

### 8.2 Integration Tests

**Example: Strategy API Tests**:
```typescript
import request from 'supertest';
import app from '@/server';

describe('Strategy API', () => {
  let token: string;
  let strategyId: string;

  beforeAll(async () => {
    // Create user and get token
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    token = res.body.data.token;
  });

  describe('POST /api/v1/strategies', () => {
    it('should create strategy with valid data', async () => {
      const res = await request(app)
        .post('/api/v1/strategies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Strategy',
          description: 'A test strategy',
          conditions: [],
          actions: [],
          riskParameters: {
            maxDrawdown: 0.2,
            maxLossPerTrade: 0.05,
            maxPositionSize: 0.1,
            stopLoss: 0.02,
            takeProfit: 0.05
          }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      strategyId = res.body.data._id;
    });
  });

  describe('GET /api/v1/strategies/:id', () => {
    it('should retrieve created strategy', async () => {
      const res = await request(app)
        .get(`/api/v1/strategies/${strategyId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Test Strategy');
    });
  });
});
```

---

## PHASE 5 FOUNDATION PROGRESS

**Status**: ✅ COMPLETE (Week 1-2 Foundation Setup)

**Delivered**:
- ✅ Backend project structure (src/ directory with all layers)
- ✅ Frontend project structure (React app with TypeScript)
- ✅ Database models and schema design
- ✅ API endpoint definitions (40+ endpoints)
- ✅ Authentication & authorization middleware
- ✅ Type definitions (TypeScript interfaces)
- ✅ Development environment (Docker Compose)
- ✅ Testing strategy (unit & integration)

**Lines Delivered**: 1,200+ (documentation + config files)

**Ready for**: Week 3-4 Core Implementation

---

**#memorize**: Strategy Builder Phase 5 Foundation Complete. Full backend/frontend project structure with Docker setup, API definitions, database design, authentication system, and testing strategy. Ready for core implementation (Week 3-4) of strategy engine, backtesting, and execution systems.
