# SPARC Template: Skill Development

**Skill Name**: [Enter skill name]
**Agent**: [Target agent name]
**Developer**: [Your name]
**Date Started**: [YYYY-MM-DD]
**Target Completion**: [YYYY-MM-DD]

---

## Phase 1: Specification

### Problem Statement

**What problem does this skill solve?**
[Describe the problem in 2-3 sentences]

**Why is this skill needed?**
[Explain the business value and impact]

**Who will use this skill?**
[List primary users and stakeholders]

### Requirements

#### Functional Requirements
- **FR1**: [First functional requirement]
- **FR2**: [Second functional requirement]
- **FR3**: [Third functional requirement]
- **FR4**: [Additional requirements as needed]

#### Non-Functional Requirements
- **NFR1 - Performance**: [Response time, throughput targets]
- **NFR2 - Security**: [Security requirements]
- **NFR3 - Reliability**: [Uptime, success rate targets]
- **NFR4 - Scalability**: [Scalability requirements]
- **NFR5 - Maintainability**: [Code quality, documentation standards]

#### Constraints
- [Technical constraints]
- [Business constraints]
- [Resource constraints]
- [Timeline constraints]

### Use Cases

#### Primary Use Case 1
**Title**: [Use case name]
**Actor**: [Who performs this action]
**Preconditions**: [What must be true before]
**Steps**:
1. [Step 1]
2. [Step 2]
3. [Step 3]
**Expected Result**: [What should happen]
**Success Criteria**: [How to measure success]

#### Primary Use Case 2
[Repeat structure above]

#### Edge Cases
1. **Edge Case 1**: [Description and handling]
2. **Edge Case 2**: [Description and handling]
3. **Edge Case 3**: [Description and handling]

### Acceptance Criteria

- [ ] Criterion 1: [Specific, measurable criterion]
- [ ] Criterion 2: [Specific, measurable criterion]
- [ ] Criterion 3: [Specific, measurable criterion]
- [ ] Criterion 4: [Specific, measurable criterion]
- [ ] Performance: [Specific performance target]
- [ ] Quality: [Specific quality target]
- [ ] Documentation: Complete and accurate

### Stakeholder Sign-off

- [ ] Product Owner: [Name] - Date: ___________
- [ ] Technical Lead: [Name] - Date: ___________
- [ ] Security Team: [Name] - Date: ___________
- [ ] QA Lead: [Name] - Date: ___________

**Specification Status**: ⏳ Not Started / 🔄 In Progress / ✅ Complete

---

## Phase 2: Pseudocode

### High-Level Algorithm

```
SKILL: [skill-name]

FUNCTION main_skill_function(input_params):
  // Step 1: Input validation
  VALIDATE inputs
    - Check param1 is valid
    - Check param2 is in range
    - Verify prerequisites met
  IF validation fails:
    RETURN error_response

  // Step 2: Initialization
  INITIALIZE resources
    - Load configuration
    - Connect to services
    - Setup context

  // Step 3: Main processing
  TRY:
    EXECUTE main_logic()
      - [Key operation 1]
      - [Key operation 2]
      - [Key operation 3]
  CATCH error:
    HANDLE error
    CLEANUP resources
    RETURN error_response

  // Step 4: Post-processing
  PROCESS results
    - Format output
    - Generate reports
    - Update state

  // Step 5: Cleanup and return
  CLEANUP resources
  RETURN success_response
END FUNCTION
```

### Function Decomposition

#### Function 1: validate_inputs
```
FUNCTION validate_inputs(params):
  INPUT: { param1, param2, param3, ... }

  FOR each param in params:
    IF param is invalid:
      ADD error to error_list

  IF error_list not empty:
    RETURN { valid: false, errors: error_list }

  RETURN { valid: true }
END FUNCTION
```

#### Function 2: [next_key_function]
```
FUNCTION [function_name](input):
  INPUT: [description]
  OUTPUT: [description]

  [Pseudocode logic here]

  RETURN [result]
END FUNCTION
```

