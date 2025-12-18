---
date: 2025-12-10T07:27:11Z
researcher: Claude Code
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "Intercom Integration Research"
tags: [research, integration, intercom, connector, customer-support]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude Code
---

# Research: Intercom Integration for Lightfast Memory

**Date**: 2025-12-10T07:27:11Z
**Researcher**: Claude Code
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

Is it possible to integrate Intercom into Lightfast's memory system? What would be involved?

## Summary

**Yes, building an Intercom integration is highly feasible and worthwhile.** Intercom provides a robust developer platform with OAuth 2.0 authentication, comprehensive webhooks, REST APIs, and rich customer conversation data that would significantly enrich AI agent context for software teams.

**Feasibility Score**: 9/10

## Documentation Links

| Resource | URL |
|----------|-----|
| Developer Hub | https://developers.intercom.com |
| REST API Reference | https://developers.intercom.com/docs/references/rest-api/api.intercom.io |
| Authentication Guide | https://developers.intercom.com/docs/build-an-integration/learn-more/authentication |
| OAuth Setup | https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/setting-up-oauth |
| OAuth Scopes | https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/oauth-scopes |
| Webhooks Overview | https://developers.intercom.com/docs/webhooks |
| Webhook Setup | https://developers.intercom.com/docs/webhooks/setting-up-webhooks |
| Webhook Topics | https://developers.intercom.com/docs/references/webhooks/webhook-models |
| Rate Limiting | https://developers.intercom.com/docs/references/rest-api/errors/rate-limiting |
| Object Model | https://developers.intercom.com/docs/build-an-integration/learn-more/object-model |
| App Installation | https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/installing-uninstalling-apps |
| App Store Publishing | https://developers.intercom.com/docs/publish-to-the-app-store/review-publish-your-app |

## Integration Type

- **Public Apps**: Listed or unlisted in Intercom App Store, use OAuth 2.0
- **Private Apps**: Access token-based, single workspace only (simpler for internal use)

**Recommended**: Start with private app for MVP, convert to public OAuth app for multi-tenant.

## Authentication

### OAuth Flow

- **Flow type**: OAuth 2.0 Authorization Code Flow
- **Installation**: Per-workspace (each Intercom workspace installs separately)
- **Token management**: Long-lived tokens (no automatic expiration)
- **No refresh token mechanism documented** - tokens don't appear to expire

### Required Credentials

- `client_id` (App ID)
- `client_secret`
- Redirect URI(s)

### Private App Alternative

For single-workspace or internal use:
```javascript
var client = new Intercom.Client({ token: 'YOUR_ACCESS_TOKEN' });
```

### Key Scopes

Scopes documentation: https://developers.intercom.com/docs/build-an-integration/learn-more/authentication/oauth-scopes

Likely needed for Lightfast Memory:
- Read conversations
- Read contacts
- Read companies
- Read tickets (if using ticketing)

## Webhooks

### Availability

**Fully supported** - Webhook subscriptions tied to your App, receive notifications from all workspaces where app is installed.

### Available Events

| Event Category | Description | Memory Use Case |
|----------------|-------------|-----------------|
| `conversation.user.created` | User/lead initiated conversation | Capture customer questions, issues |
| `conversation.user.replied` | Contact replied to conversation | Track conversation flow |
| `conversation.admin.replied` | Admin replied to conversation | Capture support responses |
| `conversation.admin.assigned` | Conversation assigned | Team workflow tracking |
| `conversation.state.changed` | Status change (open/closed) | Resolution tracking |
| `contact.created` | New contact added | Customer onboarding |
| `contact.updated` | Contact data changed | Profile updates |
| `company.created` | New company added | Account tracking |
| `content_stat.series` | Content statistics | Engagement analytics |

### Webhook Verification

- Signature verification available (specific mechanism requires deeper documentation review)
- IP ranges provided for allowlisting
- Custom headers can be configured

### Webhook Payload Example

```json
{
  "type": "content_stat.series",
  "created_at": "2022-10-11T15:01:07.000Z",
  "content_stat": {
    "id": 1,
    "content_type": "series",
    "content_id": 1,
    "stat_type": "receipt",
    "ruleset_id": 29,
    "content_title": "Untitled"
  },
  "contact": {
    "type": "contact",
    "id": "6318db7dfb80c614fe1792b5"
  }
}
```

