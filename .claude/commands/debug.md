---
description: Debug and test integrations - trigger actions, inspect state, verify flows
---

# Debug

You orchestrate agents to help users debug and test the Lightfast application by triggering actions, inspecting state, and verifying flows across the local dev environment.

## CRITICAL: AGENT ORCHESTRATION ONLY

- DO NOT perform browser automation yourself
- DO NOT execute GitHub commands directly
- ALWAYS spawn specialized agents for actions
- ALWAYS wait for agents to complete before proceeding
- Synthesize results from multiple agents into clear reports

## Initial Response

When this command is invoked:

1. **If invoked with args** (e.g., `/debug create a test PR`):
   - Analyze the request
   - Determine required actions and agents
   - Proceed to execution

2. **If invoked without args**, ask:
   ```
   What would you like to debug or test?

   **Common tasks**:
   - Create a test PR/issue and verify observation capture
   - Test neural search and retrieval (with filters)
   - Check Inngest for recent runs or failures
   - Query database for recent observations
   - View webhook delivery logs
   - Run full E2E webhook test

   Example: "create a test PR and verify the observation was captured"
   Example: "test search with source filter for github"
   ```

3. **Wait for user input** before proceeding.

## Agent Coordination

You coordinate two specialized agents:

### 1. `github-action-runner`
- **Purpose**: Execute GitHub actions via `gh` CLI
- **Capabilities**: Create PRs, issues, releases; push commits
- **Output**: Resource URLs, expected webhook event types

### 2. `debug-browser`
- **Purpose**: Inspect local dev services via Playwright
- **Capabilities**: Navigate Inngest/Drizzle Studio/ngrok, take screenshots
- **Output**: State observations, screenshots, verification results

## Pre-flight Checks

Before actions requiring local services, verify they're running:

```bash
# Check services
curl -s http://localhost:3024 > /dev/null && echo "Console (3024)" || echo "Console not running"
curl -s http://localhost:8288 > /dev/null && echo "Inngest (8288)" || echo "Inngest not running"
curl -s http://localhost:4040/api/tunnels > /dev/null && echo "ngrok (4040)" || echo "ngrok not running"
```

If services are down, tell user: `Run 'pnpm dev:app' to start all services.`

---

## Workflow 1: Test Webhook Pipeline

**Trigger**: User wants to test webhook processing (e.g., "create a test PR and verify observation")

### Step 1: Determine Test Parameters

Ask if needed:
```
Creating webhook test. Please confirm:
- **Repository**: lightfastai/lightfast-debug-env (default) or specify another
- **Event type**: PR (or issue, release, push)
- **Cleanup after**: yes/no

Or just say "proceed" to use defaults (PR on lightfastai/lightfast-debug-env, with cleanup prompt after).
```

### Step 2: Create GitHub Resource

Spawn `github-action-runner`:

```
Create a test PR to trigger webhook.

**Repository**: {repo}
**Type**: Pull Request
**Details**:
- Branch: test/webhook-{timestamp}
- Title: "[Test] Webhook verification {timestamp}"
- Body: "Automated test PR for webhook verification. Safe to close."

Execute and return:
- PR URL and number
- Expected webhook event: pull_request.opened
- Timestamp
- Cleanup command
```

**Wait for github-action-runner to complete.**

### Step 3: Wait for Processing

```
PR #{number} created: {url}
Expected webhook: pull_request.opened

Waiting 5-10 seconds for webhook processing...
```

Wait 8 seconds, then proceed.

### Step 4: Verify in Inngest

Spawn `debug-browser`:

```
Check Inngest for webhook processing results.

**Task**: Find the function run for the PR we just created

**Steps**:
1. Navigate to http://localhost:8288/runs
2. Look for recent run of function containing "observation" or "neural"
3. Check status (Completed, Failed, Running)
4. If found, click into it and capture:
   - Function name
   - Status
   - Duration
   - Event data (if visible)
5. Take screenshot

**Return**:
- Function run found: yes/no
- Status: {status}
- Screenshot path
```

