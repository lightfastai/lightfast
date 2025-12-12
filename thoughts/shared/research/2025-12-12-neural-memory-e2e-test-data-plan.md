# Neural Memory E2E Test Data Plan

## Purpose

Define test data (PRs, issues, pushes) needed to validate the Day 2 neural memory retrieval infrastructure:
- Metadata filters (sourceTypes, observationTypes, actorNames, dateRange)
- LLM relevance gating (bypass threshold = 5, needs >5 results to trigger)
- Combined score ranking (60% LLM + 40% vector)
- Latency tracking

## Test Repository

**Repository**: `lightfastai/lightfast-debug-env`

This is a dedicated test repository for webhook testing. All test resources should be created here and cleaned up after testing.

---

## Test Data Requirements

### Minimum Volume

| Requirement | Count | Reasoning |
|-------------|-------|-----------|
| Total observations | 15-20 | Need >5 to trigger LLM filtering |
| Per source type | 5+ each | Test source filtering |
| Per observation type | 3+ each | Test type filtering |
| Distinct actors | 2-3 | Test actor filtering |

### Semantic Diversity

Results should cover diverse topics to test LLM relevance scoring:
- Authentication/security
- Performance/optimization
- Bug fixes
- New features
- Documentation
- Infrastructure/deployment

---

## Test Resources to Create

### Pull Requests (8 total)

Create PRs with semantically distinct content for LLM relevance testing:

#### PR 1: Authentication Feature
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "feat: add OAuth2 authentication flow" \
  --body "Implements OAuth2 authentication with GitHub and Google providers.

- Add OAuth2 client configuration
- Implement token refresh mechanism
- Add session management
- Update auth middleware

Closes #1" \
  --head test/auth-oauth2-$(date +%s) \
  --base main
```

#### PR 2: Performance Optimization
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "perf: optimize database query performance" \
  --body "Improves query performance for workspace search.

- Add database indexes for common queries
- Implement query result caching
- Reduce N+1 queries in observation fetching
- Add query performance logging

Benchmarks show 40% improvement in search latency." \
  --head test/perf-db-queries-$(date +%s) \
  --base main
```

#### PR 3: Bug Fix - Search
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "fix: resolve search pagination edge case" \
  --body "Fixes bug where search results would return duplicates on page boundaries.

Root cause: Cursor-based pagination was using non-unique sort key.

- Update pagination to use composite key (score, id)
- Add deduplication safety check
- Add regression test

Fixes #2" \
  --head test/fix-search-pagination-$(date +%s) \
  --base main
```

#### PR 4: Documentation
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "docs: add API reference for search endpoint" \
  --body "Adds comprehensive API documentation for the search endpoint.

- Document request/response schemas
- Add filter parameter examples
- Include latency breakdown explanation
- Add error response documentation" \
  --head test/docs-search-api-$(date +%s) \
  --base main
```

#### PR 5: Infrastructure
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "infra: configure Vercel deployment settings" \
  --body "Updates Vercel deployment configuration for production.

- Add environment variable configuration
- Configure build settings
- Set up preview deployment rules
- Add deployment protection rules" \
  --head test/infra-vercel-config-$(date +%s) \
  --base main
```

#### PR 6: Refactoring
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "refactor: extract embedding logic into shared module" \
  --body "Refactors embedding generation into a reusable module.

- Create @repo/console-embed package
- Extract embedding provider factory
- Add support for multiple embedding models
- Update consumers to use new module" \
  --head test/refactor-embedding-$(date +%s) \
  --base main
```

#### PR 7: Testing
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "test: add integration tests for webhook pipeline" \
  --body "Adds comprehensive integration tests for the webhook processing pipeline.

- Test GitHub webhook signature verification
- Test observation capture for all event types
- Test Pinecone vector storage
- Add mock fixtures for CI" \
  --head test/webhook-integration-tests-$(date +%s) \
  --base main
```

#### PR 8: Security
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "security: implement rate limiting for API endpoints" \
  --body "Adds rate limiting to protect API endpoints from abuse.

- Implement sliding window rate limiter
- Add per-user and per-IP limits
- Configure limits per endpoint
- Add rate limit headers to responses
- Log rate limit violations" \
  --head test/security-rate-limiting-$(date +%s) \
  --base main
```

---

### Issues (6 total)

#### Issue 1: Feature Request
```bash
gh issue create --repo lightfastai/lightfast-debug-env \
  --title "Feature: Add support for filtering by date range" \
  --body "As a user, I want to filter search results by date range so I can find observations from specific time periods.

**Acceptance Criteria:**
- [ ] Add dateRange filter to search API
- [ ] Support start and end dates
- [ ] Update UI with date picker" \
  --label "enhancement"
```

