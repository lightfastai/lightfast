# Webhook Schemas Package — Implementation Plan

## Overview

Create `@repo/webhook-schemas` — a monorepo package that captures real webhook payloads from the DB, validates them against Lightfast's Zod schemas, and reports field coverage. The primary goal is answering the open questions from the [Vercel→GitHub linking research](../research/2026-04-09-vercel-deployment-github-pr-linking-gaps.md): Is `meta.githubPrId` reliable? What type is it? Which `meta.github*` fields are always present?

## Current State Analysis

**Data source**: `lightfast_gateway_webhook_deliveries` table stores raw JSON-stringified payloads for all webhook deliveries (`db/app/src/schema/tables/gateway-webhook-deliveries.ts:30`). Columns: `provider` (varchar), `event_type` (varchar), `payload` (text, nullable), `status` (varchar), `received_at` (timestamptz).

**Existing Zod schemas** in `@repo/app-providers`:
- Vercel: `preTransformVercelWebhookPayloadSchema` — parses `deployment.meta.github*` fields but the transformer discards `githubPrId`, `githubCommitAuthorName`, `githubCommitAuthorLogin`, `githubCommitRepoId`, `githubRepoId`, `githubRepoOwnerType` (`vercel/transformers.ts`)
- GitHub: `preTransformGitHubPullRequestEventSchema`, `preTransformGitHubIssuesEventSchema`, `preTransformGitHubIssueCommentEventSchema` — all hand-authored, no upstream validation against official schemas

**Important Zod v4 behavior**: The `meta` object in `preTransformVercelWebhookPayloadSchema` is a plain `z.object()` (default strip mode) — it silently drops any keys not in the schema. The outer `payload` and `deployment` objects use `.loose()` which preserves unknown keys. This means the validate script will **definitely** find dropped fields at the `meta` level — this is a known outcome, not a discovery. The value of validation is quantifying exactly which `meta.github*` fields exist in real payloads but are missing from the schema definition. Similarly, all three GitHub `preTransform*` schemas use plain `z.object()` throughout (no `.loose()`), so they also strip unknown fields.

**Zod v4 object modes** (confirmed via spike):
| Mode | Unknown keys | Behavior |
|------|-------------|----------|
| `z.object({...})` (default) | **Stripped silently** | Keys removed from output, no error |
| `z.object({...}).strict()` | **Rejected** | `ZodError` with `unrecognized_keys` code |
| `z.object({...}).loose()` / `.passthrough()` | **Preserved** | Keys pass through unchanged |

**Upstream schema availability**:
- Vercel: **Nothing exists**. No official schema, no SDK types, no community package. The `meta.github*` fields are undocumented internals.
- GitHub: Official schemas exist (`@octokit/webhooks-schemas`) but we don't use them — our DB has real payloads which are the ground truth.

### Key Discoveries

- `gateway_webhook_deliveries.payload` stores `JSON.stringify(parsedPayload)` at ingress time (`apps/platform/src/app/api/ingest/[provider]/route.ts:174`) — this is post-loose-schema-parse but pre-transform, so extra fields pass through via `.loose()`
- DB access via `import { db } from "@db/app/client"` + `import { gatewayWebhookDeliveries } from "@db/app/schema"` — requires `DATABASE_HOST`, `DATABASE_USERNAME`, `DATABASE_PASSWORD` env vars
- Monorepo packages are source-only (no build step), exports point at `./src/*.ts`, run scripts via `pnpm tsx`
- Package naming convention: `@repo/webhook-schemas` under `packages/webhook-schemas/`

## Desired End State

A `packages/webhook-schemas/` package containing:

```
packages/webhook-schemas/
├── package.json
├── tsconfig.json
├── fixtures/
│   ├── github/
│   │   ├── pull_request.opened.json
│   │   ├── pull_request.closed.json
│   │   ├── issues.opened.json
│   │   ├── issues.closed.json
│   │   ├── issue_comment.created.json
│   │   └── ...
│   └── vercel/
│       ├── deployment.created.json
│       ├── deployment.succeeded.json
│       ├── deployment.ready.json
│       ├── deployment.error.json
│       └── ...
└── src/
    ├── capture.ts
    ├── validate.ts
    └── report.ts
```

**Verification**: Run all three scripts successfully:
1. `capture.ts` pulls real payloads from DB and writes sanitized fixtures
2. `validate.ts` parses all fixtures through Lightfast Zod schemas, reports pass/fail per field
3. `report.ts` answers the research questions — field presence, types, and coverage for Vercel `meta.github*`

