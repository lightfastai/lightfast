---
title: Data Sync Strategies by Source
description: Webhook capabilities, polling fallbacks, and sync patterns for each data source
status: draft
owner: engineering
audience: engineering
last_updated: 2025-11-12
tags: [phase2, webhooks, sync, polling, integration]
---

# Data Sync Strategies by Source

Comprehensive guide to how we sync data from each source: webhook capabilities, polling strategies, and reliability patterns.

---

## Summary: Webhook Support Matrix

| Source | Webhooks? | Real-time? | Retry Logic? | Polling Needed? | Initial Sync |
|--------|-----------|------------|--------------|-----------------|--------------|
| **GitHub** | ✅ Yes | ✅ Yes | ✅ Yes (auto) | No | Clone repo |
| **Linear** | ✅ Yes | ✅ Yes | ✅ Yes (3x retry) | Optional (backfill) | GraphQL query |
| **Notion** | ✅ Yes | ✅ Yes | ✅ Yes (auto) | Optional (backfill) | API pagination |
| **Sentry** | ✅ Yes | ✅ Yes | ✅ Yes (1s timeout) | Optional (backfill) | API pagination |
| **Vercel** | ✅ Yes | ✅ Yes | ✅ Yes (auto) | No | API pagination |
| **Zendesk** | ✅ Yes | ✅ Yes | ✅ Yes (auto) | Optional (backfill) | API pagination |

**Good News:** All platforms support webhooks! 🎉

---

## GitHub (Current Implementation)

### Webhook Support: ✅ Excellent

**Events:**
- `push` - Code changes, file additions/deletions
- `installation` - App installed/uninstalled
- `installation_repositories` - Repos added/removed

**Configuration:**
- Automatic via GitHub App installation
- Webhook secret for signature verification
- Delivery ID for idempotency

**Reliability:**
- Auto-retry on failure (GitHub handles this)
- Delivery logs available in GitHub UI
- 30-day delivery history

**Current Flow:**
```
1. User pushes code → GitHub sends webhook
2. Verify signature
3. Check idempotency (deliveryId)
4. Load lightfast.yml config
5. Fetch changed files via API
6. Process documents (chunk, embed, index)
```

**Rate Limits:**
- Primary rate limit: 5,000 requests/hour (authenticated)
- Secondary rate limit: No more than 100 concurrent requests
- GraphQL rate limit: 5,000 points/hour

**Initial Sync:**
- Clone repository via Git
- Scan for files matching glob patterns
- Process all matching files

---

## Linear

### Webhook Support: ✅ Excellent

**Official Documentation:** https://developers.linear.app/docs/graphql/webhooks

**Events:**
- `Issue` - created, updated, removed
- `Comment` - created, updated, removed
- `Project` - created, updated, removed
- `Cycle` - created, updated, removed
- `Label` - created, updated, removed

**Configuration:**
- Created via API Settings or GraphQL API
- Admin scope required
- Specify webhook URL + label

**Reliability:**
- **Retry Logic:** 3 attempts with exponential backoff
  - Retry 1: After 1 minute
  - Retry 2: After 1 hour
  - Retry 3: After 6 hours
- **Timeout:** 5 seconds
- **Success:** HTTP 200 status required

**Webhook Payload Example:**
```json
{
  "action": "create",
  "type": "Issue",
  "data": {
    "id": "issue-uuid",
    "identifier": "LIN-123",
    "title": "Fix authentication bug",
    "description": "Users experiencing...",
    "state": { "name": "In Progress" },
    "priority": 1,
    "labels": [{ "name": "bug" }],
    "team": { "id": "team-uuid", "key": "ENG" }
  },
  "url": "https://linear.app/...",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z",
  "webhookId": "webhook-uuid"
}
```

**Ingestion Flow:**
```
1. Linear sends webhook (issue.created, issue.updated, etc.)
2. Verify webhook signature
3. Check idempotency (webhookId + action + resourceId)
4. Ensure store exists
5. Process issue/comment:
   - Extract relationships (mentions GitHub PRs, etc.)
   - Chunk description/body
   - Embed multi-view
   - Upsert to Pinecone
   - Save to database
6. Record event in ingestionEvents table
```

**Rate Limits:**
- **OAuth:** 500 requests/hour, 200K complexity points/hour
- **API Key:** 1,500 requests/hour, 250K complexity points/hour
- GraphQL complexity-based throttling

