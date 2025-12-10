---
date: 2025-12-10T07:05:03Z
researcher: Claude
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "PlanetScale Integration Research"
tags: [research, integration, planetscale, connector, database, webhooks]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude
---

# Research: PlanetScale Integration for Lightfast Memory

**Date**: 2025-12-10T07:05:03Z
**Researcher**: Claude
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

Can PlanetScale be integrated into Lightfast's memory system, and if so, what capabilities are available?

## Summary

**YES, PlanetScale integration is viable and well-supported.** PlanetScale offers:
- Webhooks for schema change events (since October 2023)
- Comprehensive management API (databases, branches, deploy requests)
- Service token + OAuth authentication
- Audit logs for activity tracking
- HMAC signature verification for security

**Best for capturing**: Schema evolution, deployment workflows, team collaboration on database changes.

**Not suitable for**: Query-level monitoring, connection tracking, real-time performance metrics (dashboard-only features).

## Documentation Links

- **Developer Portal**: https://api-docs.planetscale.com
- **Webhooks Guide**: https://planetscale.com/docs/api/webhooks
- **Webhook Events Reference**: https://planetscale.com/docs/api/webhook-events
- **API Reference**: https://api-docs.planetscale.com/reference/getting-started-with-planetscale-api
- **Service Tokens**: https://planetscale.com/docs/api/service-tokens
- **OAuth Apps**: https://planetscale.com/blog/oauth-applications-are-now-available

## Integration Type

**Hybrid: Service Token + Webhooks**

- **Service Tokens**: Primary authentication for API access
- **OAuth Apps**: Available (public beta since February 2024) for user-facing integrations
- **Webhooks**: Event-driven notifications for schema changes

## Authentication

### Service Tokens (Primary Method)

- Created in organization settings with specific permissions
- Used via `Authorization` header
- Documentation: https://planetscale.com/docs/api/service-tokens

**Available Scopes**:
| Scope | Description |
|-------|-------------|
| `read_database` | Read database/branch information |
| `write_database` | Create/modify databases, branches, webhooks |
| `read_audit_logs` | Access organization audit logs |
| `read_invoices` | Access billing information |

### OAuth (For User-Facing Integrations)

- Public beta since February 2024
- Enables third-party apps to get user authorization
- Created in org Settings > OAuth applications
- Required for some organization-scoped endpoints

### Token Management

- Service tokens don't expire automatically
- Can be revoked/regenerated in settings
- No refresh mechanism needed (persistent tokens)

## Webhooks

### Available Events

| Event | Description | Memory Use Case |
|-------|-------------|-----------------|
| `deploy_request.closed` | Deploy request completed/closed | Track schema migrations, success/failure |
| `deploy_request.pending_cutover` | Deploy ready for manual approval | Notification for review workflows |
| `branch.ready` | Branch is ready for use | Track feature branch creation |
| `access_request` | Staff requests org access | Security/audit awareness |

**Note**: `deploy_request.pending_cutover` does NOT fire for auto-cutover/auto-apply deployments.

### Webhook Verification

- **Mechanism**: HMAC SHA-256
- **Header**: `x-planetscale-signature`
- **Secret**: Provided when webhook is created

**Verification Example (Python)**:
```python
import hmac
from hashlib import sha256

hash_object = hmac.new(
    secret_token.encode('utf-8'),
    msg=payload_body,
    digestmod=sha256
)
expected_signature = hash_object.hexdigest()
if not hmac.compare_digest(expected_signature, signature_header):
    raise Exception("Request signatures didn't match!")
```

### Payload Examples

**deploy_request.closed**:
```json
{
  "timestamp": 1698253030,
  "event": "deploy_request.closed",
  "organization": "myorg",
  "database": "example_database",
  "resource": {
    "id": "4xsz0ql82y4n",
    "type": "DeployRequest",
    "actor": {
      "id": "...",
      "type": "User",
      "display_name": "Jane Doe",
      "avatar_url": "..."
    },
    "branch": "dev",
    "into_branch": "main",
    "state": "closed",
    "deployment_state": "complete_revert",
    "deployment": {
      "deploy_operations": [
        {
          "ddl_statement": "ALTER TABLE `Persons` DROP COLUMN `Address`",
          "operation_name": "ALTER",
          "table_name": "Persons",
          "can_drop_data": true,
          "state": "complete",
          "deploy_errors": ""
        }
      ],
      "schema_last_updated_at": "2023-10-25T16:55:00.288Z"
    }
  }
}
```

