# Project Master SOP Adoption Template

**Project Name**: [Your Project Name]
**Version**: 1.0.0
**Created**: [Date]
**Team**: [Team Names]

---

## Overview

This document outlines how [Project Name] adopts and customizes the Master SOP for best practices. It serves as the single source of truth for development standards in this project.

---

## Project Standards Checklist

Use this section to confirm adoption of Master SOP standards. Check each item as it's implemented.

### Documentation Standards

- [ ] README.md created with overview and quick start
- [ ] docs/ directory structure set up
- [ ] PRD (Product Requirements Document) created
- [ ] Architecture documentation created
- [ ] API documentation (if applicable)
- [ ] Deployment guide created
- [ ] Troubleshooting guide created
- [ ] CHANGELOG.md maintained
- [ ] Code comments follow standards (why, not what)
- [ ] All public APIs documented

### Testing Standards

- [ ] Test directory structure created (unit, integration)
- [ ] Test framework selected and configured
- [ ] 80% coverage target set for new code
- [ ] Unit tests written for core logic
- [ ] Integration tests for workflows
- [ ] Test documentation provided
- [ ] CI/CD pipeline runs tests automatically
- [ ] Code coverage reports generated
- [ ] Edge cases documented and tested
- [ ] Performance benchmarks established

### Code Quality Standards

- [ ] Code style guide adopted (or defined)
- [ ] Variable naming conventions defined
- [ ] Function naming conventions defined
- [ ] File organization standards defined
- [ ] Code review checklist created
- [ ] Pre-commit hooks configured (optional)
- [ ] Linting configured and enforced
- [ ] Duplicate code identified and refactored
- [ ] Error handling standards defined
- [ ] Logging standards defined

### Configuration & Security

- [ ] .env.example created with all required variables
- [ ] Environment-specific configurations created (dev, staging, prod)
- [ ] No hardcoded credentials in code
- [ ] Secrets managed securely (environment variables)
- [ ] Configuration file format standardized (JSON, YAML, etc.)
- [ ] All configuration documented
- [ ] plugin/config.json created (if applicable)
- [ ] Security review completed
- [ ] Dependencies checked for vulnerabilities
- [ ] HTTPS/TLS enforced for all communication

### Deployment Standards

- [ ] Deployment process documented
- [ ] Deployment checklist created
- [ ] Rollback procedure documented and tested
- [ ] Pre-deployment requirements listed
- [ ] Post-deployment verification steps defined
- [ ] Monitoring configured for deployed services
- [ ] Alert thresholds set
- [ ] Incident response procedure defined
- [ ] Deployment automation scripts created
- [ ] Status page maintained

### Collaboration Standards

- [ ] Code review process defined
- [ ] Code review template created
- [ ] Pull/Merge request template created
- [ ] Commit message format defined and documented
- [ ] Issue tracking set up (JIRA/GitHub Issues)
- [ ] Issue template created
- [ ] Communication channels defined (Slack, email, etc.)
- [ ] Retrospective cadence established
- [ ] Status update format defined
- [ ] Team onboarding guide created

### SPARC Methodology Integration

- [ ] Team trained on SPARC framework
- [ ] SPARC phases integrated into workflow
- [ ] SPARC phase artifacts documented
- [ ] Phase gates established (approvals)
- [ ] SPARC templates customized for project
- [ ] New feature process includes SPARC
- [ ] Retrospectives include process review
- [ ] Lightweight SPARC for small changes defined
- [ ] Phase documentation stored and accessible
- [ ] Lessons learned from SPARC documented

---

## Project-Specific Customizations

Document how your project customizes the Master SOP. This is important for consistency and understanding.

### Development Process Customizations

**What we do differently and why**:

| Practice | Master SOP Standard | Project Custom | Reason |
|----------|-------------------|-----------------|--------|
| [Practice 1] | [Standard] | [Custom] | [Why] |
| [Practice 2] | [Standard] | [Custom] | [Why] |

**Examples**:
- "Master SOP recommends 80% test coverage. We require 90% because we handle financial data."
- "Master SOP uses SPARC for all features. We use lightweight SPARC for bug fixes under 1 day."
- "Master SOP recommends code review before merge. We require approval from 2 reviewers for production changes."

### Tool Selection

| Category | Master SOP Recommended | Project Selected | Reason |
|----------|----------------------|--------------------|--------|
| Testing Framework | Jest, pytest | [Selected] | [Why] |
| Linting | ESLint, pylint | [Selected] | [Why] |
| CI/CD | GitHub Actions, Jenkins | [Selected] | [Why] |
| Documentation | Markdown | [Selected] | [Why] |
| Issue Tracking | JIRA, GitHub | [Selected] | [Why] |

### Team-Specific Practices

**Practices unique to this team**:

- [Practice 1 and rationale]
- [Practice 2 and rationale]
- [Practice 3 and rationale]

**Specialized skills**:

Document any specialized skills or domains that need custom practices:

```markdown
### [Specialized Domain] Standards

[Custom practices and guidelines for this domain]

**Example**: If you have a machine learning component, document ML-specific standards.
```

---

## Quick Start for New Team Members

### First Day

1. **Clone repository**
   ```bash
   git clone [repo-url]
   cd [project-name]
   ```

2. **Read essential docs**
   - [ ] README.md (10 min)
   - [ ] QUICK_START.md (5 min)
   - [ ] This document (10 min)

3. **Set up development environment**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Install dependencies
   npm install  # or equivalent

   # Run tests to verify setup
   npm test
   ```

4. **Read team practices**
   - [ ] Code review checklist
   - [ ] Commit message format
   - [ ] Testing standards
   - [ ] Deployment process

### First Week

- [ ] Pair program with team member
- [ ] Review 5 recent pull requests
- [ ] Make first small contribution
- [ ] Attend team standup
- [ ] Review architecture documentation

### First Month

- [ ] Complete full onboarding
- [ ] Deploy something to production
- [ ] Lead a code review
- [ ] Attend retrospective
- [ ] Ask 10+ questions (encouraged!)

---

## Development Workflow

### Daily Workflow

```
1. Start work
   - Check Slack/email for updates
   - Pull latest main branch
   - Create feature branch

2. Development (with SPARC for features)
   - Write code/tests in parallel
   - Commit frequently (small, logical chunks)
   - Push to remote daily

3. Code review
   - Create pull request
   - Provide clear description
   - Link to issue tracker
   - Request reviewers

4. Integration
   - Address review feedback
   - Update based on suggestions
   - Merge when approved
   - Deploy (if applicable)
```

### SPARC Process for New Features

```
1. Specification (1 day)
   - Write requirements
   - List acceptance criteria
   - Get approval from tech lead
   - → Create GitHub issue with spec

2. Pseudocode (1 day)
   - Plan approach
   - Design workflows
   - Document in issue comments
   - → Get tech lead feedback

3. Architecture (1 day)
   - Design components
   - Create architecture diagram
   - Document in PR description
   - → Tech lead reviews

4. Refinement (3-5 days)
   - Implement code
   - Write tests (80%+ coverage)
   - Code review
   - Iterate based on feedback

5. Completion (1-2 days)
   - Final testing
   - Create deployment plan
   - Deploy to staging
   - → Final approval and production deployment
```

### Lightweight SPARC for Bugs

```
1. Problem statement (clear)
2. Root cause analysis
3. Solution design (brief)
4. Implementation (with tests)
5. Deployment (with monitoring)
```

---

## Code Review Guidelines

### What to Review

**Functionality**
- [ ] Does it do what the issue/PR says?
- [ ] All requirements met?
- [ ] Edge cases handled?
- [ ] Error cases handled?

**Code Quality**
- [ ] Clear variable/function names?
- [ ] Reasonable function size?
- [ ] No duplicate code?
- [ ] Comments explain "why", not "what"?

**Performance & Security**
- [ ] No obvious performance issues?
- [ ] No hardcoded credentials?
- [ ] Input validation present?
- [ ] Error messages safe (don't leak info)?

**Testing**
- [ ] Tests adequate and meaningful?
- [ ] Edge cases tested?
- [ ] Error scenarios tested?
- [ ] Performance tests (if applicable)?

**Documentation**
- [ ] README updated?
- [ ] Comments added for complex logic?
- [ ] API documented?
- [ ] CHANGELOG updated?

### Review Feedback Template

```markdown
## Code Review: [PR Title]

### Strengths
- [What was done well]

### Changes Needed
1. [Required change 1 with reason]
2. [Required change 2 with reason]

### Suggestions
- [Nice-to-have improvements]
- [Performance optimizations]
- [Code style improvements]

### Decision
- [ ] ✅ Approve (merge ready)
- [ ] ✅ Approve with suggestions (can merge, apply suggestions next)
- [ ] ⚠️ Request changes (address before merging)
- [ ] ❌ Reject (major issues, discuss before proceeding)

### Questions for Author
1. [Questions for clarification]
```

---

## Deployment Checklist

Before deploying to production:

**Pre-Deployment**
- [ ] Code reviewed and approved
- [ ] All tests passing (locally and CI/CD)
- [ ] Security scan passed
- [ ] Performance validated (if applicable)
- [ ] Staging deployment successful
- [ ] No new console errors
- [ ] Rollback procedure documented and tested

**Deployment**
- [ ] Off-peak time selected
- [ ] Monitoring dashboards open
- [ ] Team assembled and ready
- [ ] Communications sent to stakeholders
- [ ] Deployment begins

**Post-Deployment**
- [ ] 30-minute monitoring period
- [ ] Error logs reviewed
- [ ] Performance metrics checked
- [ ] User access verified
- [ ] Team notified of completion

---

## Communication Standards

### Slack/Chat Norms

**Use for**:
- Quick questions
- Urgent issues
- Casual updates
- Team coordination

**Avoid**:
- Long technical discussions (use docs/tickets)
- Decision-making (use written format)
- Sensitive information

### Email Standards

**Use for**:
- Official announcements
- Documentation
- Decisions
- Retrospectives

**Subject line format**:
```
[PROJECT] [TYPE] Subject line