**Initial Sync (Backfill):**
```graphql
query GetIssues($teamId: String!, $after: String) {
  team(id: $teamId) {
    issues(first: 50, after: $after) {
      nodes {
        id
        identifier
        title
        description
        state { name }
        priority
        labels { nodes { name } }
        createdAt
        updatedAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

**Backfill Strategy:**
- Paginate through all issues (50 per page)
- Filter by team(s) configured in lightfast.yml
- Stop at configured date range (e.g., last 6 months)
- Process same as webhook (chunk, embed, index)

---

## Notion

### Webhook Support: ✅ Yes (New in 2025!)

**Official Documentation:** https://developers.notion.com/docs/webhooks

**API Version:** 2025-09-03 (includes webhook support)

**Events:**
- `page.*` - page.created, page.updated, page.deleted
- `database.*` - database.created, database.updated
- `data_source.*` - Multi-source database events (new in 2025-09-03)

**Configuration:**
- Create webhook via API
- Specify event subscriptions
- Integration must have access to workspace

**Webhook Payload Example:**
```json
{
  "event": "page.updated",
  "data": {
    "object": "page",
    "id": "page-uuid",
    "parent": {
      "type": "database_id",
      "database_id": "database-uuid",
      "data_source_id": "data-source-uuid"  // New in 2025-09-03
    },
    "properties": {
      "title": { "title": [{ "text": { "content": "Product Spec" } }] },
      "Status": { "select": { "name": "In Progress" } }
    },
    "last_edited_time": "2025-01-15T10:30:00Z"
  }
}
```

**Reliability:**
- **Request Type:** POST only
- **Retry Logic:** Automatic (Notion handles retries)
- **Timeout:** Standard HTTP timeout

**Limitations:**
- Webhooks not available at workspace level (only integration level)
- Only database page properties sent (not full page content)
- Must fetch full page content via API after webhook

**Ingestion Flow:**
```
1. Notion sends webhook (page.updated)
2. Verify webhook signature
3. Check idempotency (event ID + page ID)
4. Fetch full page content via API:
   - GET /pages/{page_id}
   - GET /blocks/{block_id}/children (for page content)
5. Convert to markdown (HTML → Markdown)
6. Chunk content
7. Embed and index
8. Save to database
```

**Rate Limits:**
- **Standard:** 3 requests/second per integration
- **Burst:** Can exceed briefly, then throttled

**Initial Sync (Backfill):**
```javascript
// Query database for all pages
const response = await notion.databases.query({
  database_id: "database-uuid",
  page_size: 100,
  start_cursor: cursor,
});

// Fetch each page's full content
for (const page of response.results) {
  const blocks = await notion.blocks.children.list({
    block_id: page.id,
  });
  // Process blocks...
}
```

**Backfill Strategy:**
- Query configured databases (from lightfast.yml)
- Paginate through all pages (100 per page)
- Fetch full content for each page
- Process same as webhook

---

## Sentry

### Webhook Support: ✅ Excellent

**Official Documentation:** https://docs.sentry.io/organization/integrations/integration-platform/webhooks/

**Events:**
- `issue.created` - New error group created
- `issue.resolved` - Issue marked as resolved
- `issue.assigned` - Issue assigned to user
- `event.created` - New error event (occurrence)
- `event.alert` - Alert triggered

**Configuration:**
- Create Internal Integration via Sentry UI
- Enable "Alert Rule Action" toggle
- Specify webhook URL
- Configure alert rules to use webhook

**Webhook Headers:**
```
Content-Type: application/json
Request-ID: unique-request-id
Sentry-Hook-Resource: issue | event | installation
Sentry-Hook-Signature: HMAC-SHA256 signature
```

**Webhook Payload Example:**
```json
{
  "action": "created",
  "installation": { "uuid": "install-uuid" },
  "data": {
    "issue": {
      "id": "12345",
      "shortId": "PROJ-ABC",
      "title": "TypeError: Cannot read property 'id' of undefined",
      "culprit": "app/components/UserProfile.tsx",
      "level": "error",
      "platform": "javascript",
      "project": "api-production",
      "status": "unresolved",
      "count": 1,
      "userCount": 1,
      "firstSeen": "2025-01-15T10:30:00Z",
      "lastSeen": "2025-01-15T10:30:00Z",
      "permalink": "https://sentry.io/..."
    }
  }
}
```

**Reliability:**
- **Timeout:** 1 second response required
- **Retry:** Automatic retries (Sentry handles)
- **Signature Verification:** HMAC-SHA256

**Ingestion Flow:**
```
1. Sentry sends webhook (issue.created or event.created)
2. Verify signature
3. Check idempotency (Request-ID header)
4. If issue.created:
   - Create new issue document
   - Fetch full issue context via API (stack trace, breadcrumbs)
   - Format stack trace (preserve frame groups)
   - Chunk and embed
   - Index to Pinecone
