# Realistic Sandbox Test Data Implementation Plan

## Overview

Replace the 4 existing fake test datasets (`comprehensive.json`, `performance.json`, `security.json`, `demo-incident.json`) with 3 new `sandbox-N.json` files using realistic Lightfast-based scenarios. This also requires wiring Sentry/Linear mock transformers into the transform router, which is currently broken for those sources.

## Current State Analysis

### Existing Datasets
- `comprehensive.json` (4015 lines, 35 webhooks) - Uses fake repos: `acme/platform`, `test/repo`, `myorg/api`
- `performance.json` (330 lines, 3 webhooks) - Uses `test/api-service`
- `security.json` (407 lines, 3 webhooks) - Uses `test/repo`
- `demo-incident.json` (1409 lines, 15 webhooks) - Uses `acme/platform` with Sentry + Linear + GitHub + Vercel

### Critical Bug
The `transformWebhook()` function at `packages/console-test-data/src/loader/transform.ts:80-93` only handles `"github"` and `"vercel"` sources. The `demo-incident.json` file contains `"sentry"` and `"linear"` webhooks that would crash when loaded. The mock transformers exist at `src/transformers/sentry.ts` and `src/transformers/linear.ts` but are **not wired into the router**.

### Types & Schema Gaps
- `WebhookPayload.source` type at `transform.ts:44` restricts to `"github" | "vercel"`
- `webhook-schema.json:35` restricts `source` enum to `["github", "vercel"]`
- Both must include `"sentry"` and `"linear"`

### Consumer Impact (Low Risk)
- Only 2 hardcoded dataset references:
  - `reset-demo.ts:128` → `loadDataset("demo-incident")`
  - `inject.ts:72` → default `"security"`
- Zero external consumers (no other packages depend on `@repo/console-test-data`)
- `listDatasets()` auto-discovers from filesystem
- No CI/CD pipelines reference dataset names

## Desired End State

After implementation:
1. `packages/console-test-data/datasets/` contains only: `webhook-schema.json`, `sandbox-1.json`, `sandbox-2.json`, `sandbox-3.json`
2. All 4 sources (github, vercel, sentry, linear) are routed correctly in `transformWebhook()`
3. CLI defaults updated to use `sandbox-1`
4. All sandbox datasets use `lightfastai/lightfast` repo, real developer names, real dates (Dec 2025 - Feb 2026)
5. `loadDataset("sandbox-1")` works end-to-end without errors

### Verification
```bash
cd packages/console-test-data
# All datasets load without errors
npx tsx -e "
  const { loadDataset, listDatasets } = require('./src/loader/index.ts');
  const names = listDatasets();
  console.log('Available:', names);
  for (const name of names) {
    const ds = loadDataset(name);
    console.log(name + ':', ds.events.length, 'events');
    for (const e of ds.events) {
      console.log('  -', e.source, e.sourceType, e.title.slice(0, 60));
    }
  }
"
```

### Key Discoveries
- `demo-incident.json` provides the exact Sentry/Linear payload structure to follow (lines 7-56 for Sentry issue, lines 132-221 for Linear issue)
- The Sentry mock transformer expects: `{ action, data: { issue }, installation, actor }` structure
- The Linear mock transformer expects: `{ action, type, data: {...}, webhookTimestamp }` structure
- GitHub/Vercel payloads use production transformers from `@repo/console-webhooks` and must match `@octokit/webhooks-types`
- Vercel payload is nested: outer `{ id, type, createdAt, payload: { deployment, project, team } }`

## What We're NOT Doing

- NOT building production Sentry/Linear webhook connectors (mock transformers are sufficient)
- NOT changing the Inngest workflow pipeline or observation capture logic
- NOT modifying production transformers in `@repo/console-webhooks`
- NOT adding new event types beyond what the transformers already support
- NOT creating a `sandbox-all.json` combined file (can be added later)
- NOT adding unit tests for the datasets (manual verification is sufficient)

