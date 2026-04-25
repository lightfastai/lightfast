# Vercel Webhook Schema Coverage Implementation Plan

## Overview

Extend Lightfast's Vercel webhook handling to accept `deployment.error` and `deployment.canceled` events alongside the currently-supported `deployment.created` and `deployment.succeeded`, and add a defensive dispatch fallback so future unsupported sub-event types are dropped cleanly instead of crashing the transformer.

## Current State Analysis

Sentry issues `LIGHTFAST-PLATFORM-22` and `LIGHTFAST-PLATFORM-24` have generated ~80,727 events in the last 14 days. Root cause: `transformVercelDeployment` (`packages/app-providers/src/providers/vercel/transformers.ts:19`) unconditionally calls `vercelWebhookEventTypeSchema.parse(rawEventType)`, but the schema only enumerates two values (`schemas.ts:77`):

```ts
export const vercelWebhookEventTypeSchema = z.enum([
  "deployment.created",
  "deployment.succeeded",
]);
```

Prod DB evidence (query against `lightfast_gateway_webhook_deliveries` over last 14 days):

| event_type | status | count |
|---|---|---|
| `deployment.created` | processed | 100 |
| `deployment.succeeded` | processed | 62 |
| **`deployment.error`** | received | 42 |
| **`deployment.canceled`** | received | 19 |
| `deployment.error` | processed | 8 (before 4/19 only) |
| `deployment.canceled` | processed | 1 (before 4/19 only) |

So:
- Vercel sends exactly 4 distinct types in practice; we support 2.
- 61 real deliveries are stuck at `status = 'received'` because the transformer throws.
- The 80k Sentry event count is Inngest retrying those 61 stuck deliveries.
- `payload` is stored for 100% of rows (1.6–2.8 KB each), despite the schema comment claiming "store raw payload on failed deliveries" — the comment is stale.

The dispatcher has a subtle architectural quirk that makes Phase 3 load-bearing:
- `transformEnvelope` (`api/platform/src/lib/transform.ts:15`) runs inside the `ingest-delivery` Inngest function and throws the ZodError *before* the `isEventAllowed` subscription filter in `platform-event-store.ts:265` gets a chance to drop the event.
- Consequence: even after Phase 2 ships, existing users whose `sync.events` config still lists only `["deployment.created", "deployment.succeeded"]` would continue crashing the transformer when `deployment.error`/`deployment.canceled` webhooks arrive, because the crash happens upstream of the subscription check.

A Phase 3 caveat surfaced during review: providers embed sub-actions differently.
- **Vercel** emits `deployment.created` / `deployment.succeeded` — the action is the dot-suffix, so `split(".")[1]` gives `"created"` / `"succeeded"`.
- **GitHub** emits `pull_request` / `issues` / `issue_comment` (no dot — action lives in `payload.action`). GitHub's `resolveCategory` is identity (`providers/github/index.ts:258`).
- A single uniform dot-splitting rule in the dispatcher would drop every GitHub event (`action` would resolve to the full category name, which is never in the `actions` map). Phase 3 must be provider-opt-in.

### Key Discoveries:

