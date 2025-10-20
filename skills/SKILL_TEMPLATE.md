# [Skill Name] Skill

**Agent**: [Agent Name]
**Purpose**: [One-line description of what this skill does]
**Status**: [Draft / In Development / Implemented / Production]
**Version**: 1.0.0
**Owner**: [Team Name]
**Last Updated**: YYYY-MM-DD

## Overview

[2-3 paragraphs describing what this skill does, why it's useful, and how it fits into the broader platform]

## SPARC Development Status

**Framework**: Using [SPARC methodology](../SPARC.md) for structured development
**SPARC Document**: [Link to sparc-docs/skill-name.md or N/A]

### Development Phase Progress

| Phase | Status | Completed Date | Notes |
|-------|--------|----------------|-------|
| **Specification** | ⏳/🔄/✅ | YYYY-MM-DD | [Link to spec or notes] |
| **Pseudocode** | ⏳/🔄/✅ | YYYY-MM-DD | [Link to pseudocode or notes] |
| **Architecture** | ⏳/🔄/✅ | YYYY-MM-DD | [Link to architecture or notes] |
| **Refinement** | ⏳/🔄/✅ | YYYY-MM-DD | [Implementation status] |
| **Completion** | ⏳/🔄/✅ | YYYY-MM-DD | [Deployment status] |

**Legend**: ⏳ Not Started | 🔄 In Progress | ✅ Complete

### Quick SPARC Summary

**Specification**: [Brief summary of requirements and acceptance criteria]
**Architecture**: [Brief summary of component structure and design]
**Status**: [Overall development status and next steps]

**Note**: For detailed SPARC documentation, see `sparc-templates/skill-development.md` template.

## Capabilities

[List 5-8 key capabilities this skill provides]

- **Capability 1**: [Description]
- **Capability 2**: [Description]
- **Capability 3**: [Description]
- **Capability 4**: [Description]
- **Capability 5**: [Description]

## Usage

### Basic Usage
```
@agent-name skill-name "simple task description"
```

### Advanced Usage
```
@agent-name skill-name

Detailed task with parameters:
- Parameter 1: value
- Parameter 2: value
- Options: [list]
```

### Example Scenarios

**Example 1**: [Common scenario]
```
[Exact command/prompt]
```

**Example 2**: [Another scenario]
```
[Exact command/prompt]
```

**Example 3**: [Edge case or advanced usage]
```
[Exact command/prompt]
```

## Configuration

### Environment Variables
```bash
SKILL_PARAM_1=value
SKILL_PARAM_2=value
SKILL_PARAM_3=value
```

### Configuration Files
**File**: `config/skill-name.json`
```json
{
  "setting1": "value",
  "setting2": "value",
  "options": []
}
```

### Prerequisites
- [ ] [Dependency 1]
- [ ] [Dependency 2]
- [ ] [Required service running]
- [ ] [Credentials configured]

## Implementation

### Integration Points

**Existing Code**:
- Files: `path/to/file1.js`, `path/to/file2.js`
- Scripts: `script-name.sh`, `script-name.py`
- APIs: `/api/v1/endpoint`
- Services: MongoDB, Redis, External API

**New Components** (if needed):
- `src/skills/skill-name/` - Skill implementation
- `src/skills/skill-name/index.js` - Main entry point
- `src/skills/skill-name/helpers.js` - Helper functions
- `src/skills/skill-name/config.js` - Configuration

### Workflow Diagram

```
┌─────────────────────────────────────────┐
│      SKILL NAME WORKFLOW                │
└─────────────────────────────────────────┘

1. INPUT VALIDATION
   └─> Validate parameters
   └─> Check prerequisites

2. PRE-EXECUTION
   └─> [Step description]
   └─> [Step description]

3. EXECUTION
   └─> [Main processing step 1]
   └─> [Main processing step 2]
   └─> [Main processing step 3]

4. POST-EXECUTION
   └─> Validate results
   └─> Generate report

5. CLEANUP
   └─> [Cleanup step]
   └─> Send notifications
```

### Pseudocode

```javascript
async function executeSkill(params) {
  // 1. Validate inputs
  if (!validateInputs(params)) {
    return { success: false, error: 'Invalid parameters' };
  }

  // 2. Pre-execution checks
  await runPreChecks();

  try {
    // 3. Main execution logic
    const result = await performMainTask(params);

    // 4. Post-execution validation
    const isValid = await validateResult(result);
    if (!isValid) {
      await rollback();
      return { success: false, error: 'Validation failed' };
    }

    // 5. Generate report
    const report = generateReport(result);

    return { success: true, result, report };

  } catch (error) {
    await handleError(error);
    return { success: false, error: error.message };
  }
}
```

## Output

### Success Output
```json
{
  "success": true,
  "skillName": "skill-name",
  "executionTime": "2.5s",
  "result": {
    "field1": "value1",
    "field2": "value2"
  },
  "report": {
    "summary": "Task completed successfully",
    "details": []
  }
}
```

### Error Output
```json
{
  "success": false,
  "skillName": "skill-name",
  "error": "Error description",
  "details": "Detailed error message",
  "suggestions": [
    "Try this fix",
    "Check that configuration"
  ]
}
```

## Error Handling

### Common Errors

**Error 1**: [Error description]
- **Cause**: [Why this happens]
- **Solution**: [How to fix]
- **Prevention**: [How to avoid]

**Error 2**: [Error description]
- **Cause**: [Why this happens]
- **Solution**: [How to fix]
- **Prevention**: [How to avoid]

**Error 3**: [Error description]
- **Cause**: [Why this happens]
- **Solution**: [How to fix]
- **Prevention**: [How to avoid]

### Rollback Procedures

If skill execution fails:
1. [Rollback step 1]
2. [Rollback step 2]
3. [Verify rollback success]
4. [Notify stakeholders]

## Testing

### Unit Tests
```javascript
describe('skill-name', () => {
  test('should handle basic input', () => {
    // Test code
  });

  test('should validate parameters', () => {
    // Test code
  });

  test('should handle errors gracefully', () => {
    // Test code
  });
});
```

### Integration Tests
```javascript
describe('skill-name integration', () => {
  test('should integrate with [system]', async () => {
    // Integration test
  });
});
```

### Manual Testing Checklist
- [ ] Test with valid inputs
- [ ] Test with invalid inputs
- [ ] Test error handling
- [ ] Test rollback
- [ ] Test with edge cases
- [ ] Test performance under load

## Performance

### Metrics
- **Execution Time**: Target <[X]s, typically [Y]s
- **Success Rate**: >95%
- **Resource Usage**: CPU <[X]%, Memory <[Y]MB
- **Throughput**: [Z] operations/minute

### Optimization Tips
1. [Optimization tip 1]
2. [Optimization tip 2]
3. [Optimization tip 3]

## Monitoring

### Health Checks
- Check 1: [Description]
- Check 2: [Description]
- Check 3: [Description]

### Metrics to Track
- Execution count
- Success/failure rate
- Average execution time
- Error types and frequency
- Resource usage

### Alerts
- Alert on failure rate >5%
- Alert on execution time >threshold
- Alert on resource exhaustion
- Alert on [custom condition]

## Best Practices

1. **[Best Practice 1]**: [Description]
2. **[Best Practice 2]**: [Description]
3. **[Best Practice 3]**: [Description]
4. **[Best Practice 4]**: [Description]
5. **[Best Practice 5]**: [Description]

## Troubleshooting

### Issue: [Common problem]
**Symptoms**: [What you'll see]
**Diagnosis**: [How to identify]
**Solution**: [How to fix]

### Issue: [Another problem]
**Symptoms**: [What you'll see]
**Diagnosis**: [How to identify]
**Solution**: [How to fix]

### Debug Mode
Enable debug logging:
```bash
DEBUG=skill-name npm start
```

Or via environment:
```bash
SKILL_DEBUG=true
SKILL_LOG_LEVEL=debug
```

## Security Considerations

- **Authentication**: [How skill handles auth]
- **Authorization**: [Permission requirements]
- **Data Protection**: [How sensitive data is handled]
- **Audit Trail**: [What is logged]
- **Rate Limiting**: [If applicable]

## Dependencies

### Required
- [Dependency 1] v[X.Y.Z]+
- [Dependency 2] v[X.Y.Z]+
- [Service/Database]

### Optional
- [Optional dependency] - For [feature]
- [Optional service] - For [enhancement]

## Changelog

### Version 1.0.0 (YYYY-MM-DD)
- Initial implementation
- [Feature 1]
- [Feature 2]

### Version 0.9.0 (YYYY-MM-DD)
- Beta release
- [Feature]

## Future Enhancements

- [ ] [Enhancement 1]
- [ ] [Enhancement 2]
- [ ] [Enhancement 3]
- [ ] [Enhancement 4]

## Related Skills

- **[Related Skill 1]**: [How it relates]
- **[Related Skill 2]**: [How it relates]
- **[Related Skill 3]**: [How it relates]

## References

### Documentation
- [Internal doc 1]
- [Internal doc 2]
- [API reference]

### External Resources
- [External link 1]
- [External link 2]

## Support

**Owner**: [Team Name]
**Contact**: [email@company.com]
**Slack**: #[channel-name]
**JIRA**: Project [PROJECT-KEY]

**Office Hours**: [Schedule if applicable]

---

**Skill Documentation Version**: 1.0.0
**Template Version**: 1.0.0
**Last Updated**: YYYY-MM-DD
**Status**: [Current status]

---

## Notes for Skill Developers

When creating a new skill using this template:

1. **Replace all placeholders** in [brackets] with actual content
2. **Remove sections** that don't apply to your skill
3. **Add sections** if your skill needs additional documentation
4. **Include examples** - real, working examples are crucial
5. **Test thoroughly** - all examples should work as documented
6. **Get feedback** - have team members review before marking "Implemented"
7. **Keep updated** - update as skill evolves

**Template Usage**:
```bash
cp .claude/skills/SKILL_TEMPLATE.md .claude/skills/your-skill-name.md
# Edit your-skill-name.md
# Replace all [placeholders]
# Remove this "Notes for Skill Developers" section
```
