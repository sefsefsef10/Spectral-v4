# Epic FHIR Sandbox Validation Guide

## Overview
This guide outlines the 4-6 week manual testing process required to validate Spectral's Epic FHIR integration in Epic's sandbox environment. **This process CANNOT be automated** and must be completed by the development team before customer deployments.

---

## Prerequisites

### 1. Epic Sandbox Account Registration
- **Website**: https://fhir.epic.com/Documentation?docId=epiconfhirrequestprocess
- **Timeline**: 2-3 weeks for approval
- **Requirements**:
  - Company details and business use case
  - FHIR API technical documentation
  - Security and compliance questionnaires
  - NDA signing

### 2. Required Credentials
After approval, Epic provides:
- **Client ID**: OAuth app registration ID
- **Client Secret**: OAuth app secret
- **Sandbox Base URL**: `https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/`
- **OAuth Token Endpoint**: `https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token`

### 3. Environment Setup
Update Spectral's Epic integration with sandbox credentials:
```bash
# Add to .env
EPIC_SANDBOX_CLIENT_ID=your_client_id
EPIC_SANDBOX_CLIENT_SECRET=your_client_secret
EPIC_SANDBOX_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/
```

---

## Phase 1: OAuth Authentication Testing (Week 1)

### Test 1: Initial OAuth Flow
**Goal**: Verify Spectral can authenticate with Epic's OAuth 2.0 server

**Steps**:
1. Navigate to Spectral's Epic integration settings
2. Click "Connect to Epic Sandbox"
3. Complete Epic's OAuth authorization flow
4. Verify access token is received and stored

**Success Criteria**:
- ✅ Access token received
- ✅ Token expiry correctly tracked (typically 1 hour)
- ✅ Refresh token stored for renewals
- ✅ No authentication errors in logs

### Test 2: Token Refresh
**Goal**: Verify automatic token refresh works before expiry

**Steps**:
1. Wait for token to approach expiry (55 minutes)
2. Trigger a FHIR API request
3. Observe automatic token refresh

**Success Criteria**:
- ✅ New access token obtained before expiry
- ✅ API requests continue without interruption
- ✅ Token refresh logged correctly

---

## Phase 2: FHIR Resource Retrieval (Weeks 2-3)

### Test 3: Patient Search
**Goal**: Retrieve patient demographics and verify AI system discovery

**FHIR Request**:
```http
GET /Patient?_id=eq.8HJKt26TtPXGLMlSH
```

**Validation**:
- ✅ Patient resource returned with correct FHIR format
- ✅ Spectral correctly parses patient demographics
- ✅ No PHI exposure in logs (audit PHI encryption)

### Test 4: Observation Retrieval (AI Usage Detection)
**Goal**: Detect AI system usage by analyzing clinical observations

**FHIR Request**:
```http
GET /Observation?patient=eq.8HJKt26TtPXGLMlSH&category=laboratory
```

**Validation**:
- ✅ Laboratory observations retrieved
- ✅ AI-generated observations correctly identified (check for AI-specific identifiers)
- ✅ Metadata extraction for AI system discovery works
- ✅ Spectral creates corresponding AI system records

### Test 5: DiagnosticReport Analysis
**Goal**: Link AI systems to specific clinical workflows

**FHIR Request**:
```http
GET /DiagnosticReport?patient=eq.8HJKt26TtPXGLMlSH
```

**Validation**:
- ✅ Diagnostic reports retrieved
- ✅ AI system identifiers extracted from reports
- ✅ Spectral maps reports to AI systems correctly
- ✅ Department and risk level inference works

---

## Phase 3: Webhook Configuration (Week 3-4)

### Test 6: Webhook Registration
**Goal**: Register Spectral's webhook endpoint with Epic

**Epic Console**:
1. Navigate to Epic's App Orchard webhook settings
2. Register webhook: `https://your-spectral-domain.com/api/webhooks/epic`
3. Select events: `Observation.create`, `DiagnosticReport.create`, `Patient.update`

**Validation**:
- ✅ Webhook endpoint URL accepted by Epic
- ✅ HTTPS certificate validated (Epic requires valid SSL)
- ✅ Event subscriptions confirmed

### Test 7: Webhook Delivery Testing
**Goal**: Verify Spectral receives and processes Epic webhooks

**Trigger Events in Sandbox**:
1. Create a new Observation in Epic sandbox
2. Update a Patient record
3. Generate a DiagnosticReport

**Validation**:
- ✅ Webhooks received at Spectral endpoint
- ✅ Signature verification passes (Epic HMAC validation)
- ✅ Payload correctly parsed
- ✅ AI systems auto-discovered from webhook data
- ✅ Audit logs created for all webhook events

---

## Phase 4: AI System Discovery Workflow (Week 4-5)

### Test 8: Automated AI System Creation
**Goal**: Verify end-to-end AI system discovery from Epic data

**Scenario**:
1. Epic sends Observation webhook with AI-generated lab result
2. Spectral processes webhook
3. New AI system auto-created with metadata

**Validation**:
- ✅ AI system created in Spectral database
- ✅ Correct fields populated: name, department, vendor, risk level
- ✅ FHIR resource IDs stored for audit trail
- ✅ Health system association correct
- ✅ Email notification sent to health system admin

### Test 9: Duplicate Detection
**Goal**: Prevent duplicate AI system records