## Implementation Approach

Work bottom-up: fix the infrastructure first (transform router), then create the data files, then clean up.

---

## Phase 1: Extend Transform Infrastructure

### Overview
Wire Sentry/Linear mock transformers into the transform router so all 4 source types work. Update types and schema.

### Changes Required:

#### 1. Update `WebhookPayload` type and transform router
**File**: `packages/console-test-data/src/loader/transform.ts`

**Changes**:
- Extend `WebhookPayload.source` to include `"sentry" | "linear"`
- Add Sentry/Linear webhook payload types
- Import mock transformer maps from `../transformers`
- Add `case "sentry"` and `case "linear"` to the switch in `transformWebhook()`
- Add `transformSentryWebhook()` and `transformLinearWebhook()` functions

```typescript
// Updated type
export interface WebhookPayload {
  source: "github" | "vercel" | "sentry" | "linear";
  eventType: string;
  payload: unknown;
}

// New Sentry webhook payload type
export interface SentryWebhookPayload extends WebhookPayload {
  source: "sentry";
  eventType: string; // "issue.created", "error", "event_alert", "metric_alert"
  payload: Record<string, unknown>;
}

// New Linear webhook payload type
export interface LinearWebhookPayload extends WebhookPayload {
  source: "linear";
  eventType: string; // "Issue", "Comment", "Project", "Cycle", "ProjectUpdate"
  payload: Record<string, unknown>;
}
```

The switch in `transformWebhook()` needs two new cases:

```typescript
case "sentry":
  return transformSentryWebhookPayload(
    webhook as SentryWebhookPayload,
    index
  );
case "linear":
  return transformLinearWebhookPayload(
    webhook as LinearWebhookPayload,
    index
  );
```

New functions `transformSentryWebhookPayload()` and `transformLinearWebhookPayload()` will:
1. Look up the transformer function from the exported `sentryTransformers` / `linearTransformers` maps
2. Call it with `webhook.payload`
3. Append `:test:${index}` to `sourceId`
4. Add `testData: true` to metadata

For Sentry: the key is `webhook.eventType` (e.g. `"issue.created"`) which maps directly to `sentryTransformers["issue.created"]`.

For Linear: the key is `webhook.eventType` (e.g. `"Issue"`) which maps to `linearTransformers["Issue"]`. The Linear transformer also needs the `action` from `webhook.payload.action`.

#### 2. Update webhook schema
**File**: `packages/console-test-data/datasets/webhook-schema.json`

**Changes**: Add `"sentry"` and `"linear"` to the `source` enum, and add their event types to `eventType.oneOf`:

```json
"source": {
  "type": "string",
  "enum": ["github", "vercel", "sentry", "linear"],
  "description": "Webhook source platform"
},
"eventType": {
  "type": "string",
  "description": "Event type identifier",
  "oneOf": [
    {
      "enum": ["push", "pull_request", "issues", "release", "discussion"],
      "description": "GitHub event types"
    },
    {
      "enum": [
        "deployment.created",
        "deployment.succeeded",
        "deployment.ready",
        "deployment.canceled",
        "deployment.error",
        "deployment.check-rerequested"
      ],
      "description": "Vercel event types"
    },
    {
      "enum": [
        "issue.created",
        "issue.resolved",
        "issue.assigned",
        "issue.ignored",
        "error",
        "event_alert",
        "metric_alert"
      ],
      "description": "Sentry event types"
    },
    {
      "enum": ["Issue", "Comment", "Project", "Cycle", "ProjectUpdate"],
      "description": "Linear event types"
    }
  ]
}
```

#### 3. Update loader re-exports
**File**: `packages/console-test-data/src/loader/index.ts`

**Changes**: Add `SentryWebhookPayload` and `LinearWebhookPayload` to the re-exports at line 119:

```typescript
export type {
  WebhookPayload,
  GitHubEventType,
  VercelEventType,
  SentryWebhookPayload,
  LinearWebhookPayload,
} from "./transform.js";
```

