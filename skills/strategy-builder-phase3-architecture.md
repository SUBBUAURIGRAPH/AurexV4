# Strategy Builder Skill - PHASE 3: ARCHITECTURE

**Agent**: Trading Operations
**SPARC Phase**: Phase 3 - Architecture
**Status**: In Development
**Version**: 3.0.0 (Architecture Phase)
**Owner**: Trading Operations Team
**Last Updated**: 2025-10-23

---

## SPARC Framework Progress

- **Phase 1 - Specification**: ✅ COMPLETE
- **Phase 2 - Pseudocode**: ✅ COMPLETE
- **Phase 3 - Architecture**: 🔄 IN PROGRESS
  - System architecture diagram ✓
  - Frontend architecture (React components) ✓
  - Backend API design ✓
  - Database schema design ✓
  - Security architecture ✓
  - Deployment architecture ✓
  - Infrastructure requirements ✓
- **Phase 4 - Refinement**: 📋 Pending
- **Phase 5 - Completion**: 📋 Pending

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level C4 Model

```
SYSTEM CONTEXT DIAGRAM:

┌─────────────────────────────────────────────────────────────────┐
│                        Strategy Builder System                   │
│                       (Trading Operations)                       │
└──────────────┬──────────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────────┬──────────────┐
    │          │          │              │              │
    ▼          ▼          ▼              ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Trader │ │ DevOps │ │Risk Mgmt │ │ Market   │ │ Backtest │
│        │ │ Engr   │ │ Officer  │ │ Data API │ │ System   │
└────────┘ └────────┘ └──────────┘ └──────────┘ └──────────┘

CONTAINER DIAGRAM:

┌─────────────────────────────────────────────────────────────────┐
│                         Strategy Builder                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │ Visual Builder   │    │ Code Editor      │                  │
│  │ React Component  │    │ Monaco Editor    │                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │                       │                             │
│           └───────────┬───────────┘                             │
│                       │                                         │
│                ┌──────▼──────────┐                              │
│                │ Strategy Service │ (Node.js/Express)          │
│                │ - Validation     │                            │
│                │ - Parsing        │                            │
│                │ - Compilation    │                            │
│                └────────┬─────────┘                             │
│                         │                                       │
│      ┌──────────────────┼──────────────────┬────────────────┐  │
│      │                  │                  │                │  │
│      ▼                  ▼                  ▼                ▼  │
│  ┌────────┐        ┌─────────┐      ┌──────────┐    ┌────────┤
│  │ Backtest│       │Optimizer│      │ Risk Mgmt│    │Monitor │
│  │Service  │       │Service  │      │Service   │    │Service │
│  └────────┘       └─────────┘      └──────────┘    └────────┤
│      │                  │                  │                │  │
└──────┼──────────────────┼──────────────────┼────────────────┘  │
       │                  │                  │                  │
       └──────────────────┼──────────────────┘                  │
                          │                                     │
       ┌──────────────────┴──────────────────┐                 │
       │                                     │                 │
       ▼                                     ▼                 │
    ┌──────────┐                      ┌──────────────┐         │
    │ MongoDB  │                      │ Redis Cache  │         │
    │ Strategy │                      │ (Indicators, │         │
    │ Database │                      │  Results)    │         │
    └──────────┘                      └──────────────┘         │

EXTERNAL INTEGRATIONS:

Strategy Builder ◄──────► Exchange Manager (REST + WebSocket)
             │
             ├──────► Backtest Manager Skill (REST API)
             │
             ├──────► Portfolio Analyzer Skill (REST API)
             │
             ├──────► Notification Service (Slack/Email)
             │
             ├──────► Git Repository (Version Control)
             │
             └──────► Monitoring/Logging (CloudWatch, DataDog)
```

### 1.2 Architecture Principles

```
DESIGN PRINCIPLES:

1. SEPARATION OF CONCERNS
   - Visual builder logic ≠ Code parsing ≠ Execution
   - Each component has single responsibility
   - Clear API boundaries between components

2. MODULARITY
   - Pluggable indicator library
   - Swappable optimization algorithms
   - Exchange provider abstraction
   - Backtest engine independence

3. SCALABILITY
   - Stateless services (scale horizontally)
   - Distributed job queue for optimization
   - Caching layer for calculations
   - Database sharding ready (future)

4. RELIABILITY
   - Error recovery at every level
   - Audit trail for compliance
   - Graceful degradation
   - Circuit breakers for external APIs

5. SECURITY
   - Defense in depth (auth, encryption, validation)
   - Zero-trust model for user code execution
   - Sandboxed strategy execution
   - Audit logging of all operations

6. OBSERVABILITY
   - Comprehensive logging
   - Metrics collection
   - Distributed tracing
   - Real-time monitoring dashboards
```

---

## 2. FRONTEND ARCHITECTURE

### 2.1 React Component Hierarchy

