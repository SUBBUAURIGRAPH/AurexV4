# AWD2 & J4C Agent Integration Plan

**Date**: October 27, 2025
**Status**: Planning Phase
**Objective**: Integrate J4C Agent Plugin into AWD2 DMRV Platform

---

## Executive Summary

This document outlines the integration of the J4C Agent Plugin (Jeeves4Coder multi-agent system) into the AWD2 (Agricultural Water Distribution) platform. The integration enables:

- **Agent-based task automation** for farm operations
- **Intelligent skill routing** across 15 specialized agents
- **Real-time monitoring and optimization** via GNN system
- **Knowledge accumulation** and continuous learning
- **Multi-role collaboration** (Farmers, Land Advisors, Supervisors, Admins)

---

## Project Context

### AWD2 Platform
- **Type**: Next.js/React web application with React Native mobile
- **Purpose**: Agricultural Water Distribution, Farmer Agreements, User Activity Tracking
- **Tech Stack**: TypeScript, Node.js, PostgreSQL, Prisma ORM
- **Roles**: Farmer, Land Advisor (LA), Supervisor, Admin
- **Deployment**: Docker-based on dev3, dev5, production

### J4C Agent Plugin
- **Type**: 15 specialized agents with 25+ skills
- **Components**: DLT Architect, DevOps Engineer, QA Engineer, Security Specialist, etc.
- **Features**: GNN-based optimization, skill memory, continuous learning
- **Status**: Fully deployed and tested on dlt.aurigraph.io

---

## Integration Architecture

### High-Level Design

```
┌─────────────────────────────────────────┐
│         AWD2 Frontend (React)            │
│  - Farmer Interface                      │
│  - Admin Dashboard                       │
│  - Supervisor Controls                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      AWD2 Backend (Next.js API)          │
│  - User Management                       │
│  - Farm Operations                       │
│  - Water Distribution Logic              │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│    J4C Agent Plugin Integration Layer    │
│  - Agent Invocation API                  │
│  - Skill Router                          │
│  - Result Handler                        │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│      J4C Agent System (Docker)           │
│  - 15 Specialized Agents                 │
│  - 25+ Skills                            │
│  - GNN Optimization                      │
│  - Knowledge Base                        │
└─────────────────────────────────────────┘
```

### Data Flow

1. **User Initiates Action** → AWD2 Frontend (Web or Mobile)
2. **Request Processed** → AWD2 Backend API validates and prepares data
3. **Agent Invocation** → Integration layer determines appropriate agent
4. **Skill Execution** → J4C Agent executes specialized skill
5. **Result Handler** → Integration layer processes and returns result
6. **UI Update** → Frontend displays result to user

---

## Integration Components

### 1. Agent Invocation Service

**Location**: `/src/services/j4c-agent-service.ts`

```typescript
// Service to invoke J4C agents from AWD2 backend
interface AgentInvocationRequest {
  agentId: string;        // e.g., "devops", "qa", "dlt-architect"
  skillName: string;      // e.g., "deploy-wizard", "run-tests"
  parameters: Record<string, any>;
  context?: AgentContext;
  userId: string;         // Audit trail
  timestamp: Date;
}

interface AgentInvocationResponse {
  success: boolean;
  result: any;
  executionTime: number;
  agentFeedback: string;
  skillUsed: string;
}

class J4CAgentService {
  async invokeAgent(request: AgentInvocationRequest): Promise<AgentInvocationResponse>
  async getAvailableAgents(): Promise<AgentInfo[]>
  async getAgentSkills(agentId: string): Promise<SkillInfo[]>
  async handleAgentResult(response: AgentInvocationResponse): Promise<void>
}
```

### 2. Skill Router

**Location**: `/src/services/skill-router.ts`

```typescript
// Routes tasks to appropriate agents based on requirements
interface SkillRoutingRequest {
  taskType: string;        // "farm-optimization", "water-distribution", "qa-testing"
  priority: 'low' | 'medium' | 'high' | 'critical';
  requirements: string[];  // e.g., ["performance", "security"]
  context: {
    farmId?: string;
    userId: string;
    operation: string;
  };
}

class SkillRouter {
  async routeTask(request: SkillRoutingRequest): Promise<AgentAssignment>
  async getRecommendedAgents(taskType: string): Promise<AgentInfo[]>
  async evaluateAgentCapability(agentId: string, taskType: string): Promise<number>
}
```

