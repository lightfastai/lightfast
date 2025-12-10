---
date: 2025-12-10T07:14:31Z
researcher: Claude
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "GitHub Issues Integration Research"
tags: [research, integration, github, issues, connector]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude
---

# Research: GitHub Issues Integration for Lightfast Memory

**Date**: 2025-12-10T07:14:31Z
**Researcher**: Claude
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

Is it possible to integrate GitHub Issues into Lightfast's memory system? If so, how?

## Summary

**Yes, GitHub Issues integration is fully feasible.** GitHub provides a comprehensive developer platform with:
- GitHub Apps with fine-grained permissions (recommended over OAuth Apps)
- 16+ webhook events covering all issue lifecycle activities
- Rich REST & GraphQL APIs for historical data access
- Works on all GitHub plans (Free, Team, Enterprise)
- Generous rate limits (5,000-15,000 requests/hour)

## Documentation Links

- **Developer Portal**: https://docs.github.com/en/apps
- **GitHub Apps Guide**: https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps
- **API Reference**: https://docs.github.com/en/rest/issues
- **GraphQL API**: https://docs.github.com/en/graphql
- **Webhook Reference**: https://docs.github.com/en/webhooks/webhook-events-and-payloads
- **OAuth Flow**: https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/identifying-and-authorizing-users-for-github-apps

## Integration Type

**Recommended: GitHub App** (not OAuth App)

| Feature | GitHub Apps | OAuth Apps |
|---------|-------------|------------|
| Permissions | Fine-grained (e.g., "Issues: Read" only) | Broad scopes (e.g., `repo` grants full access) |
| Tokens | Short-lived (1 hour), auto-refresh | Never expire (until revoked) |
| Identity | Independent bot identity (`@app[bot]`) | Acts as the authorizing user |
| Rate Limits | 5,000 points/hour (15,000 for GHEC) | 5,000 requests/hour (shared with user) |
| Installation | Per-org/per-repo selection | All-or-nothing access |
| Persistence | Works even if installer leaves org | Breaks if user loses access |

## Authentication

### GitHub App OAuth Flow

**Required Permissions** (Repository):
- `issues`: read (or write if creating/updating)
- `metadata`: read (always required)

**Flow Steps**:

1. **Register GitHub App** at Settings → Developer Settings → GitHub Apps
2. **Authorization URL**: `https://github.com/login/oauth/authorize?client_id={client_id}`
3. **Exchange code for token**:
   ```bash
   curl -X POST https://api.github.com/login/oauth/access_token \
     -d "client_id={client_id}" \
     -d "client_secret={client_secret}" \
     -d "code={code}"
   ```
4. **Generate Installation Access Token**:
   ```bash
   curl -X POST \
     https://api.github.com/app/installations/{installation_id}/access_tokens \
     -H "Authorization: Bearer {jwt}" \
     -H "Accept: application/vnd.github+json"
   ```

### Token Types

| Token | Purpose | Lifetime | Generation |
|-------|---------|----------|------------|
| JWT | Identifies the app | 10 minutes | From app ID + private key |
| Installation Access Token | API requests | 1 hour | Exchange JWT for token |
| User Access Token | Act on behalf of user | Configurable | OAuth flow with refresh |

### Token Management

- Installation tokens expire after **1 hour** - must refresh
- Use refresh tokens for long-lived user sessions
- Store `installation_id` per organization for token generation

## Webhooks

### Available Events for Issues

| Event | Actions | Description |
|-------|---------|-------------|
| `issues` | `opened`, `edited`, `deleted`, `closed`, `reopened`, `assigned`, `unassigned`, `labeled`, `unlabeled`, `locked`, `unlocked`, `transferred`, `pinned`, `unpinned`, `milestoned`, `demilestoned` | Core issue lifecycle |
| `issue_comment` | `created`, `edited`, `deleted` | Comments on issues (and PRs) |
| `label` | `created`, `edited`, `deleted` | Repository label changes |
| `milestone` | `created`, `closed`, `opened`, `edited`, `deleted` | Milestone management |

