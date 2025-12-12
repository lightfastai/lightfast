# Neural Memory Test Data Plan

## Purpose

Define test data to populate a workspace for end-to-end validation of Day 2 retrieval infrastructure:
- Metadata filters (sourceTypes, observationTypes, actorNames, dateRange)
- LLM relevance gating (requires >5 results to trigger)
- Latency tracking
- Filter UI functionality

## Test Workspace Setup

Use `/debug` command to inject test observations into a workspace's Pinecone namespace.

## Required Test Data

### Volume Requirements

- **Minimum 15-20 observations** to ensure LLM filtering triggers (bypass threshold = 5)
- Mix of event types across different semantic topics
- Multiple actors to test actor filtering
- Date spread across last 7-30 days

---

## Test Observations

### Category 1: Authentication & Security (4 items)

| Type | Title | Actor | Date Offset |
|------|-------|-------|-------------|
| `pull_request_merged` | "feat: implement OAuth2 PKCE flow for secure authentication" | alice | -2 days |
| `pull_request_opened` | "fix: patch JWT token validation vulnerability CVE-2024-1234" | bob | -1 day |
| `issue_opened` | "Security: API keys exposed in client-side bundle" | charlie | -5 days |
| `push` | "chore: rotate production API credentials" | alice | -3 days |

**Snippet content:**
1. "Implemented PKCE flow with code verifier and challenge. Added secure token storage using httpOnly cookies. Replaces implicit grant for better security."
2. "Fixed critical JWT validation bypass where expired tokens were accepted. Added proper exp claim verification and clock skew tolerance."
3. "Found API keys being bundled into client JavaScript. Need to move to server-side proxy pattern. Affects production environment."
4. "Rotated all API keys after security audit. Updated environment variables in Vercel dashboard. Old keys invalidated."

---

### Category 2: Performance & Optimization (4 items)

| Type | Title | Actor | Date Offset |
|------|-------|-------|-------------|
| `pull_request_merged` | "perf: add Redis caching layer for database queries" | david | -7 days |
| `pull_request_opened` | "perf: implement virtual scrolling for large lists" | alice | -1 day |
| `issue_opened` | "Performance: Dashboard takes 8 seconds to load" | eve | -10 days |
| `push` | "perf: optimize bundle size with dynamic imports" | david | -4 days |

**Snippet content:**
1. "Added Redis caching with 5-minute TTL for frequently accessed queries. Reduced database load by 60%. Using Upstash for serverless Redis."
2. "Implemented react-window for virtualized rendering. Only renders visible items. Handles lists with 10k+ items smoothly."
3. "Dashboard loading is extremely slow. Profiler shows 47 re-renders on mount. Suspect missing useMemo/useCallback optimizations."
4. "Split vendor bundle using next/dynamic. Reduced initial JS payload from 450kb to 180kb. Lazy load heavy components."

---

### Category 3: Bug Fixes (4 items)

| Type | Title | Actor | Date Offset |
|------|-------|-------|-------------|
| `pull_request_merged` | "fix: resolve race condition in webhook processing" | bob | -6 days |
| `pull_request_closed` | "fix: handle null pointer in user profile component" | charlie | -8 days |
| `issue_closed` | "Bug: Form data lost on page refresh" | eve | -12 days |
| `push` | "fix: correct timezone handling for scheduled jobs" | bob | -2 days |

**Snippet content:**
1. "Fixed race condition where concurrent webhooks could create duplicate records. Added distributed locking using Upstash Redis."
2. "Closed without merging - duplicate of #142. Null check already added in previous PR."
3. "Resolved by persisting form state to sessionStorage. Auto-restores on page load. Added cleanup on successful submit."
4. "Jobs were running at wrong times for non-UTC users. Now storing all times as UTC and converting on display."

---

### Category 4: New Features (4 items)

| Type | Title | Actor | Date Offset |
|------|-------|-------|-------------|
| `pull_request_merged` | "feat: add workspace search with semantic similarity" | alice | -3 days |
| `pull_request_opened` | "feat: implement real-time notifications via WebSocket" | david | -1 day |
| `issue_opened` | "Feature: Export workspace data to CSV" | frank | -15 days |
| `push` | "feat: add dark mode toggle with system preference detection" | charlie | -5 days |