### 3. AWD2-J4C Adapter

**Location**: `/src/adapters/j4c-adapter.ts`

Handles conversion between AWD2 data models and J4C agent parameters:

```typescript
// Convert AWD2 farm data to agent-compatible format
function adaptFarmDataForAgent(farm: Farm): AgentFarmData

// Convert agent results back to AWD2 data models
function adaptAgentResultToAWD2(result: AgentResponse): AWD2Response

// Map AWD2 roles to agent capabilities
function mapRoleToAgentCapability(awdRole: UserRole): AgentCapability
```

### 4. Integration Database Schema

**New Tables**:
- `agent_invocations` - Track all agent invocations
- `agent_audit_log` - Audit trail of agent actions
- `agent_performance_metrics` - Performance data for GNN optimization
- `skill_results` - Cached skill execution results
- `agent_feedback` - User feedback on agent suggestions

---

## Detailed Integration Plan

### Phase 1: Foundation (Weeks 1-2)

**Objective**: Set up basic integration infrastructure

#### Tasks:
1. ✅ Create J4C Agent Service module
   - Implement docker exec invocation wrapper
   - Add error handling and timeout management
   - Create agent discovery service

2. ✅ Set up Skill Router
   - Map AWD2 operations to J4C agents
   - Create task-to-agent mapping
   - Implement capability-based routing

3. ✅ Create adapter layer
   - AWD2 data → Agent parameters
   - Agent results → AWD2 models
   - Role mapping

4. ✅ Add integration tests
   - Mock agent invocations
   - Test data conversions
   - Verify routing logic

#### Deliverables:
- Integration service module
- Skill router implementation
- Adapter functions
- Unit tests

#### Code Location:
```
/src/services/
  - j4c-agent-service.ts
  - skill-router.ts
/src/adapters/
  - j4c-adapter.ts
/src/__tests__/
  - j4c-integration.test.ts
  - skill-router.test.ts
```

---

### Phase 2: User-Facing Features (Weeks 2-3)

**Objective**: Expose agent capabilities through AWD2 UI

#### Tasks:
1. Create Agent Dashboard component
   - Show available agents and skills
   - Display agent capabilities
   - Show execution history

2. Implement Agent Action buttons
   - Quick actions for common operations
   - "Get Agent Suggestion" button
   - "Run Agent Skill" interface

3. Add Agent Results display
   - Show suggestions from agents
   - Present recommendations
   - Display optimization insights

4. Build Audit Trail UI
   - Who invoked what agent
   - When and why
   - Results achieved

#### Deliverables:
- Agent Dashboard component
- Agent Action buttons
- Results display components
- Audit log viewer

#### Code Location:
```
/src/components/agents/
  - AgentDashboard.tsx
  - AgentActionButton.tsx
  - AgentResultsDisplay.tsx
  - AuditTrailViewer.tsx
/src/pages/
  - /agents (Agent management page)
  - /agents/[agentId] (Agent detail page)
```

---

### Phase 3: Intelligent Integration (Weeks 3-4)

**Objective**: Enable agents to contribute to core AWD2 operations

#### Tasks:
1. Farm Optimization Integration
   - QA Engineer: Validate farm data quality
   - Data Engineer: Optimize data models
   - DevOps Engineer: Improve farm system performance

2. Water Distribution Optimization
   - DLT Architect: Blockchain integration for immutable records
   - Data Engineer: Optimize distribution algorithms
   - SRE: Monitor and improve reliability

3. User Management Enhancement
   - Security & Compliance: User role and permission review
   - Data Engineer: User data optimization
   - Employee Onboarding: Onboard new admins

4. Reporting & Analytics
   - Data Engineer: Generate insights and reports
   - Project Manager: Aggregate activity data
   - QA Engineer: Validate report accuracy

#### Deliverables:
- Integration hooks in farm operations
- Water distribution optimization logic
- User management enhancements
- Analytics integration

#### Code Locations:
```
/src/features/farms/
  - agentOptimization.ts
/src/features/water-distribution/
  - agentIntegration.ts
/src/features/analytics/
  - agentReporting.ts
```