**Scenario**:
1. Receive multiple webhooks for same AI system
2. Verify deduplication logic

**Validation**:
- ✅ Only one AI system record created
- ✅ Existing system updated (not duplicated)
- ✅ Usage count incremented
- ✅ Last seen timestamp updated

---

## Phase 5: Performance & Load Testing (Week 5-6)

### Test 10: Bulk FHIR Requests
**Goal**: Verify rate limiting and pagination handling

**Steps**:
1. Request 1000+ patient records
2. Use Epic's pagination (`_count` parameter)
3. Monitor rate limits

**Epic Rate Limits**:
- 300 requests per minute per client
- 10,000 requests per day

**Validation**:
- ✅ Pagination correctly implemented
- ✅ Rate limit warnings handled gracefully
- ✅ Exponential backoff on 429 errors
- ✅ No data loss during rate limiting

### Test 11: Concurrent Webhook Processing
**Goal**: Handle multiple simultaneous webhooks

**Steps**:
1. Trigger 50+ webhook events rapidly
2. Verify sequential processing

**Validation**:
- ✅ All webhooks processed
- ✅ No race conditions
- ✅ No duplicate records created
- ✅ Processing queue handles backlog

---

## Phase 6: Error Handling & Recovery (Week 6)

### Test 12: Network Failure Simulation
**Goal**: Verify resilience to temporary Epic outages

**Steps**:
1. Temporarily block Epic sandbox URL
2. Attempt FHIR requests
3. Restore connectivity
4. Verify retry logic

**Validation**:
- ✅ Failed requests logged
- ✅ Automatic retries with exponential backoff
- ✅ Successful recovery after reconnection
- ✅ User notified of sync failures

### Test 13: Invalid Webhook Signatures
**Goal**: Verify security against forged webhooks

**Steps**:
1. Send webhook with invalid HMAC signature
2. Send webhook with expired timestamp

**Validation**:
- ✅ Invalid signatures rejected (401 Unauthorized)
- ✅ Security alerts generated
- ✅ Requests logged in audit trail
- ✅ No malicious data processed

---

## Production Readiness Checklist

Before deploying Epic integration to production:

### Security
- [ ] OAuth credentials stored in secret manager (never in code)
- [ ] PHI encryption enabled for all Epic data
- [ ] Webhook signature verification enabled
- [ ] HTTPS with valid SSL certificate
- [ ] IP allowlisting configured (if required by Epic)

### Compliance
- [ ] BAA signed with Epic (Business Associate Agreement)
- [ ] HIPAA audit logging enabled for all Epic API calls
- [ ] PHI retention policy configured (Epic data purged per policy)
- [ ] Consent management workflow implemented

### Monitoring
- [ ] Epic API latency tracked in telemetry
- [ ] Webhook delivery failures monitored
- [ ] Rate limit warnings trigger alerts
- [ ] Daily sync status reports generated

### Documentation
- [ ] Epic integration documented in customer onboarding
- [ ] Troubleshooting runbook created
- [ ] Support team trained on Epic workflows
- [ ] Customer-facing FAQ published

---

## Common Issues & Solutions

### Issue 1: OAuth Token Expiry During Long Requests
**Symptom**: 401 Unauthorized mid-request  
**Solution**: Implement token refresh before making requests (proactive refresh at 90% token lifetime)

### Issue 2: Epic Sandbox Rate Limiting
**Symptom**: 429 Too Many Requests  
**Solution**: Implement exponential backoff (1s, 2s, 4s, 8s...) and request caching

### Issue 3: Webhook Signature Mismatch
**Symptom**: Webhook verification fails  
**Solution**: Verify clock synchronization (webhooks expire after 5 minutes)

### Issue 4: FHIR Resource Parsing Errors
**Symptom**: Null reference exceptions  
**Solution**: Use defensive parsing (check for optional fields before accessing)

---

## Timeline Summary

| Week | Focus Area | Key Deliverables |
|------|------------|------------------|
| 1    | OAuth Authentication | Token flow validated |
| 2-3  | FHIR API Testing | Patient, Observation, DiagnosticReport retrieval working |
| 3-4  | Webhook Setup | Webhook registration and delivery confirmed |
| 4-5  | AI Discovery | Automated AI system creation from Epic data |
| 5-6  | Performance Testing | Rate limiting, pagination, concurrent processing validated |
| 6    | Error Handling | Resilience testing and security validation |

**Total Timeline**: 6 weeks minimum  
**Team Required**: 1 backend engineer, 1 QA engineer  
**Epic Support**: Available via Epic's sandbox support portal

---

## Next Steps After Sandbox Validation

1. **Production Epic Registration**: Apply for production Epic API credentials
2. **Customer Pilot**: Deploy to 1-2 pilot health systems
3. **Epic App Orchard Submission**: Submit Spectral to Epic's app marketplace
4. **Epic Certification**: Complete Epic's formal certification process (optional but recommended for enterprise sales)

---

## Support Resources

- **Epic FHIR Documentation**: https://fhir.epic.com/
- **Epic Developer Forum**: https://community.epic.com/
- **Epic Support Email**: fhirteam@epic.com
- **Spectral Integration Team**: engineering@spectral.com

---

**Document Version**: 1.0  
**Last Updated**: October 27, 2025  
**Owner**: Spectral Engineering Team