```
COMPONENT TREE:

StrategyBuilder (Main Container)
├── Header
│   ├── Logo
│   ├── Breadcrumb
│   ├── StrategyName
│   └── ActionButtons (Save, Export, Deploy)
│
├── Sidebar (Left Panel)
│   ├── ComponentLibrary
│   │   ├── Indicators (RSI, MACD, BB, etc.)
│   │   ├── Conditions (Entry, Exit, Filters)
│   │   └── Actions (Position sizing, Risk controls)
│   │
│   └── StrategyTree
│       ├── Indicators Section
│       │   └── IndicatorItem (with params)
│       ├── Entry Conditions Section
│       │   └── ConditionItem (collapsible)
│       └── Exit Conditions Section
│           └── ConditionItem (collapsible)
│
├── MainEditor (Center Panel)
│   ├── EditorModeToggle (Visual <--> Code)
│   │
│   ├── VisualBuilder (Canvas)
│   │   ├── Canvas (SVG or HTML5 Canvas)
│   │   ├── Nodes (Indicator, Condition nodes)
│   │   ├── Connections (Links between nodes)
│   │   ├── Grid (Snap-to-grid alignment)
│   │   └── Toolbar (Add, delete, connect operations)
│   │
│   └── CodeEditor
│       ├── Monaco Editor
│       ├── Syntax Highlighting
│       ├── Auto-completion
│       └── Error Markers
│
├── RightPanel (Properties/Config)
│   ├── SelectedNodeProperties
│   │   ├── IndicatorConfig (if indicator selected)
│   │   │   ├── ParameterSliders
│   │   │   └── ParameterInputs
│   │   │
│   │   └── ConditionConfig (if condition selected)
│   │       ├── ComparisonOperators
│   │       └── ThresholdInputs
│   │
│   ├── BacktestConfig
│   │   ├── DateRange Picker
│   │   ├── Symbol Selection
│   │   ├── Timeframe Selection
│   │   └── Capital Input
│   │
│   ├── RiskManagementConfig
│   │   ├── Position Sizing
│   │   ├── Stop-Loss Config
│   │   └── Portfolio Limits
│   │
│   └── ValidationPanel
│       ├── SyntaxErrors (if any)
│       ├── LogicErrors (if any)
│       └── Warnings
│
└── BottomPanel
    ├── BacktestResults (Tabs)
    │   ├── Summary Tab
    │   │   ├── Total Return
    │   │   ├── Sharpe Ratio
    │   │   ├── Max Drawdown
    │   │   └── Win Rate
    │   │
    │   ├── Charts Tab
    │   │   ├── Equity Curve
    │   │   ├── Drawdown Chart
    │   │   ├── Monthly Returns Heatmap
    │   │   └── Trade Distribution
    │   │
    │   ├── Trades Tab
    │   │   └── TradesTable (Entry, exit, P&L, etc.)
    │   │
    │   └── Logs Tab
    │       └── ExecutionLogs (for debugging)
    │
    └── ConsoleOutput
        └── Messages (info, warning, error)
```

### 2.2 Key Components Specifications

```
COMPONENT: VisualBuilder (Canvas)

PROPERTIES:
  - nodes: Map<String, NodeData>
  - connections: List<Connection>
  - selectedNode: NodeData | null
  - zoom: Float (0.5 - 2.0)
  - pan: {x: Float, y: Float}
  - gridSize: Integer (10, 20, 25px)
  - snapToGrid: Boolean

METHODS:
  - addNode(type, x, y): NodeData
  - deleteNode(nodeId): void
  - connectNodes(sourceId, targetId): Connection
  - disconnectNodes(connectionId): void
  - updateNodeProperty(nodeId, property, value): void
  - moveNode(nodeId, x, y): void
  - selectNode(nodeId): void
  - serializeToJSON(): String
  - deserializeFromJSON(json): void

EVENTS:
  - onNodeAdded(node)
  - onNodeDeleted(node)
  - onConnectionCreated(connection)
  - onNodeSelected(node)
  - onCanvasChanged()


COMPONENT: CodeEditor

PROPERTIES:
  - code: String (JavaScript or Python)
  - language: String ("javascript" | "python")
  - isValid: Boolean
  - errors: List<SyntaxError>
  - theme: String ("vs", "vs-dark", "hc-black")

METHODS:
  - setCode(code): void
  - getCode(): String
  - validate(): ValidationResult
  - format(): void
  - insertSnippet(snippet): void
  - goToLine(lineNumber): void
  - findAndReplace(find, replace): void

EVENTS:
  - onCodeChange(code)
  - onError(error)
  - onValidationComplete(result)


COMPONENT: BacktestResultsPanel

PROPERTIES:
  - result: BacktestResult
  - isLoading: Boolean
  - selectedTab: String ("summary" | "charts" | "trades" | "logs")

METHODS:
  - displayResult(backtest): void
  - exportResults(): void
  - compareBacktests(result1, result2): void
  - downloadReport(format): void

RENDER ELEMENTS:
  - Metric Cards (return, sharpe, drawdown, win rate)
  - Line Chart (equity curve)
  - Heatmap (monthly returns)
  - Table (trades with pagination)
  - Logs viewer (with filtering)


COMPONENT: IndicatorConfigPanel

PROPERTIES:
  - indicator: IndicatorInstance
  - parameterSchema: ParameterSchema

METHODS:
  - updateParameter(name, value): void
  - resetToDefaults(): void
  - validateParameters(): Boolean
  - previewIndicatorOnChart(): void

RENDER ELEMENTS:
  - Sliders (for min/max parameters)
  - Number inputs (for exact values)
  - Dropdowns (for selection parameters)
  - Color pickers (for line colors)
```

### 2.3 State Management Architecture

```
REDUX STORE STRUCTURE:

store
├── strategy (Strategy definition)
│   ├── id: UUID
│   ├── name: String
│   ├── version: String
│   ├── builder: {type, content}
│   ├── indicators: Array
│   ├── entries: Array
│   ├── exits: Array
│   ├── riskManagement: Object
│   └── status: String
│
├── editor (Editor state)
│   ├── mode: "visual" | "code"
│   ├── selectedNode: UUID | null
│   ├── zoom: Float
│   ├── pan: {x, y}
│   ├── isDirty: Boolean
│   └── lastSaved: Timestamp
│
├── backtest (Backtest state)
│   ├── isRunning: Boolean
│   ├── progress: Float
│   ├── result: BacktestResult | null
│   ├── error: Error | null
│   ├── config: BacktestConfig
│   └── previousResults: List<BacktestResult>
│
├── optimization (Optimization state)
│   ├── isRunning: Boolean
│   ├── progress: Float
│   ├── method: "grid_search" | "genetic" | "walk_forward"
│   ├── results: List<OptimizedStrategy>
│   ├── bestResult: OptimizedStrategy | null
│   └── jobId: String
│
├── validation (Validation state)
│   ├── syntaxErrors: List<Error>
│   ├── logicErrors: List<Error>
│   ├── warnings: List<Warning>
│   ├── isValid: Boolean
│   └── lastValidation: Timestamp
│
└── ui (UI state)
    ├── selectedTab: String
    ├── sidebarCollapsed: Boolean
    ├── notifications: List<Notification>
    └── modals: Map<String, Boolean>

ACTIONS:
- strategy/update
- strategy/save
- strategy/load
- strategy/export
- editor/setMode
- editor/selectNode
- backtest/start
- backtest/complete
- backtest/error
- optimization/start
- validation/validate
- ui/showNotification
```