---

### Phase 4: GNN Optimization Integration (Week 4)

**Objective**: Connect AWD2 operations to J4C GNN learning system

#### Tasks:
1. Performance Data Collection
   - Track which agents helped with which tasks
   - Measure success metrics
   - Collect user feedback

2. GNN Feedback Loop
   - Send performance data to J4C GNN system
   - Receive optimized agent recommendations
   - Adjust agent assignments based on learnings

3. Continuous Improvement
   - Monitor agent effectiveness over time
   - Update agent role assignments
   - Improve skill recommendations

#### Deliverables:
- Performance data collection system
- GNN feedback integration
- Recommendation update mechanism

---

## Agent-to-Feature Mapping

### Farm Operations
| Feature | Primary Agent | Supporting Agents |
|---------|--------------|-------------------|
| Farm Validation | QA Engineer | Security, Data Engineer |
| Performance Optimization | DevOps Engineer | Data Engineer, SRE |
| Water Distribution | Data Engineer | DLT Architect, SRE |
| Report Generation | Project Manager | Data Engineer, QA Engineer |

### Administrative Functions
| Feature | Primary Agent | Supporting Agents |
|---------|--------------|-------------------|
| User Management | Security & Compliance | Employee Onboarding |
| System Monitoring | SRE/Reliability | DevOps Engineer, Prometheus |
| Audit & Compliance | Security & Compliance | Project Manager |
| Performance Analysis | GNN Heuristic | Data Engineer, SRE |

### Development & Quality
| Feature | Primary Agent | Supporting Agents |
|---------|--------------|-------------------|
| Code Reviews | DevOps Engineer | Frontend Developer, DLT Developer |
| Testing | QA Engineer | Frontend Developer, Security |
| Deployment | DevOps Engineer | SRE, Frontend Developer |
| Documentation | Master SOP | Project Manager, QA Engineer |

---

## API Contracts

### Invoke Agent Endpoint

```
POST /api/agents/invoke
Content-Type: application/json

{
  "agentId": "devops",
  "skillName": "optimize-farm",
  "parameters": {
    "farmId": "farm_12345",
    "optimization_type": "water_distribution"
  },
  "context": {
    "userId": "user_abc123",
    "operation": "routine_maintenance"
  }
}

Response:
{
  "success": true,
  "invocationId": "inv_xyz789",
  "agentId": "devops",
  "skillName": "optimize-farm",
  "result": {
    "recommendations": [...],
    "metrics": {...}
  },
  "executionTime": 2345,
  "status": "completed"
}
```

### Get Available Agents

```
GET /api/agents
Query Parameters:
  - capability?: string (filter by capability)
  - status?: 'active' | 'all'

Response:
{
  "agents": [
    {
      "id": "devops",
      "name": "DevOps Engineer",
      "description": "Infrastructure management",
      "capabilities": ["farm-optimization", "performance-tuning"],
      "status": "active"
    },
    ...
  ]
}
```

### Get Agent Skills

```
GET /api/agents/:agentId/skills

Response:
{
  "agentId": "devops",
  "skills": [
    {
      "id": "optimize-farm",
      "name": "Farm Optimization",
      "description": "Optimize farm data and systems",
      "parameters": [{name: "farmId", type: "string", required: true}, ...],
      "responseFormat": {...}
    },
    ...
  ]
}
```

---

## Database Schema

```sql
-- Agent Invocations
CREATE TABLE agent_invocations (
  id UUID PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  invoked_by_user_id UUID NOT NULL REFERENCES users(id),
  parameters JSONB NOT NULL,
  result JSONB,
  execution_time_ms INTEGER,
  status ENUM('pending', 'executing', 'completed', 'failed', 'timeout'),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (invoked_by_user_id) REFERENCES users(id)
);

-- Agent Audit Log
CREATE TABLE agent_audit_log (
  id UUID PRIMARY KEY,
  invocation_id UUID NOT NULL REFERENCES agent_invocations(id),
  action VARCHAR(255) NOT NULL,
  details JSONB,
  farm_id UUID REFERENCES farms(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent Performance Metrics
CREATE TABLE agent_performance_metrics (
  id UUID PRIMARY KEY,
  agent_id VARCHAR(255) NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  average_execution_time_ms INTEGER,
  user_satisfaction_score FLOAT,
  last_used_at TIMESTAMP,
  UNIQUE(agent_id, skill_name)
);
```