#### Function 3: [another_function]
```
[Continue for all major functions]
```

### Data Flow

```
Input → Validation → Processing → Output

1. Input Validation
   - Raw input parameters
   ↓
   - Validated parameters

2. Data Processing
   - Validated parameters
   ↓
   - Intermediate results
   ↓
   - Processed data

3. Output Formatting
   - Processed data
   ↓
   - Formatted response
```

### Error Handling Strategy

| Error Type | Detection | Handling | Recovery |
|------------|-----------|----------|----------|
| Invalid Input | Input validation | Return error message | User retry |
| Service Unavailable | Connection check | Retry with backoff | Failover |
| Timeout | Timer | Cancel operation | Retry or abort |
| Resource Exhausted | Resource check | Queue or reject | Scale or wait |

### Edge Cases Handling

1. **Edge Case 1**: [Description]
   ```
   IF [condition]:
     [Handling logic]
   ```

2. **Edge Case 2**: [Description]
   ```
   [Pseudocode for handling]
   ```

**Pseudocode Status**: ⏳ Not Started / 🔄 In Progress / ✅ Complete

---

## Phase 3: Architecture

### Component Structure

```
skill-[name]/
├── core/
│   ├── [main-logic].js        # Core skill logic
│   ├── validator.js            # Input validation
│   ├── processor.js            # Main processing
│   └── formatter.js            # Output formatting
├── integrations/
│   ├── [service1].js           # External service 1
│   ├── [service2].js           # External service 2
│   └── [service3].js           # External service 3
├── utils/
│   ├── logger.js               # Logging utilities
│   ├── error-handler.js        # Error handling
│   └── helpers.js              # Helper functions
├── tests/
│   ├── unit/
│   │   ├── core.test.js
│   │   └── integrations.test.js
│   ├── integration/
│   │   └── end-to-end.test.js
│   └── fixtures/
│       └── test-data.js
└── config/
    ├── default.js              # Default configuration
    └── environments.js         # Environment-specific config
```

### Component Diagram

```
┌─────────────────────────────────────────────────┐
│                 Skill Interface                  │
│              (Entry Point/API)                   │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌────────┐  ┌─────────┐  ┌──────────┐
    │ Input  │  │  Core   │  │  Output  │
    │Validator│ │Processor│  │Formatter │
    └────────┘  └─────────┘  └──────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         ▼           ▼           ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐
    │Service 1│ │Service 2│ │Service 3│
    │  API    │ │  API    │ │  API    │
    └─────────┘ └─────────┘ └─────────┘
```

### Key Interfaces

#### ISkill
```javascript
interface ISkill {
  name: string;
  version: string;
  execute(params: SkillParams): Promise<SkillResult>;
  validate(params: SkillParams): ValidationResult;
  rollback?(context: RollbackContext): Promise<void>;
}
```

#### IValidator
```javascript
interface IValidator {
  validate(input: unknown): ValidationResult;
  sanitize(input: unknown): SanitizedInput;
}
```

#### IProcessor
```javascript
interface IProcessor {
  process(input: ValidatedInput): Promise<ProcessResult>;
  cancel(): void;
}
```

### Technology Stack

**Runtime**:
- Node.js: 18+ (LTS)
- TypeScript: 5.0+ (if applicable)

**Dependencies**:
- [Library 1]: [Version] - [Purpose]
- [Library 2]: [Version] - [Purpose]
- [Library 3]: [Version] - [Purpose]

**Testing**:
- Jest: Unit and integration testing
- Supertest: API testing
- [Tool]: [Purpose]

**Infrastructure**:
- [Service 1]: [Purpose]
- [Service 2]: [Purpose]

### Design Patterns

1. **Pattern 1**: [Name]
   - **Purpose**: [Why using this pattern]
   - **Implementation**: [Where/how applied]

2. **Pattern 2**: [Name]
   - **Purpose**: [Why using this pattern]
   - **Implementation**: [Where/how applied]

### Data Models