- **Dispatch contract already supports graceful skip.** `transformWebhookPayload` returns `PostTransformEvent | null` and already returns `null` when the category isn't in `providerDef.events` (`packages/app-providers/src/runtime/dispatch.ts:26-28`). It just doesn't extend that check to the action suffix — we add one line.
- **`actionEvent` already enumerates supported sub-actions.** `providers/vercel/index.ts:106-117` declares `actions: { created, succeeded }`. The dispatcher can consult this at runtime via `eventDef.kind === "with-actions"`.
- **`defaultSyncEvents` is the source of truth for new-connection subscriptions.** `buildProviderConfig` (`providers/vercel/index.ts:121-128`) bakes it into `providerConfig.sync.events` at connection-create time. Adding new types to `defaultSyncEvents` means *new* connections auto-subscribe; existing connections keep their stored config.
- **`isEventAllowed` uses `getBaseEventType`, which for Vercel is identity** (`providers/vercel/index.ts:133` — `getBaseEventType: (sourceType) => sourceType`). So the filter compares the full `deployment.*` string against the stored `sync.events` array. Existing users with `["deployment.created", "deployment.succeeded"]` will correctly filter out error/canceled once Phase 3 lets those events reach the filter.
- **Fixtures pipeline already exists.** `packages/webhook-schemas` has `pnpm capture` (PII-sanitized DB → JSON fixtures), `pnpm validate` (fixtures ↔ Zod schemas, reports dropped fields), and `pnpm report` (field-coverage analysis). No new infrastructure needed — extend the query.
- **`backfill.ts` mapper is wrong today, but out of scope for this plan.** `mapReadyStateToEventType` (`providers/vercel/backfill.ts:22-30`) maps Vercel `readyState` values `ERROR`, `CANCELED`, `BUILDING`, undefined all to `"deployment.created"`. Fixing this is a separate PR — `sourceId` format is `vercel:deployment:${id}:${eventType}` (`transformers.ts:53`), so flipping historical ERROR/CANCELED backfills to new eventTypes changes their sourceId and creates idempotence/duplication risk with existing rows. Per user decision: this PR fixes webhooks only; backfill mapper change ships separately with a data-cleanup plan.
- **Client-side mirror maps also need updates.** `packages/app-providers/src/client/categories.ts` (`PROVIDER_CATEGORIES`) and `packages/app-providers/src/client/event-labels.ts` (`EVENT_LABELS`) are flat lookup tables that mirror the server-side provider categories. Adding new Vercel event types requires adding entries here or existing sync tests fail. Not obvious from the provider definition alone.

## Desired End State

- `deployment.error` and `deployment.canceled` webhooks land in the event pipeline as normal observations for new connections whose `providerConfig.sync.events` includes them.
- Existing connections (whose stored `sync.events` does not list the new types) continue to drop them, but via `isEventAllowed` rather than a thrown ZodError.
- Any future unrecognized Vercel sub-action (e.g. a hypothetical `deployment.promoted`) is dropped at dispatch with a single warning log, no Sentry storm.
- `pnpm --filter @repo/webhook-schemas validate` is green against committed fixtures for all 4 types.
- Sentry issues `LIGHTFAST-PLATFORM-22` and `LIGHTFAST-PLATFORM-24` resolve to zero new events after deploy.
- The 61 previously-stuck `received` deliveries drain to `processed` (via normal retries or manual re-enqueue).

## What We're NOT Doing

- **Not migrating existing users' `providerConfig.sync.events`.** Per user decision: existing connections keep their current subscription; they opt into error/canceled events on their own schedule. Phase 3 handles them gracefully until they do.
- **Not changing `mapReadyStateToEventType` in backfill.** Separate follow-up PR. Reason: changing this mapper alters `sourceId` for historical ERROR/CANCELED deployments, which needs its own data-cleanup plan to avoid duplicate or orphaned observation rows. This PR is webhook-only.
- **Not fixing unrelated Sentry issues.** `PLATFORM-23` (AI triage `reasoning` string >500 chars), `PLATFORM-29` (Inngest 401 stale key), `PLATFORM-27` (Neon pool exhaustion), `PLATFORM-28` (Vercel AI Gateway access), and the fetch-failed / no_connection cluster are all out of scope. Separate tickets.
- **Not touching the stale status-enum comment.** `gateway-webhook-deliveries.ts:25` lists `held|received|enqueued|delivered|dlq` but prod has `processed`. Note-worthy drift; fix in a separate cleanup.
- **Not refactoring the dispatch→filter ordering.** The fact that `transformEnvelope` runs upstream of `isEventAllowed` is architecturally debatable but out of scope. Phase 3 is a targeted fix, not a redesign.
- **Not expanding observation coverage beyond the 4 types Vercel actually sends.** If Vercel ships a new type later, Phase 3 drops it; we add proper support in a follow-up once we see it in the data.

