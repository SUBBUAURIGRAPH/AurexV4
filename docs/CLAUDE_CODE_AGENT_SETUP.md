# Claude Code Jeeves4coder Agent Setup & Usage Guide

**Date**: 2025-10-23
**Agent Name**: Jeeves4coder Agent
**Type**: Claude Code Sub-Agent
**Status**: ✅ Ready for Use
**Location**: `.claude/agents/jeeves4coder.md`

---

## Overview

The **Jeeves4coder Agent** is a sophisticated Claude Code sub-agent that combines refined butler-like professionalism with deep programming expertise. It's designed to be PROACTIVELY invoked for code quality tasks, providing comprehensive code reviews, architectural guidance, refactoring suggestions, and security analysis.

### Key Capabilities

- ✅ **Code Review**: Comprehensive analysis with quality metrics
- ✅ **Refactoring**: Strategic refactoring for improvement
- ✅ **Architecture**: System design and pattern recommendations
- ✅ **Performance**: Optimization analysis and benchmarking
- ✅ **Security**: Vulnerability detection and hardening
- ✅ **Testing**: Test strategy and coverage improvement
- ✅ **Documentation**: Code documentation enhancement
- ✅ **Design Patterns**: Pattern selection and implementation

---

## Installation & Setup

### Step 1: Verify Agent File Location

The Jeeves4coder agent is located in your project's `.claude/agents/` directory:

```
.claude/
└── agents/
    └── jeeves4coder.md
```

This is a **project-level agent** that applies only to this repository.

### Step 2: Configuration Details

**Agent File**: `.claude/agents/jeeves4coder.md`

**YAML Configuration**:
```yaml
---
name: Jeeves4coder Agent
description: |
  Sophisticated coding assistant for code review, refactoring, architecture guidance,
  and quality improvements. PROACTIVELY use for code quality tasks.
tools: Read, Edit, Glob, Grep, Bash, Task, ExitPlanMode, AskUserQuestion,
        TodoWrite, WebFetch, Bash, NotebookEdit
model: haiku
---
```

### Step 3: Activation

The agent is automatically available in Claude Code. No additional setup required!

To use it, reference it by name in your commands:
```
Jeeves4coder, please review this code for quality issues.
```

---

## How to Use Jeeves4coder Agent

### Method 1: Direct Invocation

Use the agent name directly in your request:

```
Jeeves4coder, review this TypeScript function for performance issues:

[paste code]
```

### Method 2: Automatic Delegation

Claude Code will PROACTIVELY delegate to Jeeves4coder when it detects:

**Code Review Triggers**:
- "review this code"
- "code review needed"
- "check this function"
- "analyze this code"
- "quality issues"

**Refactoring Triggers**:
- "refactor this"
- "this class is too large"
- "simplify this code"
- "reduce complexity"

**Architecture Triggers**:
- "review the architecture"
- "how should I design this"
- "architecture decision"
- "system design review"

**Performance Triggers**:
- "optimize this"
- "performance issue"
- "slow code"
- "benchmark this"

**Security Triggers**:
- "security audit"
- "vulnerability check"
- "secure this code"
- "compliance review"

---

## Supported Languages

The Jeeves4coder Agent supports 10+ programming languages:

| Language | Expertise | Frameworks |
|----------|-----------|-----------|
| JavaScript/TypeScript | Expert | React, Vue, Angular, Node.js, Express |
| Python | Expert | Django, Flask, FastAPI, async/await |
| Java | Intermediate | Spring Boot, Gradle, Maven |
| C/C++ | Intermediate | Modern C++, STL, templates |
| Go | Intermediate | Goroutines, channels, packages |
| Rust | Intermediate | Ownership, traits, macros |
| SQL | Expert | Query optimization, indexing |
| Ruby | Intermediate | Rails, gems, conventions |
| PHP | Intermediate | Laravel, Symfony, modern PHP |
| Kotlin | Basic | Coroutines, null safety |

---

## Use Cases & Examples

### Example 1: Code Review Request

**Your Request**:
```
Jeeves4coder, please review this React component for best practices:

export const UserCard = ({ user, onDelete }) => {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    setLoading(false);
    onDelete(user.id);
  };

  return (
    <div className="card">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
      <button onClick={handleDelete} disabled={loading}>
        {loading ? 'Deleting...' : 'Delete'}
      </button>
    </div>
  );
};
```

**Expected Response**: Comprehensive review covering:
- Component structure and clarity
- Error handling (fetch error case missing)
- Accessibility considerations
- Performance implications
- React best practices
- Testing suggestions

---

### Example 2: Architecture Review