---

## 3. BACKEND API DESIGN

### 3.1 RESTful API Endpoints

```
BASE_URL: /api/v1/strategies

STRATEGY MANAGEMENT:
════════════════════════════════════════════════════════════

POST /strategies
  Create new strategy
  Request: { name, strategyType, description }
  Response: { id, name, status, createdAt }
  Status: 201

GET /strategies/:id
  Retrieve strategy details
  Response: StrategyDefinition
  Status: 200

PUT /strategies/:id
  Update strategy
  Request: Partial<StrategyDefinition>
  Response: StrategyDefinition
  Status: 200

DELETE /strategies/:id
  Delete strategy
  Status: 204

GET /strategies
  List all user's strategies
  Query: { skip: 0, limit: 20, status: "DRAFT", tags: ["tag1"] }
  Response: { strategies: List, total: Integer }
  Status: 200

POST /strategies/:id/validate
  Validate strategy
  Response: { valid: Boolean, errors: List, warnings: List }
  Status: 200

POST /strategies/:id/clone
  Clone strategy
  Request: { newName }
  Response: { id, name, version }
  Status: 201


INDICATOR MANAGEMENT:
════════════════════════════════════════════════════════════

GET /indicators
  List all available indicators
  Query: { category: "trend", searchText: "MA" }
  Response: { indicators: List<IndicatorDefinition> }
  Status: 200

GET /indicators/:indicatorType
  Get indicator schema and defaults
  Response: {
    name: "RSI",
    parameters: [
      { name: "period", type: "integer", min: 2, max: 100, default: 14 }
    ],
    description: "...",
    examples: [...]
  }
  Status: 200


BACKTESTING:
════════════════════════════════════════════════════════════

POST /strategies/:id/backtest
  Start backtest job
  Request: {
    startDate: "2023-01-01",
    endDate: "2024-10-23",
    initialCapital: 10000,
    symbols: ["BTC/USD"],
    timeframe: "1d"
  }
  Response: {
    jobId: UUID,
    status: "QUEUED",
    estimatedTime: 30
  }
  Status: 202

GET /backtest-jobs/:jobId
  Check backtest progress
  Response: {
    jobId: UUID,
    status: "RUNNING",
    progress: 0.45,
    estimatedTimeRemaining: 15
  }
  Status: 200

GET /backtest-jobs/:jobId/result
  Get backtest results (only when complete)
  Response: BacktestResult
  Status: 200

GET /strategies/:id/backtest-history
  Get all backtest results for strategy
  Query: { skip: 0, limit: 10 }
  Response: { results: List<BacktestResult>, total }
  Status: 200

DELETE /backtest-jobs/:jobId
  Cancel backtest job
  Status: 204


OPTIMIZATION:
════════════════════════════════════════════════════════════

POST /strategies/:id/optimize
  Start optimization job
  Request: {
    method: "grid_search",
    parameters: {
      "rsi_period": { min: 5, max: 30, step: 5 },
      "threshold": { min: 20, max: 80, step: 10 }
    },
    targetMetric: "sharpe",
    constraints: {
      minTrades: 50,
      maxDrawdown: 0.20
    }
  }
  Response: {
    jobId: UUID,
    status: "QUEUED",
    totalCombinations: 625
  }
  Status: 202

GET /optimization-jobs/:jobId
  Check optimization progress
  Response: {
    jobId: UUID,
    status: "RUNNING",
    progress: 0.32,
    bestScore: 1.8,
    completedCombinations: 200,
    totalCombinations: 625
  }
  Status: 200

GET /optimization-jobs/:jobId/results
  Get optimization results
  Query: { topN: 10, sortBy: "score" }
  Response: { results: List<OptimizedStrategy> }
  Status: 200


DEPLOYMENT:
════════════════════════════════════════════════════════════

POST /strategies/:id/deploy
  Deploy strategy to environment
  Request: {
    environment: "paper" | "live",
    exchange: "kraken",
    symbols: ["BTC/USD"],
    initialCapital: 25000,
    maxCapital: 50000
  }
  Response: {
    deploymentId: UUID,
    status: "PENDING_APPROVAL",
    requiresApproval: true
  }
  Status: 202

POST /deployments/:deploymentId/approve
  Approve live deployment (requires admin)
  Request: { approverNotes: "..." }
  Response: { status: "APPROVED" }
  Status: 200

POST /deployments/:deploymentId/reject
  Reject deployment
  Request: { rejectReason: "..." }
  Response: { status: "REJECTED" }
  Status: 200

POST /deployments/:deploymentId/stop
  Stop running strategy
  Response: { status: "STOPPED" }
  Status: 200

GET /strategies/:id/active-deployment
  Get currently active deployment
  Response: DeploymentInfo
  Status: 200

GET /strategies/:id/deployment-history
  Get deployment history
  Response: { deployments: List<Deployment> }
  Status: 200


EXPORT/IMPORT:
════════════════════════════════════════════════════════════

GET /strategies/:id/export
  Export strategy in specified format
  Query: { format: "json" | "yaml" | "python" | "javascript" }
  Response: file (file download)
  Status: 200

POST /strategies/import
  Import strategy from file or JSON
  Request: FormData (multipart file or JSON body)
  Response: { id, name, version }
  Status: 201

POST /strategies/:id/export-history
  Export version history as JSON
  Response: { versions: List<VersionInfo> }
  Status: 200


VERSION CONTROL:
════════════════════════════════════════════════════════════

GET /strategies/:id/versions
  List all versions of strategy
  Query: { skip: 0, limit: 20 }
  Response: { versions: List<VersionInfo> }
  Status: 200

POST /strategies/:id/versions/:versionId/restore
  Restore to previous version
  Response: StrategyDefinition
  Status: 200

GET /strategies/:id/versions/:versionId/diff
  Compare two versions
  Query: { otherId: UUID }
  Response: { changes: List<Change> }
  Status: 200

POST /strategies/:id/tag
  Tag current version
  Request: { tagName: "production" }
  Response: { tagId: UUID }
  Status: 201


SHARING & COLLABORATION:
════════════════════════════════════════════════════════════

POST /strategies/:id/share
  Share strategy with users/teams
  Request: {
    userIds: [UUID],
    teamIds: [UUID],
    permission: "VIEW" | "EDIT" | "ADMIN"
  }
  Response: { shareId: UUID }
  Status: 201

GET /strategies/:id/shares
  Get all shares for strategy
  Response: { shares: List<Share> }
  Status: 200

DELETE /strategies/:id/shares/:shareId
  Revoke strategy share
  Status: 204

POST /strategies/:id/comments
  Add comment to strategy
  Request: { text: String }
  Response: { commentId: UUID, createdAt }
  Status: 201

GET /strategies/:id/comments
  Get all comments
  Response: { comments: List<Comment> }
  Status: 200


TEMPLATES:
════════════════════════════════════════════════════════════

GET /templates
  List all strategy templates
  Query: { category: "beginner", searchText: "RSI" }
  Response: { templates: List<Template> }
  Status: 200

GET /templates/:templateId
  Get template details
  Response: TemplateDefinition
  Status: 200

POST /strategies/from-template
  Create strategy from template
  Request: { templateId: UUID, newName: String }
  Response: { id, name, version }
  Status: 201
```