## What We're NOT Doing

- No CI workflow — this is a dev tool for answering specific questions, CI drift detection comes later
- No `schemas/` directory — schemas are in `@repo/app-providers`, this package validates them against real data
- No `types/` directory — types live in the monorepo's Zod schemas, this package validates them
- No Linear or Sentry providers — GitHub + Vercel only for now
- No changes to the existing transformers — that's the follow-up work after we have answers
- No webhook capture proxy / live interception — all data comes from the DB

## Implementation Approach

Three scripts, each runnable independently via `pnpm tsx`. The capture script seeds the fixtures directory from real DB data. The validate script checks those fixtures against Lightfast's Zod schemas. The report script analyzes the Vercel fixtures specifically to answer the cross-provider linking research questions.

---

## Phase 1: Package Scaffolding [DONE]

### Overview

Create the `@repo/webhook-schemas` package with minimal configuration following monorepo conventions.

### Changes Required

#### 1. Package Configuration

**File**: `packages/webhook-schemas/package.json`

```json
{
  "name": "@repo/webhook-schemas",
  "version": "0.1.0",
  "private": true,
  "license": "FSL-1.1-Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "scripts": {
    "with-env": "dotenv -e ../../apps/app/.vercel/.env.development.local --",
    "capture": "pnpm with-env tsx src/capture.ts",
    "validate": "tsx src/validate.ts",
    "report": "tsx src/report.ts",
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@db/app": "workspace:*",
    "@repo/app-providers": "workspace:*",
    "drizzle-orm": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "dotenv-cli": "^8.0.0",
    "tsx": "catalog:",
    "typescript": "catalog:"
  }
}
```

**File**: `packages/webhook-schemas/tsconfig.json`

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

#### 2. Empty Fixture Directories

Create `packages/webhook-schemas/fixtures/github/.gitkeep` and `packages/webhook-schemas/fixtures/vercel/.gitkeep` to ensure the directories are tracked before capture runs.

### Success Criteria

#### Automated Verification

- [x] `pnpm install` completes without errors (workspace resolution works)
- [x] `cd packages/webhook-schemas && pnpm typecheck` passes (once src files exist)

#### Manual Verification

- [x] `packages/webhook-schemas/` appears in workspace with correct name

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Capture Script [DONE]

### Overview

Build `src/capture.ts` — queries `gateway_webhook_deliveries` for real payloads, sanitizes PII, and writes one fixture file per `{event_type}.{action}.json`.

### Changes Required

#### 1. Capture Script

**File**: `packages/webhook-schemas/src/capture.ts`

The script:

1. **Queries the DB** for rows where `payload IS NOT NULL`, grouped by `(provider, event_type)`:

```typescript
import { db } from "@db/app/client";
import { gatewayWebhookDeliveries } from "@db/app/schema";
import { isNotNull, eq, and, sql } from "drizzle-orm";

const rows = await db
  .select({
    provider: gatewayWebhookDeliveries.provider,
    eventType: gatewayWebhookDeliveries.eventType,
    payload: gatewayWebhookDeliveries.payload,
    receivedAt: gatewayWebhookDeliveries.receivedAt,
  })
  .from(gatewayWebhookDeliveries)
  .where(
    and(
      isNotNull(gatewayWebhookDeliveries.payload),
      sql`${gatewayWebhookDeliveries.provider} IN ('github', 'vercel')`
    )
  )
  .orderBy(gatewayWebhookDeliveries.receivedAt)
  .limit(100);
```

2. **Groups by provider + event action** — for GitHub, the action is `payload.action` (e.g., `opened`, `closed`). For Vercel, the action comes from the top-level `type` field split on `.` (e.g., `deployment.created` → action is `created`). Uses the first payload per group (oldest, most representative).

3. **Sanitizes PII** — replaces sensitive fields with safe placeholders while preserving structure and types:

