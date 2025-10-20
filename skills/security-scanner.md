# Security Scanner Skill

**Agent**: Security & Compliance  
**Purpose**: Automated security testing and vulnerability scanning  
**Status**: Implemented  
**Version**: 1.0.0

## Overview
Comprehensive automated security scanning combining multiple testing approaches to ensure platform security before deployment.

## Capabilities
- Execute complete security test suite
- SQL injection vulnerability testing  
- XSS and CSRF detection
- Authentication/authorization testing
- Dependency vulnerability scanning (npm audit)
- API security testing
- Generate detailed security reports with remediation steps

## Usage
```
@security-compliance security-scanner "Run full security scan"
@security-compliance security-scanner "Scan dependencies only"
@security-compliance security-scanner "SQL injection tests"
```

## Test Categories
- **OWASP Top 10**: All major web vulnerabilities
- **SQL Injection**: Existing tests in `tests/security/sql-injection.test.js`
- **Dependencies**: `npm audit` + Snyk integration
- **API Security**: Authentication, rate limiting, input validation
- **Access Control**: RBAC and permission testing

## Integration
- Security tests: `tests/security/`
- npm scripts: `npm run test:security`, `npm audit`
- CI/CD: Automated on every PR
- Score tracking: Current 95/100

## Key Features
- **Comprehensive coverage**: OWASP Top 10 + custom tests
- **Dependency scanning**: npm audit + third-party tools
- **Automated remediation**: Suggestions for fixes
- **Risk scoring**: CVSS-based vulnerability ratings
- **Compliance mapping**: SEC, GDPR, PCI-DSS requirements

## Security Metrics
- Critical vulnerabilities: 0 (zero tolerance)
- High severity: <7 days to fix
- Medium severity: <30 days to fix
- Scan frequency: Daily automated
- Overall score: 95/100 target

---
**Owner**: Security Team | **Updated**: 2025-10-20