### 3.2 WebSocket Events (Real-time Updates)

```
WEBSOCKET: /ws/strategies/:id

EVENTS SENT TO CLIENT:
════════════════════════════════════════════════════════════

strategy:updated
  When strategy is modified
  Payload: { changes: List<Change> }

backtest:progress
  Periodic backtest progress updates
  Payload: {
    jobId: UUID,
    progress: 0.45,
    currentCandle: 450,
    totalCandles: 1000
  }

backtest:complete
  When backtest finishes
  Payload: { jobId: UUID, result: BacktestResult }

backtest:error
  When backtest fails
  Payload: { jobId: UUID, error: String }

optimization:progress
  Periodic optimization updates
  Payload: {
    jobId: UUID,
    progress: 0.32,
    completedCombinations: 200,
    totalCombinations: 625,
    bestScore: 1.8
  }

optimization:complete
  When optimization finishes
  Payload: { jobId: UUID, results: List<Result> }

deployment:status
  Deployment status changes
  Payload: {
    deploymentId: UUID,
    status: "PENDING_APPROVAL" | "APPROVED" | "DEPLOYING" | "ACTIVE" | "STOPPED"
  }

indicator:calculated
  Real-time indicator calculation (for live trading preview)
  Payload: {
    indicatorId: UUID,
    value: Float,
    timestamp: ISO8601
  }

strategy:shared
  When strategy is shared with you
  Payload: { sharedBy: String, strategyName: String }

comment:added
  New comment on strategy
  Payload: { commentId: UUID, author: String, text: String }


EVENTS RECEIVED FROM CLIENT:
════════════════════════════════════════════════════════════

backtest:cancel
  Request to cancel running backtest
  Payload: { jobId: UUID }

strategy:watch
  Watch for real-time updates
  Payload: { strategyId: UUID }

strategy:unwatch
  Stop watching strategy
  Payload: { strategyId: UUID }
```

---

## 4. DATABASE SCHEMA

### 4.1 MongoDB Collections

