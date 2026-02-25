# Backfill Operations Runbook

## Architecture Overview

```
User connects repo
  → Gateway creates connection
    → QStash → Backfill /trigger
      → Inngest: orchestrator (1 per connection)
        → fan-out: N entity workers (1 per entityType)
          → Worker: get-token → [fetch page → dispatch to Gateway] × pages → emit completion
            → Gateway: Redis dedup → QStash → Console → observation.capture
```

**Constraints:** 100 concurrent Inngest steps, 1M executions/month. Entity workers: 5 per org, 10 global.

---

## Scenario 1: Customer Reports Missing Historical Data

**Symptoms:** Customer says "I connected my repo but I don't see old PRs/issues."

**Diagnosis steps:**

1. Check if backfill ever ran:
   - Inngest dashboard → search for `apps-backfill/run.orchestrator` with the customer's `installationId`
   - If no runs found → backfill was never triggered (see Scenario 2)

2. Check if orchestrator completed:
   - Find the orchestrator run → check return value
   - `success: true` → all entity types completed. Problem is downstream (observation.capture or Console)
   - `success: false` → check `results` array for which entity types failed
   - Still running → check how long, may be waiting on entity workers

3. Check individual entity workers:
   - Search for `apps-backfill/entity.worker` with same `installationId`
   - Look for failed runs, retries, timeouts

**Resolution:**
- If backfill never ran → manually trigger via `POST /trigger` (see Scenario 7)
- If partial failure → re-trigger backfill. Redis dedup (24h TTL) prevents duplicates for already-dispatched events
- If orchestrator succeeded but data missing → problem is downstream, not backfill

---

## Scenario 2: Backfill Never Started

**Symptoms:** No orchestrator run in Inngest for the customer's connection.

**Cause:** `notifyBackfillService()` in Gateway failed — QStash couldn't deliver to `/trigger`. This is best-effort (errors logged, not blocking).

**Diagnosis:**
- Check Gateway logs for `[connections] Failed to notify backfill service`
- Check QStash dashboard for failed deliveries to `backfill.lightfast.ai/trigger`

**Resolution:**
- Manually trigger: `POST /trigger` with `{ installationId, provider, orgId, depth: 30 }`
- Use the Gateway API key in `X-API-Key` header

---

## Scenario 3: Some Entity Types Failed, Others Succeeded

**Symptoms:** Customer has releases but no PRs, or has PRs but no issues.

**Diagnosis:**
- Find the orchestrator run → check `results` array
- Each entry has `entityType`, `success`, `error`
- Find the failed entity worker runs for details

**Common causes:**
- **Token expiration + refresh failure** → entity worker's 401 retry failed
- **Provider API error** → GitHub/Vercel returned 500 during pagination
- **Rate limiting** → worker timed out (2h) while sleeping on rate limits
- **Connection revoked mid-backfill** → token fetch returns 401/404

**Resolution:**
- Re-trigger the full backfill. The entity workers for already-completed types will re-run, but Gateway's Redis dedup (24h TTL) skips already-dispatched events. Only the missing events get through.
- If more than 24h has passed since the original backfill, some events may be re-processed (duplicated). This is acceptable — the data was missing, and duplicates are less harmful than gaps.

---

## Scenario 4: Worker Failed Mid-Pagination

**Symptoms:** Entity worker processed pages 1-19 but failed on page 20.

**What happened:**
- Pages 1-19 events were dispatched to Gateway → Console. Those observations exist.
- Page 20+ events were never fetched. That data is missing.
- Inngest retried the function 3x. Step memoization means pages 1-19 don't re-execute on retry — only page 20 retries.
- If all 3 retries fail, `onFailure` emits `entity.completed` with `success: false`.
- Orchestrator records the failure immediately (no 4h wait).

**Resolution:**
- Re-trigger the full backfill.
- Pages 1-19 events have deterministic deliveryIds → Gateway Redis dedup skips them.
- Page 20+ events get fetched and dispatched fresh.

---

## Scenario 5: Connection Deleted During Backfill

**What happens automatically:**
1. Gateway's connection teardown workflow runs
2. Step 1: `cancelBackfillService()` sends `POST /trigger/cancel` via QStash
3. Backfill service emits `apps-backfill/run.cancelled`
4. Both orchestrator and entity workers have `cancelOn` matching `installationId`
5. All running functions are cancelled by Inngest

**What if cancellation is slow?**
- Entity workers may attempt token fetches after connection is revoked
- Token fetch returns 401/404 → worker fails → retries exhaust → `onFailure` emits failure completion
- This wastes a few retries but is self-correcting

