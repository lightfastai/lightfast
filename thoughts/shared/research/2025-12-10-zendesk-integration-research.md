---
date: 2025-12-10T07:27:48Z
researcher: jeevanpillay
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "Zendesk Integration Research"
tags: [research, integration, zendesk, connector, customer-support]
status: complete
last_updated: 2025-12-10
last_updated_by: jeevanpillay
---

# Research: Zendesk Integration for Lightfast Memory

**Date**: 2025-12-10T07:27:48Z
**Researcher**: jeevanpillay
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

How to integrate Zendesk into Lightfast's memory system to capture customer support tickets, conversations, and knowledge base articles for AI agent context.

## Summary

**Verdict: Highly Feasible - Excellent Fit**

Zendesk provides a comprehensive developer platform with OAuth 2.0 authentication, webhooks for all major events, and extensive REST APIs. The platform is well-suited for building a Lightfast integration to capture ticket conversations, user data, and knowledge base articles for AI agent memory. Rich conversational data makes this an ideal source for training AI agents on customer interactions.

## Documentation Links

| Resource | URL |
|----------|-----|
| Developer Portal | https://developer.zendesk.com |
| API Reference | https://developer.zendesk.com/api-reference |
| OAuth Guide | https://developer.zendesk.com/documentation/api-basics/authentication/using-oauth-to-authenticate-zendesk-api-requests-in-a-web-app |
| Webhooks Introduction | https://developer.zendesk.com/api-reference/webhooks/introduction |
| Webhook Event Types | https://developer.zendesk.com/api-reference/webhooks/event-types/webhook-event-types |
| Webhook Security | https://developer.zendesk.com/documentation/webhooks/webhook-security-and-authentication |
| Rate Limits | https://developer.zendesk.com/api-reference/introduction/rate-limits |
| Marketplace Publishing | https://developer.zendesk.com/documentation/marketplace/publishing-to-the-marketplace/submit-your-app/ |

## Integration Type

**Options available:**
1. **OAuth Apps** - Public or private apps using OAuth 2.0 (recommended for Lightfast)
2. **Zendesk Apps Framework** - Embedded apps within Zendesk UI
3. **Integration Apps** - Standalone integrations via Marketplace
4. **API-only** - Direct API access using API tokens
5. **Zendesk Integration Services (ZIS)** - Serverless integration platform

**Recommendation**: Start with private OAuth app for speed, consider marketplace distribution later.

## Authentication

### OAuth Flow

- **Flow type**: OAuth 2.0 Authorization Code Grant
- **Authorization URL**: `https://{subdomain}.zendesk.com/oauth/authorizations/new`
- **Token URL**: `https://{subdomain}.zendesk.com/oauth/tokens`
- **Scopes needed**:
  - `read` - Read access to resources
  - `write` - Write access to resources
  - `organizations:write` - Organization-specific write access

### Token Management

- **Refresh mechanism**: Standard OAuth 2.0 refresh token flow
- **Token expiry**: Access tokens expire, refresh tokens are long-lived

### Token Exchange Example

```bash
curl --request POST \
  --url https://{subdomain}.zendesk.com/oauth/tokens \
  --header 'Content-Type: application/json' \
  --data '{
    "grant_type": "authorization_code",
    "code": "{authorization_code}",
    "client_id": "{client_id}",
    "client_secret": "{client_secret}",
    "redirect_uri": "{redirect_uri}",
    "scope": "read"
  }'
```

### API Token Alternative

For simpler private integrations:
```bash
curl https://{subdomain}.zendesk.com/api/v2/tickets.json \
  -u email@example.com/token:{api_token}
```

## Webhooks

### Available Events

| Event | Description | Memory Use Case |
|-------|-------------|-----------------|
| `zen:event-type:ticket.ticketCreated` | New ticket created | Capture new support requests |
| `zen:event-type:ticket.ticketUpdated` | Ticket modified | Track conversation updates |
| Ticket status changed | Status transition | Track resolution flow |
| Comment added | New reply on ticket | Capture full conversation |
| User created | New user registered | Build user context |
| User updated | User profile changed | Keep user data current |
| Article published | Help article goes live | Update knowledge base |
| Article updated | Article content changed | Keep docs current |

