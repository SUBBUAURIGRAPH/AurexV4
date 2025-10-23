# Pull Request: [Brief Title]

## Description

**What problem does this solve?**
[Describe the issue or feature request this PR addresses]

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Enhancement
- [ ] Documentation update
- [ ] SPARC Phase advancement
- [ ] Skill implementation

**SPARC Framework Phase**
- [ ] Phase 1: Specification
- [ ] Phase 2: Pseudocode
- [ ] Phase 3: Architecture
- [ ] Phase 4: Refinement
- [ ] Phase 5: Completion

---

## Related Items

**GitHub Issue**: #[issue number]
**JIRA Ticket**: [PROJECT-KEY-123](https://jira.company.com/browse/PROJECT-KEY-123)
**Affected Skills**:
- [ ] exchange-connector
- [ ] strategy-builder
- [ ] docker-manager
- [ ] deploy-wizard
- [ ] [other]

---

## Testing

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Test coverage maintained at 80%+
- [ ] All tests passing

### Manual Testing
- [ ] Feature tested locally
- [ ] Edge cases considered and tested
- [ ] Backward compatibility verified
- [ ] Performance impact verified (<5% regression)

**Test Results**:
[Paste test output or link to CI results]

---

## Code Quality

- [ ] No `console.log()` left in code
- [ ] No hardcoded values (using config/env)
- [ ] No secrets/credentials in commits
- [ ] ESLint passes with 0 warnings
- [ ] Code follows team standards (see SOPS.md)
- [ ] Comments added for complex logic
- [ ] All TODOs have associated GitHub issues

**Code Review Checklist**:
- [ ] Code is readable and maintainable
- [ ] No code duplication
- [ ] Error handling is comprehensive
- [ ] Security implications reviewed

---

## Documentation

- [ ] README updated (if applicable)
- [ ] Skill markdown documentation updated
- [ ] API documentation updated (if applicable)
- [ ] CHANGELOG.md updated
- [ ] Examples added/updated
- [ ] SPARC phase tracking updated in skill file
- [ ] Inline code comments added for complex sections

**Documentation Quality**:
- [ ] Clear explanation of changes
- [ ] Usage examples provided
- [ ] Edge cases documented
- [ ] Migration guide (if breaking changes)

---

## Risk Assessment

**Breaking Changes?**
- [ ] Yes (requires major version bump)
- [ ] No

**If breaking changes**: Include migration guide

**Security Implications?**
- [ ] Yes (requires security review)
- [ ] No

**If security changes**: Describe review with @aurigraph-security

**Performance Impact?**
- [ ] Improves performance
- [ ] No impact
- [ ] Minor impact (<2%)
- [ ] Moderate impact (2-5%)
- [ ] Significant impact (>5%) - needs justification

**Impact Details**:
[Describe any performance, security, or functionality changes]

---

## Deployment Notes

**Rollout Strategy**:
- [ ] Standard (all at once)
- [ ] Phased (gradual rollout)
- [ ] Canary (test with subset first)
- [ ] Blue-Green (zero-downtime)

**Rollback Plan** (if needed):
[Describe how to rollback if deployment fails]

**Database Migrations** (if applicable):
- [ ] None
- [ ] Backward compatible migrations
- [ ] Requires downtime window

---

## Reviewer Checklist

### Before Approving

- [ ] PR title is clear and descriptive
- [ ] Description explains problem and solution
- [ ] Code changes align with description
- [ ] All tests passing
- [ ] Test coverage not decreased
- [ ] No security/credential leaks
- [ ] Documentation up to date
- [ ] Breaking changes handled properly
- [ ] Performance impact acceptable
- [ ] Code follows team standards

### Questions for Reviewers

[Add any specific questions or areas needing extra review]

---

## Screenshots / Demos (if applicable)

[Paste screenshots, GIFs, or video links showing the changes]

---

## Additional Context

[Add any other information reviewers should know]

---

## Checklist Before Merge

- [ ] All conversations resolved
- [ ] All tests passing
- [ ] All requested changes completed
- [ ] Code owner approval received
- [ ] At least 2 approvals for critical changes
- [ ] Ready for deployment/merge to main

---

**Related Documentation**:
- [SOPS.md](https://github.com/Aurigraph-DLT-Corp/glowing-adventure/blob/main/docs/SOPS.md) - Standard operating procedures
- [SPARC Framework](https://github.com/Aurigraph-DLT-Corp/glowing-adventure/blob/main/docs/SPARC_FRAMEWORK.md) - Development methodology
- [CONTRIBUTING.md](https://github.com/Aurigraph-DLT-Corp/glowing-adventure/blob/main/CONTRIBUTING.md) - Contribution guidelines

---