**Action required:** None. Automatic.

---

## Scenario 6: Customer Re-triggers Backfill

**Within 24 hours of the original backfill:**
- All events have the same deterministic deliveryIds
- Gateway's Redis dedup (SET NX, 24h TTL) skips already-dispatched events
- Only genuinely missing events get through
- Safe and idempotent

**After 24 hours:**
- Redis dedup keys have expired
- All events are re-dispatched and re-processed
- Results in duplicate observations in Console
- Not harmful but wasteful

**Action required:** None for re-triggers within 24h. For re-triggers after 24h, warn the customer that duplicates may occur. DB-level dedup on deliveryId (follow-up work) would eliminate this window entirely.

---

## Scenario 7: Manually Triggering a Backfill

```bash
curl -X POST https://backfill.lightfast.ai/trigger \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $GATEWAY_API_KEY" \
  -d '{
    "installationId": "<gateway-installation-id>",
    "provider": "github",
    "orgId": "<clerk-org-id>",
    "depth": 30
  }'
```

**Parameters:**
- `installationId` — from Gateway's `gw_installations` table
- `provider` — `"github"`, `"vercel"` (Linear/Sentry don't have backfill connectors yet)
- `orgId` — Clerk organization ID
- `depth` — `7`, `30`, or `90` days (default: 30)
- `entityTypes` — optional, defaults to connector's `defaultEntityTypes` (GitHub: `["pull_request", "issue", "release"]`)

**Safety:** Orchestrator concurrency is `1 per installationId` — duplicate triggers queue, they don't run in parallel.

---

## Scenario 8: Customer Wants More History (Depth Extension)

**Example:** Originally backfilled 30 days, now wants 90 days.

**Action:**
- Re-trigger with `depth: 90`
- Events from days 0-30 have same deliveryIds → deduped by Gateway (if within 24h)
- Events from days 30-90 are new → processed normally

**If more than 24h since original backfill:** Days 0-30 events will be re-processed (duplicated). See Scenario 6.

---

## Scenario 9: Dispatch Step Partially Fails

**What happens:**
- `dispatch-pull_request-p5` sends events 1-50 to Gateway successfully
- Event 51 fails (Gateway returns 500)
- Step throws, Inngest retries the entire step
- Events 1-50 are re-dispatched on retry
- Gateway Redis dedup catches events 1-50 as duplicates (returns `{ status: "duplicate" }`)
- Entity worker's `!response.ok` check passes (200 status) — continues
- Events 51-100 dispatched fresh

**Action required:** None. Self-correcting via Redis dedup.

---

## Scenario 10: Rate Limiting Causes Worker Timeout

**Symptoms:** Entity worker timed out after 2 hours, many `rate-limit-*` sleep steps visible.

**What happened:**
- Provider API returned low `X-RateLimit-Remaining`
- Worker dynamically slept until rate limit reset
- Inngest throttle (4000 req/hr per installation) also applied
- Combined delays exceeded 2h worker timeout

**Resolution:**
- Re-trigger. Previously dispatched events dedup. Worker picks up where rate limits allow.
- If this keeps happening, the repo may be too large for a single 2h window. Consider reducing `depth` or contacting Inngest about extending timeout limits.

---

## Scenario 11: New Repo Added to Existing Connection

**Symptoms:** Customer added repo #2 to their GitHub installation. Repo #1 has historical data, repo #2 does not.

**Cause:** Backfill triggers on connection **creation**, not on resource addition. Adding a new repo to an existing installation does not trigger a backfill.

**Resolution:**
- Manually trigger backfill for the installation (Scenario 7)
- The orchestrator reads the current `connection.resources` from Gateway, which now includes repo #2
- Entity workers fan out for all resources — repo #1 events dedup, repo #2 events are new

---

## Quick Reference: When to Re-trigger

| Situation | Action | Dedup safe? |
|---|---|---|
| Backfill never ran | Trigger manually | N/A (first run) |
| Partial entity type failure | Re-trigger full backfill | Yes (within 24h) |
| Worker failed mid-page | Re-trigger full backfill | Yes (within 24h) |
| Customer wants more history | Re-trigger with larger depth | Yes for overlap (within 24h) |
| New repo added | Re-trigger for installation | Yes for existing repo (within 24h) |
| Data missing, cause unknown | Re-trigger full backfill | Yes (within 24h) |

**Default answer when customer reports missing data:** Re-trigger the backfill. Within 24h it's fully idempotent. After 24h, some duplicates may occur but missing data will be filled in.
