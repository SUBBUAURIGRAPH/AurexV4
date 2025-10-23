# Standard Operating Procedures (SOPs)

**Repository**: glowing-adventure (Aurigraph Agent Architecture)
**Version**: 2.0.0
**Last Updated**: October 20, 2025

---

## Table of Contents

1. [Purpose & Scope](#purpose--scope)
2. [SPARC Framework SOPs](#sparc-framework-sops) ⭐ **NEW**
3. [Agent Quality Standards](#agent-quality-standards)
4. [Agent Usage SOPs](#agent-usage-sops)
5. [Skill Implementation SOPs](#skill-implementation-sops)
6. [Quality Assurance Procedures](#quality-assurance-procedures)
7. [Incident Response](#incident-response)
8. [Continuous Improvement](#continuous-improvement)

---

## Purpose & Scope

### Purpose
These SOPs ensure consistent, high-quality use and development of the Aurigraph Agent Architecture across all teams and projects.

### Scope
- Agent usage and invocation
- Skill implementation and deployment
- Quality assurance and testing
- Documentation standards
- Team collaboration
- Incident response
- **NEW**: SPARC Framework methodology for all development

---

## SPARC Framework SOPs

### Overview

**SPARC Framework** (Specification, Pseudocode, Architecture, Refinement, Completion) is the default methodology for all Aurigraph Agent Architecture development. These SOPs ensure consistent application across all teams.

**Framework Reference**: See `docs/SPARC_FRAMEWORK.md` for detailed guidance.

### SOP 0.1: When to Use SPARC

**Apply SPARC Framework for**:
- ✅ Creating new agents
- ✅ Implementing new skills
- ✅ Major feature enhancements
- ✅ Critical integrations
- ✅ Architectural decisions
- ✅ Important documentation

**Skip SPARC Framework for**:
- ⏭️ Minor bug fixes
- ⏭️ Small documentation updates
- ⏭️ Simple refactoring
- ⏭️ Template copying without changes

### SOP 0.2: Phase Gate Process

**Phase Transition Requirements**:

Each phase must be marked complete before proceeding to the next. Use this checklist for phase gates:

**Specification → Pseudocode Gate**:
- [ ] All functional requirements documented
- [ ] All technical requirements documented
- [ ] User journeys mapped
- [ ] Success metrics defined
- [ ] Constraints identified
- [ ] Team alignment confirmed
- [ ] Stakeholder sign-off received

**Pseudocode → Architecture Gate**:
- [ ] Pseudocode complete and reviewed
- [ ] Data structures fully defined
- [ ] Integration points identified
- [ ] Error scenarios documented
- [ ] Technical review passed
- [ ] Feasibility confirmed

**Architecture → Refinement Gate**:
- [ ] Architecture diagrams complete
- [ ] All components specified
- [ ] Security design complete
- [ ] API specs drafted
- [ ] Deployment plan sketched
- [ ] Architecture review approved

**Refinement → Completion Gate**:
- [ ] Design review complete
- [ ] Testing strategy detailed
- [ ] Code standards documented
- [ ] Documentation template prepared
- [ ] Resource allocation confirmed

**Completion → Deployment Gate**:
- [ ] Code coverage at 80%+
- [ ] All tests passing
- [ ] Code review approved (2+ reviewers)
- [ ] Documentation complete
- [ ] Security review passed

### SOP 0.3: SPARC Documentation Updates

**In CONTEXT.md**:
After each major phase, update the context file with:
- New requirements or constraints discovered
- Integration points identified
- Technology choices made
- Timeline adjustments

**In TODO.md**:
Add phase tracking like this:
```markdown
### [Skill/Agent Name]
- Phase 1 - Specification: ✅ 2025-10-23
- Phase 2 - Pseudocode: 🔄 In Progress (Est. 2025-10-24)
- Phase 3 - Architecture: 📋 Pending
- Phase 4 - Refinement: 📋 Pending
- Phase 5 - Completion: 📋 Pending
```

**In PROMPTS.md**:
Log when AI assistance is used for any SPARC phase:
- Request prompt
- Phase being worked on
- Outcomes and deliverables

### SOP 0.4: SPARC Phase Artifacts

**Each phase must produce specific deliverables**:

| Phase | Deliverables |
|-------|--------------|
| Specification | Requirements doc, user journeys, success metrics |
| Pseudocode | Pseudocode, data structures, workflows |
| Architecture | Architecture diagrams, API specs, design docs |
| Refinement | Optimization plan, testing plan, code standards |
| Completion | Production code, tests, documentation, deployment |

**Artifact Review**:
- All artifacts peer-reviewed before gate approval
- Store in version control
- Link to GitHub issues/PRs
- Reference in PROMPTS.md

### SOP 0.5: SPARC Quality Metrics

**Track these metrics during SPARC execution**:

| Metric | Phase | Target |
|--------|-------|--------|
| Requirements clarity | Specification | 95%+ |
| Design completeness | Architecture | 100% |
| Test coverage | Completion | 80%+ |
| Documentation | Completion | 100% |
| Code review approvals | Completion | 2+ |
| Phase gate compliance | All | 100% |

### SOP 0.6: SPARC Integration with Agents

**When developing agents using SPARC**:

1. **Specification Phase**: Define 5-8 core competencies and 4-11 skills
2. **Pseudocode Phase**: Map agent-to-skill workflows and dependencies
3. **Architecture Phase**: Design skill selection logic and integration
4. **Refinement Phase**: Optimize skill selection and workflow
5. **Completion Phase**: Document all skills and create usage examples

See example agent templates in `docs/SPARC_FRAMEWORK.md`

### SOP 0.7: SPARC Integration with Skills

**When implementing skills using SPARC**:

1. **Specification Phase**: Define functionality, parameters, success metrics
2. **Pseudocode Phase**: Design execution logic and data structures
3. **Architecture Phase**: Design components, APIs, and integrations
4. **Refinement Phase**: Optimize algorithms and plan tests
5. **Completion Phase**: Write production code, tests, and documentation

Use `skills/SKILL_TEMPLATE.md` which now includes SPARC sections.

### SOP 0.8: Approval Authority

**Phase gate approvals by role**:

| Phase | Approver | Notes |
|-------|----------|-------|
| Specification | Product Lead | Ensures requirements align with business |
| Pseudocode | Tech Lead | Validates technical approach |
| Architecture | Architect | Reviews system design |
| Refinement | QA Lead | Approves testing strategy |
| Completion | Release Manager | Sign-off before deployment |

---

## Agent Quality Standards

### Minimum Quality Requirements

All agent interactions must meet these standards:

| Standard | Target | Description |
|----------|--------|-------------|
| **Accuracy** | >95% | Correct outputs for given inputs |
| **Response Time** | <10s | Time to complete agent task |
| **Reliability** | 99.9% | Successful completions |
| **Documentation** | 100% | All outputs documented |
| **Testing** | 80%+ coverage | Test coverage for implementations |

### Quality Attributes

1. **Reliability**: Consistent performance across environments
2. **Explainability**: Clear reasoning for all decisions
3. **Safety**: Fail-safes and rollback mechanisms
4. **Compliance**: Adherence to best practices
5. **Efficiency**: Optimal resource utilization
6. **Auditability**: Complete audit trail

---

## Agent Usage SOPs

### SOP 1: Invoking Agents

**Purpose**: Ensure correct and consistent agent invocation

**Procedure**:

1. **Identify Requirements**
   - Determine which agent is needed
   - Review agent capabilities in `agents/` directory
   - Check for prerequisites

2. **Prepare Context**
   - Gather all required information
   - Prepare input parameters
   - Document expected outcomes

3. **Invoke Agent**
   ```
   @agent-name "Clear, specific task description with context"
   ```

4. **Monitor Execution**
   - Watch for agent responses
   - Track progress
   - Note any issues

5. **Verify Results**
   - Confirm expected outputs
   - Validate against requirements
   - Document outcomes

6. **Document Usage**
   - Log in project TODO.md
   - Update PROMPTS.md with interaction
   - Add to usage examples if novel

**Best Practices**:
- Be specific and clear in requests
- Provide all necessary context
- Review agent documentation first
- Start with simple tasks before complex ones
- Provide feedback after use

---

### SOP 2: Multi-Agent Workflows

**Purpose**: Coordinate multiple agents for complex tasks

**Procedure**:

1. **Plan Workflow**
   - Identify all agents needed
   - Determine execution order
   - Document dependencies

2. **Sequential Execution**
   - Execute agents in order
   - Pass outputs to next agent
   - Validate at each step

3. **Parallel Execution** (when possible)
   - Identify independent tasks
   - Invoke agents simultaneously
   - Collect and synthesize results

4. **Error Handling**
   - Have rollback plan
   - Know which steps can be retried
   - Document failure modes

**Example Multi-Agent Workflow**:
```
Step 1: @devops-engineer "Deploy to dev4"
Step 2: @qa-engineer "Run smoke tests on dev4"
Step 3: @project-manager "Update JIRA with deployment status"
```

---

### SOP 3: Agent Selection Guide

**Purpose**: Choose the right agent for the task

**Selection Criteria**:

| Task Type | Primary Agent | Secondary Agent | Considerations |
|-----------|---------------|-----------------|----------------|
| **Deployment** | DevOps Engineer | SRE/Reliability | Use DevOps for planned, SRE for incidents |
| **Testing** | QA Engineer | Security & Compliance | Use Security for security-specific tests |
| **Code Changes** | DLT Developer / Frontend Developer | - | Based on codebase area |
| **JIRA Updates** | Project Manager | - | Sprint planning, ticket management |
| **Security Scan** | Security & Compliance / QA Engineer | - | Both have security-scanner skill |
| **Trading Strategy** | Trading Operations | Data Engineer | Trading for strategy, Data for analysis |
| **Marketing Campaign** | Digital Marketing | - | All marketing activities |
| **New Hire** | Employee Onboarding | - | Complete onboarding lifecycle |

---

## Skill Implementation SOPs

### SOP 4: Implementing New Skills

**Purpose**: Standardize skill development process using SPARC methodology

**Procedure**: Follow the [SPARC Framework](../SPARC.md) for structured development

1. **Planning - SPARC Specification Phase** (2-4 hours)
   - Copy `skills/SKILL_TEMPLATE.md`
   - Copy `sparc-templates/skill-development.md` for detailed SPARC tracking
   - Define skill requirements (Functional & Non-Functional)
   - Document use cases (Primary & Edge cases)
   - Define acceptance criteria
   - Get stakeholder sign-off
   - Estimate effort

2. **Design - SPARC Pseudocode & Architecture Phases** (4-8 hours)
   - **Pseudocode Phase** (2-4 hours):
     - Write high-level algorithm
     - Decompose into functions
     - Design data flow
     - Plan error handling strategy
   - **Architecture Phase** (2-4 hours):
     - Design component structure
     - Define interfaces and data models
     - Select technology stack
     - Plan non-functional design (performance, security)
   - Review with team

3. **Implementation - SPARC Refinement Phase** (16-40 hours)
   - Write production code following pseudocode
   - Follow coding standards
   - Add inline documentation
   - Implement error handling
   - Iterate based on code reviews

4. **Testing - SPARC Refinement Phase** (8-16 hours)
   - Unit tests (80%+ coverage)
   - Integration tests
   - Edge case tests
   - Performance tests
   - Security tests

5. **Documentation - SPARC Refinement Phase** (4-8 hours)
   - Complete skill markdown file
   - Add usage examples
   - Document common issues
   - Update skills matrix
   - Update SPARC status in skill document

6. **Review - SPARC Refinement Phase** (2-4 hours)
   - Code review by 2 developers
   - Documentation review
   - Security review
   - Performance review
   - Verify all SPARC phases completed

7. **Deployment - SPARC Completion Phase** (2-4 hours)
   - Deploy to staging
   - Smoke testing
   - Deploy to production
   - Monitor metrics
   - Mark SPARC Completion phase as done

8. **Handoff - SPARC Completion Phase** (1-2 hours)
   - Team training
   - Add to quick reference
   - Update rollout materials
   - Collect initial feedback
   - Document lessons learned

**Total Effort**: 39-86 hours per skill

**SPARC Integration Notes**:
- Each phase maps to SPARC methodology (see [SPARC.md](../SPARC.md))
- Use `sparc-templates/skill-development.md` for detailed tracking
- Update SPARC status table in skill documentation throughout development
- Ensure all 5 SPARC phases are completed before marking skill as "Production"

---

### SOP 5: Skill Quality Checklist

**Purpose**: Ensure all skills meet quality standards

**Pre-Deployment Checklist**:

- [ ] **Functionality**
  - [ ] Meets all requirements
  - [ ] Handles all use cases
  - [ ] Error handling implemented
  - [ ] Edge cases covered

- [ ] **Testing**
  - [ ] Unit tests: 80%+ coverage
  - [ ] Integration tests pass
  - [ ] Performance tests pass
  - [ ] Security tests pass

- [ ] **Documentation**
  - [ ] Skill markdown complete
  - [ ] Usage examples provided
  - [ ] API documented
  - [ ] Error messages clear

- [ ] **Code Quality**
  - [ ] Follows coding standards
  - [ ] No code smells
  - [ ] No security vulnerabilities
  - [ ] Properly commented

- [ ] **Integration**
  - [ ] Works with related skills
  - [ ] Doesn't break existing functionality
  - [ ] Logging implemented
  - [ ] Metrics tracked

- [ ] **Performance**
  - [ ] Meets response time targets
  - [ ] Resource usage acceptable
  - [ ] Scales appropriately
  - [ ] No memory leaks

---

### SOP 6: Skill Deployment Process

**Purpose**: Safe and reliable skill deployment

**Procedure**:

1. **Pre-Deployment** (30 min)
   - Run full test suite
   - Security scan
   - Code review approval
   - Backup current version

2. **Staging Deployment** (15 min)
   - Deploy to staging environment
   - Run smoke tests
   - Manual verification
   - Performance check

3. **Staging Validation** (30 min)
   - Execute test scenarios
   - Verify integrations
   - Check logs for errors
   - Get stakeholder approval

4. **Production Deployment** (15 min)
   - Schedule deployment window
   - Deploy to production
   - Run smoke tests
   - Verify health checks

5. **Post-Deployment** (1-2 hours)
   - Monitor metrics
   - Watch for errors
   - Collect user feedback
   - Document issues

6. **Rollback** (if needed) (10 min)
   - Identify issue severity
   - Execute rollback procedure
   - Verify rollback success
   - Investigate root cause

---

## Quality Assurance Procedures

### SOP 7: Agent Testing Standards

**Purpose**: Comprehensive testing for agent reliability

**Testing Levels**:

1. **Unit Testing**
   - Test individual functions
   - Mock external dependencies
   - Cover edge cases
   - Target: 80%+ coverage

2. **Integration Testing**
   - Test agent interactions
   - Test skill combinations
   - Test with real dependencies
   - Verify data flow

3. **End-to-End Testing**
   - Test complete workflows
   - Use production-like data
   - Validate user scenarios
   - Check all integrations

4. **Performance Testing**
   - Load testing
   - Stress testing
   - Response time validation
   - Resource usage monitoring

5. **Security Testing**
   - Vulnerability scanning
   - Penetration testing
   - Authentication checks
   - Authorization validation

**Test Documentation**:
- Test plan document
- Test cases with steps
- Expected vs actual results
- Bug reports and resolutions

---

### SOP 8: Code Review Process

**Purpose**: Ensure code quality through peer review

**Procedure**:

1. **Preparation** (Developer)
   - Self-review code
   - Run tests locally
   - Update documentation
   - Create pull request

2. **Review Assignment**
   - Assign 2 reviewers minimum
   - One senior developer required
   - Security review if needed
   - Assign within 4 hours

3. **Review Execution** (Reviewers)
   - Check against requirements
   - Verify tests pass
   - Review code quality
   - Check documentation
   - Test locally if complex
   - Complete within 24 hours

4. **Feedback**
   - Provide clear comments
   - Suggest improvements
   - Request changes if needed
   - Approve when ready

5. **Resolution** (Developer)
   - Address all comments
   - Make requested changes
   - Re-request review
   - Respond to questions

6. **Approval**
   - Require 2 approvals
   - No unresolved comments
   - All tests passing
   - Documentation complete

---

## Incident Response

### SOP 9: Agent Failure Response

**Purpose**: Quick response to agent failures

**Severity Levels**:

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P0 - Critical** | Complete agent failure | <15 min | Agent crashes on startup |
| **P1 - High** | Major functionality broken | <1 hour | Skill fails 100% of time |
| **P2 - Medium** | Partial functionality loss | <4 hours | Skill fails intermittently |
| **P3 - Low** | Minor issue, workaround exists | <24 hours | Documentation unclear |

**Response Procedure**:

1. **Detection** (0-5 min)
   - Monitor alerts
   - User reports
   - Automated checks

2. **Assessment** (5-15 min)
   - Determine severity
   - Identify affected components
   - Estimate impact

3. **Communication** (15-20 min)
   - Notify stakeholders
   - Post in #claude-agents
   - Update status page

4. **Mitigation** (20-60 min)
   - Apply temporary fix
   - Rollback if necessary
   - Document workaround

5. **Resolution** (1-4 hours)
   - Implement permanent fix
   - Test thoroughly
   - Deploy fix

6. **Post-Mortem** (within 48 hours)
   - Root cause analysis
   - Document lessons learned
   - Update procedures
   - Implement preventions

---

### SOP 10: Rollback Procedure

**Purpose**: Quickly revert problematic deployments

**Procedure**:

1. **Identify Issue** (0-5 min)
   - Determine rollback needed
   - Document failure reason
   - Get approval for rollback

2. **Prepare Rollback** (5-10 min)
   - Identify last good version
   - Check rollback script
   - Verify backup exists

3. **Execute Rollback** (10-15 min)
   - Run rollback procedure
   - Verify version change
   - Run smoke tests

4. **Validate** (15-20 min)
   - Test critical paths
   - Verify metrics normal
   - Check error rates

5. **Communicate** (20-25 min)
   - Notify all stakeholders
   - Update status
   - Document incident

6. **Investigate** (25+ min)
   - Root cause analysis
   - Fix underlying issue
   - Plan re-deployment

---

## Continuous Improvement

### SOP 11: Feedback Collection

**Purpose**: Continuously improve agent quality

**Feedback Channels**:

1. **Slack**: #claude-agents (instant feedback)
2. **Email**: agents@aurigraph.io (detailed feedback)
3. **Office Hours**: Mon/Wed 10-12, Tue/Thu 2-4
4. **Surveys**: Monthly user surveys
5. **Usage Analytics**: Automated metrics

**Feedback Categories**:
- Bug reports
- Feature requests
- Documentation improvements
- Usability issues
- Performance problems

**Response Process**:
1. Collect feedback (daily)
2. Categorize and prioritize (weekly)
3. Plan improvements (sprint planning)
4. Implement changes (next sprint)
5. Communicate updates (release notes)

---

### SOP 12: Usage Analytics

**Purpose**: Track agent usage for improvement

**Metrics Tracked**:

1. **Usage Metrics**
   - Agent invocations per day
   - Most used agents/skills
   - User adoption rate
   - Peak usage times

2. **Performance Metrics**
   - Success rate
   - Failure rate
   - Response time
   - Resource usage

3. **Quality Metrics**
   - User satisfaction ratings
   - Bug count
   - Time to resolution
   - Documentation clarity

4. **Business Metrics**
   - Time saved
   - Cost reduction
   - Productivity increase
   - ROI

**Reporting**:
- Daily: Usage dashboard
- Weekly: Team metrics
- Monthly: Executive summary
- Quarterly: ROI analysis

---

### SOP 13: Agent Updates

**Purpose**: Safely update agents and skills

**Update Types**:

1. **Patch Updates** (x.x.X)
   - Bug fixes
   - Documentation updates
   - No breaking changes
   - Deploy immediately

2. **Minor Updates** (x.X.0)
   - New skills
   - Feature enhancements
   - Backward compatible
   - Deploy in next sprint

3. **Major Updates** (X.0.0)
   - Breaking changes
   - Major refactoring
   - New architecture
   - Plan carefully, communicate widely

**Update Procedure**:

1. **Plan** (1-2 weeks before)
   - Document changes
   - Create migration guide
   - Test thoroughly
   - Prepare rollback plan

2. **Communicate** (1 week before)
   - Email announcement
   - Slack notifications
   - Update documentation
   - Training sessions

3. **Deploy** (deployment day)
   - Follow deployment SOP
   - Monitor closely
   - Be ready for rollback

4. **Support** (1 week after)
   - Extra office hours
   - Monitor feedback channels
   - Quick fixes for issues
   - Document problems

---

## Documentation Standards

### SOP 14: Documentation Requirements

**Purpose**: Maintain high-quality documentation

**Required Documentation**:

1. **Agent Documentation** (`agents/*.md`)
   - Agent overview
   - All skills listed
   - Usage examples
   - Integration guide

2. **Skill Documentation** (`skills/*.md`)
   - Skill purpose
   - Usage instructions
   - Parameters
   - Examples
   - Common issues

3. **Rollout Materials** (`rollout/*.md`)
   - Training materials
   - Quick references
   - Email templates
   - Slack announcements

4. **Technical Docs** (`docs/*.md`)
   - Architecture
   - API reference
   - Integration guides
   - Troubleshooting

**Documentation Standards**:
- Clear and concise
- Include examples
- Keep updated
- Version controlled
- Regular reviews

---

## Compliance & Audit

### SOP 15: Audit Trail Requirements

**Purpose**: Maintain complete audit trail

**What to Log**:
- All agent invocations
- Input parameters
- Outputs produced
- Execution time
- User identity
- Success/failure
- Errors encountered

**Retention**:
- Development: 30 days
- Production: 7 years
- Compliance: Per regulations

**Access**:
- Developers: Development logs
- Admins: All logs
- Auditors: Production logs
- Regular reviews: Quarterly

---

## Training & Onboarding

### SOP 16: New Team Member Onboarding

**Purpose**: Efficiently onboard new team members to agents

**Onboarding Schedule**:

**Day 1** (1 hour)
- Read QUICK_START.md
- Join #claude-agents Slack
- Review agent roster
- Try first agent

**Week 1** (4 hours)
- Complete ONBOARDING_GUIDE.md
- Attend training session
- Practice with 3 agents
- Complete hands-on exercises

**Week 2** (2 hours)
- Advanced usage patterns
- Multi-agent workflows
- Troubleshooting
- Share first success story

**Ongoing**
- Office hours attendance
- Feedback submission
- Agent champion activities

---

## Appendices

### Appendix A: Quick Reference Commands

```bash
# Agent invocation
@agent-name "task description"

# Most used agents
@devops-engineer "Deploy to dev4"
@qa-engineer "Run tests"
@project-manager "Update JIRA"

# Check agent capabilities
cat .claude/agents/agent-name.md

# View usage examples
cat .claude/docs/AGENT_USAGE_EXAMPLES.md
```

### Appendix B: Contact Information

- **Slack**: #claude-agents
- **Email**: agents@aurigraph.io
- **Office Hours**: Mon/Wed 10-12, Tue/Thu 2-4
- **Documentation**: `.claude/docs/`
- **Support**: For urgent issues, @mention in #claude-agents

### Appendix C: Related Documents

- [QUICK_START.md](QUICK_START.md) - 5-minute quick start
- [ONBOARDING_GUIDE.md](ONBOARDING_GUIDE.md) - 30-minute comprehensive guide
- [AGENT_USAGE_EXAMPLES.md](AGENT_USAGE_EXAMPLES.md) - 21 real-world examples
- [SKILLS.md](SKILLS.md) - Complete skills matrix
- [TEAM_DISTRIBUTION_PLAN.md](TEAM_DISTRIBUTION_PLAN.md) - Rollout plan

---

**Maintained by**: Aurigraph Development Team
**Last Updated**: October 20, 2025
**Version**: 2.0.0
**Status**: Production Ready
**Review Schedule**: Quarterly
**Next Review**: January 20, 2026
