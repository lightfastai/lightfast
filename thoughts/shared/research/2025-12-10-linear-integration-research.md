---
date: 2025-12-10T18:26:48+11:00
researcher: Claude
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "Linear Integration Research"
tags: [research, integration, linear, connector, project-management]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude
---

# Research: Linear Integration for Lightfast Memory

**Date**: 2025-12-10T18:26:48+11:00
**Researcher**: Claude
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

Can we integrate Linear (project management) into Lightfast's memory system, and if so, how?

## Summary

**Yes, Linear integration is absolutely possible and well-supported.**

Linear provides a comprehensive developer platform with:
- **GraphQL API** (same API Linear uses internally)
- **OAuth 2.0** with refresh tokens
- **Webhooks** for real-time sync
- **TypeScript SDK** (`@linear/sdk`) with webhook signature verification
- **AI agents as first-class citizens** - can be assigned issues and @-mentioned

Linear is an excellent candidate for Lightfast integration due to rich data (issues, comments, projects, cycles) and robust developer tooling.

## Documentation Links

| Resource | URL |
|----------|-----|
| Developer Portal | https://developers.linear.app |
| GraphQL Guide | https://developers.linear.app/docs/graphql/working-with-the-graphql-api |
| OAuth Guide | https://linear.app/developers/oauth-2-0-authentication |
| Webhook Reference | https://linear.app/developers/webhooks |
| SDK Webhooks | https://linear.app/developers/sdk-webhooks |
| Filtering | https://linear.app/developers/filtering |
| Pagination | https://linear.app/developers/pagination |
| Rate Limits | https://developers.linear.app/docs/graphql/working-with-the-graphql-api/rate-limiting |
| AI Agents in Linear | https://linear.app/docs/agents-in-linear |
| GraphQL Schema Explorer | https://studio.apollographql.com/public/Linear-API/variant/current/schema/reference |

## Integration Type

**OAuth Application** - Recommended for multi-workspace integrations

Linear supports:
1. OAuth Applications (user-authorized or actor-authorized)
2. Personal API Keys (simpler, single-user)
3. AI Agents as workspace members

## Authentication

### OAuth Flow

- **Flow type**: OAuth 2.0 with refresh tokens
- **Authorization URL**: `https://linear.app/oauth/authorize`
- **Token URL**: `https://api.linear.app/oauth/token`
- **Refresh tokens**: Enabled by default (apps created after Oct 1, 2025)

### Scopes

| Scope | Description | Required |
|-------|-------------|----------|
| `read` | Read access to workspace data | **Always required** |
| `write` | Create/update data | For mutations |
| `admin` | Full administrative access | Rarely needed |
| `issues:create` | Create issues | For agent actions |
| `comments:create` | Create comments | For agent responses |

**Important**: `read` scope MUST always be included, even when requesting write permissions.

### Token Management

- Refresh tokens enabled by default
- Access tokens expire; refresh tokens don't
- Store both in `workspace-integrations` table

### OAuth Actor Authorization

Alternative mode where actions come from the **app itself** (not user):
- App is installed as workspace member
- Ideal for agents and service accounts
- Actions appear as "Lightfast" not "User via Lightfast"

Docs: https://linear.app/developers/oauth-actor-authorization

## Webhooks

### Available Events

| Entity | Events | Memory Use Case |
|--------|--------|-----------------|
| **Issues** | Create, Update, Remove | Track issue lifecycle, priorities, assignments |
| **Comments** | Create, Update, Remove | Capture discussions, decisions, context |
| **Projects** | Create, Update, Remove | Track project status, roadmap |
| **Project Updates** | Create, Update, Remove | Status reports, progress updates |
| **Cycles** | Create, Update, Remove | Sprint/iteration tracking |
| **Labels** | Create, Update, Remove | Categorization changes |
| **Users** | Create, Update, Remove | Team membership changes |
| **Documents** | Create, Update, Remove | Documentation updates |
| **Attachments** | Create, Update, Remove | File references |
| **Emoji Reactions** | Create, Remove | Engagement tracking |
| **Issue SLAs** | Create, Update, Remove | Service level tracking |

### Webhook Verification

**Mechanism**: HMAC signature verification

```typescript
import { LinearWebhookClient } from '@linear/sdk/webhooks';

const client = new LinearWebhookClient({
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET
});

client.on('Issue', (payload) => {
  // Signature automatically verified
  console.log('Issue event:', payload.action, payload.data);
});
```

**Headers**:
- Signature header included with each request
- Secret provided during webhook creation
- SDK handles verification automatically

### Payload Structure

```json
{
  "action": "create" | "update" | "remove",
  "type": "Issue" | "Comment" | "Project" | "...",
  "data": {
    // Full GraphQL entity object
  },
  "updatedFrom": {
    // Previous values (update events only)
  }
}
```

### Configuration Requirements

- **Admin permissions** required to create webhooks
- Organization-scoped or team-specific
- Can filter by resource type
- Location: Settings > Administration > API

## APIs

### Endpoint

```
https://api.linear.app/graphql
```

**API Type**: GraphQL only (no REST)

### Key Queries

**Issues with comments**:
```graphql
query {
  issues(filter: { priority: { lte: 2 } }) {
    nodes {
      id
      title
      description
      priority
      state { name }
      assignee { name email }
      comments { nodes { body user { name } } }
    }
  }
}
```

**Projects**:
```graphql
query {
  projects {
    nodes {
      id
      name
      description
      state
      progress
      startDate
      targetDate
    }
  }
}
```

**Cycles (Sprints)**:
```graphql
query {
  cycles {
    nodes {
      id
      name
      startsAt
      endsAt
      progress
      issues { nodes { title } }
    }
  }
}
```