### Success Criteria:

#### Automated Verification:
- [x] TypeScript compiles: `pnpm --filter @repo/console-test-data typecheck` (or `pnpm typecheck` from root)
- [x] Existing `demo-incident.json` loads without crash: test via `npx tsx` one-liner
- [x] All 4 source types produce valid `SourceEvent` objects with correct `source`, `sourceType`, `sourceId` fields

#### Manual Verification:
- [ ] Confirm Sentry events have proper title format like `[created] TypeError: ...`
- [ ] Confirm Linear events have proper title format like `[created] LIN-892: ...`
- [ ] Confirm `:test:N` suffix appears on all sourceIds
- [ ] Confirm `testData: true` in metadata for all events

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Create sandbox-1.json (Production Incident)

### Overview
Create the Pinecone embedding dimension mismatch incident storyline with 18 cross-source webhooks across Sentry, Linear, GitHub, and Vercel.

### Changes Required:

#### 1. Create sandbox-1.json
**File**: `packages/console-test-data/datasets/sandbox-1.json`

**Scenario**: A workspace embedding config is upgraded to 1536-dim Cohere model, but the Pinecone index still uses 1024-dim vectors. Observation capture fails, search goes stale, team detects via Sentry, creates Linear issue, ships hotfix, deploys.

**Timeline (18 webhooks):**

| # | Time | Source | eventType | Key Details |
|---|------|--------|-----------|-------------|
| 1 | Feb 4, 09:15 | sentry | error | `PineconeError: Vector dimension 1536 does not match index dimension 1024` in `observation-capture.ts` |
| 2 | Feb 4, 09:20 | sentry | issue.created | NEURAL-847: Grouped embedding dimension errors, 34 errors, 1 workspace |
| 3 | Feb 4, 09:25 | sentry | event_alert | "High Error Volume - Neural Pipeline" triggered |
| 4 | Feb 4, 09:30 | sentry | metric_alert | "Observation Capture Success Rate" dropped below 50% |
| 5 | Feb 4, 09:45 | linear | Issue (create) | LF-412: "Critical: Observation pipeline failing - dimension mismatch", Priority 1 |
| 6 | Feb 4, 10:00 | linear | Comment (create) | Root cause: settings migration didn't include Pinecone re-index |
| 7 | Feb 4, 10:15 | github | issues (opened) | #361: "Embedding dimension mismatch after workspace settings migration" |
| 8 | Feb 4, 10:30 | linear | Issue (update) | LF-412 moved to "In Progress" |
| 9 | Feb 4, 11:00 | github | pull_request (opened) | #362: "fix(neural): validate embedding dimensions before Pinecone upsert" |
| 10 | Feb 4, 12:00 | github | pull_request (closed/merged) | #362 merged by jeevanpillay |
| 11 | Feb 4, 12:05 | github | push | Merge commit to main |
| 12 | Feb 4, 12:10 | vercel | deployment.created | Building lightfast-console |
| 13 | Feb 4, 12:15 | vercel | deployment.succeeded | Production deployment ready |
| 14 | Feb 4, 12:30 | sentry | issue.resolved | NEURAL-847 resolved via commit |
| 15 | Feb 4, 12:45 | linear | Issue (update) | LF-412 marked Done, linked to PR #362 |
| 16 | Feb 4, 12:50 | github | issues (closed) | #361 closed |
| 17 | Feb 4, 13:00 | linear | Comment (create) | Post-incident summary with timeline |
| 18 | Feb 4, 13:05 | linear | ProjectUpdate (create) | Neural Memory v1 project update: incident resolved |

**Shared constants across all webhooks:**
- Repo: `lightfastai/lightfast` (id: `901234567`)
- Org: `lightfastai` (id: `88881234`)
- Developer: `jeevanpillay` (id: `7654321`)
- Sentry project: `lightfast-console` (slug: `lightfast-console`)
- Linear team: `LF` / Console
- Linear project: Neural Memory v1
- Vercel project: `lightfast-console` / `prj_lightfast_console`
- Vercel team: `lightfastai` / `team_lightfastai`

