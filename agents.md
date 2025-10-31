# HMS Agent Architecture & Ecosystem

**Document**: agents.md
**Version**: 1.0.0
**Last Updated**: October 31, 2025
**Purpose**: Complete agent ecosystem documentation for HMS project

---

## 🤖 Agent Ecosystem Overview

The HMS project leverages a sophisticated multi-agent architecture enabling specialized, coordinated development. This document maps all agents, their capabilities, and integration patterns.

**Total Agents**: 13+ active agents
**Integration Pattern**: Claude Code + Task Tool with specialized subagent types
**Coordination**: Parallel execution where possible, sequential for dependencies

---

## 1. Core Framework Agents

### 1.1 Haiku 4.5 (Primary Agent)
**Role**: Main orchestrator and CLI interface
**Capabilities**:
- File reading, editing, and writing
- Bash command execution
- Tool orchestration and sequencing
- User communication and feedback
- Task planning and management

**Responsibilities**:
- Accept user requests
- Plan task execution
- Delegate to specialized agents
- Manage todo lists
- Provide progress feedback

**Integration Points**:
- Task tool for subagent invocation
- Bash for terminal operations
- Read/Edit/Write for file management
- TodoWrite for task tracking

**Usage Pattern**:
```
User Request → Haiku 4.5 → Plan → Invoke Subagents → Coordinate → Report
```

---

## 2. Specialized Subagent Types

### 2.1 Explore Agent
**Type**: `Explore` (via Task tool)
**Purpose**: Fast codebase exploration and understanding
**Thoroughness Levels**: quick, medium, very_thorough

**Capabilities**:
- File pattern matching (glob patterns)
- Keyword-based code search
- Architecture discovery
- Dependency analysis
- Structure mapping

**Best Used For**:
- Understanding codebase organization
- Finding files by pattern
- API endpoint discovery
- Configuration analysis
- Migration planning

**Example Usage**:
```
Task("Explore", "Find all API endpoints in the codebase",
  thoroughness="medium")
```

### 2.2 Plan Agent
**Type**: `Plan` (via Task tool)
**Purpose**: Strategic planning and roadmap creation

**Capabilities**:
- Multi-step task decomposition
- Resource requirement analysis
- Timeline estimation
- Risk identification
- Dependency mapping

**Best Used For**:
- Complex feature planning
- Sprint planning
- Architecture design
- Release planning
- Migration strategies

### 2.3 Code Quality Engineer
**Type**: `code-quality-engineer` (via Task tool)
**Purpose**: Comprehensive code review and quality assurance

**Capabilities**:
- Code review and analysis
- Refactoring suggestions
- Testing strategy creation
- Code duplication detection
- Quality metrics calculation

**Best Used For**:
- Post-development review
- Quality improvements
- Test coverage analysis
- Refactoring planning
- Standards compliance

### 2.4 Jeeves4Coder Agent
**Type**: `jeeves4coder` (via Task tool)
**Purpose**: Sophisticated coding assistance and architecture

**Capabilities**:
- Elegant code solutions
- Architecture design
- Refactoring guidance
- Code review with suggestions
- Polished implementations

**Best Used For**:
- Complex coding tasks
- Architecture design
- Sophisticated solutions
- Polished implementations
- Code mentoring

**Features** (Updated Oct 31, 2025):
- Code review improvements
- Testing orchestration
- Performance profiling
- Documentation generation
- Best practices guidance

---

## 3. Specialized Domain Agents

### 3.1 Developer Tools Agent
**Definition Location**: `.claude/agents/jeeves4coder.md`
**Capabilities**: 6+ major skills
**Status**: ✅ Production Ready

**Skills Provided**:

1. **analyze-code**
   - Multi-language support (8+ languages)
   - 30+ bug pattern detection
   - Complexity metrics
   - Quality scoring (0-100)
   - Refactoring recommendations

2. **run-tests**
   - 8 test framework support
   - Coverage analysis
   - Flaky test detection
   - Parallel execution
   - Gap identification

3. **scan-security**
   - 90+ secret patterns
   - CVE vulnerability scanning
   - OWASP Top 10 coverage
   - Compliance validation
   - Severity scoring

4. **profile-code**
   - Language-specific profiling
   - Hotspot identification
   - Memory analysis
   - Optimization recommendations
   - Benchmarking

5. **generate-docs**
   - OpenAPI 3.0 generation
   - README auto-generation
   - Architecture diagrams
   - Changelog creation
   - API documentation

6. **comprehensive-review**
   - Aggregated analysis
   - Executive summaries
   - Prioritized improvements
   - Actionable plans
   - Integration support