**Your Request**:
```
Jeeves4coder, review the architecture of our trading system. Here's the structure:
- API Gateway (nginx)
- Backend microservices (Node.js)
- MongoDB database
- Redis cache
- Message queue (RabbitMQ)

Key flows:
1. Strategy submission → validation → storage
2. Backtesting → long-running job → results storage
3. Live trading → execution → logging

Should we change anything?
```

**Expected Response**: Detailed analysis including:
- Scalability assessment
- Single points of failure
- Message queue necessity
- Database schema optimization
- Recommended patterns
- Technology recommendations

---

### Example 3: Refactoring Request

**Your Request**:
```
Jeeves4coder, this class is getting too large. How should I refactor it?

[paste large class code]
```

**Expected Response**: Step-by-step refactoring with:
- Design patterns to apply
- Class breakdown suggestions
- Responsibility separation
- Before/after code examples
- Migration strategy

---

### Example 4: Performance Optimization

**Your Request**:
```
Jeeves4coder, our dashboard loads in 8 seconds. Help us optimize:

[paste API calls, database queries, and rendering code]
```

**Expected Response**: Analysis covering:
- Performance bottleneck identification
- Query optimization suggestions
- Caching strategies
- Component optimization
- Code examples with metrics

---

### Example 5: Security Audit

**Your Request**:
```
Jeeves4coder, please audit this authentication code for vulnerabilities:

[paste authentication code]
```

**Expected Response**: Security assessment including:
- Vulnerability identification
- OWASP Top 10 alignment
- Secure coding best practices
- Hardening recommendations
- Implementation examples

---

## Agent Tools & Capabilities

The Jeeves4coder Agent has access to these Claude Code tools:

### File Operations
- **Read**: Read code files for analysis
- **Edit**: Suggest code modifications
- **Glob**: Find files matching patterns
- **Grep**: Search code for patterns

### Execution
- **Bash**: Execute commands for testing/validation
- **Task**: Delegate complex sub-tasks to specialized agents
- **NotebookEdit**: Modify Jupyter notebooks

### Planning & Organization
- **TodoWrite**: Create task lists for refactoring
- **ExitPlanMode**: Plan implementation steps

### User Interaction
- **AskUserQuestion**: Ask clarifying questions
- **WebFetch**: Research documentation

---

## Best Practices for Jeeves4coder

### ✅ DO:

1. **Provide Full Context**
   ```
   Jeeves4coder, review this authentication module for security.
   It's part of our Node.js backend, uses JWT tokens, and must
   support OAuth2. Here's the code:
   [full code with context]
   ```

2. **Specify Goals Clearly**
   ```
   Jeeves4coder, refactor this for maintainability and testability,
   breaking it into smaller, single-responsibility classes.
   ```

3. **Share Constraints**
   ```
   Jeeves4coder, optimize this for mobile devices (2G networks),
   minimizing bundle size and initialization time.
   ```

4. **Request Specific Aspects**
   ```
   Jeeves4coder, review for security vulnerabilities and
   performance issues. Focus on database query optimization.
   ```

5. **Ask for Examples**
   ```
   Jeeves4coder, suggest a design pattern for this, and provide
   a complete before/after implementation example.
   ```

### ❌ DON'T:

1. **Provide Minimal Context**
   ```
   ❌ "Review this code"
   ✅ "Review this React component for performance and accessibility"
   ```

2. **Be Vague About Goals**
   ```
   ❌ "Make this better"
   ✅ "Reduce complexity, improve testability, add error handling"
   ```

3. **Ask for General Help**
   ```
   ❌ "How do I code?"
   ✅ "How can I structure this module using the Strategy pattern?"
   ```

4. **Ignore Feedback**
   ```
   ❌ "My approach is the best, just tell me it's good"
   ✅ "Here's my approach - how can I improve it?"
   ```

5. **Skip Implementation Details**
   ```
   ❌ "Optimize this" (without code)
   ✅ "Here's the slow code - optimize for O(n) complexity"
   ```

---

## Common Tasks

### Task 1: Pre-Merge Code Review

```
Jeeves4coder, conduct a comprehensive code review of this feature:
[Feature branch code]

Please evaluate:
- Code quality and best practices
- Test coverage
- Security vulnerabilities
- Performance implications
- Documentation clarity

Is this ready for production?
```

### Task 2: Architecture Decision

```
Jeeves4coder, help us decide between these two approaches:

Approach A: [monolithic service description]
Approach B: [microservices description]

We need:
- Scalability for 10,000 concurrent users
- Minimal latency
- Easy deployment
- Team of 5 engineers

Which approach and why?
```

### Task 3: Legacy Code Modernization

```
Jeeves4coder, help modernize this legacy code:
[old code]

Goals:
- Update to modern JavaScript (ES2020+)
- Improve readability
- Add TypeScript
- Improve test coverage

Where should we start?
```