```
COLLECTION: strategies
────────────────────────────────────────────────────────────

{
  _id: ObjectId,
  strategyId: UUID (unique),
  name: String (indexed),
  version: String,
  description: String,
  owner: {
    userId: UUID,
    username: String,
    email: String
  },

  strategyType: String enum
    [MOMENTUM, MEAN_REVERSION, ARBITRAGE, GRID, DCA, ...],

  builder: {
    type: String enum [VISUAL, CODE, HYBRID],
    content: Object (visual JSON or code string)
  },

  indicators: [
    {
      id: UUID,
      type: String (RSI, MACD, BB, etc.),
      parameters: Map<String, Any>,
      displayName: String
    }
  ],

  entries: [
    {
      id: UUID,
      name: String,
      logic: Object (parsed logic tree),
      priority: Integer
    }
  ],

  exits: [
    {
      id: UUID,
      type: String enum [PROFIT_TARGET, STOP_LOSS, TIME_BASED, ...],
      name: String,
      logic: Object,
      timeout: Integer (minutes)
    }
  ],

  riskManagement: {
    positionSizing: {
      method: String,
      parameters: Map
    },
    stopLoss: {
      method: String,
      value: Float
    },
    takeProfit: {
      method: String,
      value: Float
    },
    portfolioLimits: {
      maxPositions: Integer,
      maxExposure: Float,
      correlationLimit: Float
    }
  },

  tags: [String],
  complexity: String enum [SIMPLE, MODERATE, COMPLEX],
  riskLevel: String enum [LOW, MEDIUM, HIGH],
  targetAssets: [String],
  targetTimeframes: [String],

  status: String enum
    [DRAFT, ACTIVE, BACKTESTING, OPTIMIZING, DEPLOYED, ARCHIVED],

  createdAt: ISODate,
  updatedAt: ISODate,
  deletedAt: ISODate (soft delete),

  metadata: {
    lastModifiedBy: UUID,
    viewCount: Integer,
    forkCount: Integer,
    starCount: Integer,
    shareCount: Integer
  },

  versionHistory: [
    {
      versionId: UUID,
      version: String,
      changedAt: ISODate,
      changedBy: UUID,
      changes: List<Change>,
      snapshot: Object (full strategy at this version)
    }
  ],

  sharing: [
    {
      shareId: UUID,
      sharedWith: {
        userId: UUID (if user),
        teamId: UUID (if team)
      },
      permission: String enum [VIEW, EDIT, ADMIN],
      sharedAt: ISODate
    }
  ]
}

INDEXES:
  - { owner.userId: 1, createdAt: -1 }
  - { name: "text", description: "text" }
  - { strategyType: 1 }
  - { status: 1 }
  - { tags: 1 }
  - { updatedAt: -1 }


COLLECTION: backtest_results
────────────────────────────────────────────────────────────

{
  _id: ObjectId,
  backtest_id: UUID (unique),
  strategy_id: UUID (indexed),
  version: String,

  config: {
    startDate: ISODate,
    endDate: ISODate,
    timeframe: String,
    initialCapital: Float,
    commission: Float,
    slippage: Object,
    symbols: [String],
    reinvestProfit: Boolean
  },

  metrics: {
    totalReturn: Float,
    totalReturnPct: Float,
    cagr: Float,
    sharpeRatio: Float,
    sortinoRatio: Float,
    calmarRatio: Float,
    maxDrawdown: Float,
    drawdownDuration: Integer,
    volatility: Float,
    downside_deviation: Float,

    trades: {
      total: Integer,
      winning: Integer,
      losing: Integer,
      winRate: Float,
      profitFactor: Float,
      avgWin: Float,
      avgLoss: Float,
      largestWin: Float,
      largestLoss: Float,
      longestWinStreak: Integer,
      longestLossStreak: Integer
    }
  },

  dailyValues: [
    {
      date: ISODate,
      portfolioValue: Float,
      dailyPnL: Float,
      dailyReturn: Float,
      positionCount: Integer,
      openPnL: Float
    }
  ],

  trades: [
    {
      tradeId: UUID,
      entryTime: ISODate,
      entryPrice: Float,
      exitTime: ISODate,
      exitPrice: Float,
      size: Float,
      symbol: String,
      profit_loss: Float,
      profit_loss_pct: Float,
      return_pct: Float,
      entrySignal: String,
      exitSignal: String,
      commission: Float,
      slippage: Float
    }
  ],

  monthlyReturns: {
    "2024-01": Float,
    "2024-02": Float,
    ...
  },

  executionTime: Integer (milliseconds),
  createdAt: ISODate,
  completedAt: ISODate,
  executedBy: UUID
}

INDEXES:
  - { strategy_id: 1, createdAt: -1 }
  - { backtest_id: 1 }
  - { "metrics.sharpeRatio": -1 }
  - { createdAt: -1 }


COLLECTION: optimization_jobs
────────────────────────────────────────────────────────────

{
  _id: ObjectId,
  jobId: UUID (unique),
  strategy_id: UUID (indexed),

  method: String enum [GRID_SEARCH, GENETIC, RANDOM, BAYESIAN, WALK_FORWARD],

  config: {
    parameters: {
      paramName: { min, max, step },
      ...
    },
    targetMetric: String (sharpe, return, profit_factor, etc.),
    constraints: {
      minTrades: Integer,
      maxDrawdown: Float,
      minWinRate: Float
    },
    populationSize: Integer (for genetic),
    maxGenerations: Integer (for genetic),
    parallelWorkers: Integer
  },

  status: String enum [QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED],
  progress: Float (0-1),

  results: [
    {
      rank: Integer,
      parameters: Map<String, Any>,
      score: Float,
      metrics: Object (backtest metrics),
      backtestId: UUID
    }
  ],

  bestResult: {
    parameters: Map<String, Any>,
    score: Float,
    metrics: Object
  },

  errorLog: [
    {
      timestamp: ISODate,
      error: String,
      context: Object
    }
  ],

  createdAt: ISODate,
  startedAt: ISODate,
  completedAt: ISODate,
  executedBy: UUID,
  executionTime: Integer (seconds)
}

INDEXES:
  - { jobId: 1 }
  - { strategy_id: 1, createdAt: -1 }
  - { status: 1 }


COLLECTION: deployments
────────────────────────────────────────────────────────────

{
  _id: ObjectId,
  deploymentId: UUID (unique),
  strategy_id: UUID (indexed),
  strategyVersion: String,

  environment: String enum [PAPER, LIVE],
  exchange: String,
  symbols: [String],

  config: {
    initialCapital: Float,
    maxCapital: Float,
    maxPositionSize: Float,
    maxDailyLoss: Float
  },

  status: String enum
    [PENDING_APPROVAL, APPROVED, DEPLOYING, ACTIVE, PAUSED, STOPPED, FAILED],

  approval: {
    required: Boolean,
    requiredBy: String enum [RISK_MANAGER, ADMIN],
    approvedAt: ISODate,
    approvedBy: UUID,
    approverNotes: String,
    requestedAt: ISODate,
    requestedBy: UUID,
    requestNotes: String
  },

  deployment: {
    deployedAt: ISODate,
    deployedBy: UUID,
    containerid: String,
    kubernetesNS: String,
    healthStatus: String enum [HEALTHY, DEGRADED, UNHEALTHY]
  },

  monitoring: {
    alertThresholds: {
      dailyLoss: Float,
      drawdown: Float,
      errorRate: Float
    },
    incidents: [
      {
        incidentId: UUID,
        timestamp: ISODate,
        type: String,
        severity: String enum [INFO, WARNING, ERROR, CRITICAL],
        message: String,
        resolved: Boolean
      }
    ]
  },

  metrics: {
    uptime: Float (percentage),
    totalTrades: Integer,
    winRate: Float,
    currentPnL: Float,
    currentDrawdown: Float,
    lastHealthCheck: ISODate
  },

  createdAt: ISODate,
  updatedAt: ISODate
}

INDEXES:
  - { strategy_id: 1, environment: 1 }
  - { deploymentId: 1 }
  - { status: 1 }
  - { createdAt: -1 }


COLLECTION: audit_log
────────────────────────────────────────────────────────────

{
  _id: ObjectId,
  logId: UUID,
  userId: UUID,
  action: String enum
    [CREATE, UPDATE, DELETE, BACKTEST, DEPLOY, APPROVE, REJECT, ...],
  resourceType: String (STRATEGY, BACKTEST, DEPLOYMENT, etc.),
  resourceId: UUID,
  details: Object,
  changes: Array,
  status: String enum [SUCCESS, FAILED],
  errorMessage: String,
  ipAddress: String,
  timestamp: ISODate
}

INDEXES:
  - { userId: 1, timestamp: -1 }
  - { resourceId: 1 }
  - { action: 1 }
  - { timestamp: -1 }
```