**Cross-references to maintain:**
- Sentry issue `NEURAL-847` referenced in Linear LF-412 description and GitHub #361 body
- Linear `LF-412` referenced in GitHub #361 body and PR #362 body
- GitHub #361 referenced in PR #362 body (Fixes #361)
- PR #362 merge commit SHA shared between push event and Vercel deployment meta
- Sentry resolved `statusDetails.inCommit` references the merge commit SHA

### Success Criteria:

#### Automated Verification:
- [x] `loadDataset("sandbox-1")` returns 18 events without errors
- [x] All events have valid `source` field (github, vercel, sentry, or linear)
- [x] All events have non-empty `title`, `body`, `sourceId`
- [x] TypeScript compiles cleanly

#### Manual Verification:
- [ ] Cross-source references are consistent (same SHA, issue numbers, identifiers)
- [ ] Timeline flows chronologically (09:15 → 13:05)
- [ ] Error messages are realistic for Lightfast architecture

**Implementation Note**: Pause for manual review of the incident storyline before proceeding.

---

## Phase 3: Create sandbox-2.json (Feature Development)

### Overview
Create the Answer API + workspace rework feature development lifecycle based on actual PR #352/#353 history from Feb 5-6, 2026.

**Timeline (~16 webhooks):**

| # | Time | Source | eventType | Key Details |
|---|------|--------|-----------|-------------|
| 1 | Feb 5, 22:34 | github | push | `feat(console): add relationship graph for cross-source intelligence` |
| 2 | Feb 6, 12:28 | github | push | `feat(console): add strict relationship detection with Linear/Sentry transformers` |
| 3 | Feb 6, 12:34 | github | pull_request (opened) | #352: "feat(console): add strict relationship detection" |
| 4 | Feb 6, 12:34 | github | pull_request (closed/merged) | #352 merged |
| 5 | Feb 6, 14:02 | github | push | `feat(console): complete useToast to Sonner migration` |
| 6 | Feb 6, 15:37 | github | push | `refactor(api): extract dual auth logic into reusable middleware` |
| 7 | Feb 6, 15:46 | github | push | `feat(console): add answer API with AI runtime and tools` |
| 8 | Feb 6, 15:46 | vercel | deployment.created | Preview: feat/search-answer-workspace-rework |
| 9 | Feb 6, 15:50 | vercel | deployment.succeeded | Preview ready |
| 10 | Feb 6, 17:31 | github | push | `feat(console): enhance answer interface with new components and tools` |
| 11 | Feb 6, 21:07 | github | push | `refactor(console): decompose workspace search into modular components` |
| 12 | Feb 6, 22:24 | github | push | `fix(console): resolve lint and type errors for successful build` |
| 13 | Feb 6, 22:49 | github | pull_request (opened) | #353: "feat(console): search-answer-workspace-rework" |
| 14 | Feb 6, 22:49 | github | pull_request (closed/merged) | #353 merged |
| 15 | Feb 6, 22:55 | vercel | deployment.created | Production: main branch |
| 16 | Feb 6, 23:00 | vercel | deployment.succeeded | Production deployed |

Additionally, include 3-4 Linear webhooks for sprint tracking:
- Linear Cycle update: Sprint 3 progress 75% → 90%
- Linear Issue update: LF-398 "Implement answer interface" → Done
- Linear Issue update: LF-399 "Workspace search refactor" → Done
- Linear ProjectUpdate: "Search & Answer milestone: all 5 tickets shipped"

**Shared constants**: Same repo/org/developer as sandbox-1. All GitHub pushes use branch `feat/search-answer-workspace-rework` except the merge commits.

### Success Criteria:

