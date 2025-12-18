---
date: 2025-12-10T07:19:36Z
researcher: Claude
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "Sentry Integration Research"
tags: [research, integration, sentry, connector, error-tracking]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude
---

# Research: Sentry Integration for Lightfast Memory

**Date**: 2025-12-10T07:19:36Z
**Researcher**: Claude
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

How to integrate Sentry into Lightfast's memory system to give AI agents context about application errors, issues, and deployments.

## Summary

Sentry's integration platform is **mature, well-documented, and highly feasible** for Lightfast. It offers OAuth 2.0 authentication, comprehensive webhooks for real-time events, and a RESTful API for batch data access. The platform is specifically designed for third-party integrations like ours.

**Key Finding**: Sentry provides two integration paths - Internal Integrations (faster development, org-specific) and Public OAuth Integrations (requires partnership approval, available to all users).

## Documentation Links

- **Developer Portal**: https://docs.sentry.io/organization/integrations/integration-platform/
- **OAuth Integration**: https://docs.sentry.io/product/partnership-platform/oauth-integration/
- **Webhook Reference**: https://docs.sentry.io/organization/integrations/integration-platform/webhooks/
- **API Reference**: https://docs.sentry.io/api/
- **Scopes Reference**: https://docs.sentry.io/api/permissions/
- **Example Integration**: https://github.com/getsentry/integration-platform-example

## Integration Types

### 1. Internal Integration (Recommended for Development)
- Organization-specific only
- No OAuth flow needed (automatic token generation)
- Create directly in Sentry UI: Settings → Developer Settings
- Perfect for testing and custom internal tooling

### 2. Public Integration (For Production)
- Available to all Sentry users
- Requires OAuth flow for installation
- Must contact partnership team: partnership-platform@sentry.io
- Requires approval process before publishing

## Authentication

### OAuth 2.0 Flow

**Registration Requirements** (contact partnership-platform@sentry.io):
- Client Name
- Redirect URIs (OAuth callback URLs)
- Allowed Origins
- Home Page URL
- Privacy Policy URL
- Terms and Conditions URL
- Required Scopes

**Authorization Flow**:

1. Direct users to authorization endpoint:
```
https://sentry.io/oauth/authorize/?client_id=YOUR_CLIENT_ID&response_type=code&scope=SCOPE1%20SCOPE2
```

2. Sentry redirects with authorization code:
```
https://lightfast.ai/api/sentry/callback?code=AUTHORIZATION_CODE
```

3. Exchange code for access token:
```typescript
const TOKEN_URL = "https://sentry.io/oauth/token/";
const tokenData = {
  client_id: "YOUR_CLIENT_ID",
  client_secret: "YOUR_CLIENT_SECRET",
  grant_type: "authorization_code",
  code: "AUTHORIZATION_CODE"
};
const response = await fetch(TOKEN_URL, {
  method: 'POST',
  body: new URLSearchParams(tokenData)
});
```

**Token Response**:
```json
{
  "access_token": "8923f2eb3ec0fb9b...",
  "refresh_token": "74dbc60782aed648...",
  "expires_in": 2591999,
  "expires_at": "2024-11-27T23:20:21.054320Z",
  "token_type": "bearer",
  "scope": "org:read project:read",
  "user": {
    "id": "2",
    "name": "user 1",
    "email": "user1@test.com"
  }
}
```

### Token Management

**CRITICAL**: Access tokens expire every **8 hours**. Must implement refresh logic.

```typescript
const refreshData = {
  client_id: "YOUR_CLIENT_ID",
  client_secret: "YOUR_CLIENT_SECRET",
  grant_type: "refresh_token",
  refresh_token: "YOUR_REFRESH_TOKEN"
};
const response = await fetch(TOKEN_URL, {
  method: 'POST',
  body: new URLSearchParams(refreshData)
});
```

### Required Scopes for Lightfast Memory

| Scope | Description | Use Case |
|-------|-------------|----------|
| `org:read` | Read organization information | Org context |
| `project:read` | Read project data | Project context |
| `event:read` | Read error and event data | Error details |
| `member:read` | Read organization members | Team context |
| `team:read` | Read team information | Assignment context |

## Webhooks

### Available Events

| Resource Type | Description | Memory Use Case |
|---------------|-------------|-----------------|
| `installation` | Integration installed/uninstalled | Connection management |
| `event_alert` | Issue alerts triggered | Real-time error awareness |
| `metric_alert` | Performance alerts triggered | Performance context |
| `issue` | Issues created/resolved/assigned | Issue lifecycle |
| `error` | Individual error events | Detailed error context |
| `comment` | Comments added to issues | Team discussions |
| `seer` | AI-powered suggestions | Sentry's AI insights |

### Webhook Headers

```
Content-Type: application/json
Request-ID: unique-request-id
Sentry-Hook-Resource: issue
Sentry-Hook-Timestamp: timestamp-in-seconds
Sentry-Hook-Signature: hmac-sha256-signature
```

### Webhook Verification

**CRITICAL for Security**:

```typescript
import crypto from 'crypto';

export function verifySentrySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(signature)
  );
}
```

### Payload Examples

**Issue Created Event**:
```json
{
  "action": "created",
  "actor": {"id": "sentry", "name": "Sentry", "type": "application"},
  "installation": {"uuid": "a8e5d37a-696c-4c54-adb5-b3f28d64c7de"},
  "data": {
    "issue": {
      "id": "1170820242",
      "title": "ReferenceError: blooopy is not defined",
      "status": "unresolved",
      "substatus": "escalating",
      "level": "error",
      "metadata": {
        "filename": "/runner",
        "type": "ReferenceError",
        "value": "blooopy is not defined"
      },
      "project": {
        "id": "1",
        "name": "front-end",
        "slug": "front-end"
      },
      "firstSeen": "2019-08-19T20:58:37.391000Z",
      "lastSeen": "2019-08-19T20:58:37.391000Z"
    }
  }
}
```