---

## Testing Strategy

### Unit Tests
- Test agent invocation service
- Test skill router logic
- Test adapter functions
- Test data conversions

### Integration Tests
- Test agent service with mock docker
- Test API endpoints
- Test database operations
- Test error handling

### E2E Tests
- Full flow from UI to agent and back
- Agent action → Result display
- Audit trail recording
- Performance metrics collection

### Test Files:
```
/tests/unit/services/j4c-agent-service.test.ts
/tests/unit/services/skill-router.test.ts
/tests/unit/adapters/j4c-adapter.test.ts
/tests/integration/agent-integration.test.ts
/tests/e2e/agent-workflow.test.ts
```

---

## Deployment Considerations

### Development Environment (Local)
- Mock J4C Agent Service (returns predefined responses)
- Integration disabled by default
- Environment variable: `J4C_AGENT_ENABLED=false`

### Staging Environment (dev3/dev5)
- Connect to J4C Agent on dedicated server
- Full integration enabled
- Docker exec communication over network

### Production Environment
- Connect to J4C Agent on production server
- Load balancing if multiple agent instances
- Circuit breaker for agent service failures
- Fallback strategies for agent unavailability

### Configuration:

```env
# .env file
J4C_AGENT_ENABLED=true
J4C_AGENT_HOST=dlt.aurigraph.io
J4C_AGENT_PORT=9003
J4C_AGENT_TIMEOUT_MS=30000
J4C_AGENT_MAX_RETRIES=3
J4C_AGENT_FALLBACK_MODE=suggest  # or 'disable'
```

---

## Success Criteria

### Phase 1
- ✅ Integration service can invoke agents
- ✅ Skill router correctly maps tasks to agents
- ✅ Data adapters work correctly
- ✅ Unit tests pass (100% critical path)

### Phase 2
- ✅ Agent Dashboard displays correctly
- ✅ Agent actions appear in UI
- ✅ Agent results are displayed
- ✅ Audit trail records all invocations

### Phase 3
- ✅ Farm optimization uses agent suggestions
- ✅ Water distribution integrates agent optimization
- ✅ User management benefits from agent insights
- ✅ Reports include agent contributions

### Phase 4
- ✅ GNN system receives performance data
- ✅ Agent recommendations improve over time
- ✅ Continuous learning is active
- ✅ Productivity gains measurable (target: 10% improvement)

---

## Risk Assessment & Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Agent service unavailable | Medium | High | Fallback mode, circuit breaker, alerts |
| Data format incompatibility | Low | Medium | Adapter testing, data validation |
| Performance degradation | Low | Medium | Caching, async invocation, monitoring |
| Agent errors affecting users | Low | High | Error handling, user notification, rollback |
| Integration complexity | Medium | Low | Phased rollout, comprehensive testing |

---

## Knowledge Base Integration

All J4C learnings from deployment will be added to `/AGENT_SKILLS_MEMORY.md` under new section:

**Section 11: AWD2 Integration Patterns**
- How to integrate external systems with J4C agents
- Data format conversions
- Skill router best practices
- Error handling patterns
- Monitoring integration recommendations

---

## Timeline & Milestones

| Phase | Duration | Milestone | Status |
|-------|----------|-----------|--------|
| 1: Foundation | 2 weeks | Integration infrastructure complete | Starting |
| 2: User Features | 1-2 weeks | Agent Dashboard and UI components | Pending |
| 3: Core Integration | 1-2 weeks | Agents helping with AWD2 operations | Pending |
| 4: GNN Integration | 1 week | Continuous learning active | Pending |
| **Total** | **~5 weeks** | **Full Integration Complete** | **On Track** |

---

## Next Steps

1. **Approve Integration Plan** ← Current step
2. Create integration service module
3. Implement skill router
4. Build adapter layer
5. Add integration tests
6. Create Agent Dashboard UI
7. Deploy to dev3 for testing
8. Integrate with core AWD2 features
9. Enable GNN feedback loop
10. Deploy to production

---

**Document Status**: Planning Phase
**Last Updated**: October 27, 2025
**Approval Status**: Pending review