#### Input Model
```javascript
{
  param1: string,           // Description
  param2: number,           // Description
  param3?: boolean,         // Optional: Description
  options: {
    option1: string,
    option2: number
  }
}
```

#### Output Model
```javascript
{
  success: boolean,
  data: {
    result1: string,
    result2: number,
    metadata: object
  },
  error?: {
    code: string,
    message: string,
    details: object
  }
}
```

### Non-Functional Design

#### Performance
- Target response time: [X] seconds
- Maximum concurrent requests: [N]
- Resource limits: [CPU/Memory]

#### Security
- Authentication: [Method]
- Authorization: [Method]
- Input sanitization: [Method]
- Audit logging: [What to log]

#### Scalability
- Horizontal scaling: [Approach]
- Vertical scaling: [Approach]
- Load balancing: [Strategy]

#### Monitoring
- Metrics to track:
  - [Metric 1]: [Description]
  - [Metric 2]: [Description]
- Logging strategy: [Approach]
- Alerting thresholds: [Criteria]

**Architecture Status**: ⏳ Not Started / 🔄 In Progress / ✅ Complete

---

## Phase 4: Refinement

### Implementation Progress

- [ ] Core logic implemented
- [ ] Input validation implemented
- [ ] Output formatting implemented
- [ ] Error handling implemented
- [ ] External integrations implemented
- [ ] Configuration management implemented
- [ ] Logging implemented
- [ ] Documentation implemented

### Testing Progress

#### Unit Tests
- [ ] Core logic tests (Target: 80%+ coverage)
- [ ] Validator tests
- [ ] Processor tests
- [ ] Formatter tests
- [ ] Utils tests
- **Current Coverage**: [X]%

#### Integration Tests
- [ ] End-to-end workflow tests
- [ ] External service integration tests
- [ ] Error scenario tests
- [ ] Edge case tests

#### Performance Tests
- [ ] Load testing (concurrent requests)
- [ ] Stress testing (maximum capacity)
- [ ] Response time validation
- **Results**: [Summary]

#### Security Tests
- [ ] Input validation tests
- [ ] Authentication tests
- [ ] Authorization tests
- [ ] Vulnerability scan
- **Security Score**: [X]/100

### Code Review

**Review 1**:
- **Reviewer**: [Name]
- **Date**: [YYYY-MM-DD]
- **Status**: ⏳ Pending / ✅ Approved / ⛔ Changes Requested
- **Comments**: [Summary or link to review comments]

**Review 2**:
- **Reviewer**: [Name]
- **Date**: [YYYY-MM-DD]
- **Status**: ⏳ Pending / ✅ Approved / ⛔ Changes Requested
- **Comments**: [Summary or link to review comments]

### Iteration Log

#### Iteration 1
- **Date**: [YYYY-MM-DD]
- **Changes**: [What was changed]
- **Reason**: [Why changed]
- **Result**: [Outcome]

#### Iteration 2
- **Date**: [YYYY-MM-DD]
- **Changes**: [What was changed]
- **Reason**: [Why changed]
- **Result**: [Outcome]

### Performance Benchmarks

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Response Time (p50) | [X]ms | [Y]ms | ✅/⛔ |
| Response Time (p95) | [X]ms | [Y]ms | ✅/⛔ |
| Response Time (p99) | [X]ms | [Y]ms | ✅/⛔ |
| Throughput | [X]/sec | [Y]/sec | ✅/⛔ |
| Error Rate | <[X]% | [Y]% | ✅/⛔ |
| Memory Usage | <[X]MB | [Y]MB | ✅/⛔ |

### Quality Checklist

- [ ] Code follows style guide
- [ ] No code smells detected
- [ ] No security vulnerabilities
- [ ] All functions documented
- [ ] Error messages are clear
- [ ] Logging is comprehensive
- [ ] Configuration is externalized
- [ ] Tests are comprehensive
- [ ] Performance meets targets
- [ ] Security scan passes

**Refinement Status**: ⏳ Not Started / 🔄 In Progress / ✅ Complete

---

