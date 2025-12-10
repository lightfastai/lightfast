---
date: 2025-12-10T07:35:24Z
researcher: Claude
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "Pulumi Integration Research"
tags: [research, integration, pulumi, connector, infrastructure-as-code]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude
---

# Research: Pulumi Integration for Lightfast Memory

**Date**: 2025-12-10T07:35:24Z
**Researcher**: Claude
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

How to integrate Pulumi into Lightfast's memory system - is it feasible and what value would it provide?

## Summary

**Pulumi Cloud integration is FEASIBLE** via REST API + Webhooks. However, it uses **token-based authentication** (not OAuth 2.0), so users must manually create and provide access tokens. Webhooks require a paid plan (Team edition minimum). The integration would provide rich infrastructure context for AI agents.

## Documentation Links

- **REST API Overview**: https://www.pulumi.com/docs/reference/cloud-rest-api/
- **Webhooks**: https://www.pulumi.com/docs/deployments/webhooks/
- **Webhooks API**: https://www.pulumi.com/docs/reference/cloud-rest-api/webhooks/
- **API Basics**: https://www.pulumi.com/docs/reference/cloud-rest-api/api-basics/
- **Personal Access Tokens**: https://www.pulumi.com/docs/reference/cloud-rest-api/personal-access-tokens/
- **Stacks API**: https://www.pulumi.com/docs/reference/cloud-rest-api/stacks/
- **Stack Updates API**: https://www.pulumi.com/docs/reference/cloud-rest-api/stack-updates/
- **Audit Logs API**: https://www.pulumi.com/docs/reference/cloud-rest-api/audit-logs/
- **Automation API**: https://www.pulumi.com/docs/iac/using-pulumi/automation-api/
- **ESC Webhooks**: https://www.pulumi.com/docs/esc/environments/webhooks/

## Integration Type

**API + Webhooks** (no OAuth app marketplace)

Pulumi Cloud provides a REST API and webhooks but does NOT have a third-party OAuth app system like Vercel or Linear.

## Authentication

### Token-Based Authentication

Pulumi does **NOT support OAuth 2.0 for third-party apps**. Authentication is token-based only.

**Available Token Types**:
| Token Type | Scope | Use Case |
|------------|-------|----------|
| Personal Access Token (PAT) | User-level | Individual developers |
| Team Access Token | Team-scoped | Team automation |
| Organization Access Token | Org-scoped | Org-wide integration |

### API Authentication Format

```
Authorization: token {token}
```

### Token Features

- Optional expiry dates for short-lived tokens
- Programmatic management via Personal Access Tokens API
- Can be scoped to organizations/teams
- Support for OIDC token exchange (GitHub Actions, etc.)

### Recommended Approach for Lightfast

1. User manually creates Pulumi access token in Pulumi Cloud console
2. User provides token to Lightfast during source connection
3. Lightfast stores token encrypted
4. All API requests include `Authorization: token {token}` header

**No automatic OAuth flow possible** - similar to GitHub PAT approach.

## Webhooks

### Availability

| Plan | Webhooks |
|------|----------|
| Free/Individual | No |
| Team | Yes |
| Enterprise | Yes |
| Business Critical | Yes |

### Available Events

| Event | Description | Memory Use Case |
|-------|-------------|-----------------|
| Stack Update | Infrastructure create/update/delete operations | Track deployment history, resource changes |
| Deployment | Deployment lifecycle events | Monitor deployment status, failures |
| Policy Violation | Security/compliance policy failures | Flag compliance issues for agent context |
| ESC Environment Revision | Pulumi ESC environment/secrets changes | Track configuration changes |

### Webhook Configuration

Webhooks can be configured at:
- **Organization level** - All stacks in org
- **Stack level** - Specific stacks only

### Webhook Management

```
# Create webhook via API
POST /api/orgs/{org}/hooks

# List webhooks
GET /api/orgs/{org}/hooks

# Delete webhook
DELETE /api/orgs/{org}/hooks/{hookId}
```

### Webhook Verification

**Not documented** - needs verification through testing whether Pulumi signs webhook payloads (similar to how Vercel uses HMAC-SHA256).

### Payload Examples

Webhook payload schemas are not fully documented. Would need to set up test webhooks to capture actual payloads.

## APIs

### Base URL

