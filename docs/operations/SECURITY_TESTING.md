# Security Testing & HIPAA Compliance Validation

## Overview

This document outlines the automated security testing procedures for the Spectral Healthcare AI Governance Platform. All tests are designed to ensure HIPAA compliance and healthcare-grade security.

## Automated Security Tests

### 1. PHI Encryption Validation

**Test:** Verify all PHI fields are encrypted at rest

```bash
# Run encryption validation test
npm run test:security:encryption
```

**What it checks:**
- All database fields marked as PHI are AES-256-GCM encrypted
- Encryption keys are rotated according to policy
- Decryption only occurs in authorized contexts

### 2. Authentication Security

**Test:** Validate authentication mechanisms

```bash
# Run auth security tests
npm run test:security:auth
```

**What it checks:**
- Password minimum length (8+ characters)
- Password hashing (bcrypt with salt rounds ≥ 12)
- Email verification enforcement
- MFA/TOTP implementation
- Session timeout (30 minutes idle, 8 hours maximum)
- JWT token expiration and validation

### 3. Multi-Tenant Isolation

**Test:** Verify zero cross-tenant data leakage

```bash
# Run tenant isolation tests
npm run test:security:tenant-isolation
```

**What it checks:**
- Database queries include tenant filters
- API endpoints enforce tenant context
- File storage paths include tenant ID
- Session data is tenant-scoped

### 4. Access Control (RBAC)

**Test:** Validate role-based access control

```bash
# Run RBAC tests
npm run test:security:rbac
```

**What it checks:**
- Admin-only endpoints reject non-admin users
- Compliance officers can access audit logs
- Regular users cannot modify system settings
- API key permissions are enforced

### 5. Webhook Security

**Test:** Verify webhook signature validation

```bash
# Run webhook security tests
npm run test:security:webhooks
```

**What it checks:**
- HMAC-SHA256 signature verification
- Replay attack prevention (timestamp validation)
- Payload size limits
- Rate limiting on webhook endpoints

## OWASP ZAP Scanning

### Setup

```bash
# Install OWASP ZAP
docker pull owasp/zap2docker-stable

# Create ZAP configuration
mkdir -p .zap
cat > .zap/context.xml << EOF
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <context>
    <name>Spectral</name>
    <urls>https://localhost:5000</urls>
    <authentication>
      <type>form</type>
      <loginUrl>/api/auth/login</loginUrl>
      <usernameParameter>email</usernameParameter>
      <passwordParameter>password</passwordParameter>
    </authentication>
  </context>
</configuration>
EOF
```

### Run Full Scan

```bash
# Baseline scan (quick)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://localhost:5000 \
  -r zap-report.html

# Full scan (comprehensive, takes 1-2 hours)
docker run -t owasp/zap2docker-stable zap-full-scan.py \
  -t https://localhost:5000 \
  -r zap-full-report.html
```

### Automated Scan Schedule

```yaml
# .github/workflows/security-scan.yml
name: Security Scan
on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2 AM
  workflow_dispatch:

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: ZAP Scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'https://staging.spectral.health'
          fail_action: true
```

## Dependency Vulnerability Scanning

### NPM Audit

```bash
# Run npm audit
npm audit

# Fix automatically fixable issues
npm audit fix

# Generate audit report
npm audit --json > audit-report.json
```

### Snyk Scanning

```bash
# Install Snyk
npm install -g snyk

# Authenticate
snyk auth

# Test for vulnerabilities
snyk test

# Monitor project
snyk monitor
```

## Penetration Testing

### Manual Penetration Test Checklist

**Quarterly External Pen Test (by certified third party):**
- [ ] SQL injection attempts
- [ ] XSS attacks on all input fields
- [ ] CSRF token validation
- [ ] Session hijacking attempts
- [ ] API rate limit bypasses
- [ ] File upload vulnerabilities
- [ ] Authentication bypass techniques
- [ ] Authorization escalation
- [ ] PHI data exposure vectors

### Bug Bounty Program

Report security vulnerabilities to: security@spectral.health

**Scope:**
- ✅ spectral.health and *.spectral.health
- ✅ API endpoints
- ✅ Mobile applications

**Out of Scope:**
- ❌ Social engineering
- ❌ Physical attacks
- ❌ DDoS attacks

**Rewards:**
- Critical: $5,000 - $10,000
- High: $2,000 - $5,000
- Medium: $500 - $2,000
- Low: $100 - $500

## HIPAA Security Rule Compliance

### Administrative Safeguards

| Control | Test | Status |
|---------|------|--------|
| Security Management Process | Automated risk assessment | ✅ |
| Workforce Security | RBAC tests | ✅ |
| Information Access Management | Authorization tests | ✅ |
| Security Awareness Training | Documented, not automated | ✅ |

### Physical Safeguards

| Control | Test | Status |
|---------|------|--------|
| Facility Access Controls | Cloud provider (AWS/GCP) | ✅ |
| Workstation Security | N/A (SaaS) | ✅ |
| Device/Media Controls | Encrypted backups verified | ✅ |

### Technical Safeguards

| Control | Test | Status |
|---------|------|--------|
| Access Control | RBAC + MFA tests | ✅ |
| Audit Controls | Audit log tests | ✅ |
| Integrity Controls | Checksum validation | ✅ |
| Transmission Security | TLS 1.3 enforced | ✅ |

## Incident Response Testing

### Tabletop Exercise

**Frequency:** Quarterly

**Scenario:** PHI breach detected via Translation Engine

**Steps:**
1. Detection (automated alert)
2. Containment (auto-suspend affected system)
3. Investigation (security team review)
4. Eradication (patch deployed)
5. Recovery (system restored)
6. Post-incident review (RCA document)

**Success Criteria:**
- Detection within 15 minutes
- Containment within 1 hour
- Breach notification initiated within 24 hours (if >500 individuals affected)

## Compliance Audit Preparation

### Pre-Audit Checklist

**1 Week Before Audit:**
- [ ] Run all automated security tests
- [ ] Generate compliance reports
- [ ] Review audit logs for anomalies
- [ ] Verify all PHI is encrypted
- [ ] Test disaster recovery procedures
- [ ] Update security documentation

**Audit Day:**
- [ ] Provide access to audit reports
- [ ] Demo security features
- [ ] Show evidence of continuous monitoring
- [ ] Present incident response plan
- [ ] Review access control matrices

## Continuous Monitoring

### Security Metrics Dashboard

**Key Metrics:**
- Authentication failure rate
- Unauthorized access attempts
- PHI access patterns
- Encryption key usage
- API rate limit violations
- Session timeout violations

**Alerting Thresholds:**
- > 10 failed logins/minute → Alert security team
- Any unauthorized PHI access → Immediate page
- Encryption failure → Critical alert
- Rate limit exceeded → Warning

## Security Testing Schedule

| Test Type | Frequency | Owner |
|-----------|-----------|-------|
| Unit tests (security) | Every commit | Dev team |
| Integration tests | Daily (CI/CD) | Dev team |
| ZAP scan (baseline) | Weekly | DevOps |
| ZAP scan (full) | Monthly | Security team |
| NPM audit | Daily | CI/CD |
| Snyk scan | Weekly | DevOps |
| Penetration test | Quarterly | External firm |
| HIPAA audit | Annually | Compliance officer |

---

**Last Updated:** October 27, 2024  
**Next Review:** January 27, 2025  
**Owner:** Security & Compliance Team
