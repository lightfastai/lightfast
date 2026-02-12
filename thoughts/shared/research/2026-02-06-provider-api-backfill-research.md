# Provider API Backfill Research

> Researched: 2026-02-06
> Purpose: Optimal backfill strategies for GitHub, Vercel, Linear, and Sentry APIs

---

## 1. GitHub API

### Best Endpoints for Historical Data

| Entity | Endpoint | `since` Support | Notes |
|--------|----------|----------------|-------|
| Issues | `GET /repos/{owner}/{repo}/issues?state=all&sort=updated&since=...` | **Yes** | Filters by `updated_at`. Also returns PRs (PRs are issues in GitHub's model) |
| Commits | `GET /repos/{owner}/{repo}/commits?since=...&until=...` | **Yes** | Filters by commit date. Max 250 for `/compare` endpoint |
| Pull Requests | `GET /repos/{owner}/{repo}/pulls?state=all&sort=updated` | **No** | Must paginate through all, no `since` param |
| Releases | `GET /repos/{owner}/{repo}/releases` | **No** | Must fetch all, filter client-side by `published_at` |
| Events | `GET /repos/{owner}/{repo}/events` | N/A | Only last 30 days, max 300 events. **Not suitable for backfill** |

### Pagination

- **REST**: Link header-based. `per_page=100` (max). No hard cap on total pages for list endpoints.
- **GraphQL**: Cursor-based with `first/after`, `last/before`. Max 100 items per connection, 500K total nodes per query.
- **Search API**: Max **1,000 results** total — unsuitable for comprehensive backfill.

### Rate Limits

| Auth Type | REST Limit | GraphQL Limit |
|-----------|-----------|---------------|
| OAuth User Token | 5,000 req/hr | 5,000 points/hr |
| GitHub App Installation | 5,000–12,500 req/hr (scales with repos/users) | 5,000–10,000 points/hr |
| Unauthenticated | 60 req/hr | N/A |

**Secondary rate limits** (abuse detection):
- Max 100 concurrent requests (REST + GraphQL combined)
- Max 900 points/min (REST), 2,000 points/min (GraphQL)
- Must make requests **serially**, not concurrently
- Wait 1s between mutative requests
- Use exponential backoff on 403/429

### GraphQL Point Calculation

```
Points ≈ (first or last) / 100 per connection
Nested: parent_items × child_points
Example: 100 PRs with 10 comments each = 1 + (100 × 0.1) = 11 points
```

### GraphQL Multi-Entity Query (Single Request)

```graphql
query($owner: String!, $name: String!, $prCursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 50, after: $prCursor, states: [OPEN, CLOSED, MERGED]) {
      nodes { number title createdAt mergedAt author { login } }
      pageInfo { endCursor hasNextPage }
    }
    issues(first: 50, filterBy: {states: [OPEN, CLOSED]}) {
      nodes { number title createdAt author { login } }
      pageInfo { endCursor hasNextPage }
    }
    ref(qualifiedName: "main") {
      target {
        ... on Commit {
          history(first: 50) {
            nodes { oid messageHeadline committedDate author { name date } }
            pageInfo { endCursor hasNextPage }
          }
        }
      }
    }
    releases(first: 20) {
      nodes { name tagName publishedAt }
    }
  }
}
```

### Recommended Backfill Strategy

1. **Initial backfill**: REST API with `per_page=100`, serial requests, 1s delay
2. **Incremental sync**: REST with `since` parameter for issues/commits + webhooks
3. **PRs/Releases**: No `since` support — use `sort=updated&direction=desc` and stop when reaching last-synced timestamp
4. **ETags**: Use conditional requests (`If-None-Match`) for polling — 304 responses don't count against rate limit
5. **Large repos (10K+)**: Segment by time ranges (6-month chunks), track progress per entity type

---

## 2. Vercel API

### Deployment Listing Endpoint

**Endpoint**: `GET /v6/deployments`

**Key Query Parameters**:
- `projectId` / `projectIds`: Filter by project(s)
- `target`: Filter by environment (`production`, `preview`, `development`)
- `state`: Filter by status (`BUILDING`, `ERROR`, `READY`, `CANCELED`, etc.)
- `since` (number): JS timestamp in ms — deployments created **after** this time
- `until` (number): JS timestamp in ms — deployments created **before** this time
- `sha`: Filter by git commit SHA
- `users`: Comma-separated user IDs
- `teamId` / `slug`: Team context
- `limit`: Max **100** per page (default 20)

**Deprecated**: `from`/`to` — use `since`/`until` instead.

**Undocumented**: `meta-*` query params for filtering by deployment metadata (e.g., `meta-githubCommitSha=abc123`)

### Deployment Response Metadata

- `uid`: Deployment ID (e.g., `dpl_2euZBF...`)
- `name`, `projectId`, `url`, `state`, `target`
- `created`: Timestamp in ms
- `type`: e.g., `LAMBDAS`
- `creator`: Object with uid, email, username
- Git metadata: commit SHA, branch, repo info

### Pagination

**Cursor-based using timestamps**:

```json
{
  "pagination": {
    "count": 20,
    "next": 1555072968396,
    "prev": 1555413045188
  },
  "deployments": [...]
}
```

- To get next page: `until={pagination.next}`
- To get previous page: `since={pagination.prev}`
- `pagination.next === null` means no more pages

### Rate Limits

**Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

| Action | Hobby | Pro/Enterprise |
|--------|-------|----------------|
| Builds per hour | 32 | Higher |
| Deployments per day | 100 | 6,000 |
| General API | ~20K-30K req/hr (estimated) | Higher |

HTTP 429 response with `error.limit.remaining`, `error.limit.reset`, `error.limit.resetMs`.

### Authentication

- **Bearer token**: `Authorization: Bearer YOUR_TOKEN`
- Tokens can be scoped to specific teams (since March 2022)
- Team API calls: append `?teamId=TEAM_ID` or `?slug=TEAM_SLUG`
- Token creation: `POST /v3/user/tokens`

### Recommended Backfill Strategy

1. **Initial backfill**: Paginate with `limit=100`, follow `pagination.next` as `until` param
2. **Date chunking**: For large histories, chunk by 30-day windows using `since`/`until`
3. **Incremental sync**: Store last sync timestamp, use `since` param for new deployments
4. **Rate safety**: Monitor `X-RateLimit-Remaining`, pause at 10% threshold

```typescript
// Backfill loop
let until: number | undefined;
while (true) {
  const params = { projectId, teamId, limit: 100, ...(until && { until }) };
  const { deployments, pagination } = await fetchDeployments(params);
  store(deployments);
  if (!pagination.next) break;
  until = pagination.next;
}
```

---

## 3. Linear API

### OAuth 2.0 Flow

**Authorize URL**: `https://linear.app/oauth/authorize`

**Parameters**:
- `client_id`: Your application's client ID
- `redirect_uri`: Registered callback URL
- `response_type=code`
- `scope`: Space-separated scopes (e.g., `read write issues:create`)
- `state`: CSRF protection token
- `prompt=consent` (optional, forces re-authorization)

**Token Exchange**: `POST https://api.linear.app/oauth/token`

```json
{
  "grant_type": "authorization_code",
  "code": "...",
  "redirect_uri": "...",
  "client_id": "...",
  "client_secret": "..."
}
```

**Token Response**:
```json
{
  "access_token": "lin_oauth_...",
  "token_type": "Bearer",
  "expires_in": 315360000,
  "scope": ["read", "write"]
}
```

**Key details**:
- Access tokens are **long-lived** (~10 years / `expires_in: 315360000`)
- Linear does NOT use traditional refresh tokens — tokens last essentially forever
- Tokens can be revoked manually by the user in Linear settings

**Scopes**: `read`, `write`, `issues:create`, `comments:create`, `admin`

### GraphQL Query Patterns

**Base endpoint**: `POST https://api.linear.app/graphql`

**Available entities**: Issues, Comments, Projects, Cycles, Labels, Users, Teams, Workflows, Attachments, Reactions

**Filtering issues by date**:
```graphql
query {
  issues(
    first: 50
    orderBy: updatedAt
    filter: {
      updatedAt: { gte: "2024-01-01T00:00:00Z" }
      team: { key: { eq: "ENG" } }
    }
  ) {
    nodes {
      id identifier title state { name }
      createdAt updatedAt
      assignee { name }
      labels { nodes { name } }
      comments { nodes { body createdAt user { name } } }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

### Cursor-Based Pagination

- Relay-style: `first`/`after` and `last`/`before`
- Default: 50 results without arguments
- Max per page: **250** (Linear's max `first` value)
- `pageInfo`: `{ hasNextPage, endCursor, hasPreviousPage, startCursor }`
- Results ordered by `createdAt` by default; can use `orderBy: updatedAt`
- Simpler syntax available: `nodes` directly instead of `edges { node { } cursor }`

### Rate Limiting

- **Complexity-based**: Each query has a computed cost based on requested fields and connections
- **Limits**: ~1,500 complexity points per minute (varies by plan)
- **Headers**: `X-Complexity` in responses shows query cost
- Deeply nested queries cost more (connections × nested connections)
- **Recommendation**: Keep queries focused, avoid deeply nested connections in bulk operations

### Webhook Configuration

**Programmatic setup** via GraphQL mutation:
```graphql
mutation {
  webhookCreate(input: {
    url: "https://your-app.com/webhooks/linear"
    teamId: "team-id"
    resourceTypes: ["Issue", "Comment", "Project"]
    allPublicTeams: false
  }) {
    success
    webhook { id enabled }
  }
}
```

**Available events**: Issue (create, update, delete, archive), Comment (create, update, delete), Project updates, Cycle updates, Label changes, Reaction events

**Webhook headers**: Include `Linear-Delivery`, `Linear-Event`, signature for verification

### Recommended Backfill Strategy

1. **Initial backfill**: Query with `orderBy: updatedAt`, `first: 250`, paginate with cursor
2. **Date filter**: Use `filter: { updatedAt: { gte: "..." } }` for incremental sync
3. **Entity order**: Teams → Users → Labels → Projects → Cycles → Issues → Comments
4. **Rate awareness**: Monitor `X-Complexity` header, keep queries under 1,500 points/min
5. **Webhooks**: Set up after initial backfill for real-time updates

---

## 4. Sentry API

### OAuth Flow

**Integration Platform** (preferred over legacy OAuth apps):
- **Public Integrations**: Full OAuth flow, installable by any Sentry org
- **Internal Integrations**: Auto-generated tokens, org-specific

**Authorize URL**: `https://sentry.io/sentry-app-installations/{installationId}/external-requests/`

**OAuth Process** (Public Integrations):
1. User installs integration → receives `code` via redirect
2. Exchange code for token: `POST https://sentry.io/api/0/sentry-app-installations/{installationId}/authorizations/`
3. Token refresh: Use JWT signed with client secret when token expires
4. Tokens expire and must be refreshed periodically (unlike Linear's long-lived tokens)

**Required scopes**: `event:read`, `project:read`, `issue:read`, `org:read`, `member:read`

### Issue Listing

**Endpoint**: `GET /api/0/projects/{org_slug}/{project_slug}/issues/`

**Query Parameters**:
- `query`: Sentry search syntax (e.g., `is:unresolved`, `firstSeen:>2024-01-01`)
- `sort`: `date`, `new`, `priority`, `freq`, `user`
- `statsPeriod`: Relative time period (e.g., `24h`, `14d`)
- `start` / `end`: Absolute date range (ISO 8601)
- `cursor`: Pagination cursor

**Issue metadata**: id, title, culprit, status, level, firstSeen, lastSeen, count, userCount, shortId, platform, project

### Event Listing

**Endpoint**: `GET /api/0/issues/{issue_id}/events/`

**Available data per event**:
- Event ID, timestamp, message
- Exception/stacktrace details
- Breadcrumbs (user actions leading to error)
- Tags (browser, OS, device, custom)
- Context (browser, OS, device info)
- User info (IP, email, username)

### Pagination

**Link header-based** (similar to GitHub):

```
Link: <https://sentry.io/api/0/projects/.../issues/?cursor=1:0:1>; rel="previous"; results="false",
      <https://sentry.io/api/0/projects/.../issues/?cursor=1:100:0>; rel="next"; results="true"
```

- Cursor format: `{identifier}:{offset}:{is_prev}`
- `results="true"/"false"` indicates if page has data
- Continue while `rel="next"` has `results="true"`

### Rate Limits

**Headers**: `X-Sentry-Rate-Limit-Limit`, `X-Sentry-Rate-Limit-Remaining`, `X-Sentry-Rate-Limit-Reset`

**Limits**:
- Applied per unique caller + endpoint combination
- Both per-second (fixed window) and concurrent request limits
- Specific values vary by plan (free, team, business, enterprise)
- HTTP 429 on limit exceeded

**Best practices**:
- Monitor rate limit headers
- Exponential backoff on 429 responses
- Serial requests recommended for bulk operations
- Check `Retry-After` header when rate limited

### Webhook Configuration

**Via Integration Platform**:
- Enable "Alert Rule Action" on integration setup
- Configure webhook URL during integration creation
- Available events: `installation`, `issue`, `error`, `comment`, `event_alert`, `metric_alert`

**Webhook headers**:
- `Sentry-Hook-Resource`: Resource type (e.g., `issue`, `error`)
- `Sentry-Hook-Signature`: HMAC signature for verification
- Webhooks must respond within **1 second**

### Recommended Backfill Strategy

1. **Initial backfill**: List projects first, then iterate issues per project with `sort=date`
2. **Date filtering**: Use `start`/`end` params for time-range chunks, or `query=firstSeen:>...`
3. **Events**: Fetch per-issue after issues backfill (most expensive operation)
4. **Incremental sync**: Use `statsPeriod=24h` or `start/end` with last sync timestamp
5. **Webhooks**: Set up Integration Platform webhooks for real-time issue/error notifications

---

## 5. Cross-Provider Comparison

### Incremental Sync Support

| Provider | True `since` Support | Mechanism | Client-Side Filtering Required? |
|----------|---------------------|-----------|--------------------------------|
| GitHub | **Partial** | `since` on issues/commits only. PRs/releases need full pagination | Yes, for PRs and releases |
| Vercel | **Yes** | `since`/`until` timestamp params on deployments | No |
| Linear | **Yes** | `filter: { updatedAt: { gte: "..." } }` in GraphQL | No |
| Sentry | **Yes** | `start`/`end` params, `query=firstSeen:>...` | No |

### Pagination Patterns

| Provider | Style | Max Per Page | Cursor Type |
|----------|-------|-------------|-------------|
| GitHub REST | Link header | 100 | Page number |
| GitHub GraphQL | Relay cursor | 100 | Opaque cursor |
| Vercel | Timestamp cursor | 100 | Timestamp (ms) |
| Linear | Relay cursor | 250 | Opaque cursor |
| Sentry | Link header + cursor | ~100 | `id:offset:direction` |

### Rate Limits Comparison

| Provider | Limit | Best For Backfill | Estimated Time for 10K Items |
|----------|-------|-------------------|------------------------------|
| GitHub REST | 5,000 req/hr (up to 12,500 for Apps) | Serial, 100/page | ~2 min (100 requests) |
| GitHub GraphQL | 5,000 points/hr | Multi-entity queries | ~1 min (fewer requests) |
| Vercel | ~20-30K req/hr (estimated) | Fast serial | <1 min |
| Linear | ~1,500 complexity/min | Batched queries, 250/page | ~1 min (40 requests) |
| Sentry | Per-endpoint, concurrent limits | Serial, careful pacing | ~5-10 min (varies by plan) |

### Token Refresh Patterns

| Provider | Token Lifetime | Refresh Mechanism |
|----------|---------------|-------------------|
| GitHub App | 1 hour (installation tokens) | Generate new installation token via JWT |
| GitHub OAuth | Long-lived | Refresh token flow |
| Vercel | Long-lived (personal tokens) | Manual rotation |
| Linear | ~10 years | No refresh needed (practically permanent) |
| Sentry | Short-lived (hours) | JWT-based refresh with client secret |

### Recommended Backfill Order Per Provider

**GitHub**:
1. Repositories (list all)
2. Issues (with `since` — includes PRs via `pull_request` field)
3. Commits (with `since`/`until`)
4. Pull Requests (full pagination, `sort=updated&direction=desc`)
5. Releases (full pagination)

**Vercel**:
1. Projects (list all)
2. Deployments per project (with `since`/`until`, paginate via timestamp cursor)

**Linear**:
1. Teams
2. Users
3. Labels, Workflow States
4. Projects, Cycles
5. Issues (with `updatedAt` filter, includes relations)
6. Comments (nested in issue queries or separate)

**Sentry**:
1. Organizations
2. Projects per organization
3. Issues per project (with `start`/`end` date range)
4. Events per issue (most expensive — consider sampling or recent-only)

### Recommended Batch Sizes

| Provider | Initial Backfill | Incremental Sync | Delay Between Requests |
|----------|-----------------|------------------|----------------------|
| GitHub | 100/page, serial | 100/page with `since` | 1s (avoid secondary limits) |
| Vercel | 100/page, serial | 100/page with `since` | 500ms-1s |
| Linear | 250/page, serial | 250/page with `updatedAt` filter | Monitor complexity header |
| Sentry | ~100/page, serial | `statsPeriod` or `start/end` | Monitor rate limit headers |

---

## 6. Key Takeaways for Lightfast Backfill Framework

1. **All providers support some form of incremental sync** — GitHub's is weakest (no `since` on PRs/releases)
2. **Cursor-based pagination is universal** — but cursor formats differ (opaque, timestamp, link header)
3. **Serial requests are safest** across all providers to avoid secondary/abuse rate limits
4. **Token management varies significantly** — Linear is simplest (long-lived), Sentry is most complex (JWT refresh)
5. **Webhook support is available on all 4** — use for real-time updates after initial backfill
6. **Rate limit headers are standard** — all providers return remaining/reset info in response headers
7. **Common backfill pattern**: List parent entities first → paginate child entities → store progress → webhook for ongoing sync