## Phase 5: Completion

### Final Testing

- [ ] End-to-end testing complete
- [ ] User acceptance testing complete
- [ ] Performance validation complete
- [ ] Security validation complete
- [ ] All acceptance criteria met

### Documentation

- [ ] User documentation complete
- [ ] API documentation complete
- [ ] Code documentation complete
- [ ] Troubleshooting guide complete
- [ ] Examples and tutorials complete

### Deployment

#### Staging Deployment
- **Date**: [YYYY-MM-DD]
- **Status**: ⏳ Pending / ✅ Complete
- **Smoke Test Results**: [Pass/Fail]
- **Issues Found**: [List or None]

#### Production Deployment
- **Date**: [YYYY-MM-DD]
- **Status**: ⏳ Pending / ✅ Complete
- **Deployment Strategy**: [Blue-green / Rolling / Recreate]
- **Smoke Test Results**: [Pass/Fail]
- **Monitoring Status**: [Active / Inactive]

### Monitoring Setup

- [ ] Metrics dashboard created
- [ ] Alerts configured
- [ ] Logging enabled
- [ ] Performance baseline established
- [ ] On-call rotation updated

### Team Handoff

- [ ] Team training completed
- [ ] Documentation shared
- [ ] Runbook created
- [ ] Support process defined
- [ ] Knowledge transfer complete

### Post-Deployment Validation

- [ ] Health checks passing
- [ ] Metrics within normal range
- [ ] No critical errors
- [ ] User feedback positive
- [ ] Performance meets targets

### Success Metrics

| Metric | Baseline | Target | Actual | Status |
|--------|----------|--------|--------|--------|
| Time Saved | [X]min | [Y]min | [Z]min | ✅/⛔ |
| Error Reduction | [X]% | [Y]% | [Z]% | ✅/⛔ |
| User Adoption | [X]% | [Y]% | [Z]% | ✅/⛔ |
| User Satisfaction | [X]/5 | [Y]/5 | [Z]/5 | ✅/⛔ |

### Lessons Learned

#### What Went Well
1. [Success 1]
2. [Success 2]
3. [Success 3]

#### What Could Be Improved
1. [Improvement 1]
2. [Improvement 2]
3. [Improvement 3]

#### Action Items for Future
1. [Action 1]
2. [Action 2]
3. [Action 3]

**Completion Status**: ⏳ Not Started / 🔄 In Progress / ✅ Complete

---

## SPARC Summary

### Overall Progress

| Phase | Status | Completion Date | Duration |
|-------|--------|----------------|----------|
| Specification | ⏳/🔄/✅ | [YYYY-MM-DD] | [X] hours |
| Pseudocode | ⏳/🔄/✅ | [YYYY-MM-DD] | [X] hours |
| Architecture | ⏳/🔄/✅ | [YYYY-MM-DD] | [X] hours |
| Refinement | ⏳/🔄/✅ | [YYYY-MM-DD] | [X] hours |
| Completion | ⏳/🔄/✅ | [YYYY-MM-DD] | [X] hours |
| **Total** | ⏳/🔄/✅ | [YYYY-MM-DD] | [X] hours |

### Key Artifacts

- **Specification Document**: [Link or location]
- **Pseudocode**: [Link or location]
- **Architecture Diagrams**: [Link or location]
- **Source Code**: [Repository link]
- **Test Suite**: [Location]
- **Documentation**: [Link or location]
- **Deployment Guide**: [Link or location]

### Final Sign-off

- [ ] All SPARC phases complete
- [ ] All acceptance criteria met
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Production deployment successful
- [ ] Team training complete
- [ ] Monitoring active

**Sign-off**:
- Project Manager: _________________ Date: _________
- Technical Lead: _________________ Date: _________
- QA Lead: _________________ Date: _________
- Product Owner: _________________ Date: _________

---

**Skill Development Complete!** 🎉

**Next Steps**:
1. Continue monitoring in production
2. Collect user feedback
3. Plan enhancements for next version
4. Update documentation as needed
