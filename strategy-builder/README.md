# Strategy Builder v5.0.0

Advanced algorithmic trading strategy builder with visual and code editors, comprehensive backtesting, and optimization capabilities.

## Overview

The Strategy Builder is a comprehensive platform for creating, testing, and deploying algorithmic trading strategies. It provides both visual (drag-and-drop) and code-based (JavaScript/Python) interfaces for strategy development.

## Features

### Strategy Development
- **Visual Builder**: Drag-and-drop interface for building strategies
- **Code Editor**: Monaco-powered code editor with syntax highlighting and autocomplete
- **Hybrid Mode**: Combine visual and code approaches
- **60+ Technical Indicators**: Comprehensive indicator library
- **Real-time Validation**: Instant feedback on strategy configuration

### Backtesting
- **Historical Data Testing**: Test strategies on historical market data
- **Comprehensive Metrics**: 20+ performance metrics including Sharpe ratio, drawdown, win rate
- **Trade Analysis**: Detailed trade-by-trade breakdown
- **Visualization**: Equity curves, drawdown charts, monthly returns

### Optimization
- **Multiple Algorithms**: Grid search, genetic algorithm, Bayesian optimization
- **Parameter Tuning**: Optimize indicator parameters automatically
- **Constraint Support**: Set minimum trades, win rate, max drawdown constraints
- **Result Analysis**: Compare multiple optimization runs

### Deployment
- **Paper Trading**: Test strategies in simulated environment
- **Live Trading**: Deploy to production with approval workflow
- **Risk Management**: Built-in position sizing and risk limits
- **Monitoring**: Real-time performance tracking

### Security
- **Role-Based Access Control**: 5 user roles with granular permissions
- **JWT Authentication**: Secure token-based authentication
- **Approval Workflow**: Risk manager approval required for live deployments
- **Audit Logging**: Complete audit trail of all actions

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 7.0+
- Redis 7.2+
- Docker (optional)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd strategy-builder
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start services with Docker**
```bash
docker-compose up -d
```

5. **Run database migrations**
```bash
npm run db:migrate
```

6. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Using Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## API Documentation

### Authentication

```bash
# Register user
POST /api/v1/auth/register
{
  "email": "trader@example.com",
  "username": "trader1",
  "password": "SecurePassword123!",
  "role": "trader"
}

# Login
POST /api/v1/auth/login
{
  "email": "trader@example.com",
  "password": "SecurePassword123!"
}
```

### Strategy Management

```bash
# Create strategy
POST /api/v1/strategies
Authorization: Bearer <token>
{
  "name": "RSI Mean Reversion",
  "description": "Buy when RSI < 30, sell when RSI > 70",
  "mode": "visual",
  ...
}

# List strategies
GET /api/v1/strategies?page=1&limit=10

# Get strategy
GET /api/v1/strategies/:id

# Update strategy
PUT /api/v1/strategies/:id

# Delete strategy
DELETE /api/v1/strategies/:id
```

### Backtesting

```bash
# Start backtest
POST /api/v1/backtests
{
  "strategyId": "...",
  "config": {
    "startDate": "2020-01-01",
    "endDate": "2023-12-31",
    "initialCapital": 100000,
    "timeframe": "1d",
    "markets": ["BTC/USD"]
  }
}

# Get backtest status
GET /api/v1/backtests/:id

# Get backtest results
GET /api/v1/backtests/:id/result
```

### Optimization

```bash
# Start optimization
POST /api/v1/optimizations
{
  "strategyId": "...",
  "config": {
    "algorithm": "genetic",
    "parameters": [
      {"name": "rsi_period", "min": 10, "max": 20, "step": 1}
    ],
    "objectiveMetric": "sharpeRatio"
  }
}

# Get optimization results
GET /api/v1/optimizations/:id/results
```

## Development

### Project Structure

```
strategy-builder/
├── src/
│   ├── api/
│   │   ├── routes/         # API routes
│   │   ├── controllers/    # Request handlers
│   │   └── models/         # Database models
│   ├── services/           # Business logic
│   ├── middleware/         # Express middleware
│   ├── utils/              # Utility functions
│   ├── engine/             # Backtest/optimization engines
│   ├── indicators/         # Indicator library
│   ├── algorithms/         # Optimization algorithms
│   ├── websocket/          # WebSocket handlers
│   ├── config/             # Configuration
│   └── types/              # TypeScript types
├── tests/                  # Test files
├── frontend/               # React frontend (to be implemented)
└── docs/                   # Documentation
```

### Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build            # Build TypeScript
npm start                # Start production server

# Testing
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier
npm run typecheck        # TypeScript type checking

# Database
npm run db:migrate       # Run migrations
npm run db:seed          # Seed database

# Docker
npm run docker:dev       # Start Docker services
npm run docker:down      # Stop Docker services
```

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# Load tests
npm run test:load

# All tests with coverage
npm test -- --coverage
```

## User Roles

| Role | Permissions |
|------|------------|
| **Viewer** | View strategies, backtests, and results |
| **Trader** | Create/edit strategies, run backtests, paper trading |
| **Senior Trader** | All trader permissions + live trading |
| **Risk Manager** | Approve/reject deployments, audit access |
| **Admin** | Full system access |

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB 7.0+
- **Cache**: Redis 7.2+
- **Queue**: Bull (Redis-based)
- **WebSocket**: ws

### Testing
- **Framework**: Jest
- **API Testing**: Supertest
- **Mocking**: MongoDB Memory Server

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose / Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: CloudWatch / Prometheus

## Performance Targets

- API Response Time: <200ms (p99)
- Backtest Execution: <30s (5-year period)
- Database Queries: <50ms (p99)
- Test Coverage: >80%
- Uptime: 99.9%

## Security

- All API endpoints require authentication
- Role-based access control (RBAC)
- JWT tokens with expiration
- Password hashing with bcrypt
- Input validation on all endpoints
- Rate limiting
- HTTPS in production
- Secrets encrypted at rest

## Roadmap

### Phase 5.1 - Week 1-2 (Nov 6-17) ✅ COMPLETE
- [x] Project setup and infrastructure
- [x] Database schemas and models
- [x] Authentication and authorization
- [x] API route stubs
- [x] Testing framework

### Phase 5.2 - Week 2-3 (Nov 17-24)
- [ ] Strategy management APIs
- [ ] Indicator library APIs
- [ ] Backtest APIs
- [ ] Optimization APIs
- [ ] Deployment APIs

### Phase 5.3 - Week 3-4 (Nov 24 - Dec 1)
- [ ] Visual builder frontend
- [ ] Code editor integration
- [ ] Strategy validation engine
- [ ] Real-time validation

### Phase 5.4 - Week 4-5 (Dec 1-8)
- [ ] Backtest execution engine
- [ ] 60+ indicator implementations
- [ ] Optimization algorithms
- [ ] Trade execution simulator

### Phase 5.5 - Week 5-6 (Dec 8-15)
- [ ] Result visualization
- [ ] WebSocket real-time updates
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Production deployment

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-org/strategy-builder/issues)
- Email: support@aurigraph.io

## Acknowledgments

Built by the Aurigraph Trading Operations Team as part of the DLT Developer Agent initiative.

---

**Version**: 5.0.0
**Status**: Phase 5.1 Complete (Foundation)
**Last Updated**: 2025-10-23