### Webhook Verification

GitHub uses **HMAC SHA-256** signing:

- **Header**: `X-Hub-Signature-256`
- **Format**: `sha256={signature}`

```typescript
import crypto from 'crypto';

function verifyGitHubSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

### Webhook Headers

- `X-GitHub-Event`: Event name (e.g., "issues")
- `X-GitHub-Delivery`: Unique delivery ID (for idempotency)
- `X-Hub-Signature-256`: HMAC signature
- `X-GitHub-Hook-Installation-Target-ID`: Installation ID

### Delivery Guarantees

- **Retries**: Up to 3 attempts over 12 hours
- **Timeout**: 10 seconds per delivery
- **Manual Resend**: Available in GitHub UI
- **Idempotency**: Use `X-GitHub-Delivery` header

### Payload Example (`issues` event)

```json
{
  "action": "opened",
  "issue": {
    "id": 1,
    "number": 42,
    "title": "Bug in authentication",
    "body": "Detailed description...",
    "state": "open",
    "user": { "login": "octocat", "id": 1 },
    "assignees": [{ "login": "developer1" }],
    "labels": [{ "name": "bug", "color": "d73a4a" }],
    "milestone": { "title": "v1.0", "number": 1 },
    "comments": 5,
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-02T15:30:00Z",
    "closed_at": null,
    "html_url": "https://github.com/owner/repo/issues/42"
  },
  "repository": {
    "id": 1296269,
    "name": "repo-name",
    "full_name": "owner/repo-name"
  },
  "sender": { "login": "octocat" },
  "installation": { "id": 123456 }
}
```

## APIs

### REST Endpoints

**Issues**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/repos/{owner}/{repo}/issues` | GET | List repository issues |
| `/repos/{owner}/{repo}/issues/{number}` | GET | Get single issue |
| `/issues` | GET | List all issues for authenticated user |
| `/orgs/{org}/issues` | GET | List organization issues |
| `/repos/{owner}/{repo}/issues` | POST | Create issue |
| `/repos/{owner}/{repo}/issues/{number}` | PATCH | Update issue |

**Comments**:
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/repos/{owner}/{repo}/issues/{number}/comments` | GET | List comments |
| `/repos/{owner}/{repo}/issues/comments` | GET | List all issue comments |
| `/repos/{owner}/{repo}/issues/{number}/comments` | POST | Create comment |

**Timeline** (full event history):
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/repos/{owner}/{repo}/issues/{number}/timeline` | GET | Get issue timeline |

### GraphQL API

More efficient for complex queries:

```graphql
query GetIssueWithDetails($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      number
      title
      body
      state
      createdAt
      updatedAt
      author { login }
      assignees(first: 10) {
        nodes { login }
      }
      labels(first: 20) {
        nodes { name, color }
      }
      milestone { title, number, dueOn }
      comments(first: 100) {
        nodes {
          id
          body
          createdAt
          author { login }
        }
      }
    }
  }
}
```

### Rate Limits

| Authentication | REST API | GraphQL API |
|----------------|----------|-------------|
| GitHub App (standard) | 5,000 requests/hour | 5,000 points/hour |
| GitHub App (GHEC org) | 15,000 requests/hour | 10,000 points/hour |
| Secondary Limits | 900 points/minute | 2,000 points/minute |

**Headers**:
- `X-RateLimit-Limit`: Total quota
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (UTC epoch)

### Pagination

**REST**: Link headers
```
Link: <https://api.github.com/repos/owner/repo/issues?page=2>; rel="next"
```

**GraphQL**: Cursor-based
```graphql
{ pageInfo { hasNextPage, endCursor } }
```

## Data for Lightfast Memory

