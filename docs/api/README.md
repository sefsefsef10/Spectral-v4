# Spectral Healthcare AI Governance Platform - API Documentation

## Overview

Spectral provides a comprehensive RESTful API for healthcare AI governance, monitoring, and compliance. This API enables health systems and AI vendors to integrate with the Spectral platform for real-time compliance monitoring, automated certification, and regulatory reporting.

## Base URL

- **Production:** `https://api.spectral.health`
- **Staging:** `https://api-staging.spectral.health`
- **Development:** `http://localhost:5000/api`

## Authentication

All API endpoints require authentication using session-based authentication. Alternatively, you can use API keys for programmatic access.

### Session Authentication

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@healthcare.com",
  "password": "your-secure-password"
}
```

### API Key Authentication

```http
GET /api/ai-systems
Authorization: Bearer YOUR_API_KEY
```

## Rate Limiting

- **Authenticated requests:** 1000 requests per hour
- **Unauthenticated requests:** 100 requests per hour
- **Webhook endpoints:** 10,000 requests per hour

Rate limit headers are included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

## Core Endpoints

### AI Systems Management

#### List AI Systems
```http
GET /api/ai-systems
```

Returns all AI systems for the authenticated health system.

**Response:**
```json
{
  "data": [
    {
      "id": "sys_abc123",
      "name": "Sepsis Prediction Model",
      "vendor": "Epic Systems",
      "category": "Clinical Decision Support",
      "riskLevel": "high",
      "complianceScore": 92,
      "certificationLevel": "certified",
      "deploymentDate": "2024-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 127
  }
}
```

#### Create AI System
```http
POST /api/ai-systems
Content-Type: application/json

{
  "name": "Radiology AI Assistant",
  "vendor": "Aidoc",
  "category": "Medical Imaging",
  "deploymentDate": "2024-10-27",
  "clinicalUseCase": "Chest X-ray triage and detection"
}
```

#### Get AI System Details
```http
GET /api/ai-systems/:id
```

#### Update AI System
```http
PATCH /api/ai-systems/:id
```

#### Delete AI System
```http
DELETE /api/ai-systems/:id
```

### Compliance Monitoring

#### Get Compliance Dashboard
```http
GET /api/compliance/dashboard
```

Returns comprehensive compliance status across all frameworks.

**Response:**
```json
{
  "overallScore": 94,
  "frameworks": {
    "HIPAA": {
      "score": 98,
      "totalControls": 45,
      "compliantControls": 44,
      "violations": 1
    },
    "NIST_AI_RMF": {
      "score": 92,
      "totalControls": 50,
      "compliantControls": 46,
      "violations": 4
    },
    "FDA_SAMD": {
      "score": 90,
      "totalControls": 30,
      "compliantControls": 27,
      "violations": 3
    }
  },
  "criticalAlerts": 2,
  "highAlerts": 7,
  "mediumAlerts": 15
}
```

#### Get Compliance Violations
```http
GET /api/compliance/violations
```

**Query Parameters:**
- `framework`: Filter by framework (HIPAA, NIST_AI_RMF, FDA_SAMD, STATE_CA, etc.)
- `severity`: Filter by severity (critical, high, medium, low)
- `status`: Filter by status (open, in_progress, resolved)
- `page`: Page number (default: 1)
- `pageSize`: Items per page (default: 50, max: 100)

### Alert Management

#### List Alerts
```http
GET /api/alerts
```

**Query Parameters:**
- `severity`: critical, high, medium, low
- `status`: active, acknowledged, resolved
- `startDate`: ISO 8601 date
- `endDate`: ISO 8601 date

#### Acknowledge Alert
```http
POST /api/alerts/:id/acknowledge
Content-Type: application/json

{
  "acknowledgedBy": "user_id",
  "notes": "Investigating root cause"
}
```

#### Resolve Alert
```http
POST /api/alerts/:id/resolve
Content-Type: application/json

{
  "resolution": "Updated model weights and retrained",
  "resolvedBy": "user_id"
}
```

### AI Certification (Beacon)

#### Start Certification
```http
POST /api/certification/start
Content-Type: application/json

{
  "aiSystemId": "sys_abc123",
  "certificationLevel": "certified"
}
```

#### Get Certification Status
```http
GET /api/certification/:certificationId/status
```

**Response:**
```json
{
  "id": "cert_xyz789",
  "aiSystemId": "sys_abc123",
  "status": "in_progress",
  "tests": {
    "phiDetection": {
      "status": "passed",
      "score": 98,
      "completedAt": "2024-10-27T10:30:00Z"
    },
    "biasDetection": {
      "status": "in_progress",
      "score": null,
      "completedAt": null
    },
    "clinicalAccuracy": {
      "status": "pending",
      "score": null,
      "completedAt": null
    }
  }
}
```

### Telemetry Ingestion

#### Ingest AI Telemetry Events
```http
POST /api/telemetry/events
Content-Type: application/json

{
  "events": [
    {
      "aiSystemId": "sys_abc123",
      "eventType": "model_prediction",
      "metric": "latency_ms",
      "value": 350,
      "timestamp": "2024-10-27T10:45:00Z",
      "metadata": {
        "userId": "usr_456",
        "sessionId": "sess_789"
      }
    }
  ]
}
```

### Webhooks

#### Register Webhook
```http
POST /api/webhooks
Content-Type: application/json

{
  "url": "https://your-system.com/webhooks/spectral",
  "events": ["compliance_violation", "certification_complete", "critical_alert"],
  "secret": "your-webhook-secret"
}
```

#### List Webhooks
```http
GET /api/webhooks
```

#### Delete Webhook
```http
DELETE /api/webhooks/:id
```

## Webhook Events

### Compliance Violation Event
```json
{
  "event": "compliance_violation",
  "timestamp": "2024-10-27T11:00:00Z",
  "data": {
    "violationId": "viol_abc123",
    "aiSystemId": "sys_xyz789",
    "framework": "HIPAA",
    "controlId": "164.502(a)",
    "severity": "critical",
    "description": "PHI exposure detected in model output",
    "requiresReporting": true,
    "reportingDeadline": "2024-12-26T11:00:00Z"
  }
}
```

### Certification Complete Event
```json
{
  "event": "certification_complete",
  "timestamp": "2024-10-27T11:30:00Z",
  "data": {
    "certificationId": "cert_abc123",
    "aiSystemId": "sys_xyz789",
    "level": "certified",
    "score": 94,
    "validUntil": "2025-10-27T11:30:00Z"
  }
}
```

## Error Handling

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid AI system category",
    "details": {
      "field": "category",
      "allowedValues": ["Clinical Decision Support", "Medical Imaging", "Administrative"]
    }
  }
}
```

### Common Error Codes

- `AUTHENTICATION_REQUIRED`: No valid authentication provided
- `PERMISSION_DENIED`: Authenticated but lacks required permissions
- `RESOURCE_NOT_FOUND`: Requested resource does not exist
- `VALIDATION_ERROR`: Request data validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error (automatically reported to ops team)

## SDKs and Client Libraries

- **Node.js:** `npm install @spectral/node-sdk`
- **Python:** `pip install spectral-sdk`
- **Java:** `maven dependency: com.spectral:spectral-sdk`
- **C#:** `NuGet package: Spectral.SDK`

## Support

- **API Status:** https://status.spectral.health
- **Developer Portal:** https://developers.spectral.health
- **Support Email:** api-support@spectral.health
- **Community Forum:** https://community.spectral.health

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for API version history and breaking changes.
