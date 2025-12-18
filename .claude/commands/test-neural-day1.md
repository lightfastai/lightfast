---
description: Test Neural Memory Day 1 features - significance scoring and semantic classification
---

# Test Neural Memory Day 1 Features

This command tests the Day 1 neural memory implementation: significance scoring and semantic classification.

## What We're Testing

1. **Significance Scoring** (`scoring.ts`): Rule-based scoring 0-100 based on:
   - Event type weights (release > PR merged > push)
   - Content signals (critical, feature, fix keywords)
   - Reference density (linked issues/PRs)
   - Content substance (body length)

2. **Semantic Classification** (`classification.ts`): Regex-based categories:
   - Primary: bug_fix, feature, release, deployment, security, etc.
   - Secondary: api, frontend, backend, typescript, react, etc.

## Test Execution

### Step 1: Pre-flight Checks

```bash
# Verify services are running
curl -s http://localhost:3024 > /dev/null && echo "Console OK" || echo "Console NOT RUNNING"
curl -s http://localhost:8288 > /dev/null && echo "Inngest OK" || echo "Inngest NOT RUNNING"
curl -s http://localhost:4040/api/tunnels > /dev/null && echo "ngrok OK" || echo "ngrok NOT RUNNING"
```

If any service is down, run: `pnpm dev:app`

### Step 2: Create Test Events

We'll create different types of GitHub events to verify scoring and classification:

#### Test A: High-Significance Feature PR
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "feat: Add critical security authentication feature" \
  --body "This implements the new OAuth authentication system with JWT tokens.

## Changes
- Add auth middleware
- Implement JWT validation
- Add permission checks

Fixes #123" \
  --head test/neural-day1-feature-$(date +%s) \
  --base main
```

**Expected Results:**
- `significanceScore`: ~60-75 (PR opened + feature + security keywords + references)
- `topics` includes: `feature`, `security`, `auth`

#### Test B: Low-Significance Chore PR
```bash
gh pr create --repo lightfastai/lightfast-debug-env \
  --title "chore: bump dependencies" \
  --body "Updates npm packages to latest versions." \
  --head test/neural-day1-chore-$(date +%s) \
  --base main
```

**Expected Results:**
- `significanceScore`: ~25-35 (PR opened - routine keyword penalty)
- `topics` includes: `refactor` (chore maps to refactor category)

#### Test C: Release Event (if possible)
Release events should score highest (base 70-75).

### Step 3: Verify in Inngest

1. Navigate to http://localhost:8288/runs
2. Find recent `apps-console/neural.observation.capture` runs
3. Check that runs completed successfully
4. Note the function run IDs for database verification

### Step 4: Verify in Database

Query the database to check stored values:

```sql
-- In Drizzle Studio (https://local.drizzle.studio)
-- or via direct query

SELECT
  id,
  title,
  source_type,
  significance_score,
  topics,
  created_at
FROM lightfast_workspace_neural_observations
ORDER BY created_at DESC
LIMIT 10;
```

**Verify:**
- [ ] `significance_score` is populated (not null)
- [ ] `significance_score` varies by event type (release > PR > push)
- [ ] `topics` includes semantic categories (feature, bug_fix, etc.)
- [ ] `topics` includes secondary tags (api, frontend, etc.)

### Step 5: Expected Scoring Examples

| Event Type | Title Contains | Expected Score Range |
|------------|----------------|---------------------|
| release_published | - | 75-85 |
| pull_request_merged | "fix: critical bug" | 70-80 |
| pull_request_opened | "feat: new feature" | 55-65 |
| pull_request_opened | "chore: deps update" | 35-45 |
| push | "typo fix" | 10-20 |
| deployment.error | - | 70-80 |

### Step 6: Cleanup

After testing, close test PRs:

```bash
# List test PRs
gh pr list --repo lightfastai/lightfast-debug-env --state open --search "test/neural-day1"

# Close and delete branches
gh pr close <PR_NUMBER> --repo lightfastai/lightfast-debug-env --delete-branch
```

## Troubleshooting

### Significance Score is NULL
- Check that `scoreSignificance()` is being called in `observation-capture.ts`
- Verify the import is correct: `import { scoreSignificance } from "./scoring"`

### Topics Missing Semantic Categories
- Check that `classifyObservation()` is being called
- Verify topics merge logic is deduplicating correctly

### Inngest Function Failed
- Check Inngest dashboard for error details
- Common issues: type errors, missing imports

## Files to Check

- `api/console/src/inngest/workflow/neural/scoring.ts` - Scoring logic
- `api/console/src/inngest/workflow/neural/classification.ts` - Classification logic
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Integration point