### Webhook Verification

- **Signing mechanism**: HMAC-SHA256 signature
- **Headers**: Two security headers included in requests
- **Verification process**: Compare computed signature with header value
- **Status**: Optional but strongly recommended

### Payload Example

```json
{
  "event": {
    "type": "zen:event-type:ticket.ticketCreated",
    "detail": {
      "actor_id": 123456,
      "assignee_id": 789012,
      "brand_id": 111222,
      "created_at": "2025-12-10T07:00:00Z",
      "description": "Customer issue description",
      "external_id": null,
      "form_id": 333444,
      "id": 555666,
      "priority": "high",
      "status": "new",
      "subject": "Ticket subject line"
    }
  }
}
```

### Retry Policy

- Monitoring available in Admin Center
- No explicit retry documentation found
- **Best practice**: Return 200 quickly, process async, implement idempotency

## APIs

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/tickets.json` | GET | List all tickets |
| `/api/v2/tickets/{id}.json` | GET | Get single ticket |
| `/api/v2/tickets/{id}/comments.json` | GET | Get ticket comments |
| `/api/v2/users.json` | GET | List users |
| `/api/v2/organizations.json` | GET | List organizations |
| `/api/v2/search.json` | GET | Search across entities |
| `/api/v2/incremental/tickets` | GET | Incremental ticket export |
| `/api/v2/help_center/articles.json` | GET | Knowledge base articles |

### Rate Limits

| Limit Type | Value | Notes |
|------------|-------|-------|
| Standard API | 700 req/min | Per Zendesk account |
| High Volume (add-on) | 2,500 req/min | Suite Growth+ plans |
| List Tickets (page 500+) | 50 req/min | Throttled for deep pagination |
| List Users (page 10,000+) | 100 req/min | Throttled for deep pagination |

**Rate limit response**: HTTP 429 with `Retry-After` header

### Pagination

**Cursor-Based Pagination (Recommended)**:
```javascript
// Response format
{
  "tickets": [...],
  "meta": {
    "has_more": true,
    "after_cursor": "eyJvIjoiLWNyZWF...",
    "before_cursor": "eyJvIjoiY3JlYXR..."
  }
}

// Next page request
GET /api/v2/tickets.json?page[after]={after_cursor}&page[size]=100
```

### GraphQL

Not available. Zendesk uses REST APIs exclusively.

## Data for Lightfast Memory

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| **Tickets** | Support requests with subject, description, status | Core customer interaction data |
| **Comments** | Full conversation threads | Rich context for agent training |
| **Attachments** | Files, screenshots | Additional context |
| **Users** | Customer profiles | User context for personalization |
| **Organizations** | Company groupings | B2B customer context |
| **Articles** | Knowledge base content | Reference documentation |
| **Tags** | Categorization | Topic classification |
| **Custom Fields** | Organization-specific data | Business-specific context |

### Data Volume Estimates

| Customer Size | Tickets | Comments/Ticket | Total Documents |
|---------------|---------|-----------------|-----------------|
| Small | 1,000 | 5 | ~5,000 |
| Medium | 10,000 | 10 | ~100,000 |
| Enterprise | 100,000+ | 20 | ~2,000,000+ |

### Sync Strategies

**Real-time (Webhooks)**:
- Best for: Keeping memory current
- Events: ticket.created, ticket.updated, comment.added, article.published

**Batch (REST API)**:
- Best for: Initial backfill, historical data
- Endpoint: `/api/v2/incremental/tickets?start_time={timestamp}`

```python
# Incremental sync pattern
GET /api/v2/incremental/tickets?start_time=1704067200
# Returns all tickets updated since Jan 1, 2024
```

## Recommended Implementation Approach

### Phase 1: Core Integration (MVP)

1. **OAuth Setup**
   - Register OAuth client in Zendesk Admin Center
   - Implement authorization code flow
   - Store tokens per-workspace

2. **Webhook Receiver**
   - Create endpoint: `/api/zendesk/webhooks`
   - Implement signature verification
   - Handle: ticket.created, ticket.updated, comment.added

3. **Initial Sync**
   - Use incremental ticket API for backfill
   - Process in batches respecting rate limits
   - Map to Lightfast document format

4. **Data Models**
   ```typescript
   interface ZendeskTicket {
     id: number;
     subject: string;
     description: string;
     status: 'new' | 'open' | 'pending' | 'solved' | 'closed';
     priority: 'low' | 'normal' | 'high' | 'urgent';
     requester_id: number;
     assignee_id: number;
     organization_id: number;
     created_at: string;
     updated_at: string;
     tags: string[];
     custom_fields: Array<{ id: number; value: any }>;
   }
   ```

### Phase 2: Enhanced Coverage

5. **Knowledge Base Sync** - Sync help center articles
6. **User/Org Context** - Enrich tickets with metadata
7. **Attachment Handling** - Process files if relevant
8. **Search Integration** - Query Zendesk from Lightfast

### Phase 3: Marketplace (Optional)

9. **Global OAuth** - Upgrade for multi-tenant distribution
10. **Marketplace Submission** - 1-3 week review process

## Platform-Specific Notes

### Gotchas

1. **Subdomain Required**: All API calls need customer's subdomain
   - Capture during OAuth installation
   - Format: `https://{subdomain}.zendesk.com/api/v2/`

