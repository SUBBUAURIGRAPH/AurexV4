# SPARC Quick Start Guide

**5-Minute Guide to Getting Started with SPARC**

---

## What is SPARC?

**SPARC** = **S**pecification + **P**seudocode + **A**rchitecture + **R**efinement + **C**ompletion

A structured 5-phase methodology for AI-assisted development that reduces rework by 40-60% and accelerates development by 30-50%.

---

## When to Use SPARC

✅ **Always use for**:
- New skill development
- New agent creation
- Complex features
- System architecture changes
- API design

⚠️ **Optional for**:
- Simple documentation updates
- Minor config changes
- One-line bug fixes

---

## Quick Start (3 Steps)

### 1. Choose Your Template

```bash
cd /path/to/your/project

# For new skill
cp sparc-templates/skill-development.md sparc-docs/my-skill.md

# For bug fix
cp sparc-templates/bug-fix.md sparc-docs/my-fix.md

# For new feature
cp sparc-templates/feature-implementation.md sparc-docs/my-feature.md
```

### 2. Follow the 5 Phases

**Phase 1: Specification** (10-20% of time)
- Define requirements
- Document use cases
- Set acceptance criteria
- Get stakeholder sign-off

**Phase 2: Pseudocode** (15-25% of time)
- Write high-level algorithm
- Plan data flow
- Design error handling

**Phase 3: Architecture** (15-20% of time)
- Design component structure
- Choose technologies
- Plan integrations

**Phase 4: Refinement** (40-50% of time)
- Implement code
- Write tests (80%+ coverage)
- Iterate based on reviews

**Phase 5: Completion** (10-15% of time)
- Deploy to production
- Complete documentation
- Train team
- Monitor metrics

### 3. Track Progress

Update your skill documentation with SPARC status:

```markdown
## SPARC Development Status

| Phase | Status | Completed Date |
|-------|--------|----------------|
| Specification | ✅ | 2025-10-20 |
| Pseudocode | ✅ | 2025-10-21 |
| Architecture | 🔄 | In Progress |
| Refinement | ⏳ | Pending |
| Completion | ⏳ | Pending |
```

---

## Example: Quick Skill Development

```bash
# 1. Copy templates
cp sparc-templates/skill-development.md sparc-docs/my-skill.md
cp skills/SKILL_TEMPLATE.md skills/my-skill.md

# 2. Fill in Specification phase
# - Define what you're building
# - List requirements
# - Document use cases
# - Set acceptance criteria

# 3. Write Pseudocode
# - Plan the logic before coding
# - Think through edge cases
# - Design error handling

# 4. Design Architecture
# - Sketch component structure
# - Choose technologies
# - Plan integrations

# 5. Implement (Refinement)
# - Write code following pseudocode
# - Write tests (aim for 80%+)
# - Get code reviews
# - Iterate

# 6. Deploy (Completion)
# - Deploy to staging, then production
# - Complete documentation
# - Train team
# - Monitor
```

---

## SPARC Benefits

| Benefit | Impact |
|---------|--------|
| **Reduced Rework** | 40-60% less time fixing mistakes |
| **Faster Development** | 30-50% faster overall |
| **Higher Quality** | 80%+ test coverage |
| **Better Docs** | 100% documentation completeness |
| **Team Alignment** | Shared understanding |

---

## Real Examples

### Example 1: deploy-wizard Skill
- **Time**: 56 hours with SPARC (vs. 80-100 hours without)
- **Result**: 83% time savings in deployment, 0% incidents
- **Coverage**: 92.3%
- **See**: `sparc-examples/example-deploy-wizard.md`

### Example 2: Critical Bug Fix
- **Time**: 4 hours with SPARC (vs. 6-8 hours without)
- **Result**: Zero regression, $105K saved
- **See**: `sparc-examples/example-bug-fix.md`

---

## Common Mistakes to Avoid

❌ **DON'T**:
- Skip phases to "save time" (costs more later)
- Jump straight to coding
- Treat SPARC as pure paperwork
- Write docs at the end

✅ **DO**:
- Invest time in planning (25-40% of total)
- Get stakeholder sign-off early
- Write pseudocode before code
- Document as you go
- Iterate in Refinement phase

---

## Need Help?

- **Full Documentation**: Read [SPARC.md](SPARC.md)
- **Templates**: Browse [sparc-templates/](sparc-templates/)
- **Examples**: Study [sparc-examples/](sparc-examples/)
- **Support**:
  - Slack: #claude-agents
  - Email: agents@aurigraph.io
  - Office Hours: Mon/Wed 10-12, Tue/Thu 2-4

---

## Next Steps

1. ✅ Read this quick start (done!)
2. ⏭️ Read one example: [example-deploy-wizard.md](sparc-examples/example-deploy-wizard.md)
3. ⏭️ Choose a template for your next task
4. ⏭️ Try SPARC on a real project
5. ⏭️ Share your success story

---

**Ready to start?** Pick a template from `sparc-templates/` and begin with Phase 1: Specification!

**Questions?** Ask in #claude-agents or email agents@aurigraph.io