#### Automated Verification:
- [x] `loadDataset("sandbox-2")` returns ~20 events without errors
- [x] All events have valid fields
- [x] TypeScript compiles cleanly

#### Manual Verification:
- [x] Commit messages match research doc (real git history)
- [x] PR numbers are correct (#352, #353)
- [x] Vercel deployments reference correct branches and commit SHAs
- [x] Linear sprint progress makes sense

**Implementation Note**: Pause for manual review before proceeding.

---

## Phase 4: Create sandbox-3.json (Infrastructure & Security)

### Overview
Create the infrastructure, security, and observability dataset spanning Dec 2025 - Feb 2026 based on actual commit history.

**Timeline (~20 webhooks):**

| # | Date | Source | eventType | Key Details |
|---|------|--------|-----------|-------------|
| 1 | Dec 6, 16:40 | github | push | `fix(security): update Next.js and React to patch CVE-2025-55182` |
| 2 | Dec 11, 23:45 | github | push | `feat: implement raw webhook payload storage for permanent retention` |
| 3 | Dec 12, 16:39 | github | push | `feat(neural): Day 2 search with metadata filters and LLM gating` |
| 4 | Dec 13, 12:46 | github | push | `feat(neural): implement Day 5 multi-view embeddings and 4-path retrieval` |
| 5 | Dec 14, 12:14 | github | push | `refactor(console-test-data): use raw webhooks with production transformers` |
| 6 | Dec 14, 12:13 | github | push | `feat(webhooks): implement security hardening with validation and sanitization` |
| 7 | Dec 15, 19:34 | github | push | `feat(db): migrate high-volume tables to BIGINT primary keys` |
| 8 | Dec 15, 22:13 | github | push | `feat(auth): add Clerk API caching for organization membership lookups` |
| 9 | Dec 16, 22:16 | github | push | `feat(api-keys): unify API key format to sk-lf- with 256-bit entropy` |
| 10 | Dec 16, 20:00 | github | push | `feat(neural): implement cross-source actor resolution and identity linking` |
| 11 | Dec 17, 11:12 | github | push | `feat(neural): integrate Braintrust + step.ai.wrap() for AI observability` |
| 12 | Dec 17, 13:10 | github | push | `feat(neural): add actor_resolution and cluster_affinity analytics metrics` |
| 13 | Dec 24, 11:17 | github | pull_request (closed/merged) | #343: `perf(early-access): optimize Redis and rate limiting` |
| 14 | Jan 22, 12:39 | github | push | `feat(ci): add GitHub Action for PlanetScale database migrations` |
| 15 | Jan 22, 13:57 | github | push | `feat(docs): migrate search to Mixedbread native integration` |
| 16 | Jan 29, 13:34 | github | pull_request (closed/merged) | #350: `feat(www): upgrade to Next.js 16 with pnpm named catalogs` |
| 17 | Feb 7, 14:33 | github | pull_request (closed/merged) | #358: `fix: enable env validation on Vercel production builds` |
| 18-20 | Various | vercel | deployment.succeeded | Production deployments for key merges (#343, #350, #358) |

Additionally, include 2-3 Sentry/Linear entries:
- Sentry metric_alert: Search latency improvement detected (resolved)
- Linear Cycle update: Neural Memory Phase 1 cycle completion
- Linear ProjectUpdate: Infrastructure milestone summary

### Success Criteria:

#### Automated Verification:
- [x] `loadDataset("sandbox-3")` returns ~23 events without errors
- [x] All events have valid fields
- [x] TypeScript compiles cleanly

#### Manual Verification:
- [x] Commit messages and dates match actual git history
- [x] PR numbers (#343, #350, #358) are correct
- [ ] 3-month timeline (Dec 2025 - Feb 2026) flows chronologically
- [ ] Mix of GitHub-heavy + some Vercel/Sentry/Linear feels realistic

**Implementation Note**: Pause for manual review before proceeding.

---

## Phase 5: Clean Up & Update References

### Overview
Delete old datasets, update CLI defaults, update README.

### Changes Required:

#### 1. Delete old dataset files
```
packages/console-test-data/datasets/comprehensive.json  → DELETE
packages/console-test-data/datasets/performance.json     → DELETE
packages/console-test-data/datasets/security.json        → DELETE
packages/console-test-data/datasets/demo-incident.json   → DELETE
```

#### 2. Update reset-demo.ts default
**File**: `packages/console-test-data/src/cli/reset-demo.ts`

**Change at line 128**: `loadDataset("demo-incident")` → `loadDataset("sandbox-1")`
**Change at line 143**: Update search suggestion from `'checkout TypeError'` to `'Pinecone dimension mismatch'`

#### 3. Update inject.ts default
**File**: `packages/console-test-data/src/cli/inject.ts`

**Change at line 72**: Default scenario from `"security"` → `"sandbox-1"`

#### 4. Update README.md
**File**: `packages/console-test-data/README.md`

**Changes**:
- Update dataset table to list `sandbox-1`, `sandbox-2`, `sandbox-3`
- Update CLI examples to use sandbox names
- Add Sentry/Linear to supported event types section
- Update architecture diagram to show all 4 sources
- Update custom dataset example to show Sentry/Linear payloads
- Update package structure to show new file names

### Success Criteria:

#### Automated Verification:
- [x] No references to old dataset names in source code: `grep -r "comprehensive\|performance\|security\|demo-incident" packages/console-test-data/src/`
- [x] `listDatasets()` returns `["sandbox-1", "sandbox-2", "sandbox-3"]`
- [x] `loadAllDatasets()` loads all events without errors
- [x] `balancedScenario(10)` works (draws from all sandbox datasets)
- [x] TypeScript compiles: `pnpm typecheck`
- [x] Lint passes (0 errors in files we created/modified; pre-existing errors in sentry.ts/linear.ts)

#### Manual Verification:
- [x] README accurately reflects new dataset structure
- [x] CLI help text shows correct defaults
- [x] Old files are gone from git working tree

---

## Testing Strategy

### Integration Tests (Manual):
1. Run `pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s sandbox-1` and verify events are triggered
2. Run `pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s sandbox-2` and verify events are triggered
3. Run `pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s sandbox-3` and verify events are triggered
4. Run `pnpm --filter @repo/console-test-data inject -- -w <workspace_id> -s balanced -c 10` and verify mixed events
5. Run `pnpm --filter @repo/console-test-data reset-demo -- -w <workspace_id> -i` and verify it uses sandbox-1

### Smoke Tests (Automated, run after each phase):
```bash
# Quick validation script
npx tsx -e "
  const { loadDataset, listDatasets } = require('./src/loader');
  for (const name of listDatasets()) {
    const ds = loadDataset(name);
    console.log(name, ds.events.length, 'events');
    ds.events.forEach((e, i) => {
      if (!e.source || !e.sourceType || !e.sourceId || !e.title) {
        throw new Error(name + ' event ' + i + ' missing fields');
      }
    });
  }
  console.log('All datasets valid');
"
```

## Performance Considerations

- Sandbox datasets are larger than old ones (~18-23 webhooks each vs 3-35)
- Total across all 3: ~60 webhooks, comparable to old `comprehensive.json` (35) + others
- `balancedScenario()` and `stressScenario()` load all datasets, so more data loaded
- No performance concern: these are small JSON files loaded synchronously at dev time

## References

- Research document: `thoughts/shared/research/2026-02-07-realistic-sandbox-test-data-design.md`
- Demo script: `thoughts/shared/plans/2026-02-05-accelerator-demo-script.md`
- Existing demo-incident.json payload structure (template for Sentry/Linear payloads)
- Production transformers: `packages/console-webhooks/src/transformers/github.ts`, `vercel.ts`
- Mock transformers: `packages/console-test-data/src/transformers/sentry.ts`, `linear.ts`