### Available Data Points

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| Issue title | Short summary | Primary search content |
| Issue body | Full description (markdown) | Rich context for semantic search |
| Comments | Discussion thread | Conversation history |
| Labels | Categorization | Filtering and metadata |
| Assignees | Ownership | Team context |
| Milestone | Project phase | Timeline context |
| State | open/closed | Status filtering |
| Timeline | Full event history | Change tracking |
| Cross-references | Links to other issues/PRs | Relationship mapping |

### Data Model for Memory

```typescript
interface GitHubIssueMemory {
  // Primary content for embedding
  title: string;
  body: string;
  comments: Array<{
    author: string;
    body: string;
    created_at: string;
  }>;

  // Metadata for filtering
  metadata: {
    source: "github_issues";
    repo_full_name: string;
    issue_number: number;
    state: "open" | "closed";
    labels: string[];
    assignees: string[];
    milestone?: string;
    created_at: string;
    updated_at: string;
    html_url: string;
  };
}
```

### Sync Strategy

1. **Initial Sync**: Use REST/GraphQL API to fetch all historical issues
2. **Real-time Updates**: Webhooks for `issues` and `issue_comment` events
3. **Incremental Polling** (fallback): Use `since` parameter for missed webhooks

## Recommended Implementation Approach

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GitHub Issues → Lightfast Memory                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. User installs GitHub App                                    │
│     → Grants "Issues: Read" + "Metadata: Read"                  │
│     → Selects repositories                                      │
│                                                                 │
│  2. OAuth Callback                                              │
│     → Store installation_id + tokens                            │
│     → Create workspace integration record                       │
│                                                                 │
│  3. Initial Sync (Inngest workflow)                             │
│     → Fetch all issues via GraphQL                              │
│     → Generate embeddings                                       │
│     → Store in Pinecone                                         │
│                                                                 │
│  4. Real-time Updates (Webhooks)                                │
│     → POST /api/github/webhooks                                 │
│     → Verify X-Hub-Signature-256                                │
│     → Queue Inngest job                                         │
│     → Update memory vectors                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Files

| Component | Location | Purpose |
|-----------|----------|---------|
| Webhook Handler | `packages/console-webhooks/src/github-issues.ts` | Event processing |
| OAuth Callback | `apps/console/src/app/api/github/callback/route.ts` | Token exchange |
| Webhook Route | `apps/console/src/app/api/github/webhooks/route.ts` | Receive events |
| Inngest Workflow | `api/console/src/inngest/workflow/processing/process-github-issues.ts` | Background sync |
| DB Schema | `db/console/src/schema/tables/github-installations.ts` | Installation data |

### Environment Variables

```bash
GITHUB_APP_ID="{app_id}"
GITHUB_APP_CLIENT_ID="{client_id}"
GITHUB_APP_CLIENT_SECRET="{client_secret}"
GITHUB_APP_PRIVATE_KEY="{base64_encoded_private_key}"
GITHUB_WEBHOOK_SECRET="{webhook_secret}"
```

## Platform-Specific Notes

1. **Token Refresh**: Installation tokens expire in 1 hour - implement automatic refresh
2. **Private Repos**: Users must explicitly grant access during installation
3. **Bot Identity**: Actions appear as `@your-app[bot]`, not as the user
4. **Webhook Payload Size**: Can be large for issues with many comments - handle chunking
5. **Rate Limits**: Use webhooks over polling; implement exponential backoff
6. **GraphQL Complexity**: Complex queries may hit secondary rate limits

## Comparison with Existing Connectors

Consider reviewing the Vercel integration implementation for patterns:
- OAuth callback flow
- Webhook verification
- Inngest workflow structure
- Database schema for integrations

## Next Steps

1. Use `/create_plan github-issues integration` to plan implementation
2. Review existing Vercel connector implementation for patterns
3. Register a GitHub App in the Lightfast GitHub organization
4. Implement OAuth flow and webhook handler

## Related Research

- (future) GitHub Pull Requests integration
- (future) GitHub Discussions integration
- (future) GitHub Actions integration
