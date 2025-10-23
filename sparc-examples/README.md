# SPARC Examples

**Repository**: glowing-adventure (Aurigraph Agent Architecture)
**Purpose**: Real-world examples demonstrating SPARC methodology
**Last Updated**: October 20, 2025

---

## Overview

This directory contains real-world examples of SPARC methodology applied to agent and skill development in the Aurigraph Agent Architecture.

## Available Examples

### 1. [Example: deploy-wizard Skill](example-deploy-wizard.md)
**Type**: Skill Development
**Agent**: DevOps Engineer
**Status**: ✅ Completed (Production)
**SPARC Phases**: All 5 phases completed
**Complexity**: High (600+ lines of code)

**Learning Objectives**:
- How to write comprehensive specifications
- Pseudocode for complex deployment workflows
- Architecture design for production systems
- Iterative refinement process
- Complete deployment and documentation

### 2. [Example: exchange-connector Skill](example-exchange-connector.md)
**Type**: Skill Development (In Progress)
**Agent**: Trading Operations
**Status**: 🔄 Architecture Phase
**SPARC Phases**: Specification ✅, Pseudocode ✅, Architecture 🔄
**Complexity**: High (multi-exchange integration)

**Learning Objectives**:
- Requirements gathering for integrations
- Designing extensible architecture
- Planning for multiple third-party APIs
- Error handling strategies

### 3. [Example: Quick Bug Fix](example-bug-fix.md)
**Type**: Bug Fix
**Status**: ✅ Completed
**SPARC Phases**: Lightweight SPARC for critical fixes
**Complexity**: Low

**Learning Objectives**:
- When to use lightweight SPARC
- Quick root cause analysis
- Fast implementation with quality
- Prevention planning

---

## How to Use These Examples

### For Learning
1. Read through examples in order (start with deploy-wizard)
2. Compare SPARC phases across examples
3. Note how complexity affects SPARC application
4. Observe iteration and refinement patterns

### For Your Own Development
1. Choose example closest to your scenario
2. Copy relevant SPARC template from `sparc-templates/`
3. Adapt structure and sections to your needs
4. Follow the 5 SPARC phases systematically

### For Team Training
1. Use examples in onboarding sessions
2. Walk through SPARC phases step-by-step
3. Discuss decisions made at each phase
4. Compare outcomes with/without SPARC

---

## SPARC Benefits Demonstrated

| Example | Time Saved | Quality Improvement | Key Benefit |
|---------|-----------|---------------------|-------------|
| deploy-wizard | 83% (30min → 5min) | Zero incidents | Comprehensive planning prevented bugs |
| exchange-connector | (In progress) | TBD | Early architecture decisions preventing rework |
| bug-fix | 50% | No regression | Structured approach to quick fixes |

---

## Example Selection Guide

**Choose deploy-wizard example when**:
- Implementing complex, mission-critical features
- Need comprehensive architecture planning
- Building production-ready systems
- Time investment: High (39-86 hours)

**Choose exchange-connector example when**:
- Integrating with multiple third-party APIs
- Designing extensible systems
- Need to handle various error scenarios
- Time investment: Medium-High (30-60 hours)

**Choose bug-fix example when**:
- Fixing critical production issues
- Need quick but structured approach
- Want to prevent similar bugs
- Time investment: Low-Medium (2-8 hours)

---

## Contributing Examples

Have a great SPARC success story? Share it!

1. Copy `sparc-templates/skill-development.md` or appropriate template
2. Fill in with your real project data
3. Add lessons learned section
4. Submit PR to `sparc-examples/` directory
5. Update this README with your example

**Good Examples Include**:
- Complete SPARC documentation
- Real metrics (time saved, quality improvements)
- Lessons learned
- Before/after comparisons
- Artifacts (diagrams, pseudocode, etc.)

---

## Related Resources

- **[SPARC Framework](../SPARC.md)**: Complete SPARC methodology documentation
- **[SPARC Templates](../sparc-templates/)**: Ready-to-use templates
- **[Skills Documentation](../docs/SKILLS.md)**: All agent skills
- **[SOPs](../docs/SOPS.md)**: Standard procedures with SPARC integration

---

**Questions?**
- Slack: #claude-agents
- Email: agents@aurigraph.io
- Office Hours: Mon/Wed 10-12, Tue/Thu 2-4