---

## 5. SECURITY ARCHITECTURE

### 5.1 Authentication & Authorization

```
AUTHENTICATION FLOW:

User Login
    │
    ▼
OAuth 2.0 / SAML2 (SSO)
    │
    ├─→ JWT Token Generation
    │   └─→ Access Token (15 min)
    │   └─→ Refresh Token (7 days)
    │
    ▼
Store in Secure HttpOnly Cookie
    │
    ├─→ Browser Session
    │   (Auto-refresh on expiry)
    │
    └─→ WebSocket Connection
        (JWT in header)


AUTHORIZATION MODEL (RBAC):

┌────────────────────────────────────────────────────┐
│              Role-Based Access Control              │
├────────────────────────────────────────────────────┤
│                                                    │
│ VIEWER Role                                        │
│ ├─ View own strategies                            │
│ ├─ View shared strategies                         │
│ └─ View backtest results                          │
│                                                    │
│ TRADER Role (extends VIEWER)                      │
│ ├─ Create strategies                              │
│ ├─ Edit own strategies                            │
│ ├─ Run backtests                                  │
│ ├─ Run optimizations                              │
│ └─ Deploy to PAPER environment only               │
│                                                    │
│ SENIOR_TRADER Role (extends TRADER)               │
│ ├─ Edit all strategies                            │
│ ├─ Deploy to LIVE (with approval)                 │
│ └─ Approve other traders' deployments             │
│                                                    │
│ RISK_MANAGER Role                                 │
│ ├─ View all strategies                            │
│ ├─ View all deployments                           │
│ ├─ Approve/reject live deployments                │
│ ├─ Set deployment limits                          │
│ └─ View audit logs                                │
│                                                    │
│ ADMIN Role (full access)                          │
│ ├─ All permissions                                │
│ ├─ Manage users and roles                         │
│ ├─ Manage system configuration                    │
│ └─ View all audit logs                            │
│                                                    │
└────────────────────────────────────────────────────┘


PERMISSION MATRIX:

Resource        VIEWER   TRADER   SR_TRADER   RISK_MGR   ADMIN
─────────────   ──────   ──────   ─────────   ────────   ─────
View own        ✅       ✅       ✅          ✅         ✅
View others     ❌       ❌       ✅          ✅         ✅
Create          ❌       ✅       ✅          ❌         ✅
Edit own        ❌       ✅       ✅          ❌         ✅
Edit others     ❌       ❌       ✅          ❌         ✅
Backtest        ❌       ✅       ✅          ✅         ✅
Optimize        ❌       ✅       ✅          ✅         ✅
Deploy Paper    ❌       ✅       ✅          ❌         ✅
Deploy Live     ❌       ❌       ⚠️ (need)   ❌         ✅
Approve Live    ❌       ❌       ❌          ✅         ✅
Delete          ❌       ✅*      ✅*         ❌         ✅

* Own strategies only
⚠️ Requires approval from risk manager
```

### 5.2 Data Security

```
ENCRYPTION STRATEGY:

DATA AT REST:
  ├─ Database encryption (MongoDB encryption at rest)
  ├─ Encrypted fields:
  │  ├─ Exchange API keys
  │  ├─ User passwords
  │  ├─ Strategy code (if sensitive)
  │  └─ Trade execution data
  ├─ Encryption algorithm: AES-256-GCM
  └─ Key management: AWS KMS

DATA IN TRANSIT:
  ├─ TLS 1.3 for all connections
  ├─ Certificate pinning for critical APIs
  ├─ HSTS (HTTP Strict-Transport-Security)
  └─ Secure WebSocket (WSS)

API SECURITY:
  ├─ Rate limiting (100 req/min per user)
  ├─ API key management
  │  ├─ Rotation every 90 days
  │  ├─ Revocation on key compromise
  │  └─ Scoped permissions per key
  ├─ Request signing (HMAC-SHA256)
  └─ Timestamp validation

CODE EXECUTION SANDBOX:
  ├─ Run user strategies in isolated containers
  ├─ Resource limits:
  │  ├─ CPU: 1 core
  │  ├─ Memory: 512MB
  │  ├─ Timeout: 30 seconds
  │  └─ Network: Disabled (no external calls)
  ├─ No filesystem access
  ├─ No native module imports
  └─ Whitelist allowed indicators only
```

### 5.3 Input Validation

