# Neural Memory E2E Testing Plan

## Overview

End-to-end testing and verification plan for the Neural Memory Observation Pipeline. This plan verifies that the full observation capture pipeline works correctly for both GitHub and Vercel events.

**Prerequisites**:
- Phase 1-4 implementation complete (see `thoughts/shared/plans/2025-12-11-neural-memory-observation-pipeline.md`)
- Database migration `0004_big_arachne.sql` applied
- Connectors verified (GitHub App, Vercel Integration)

**Implementation Status** (verified 2025-12-11):
- ✅ Database tables created (`lightfast_workspace_neural_observations`, `lightfast_workspace_observation_clusters`)
- ✅ Observation capture workflow registered (`apps-console/neural.observation.capture`)
- ✅ GitHub webhook handlers implemented (push, PR, issue, release, discussion)
- ✅ Vercel webhook handlers implemented (deployment events)
- ✅ Transformers implemented (`@repo/console-webhooks/transformers`)

---

## What We're Testing

**Data Flow**:
1. Webhook received → Route handler validates signature
2. Handler resolves workspace from org slug/project ID
3. Handler transforms payload to SourceEvent
4. Handler emits Inngest event `apps-console/neural/observation.capture`
5. Inngest workflow generates embedding, upserts to Pinecone, stores in database
6. Workflow emits completion event `apps-console/neural/observation.captured`

**Key Files Under Test**:
- `apps/console/src/app/(github)/api/github/webhooks/route.ts:421` - GitHub webhook POST handler
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:124` - Vercel webhook POST handler
- `api/console/src/inngest/workflow/neural/observation-capture.ts:115` - Observation capture workflow
- `packages/console-webhooks/src/transformers/github.ts` - GitHub transformers
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel transformers

---

## Pre-flight Checks

Before running any tests, verify all services are running:

```bash
# Start all services (console, inngest, ngrok)
pnpm dev:console

# Verify services are running
curl -s http://localhost:3024 > /dev/null && echo "✅ Console (3024)" || echo "❌ Console not running"
curl -s http://localhost:8288 > /dev/null && echo "✅ Inngest (8288)" || echo "❌ Inngest not running"
curl -s http://localhost:4040/api/tunnels > /dev/null && echo "✅ ngrok (4040)" || echo "❌ ngrok not running"

# Get ngrok URL for webhook verification
curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[0].public_url'
```

---

## Phase 1: Workspace Setup

### Overview
Verify that a workspace exists with the debug repository as a source. This is a prerequisite for all subsequent tests.

### Option A: Use Existing Workspace

Check if workspace already exists for `lightfastai` org:

```bash
# Query database for existing workspace
cd apps/console && pnpm with-env psql -c "
SELECT
  w.id as workspace_id,
  w.name as workspace_name,
  w.clerk_org_id,
  s.id as store_id,
  s.index_name
FROM lightfast_org_workspaces w
JOIN lightfast_workspace_stores s ON s.workspace_id = w.id
WHERE w.clerk_org_id LIKE '%lightfast%'
LIMIT 5;
"
```

### Option B: Create Test Workspace via UI

1. Navigate to Console UI: `http://localhost:3024`
2. Sign in with Clerk
3. Create new workspace:
   - Name: "Neural Memory Test"
   - Root source: `lightfastai/lightfast-debug-env` (or create this repo first)
4. Verify workspace created in database:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT id, name, clerk_org_id, created_at
FROM lightfast_org_workspaces
ORDER BY created_at DESC
LIMIT 5;
"
```

5. Verify default store created:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT s.id, s.workspace_id, s.index_name, s.embedding_model
FROM lightfast_workspace_stores s
JOIN lightfast_org_workspaces w ON w.id = s.workspace_id
ORDER BY s.created_at DESC
LIMIT 5;
"
```

### Success Criteria:

#### Automated Verification:
- [ ] Workspace exists in `lightfast_org_workspaces` table
- [ ] Store exists in `lightfast_workspace_stores` table with valid `index_name`
- [ ] Workspace has `clerk_org_id` set correctly

#### Manual Verification:
- [ ] Workspace visible in Console UI
- [ ] Store visible in Drizzle Studio: `https://local.drizzle.studio`

**Implementation Note**: Record the `workspace_id` and `store_id` for use in subsequent tests.

---

## Phase 2: GitHub Event Testing

### Overview
Test observation capture for GitHub events: issues, PRs, pushes.

### Test 2.1: Create Test Issue

**Purpose**: Verify `issues.opened` event captures observation.