2. **Global OAuth for Marketplace**: Public apps MUST use global OAuth tokens
   - Private integrations can use regular OAuth

3. **Volume Limits**: Aggressive throttling after page 500 for tickets
   - Use incremental export APIs for large backfills

4. **Optional Signature Verification**: Webhook signing is optional but should be implemented

5. **Custom Fields Dynamic**: Must fetch field definitions via API
   - Cannot hardcode field structure

6. **Pagination Transition**: Moving from offset to cursor-based
   - Use cursor-based for new implementations

### Best Practices

- Implement exponential backoff for rate limits
- Use incremental APIs over list endpoints for bulk data
- Return 200 from webhooks quickly, process async
- Store subdomain with OAuth tokens

## Integration Complexity Assessment

| Aspect | Complexity | Notes |
|--------|------------|-------|
| OAuth | Low | Standard implementation |
| Webhooks | Low | Straightforward with signature verification |
| API Integration | Low-Medium | RESTful with good pagination |
| Rate Limit Handling | Medium | Requires proper backoff |
| Data Mapping | Low | Clean data models |
| **Overall** | **Medium** | 2-3 weeks for MVP |

## Comparison with Existing Connectors

Similar to existing Lightfast connectors:
- **Like Vercel**: OAuth + webhook pattern
- **Like GitHub**: Event-driven with rich payload data
- **Unique**: Subdomain-based multi-tenancy

## Related Research

- Review existing connector implementations in `packages/console-webhooks/`
- Pattern reference: `packages/console-vercel/` (if implemented)

## Next Steps

1. Use `/create_plan zendesk integration` to plan implementation
2. Review existing connector implementations for patterns
3. Decide: Private OAuth first vs Marketplace from start

## Summary Table

| Aspect | Status | Notes |
|--------|--------|-------|
| **OAuth 2.0** | Supported | Standard flow, refresh tokens |
| **API Tokens** | Available | Simpler for private integrations |
| **Webhooks** | Comprehensive | All major events, signature verification |
| **REST API** | Complete | Tickets, users, orgs, articles |
| **GraphQL** | Not available | REST only |
| **Rate Limits** | Moderate | 700 req/min, upgradable |
| **Incremental Sync** | Built-in | Dedicated export APIs |
| **Search API** | Available | Full-text search |
| **Documentation** | Excellent | Comprehensive official docs |
| **Marketplace** | Optional | 1-3 week review |
| **Data Richness** | Excellent | Perfect for AI memory |
| **Integration Complexity** | Medium | Standard patterns |

**Final Verdict**: Proceed with Zendesk integration. The platform is mature, well-documented, and provides exactly the type of conversational data Lightfast needs for AI agent memory.