## Implementation Approach

Do Phase 1 first so the Zod changes in Phase 2 are driven by real payloads, not guesses. Phases 2 and 3 are independent and could ship in either order, but bundle them in one PR so the behavior change is atomic and easy to revert. Phase 4 is post-deploy cleanup.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Capture real fixtures from prod

### Overview

Pull one representative payload per distinct Vercel `event_type` out of prod, sanitize, and commit as fixtures under `packages/webhook-schemas/fixtures/vercel/`. These fixtures drive Phase 2's schema work and Phase 4's regression validation.

### Changes Required:

#### 1. Extend the capture query

**File**: `packages/webhook-schemas/src/capture.ts`
**Changes**: Current query (line 114–129) is `.limit(100)` ordered by `receivedAt` ascending, which biases toward the oldest 100 rows and can miss newer event types entirely. Switch to Drizzle's `selectDistinctOn` so each `(provider, event_type)` contributes one (newest) representative row, and widen the time window.

```ts
import { and, desc, gt, inArray, isNotNull, sql } from "drizzle-orm";

const rows = await db
  .selectDistinctOn([gatewayWebhookDeliveries.provider, gatewayWebhookDeliveries.eventType], {
    provider: gatewayWebhookDeliveries.provider,
    eventType: gatewayWebhookDeliveries.eventType,
    payload: gatewayWebhookDeliveries.payload,
    receivedAt: gatewayWebhookDeliveries.receivedAt,
  })
  .from(gatewayWebhookDeliveries)
  .where(
    and(
      isNotNull(gatewayWebhookDeliveries.payload),
      inArray(gatewayWebhookDeliveries.provider, ["github", "vercel"]),
      gt(gatewayWebhookDeliveries.receivedAt, sql`NOW() - INTERVAL '30 days'`),
    ),
  )
  .orderBy(
    gatewayWebhookDeliveries.provider,
    gatewayWebhookDeliveries.eventType,
    desc(gatewayWebhookDeliveries.receivedAt),
  );
```

The `selectDistinctOn` columns must be the leading `orderBy` columns — Drizzle mirrors Postgres's `DISTINCT ON` constraint. The trailing `desc(receivedAt)` picks the newest payload per `(provider, event_type)`.

#### 2. Run the capture script against prod and commit fixtures

**Command sequence** (run locally, env file already has prod-equivalent creds):
```bash
pnpm --filter @repo/webhook-schemas capture
```

Expected new fixtures under `packages/webhook-schemas/fixtures/vercel/`:
- `deployment.created.json` (already exists if previous capture ran; overwrite)
- `deployment.succeeded.json` (same)
- `deployment.error.json` (new)
- `deployment.canceled.json` (new)

Inspect each new fixture manually to confirm:
- No `email`, `name` (in author contexts), `avatar_url`, or `githubCommitAuthorName` leaked past sanitization
- Any other author-adjacent string fields that `walk()` missed (log them; add to the sanitizer if found)

### Success Criteria:

#### Automated Verification:

- [x] Capture completes without error: `pnpm --filter @repo/webhook-schemas capture`
- [x] Fixtures exist: `ls packages/webhook-schemas/fixtures/vercel/deployment.{created,succeeded,error,canceled}.json`
- [x] Existing validate still passes for all 4 Vercel types: `pnpm --filter @repo/webhook-schemas validate` — all Vercel fixtures pass `preTransformVercelWebhookPayloadSchema` (the enum check is enforced inside the transformer, not at the schema layer; validate reports ✓ for all four).

#### Human Review:

- [x] Opened each new fixture in `packages/webhook-schemas/fixtures/vercel/` → confirmed no raw emails, personal names, or author-identity fields remain. Sanitizer extended to redact `githubCommitAuthorEmail` and `githubCommitAuthorLogin` after initial capture surfaced them.
- [ ] Diff `deployment.error.json` vs `deployment.created.json` → expected observation: the shapes are near-identical except `deployment.readyState` is `ERROR` (or similar failure state) and possibly additional `errorMessage`/`errorCode` fields worth capturing in Phase 2

---

## Phase 2: Extend Vercel provider schemas, transformer, client mirrors, and tests

### Overview

Add `deployment.error` and `deployment.canceled` to the enum, transformer event-title map, `actionEvent` actions, `categories`, `defaultSyncEvents`, and the two client-side mirror maps. **Backfill mapper change is deferred to a follow-up PR** (see "What We're NOT Doing"). Update tests to cover the new types.

### Changes Required:

#### 1. Extend the webhook event-type enum

**File**: `packages/app-providers/src/providers/vercel/schemas.ts`
**Changes**: Add the two new literals.

```ts
export const vercelWebhookEventTypeSchema = z.enum([
  "deployment.created",
  "deployment.succeeded",
  "deployment.error",
  "deployment.canceled",
]);
```

#### 2. Extend the transformer

**File**: `packages/app-providers/src/providers/vercel/transformers.ts`
**Changes**: Extend `eventTitleMap`, emoji, and any event-type-dependent branching. Current logic uses a ternary on `deployment.succeeded` for the emoji; replace with a map.

```ts
const eventTitleMap: Record<VercelWebhookEventType, string> = {
  "deployment.created": "Deployment Started",
  "deployment.succeeded": "Deployment Succeeded",
  "deployment.error": "Deployment Failed",
  "deployment.canceled": "Deployment Canceled",
};

const emojiMap: Record<VercelWebhookEventType, string> = {
  "deployment.created": ">",
  "deployment.succeeded": "+",
  "deployment.error": "!",
  "deployment.canceled": "~",
};

const actionTitle = eventTitleMap[eventType];
const emoji = emojiMap[eventType];
```

Keep the rest of the transformer (title, body, sourceId, entity, attributes) identical — the new event types reuse the same payload shape.

#### 3. Extend the provider registration

**File**: `packages/app-providers/src/providers/vercel/index.ts`
**Changes**: Add two category entries, two action entries, and two new `defaultSyncEvents` values.

```ts
categories: {
  "deployment.created": {
    label: "Deployment Started",
    description: "Capture when new deployments begin",
    type: "observation",
  },
  "deployment.succeeded": {
    label: "Deployment Succeeded",
    description: "Capture successful deployment completions",
    type: "observation",
  },
  "deployment.error": {
    label: "Deployment Failed",
    description: "Capture deployment failures",
    type: "observation",
  },
  "deployment.canceled": {
    label: "Deployment Canceled",
    description: "Capture canceled deployments",
    type: "observation",
  },
},

events: {
  deployment: actionEvent({
    label: "Deployment",
    weight: 40,
    schema: preTransformVercelWebhookPayloadSchema,
    transform: transformVercelDeployment,
    actions: {
      created: { label: "Deployment Started", weight: 30 },
      succeeded: { label: "Deployment Succeeded", weight: 40 },
      error: { label: "Deployment Failed", weight: 50 },
      canceled: { label: "Deployment Canceled", weight: 20 },
    },
  }),
},

defaultSyncEvents: [
  "deployment.created",
  "deployment.succeeded",
  "deployment.error",
  "deployment.canceled",
],
```

Weights for `error` (50) and `canceled` (20) are judgment calls — failures are higher-signal than starts, cancellations are lower-signal. Revisit after shipping if the scoring heuristic shows noise.

#### 4. Update client-side mirror maps

**Files**:
- `packages/app-providers/src/client/categories.ts` — add entries to `PROVIDER_CATEGORIES.vercel`
- `packages/app-providers/src/client/event-labels.ts` — add entries to `EVENT_LABELS`