```bash
# Create test issue
gh issue create \
  --repo lightfastai/lightfast-debug-env \
  --title "[Test] Neural Memory Issue Test $(date +%Y%m%d-%H%M%S)" \
  --body "This is an automated test issue for verifying the neural memory observation pipeline.

## Test Details
- Created by: E2E test script
- Purpose: Verify issue_opened observation capture
- Safe to close"
```

**Wait 10 seconds for webhook processing.**

**Verify in Inngest** (http://localhost:8288/runs):
- Look for `apps-console/neural.observation.capture` function run
- Status should be "Completed"
- Event data should show `sourceType: "issue_opened"`

**Verify in Database**:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  id,
  observation_type,
  title,
  source,
  source_id,
  created_at
FROM lightfast_workspace_neural_observations
WHERE source = 'github'
  AND observation_type = 'issue_opened'
ORDER BY created_at DESC
LIMIT 5;
"
```

**Cleanup**:

```bash
# Get issue number from creation output, then close it
gh issue close <ISSUE_NUMBER> --repo lightfastai/lightfast-debug-env
```

### Test 2.2: Create Test PR

**Purpose**: Verify `pull_request.opened` event captures observation.

```bash
# Create test branch with a change
cd /tmp && rm -rf neural-test-repo && mkdir neural-test-repo && cd neural-test-repo
gh repo clone lightfastai/lightfast-debug-env .
git checkout -b test/neural-memory-$(date +%Y%m%d-%H%M%S)

# Create a test file
echo "# Test file for neural memory E2E test\nCreated: $(date)" > test-neural-memory.md
git add test-neural-memory.md
git commit -m "test: add file for neural memory E2E test"
git push origin HEAD

# Create PR
gh pr create \
  --title "[Test] Neural Memory PR Test $(date +%Y%m%d-%H%M%S)" \
  --body "Automated test PR for verifying neural memory observation capture.

## Test Details
- Created by: E2E test script
- Purpose: Verify pull_request_opened observation capture
- Safe to close/merge" \
  --repo lightfastai/lightfast-debug-env
```

**Wait 10 seconds for webhook processing.**

**Verify in Inngest**:
- Look for function run with `sourceType: "pull_request_opened"`
- Status should be "Completed"

**Verify in Database**:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  id,
  observation_type,
  title,
  source,
  source_id,
  (metadata->>'prNumber')::int as pr_number,
  created_at
FROM lightfast_workspace_neural_observations
WHERE source = 'github'
  AND observation_type LIKE 'pull_request%'
ORDER BY created_at DESC
LIMIT 5;
"
```

### Test 2.3: Close/Merge PR

**Purpose**: Verify `pull_request.closed` event captures observation.

```bash
# Close the PR (or merge if preferred)
gh pr close <PR_NUMBER> --repo lightfastai/lightfast-debug-env --delete-branch
```

**Wait 10 seconds for webhook processing.**

**Verify in Database**:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  id,
  observation_type,
  title,
  (metadata->>'merged')::boolean as was_merged,
  created_at
FROM lightfast_workspace_neural_observations
WHERE source = 'github'
  AND observation_type = 'pull_request_closed'
ORDER BY created_at DESC
LIMIT 5;
"
```

### Test 2.4: Push to Default Branch

**Purpose**: Verify `push` event to default branch captures observation.

```bash
# Push directly to main (requires permissions)
cd /tmp/neural-test-repo
git checkout main
git pull origin main
echo "# Neural memory test $(date)" >> test-push.md
git add test-push.md
git commit -m "test: verify push observation capture"
git push origin main
```

**Wait 10 seconds for webhook processing.**

**Verify in Database**:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  id,
  observation_type,
  title,
  (metadata->>'branch')::text as branch,
  (metadata->>'commitCount')::int as commit_count,
  created_at
FROM lightfast_workspace_neural_observations
WHERE source = 'github'
  AND observation_type = 'push'
ORDER BY created_at DESC
LIMIT 5;
"
```

### Success Criteria:

#### Automated Verification:
- [ ] Issue observation exists: `observation_type = 'issue_opened'`
- [ ] PR opened observation exists: `observation_type = 'pull_request_opened'`
- [ ] PR closed observation exists: `observation_type = 'pull_request_closed'`
- [ ] Push observation exists: `observation_type = 'push'`
- [ ] All observations have `embedding_vector_id` set (not null)
- [ ] Inngest runs completed without errors

#### Manual Verification:
- [ ] Observations visible in Drizzle Studio with correct metadata
- [ ] Inngest dashboard shows successful function runs
- [ ] No error logs in console output

---

## Phase 3: Pinecone Vector Verification

### Overview
Verify that observation embeddings are stored correctly in Pinecone.

### Verify Vectors Exist

Use Pinecone console or API to verify vectors:

1. Navigate to Pinecone Console: https://app.pinecone.io
2. Select index: `lightfast-staging-v1` (or production index)
3. Query the namespace for the workspace

**Namespace Format**: `{sanitized-clerk-org-id}:ws_{sanitized-workspace-id}`

Example query in Pinecone console:
- Filter by metadata: `layer = "observations"`
- Should see vectors with metadata including:
  - `observationType`: "issue_opened", "pull_request_opened", etc.
  - `source`: "github"
  - `title`: The observation title
  - `actorName`: The GitHub username

**Verify via Database** (check embedding_vector_id is set):

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  id,
  observation_type,
  embedding_vector_id,
  CASE WHEN embedding_vector_id IS NOT NULL THEN '✅' ELSE '❌' END as has_embedding
FROM lightfast_workspace_neural_observations
WHERE source = 'github'
ORDER BY created_at DESC
LIMIT 10;
"
```

### Success Criteria:

#### Automated Verification:
- [ ] All observations have `embedding_vector_id` populated
- [ ] No null `embedding_vector_id` values for recent observations

#### Manual Verification:
- [ ] Vectors visible in Pinecone console with `layer: "observations"` metadata
- [ ] Vector count matches observation count in database

---

## Phase 4: Vercel Deployment Testing

### Overview
Test observation capture for Vercel deployment events.

### Prerequisites

1. **Vercel Project Setup**:
   - Go to Vercel dashboard: https://vercel.com/lightfast
   - Ensure debug repo is connected as a Vercel project
   - Verify Vercel integration webhook is configured

2. **Check Workspace Integration**:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  i.id,
  i.provider,
  i.external_id,
  i.workspace_id,
  i.created_at
FROM lightfast_workspace_integrations i
WHERE i.provider = 'vercel'
ORDER BY i.created_at DESC
LIMIT 5;
"
```

### Test 4.1: Trigger Deployment

**Option A**: Push to trigger deployment

```bash
cd /tmp/neural-test-repo
git checkout main
echo "# Deployment trigger $(date)" >> deploy-test.md
git add deploy-test.md
git commit -m "chore: trigger vercel deployment for neural memory test"
git push origin main
```

**Option B**: Manual deployment via Vercel dashboard
1. Go to Vercel project dashboard
2. Click "Redeploy" on latest deployment

**Wait 30-60 seconds for deployment to complete and webhooks to process.**

### Verify Deployment Observations

**Verify in Inngest** (http://localhost:8288/runs):
- Look for function runs with `source: "vercel"`
- Should see events for `deployment.created`, `deployment.succeeded`/`deployment.ready`

**Verify in Database**:

```bash
cd apps/console && pnpm with-env psql -c "
SELECT
  id,
  observation_type,
  title,
  source,
  (metadata->>'deploymentId')::text as deployment_id,
  (metadata->>'projectName')::text as project_name,
  (metadata->>'environment')::text as environment,
  created_at
FROM lightfast_workspace_neural_observations
WHERE source = 'vercel'
ORDER BY created_at DESC
LIMIT 10;
"
```

### Success Criteria:

#### Automated Verification:
- [ ] Deployment created observation exists: `observation_type = 'deployment_created'`
- [ ] Deployment succeeded observation exists: `observation_type = 'deployment_succeeded'` or `'deployment_ready'`
- [ ] Observations have correct metadata (deploymentId, projectName, environment)
- [ ] `embedding_vector_id` is set for all Vercel observations

#### Manual Verification:
- [ ] Vercel observations visible in Drizzle Studio
- [ ] Pinecone vectors exist with `source: "vercel"` metadata
- [ ] Inngest dashboard shows successful function runs for Vercel events

---

## Phase 5: Idempotency and Error Handling

### Overview
Verify that duplicate webhooks don't create duplicate observations.

### Test 5.1: Duplicate Prevention

The observation capture workflow has idempotency built in:
- Idempotency key: `event.data.sourceEvent.sourceId`
- Duplicate check in workflow step: `check-duplicate`

**Verify Idempotency**:

```bash
# Check for any duplicate sourceIds
cd apps/console && pnpm with-env psql -c "
SELECT
  source_id,
  COUNT(*) as count
FROM lightfast_workspace_neural_observations
GROUP BY source_id
HAVING COUNT(*) > 1;
"
```

Expected result: **No rows returned** (no duplicates).

### Test 5.2: Error Recovery

Check Inngest for any failed runs:

```bash
# Via Inngest dashboard: http://localhost:8288/runs
# Filter by status: Failed
# Look for any observation capture failures
```

### Success Criteria:

#### Automated Verification:
- [ ] No duplicate `source_id` values in database
- [ ] Inngest retry count is reasonable (≤3 for transient failures)

#### Manual Verification:
- [ ] Inngest dashboard shows no persistent failures
- [ ] Console logs show no unhandled errors

---

## Phase 6: Full E2E Summary Report

### Run All Verifications

```bash
cd apps/console && pnpm with-env psql -c "
-- Summary Report
SELECT
  '📊 Observation Summary' as report_section,
  NULL as metric,
  NULL as value

UNION ALL

SELECT
  'Total Observations',
  source,
  COUNT(*)::text
FROM lightfast_workspace_neural_observations
GROUP BY source

UNION ALL

SELECT
  'By Type',
  observation_type,
  COUNT(*)::text
FROM lightfast_workspace_neural_observations
GROUP BY observation_type

UNION ALL

SELECT
  'With Embeddings',
  'embedded',
  COUNT(*)::text || ' / ' || (SELECT COUNT(*) FROM lightfast_workspace_neural_observations)::text
FROM lightfast_workspace_neural_observations
WHERE embedding_vector_id IS NOT NULL

UNION ALL

SELECT
  'Duplicates',
  'duplicate_count',
  COALESCE(
    (SELECT COUNT(*)::text FROM (
      SELECT source_id FROM lightfast_workspace_neural_observations
      GROUP BY source_id HAVING COUNT(*) > 1
    ) dups),
    '0'
  );
"
```

### Expected Results

| Metric | Expected |
|--------|----------|
| GitHub observations | ≥4 (issue, PR open, PR close, push) |
| Vercel observations | ≥2 (deployment created, succeeded) |
| Observations with embeddings | 100% |
| Duplicate count | 0 |

---

## Troubleshooting

### Webhook Not Received

1. **Check ngrok is running**:
   ```bash
   curl -s http://localhost:4040/api/tunnels | jq '.tunnels[0].public_url'
   ```

2. **Check GitHub App webhook URL**:
   - Go to GitHub App settings
   - Verify webhook URL matches ngrok tunnel

3. **Check Vercel integration**:
   - Go to Vercel dashboard → Integrations
   - Verify webhook is configured

### Inngest Function Not Running

1. **Check Inngest dashboard**: http://localhost:8288
2. **Verify function is registered**:
   ```bash
   curl -s http://localhost:8288/v1/functions | jq '.[] | select(.id | contains("neural"))'
   ```

3. **Check for event schema errors** in Inngest logs

### Observation Not in Database

1. **Check Inngest run status** for errors
2. **Check for workspace resolution**:
   ```bash
   # Ensure GitHub org is linked to workspace
   cd apps/console && pnpm with-env psql -c "
   SELECT * FROM lightfast_org_workspaces
   WHERE clerk_org_id ILIKE '%lightfast%';
   "
   ```

3. **Check for store existence**:
   ```bash
   cd apps/console && pnpm with-env psql -c "
   SELECT * FROM lightfast_workspace_stores;
   "
   ```

### Embedding Not Generated

1. **Check COHERE_API_KEY** is set in environment
2. **Check Inngest logs** for embedding errors
3. **Verify store has valid `embedding_model`**:
   ```bash
   cd apps/console && pnpm with-env psql -c "
   SELECT id, embedding_model, embedding_dim FROM lightfast_workspace_stores;
   "
   ```

---

## Cleanup

After testing, clean up test resources:

```bash
# Close any open test issues
gh issue list --repo lightfastai/lightfast-debug-env --label "test" | awk '{print $1}' | xargs -I {} gh issue close {} --repo lightfastai/lightfast-debug-env

# Delete test branches
git push origin --delete test/neural-memory-*

# Optionally: Delete test observations from database (NOT recommended for production)
# cd apps/console && pnpm with-env psql -c "
# DELETE FROM lightfast_workspace_neural_observations
# WHERE title LIKE '%Test%' AND created_at > NOW() - INTERVAL '1 day';
# "
```

---

## References

- Implementation plan: `thoughts/shared/plans/2025-12-11-neural-memory-observation-pipeline.md`
- Debug command: `.claude/commands/debug.md`
- Observation capture workflow: `api/console/src/inngest/workflow/neural/observation-capture.ts`
- GitHub transformers: `packages/console-webhooks/src/transformers/github.ts`
- Vercel transformers: `packages/console-webhooks/src/transformers/vercel.ts`