Types: ANNOUNCEMENT, DECISION, ALERT, REQUEST
```

### GitHub/JIRA Standards

**Use for**:
- All work items
- Technical discussions
- Design decisions
- Code review feedback

**Commit messages**:
```
[TYPE] Brief summary (50 chars max)

Longer explanation if needed, wrapped at 72 characters.
Can span multiple paragraphs.

[JIRA-123] or [GitHub Issue #456]
```

Types: feat, fix, docs, style, refactor, perf, test, chore

---

## Metrics & Tracking

### Monthly Metrics Review

Track these metrics and review monthly:

| Metric | Target | Current | Trend |
|--------|--------|---------|-------|
| **Test Coverage** | 80%+ | [%] | ↑↓→ |
| **Code Review Time** | <24 hours | [hours] | ↑↓→ |
| **Bug Escape Rate** | <5% | [%] | ↑↓→ |
| **Deployment Frequency** | [frequency] | [actual] | ↑↓→ |
| **Mean Time to Recovery** | <1 hour | [minutes] | ↑↓→ |
| **Documentation Completeness** | 100% | [%] | ↑↓→ |
| **SPARC Adoption** | 100% | [%] | ↑↓→ |

### Team Health Indicators

**Qualitative measures**:

1. **Team Satisfaction** (1-10 scale)
   - Target: 8+
   - Current: [score]
   - Trend: [improving/stable/declining]

2. **Knowledge Sharing** (frequency)
   - Target: Weekly sharing
   - Current: [frequency]
   - Trend: [improving/stable/declining]

3. **Process Improvement Suggestions** (per month)
   - Target: 3+
   - Current: [count]
   - Trend: [improving/stable/declining]

---

## Escalation Path

When issues arise:

1. **Day-to-day question** → Ask team on Slack/in standup
2. **Code review disagreement** → Tech lead makes final decision
3. **Process/standards question** → Check this doc, then ask tech lead
4. **Urgent issue** → Page on-call engineer
5. **Team process issue** → Raise in retrospective
6. **Safety/security concern** → Escalate immediately to manager

---

## Resources

### Key Documents

- [Master SOP](../agents/Master%20SOP.md) - Core best practices
- [Master SOP Implementation Guide](./MASTER_SOP_IMPLEMENTATION_GUIDE.md) - How to implement
- [README.md](../README.md) - Project overview
- [Architecture](./ARCHITECTURE.md) - Technical design
- [API Reference](./API.md) - API documentation

### External Resources

- [SPARC Framework](../SPARC.md)
- [Agent Usage Examples](./AGENT_USAGE_EXAMPLES.md)
- [Skill Implementation Guide](../skills/SKILL_TEMPLATE.md)

### Team Contacts

| Role | Name | Slack | Email |
|------|------|-------|-------|
| **Tech Lead** | [Name] | @[handle] | [email] |
| **Engineering Lead** | [Name] | @[handle] | [email] |
| **QA Lead** | [Name] | @[handle] | [email] |

---

## Frequently Asked Questions

### Q: How strictly should we follow Master SOP?

**A**: Very strictly for core standards (testing, security, documentation), flexibly for implementation details. When in doubt, ask your tech lead.

### Q: Can we customize these practices?

**A**: Yes! Document your customizations in the "Project-Specific Customizations" section above. This helps new team members understand your approach.

### Q: What if we disagree with a standard?

**A**: Discuss it in retrospective. If it's a major issue, document the concern and propose an alternative. Get team consensus before changing.

### Q: How much documentation is "enough"?

**A**: Enough for someone new to understand and contribute within a day. Use "the test": Can a new hire understand this without asking questions?

### Q: Can we skip testing for "simple" changes?

**A**: No. "Simple" changes often have unexpected side effects. Write the test, it's faster than debugging production issues.

### Q: How do we handle legacy code that doesn't follow standards?

**A**: Don't rewrite it. When you touch it, improve it gradually. Document as you go. Use this as opportunity to learn the context.

---

## Change Log

| Date | What Changed | Why | Who |
|------|-------------|-----|-----|
| [Date] | Initial template | Project setup | [Name] |

---

## Next Steps

1. **Complete all checkboxes** in "Project Standards Checklist"
2. **Document customizations** in "Project-Specific Customizations"
3. **Share with team** for feedback and updates
4. **Review monthly** in retrospectives
5. **Update** as standards evolve

---

**This document is a living document. Update it as your project evolves.**

**Last Updated**: [Date]
**Next Review**: [Date + 1 month]
**Owner**: [Team Lead Name]