**Current user**:
```graphql
query {
  viewer {
    id
    name
    email
  }
}
```

### Key Mutations

**Create issue**:
```graphql
mutation {
  issueCreate(input: {
    teamId: "TEAM_ID"
    title: "Issue title"
    description: "Description"
    priority: 2
  }) {
    issue { id title }
    success
  }
}
```

**Create comment**:
```graphql
mutation {
  commentCreate(input: {
    issueId: "ISSUE_ID"
    body: "Comment text"
  }) {
    comment { id }
    success
  }
}
```

### Rate Limits

| Auth Type | Requests/Hour | Complexity Points/Hour |
|-----------|---------------|------------------------|
| API Key | 1,500 | 250,000 |
| OAuth App | 500 | 200,000 |

**Headers**:
```
X-RateLimit-Remaining: 450
X-RateLimit-Reset: 1640000000
X-Complexity-Remaining: 180000
```

**Strategy**: Use webhooks to avoid polling; rate limits rarely an issue with real-time sync.

### Pagination

Relay-style cursor-based pagination:

```graphql
query {
  issues(first: 50, after: "CURSOR") {
    nodes { id title }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Filtering

Extensive filtering on all entities:

```graphql
query {
  issues(filter: {
    and: [
      { priority: { lte: 2 } }
      { assignee: { id: { eq: "USER_ID" } } }
      { state: { name: { neq: "Done" } } }
    ]
  }) {
    nodes { title }
  }
}
```

## Data for Lightfast Memory

| Data Type | Description | Memory Value |
|-----------|-------------|--------------|
| **Issues** | Tasks, bugs, features | Current work context, priorities |
| **Comments** | Discussion threads | Decision rationale, team communication |
| **Projects** | High-level initiatives | Strategic context, roadmap |
| **Cycles** | Sprints/iterations | Temporal context, velocity |
| **Teams** | Organizational units | Who knows what, expertise |
| **Labels** | Categorization | Classification, filtering |
| **Documents** | Wiki/specs | Reference material |

### Memory Document Format

```typescript
{
  id: `linear-issue-${issueId}`,
  content: `${title}\n\n${description}\n\nComments:\n${comments}`,
  metadata: {
    source: 'linear',
    type: 'issue',
    issueId,
    teamId,
    projectId,
    state,
    priority,
    assignee,
    labels: [],
    url: `https://linear.app/team/issue/${issueIdentifier}`,
    updatedAt
  }
}
```

## Recommended Implementation Approach

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Lightfast Console                                            │
│                                                              │
│  packages/console-linear/                                    │
│  ├── src/                                                    │
│  │   ├── client.ts        # LinearClient wrapper            │
│  │   ├── oauth.ts         # OAuth flow handlers             │
│  │   ├── webhooks.ts      # Webhook signature verification  │
│  │   └── types.ts         # TypeScript types                │
│                                                              │
│  api/console/src/                                            │
│  ├── router/linear/       # tRPC routes                     │
│  │   └── linear.ts        # Connect/disconnect/status       │
│  └── inngest/workflow/    # Background jobs                 │
│      └── linear/                                             │
│          ├── sync-workspace.ts   # Initial sync             │
│          └── process-webhook.ts  # Real-time updates        │
│                                                              │
│  apps/console/src/app/api/webhooks/linear/                   │
│  └── route.ts             # Webhook receiver endpoint        │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Steps

1. **Create `@packages/console-linear`**
   - Wrap `@linear/sdk` with Lightfast patterns
   - OAuth flow helpers
   - Webhook signature verification
   - Type definitions

2. **OAuth Routes**
   - `GET /api/linear/connect` - Start OAuth flow
   - `GET /api/linear/callback` - Handle callback
   - Store tokens in `workspace-integrations`

3. **Webhook Endpoint**
   - `POST /api/webhooks/linear`
   - Verify signature using SDK
   - Queue Inngest job for processing

4. **Inngest Workflows**
   - `sync-linear-workspace` - Initial full sync
   - `process-linear-webhook` - Real-time updates

5. **Database Schema**
   - Add `linear` to integration types
   - Store: access_token, refresh_token, team_id

### Dependencies

```json
{
  "@linear/sdk": "^29.0.0"
}
```

### Environment Variables

```bash
LINEAR_CLIENT_ID="your_oauth_client_id"
LINEAR_CLIENT_SECRET="your_oauth_client_secret"
LINEAR_WEBHOOK_SECRET="your_webhook_secret"
```

## Platform-Specific Notes

1. **GraphQL Only** - No REST API available; must use GraphQL
2. **`read` scope mandatory** - Always include even with other scopes
3. **Admin for webhooks** - User needs admin permissions to set up webhooks
4. **Complexity limits** - Nested queries consume more budget than simple ones
5. **No global search** - Must query specific entities (issues, projects, etc.)
6. **Archive vs Delete** - Issues are archived, not truly deleted

## Comparison with Existing Connectors

| Feature | Vercel | Linear |
|---------|--------|--------|
| API Type | REST | GraphQL |
| SDK | None (fetch) | @linear/sdk |
| Webhook Verification | HMAC | HMAC (SDK helper) |
| OAuth | Yes | Yes (with actor auth) |
| Rate Limits | High | Moderate (500/hr OAuth) |
| Real-time | Webhooks | Webhooks |

Linear follows similar patterns to our Vercel connector but uses GraphQL instead of REST.

## Related Research

- Vercel Integration (existing implementation)
- GitHub Integration (existing implementation)

## Next Steps

1. **Create implementation plan**: `/create_plan linear integration`
2. **Review existing patterns**: Look at `packages/console-vercel/` for reference
3. **Create Linear OAuth app**: https://linear.app/settings/api
4. **Implement package**: `packages/console-linear/`