#### Issue 2: Bug Report
```bash
gh issue create --repo lightfastai/lightfast-debug-env \
  --title "Bug: Search results show stale data after new observation" \
  --body "**Description:**
After creating a new observation, search results don't include it immediately.

**Steps to Reproduce:**
1. Create a new PR
2. Wait for webhook processing
3. Search for terms in the PR
4. New PR not in results

**Expected:** New observation appears within 5 seconds
**Actual:** Takes 30+ seconds to appear

**Environment:** Production" \
  --label "bug"
```

#### Issue 3: Documentation Request
```bash
gh issue create --repo lightfastai/lightfast-debug-env \
  --title "Docs: Document LLM relevance scoring algorithm" \
  --body "Need documentation explaining how the LLM relevance scoring works:

- When is LLM filtering triggered?
- How are scores combined?
- What model is used?
- How to interpret relevanceScore vs vectorScore?" \
  --label "documentation"
```

#### Issue 4: Performance Issue
```bash
gh issue create --repo lightfastai/lightfast-debug-env \
  --title "Performance: Search latency spikes during peak hours" \
  --body "**Description:**
Search latency increases significantly during peak usage hours.

**Metrics:**
- Off-peak: ~200ms average
- Peak (9-11am): ~800ms average

**Investigation needed:**
- [ ] Check Pinecone query latency
- [ ] Check LLM API latency
- [ ] Review connection pooling" \
  --label "performance"
```

#### Issue 5: Security Concern
```bash
gh issue create --repo lightfastai/lightfast-debug-env \
  --title "Security: Review webhook signature verification" \
  --body "Security audit requested for webhook signature verification implementation.

**Areas to review:**
- Timing-safe comparison for signatures
- Secret rotation handling
- Replay attack prevention
- Error message information leakage" \
  --label "security"
```

#### Issue 6: Infrastructure Request
```bash
gh issue create --repo lightfastai/lightfast-debug-env \
  --title "Infra: Set up staging environment" \
  --body "Need a staging environment for testing before production deployments.

**Requirements:**
- Separate Pinecone namespace
- Separate database
- Preview URL pattern
- Automatic deployment on PR merge to staging branch" \
  --label "infrastructure"
```

---

### Push Events (4 total)

Create branches with commits to trigger push events:

#### Push 1: Multiple commits
```bash
cd /tmp/repos/lightfast-debug-env
git checkout -b test/feature-commits-$(date +%s)
echo "// Authentication module" > auth.ts
git add . && git commit -m "feat: add authentication module skeleton"
echo "// Login handler" >> auth.ts
git add . && git commit -m "feat: implement login handler"
echo "// Logout handler" >> auth.ts
git add . && git commit -m "feat: implement logout handler"
git push origin HEAD
```

#### Push 2: Documentation update
```bash
git checkout -b test/docs-update-$(date +%s)
echo "# API Documentation" > API.md
git add . && git commit -m "docs: add API documentation"
git push origin HEAD
```

#### Push 3: Config change
```bash
git checkout -b test/config-update-$(date +%s)
echo '{"version": "2.0"}' > config.json
git add . && git commit -m "chore: update configuration version"
git push origin HEAD
```

#### Push 4: Test files
```bash
git checkout -b test/add-tests-$(date +%s)
echo "test('example', () => {})" > test.ts
git add . && git commit -m "test: add example test file"
git push origin HEAD
```

---

## Test Scenarios

### Scenario 1: Source Type Filtering
**Query**: "deployment configuration"
**Filter**: `sourceTypes: ["github"]`
**Expected**: Only GitHub observations returned

### Scenario 2: Observation Type Filtering
**Query**: "authentication"
**Filter**: `observationTypes: ["pull_request_opened"]`
**Expected**: Only PR observations, not issues

### Scenario 3: Combined Filtering
**Query**: "bug fix"
**Filter**: `sourceTypes: ["github"], observationTypes: ["pull_request_opened", "issue_opened"]`
**Expected**: PRs and issues from GitHub only

### Scenario 4: LLM Relevance Gating
**Query**: "security vulnerabilities and authentication"
**Filter**: None (return all)
**Expected**:
- `latency.llmFilter > 0` (LLM triggered)
- Security/auth PRs ranked higher than unrelated content
- Results include `relevanceScore` in metadata

### Scenario 5: LLM Bypass (Small Result Set)
**Query**: "Vercel deployment protection rules"
**Filter**: `observationTypes: ["pull_request_opened"]`
**Expected**:
- Few results (< 5)
- `latency.llmFilter === 0` (LLM bypassed)

### Scenario 6: Date Range Filtering
**Query**: "performance optimization"
**Filter**: `dateRange: { start: "2025-12-12T00:00:00Z" }`
**Expected**: Only observations from today

---

## Execution Script