## APIs

### Endpoints

**REST API** (no GraphQL) - Current version: v2.14

**Core Resources**:
| Endpoint | Description |
|----------|-------------|
| `/admins` | Admin/agent management |
| `/contacts` | Customer contacts (users/leads) |
| `/conversations` | Support conversations |
| `/companies` | Company/account objects |
| `/tickets` | Ticketing system data |
| `/articles` | Help Center content |
| `/data_events` | Custom event tracking |
| `/tags` | Organization tags |
| `/segments` | User segments |

### Rate Limits

- **1,000 requests per minute** (hard cap)
- Distributed over 10-second periods: ~166 operations per 10 seconds
- **Not customizable** - limit increases not available
- HTTP 429 response when exceeded
- **Webhooks do NOT count** toward API rate limits

### Pagination

Standard pagination support for list endpoints.

### Version Header

Required header: `Intercom-Version: 2.14`

## Data for Lightfast Memory

### High-Value Data Types

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| **Conversations** | Full conversation history, multi-channel (chat, email, in-app) | Primary context for customer interactions |
| **Contacts** | User profiles, custom attributes, activity history | Customer identity and preferences |
| **Companies** | Company profiles, plan info, account health | Account-level context |
| **Tickets** | Support tickets, priority, custom fields | Issue tracking |
| **Events** | Custom event tracking, user behavior | Product usage patterns |
| **Articles** | Help Center content, search analytics | Knowledge base context |

### Real-time vs Batch

- **Real-time**: Webhooks for instant conversation updates
- **Batch**: REST API for historical data, paginated retrieval

## Recommended Implementation Approach

### Phase 1: Private App (MVP)
1. Create Access Token-based private app
2. Build webhook receiver for conversation events
3. Implement API client with rate limit handling
4. Test with single workspace

### Phase 2: Public OAuth App
1. Implement OAuth 2.0 flow
2. Register as public app (unlisted initially)
3. Multi-workspace support
4. Add to Lightfast connector UI

### Phase 3: App Store (Optional)
1. Complete listing requirements
2. Submit for Intercom review
3. Get listed in Intercom App Store

## Platform-Specific Notes

### Strengths
- Mature OAuth 2.0 implementation
- Comprehensive webhook system with real-time conversation events
- Rich data models (conversations, contacts, companies, tickets)
- Well-structured developer documentation
- API access available on all pricing tiers

### Challenges

1. **Rate limits not negotiable**: 1,000 req/min hard cap may limit bulk historical imports
   - **Mitigation**: Use webhooks for real-time, batch carefully for historical

2. **No token refresh flow**: Long-lived tokens (good and bad)
   - **Mitigation**: Handle token invalidation gracefully

3. **REST only**: No GraphQL, may need multiple requests for related data
   - **Mitigation**: Cache aggressively, leverage webhooks

4. **App review for public apps**: Required for App Store listing
   - **Mitigation**: Start unlisted, submit for review when ready

## Value Proposition for Lightfast

**Best Use Cases**:
1. **AI agents need customer context** - Recent conversations, pain points, feature requests
2. **Support automation** - Auto-suggest responses based on similar past conversations
3. **Product insights** - Extract common issues, feature requests from support data
4. **Customer intelligence** - Understand customer health, usage patterns
5. **Team collaboration** - Surface relevant support context in developer workflows

## Related Research

- Review existing connectors (Linear, GitHub, Vercel) for implementation patterns
- Compare webhook handling across connectors

## Next Steps

1. Use `/create_plan intercom integration` to plan implementation
2. Review existing connector implementations in `packages/console-webhooks/`
3. Design data schema for storing Intercom conversations
4. Register Intercom Developer Account at https://developers.intercom.com

## Appendix: Quick Reference

### Environment Variables Needed
```env
INTERCOM_CLIENT_ID=
INTERCOM_CLIENT_SECRET=
INTERCOM_WEBHOOK_SECRET=
```

### Minimum Viable Routes
```
/api/intercom/callback     # OAuth redirect handler
/api/intercom/webhooks     # Webhook receiver
```

### SDK Options
- Official: `intercom-client` npm package
- Or: Direct REST API calls with fetch