### Webhook Requirements

- **Response timeout**: Must respond within **1 second**
- **Idempotency**: Use `Request-ID` header for deduplication
- **Signature validation**: Always verify HMAC-SHA256 signature

## APIs

### Base URL

```
https://sentry.io/api/0/
```

### Key Endpoints for Memory

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/organizations/` | GET | List organizations |
| `/organizations/{org}/projects/` | GET | List projects |
| `/organizations/{org}/issues/` | GET | List issues |
| `/organizations/{org}/issues/{id}/` | GET | Get issue details |
| `/organizations/{org}/issues/{id}/events/` | GET | Get events for issue |
| `/organizations/{org}/releases/` | GET | List releases |
| `/organizations/{org}/releases/{version}/deploys/` | GET | List deployments |

### Rate Limits

- Per-organization rate limiting
- No published specific limits
- **HTTP 429** response with `Retry-After` header
- Implement exponential backoff

### Pagination

**Cursor-based pagination** via Link headers:

```
Link: <https://sentry.io/api/0/organizations/acme/issues/?&cursor=0:100:0>; rel="next"; results="true"
```

- `results="true"` = more data available
- `results="false"` = last page
- Maximum page size: **100 items**

## Data Models

### Hierarchy

```
Organization
├── Teams
│   └── Members
└── Projects
    ├── Issues (Groups)
    │   └── Events (Individual occurrences)
    ├── Releases
    │   └── Deployments
    └── Environments
```

### Issue Object (Primary for Memory)

```typescript
interface SentryIssue {
  id: string;
  shortId: string;  // e.g., "PUMP-STATION-1"
  title: string;
  status: 'unresolved' | 'resolved' | 'ignored';
  substatus: 'escalating' | 'ongoing' | 'regressed' | 'new';
  level: 'error' | 'warning' | 'info';
  count: string;  // Number of events
  userCount: number;
  firstSeen: string;  // ISO timestamp
  lastSeen: string;   // ISO timestamp
  metadata: {
    type: string;     // Error type
    value: string;    // Error message
    filename?: string;
  };
  project: {
    id: string;
    name: string;
    slug: string;
  };
  assignedTo?: {
    type: 'user' | 'team';
    id: string;
    name: string;
    email?: string;
  };
}
```

## Data for Lightfast Memory

### High Priority (Ingest Immediately)

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| Issue titles | Error descriptions | Quick error context |
| Error types | Exception classes | Pattern recognition |
| Error messages | Specific error text | Debugging context |
| Projects | Where errors occur | Scope awareness |
| Frequency | Event/user counts | Impact assessment |
| Timestamps | First/last seen | Temporal context |
| Status | Resolution state | Current status |

### Medium Priority (Enrich Later)

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| Releases | Deploy versions | Correlation with deploys |
| Assignments | Who's working on it | Team context |
| Comments | Discussion threads | Resolution context |
| Related issues | Fingerprint groups | Pattern awareness |

### Low Priority (Reference Only)

| Data Type | Description | Reason |
|-----------|-------------|--------|
| Full stack traces | Complete traces | Too verbose for context |
| Individual events | Every occurrence | Use aggregates instead |
| Session replays | Video recordings | External reference |

## Recommended Implementation Approach

### Phase 1: Internal Integration (Week 1)

1. Create internal integration in Sentry UI (Settings → Developer Settings)
2. Get automatic access token
3. Create webhook endpoint: `api/console/src/app/api/sentry/webhooks/route.ts`
4. Implement webhook handler: `packages/console-webhooks/src/sentry.ts`
5. Add Inngest workflow for processing
6. Test with own Sentry organization

### Phase 2: Database Schema

```sql
-- Add to existing workspace_integrations table
-- provider: 'sentry'
-- Already supports: access_token, refresh_token, expires_at

-- May need: sentry_issues table for caching/search
CREATE TABLE sentry_issues (
  id VARCHAR(191) PRIMARY KEY,
  workspace_id VARCHAR(191) NOT NULL,
  sentry_id VARCHAR(191) NOT NULL,
  title TEXT NOT NULL,
  status VARCHAR(50),
  level VARCHAR(50),
  project_slug VARCHAR(191),
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  event_count INT,
  user_count INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
```

### Phase 3: Public OAuth (When Ready)

1. Contact partnership-platform@sentry.io
2. Register OAuth application with required info
3. Implement full OAuth flow
4. Submit for review
5. Add to integration marketplace

## Platform-Specific Gotchas

1. **8-hour token expiry** - Must implement automatic refresh
2. **Organization scoping** - Tokens are per-org, not per-user
3. **1-second webhook timeout** - Keep handlers fast, use queues
4. **100-item page limit** - Implement cursor pagination
5. **Rate limits opaque** - Handle 429s gracefully with backoff
6. **Signature verification required** - Always validate webhooks

## Comparison with Existing Connectors

Similar to our Vercel integration:
- OAuth 2.0 flow (like Vercel)
- Webhook-based events (like Vercel)
- Project-scoped data (like Vercel deployments)

Key differences:
- Shorter token expiry (8h vs 30 days)
- More granular webhook events
- Aggregated issues vs individual events

## Next Steps

1. **Use `/create_plan sentry integration`** to plan implementation
2. **Review Vercel connector** for patterns: `packages/console-webhooks/src/vercel.ts`
3. **Contact Sentry partnership** (when ready for production)
4. **Consider internal integration** for faster development cycle

## Related Research

- [Future] Linear integration research (similar issue tracking)
- [Future] PagerDuty integration research (incident management)