```ts
// categories.ts — inside PROVIDER_CATEGORIES.vercel
"deployment.error": {
  label: "Deployment Errored",
  description: "Capture failed deployments",
  type: "observation",
},
"deployment.canceled": {
  label: "Deployment Canceled",
  description: "Capture canceled deployments",
  type: "observation",
},

// event-labels.ts — inside EVENT_LABELS
"vercel:deployment.error": "Deployment Errored",
"vercel:deployment.canceled": "Deployment Canceled",
```

These are flat lookup tables that mirror server-side provider categories for client rendering. Discovered during spike — omitting them fails existing sync tests that assert parity between provider definitions and the client maps.

#### 5. Update tests

**Files**:
- `packages/app-providers/src/providers/vercel/index.test.ts`
- `packages/app-providers/src/providers/github/backfill-round-trip.test.ts` (imports `transformVercelDeployment`)

**Changes**:
- `index.test.ts:356-357, 391, 427-443, 500-515`: Add assertions that `deployment.error` and `deployment.canceled` are in `accountInfo.events`, `defaultSyncEvents`, and resolve to category `deployment`.
- Add a direct transformer test: `transformVercelDeployment(errorPayloadFromFixture, ctx, "deployment.error")` produces a `PostTransformEvent` with `eventType: "deployment.error"` and title containing "Deployment Failed". Same for canceled.
- `backfill.test.ts` is NOT modified — backfill mapper change is out of scope for this PR.

### Success Criteria:

#### Automated Verification:

- [x] Type checking passes: `pnpm --filter @repo/app-providers typecheck`
- [x] Tests pass: `pnpm --filter @repo/app-providers test` (395 passing, up from 384)
- [x] Fixture validation passes for all 4 Vercel types: `pnpm --filter @repo/webhook-schemas validate`
- [x] Lint/format passes: `pnpm check`

#### Human Review:

- [ ] Open `packages/webhook-schemas/fixtures/vercel/deployment.error.json` alongside `packages/app-providers/src/providers/vercel/schemas.ts` → confirm every field the transformer reads (`payload.deployment.readyState`, `payload.deployment.meta.githubCommit*`, `payload.target`, etc.) exists in the fixture, or is legitimately optional

---

## Phase 3: Defensive dispatch fallback for unsupported sub-actions

### Overview

Teach `transformWebhookPayload` to recognize unsupported sub-actions and return `null` with a warning log, instead of letting the transformer's `.parse()` throw a ZodError. The check is **provider-opt-in** via a new optional `resolveAction` field on the provider definition: Vercel defines it (action lives in the wire eventType); GitHub leaves it undefined (action lives in `payload.action`, not in the dotted wire type).

This is load-bearing for existing users (see Current State Analysis — their subscription filter runs downstream of the transformer, so they'd still crash on new types they haven't subscribed to). It's also our forward-compatibility backstop for any future Vercel event types.