5. If event.created:
   - Find existing issue document
   - Update aggregated metadata (count, environments, tags)
   - Re-embed only if description changed significantly
6. Record event in ingestionEvents
```

**Rate Limits:**
- **API:** Standard rate limits (not publicly specified, but generous)
- **Webhooks:** No explicit limits

**Initial Sync (Backfill):**
```bash
# List issues for project
GET https://sentry.io/api/0/projects/{org}/{project}/issues/
?statsPeriod=30d
&query=is:unresolved

# Get issue details
GET https://sentry.io/api/0/issues/{issue_id}/
```

**Backfill Strategy:**
- Query issues for configured projects
- Filter by level (error, fatal) and status (unresolved)
- Fetch full details for each issue
- Process same as webhook

**Special Handling:**
- **Event Aggregation:** Don't create doc per event; update issue doc
- **Re-embedding Threshold:** Only re-embed if event count doubles or new environment/release

---

## Vercel

### Webhook Support: ✅ Excellent

**Official Documentation:** https://vercel.com/docs/webhooks

**Availability:** Pro and Enterprise plans

**Events:**
- `deployment.created` - New deployment initiated
- `deployment.succeeded` - Deployment successful
- `deployment.failed` - Deployment failed
- `deployment.promoted` - Deployment promoted to production
- `deployment.error` - Deployment error occurred

**Configuration:**
- Create webhook via Vercel Dashboard or API
- Select event types to subscribe
- Specify webhook URL
- Available per project or organization-wide

**Webhook Payload Example:**
```json
{
  "type": "deployment.succeeded",
  "createdAt": 1642000000000,
  "payload": {
    "deployment": {
      "id": "dpl_abc123",
      "url": "project-abc123.vercel.app",
      "name": "api-production",
      "meta": {
        "githubCommitSha": "abc123def456",
        "githubCommitMessage": "Fix authentication bug",
        "githubCommitRef": "main"
      },
      "target": "production",
      "createdAt": 1642000000000,
      "readyAt": 1642000060000,
      "buildingAt": 1642000005000
    },
    "project": {
      "id": "prj_xyz789",
      "name": "api-production"
    },
    "team": {
      "id": "team_abc"
    }
  }
}
```

**Reliability:**
- **Retry:** Automatic retries on failure
- **Timeout:** Standard HTTP timeout
- **Signature Verification:** x-vercel-signature header

**Ingestion Flow:**
```
1. Vercel sends webhook (deployment.succeeded or deployment.failed)
2. Verify signature
3. Check idempotency (deployment.id)
4. For successful deployments:
   - Create deployment document (immutable)
   - Extract commit SHA
   - Link to GitHub commit (if exists in our DB)
   - Index summary (no full logs for success)
5. For failed deployments:
   - Fetch build logs via API
   - Extract error lines
   - Chunk error logs
   - Embed and index
   - Link to commit SHA
6. Record event in ingestionEvents
```

**Rate Limits:**
- **API:** Not publicly specified (likely generous)
- **Webhooks:** No explicit limits

**Initial Sync (Backfill):**
```bash
# List deployments
GET https://api.vercel.com/v6/deployments
?projectId=prj_xyz789
&limit=100
&since=1642000000000
```

**Backfill Strategy:**
- Query deployments for configured projects
- Filter by environment (production only, or include preview)
- Filter by status (ERROR for failed deployments)
- Paginate (100 per page)
- Process same as webhook

**Special Handling:**
- **Successful deployments:** Store summary only (not full logs)
- **Failed deployments:** Fetch and parse build logs
- **Temporal linking:** Link deployment → commit → Sentry errors (if error spike after deploy)

---

## Zendesk

### Webhook Support: ✅ Yes

**Official Documentation:** https://developer.zendesk.com/documentation/webhooks/

**Webhook Types:**
1. **Event Subscription Webhooks** - Real-time events
2. **Trigger/Automation Webhooks** - Conditional ticket events

**Important:** A webhook can EITHER subscribe to events OR connect to triggers (not both)

**Events (Event Subscription Webhooks):**
- `zen:ticket-type:ticket_created`
- `zen:ticket-type:ticket_updated`
- `zen:ticket-type:comment_created`
- `zen:article-type:article_published`
- `zen:article-type:article_updated`

**Configuration:**
- Create via Webhooks API
- Specify event subscriptions
- Or connect to triggers/automations

**Webhook Payload Example:**
```json
{
  "event": {
    "type": "zen:ticket-type:ticket_updated",
    "subject": "ticket_updated",
    "ticket_event": {
      "ticket": {
        "id": 123456,
        "subject": "Login issue",
        "description": "Cannot login to dashboard",
        "status": "open",
        "priority": "high",
        "type": "problem",
        "requester_id": 789,
        "assignee_id": 456,
        "organization_id": 111,
        "tags": ["login", "bug"],
        "created_at": "2025-01-15T10:30:00Z",
        "updated_at": "2025-01-15T14:20:00Z"
      },
      "updates": {
        "status": ["new", "open"]
      },
      "current_user": {
        "id": 456,
        "name": "Agent Sarah"
      }
    }
  }
}
```

**Reliability:**
- **Retry:** Automatic retries (Zendesk handles)
- **Authentication:** API key, basic auth, or bearer token
- **Signature Verification:** Supported

**Ingestion Flow:**
```
1. Zendesk sends webhook (ticket.updated or article.published)
2. Verify authentication
3. Check idempotency (event ID + ticket ID)
4. For ticket events:
   - Fetch full ticket with comments via API
   - Format as conversation thread:
     [Subject]
     [Original description]
     ---
     Comment by Agent (timestamp):
     [Comment text]
     ---
     Comment by Customer (timestamp):
     [Comment text]
   - Chunk thread (preserve comment boundaries)
   - Extract relationships (mentions to Linear, GitHub)
   - Embed and index