```typescript
function sanitize(provider: string, payload: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(payload);
  // Recursively walk and replace PII fields
  walk(clone, (key, value) => {
    if (key === "avatar_url") return "https://avatars.githubusercontent.com/u/0";
    if (key === "email") return "redacted@example.com";
    // For user objects: keep login but redact if it's in author/committer context
    if (key === "name" && isAuthorContext(parent)) return "Redacted User";
    return value;
  });
  return clone;
}
```

   **What to redact** (preserving types):
   | Field path | Replace with |
   |---|---|
   | `*.avatar_url` | `"https://avatars.githubusercontent.com/u/0"` |
   | `*.email` (in author/committer objects) | `"redacted@example.com"` |
   | `commits[].author.name`, `commits[].committer.name` | `"Redacted User"` |
   | `deployment.meta.githubCommitAuthorName` | `"Redacted User"` |

   **What to keep** (critical for validation):
   - All `meta.github*` fields except author name (SHAs, branch names, PR IDs, repo names, org names)
   - All event structure (action, type, id, timestamps)
   - User logins (team's own GH usernames, low sensitivity in private repo)
   - Repository names and IDs
   - Deployment URLs, IDs, states

4. **Writes fixtures** — one JSON file per unique `{provider}/{eventCategory}.{action}.json`:

```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const fixturesDir = join(import.meta.dirname, "..", "fixtures");

for (const [key, payload] of grouped) {
  const [provider, eventAction] = key.split(":");
  const dir = join(fixturesDir, provider);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${eventAction}.json`),
    JSON.stringify(payload, null, 2) + "\n"
  );
}
```

**File naming examples**:
- `fixtures/github/pull_request.opened.json`
- `fixtures/github/pull_request.closed.json`
- `fixtures/github/issues.opened.json`
- `fixtures/github/issue_comment.created.json`
- `fixtures/vercel/deployment.created.json`
- `fixtures/vercel/deployment.succeeded.json`
- `fixtures/vercel/deployment.ready.json`

5. **Prints summary** — how many fixtures written per provider, and which event types had no payloads.

**Running**: From the monorepo root:
```bash
cd packages/webhook-schemas && pnpm capture
```

The `capture` script uses the `with-env` pattern (same as `@repo/app-test-data`) — `dotenv-cli` loads env vars from `apps/app/.vercel/.env.development.local` before `tsx` runs. No `dotenv` import in source code — env loading is handled entirely by the package script.

### Success Criteria

#### Automated Verification

- [x] `cd packages/webhook-schemas && pnpm typecheck` passes
- [x] Script compiles and runs without import errors

#### Manual Verification

- [ ] Running `pnpm capture` writes fixture files to `fixtures/github/` and `fixtures/vercel/`
- [ ] Fixtures are valid JSON and match expected event structures
- [ ] No real email addresses, passwords, or tokens in fixture files
- [ ] At least 1 Vercel deployment fixture exists with `meta.github*` fields present

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Validate Script [DONE]

### Overview

Build `src/validate.ts` — loads all fixtures and parses each through the matching `preTransform*` Zod schema from `@repo/app-providers`. Reports pass/fail per fixture and which fields are dropped by schema parsing.

### Changes Required

#### 1. Validate Script

**File**: `packages/webhook-schemas/src/validate.ts`

The script:

1. **Loads all fixture files** from `fixtures/{provider}/*.json`
2. **Maps each fixture to its Zod schema** based on provider and event type:

```typescript
import {
  preTransformVercelWebhookPayloadSchema,
  preTransformGitHubPullRequestEventSchema,
  preTransformGitHubIssuesEventSchema,
  preTransformGitHubIssueCommentEventSchema,
} from "@repo/app-providers";

function getSchema(provider: string, eventType: string) {
  if (provider === "vercel") return preTransformVercelWebhookPayloadSchema;
  if (provider === "github") {
    if (eventType.startsWith("pull_request")) return preTransformGitHubPullRequestEventSchema;
    if (eventType.startsWith("issues")) return preTransformGitHubIssuesEventSchema;
    if (eventType.startsWith("issue_comment")) return preTransformGitHubIssueCommentEventSchema;
  }
  return null;
}
```

3. **Parses with `.safeParse()`** and reports results:

```typescript
for (const fixture of fixtures) {
  const schema = getSchema(fixture.provider, fixture.eventType);
  if (!schema) { console.log(`⚠ No schema for ${fixture.path}`); continue; }

  const result = schema.safeParse(fixture.data);
  if (result.success) {
    // Compare input keys vs output keys to find dropped fields
    const inputKeys = deepKeys(fixture.data);
    const outputKeys = deepKeys(result.data);
    const dropped = inputKeys.filter(k => !outputKeys.has(k));
    console.log(`✓ ${fixture.path} — ${dropped.length} fields dropped by schema`);
    if (dropped.length > 0) console.log(`  Dropped: ${dropped.join(", ")}`);
  } else {
    console.log(`✗ ${fixture.path} — PARSE FAILED`);
    for (const issue of result.error.issues) {
      console.log(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }
}
```

4. **Prints summary table** — total fixtures, pass count, fail count, total dropped fields.

**Running**:
```bash
cd packages/webhook-schemas && pnpm validate
```

No DB connection needed — reads only from local fixture files.

### Success Criteria

#### Automated Verification

- [x] `cd packages/webhook-schemas && pnpm typecheck` passes
- [x] Script runs without import errors

#### Manual Verification

- [ ] All GitHub fixtures parse successfully through their respective schemas
- [ ] All Vercel fixtures parse successfully through the deployment schema
- [ ] Output clearly shows which fields in real payloads are dropped by `.loose()` passthrough vs schema-defined fields
- [ ] Vercel fixtures show that `meta.githubPrId` passes schema validation (it's defined as `z.string().optional()`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Report Script [DONE]

### Overview

Build `src/report.ts` — the key deliverable. Analyzes Vercel deployment fixtures to answer the specific research questions about `meta.github*` field presence and types. Also reports GitHub field coverage from real DB payloads.

### Changes Required

#### 1. Report Script

**File**: `packages/webhook-schemas/src/report.ts`

The script analyzes committed fixtures (real DB data) to answer research questions:

**Section A — Vercel `meta.github*` Field Analysis**:

For each Vercel deployment fixture, extract and tabulate:

```
┌─────────────────────────────┬──────────┬───────────┬──────────────────────┐
│ Field                       │ Present  │ Type      │ Example Value        │
├─────────────────────────────┼──────────┼───────────┼──────────────────────┤
│ meta.githubCommitSha        │ ✓        │ string    │ "abc123..."          │
│ meta.githubCommitRef        │ ✓        │ string    │ "feat/branch-name"   │
│ meta.githubPrId             │ ✓        │ string    │ "42"                 │
│ meta.githubOrg              │ ✓        │ string    │ "lightfastai"        │
│ meta.githubRepo             │ ✓        │ string    │ "lightfast"          │
│ meta.githubRepoId           │ ✗        │ -         │ -                    │
│ ...                         │          │           │                      │
└─────────────────────────────┴──────────┴───────────┴──────────────────────┘
```

Then answer each research question directly:

```typescript
const questions = [
  {
    q: "Is meta.githubPrId always present on deployments?",
    answer: () => {
      const total = vercelFixtures.length;
      const withPrId = vercelFixtures.filter(f => f.payload.deployment?.meta?.githubPrId).length;
      return `${withPrId}/${total} fixtures have githubPrId`;
    },
  },
  {
    q: "Is meta.githubPrId a PR number or PR node ID?",
    answer: () => {
      // Check if values are small integers (PR numbers) or large alphanumeric (node IDs)
      const values = vercelFixtures.map(f => f.payload.deployment?.meta?.githubPrId).filter(Boolean);
      const allSmallInts = values.every(v => /^\d+$/.test(v) && parseInt(v) < 100000);
      return allSmallInts ? "PR number (small integer as string)" : "Unclear — see values";
    },
  },
  {
    q: "Does meta.githubCommitSha match GitHub PR head.sha format?",
    answer: () => {
      const shas = vercelFixtures.map(f => f.payload.deployment?.meta?.githubCommitSha).filter(Boolean);
      const allFull = shas.every(s => /^[a-f0-9]{40}$/.test(s));
      return allFull ? "Yes — full 40-char hex SHA" : "Mixed formats";
    },
  },
  {
    q: "Are there deployments with githubCommitSha but no githubPrId?",
    answer: () => {
      const withShaNopr = vercelFixtures.filter(f => {
        const meta = f.payload.deployment?.meta;
        return meta?.githubCommitSha && !meta?.githubPrId;
      });
      return `${withShaNopr.length} fixtures have SHA but no PR ID (likely direct-push deploys)`;
    },
  },
];
```

**Section B — GitHub Field Coverage**:

For each GitHub fixture, report which fields from the raw payload are captured by the `preTransform*` schemas vs dropped. This uses the same `deepKeys` diff technique as the validate script but presents results grouped by field category (identifiers, timestamps, user objects, metadata).

**Running**:
```bash
cd packages/webhook-schemas && pnpm report
```

### Success Criteria

#### Automated Verification

- [x] `cd packages/webhook-schemas && pnpm typecheck` passes
- [x] Script runs without errors

#### Manual Verification

- [ ] Vercel field presence table renders correctly for all `meta.github*` fields
- [ ] Each research question gets a concrete answer based on real data
- [ ] The answers are sufficient to decide whether to add `commit` and `pr` relations to the Vercel transformer
- [ ] GitHub field coverage report shows which real payload fields our schemas capture vs drop

**Implementation Note**: After completing this phase, review the report output. The answers determine the next step: updating the Vercel and GitHub transformers to emit `commit` and `pr` relations for cross-provider entity linking.

---

## Testing Strategy

### Unit Tests

None — this is a dev tooling package, not a library. The scripts are the tests.

### Integration Tests

None — the scripts themselves are integration tests (they query the DB and validate real data).

### Manual Testing Steps

1. Run `pnpm capture` and verify fixture files are written with correct structure
2. Run `pnpm validate` and verify all fixtures pass Zod schema parsing
3. Run `pnpm report` and verify the Vercel `meta.github*` analysis answers all research questions
4. Spot-check a Vercel fixture file to confirm `githubPrId` presence and type

## Performance Considerations

- The capture script queries with `LIMIT 100` to avoid pulling the full table. If more event type coverage is needed, increase the limit or add a date range filter.
- Fixture files are small (individual JSON payloads, typically 2-10 KB each). No storage concerns.

## Migration Notes

None — this is a new package with no existing consumers.

## References

- Research: `thoughts/shared/research/2026-04-09-vercel-deployment-github-pr-linking-gaps.md`
- Vercel schemas: `packages/app-providers/src/providers/vercel/schemas.ts`
- GitHub schemas: `packages/app-providers/src/providers/github/schemas.ts`
- DB table: `db/app/src/schema/tables/gateway-webhook-deliveries.ts`
- DB client: `db/app/src/client.ts`
- Vercel transformer: `packages/app-providers/src/providers/vercel/transformers.ts`
- GitHub transformer: `packages/app-providers/src/providers/github/transformers.ts`
- Data source: real webhook payloads from `gateway_webhook_deliveries` DB table (ground truth, not upstream schemas)

---

## Improvement Log

Changes made during adversarial review (2026-04-09):

### Fixed: dotenv convention violation
**Before**: Plan proposed `import { config } from "dotenv"` in `capture.ts` to load env vars.
**After**: Uses `dotenv-cli` via `with-env` script alias in `package.json`, matching the established pattern in `@repo/app-test-data`. No dotenv import in source code. Added `dotenv-cli` to `devDependencies`.
**Why**: The codebase never imports dotenv in TypeScript source — it exclusively uses `dotenv-cli` as a CLI wrapper via package scripts.

### Fixed: Missing LIMIT on DB query
**Before**: Query had no limit, risking slow/OOM on large tables.
**After**: Added `.limit(100)` to the capture query.
**Why**: 100 rows provides sufficient event type coverage. Can be increased if needed.

### Fixed: Documented Zod v4 strict/loose behavior
**Before**: Plan's "Current State Analysis" implied `.loose()` preserved all fields through the schema chain. This conflated the relay-level schema (which does use `.loose()` everywhere) with the `preTransform*` schemas (which use default strip mode on nested objects like `meta`).
**After**: Added explicit documentation of the two-level schema distinction and Zod v4's three object modes. The validate script will find dropped fields — this is now a known/expected outcome, not a discovery.
**Why**: The `meta` object in `preTransformVercelWebhookPayloadSchema` is a plain `z.object()` (strip mode), so it silently drops unknown keys. The `deepKeys` comparison will correctly detect this.

### Fixed: Removed `@octokit/webhooks-schemas` — DB is ground truth
**Before**: Phase 4 Section B compared GitHub fixtures against `@octokit/webhooks-schemas` (upstream JSON Schema).
**After**: Removed the dependency and replaced Section B with a field coverage report using the same `deepKeys` diff technique against real DB payloads.
**Why**: The DB stores actual webhook payloads — these are the ground truth. Upstream schemas tell you what GitHub *could* send, not what they *actually* send. The `deepKeys` diff between raw fixtures and Zod-parsed output already identifies missing fields without an external dependency.

### Spike: Zod v4 deepKeys validation approach — CONFIRMED
**Hypothesis**: A `deepKeys` comparison between Zod input and output correctly detects fields stripped by strict `z.object()` nested inside `.loose()` parents.
**Verdict**: CONFIRMED. Zod v4's default `z.object()` silently strips unknown keys. `.loose()` (alias for `.passthrough()`) preserves them. The `deepKeys` diff approach correctly identifies exactly which fields were dropped and at which nesting level. The validate script's core mechanism is sound.