**This approach was spiked in an isolated worktree before plan adoption** — the uniform `eventType.indexOf(".")` alternative was rejected because it drops every GitHub event (GitHub's wire eventType is `"pull_request"` with no dot, so the dot-split fallback lands on the category name which is never in `actions`). See the Improvement Log at the bottom for spike evidence.

### Changes Required:

#### 1. Add optional `resolveAction` field to the provider shape

**File**: `packages/app-providers/src/provider/shape.ts`
**Changes**: Add optional field to `BaseProviderFields` alongside the existing `resolveCategory`:

```ts
/**
 * Optional: extract a sub-action name from the wire eventType (e.g., "deployment.created" → "created").
 * When defined, the dispatcher enforces that the resolved action is present in the event's `actions` map
 * and returns null otherwise. Providers whose action lives in the payload (e.g., GitHub) should leave
 * this undefined — the allowlist check is then skipped.
 */
readonly resolveAction?: (eventType: string) => string | null;
```

#### 2. Define `resolveAction` on the Vercel provider only

**File**: `packages/app-providers/src/providers/vercel/index.ts`
**Changes**: Add next to `resolveCategory`:

```ts
// Wire eventType "deployment.created" → sub-action "created"
resolveAction: (eventType) => eventType.split(".")[1] ?? null,
```

**Do NOT add to GitHub.** GitHub's wire eventType is the bare category (`pull_request` / `issues` / `issue_comment`) — the action is in `payload.action` and is validated inside the transformer. Leaving `resolveAction` undefined skips the dispatcher allowlist check.

#### 3. Guard the allowlist check in the dispatcher

**File**: `packages/app-providers/src/runtime/dispatch.ts`
**Changes**: Insert between the `eventDef` lookup and the `schema.parse` call:

```ts
// Sub-action allowlist — only enforced when the provider opts in via resolveAction.
// GitHub leaves this undefined because the action lives in payload.action, not the wire
// event header; dot-splitting its wire eventType "pull_request" would be wrong.
if (providerDef.resolveAction && eventDef.kind === "with-actions") {
  const action = providerDef.resolveAction(eventType);
  if (action !== null && !(action in eventDef.actions)) {
    console.warn(
      `transformWebhookPayload: unknown sub-action "${action}" for ${provider}:${category}`
    );
    return null;
  }
}
```

Notes on the design:
- The `eventDef.kind === "with-actions"` guard narrows the discriminated union so `eventDef.actions` is typed (`ActionEventDef`, not `SimpleEventDef`). No `as` cast needed.
- `console.warn` matches Next.js Sentry behavior (picked up as breadcrumbs, not errors — no fresh Sentry issues). Rest of `packages/app-providers` uses `console.error` via `logValidationErrors` only on post-transform validation failures; this is a dispatch-level drop, a distinct case.
- `resolveAction` returning `null` (not a string) signals "don't check" — useful escape hatch if a provider has a mix of action-gated and action-less events.

#### 4. Add a dispatch test

**File**: `packages/app-providers/src/runtime/dispatch.test.ts` (new — file does not exist today)
**Changes**: Cover four cases. The GitHub case is the critical regression guard.

```ts
it("returns null for unknown category", () => {
  const result = transformWebhookPayload("vercel", "payment.charged", {}, ctx);
  expect(result).toBeNull();
});

it("returns null for unknown sub-action on a with-actions event (Vercel)", () => {
  const result = transformWebhookPayload("vercel", "deployment.promoted", {}, ctx);
  expect(result).toBeNull();
});

it("still calls transform for known Vercel sub-actions", () => {
  const result = transformWebhookPayload("vercel", "deployment.created", validVercelFixture, ctx);
  expect(result).not.toBeNull();
});

// Regression guard: GitHub does NOT define resolveAction, so the dispatcher must skip the
// allowlist check entirely. Its wire eventType is "pull_request" (no dot); a naive dot-split
// would drop every GitHub event.
it("calls transform for GitHub (no resolveAction defined, check skipped)", () => {
  const result = transformWebhookPayload("github", "pull_request", validGitHubFixture, ctx);
  expect(result).not.toBeNull();
});
```

### Success Criteria:

#### Automated Verification:

- [x] Dispatch unit tests pass: `pnpm --filter @repo/app-providers test dispatch` (4 new tests in `runtime/dispatch.test.ts` including the GitHub regression guard)
- [x] Full package tests pass: `pnpm --filter @repo/app-providers test` (395 passing)
- [x] Type checking passes: `pnpm --filter @repo/app-providers typecheck`

#### Human Review:

- [ ] Manually POST a synthetic `deployment.promoted` payload to the platform ingest route locally (`curl` via `pnpm dev:platform`) → expected observation: the run in Inngest devserver UI shows the event received, `transformEnvelope` returns null, the Inngest function completes as a no-op, and one `console.warn` line appears in the platform server log with the dropped type. No Sentry error.

---

## Phase 4: Deploy, drain backlog, and verify

### Overview

Ship Phases 2+3 in a single deploy, drain the 61 stuck deliveries, and confirm the Sentry issues resolve.

### Changes Required:

#### 1. Deploy the changes

Merge to `main` and let the standard Vercel deploy pipeline ship `apps/platform`. No manual intervention.

#### 2. Drain the stuck `received` deliveries

**Option A (preferred): let Inngest retry.** The 61 `received` rows correspond to Inngest runs that have been failing with ZodError. Inngest will continue retrying on its backoff schedule; after deploy, retries will succeed (error/canceled go through Phase 2 transformer, or are dropped by Phase 3 for users not subscribed).

**Option B (if retries have exhausted): manual re-enqueue.** For each stuck delivery, trigger a replay via the Inngest dashboard or:
```ts
// One-off script or Inngest dashboard action
await inngest.send({
  name: "gateway/webhook.received",
  data: { provider: "vercel", deliveryId },
});
```
Check `status` transitions to `processed` in `lightfast_gateway_webhook_deliveries` within a few minutes.

#### 3. Confirm Sentry issues close

Watch `LIGHTFAST-PLATFORM-22` and `LIGHTFAST-PLATFORM-24` in Sentry for 24 hours post-deploy. Expected: no new events. Mark both resolved once quiet.

### Success Criteria:

#### Automated Verification:

- [ ] No stuck deliveries remain: `SELECT COUNT(*) FROM lightfast_gateway_webhook_deliveries WHERE provider = 'vercel' AND status = 'received' AND received_at > NOW() - INTERVAL '14 days';` returns 0
- [ ] All 4 event types reach `processed` status:
  ```sql
  SELECT event_type, status, COUNT(*)
  FROM lightfast_gateway_webhook_deliveries
  WHERE provider = 'vercel'
    AND received_at > NOW() - INTERVAL '1 day'
  GROUP BY event_type, status
  ORDER BY event_type, status;
  ```
  Expected: every `event_type` row has `status = 'processed'`.

#### Human Review:

- [ ] Open Sentry → filter project `lightfast-platform` for `LIGHTFAST-PLATFORM-22` and `LIGHTFAST-PLATFORM-24` → expected observation: no new events in the 24h window after deploy; resolve both
- [ ] Open the Inngest dashboard → filter by `platform/ingest.delivery` → expected observation: the 61 previously-failing runs complete successfully (or complete as no-op skipped-by-filter for existing users without subscription)
- [ ] Pick one existing connection from `lightfast_org_integrations` where `providerConfig.sync.events = ["deployment.created", "deployment.succeeded"]` → trigger a deployment error in a monitored Vercel project → expected observation: the delivery row shows `status = 'processed'`, no downstream `platform_observations` row is created (filtered by `isEventAllowed`), no Sentry error

---

## Testing Strategy

### Unit Tests:

- `transformVercelDeployment` produces well-formed `PostTransformEvent` for all 4 event types (from committed fixtures)
- `transformWebhookPayload` returns `null` for: unknown category, unknown sub-action on a `with-actions` event; still transforms for known sub-actions; **still transforms for GitHub even though GitHub does not define `resolveAction`** (regression guard)
- `vercelWebhookEventTypeSchema` accepts all 4 literals and rejects arbitrary strings
- `mapReadyStateToEventType` tests are unchanged — backfill mapper is out of scope

### Integration Tests:

- `packages/webhook-schemas validate` passes for every Vercel fixture (this is effectively our round-trip integration test — real prod shape through real schema)
- Existing `backfill-round-trip.test.ts` scenarios continue to pass; add a case for `readyState: "ERROR"` producing `eventType: "deployment.error"` through the full round-trip

### Manual smoke test:

- Phase 3 Human Review item: POST a `deployment.promoted` synthetic payload locally, confirm graceful null + warning log

## Performance Considerations

Negligible. Phase 3 adds an `indexOf` + object key lookup per webhook dispatch — measured in microseconds, dwarfed by the existing Zod parse. Phase 2 adds two entries to enum/map lookups — also constant-time. No new DB queries, no new fan-out.

## Migration Notes

No DB migration required. `defaultSyncEvents` only affects new connections created after deploy; existing connections keep their stored `providerConfig.sync.events` array. Per user direction, we are not backfilling existing users' configs in this plan.

Drizzle schema stays unchanged — we're not changing any table shape.

## References

- Sentry: `LIGHTFAST-PLATFORM-22` (https://lightfast.sentry.io/issues/7423899792/)
- Sentry: `LIGHTFAST-PLATFORM-24` (https://lightfast.sentry.io/issues/7424679009/)
- Offending file: `packages/app-providers/src/providers/vercel/transformers.ts:19`
- Enum to extend: `packages/app-providers/src/providers/vercel/schemas.ts:77`
- Dispatcher to extend: `packages/app-providers/src/runtime/dispatch.ts:15`
- Provider shape (where `resolveAction` is added): `packages/app-providers/src/provider/shape.ts`
- Subscription filter (runs downstream, not the fix site): `api/platform/src/inngest/functions/platform-event-store.ts:60,265`
- Client mirror maps: `packages/app-providers/src/client/{categories.ts,event-labels.ts}`
- Fixture tooling: `packages/webhook-schemas/{src/capture.ts,src/validate.ts,src/report.ts}`
- DB schema: `db/app/src/schema/tables/gateway-webhook-deliveries.ts`

---

## Improvement Log

Adversarial review on 2026-04-24. Findings and actions:

### Critical — fixed

- **Phase 3 dispatcher change as originally written would drop every GitHub event.** Original Phase 3 used `eventType.indexOf(".")` uniformly. But GitHub's wire eventType is `"pull_request"` (no dot — action lives in `payload.action`), so the fallback `action = eventType` would check `"pull_request" in { opened, closed, merged, ... }` → false → every GitHub webhook silently dropped. A production outage.
- **Fix**: Phase 3 rewritten to use an opt-in `resolveAction?: (eventType) => string | null` on the provider shape. Vercel defines it; GitHub leaves undefined. Dispatcher enforces only when defined. Typesafe (uses `eventDef.kind === "with-actions"` discriminant), no cross-provider surprise.

### Spike verdict — CONFIRMED

Ran `spike-validator` in isolated worktree before accepting the `resolveAction` design.
- Typecheck: PASS (`pnpm --filter @repo/app-providers typecheck`).
- Tests: 387/387 (including 3 new dispatch tests and the critical GitHub regression guard).
- Diff size: +64 / -2 across 7 files.
- **Surprise finding incorporated**: `packages/app-providers/src/client/{categories.ts,event-labels.ts}` are mirror maps that must also list new Vercel actions, or existing sync tests fail. Added as Phase 2 step 4.

### High — fixed

- **Backfill behavior change descoped to follow-up PR.** Original plan changed `mapReadyStateToEventType` which alters `sourceId` for historical ERROR/CANCELED backfills and creates idempotence risk with existing observations. Per user decision: this PR is webhook-only; backfill mapper change ships separately with a data-cleanup plan.
- **Test file clarification.** Phase 3 said "new or extend existing" for `dispatch.test.ts`; the file does not exist — clarified as "new".
- **GitHub regression guard added to dispatch tests.** Explicit test asserts GitHub dispatch still works with `resolveAction` undefined, to prevent future refactors reintroducing the uniform dot-split bug.

### Not adopted

- **Improvement #5 — collapse Phases 2+3 by removing the hard `parse()` in the transformer.** Simpler but would let truly-unknown future Vercel types produce "Deployment Update" fallback observations for all users. The opt-in allowlist approach is more conservative — unknown types drop silently until we add explicit support.
- **Moving `isEventAllowed` upstream of `transformEnvelope`.** Architecturally cleaner but out of scope; would also require rethinking observation enrichment ordering.