5. For article events:
   - Fetch article content via API
   - Convert HTML to Markdown
   - Chunk content (similar to GitHub docs)
   - Embed and index
6. Record event in ingestionEvents
```

**Rate Limits:**
- **Standard:** Varies by plan (typically 200-700 requests/minute)
- **Webhooks:** No explicit limits

**Initial Sync (Backfill):**
```bash
# List tickets
GET https://{subdomain}.zendesk.com/api/v2/tickets.json
?status=open,pending
&type=problem,incident
&per_page=100

# Get ticket comments
GET https://{subdomain}.zendesk.com/api/v2/tickets/{id}/comments.json

# List articles
GET https://{subdomain}.zendesk.com/api/v2/help_center/articles.json
?per_page=100
```

**Backfill Strategy:**
- Query tickets by type (problem, incident) and status (open, pending)
- Fetch comments for each ticket
- Query knowledge base articles
- Paginate (100 per page)
- Process same as webhook

**Special Handling:**
- **Conversation Threading:** Re-chunk entire ticket on each comment
- **HTML Conversion:** Use `turndown` or similar to convert HTML → Markdown
- **PII Redaction:** Consider redacting customer email/phone if configured

---

## Sync Strategy Recommendations

### 1. Hybrid Approach: Webhooks + Initial Backfill

**For all sources:**
```
Phase 1: Initial Backfill (One-time)
├── Query API for historical data (last N months)
├── Paginate through all results
├── Process documents (chunk, embed, index)
└── Record last sync timestamp

Phase 2: Webhook-Driven Updates (Real-time)
├── Receive webhook events
├── Verify signature/authentication
├── Check idempotency (prevent duplicates)
├── Process document updates
└── Record event in ingestionEvents table
```

### 2. Idempotency Keys by Source

| Source | Idempotency Key | TTL |
|--------|----------------|-----|
| **GitHub** | `deliveryId` | 30 days |
| **Linear** | `webhookId + action + resourceId` | 7 days |
| **Notion** | `event.id + page.id` | 7 days |
| **Sentry** | `Request-ID header` | 7 days |
| **Vercel** | `deployment.id` | 30 days |
| **Zendesk** | `event.id + ticket.id` | 7 days |

**Storage:** Use `ingestionEvents.eventKey` with unique constraint

### 3. Retry Strategies

**Webhook Delivery Failures:**
```
1. Source retries (handled by platform)
   ├── Linear: 3x (1min, 1hr, 6hr)
   ├── Sentry: Auto-retry (1s timeout)
   ├── Others: Platform-handled

2. Our processing failures:
   ├── Inngest auto-retry (exponential backoff)
   ├── Max 3 attempts
   └── Dead letter queue after 3 failures
```

**API Failures (Backfill/Sync):**
```
1. Rate limit hit:
   ├── Exponential backoff (2s, 4s, 8s, 16s...)
   ├── Respect Retry-After header
   └── Max 5 retries

2. Network timeout:
   ├── Retry immediately (1x)
   ├── Then exponential backoff
   └── Max 3 retries

3. Authentication failure:
   ├── Refresh OAuth token (if applicable)
   ├── Retry once with new token
   └── Alert admin if still fails