**Integration**: Works alongside Jeeves4Coder for unified code quality
**Output Format**: JSON with structured recommendations
**Success Metrics**: Quality score improvement, test coverage %, security issues fixed

---

## 4. Project-Specific Agents

### 4.1 Exchange Connector Agent
**Status**: ✅ Complete (3,500+ LOC)
**Skills**:
- API adapter development
- Exchange integration
- Data normalization
- Error handling
- Performance optimization

**Deliverables**:
- 7 core modules
- 3 exchange adapters
- 255+ tests
- Complete documentation

### 4.2 Strategy Builder Agent
**Status**: ✅ Complete (3,400+ LOC)
**Skills**:
- DSL creation
- Strategy engine implementation
- Template development (15 templates)
- Optimizer implementation (3 types)
- Performance testing

**Deliverables**:
- Trading strategy framework
- 15 pre-built templates
- Genetic algorithm optimizer
- Bayesian optimization
- Complete documentation

### 4.3 Docker Manager Agent
**Status**: ✅ Complete (3,400+ LOC)
**Skills**:
- Container lifecycle management
- Service orchestration
- Deployment automation
- Health monitoring
- Auto-scaling configuration

**Deliverables**:
- 8 core modules
- 4 deployment strategies
- 26+ integration tests
- Encryption support
- Complete documentation

### 4.4 Mobile App Agent
**Status**: ✅ Phase 3 Foundation (2,999 LOC)
**Skills**:
- React Native development
- Redux state management
- Biometric authentication
- WebSocket integration
- Offline sync handling

**Deliverables**:
- 17 component files
- Redux store (8 slices)
- Authentication services
- WebSocket client
- Comprehensive type definitions

---

## 5. Agent Capabilities Matrix

| Agent | Code Review | Testing | Security | Architecture | Documentation | Refactoring |
|-------|-------------|---------|----------|--------------|---------------|-------------|
| Jeeves4Coder | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Code Quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Developer Tools | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Plan | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Explore | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ |

---

## 6. Integration Patterns

### 6.1 Sequential Execution
**Pattern**: Agent A → Agent B → Agent C
**Use Case**: Phases with dependencies
**Example**: Explore (understand) → Plan (design) → Code Quality (review)

### 6.2 Parallel Execution
**Pattern**: Agent A ∥ Agent B ∥ Agent C
**Use Case**: Independent analysis tasks
**Example**: Testing + Security Scan + Documentation

### 6.3 Hierarchical Orchestration
**Pattern**: Coordinator → Specialist1, Specialist2, Specialist3
**Use Case**: Complex projects with multiple components
**Example**: Haiku → [Exchange Agent, Strategy Agent, Docker Agent]

### 6.4 Feedback Loop
**Pattern**: Agent A → Review → Agent A (refine) → Agent B
**Use Case**: Iterative improvement
**Example**: Generate Code → Code Review → Refine → Re-review

---

## 7. Common Workflows

### 7.1 Feature Implementation Workflow
```
1. Plan Agent: Decompose feature requirements
2. Explore Agent: Understand related code
3. Jeeves4Coder: Implement core functionality
4. Code Quality Agent: Review and test
5. Developer Tools: Security scan & profiling
6. Documentation: Generate docs
7. Final Review: Approval checklist
```

### 7.2 Bug Fix Workflow
```
1. Explore Agent: Find affected code
2. Plan Agent: Design solution
3. Jeeves4Coder: Implement fix
4. Code Quality Agent: Review
5. Developer Tools: Run tests & security scan
6. Validation: Verify fix works
```

### 7.3 Optimization Workflow
```
1. Developer Tools: Profile code (identify hotspots)
2. Plan Agent: Design optimization strategy
3. Jeeves4Coder: Implement optimizations
4. Developer Tools: Benchmark improvements
5. Code Quality: Review changes
6. Documentation: Update performance notes
```

### 7.4 Migration Workflow
```
1. Explore Agent: Map existing system
2. Plan Agent: Design migration strategy
3. Developer Tools: Analyze dependencies
4. Jeeves4Coder: Implement migration
5. Code Quality: Comprehensive testing
6. Validation: Data integrity verification
```

---

## 8. Agent Communication

### 8.1 Task Tool Interface
**Purpose**: Invoke subagents with detailed specifications
**Parameters**:
- `subagent_type`: Agent type (explore, plan, code-quality-engineer, jeeves4coder)
- `description`: 3-5 word task summary
- `prompt`: Detailed task specification
- `model`: Optional (haiku, sonnet, opus)

**Example**:
```
Task(
  subagent_type="code-quality-engineer",
  description="Review new trading engine",
  prompt="Comprehensive code review of src/engine/tradingEngine.ts including...",
  model="sonnet"
)
```