```
VALIDATION RULES:

Strategy Name:
  ├─ Type: String
  ├─ Length: 3-100 characters
  ├─ Pattern: ^[a-zA-Z0-9_\-\s]+$
  └─ XSS protection: sanitize HTML

Code:
  ├─ Max size: 100KB
  ├─ Max execution time: 30 seconds
  ├─ Banned functions: eval, exec, require, import (restricted)
  ├─ Banned modules: fs, child_process, http, cluster
  ├─ Whitelist: Only approved indicators/libraries
  └─ AST validation: No malicious code patterns

Indicator Parameters:
  ├─ Type checking: Strict type validation
  ├─ Range checking: Min/max bounds
  ├─ Enum validation: Only allowed values
  └─ Cross-parameter validation: Parameter combinations

Numeric Inputs:
  ├─ Type: Float or Integer
  ├─ Range: Min/max bounds
  ├─ Precision: 2-8 decimal places max
  └─ NaN/Infinity: Reject

Date Inputs:
  ├─ Format: ISO8601 (YYYY-MM-DD)
  ├─ Range: Valid trading hours only
  ├─ No future dates
  └─ Max range: 10 years back
```

---

## 6. DEPLOYMENT ARCHITECTURE

### 6.1 Infrastructure Diagram

```
DEPLOYMENT TOPOLOGY:

┌─────────────────────────────────────────────────────────────┐
│                         AWS Cloud                           │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │              VPC (us-east-1, us-west-2)            │   │
│  │                                                    │   │
│  │  ┌──────────────────────────────────────────────┐ │   │
│  │  │  Load Balancer (ALB)                         │ │   │
│  │  │  - SSL/TLS termination                       │ │   │
│  │  │  - Request routing                           │ │   │
│  │  │  - Rate limiting                             │ │   │
│  │  └────────┬─────────────────────────────────────┘ │   │
│  │           │                                       │   │
│  │  ┌────────▼──────────────────────────────────┐   │   │
│  │  │  ECS Cluster / Kubernetes                 │   │   │
│  │  │  ┌──────────────┐  ┌──────────────────┐  │   │   │
│  │  │  │ API Servers  │  │ Backtest Workers │  │   │   │
│  │  │  │ (Node.js)    │  │ (Python/Node)    │  │   │   │
│  │  │  │ - 5+ instances│  │ - 10+ instances  │  │   │   │
│  │  │  │ - Auto-scale │  │ - Queue-based    │  │   │   │
│  │  │  └──────────────┘  └──────────────────┘  │   │   │
│  │  │                                           │   │   │
│  │  │  ┌────────────────────────────────────┐  │   │   │
│  │  │  │ Optimization Workers               │  │   │   │
│  │  │  │ - 5+ instances                     │  │   │   │
│  │  │  │ - Genetic/Grid search              │  │   │   │
│  │  │  └────────────────────────────────────┘  │   │   │
│  │  └────────────────────────────────────────┘ │   │   │
│  │           │                                  │   │   │
│  │  ┌────────▼──────────────┬──────────────┐  │   │   │
│  │  │   Data Layer          │              │  │   │   │
│  │  │                       │              │  │   │   │
│  │  │  ┌────────────────┐   │              │  │   │   │
│  │  │  │  MongoDB       │   │              │  │   │   │
│  │  │  │  - 3-node RS   │   │              │  │   │   │
│  │  │  │  - Auto-backup │   │   Redis      │  │   │   │
│  │  │  │  - 500GB+      │   │   - Cache    │  │   │   │
│  │  │  └────────────────┘   │   - Queue    │  │   │   │
│  │  │                       │   - Session  │  │   │   │
│  │  │                       │   - 100GB    │  │   │   │
│  │  │                       └──────────────┘  │   │   │
│  │  └───────────────────────────────────────┘ │   │   │
│  │           │                                 │   │   │
│  │  ┌────────▼──────────────────────────────┐ │   │   │
│  │  │  Storage                              │ │   │   │
│  │  │  - S3 (backtest results)              │ │   │   │
│  │  │  - EBS (persistent volumes)           │ │   │   │
│  │  │  - CloudFront (CDN for static assets) │ │   │   │
│  │  └────────────────────────────────────┘ │   │   │
│  │           │                              │   │   │
│  └───────────┼──────────────────────────────┘   │   │
│              │                                  │   │
│  ┌───────────▼──────────────────────────────┐  │   │
│  │ Monitoring & Logging                    │  │   │
│  │ - CloudWatch (metrics, logs)            │  │   │
│  │ - X-Ray (distributed tracing)           │  │   │
│  │ - DataDog (APM)                         │  │   │
│  │ - PagerDuty (alerting)                  │  │   │
│  └─────────────────────────────────────────┘  │   │
│                                                │   │
└────────────────────────────────────────────────────┘

MULTI-REGION FOR HIGH AVAILABILITY:

Primary Region (us-east-1)
  ├─ Active API servers
  ├─ Master MongoDB
  ├─ Primary Redis

Failover Region (us-west-2)
  ├─ Warm standby API servers
  ├─ Secondary MongoDB (read-only)
  └─ Replica Redis (read-only)

Global:
  ├─ Route53 (geo-routing)
  ├─ CloudFront (CDN)
  └─ Cross-region replication
```

### 6.2 Deployment Process

```
CI/CD PIPELINE:

GitHub/GitLab Push
    │
    ▼
GitHub Actions / GitLab CI
    ├─ Lint & format check
    ├─ Unit tests (Jest)
    ├─ Integration tests
    ├─ Security scan (SAST)
    ├─ Dependency check (npm audit)
    │
    ├─ Build Docker image
    │ ├─ Multi-stage build
    │ ├─ Size optimization
    │ └─ Push to ECR
    │
    ├─ Security scanning
    │ ├─ Trivy (vulnerability scan)
    │ ├─ Snyk (dependency scan)
    │ └─ Check for secrets
    │
    ├─ Deploy to staging (if main branch)
    │ ├─ Run smoke tests
    │ ├─ Performance tests
    │ └─ Security tests
    │
    └─ On approval
        └─ Deploy to production
            ├─ Blue-green deployment
            ├─ Health checks
            ├─ Canary deployment (5% traffic)
            ├─ Gradual rollout
            └─ Rollback on failure


DEPLOYMENT STRATEGIES:

Blue-Green Deployment:
  ├─ Blue: Current production
  ├─ Green: New version
  ├─ Test green in parallel
  └─ Switch traffic to green
      (instant, zero downtime)

Canary Deployment:
  ├─ Route 5% traffic to new version
  ├─ Monitor metrics for 30 minutes
  ├─ If OK: Increase to 25%
  ├─ If OK: Increase to 50%
  ├─ If OK: Route 100% traffic
  └─ Keep old version as rollback
```