```

### 4. Backfill Scheduling

**Initial Setup:**
```typescript
// When source is first connected
await inngest.send({
  name: "linear/backfill",
  data: {
    sourceId: "source_xyz",
    teamIds: ["team1", "team2"],
    since: "2024-01-01", // Last 6 months
  },
});
```

**Periodic Reconciliation (Optional):**
```typescript
// Daily cron job to catch missed webhooks
inngest.createScheduledFunction(
  { id: "daily-reconciliation" },
  { cron: "0 2 * * *" }, // 2 AM daily
  async () => {
    // For each source, fetch updates since last sync
    // Compare with database, process any missing
  }
);
```

### 5. Webhook Endpoint Structure

```
POST /api/webhooks/github
POST /api/webhooks/linear
POST /api/webhooks/notion
POST /api/webhooks/sentry
POST /api/webhooks/vercel
POST /api/webhooks/zendesk
```

**Shared Pattern:**
```typescript
export async function POST(request: Request) {
  // 1. Verify signature
  const signature = request.headers.get("x-webhook-signature");
  const isValid = await verifySignature(request, signature);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 2. Parse payload
  const payload = await request.json();

  // 3. Check idempotency
  const eventKey = extractEventKey(payload);
  const existing = await checkIdempotency(eventKey);
  if (existing) {
    return NextResponse.json({ message: "Already processed" }, { status: 200 });
  }

  // 4. Send to Inngest (async processing)
  await inngest.send({
    name: `linear/${payload.action}`,
    data: payload,
  });

  // 5. Return 200 immediately (webhook acknowledged)
  return NextResponse.json({ received: true }, { status: 200 });
}
```

---

## Implementation Priority

### Phase 1: Linear (Weeks 1-4)
- ✅ Webhooks: Excellent support
- ✅ Backfill: GraphQL API, good pagination
- ✅ Reliability: 3x retry with backoff
- **Risk:** Low

### Phase 2: Notion (Weeks 5-8)
- ✅ Webhooks: New support (2025-09-03)
- ⚠️ Backfill: Need to fetch full page content (2 API calls per page)
- ⚠️ Rate Limits: 3 req/s (need careful throttling)
- **Risk:** Medium (new webhook feature, rate limits)

### Phase 3: Sentry + Vercel (Weeks 9-12)
- ✅ Webhooks: Both excellent
- ✅ Backfill: Straightforward pagination
- ✅ Reliability: Both have auto-retry
- **Risk:** Low

### Phase 4: Zendesk (Weeks 13-16)
- ✅ Webhooks: Good support
- ⚠️ Backfill: Need to fetch comments separately (N+1 problem)
- ⚠️ Conversation Threading: Complex formatting
- **Risk:** Medium (threading complexity, PII concerns)

---

## Monitoring & Observability

### Metrics to Track

**Per Source:**
```
webhook_received_total{source="linear",event="issue.created"}
webhook_processed_total{source="linear",event="issue.created",status="success"}
webhook_latency_seconds{source="linear"}
api_requests_total{source="linear",endpoint="/graphql",status="200"}
api_rate_limit_remaining{source="linear"}
backfill_progress{source="linear",team="ENG"}
```

**Alerts:**
```
- Webhook failure rate > 5%
- API rate limit < 10% remaining
- Processing latency > 30s (p95)
- Backfill stuck (no progress in 1hr)
```

### Logging

```typescript
logger.info("Webhook received", {
  source: "linear",
  event: "issue.created",
  resourceId: "LIN-123",
  webhookId: "webhook-uuid",
  requestId: "req-xyz",
});

logger.info("Document processed", {
  source: "linear",
  documentId: "doc_xyz",
  chunkCount: 5,
  processingTime: 2.5,
});
```

---

## Summary

✅ **All platforms support webhooks** - No polling required for real-time updates

🔄 **Backfill needed for:**
- Initial sync when source is first connected
- Historical data (last N months)
- Periodic reconciliation (optional)

🛡️ **Reliability patterns:**
- Webhook signature verification (all sources)
- Idempotency via `ingestionEvents` table
- Platform-level retries (Linear: 3x, others: auto)
- Inngest-level retries for processing failures

📊 **Rate limits managed via:**
- Exponential backoff on 429 responses
- Respect Retry-After headers
- Queue-based throttling (Inngest concurrency controls)

---

## References

- [Multi-Source Integration Strategy](./multi-source-integration.md)
- [Database Schema](./database-schema.md)
- [Phase 2 Implementation Plan](./implementation-plan.md)