**Wait for debug-browser to complete.**

### Step 5: Verify in Database

Spawn `debug-browser`:

```
Check Drizzle Studio for observation record.

**Task**: Find the observation record for the PR we created

**Steps**:
1. Navigate to https://local.drizzle.studio
2. Find table: lightfast_workspace_neural_observations (or similar)
3. Sort by created_at DESC
4. Look for recent record with:
   - event_type containing "pull_request"
   - timestamp close to now
5. Take screenshot showing the record

**Return**:
- Record found: yes/no
- Record ID (if found)
- Event type
- Screenshot path
```

**Wait for debug-browser to complete.**

### Step 6: Report Results

```
## Webhook Test Results

**Resource Created**: PR #{number}
**URL**: {url}

### Inngest Processing
- Status: {Completed | Failed | Not found}
- Function: {name}
- Duration: {duration}
- Screenshot: {path}

### Database Record
- Status: {Found | Not found}
- Record ID: {id}
- Event Type: {type}
- Screenshot: {path}

### Overall: {PASS | FAIL}

{If PASS:}
The webhook pipeline is working correctly!

{If FAIL:}
Issues detected:
- {specific issue 1}
- {specific issue 2}

**Cleanup**:
```bash
gh pr close {number} --repo {repo} --delete-branch
```

Would you like me to:
1. Run cleanup now
2. Investigate the failure
3. Run another test
```

---

## Workflow 2: Inspect Inngest

**Trigger**: User wants to check Inngest (e.g., "check inngest for failures", "show recent runs")

### Step 1: Determine Query

Parse user request for:
- Status filter: all, completed, failed, running
- Function filter: specific function name
- Time range: recent, last hour, specific

### Step 2: Inspect Inngest

Spawn `debug-browser`:

```
Inspect Inngest dashboard.

**Task**: {user's request}
**Filters**: {status}, {function}, {time}

**Steps**:
1. Navigate to http://localhost:8288/runs
2. Apply filters if specified
3. Capture list of runs showing:
   - Function names
   - Statuses
   - Timestamps
4. If looking at failures, click into first failed run and capture error
5. Take screenshots

**Return**:
- Runs found: {count}
- Summary by status
- Error details (if viewing failures)
- Screenshots
```

**Wait for debug-browser to complete.**

### Step 3: Report

```
## Inngest Status

**Time**: {timestamp}
**Filter**: {applied filters}

### Runs Summary
| Status | Count |
|--------|-------|
| Completed | {n} |
| Failed | {n} |
| Running | {n} |

{If failures:}
### Recent Failures
1. **{function}** at {time}
   Error: {error message}

{Screenshots attached}

Would you like me to investigate any specific run?
```

---

## Workflow 3: Query Database

**Trigger**: User wants to check database (e.g., "show recent observations", "check if record exists")

### Step 1: Determine Query

Parse user request for:
- Table: observations, clusters, stores, etc.
- Filters: time range, specific IDs
- Limit: how many records

### Step 2: Query via Drizzle Studio

Spawn `debug-browser`:

```
Query database via Drizzle Studio.

**Task**: {user's request}
**Table**: {table name}
**Filters**: {filters}

**Steps**:
1. Navigate to https://local.drizzle.studio
2. Find and click on table: {table}
3. Apply sorting/filtering as needed
4. Capture data showing requested records
5. Take screenshot

**Return**:
- Records found: {count}
- Key data from records
- Screenshot
```

**Wait for debug-browser to complete.**

### Step 3: Report

Present findings in structured format with screenshot reference.

---

## Workflow 4: View Webhook Logs

**Trigger**: User wants to see webhook deliveries (e.g., "show webhook logs", "check ngrok")

### Step 1: Inspect ngrok

Spawn `debug-browser`:

```
Check ngrok webhook inspector.

**Task**: View recent webhook deliveries

**Steps**:
1. Navigate to http://localhost:4040/inspect/http
2. Look for recent POST requests to /api/github/webhooks
3. For each recent delivery, capture:
   - Timestamp
   - Status code
   - Event type (from headers)
4. Take screenshot

**Return**:
- Recent deliveries count
- Summary of events
- Any failures (non-2xx responses)
- Screenshot
```

**Wait for debug-browser to complete.**

### Step 2: Report

Present webhook delivery summary with screenshot.

---

## Workflow 5: Test Neural Search

**Trigger**: User wants to test observation retrieval (e.g., "test search", "verify retrieval works")

### Step 1: Verify Observations Exist

```bash
# Quick DB check for recent observations
curl -s "https://local.drizzle.studio" > /dev/null && echo "Drizzle Studio available"
```

Spawn `debug-browser` to check observation count in `workspace_neural_observations` table.

### Step 2: Test Search Endpoint

```bash
# Test search via console API (requires active session)
curl -X POST "http://localhost:3024/{org-slug}/{workspace-name}/api/search" \
  -H "Content-Type: application/json" \
  -H "Cookie: {session-cookie}" \
  -d '{"query": "test search query", "topK": 5}'
```

Or spawn `debug-browser` to:
1. Navigate to workspace search page
2. Enter test query
3. Capture results and latency
4. Screenshot the response

### Step 3: Verify Filter Behavior (Day 2)

Test with filters once implemented:
```json
{
  "query": "deployment",
  "topK": 10,
  "filters": {
    "sourceTypes": ["github"],
    "observationTypes": ["push", "pull_request_merged"],
    "dateRange": { "start": "2025-12-01" }
  }
}
```

### Step 4: Report

```
## Neural Search Test Results

**Query**: {query}
**Filters**: {filters applied}

### Results
- Count: {n} observations returned
- Latency: {total}ms (retrieval: {retrieval}ms, llmFilter: {llm}ms)
- Top result: {title} (score: {score})

### Verification
- [ ] Results relevant to query
- [ ] Filters applied correctly
- [ ] Latency within budget (<500ms)

{Screenshot attached}
```

---

## Workflow 6: Full E2E Test

**Trigger**: User wants comprehensive test (e.g., "run full webhook test", "full E2E test")

This combines Workflow 1 with additional verification:

1. Pre-flight checks (all services running)
2. Create test resource (PR/issue)
3. Wait for processing
4. Verify webhook received (ngrok inspector)
5. Verify Inngest function completed
6. Verify database record created
7. Comprehensive report
8. Offer cleanup

---

## Error Handling

### Service Not Running
```
{Service} is not running at {URL}

Please start the dev environment:
```bash
pnpm dev:app
```

Then try again.
```

### Agent Failed
```
{Agent} encountered an error: {error}

This might be because:
- {possible cause 1}
- {possible cause 2}

Would you like me to:
1. Retry the operation
2. Try an alternative approach
3. Show debug information
```

### Resource Not Found
```
Expected resource not found

Checked: {what was checked}
Expected: {what should have been there}
Found: {what was actually found}

This could indicate:
- Webhook not delivered (check ngrok)
- Processing failed (check Inngest)
- Database write failed (check logs)

Would you like me to investigate?
```

---

## Important Notes

**Critical Ordering**:
- ALWAYS run pre-flight checks before operations requiring local services
- ALWAYS wait for agents to complete before proceeding
- ALWAYS provide cleanup commands for created resources

**Agent Coordination**:
- `github-action-runner` for all GitHub CLI operations
- `debug-browser` for all browser-based inspection
- This command orchestrates and synthesizes results

**Screenshots**:
- Store in `.playwright-mcp/` directory
- Reference in reports for verification
- Include timestamps in filenames

**User Experience**:
- Provide clear progress updates
- Show structured results with pass/fail indicators
- Always offer next steps or cleanup options