## APIs

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/organizations/:org/databases` | GET/POST | List/create databases |
| `/v1/organizations/:org/databases/:db/branches` | GET/POST | List/create branches |
| `/v1/organizations/:org/databases/:db/deploy-requests` | GET/POST | Manage deploy requests |
| `/v1/organizations/:org/databases/:db/webhooks` | GET/POST/DELETE | Manage webhooks |
| `/v1/organizations/:org/databases/:db/webhooks/:id/test` | POST | Test webhook delivery |
| `/v1/organizations/:org/audit-log` | GET | Organization audit logs |
| `/v1/organizations/:org/invoices` | GET | Billing invoices |

### Rate Limits

Not publicly documented. The API docs mention limits exist but don't specify values.

### Pagination

Standard cursor-based pagination (details not fully documented in search results).

## Data for Lightfast Memory

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| Schema Changes | DDL statements from deploy requests | Track database evolution, breaking changes |
| Deploy History | Success/failure/revert of deployments | Understand deployment patterns, issues |
| Branch Workflow | Feature branch creation/merging | Development velocity, feature tracking |
| Actor Information | Who made each change | Team collaboration, accountability |
| Audit Logs | All org-level user actions | Security, compliance, activity patterns |

### Example Memory Entry

```
"On 2024-03-15, @jane deployed schema changes to production:
- Dropped 'Address' column from 'Persons' table (potential data loss)
- Deploy request #42 from 'feature-user-updates' branch
- Deployment succeeded but was later reverted at 16:57 UTC
- DDL: ALTER TABLE `Persons` DROP COLUMN `Address`"
```

## Recommended Implementation Approach

### 1. Webhook Registration

Create webhook endpoint at `/api/planetscale/webhooks` to receive events:
- `deploy_request.closed` - Primary event for schema changes
- `branch.ready` - Track development workflow

### 2. Service Token Setup

Create service token with scopes:
- `read_database` - Required for webhook management
- `write_database` - Required for webhook management
- `read_audit_logs` - For comprehensive activity tracking

### 3. Webhook Handler Pattern

```typescript
// packages/console-webhooks/src/planetscale.ts
export async function handlePlanetScaleWebhook(payload: PlanetScaleWebhookPayload) {
  const { event, organization, database, resource } = payload;

  if (event === 'deploy_request.closed') {
    const operations = resource.deployment.deploy_operations;

    // Extract for memory:
    // - Schema changes (DDL statements)
    // - Affected tables
    // - Actor (who made the change)
    // - Deployment outcome (success/revert)
    // - Source/target branches
  }
}
```

### 4. Verification Middleware

```typescript
function verifyPlanetScaleSignature(payload: Buffer, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expected = hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### 5. Environment Variables

```bash
PLANETSCALE_SERVICE_TOKEN_ID="..."
PLANETSCALE_SERVICE_TOKEN="..."
PLANETSCALE_WEBHOOK_SECRET="..."
```

## Platform-Specific Notes

### Limitations

- **No Query Insights API**: Query performance metrics are dashboard-only
- **No Connection Events**: Cannot track connections/disconnections
- **No Data Access**: API manages infrastructure, not table data
- **Limited Events**: Focused on schema changes, not operations

### Gotchas

- `deploy_request.pending_cutover` won't fire if auto-cutover is enabled
- Webhook management requires BOTH `write_database` AND `read_database` scopes
- Some endpoints require OAuth, not just service tokens
- OAuth apps still in public beta (may have changes)

### Compared to Other Connectors

| Feature | PlanetScale | GitHub | Vercel |
|---------|-------------|--------|--------|
| Webhook Events | ~4 events | 100+ events | 10+ events |
| OAuth | Beta | Stable | Stable |
| API Coverage | Infrastructure | Full | Full |
| Use Case | Schema changes | Code changes | Deployments |

## Related Research

- Vercel integration (existing connector)
- GitHub integration (existing connector)
- Database schema tracking patterns

## Next Steps

1. **Decide scope**: Schema changes only, or include audit logs?
2. **Use `/create_plan planetscale integration`** to plan implementation
3. **Review existing patterns**: Look at `packages/console-webhooks/src/` for connector patterns
4. **Consider value**: Is schema change tracking high enough value for initial implementation?

## Open Questions

1. Should we poll audit logs periodically, or just rely on webhooks?
2. How to handle multi-database setups (one webhook per database)?
3. Rate limit details - need to test or find documentation
4. Should OAuth flow be supported for user-owned databases?