### Task 4: Performance Baseline

```
Jeeves4coder, analyze this code and suggest optimization targets:
[code]

Current metrics:
- Load time: 5 seconds
- Bundle size: 500KB
- Memory: 50MB

Target: 2 seconds, 200KB, 20MB

What's the path?
```

### Task 5: Security Hardening

```
Jeeves4coder, security audit of our API:
[API code]

Requirements:
- PCI DSS compliance
- OWASP Top 10 coverage
- Data encryption at rest
- Rate limiting

What are the gaps?
```

---

## Response Quality Expectations

When you work with Jeeves4coder, expect:

### Comprehensive Analysis
- Deep examination of all code aspects
- Multiple perspectives and approaches
- Trade-off analysis
- Real-world considerations

### Actionable Recommendations
- Clear, step-by-step improvements
- Before/after code examples
- Priority-ordered suggestions
- Implementation guidance

### Professional Service
- Respectful and constructive tone
- Recognition of context and constraints
- Practical wisdom
- Focus on long-term quality

### Detailed Documentation
- Explanations of why changes matter
- References to best practices
- Links to relevant patterns
- Implementation examples

---

## Integration with Other Agents

Jeeves4coder works alongside other Aurigraph agents:

| Agent | When to Use with Jeeves4coder |
|-------|-------------------------------|
| DevOps Engineer | Infrastructure code review |
| Frontend Developer | UI/UX code quality |
| DLT Developer | Smart contract review |
| QA Engineer | Test strategy |
| Security & Compliance | Security audits |
| Data Engineer | Data pipeline optimization |
| Project Manager | Code quality metrics |

---

## Troubleshooting

### Agent Not Being Invoked?

**Check your trigger phrases**: Use explicit code review keywords
```
✅ "Jeeves4coder, review this code"
❌ "Check this out"
```

**Be explicit about the task**:
```
✅ "Code review for security issues"
❌ "What do you think?"
```

### Response Not Matching Expectations?

**Provide more context**:
```
✅ Include: language, framework, constraints, goals
❌ Don't provide isolated code snippets
```

**Be specific about needs**:
```
✅ "Review for performance, focusing on DB queries"
❌ "Review this"
```

### Need Different Model?

The agent uses Haiku model for speed. If you need more complex analysis:

1. Explicitly ask Jeeves4coder for deeper analysis
2. Ask it to use Task tool to delegate to a specialized agent
3. Mention specific complexity needs

---

## File Locations & Structure

```
.claude/
├── agents/
│   └── jeeves4coder.md          ← Agent configuration
└── commands/
    └── (optional: custom commands)

docs/
├── CLAUDE_CODE_AGENT_SETUP.md   ← This file
└── JEEVES4CODER_INTEGRATION.md
```

---

## Customization

To customize Jeeves4coder for your project:

1. **Edit Tools**: Modify `tools:` field to restrict/expand access
2. **Edit Model**: Change `model:` field (haiku, sonnet, opus)
3. **Edit Description**: Customize trigger phrases in description
4. **Edit Prompt**: Modify system prompt for project-specific guidance

Example customization:
```yaml
---
name: Jeeves4coder Agent
description: Code quality expert for React/TypeScript projects...
tools: Read, Edit, Glob, Grep, Bash  # Limited tools
model: sonnet  # More capable model
---

# Custom system prompt for your team...
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-10-23 | Initial Claude Code agent creation |

---

## Support & Resources

### Documentation Files
- **Agent Configuration**: `.claude/agents/jeeves4coder.md`
- **Integration Guide**: `docs/JEEVES4CODER_INTEGRATION.md`
- **Setup Guide**: `docs/CLAUDE_CODE_AGENT_SETUP.md` (this file)

### Claude Code Documentation
- [Sub-agents Documentation](https://docs.claude.com/en/docs/claude-code/sub-agents)
- [Plugins Guide](https://docs.claude.com/en/docs/claude-code/plugins)
- [CLI Reference](https://docs.claude.com/en/docs/claude-code/cli-reference)

### Getting Help
- Use `/help` in Claude Code for available commands
- Run `/agents` to manage agents
- Check Claude Code documentation at docs.claude.com

---

## Summary

The **Jeeves4coder Agent** is ready to use in your Claude Code environment!

### Quick Start:
1. Agent is already configured at `.claude/agents/jeeves4coder.md`
2. Reference it in your requests: "Jeeves4coder, review this code"
3. It will PROACTIVELY engage on code quality tasks
4. Provide full context for best results

### Next Steps:
- Use Jeeves4coder for your next code review
- Try the various trigger phrases and use cases
- Integrate with your development workflow
- Customize if needed for team preferences

**Ready to improve your code quality with Jeeves4coder!** 🎩