```bash
#!/bin/bash
# test-data-setup.sh
# Run from lightfast-debug-env repo directory

REPO="lightfastai/lightfast-debug-env"
TIMESTAMP=$(date +%s)

echo "=== Creating Test PRs ==="

# PR 1: Auth
gh pr create --repo $REPO \
  --title "feat: add OAuth2 authentication flow" \
  --body "Implements OAuth2 authentication with GitHub and Google providers." \
  --head "test/auth-$TIMESTAMP" --base main || true

# PR 2: Perf
gh pr create --repo $REPO \
  --title "perf: optimize database query performance" \
  --body "Improves query performance for workspace search. 40% improvement." \
  --head "test/perf-$TIMESTAMP" --base main || true

# PR 3: Bug fix
gh pr create --repo $REPO \
  --title "fix: resolve search pagination edge case" \
  --body "Fixes bug where search results would return duplicates." \
  --head "test/fix-$TIMESTAMP" --base main || true

# PR 4: Docs
gh pr create --repo $REPO \
  --title "docs: add API reference for search endpoint" \
  --body "Adds comprehensive API documentation for the search endpoint." \
  --head "test/docs-$TIMESTAMP" --base main || true

# PR 5: Infra
gh pr create --repo $REPO \
  --title "infra: configure Vercel deployment settings" \
  --body "Updates Vercel deployment configuration for production." \
  --head "test/infra-$TIMESTAMP" --base main || true

# PR 6: Refactor
gh pr create --repo $REPO \
  --title "refactor: extract embedding logic into shared module" \
  --body "Refactors embedding generation into a reusable module." \
  --head "test/refactor-$TIMESTAMP" --base main || true

# PR 7: Testing
gh pr create --repo $REPO \
  --title "test: add integration tests for webhook pipeline" \
  --body "Adds comprehensive integration tests for webhook processing." \
  --head "test/tests-$TIMESTAMP" --base main || true

# PR 8: Security
gh pr create --repo $REPO \
  --title "security: implement rate limiting for API endpoints" \
  --body "Adds rate limiting to protect API endpoints from abuse." \
  --head "test/security-$TIMESTAMP" --base main || true

echo "=== Creating Test Issues ==="

gh issue create --repo $REPO \
  --title "Feature: Add support for filtering by date range" \
  --body "Filter search results by date range." \
  --label "enhancement" || true

gh issue create --repo $REPO \
  --title "Bug: Search results show stale data" \
  --body "New observations don't appear immediately in search." \
  --label "bug" || true

gh issue create --repo $REPO \
  --title "Docs: Document LLM relevance scoring" \
  --body "Need documentation for LLM scoring algorithm." \
  --label "documentation" || true

gh issue create --repo $REPO \
  --title "Performance: Search latency spikes" \
  --body "Search latency increases during peak hours." \
  --label "performance" || true

gh issue create --repo $REPO \
  --title "Security: Review webhook signature verification" \
  --body "Security audit for webhook verification." \
  --label "security" || true

gh issue create --repo $REPO \
  --title "Infra: Set up staging environment" \
  --body "Need staging environment for testing." \
  --label "infrastructure" || true

echo "=== Done ==="
echo "Wait 30 seconds for webhook processing, then run search tests."
```

---

## Cleanup Script

```bash
#!/bin/bash
# test-data-cleanup.sh

REPO="lightfastai/lightfast-debug-env"

echo "=== Closing Test PRs ==="
gh pr list --repo $REPO --state open --json number,headRefName \
  --jq '.[] | select(.headRefName | startswith("test/")) | .number' \
  | xargs -I {} gh pr close {} --repo $REPO --delete-branch

echo "=== Closing Test Issues ==="
gh issue list --repo $REPO --state open --json number,title \
  --jq '.[] | select(.title | test("Feature:|Bug:|Docs:|Performance:|Security:|Infra:")) | .number' \
  | xargs -I {} gh issue close {} --repo $REPO

echo "=== Cleanup Complete ==="
```

---

## Verification Checklist

After creating test data, verify with `/debug`:

- [ ] Observations appear in database (check Drizzle Studio)
- [ ] Observations indexed in Pinecone (check vector count)
- [ ] Search returns results for test queries
- [ ] Source type filter works (GitHub only)
- [ ] Observation type filter works (PRs vs issues)
- [ ] LLM filtering triggers for >5 results
- [ ] LLM bypasses for <=5 results
- [ ] Latency breakdown shows all components
- [ ] Relevance scores appear in metadata

---

## Related Documents

- Plan: `thoughts/shared/plans/2025-12-12-neural-memory-day2-retrieval-infrastructure.md`
- Debug command: `.claude/commands/debug.md`
- Day 1 implementation: `api/console/src/inngest/workflow/neural/observation-capture.ts`