### 8.2 Output Processing
**Standard Format**:
```
{
  "status": "complete" | "in_progress" | "error",
  "summary": "Executive summary",
  "details": [ ... ],
  "recommendations": [ ... ],
  "metrics": { ... }
}
```

### 8.3 Error Handling
**Retry Strategy**:
1. First attempt with detailed prompt
2. If timeout: retry with simplified prompt
3. If failure: escalate to human or different agent
4. Log all attempts in session context

---

## 9. Performance Characteristics

### 9.1 Agent Execution Times
| Agent Type | Typical Duration | Complexity |
|------------|-----------------|-----------|
| Explore (quick) | 2-5 minutes | Low |
| Explore (medium) | 5-15 minutes | Medium |
| Explore (very_thorough) | 15-30 minutes | High |
| Plan | 10-20 minutes | Medium |
| Code Quality | 10-30 minutes | Medium-High |
| Jeeves4Coder | 15-45 minutes | High |

### 9.2 Cost Optimization
**Strategy**:
- Use Explore (quick) before medium/thorough
- Parallelize independent tasks
- Reuse context from previous sessions
- Cache expensive analysis results

---

## 10. Best Practices

### 10.1 Agent Selection
- ✅ Use specialized agents for domain expertise
- ✅ Parallelize when tasks are independent
- ✅ Maintain context across related tasks
- ❌ Don't force sequential execution for parallel tasks
- ❌ Don't use heavyweight agents for simple tasks

### 10.2 Prompt Engineering
- ✅ Provide clear, specific requirements
- ✅ Include context about project and goals
- ✅ Ask for structured output (JSON)
- ✅ Specify success criteria upfront
- ❌ Don't provide vague or open-ended prompts

### 10.3 Result Validation
- ✅ Always review agent outputs before committing
- ✅ Run tests on generated code
- ✅ Validate security recommendations
- ✅ Cross-check documentation accuracy
- ❌ Don't blindly accept all suggestions

---

## 11. Future Agent Expansion

**Planned Agents** (Sprints 4-6):
1. **Analytics Agent** - Metrics aggregation & reporting
2. **CLI Agent** - Command-line interface development
3. **Sync Agent** - Data synchronization frameworks
4. **DevOps Agent** - Infrastructure management
5. **Testing Agent** - QA framework implementation
6. **Security Agent** - Vulnerability assessment

---

## 12. Troubleshooting

### 12.1 Common Issues

**Issue**: Agent timeout
**Solution**:
1. Reduce scope of prompt
2. Use quick/medium thoroughness first
3. Break into smaller tasks
4. Check token usage

**Issue**: Inconsistent output quality
**Solution**:
1. Provide more context
2. Include examples
3. Use structured output format
4. Specify success criteria clearly

**Issue**: Agent confusion about requirements
**Solution**:
1. Include project background
2. Provide relevant code samples
3. Reference existing patterns
4. Clarify constraints upfront

---

## 13. Resource Links

**Agent Documentation**:
- `.claude/agents/jeeves4coder.md` - Developer Tools Agent
- `AGENTS_AND_SKILLS_INVENTORY.md` - Complete skills inventory
- `AGENT_KNOWLEDGE_INDEX.md` - Knowledge base index
- `AGENT_SKILLS_MEMORY.md` - Skills memory management

**Project Context**:
- `context.md` - Main context file (THIS FILE REFERENCES)
- `skills.md` - Skills specifications
- `session.md` - Session tracking

**Integration Guides**:
- `COMPLETE_SESSION_SUMMARY.md` - Session summaries
- `CLAUDE_CODE_AGENT_SUMMARY.md` - Agent overview
- `PROJECT_LEARNINGS_FOR_AGENTS.md` - Lessons learned

---

## Summary

The HMS agent ecosystem provides:
- ✅ 13+ specialized agents for coordinated development
- ✅ Flexible orchestration patterns (sequential, parallel, hierarchical)
- ✅ Rich capabilities matrix covering all development phases
- ✅ Proven workflows for common scenarios
- ✅ Continuous improvement through feedback loops
- ✅ Production-ready code generation and review

**Next Update**: Add agents from Sprints 4-6 implementations

**#memorize**: agents.md created Oct 31, 2025. Documents 13+ agent ecosystem (Haiku, Explore, Plan, Code Quality, Jeeves4Coder, Developer Tools, Exchange, Strategy, Docker, Mobile, and 3 planned). Capabilities matrix, integration patterns (sequential/parallel), workflows (feature/bug/optimization/migration), communication via Task tool, performance stats, best practices, troubleshooting. 👥🤖

---

**Document Version**: 1.0.0
**Last Updated**: October 31, 2025
**Status**: ✅ Complete & Reviewed