### 6.3 Scaling Strategy

```
AUTO-SCALING CONFIGURATION:

API Server Scaling:
  ├─ Min instances: 5
  ├─ Max instances: 50
  ├─ Target CPU: 70%
  ├─ Target Memory: 80%
  ├─ Scale-up cooldown: 1 min
  └─ Scale-down cooldown: 5 min

Backtest Worker Scaling:
  ├─ Min instances: 3
  ├─ Max instances: 100
  ├─ Scale based on: Queue depth
  ├─ Target queue depth: 50 jobs
  ├─ Scale-up cooldown: 30 sec
  └─ Scale-down cooldown: 10 min

Optimization Worker Scaling:
  ├─ Min instances: 2
  ├─ Max instances: 50
  ├─ Scale based on: Active jobs
  ├─ Target: 10 combinations per worker
  ├─ Scale-up cooldown: 1 min
  └─ Scale-down cooldown: 15 min

Database Scaling:
  ├─ MongoDB: Read replicas for scaling
  ├─ Auto-sharding by strategy_id
  ├─ Redis: Cluster mode (16 shards)
  └─ S3: Unlimited (inherent)
```

---

## 7. MONITORING & OBSERVABILITY

### 7.1 Metrics Collection

```
APPLICATION METRICS:

Request Metrics:
  ├─ Request count (total, by endpoint)
  ├─ Request duration (p50, p95, p99)
  ├─ Error rate (5xx, 4xx)
  ├─ Request size (bytes)
  └─ Response size (bytes)

Business Metrics:
  ├─ Strategies created (count, rate)
  ├─ Backtests run (count, rate, avg duration)
  ├─ Optimizations run (count, rate, avg duration)
  ├─ Deployments (count, success rate)
  ├─ Active deployments (count)
  └─ User activity (daily active users, sessions)

System Metrics:
  ├─ CPU usage (%)
  ├─ Memory usage (%)
  ├─ Disk usage (%)
  ├─ Network I/O (bytes/sec)
  ├─ Database connections
  ├─ Cache hit rate (%)
  └─ Queue depth (jobs)

Performance Metrics:
  ├─ Strategy validation time (ms)
  ├─ Backtest execution time (ms)
  ├─ Optimization time (seconds)
  ├─ API response time (ms)
  ├─ Cache latency (ms)
  └─ Database query time (ms)
```

### 7.2 Logging Strategy

```
LOG LEVELS:

DEBUG: Internal flow details (e.g., parameter values)
  ├─ Only in development/staging
  └─ Verbose output for troubleshooting

INFO: Significant events (strategy created, backtest started)
  ├─ Production-grade detail level
  ├─ Key business events
  └─ Retention: 30 days

WARNING: Unexpected but recoverable issues
  ├─ Validation warnings
  ├─ Performance degradation
  ├─ Retry on transient failures
  └─ Retention: 90 days

ERROR: Recoverable failures
  ├─ Failed backtest
  ├─ Validation failure
  ├─ API errors
  └─ Retention: 1 year

CRITICAL: Unrecoverable failures (action required)
  ├─ Database connection loss
  ├─ Security incidents
  ├─ Service unavailability
  ├─ Alerts to on-call
  └─ Retention: Indefinite


LOG STRUCTURE (JSON):

{
  timestamp: ISO8601,
  level: "ERROR" | "WARNING" | "INFO" | "DEBUG",
  service: "strategy-builder-api",
  version: "3.0.0",
  requestId: UUID (trace all logs for request),
  userId: UUID (if authenticated),
  action: "backtest_start",
  resourceType: "strategy",
  resourceId: UUID,
  duration_ms: Integer (if applicable),
  message: "Human-readable message",
  details: {
    strategyId: UUID,
    backtest: { ... },
    ...
  },
  error: {
    type: "TimeoutError",
    message: "Backtest exceeded 30-second timeout",
    stack: "...",
    code: "BACKTEST_TIMEOUT"
  },
  metadata: {
    environment: "production",
    region: "us-east-1",
    instance: "i-0123456789abcdef0"
  }
}
```

---

## ARCHITECTURE PHASE COMPLETION

### Review Checklist

- [x] **System Architecture**: C4 model with context, container, component views
- [x] **Frontend Architecture**: React component hierarchy, state management
- [x] **Backend API Design**: 50+ RESTful endpoints, WebSocket events
- [x] **Database Schema**: MongoDB collections with proper indexing
- [x] **Security Architecture**: Authentication, authorization, encryption, validation
- [x] **Deployment Architecture**: Infrastructure diagram, CI/CD pipeline, scaling
- [x] **Monitoring**: Metrics, logging, alerting strategy

### Phase 3 Deliverables

✅ **Architecture Document** (this document)
- System architecture diagrams (C4 model)
- 50+ API endpoint specifications
- Complete database schema design
- Frontend component architecture
- Security and deployment architecture
- Monitoring and observability strategy

### Next Steps

**Phase 4: Refinement** (Estimated: Nov 3-5, 2025)
- UX/UI refinement
- Performance optimization plan
- Security hardening details
- Comprehensive testing strategy
- Code quality standards

---

**Document Status**: ✅ Phase 3 Architecture Complete
**Approval Required**: Engineering Lead, Infrastructure Lead
**Next Phase**: Phase 4 - Refinement
**Maintained By**: Trading Operations & Engineering Team
**Last Updated**: 2025-10-23

---