**Snippet content:**
1. "Added semantic search using Pinecone vector database. Supports natural language queries. Returns ranked results with relevance scores."
2. "Implementing WebSocket connection for real-time updates. Using Pusher for managed WebSocket infrastructure. Includes reconnection logic."
3. "Users need ability to export their data for backup or migration. Should support CSV and JSON formats. Include all workspace observations."
4. "Added dark mode with three options: light, dark, system. Persists preference to localStorage. Smooth CSS transitions."

---

### Category 5: DevOps & Infrastructure (4 items)

| Type | Title | Actor | Date Offset |
|------|-------|-------|-------------|
| `deployment_succeeded` | "Production deployment v2.4.0" | vercel-bot | -1 day |
| `deployment_error` | "Staging deployment failed - build error" | vercel-bot | -2 days |
| `pull_request_merged` | "ci: add automated E2E tests with Playwright" | eve | -9 days |
| `issue_opened` | "Infrastructure: Need staging environment parity with production" | frank | -20 days |

**Snippet content:**
1. "Deployed successfully to production. Build time: 45s. 3 serverless functions updated. No errors in first 100 requests."
2. "Build failed with TypeScript error in new component. Missing type export from @repo/console-types package."
3. "Added Playwright E2E tests for critical user flows. Runs on PR merge to main. Covers auth, search, and workspace creation."
4. "Staging differs from production in several ways: different API keys, missing feature flags, outdated dependencies. Need parity."

---

## Test Scenarios

### Scenario 1: Filter by Source Type
```
Query: "deployment issues"
Filters: { sourceTypes: ["vercel"] }
Expected: Only Vercel deployment observations returned
```

### Scenario 2: Filter by Observation Type
```
Query: "what bugs were fixed"
Filters: { observationTypes: ["pull_request_merged", "issue_closed"] }
Expected: Only merged PRs and closed issues about bug fixes
```

### Scenario 3: Filter by Actor
```
Query: "authentication changes"
Filters: { actorNames: ["alice"] }
Expected: Only alice's observations about authentication
```

### Scenario 4: Filter by Date Range
```
Query: "recent performance work"
Filters: { dateRange: { start: "2025-12-05T00:00:00Z" } }
Expected: Only observations from last 7 days
```

### Scenario 5: Combined Filters
```
Query: "security"
Filters: {
  sourceTypes: ["github"],
  observationTypes: ["pull_request_merged", "pull_request_opened"],
  dateRange: { start: "2025-12-01T00:00:00Z" }
}
Expected: Only GitHub PRs about security from December
```

### Scenario 6: LLM Relevance Gating
```
Query: "how do we handle user authentication"
Filters: none (get all 20 observations)
Expected:
- latency.llmFilter > 0 (LLM was invoked)
- Results sorted by finalScore (combined LLM + vector)
- Irrelevant results filtered out (security/auth PRs ranked high, deployment stuff filtered)
```

### Scenario 7: LLM Bypass (Small Result Set)
```
Query: "deployment"
Filters: { sourceTypes: ["vercel"] }
Expected:
- Only 2 Vercel observations returned
- latency.llmFilter === 0 (bypassed due to <=5 results)
```

---

## Data Injection Approach

Use debug command to:

1. **Create test observations in database** - Insert into `workspace_observations` table
2. **Generate embeddings** - Use workspace's embedding model
3. **Upsert to Pinecone** - Store vectors with proper metadata:
   ```typescript
   {
     layer: "observations",
     source: "github" | "vercel",
     observationType: "pull_request_merged" | "issue_opened" | etc,
     actorName: "alice" | "bob" | etc,
     occurredAt: ISO8601 timestamp,
     title: string,
     snippet: string,
     url: string
   }
   ```

---

## Validation Checklist

After data injection:

- [ ] Search without filters returns all observations
- [ ] sourceTypes filter works (GitHub only, Vercel only)
- [ ] observationTypes filter works (PRs only, issues only)
- [ ] actorNames filter works (single actor)
- [ ] dateRange filter works (start, end, both)
- [ ] Combined filters work correctly
- [ ] >5 results triggers LLM filtering (check latency.llmFilter > 0)
- [ ] <=5 results bypasses LLM (check latency.llmFilter === 0)
- [ ] Results include relevanceScore in metadata
- [ ] UI filter badges toggle correctly
- [ ] Latency breakdown displays in UI

---

## Notes

- All dates should be relative to "now" when injecting
- Use consistent actor names across observations for testing
- Snippet content should be semantically distinct to test LLM relevance scoring
- Vercel source requires `deployment_succeeded` and `deployment_error` types