- **Managed Pulumi Cloud**: `https://api.pulumi.com`
- **Self-Hosted**: Custom configured endpoint

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/stacks` | GET | List user's stacks |
| `/api/stacks/{org}/{project}/{stack}` | GET | Get stack details |
| `/api/stacks/{org}/{project}/{stack}/updates` | GET | Get stack update history |
| `/api/stacks/{org}/{project}/{stack}/export` | GET | Export stack state |
| `/api/orgs/{org}/auditlogs` | GET | Get audit logs |
| `/api/orgs/{org}/hooks` | GET/POST | Manage webhooks |
| `/api/user/tokens` | GET/POST | Manage access tokens |

### Rate Limits

- **100 requests in 10 seconds**
- **600 requests in one minute**
- Limits shared between API v2 and v1
- Applies to entire Workspace
- Exceeded requests return **429 status code**

**Best Practices**:
- Implement exponential backoff
- Batch API calls where possible
- Run automations multiple times daily instead of bursts

### Pagination

Standard offset/limit pagination (not cursor-based).

### GraphQL

**Not available** - REST API only.

## Data for Lightfast Memory

### Data Model Components

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| **Stacks** | Isolated infrastructure instances (dev/staging/prod) | Know what environments exist and their configuration |
| **Resources** | Cloud infrastructure managed by Pulumi | Understand what infrastructure is deployed |
| **Deployments** | Operations that create/update/delete resources | Track change history and patterns |
| **Stack Outputs** | Values exported from deployments | Current infrastructure state (URLs, IDs, etc.) |
| **Audit Logs** | Who did what, when | Team activity patterns, common failures |
| **Policy Violations** | Security/compliance enforcement results | Compliance issues and constraints |
| **ESC Environments** | Configuration and secrets | Environment-specific settings |

### Most Valuable Data for AI Agents

1. **Deployment History**
   - What changed, when, and why
   - Failed vs successful deployments
   - Rollback events
   - Infrastructure drift detection

2. **Stack Outputs**
   - Current infrastructure state
   - URLs, endpoints, resource IDs
   - Environment-specific configurations

3. **Resource Inventory**
   - What infrastructure exists
   - Cross-cloud visibility
   - Resource relationships and dependencies

4. **Audit Logs**
   - Team activity patterns
   - Who manages what infrastructure
   - Common failure points

5. **Policy Violations**
   - Compliance issues
   - Security misconfigurations
   - Cost anomalies

### Example AI Agent Queries

- "What AWS resources are deployed in production?"
- "Show me all failed deployments in the last week"
- "What changed in the database stack yesterday?"
- "Are there any unresolved policy violations?"
- "Which stacks depend on the VPC stack?"

## Recommended Implementation Approach

### 1. Authentication Flow

```
User Flow:
1. User clicks "Connect Pulumi" in Lightfast
2. Instructions displayed: "Create a Pulumi access token"
3. Link to: https://app.pulumi.com/account/tokens
4. User pastes token into Lightfast
5. Lightfast validates token with GET /api/user
6. Token stored encrypted in database
```

### 2. Initial Data Sync (via REST API)

```
Sync Order:
1. GET /api/user → Validate token, get user info
2. GET /api/user/stacks → List all accessible stacks
3. For each stack:
   - GET /api/stacks/{org}/{project}/{stack} → Stack details
   - GET /api/stacks/{org}/{project}/{stack}/updates?pageSize=10 → Recent deployments
   - GET /api/stacks/{org}/{project}/{stack}/export → Current state
4. GET /api/orgs/{org}/auditlogs → Recent activity
```

### 3. Webhook Setup

```
Setup Flow:
1. Lightfast generates webhook endpoint URL
2. Create webhook via API (or instruct user):
   POST /api/orgs/{org}/hooks
   {
     "displayName": "Lightfast Memory",
     "payloadUrl": "https://lightfast.ai/api/webhooks/pulumi/{userId}",
     "active": true
   }
3. Store webhook ID for management
```

### 4. Real-time Updates (via Webhooks)

| Event | Action |
|-------|--------|
| Stack Update | Re-index stack state and outputs |
| Deployment | Add to deployment history |
| Policy Violation | Flag in memory with severity |

### 5. Periodic Sync (respect rate limits)

| Data | Frequency | Method |
|------|-----------|--------|
| Stack outputs | Every 4 hours | API polling |
| Audit logs | Daily | API polling |
| Full state refresh | Weekly | API export |

## Platform-Specific Notes

1. **No OAuth** - Cannot request automatic access; manual token required
2. **Paid plans for webhooks** - Free tier users limited to API polling only
3. **Conservative rate limits** - Must implement batching and backoff
4. **Self-hosted support** - Works with Pulumi self-hosted (different base URL)
5. **Webhook verification unclear** - Need to test if payloads are signed
6. **Incomplete docs** - Some payload schemas need reverse engineering

## Comparison with Other Connectors

| Aspect | Vercel | Pulumi | Notes |
|--------|--------|--------|-------|
| Auth | OAuth 2.0 | Token-based | Pulumi requires manual token |
| Webhooks | All plans | Paid only | Limits free tier |
| Rate limits | Unknown | 600/min | Pulumi documented |
| App marketplace | Yes | No | Cannot list in Pulumi |
| GraphQL | No | No | Both REST only |
| Self-hosted | No | Yes | Pulumi advantage |

## Integration Complexity

**Medium** complexity:
- Simpler than OAuth integrations (no auth flow)
- More complex token management UX
- Rate limit handling critical
- Webhook payload discovery needed

## Limitations & Blockers

### Limitations

1. **No OAuth 2.0** - Manual token management required
2. **Webhooks require paid plan** - Free tier cannot use real-time updates
3. **Rate limits** - Conservative limits require careful implementation
4. **Incomplete documentation** - Some webhook payloads not documented
5. **No GraphQL** - More API calls for complex queries

### Potential Blockers

1. **Token rotation UX** - Users must manually rotate tokens
2. **Free tier limitations** - Webhook-only approach won't work
3. **Undocumented webhook verification** - Security concern if no signing

## Related Research

- (Future) Terraform Cloud integration research
- (Future) AWS CloudFormation integration research
- Vercel integration implementation (similar webhook pattern)

## Next Steps

1. **Use `/create_plan pulumi integration`** to plan implementation
2. **Test API access** - Create test Pulumi org, generate token, explore API
3. **Capture webhook payloads** - Set up test webhooks to document schemas
4. **Verify webhook signing** - Test if Pulumi includes signature headers
5. **Design token management UX** - How users provide/rotate tokens
6. **Rate limit strategy** - Implement batching and exponential backoff
