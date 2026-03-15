---
date: 2026-03-14T00:00:00+00:00
researcher: claude
git_commit: 4ec3c541776200e318c670c5064af752d9e142f0
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Multi-app integration testing across the full Lightfast ingestion pipeline"
tags: [research, codebase, integration-tests, gateway, relay, backfill, neural, inngest, testing]
status: complete
last_updated: 2026-03-14
---

# Research: Multi-App Integration Testing Across the Full Ingestion Pipeline

**Date**: 2026-03-14
**Git Commit**: `4ec3c541776200e318c670c5064af752d9e142f0`
**Branch**: `feat/backfill-depth-entitytypes-run-tracking`

## Research Question

How is multi-app integration testing structured across the Lightfast ingestion pipeline (gateway, relay, backfill, @api/console neural pipeline), and what does full end-to-end validation of the whole flow look like?

## Summary

Lightfast already has a sophisticated multi-service test infrastructure in `packages/integration-tests/`. It boots gateway, relay, backfill, and `@api/console` **in a single Vitest worker process** using Hono's `.request()` API (no real sockets), routes inter-service HTTP by port number via a `globalThis.fetch` override, and replaces all external dependencies (Redis, QStash, Inngest, Sentry, PlanetScale) with in-memory stubs.

10 integration suites exist today covering OAuth flows, relay dispatch, backfill orchestration, cache consistency, contract snapshots, and full-stack connection lifecycle — including a FoundationDB-style permutation test suite (Suite 6).

Nine new per-service test files (untracked) have been added across gateway, relay, and backfill — covering scenario matrices (72–108 cases via cartesian product), fault injection, and Upstash Workflow step-replay memoization. These are single-service and not yet wired into `packages/integration-tests/`.

**Critical gap**: The neural pipeline (`eventStore → entityGraph → entityEmbed`) has **zero coverage** in `packages/integration-tests/`. All existing multi-service suites stop at QStash delivery to Console. Nothing tests what happens after `apps-console/event.capture` fires.

---

## Detailed Findings

### 1. Multi-Service Test Harness — `packages/integration-tests/`

The central test hub. All three Hono apps are imported directly as modules via path aliases in `vitest.config.ts`:

```
@gateway/app  → apps/gateway/src/app.ts
@relay/app    → apps/relay/src/app.ts
@backfill/app → apps/backfill/src/app.ts
```

`packages/integration-tests/vitest.config.ts:16-31` lists all packages that must be bundled into the test worker via `server.deps.inline` — this is what makes `vi.mock()` interception work for deeply-nested vendor imports (`@vendor/upstash`, `@vendor/qstash`, `@vendor/inngest`, etc.).

The shared root config at `vitest.shared.ts` sets `pool: "threads"`, `maxThreads: 2`, and `fileParallelism: false` — tests across files are serialized (critical for shared PGlite singleton).

#### `setup.ts` — Global Environment Bootstrap

`packages/integration-tests/src/setup.ts` runs before every test file. It sets:
- `SKIP_ENV_VALIDATION = "true"` — bypasses `@t3-oss/env-core` Zod validation at module load time
- `NODE_ENV = "production"` — disables relay lifecycle dev delays
- `GATEWAY_API_KEY = "0".repeat(64)` — 64-char hex string (must pass relay's `hexToBytes()` timing-safe comparison)
- `ENCRYPTION_KEY = "a".repeat(64)` — AES-256-GCM token encryption key
- All required webhook secrets for relay HMAC validation (GitHub, Vercel, Linear, Sentry)
- Clerk, Upstash, QStash, and PlanetScale placeholder URLs (satisfy Zod env schemas; never hit real services)

#### `harness.ts` — Shared Mock Factories

`packages/integration-tests/src/harness.ts` exports the core building blocks used by every test file:

| Factory | What it provides |
|---|---|
| `makeRedisMock(store: Map)` | In-memory Redis backed by a JavaScript Map; all Upstash methods including `pipeline` and `multi` with transactional `exec` |
| `makeQStashMock(messages: [])` | Captures every `publishJSON` call into an array instead of making HTTP requests |
| `makeInngestMock(events, capturedHandlers)` | Captures `send()` calls into an array; captures `createFunction()` handlers by function ID so tests can invoke workflow logic directly |
| `installServiceRouter(apps)` | Stubs `globalThis.fetch` to route by port: `4108→relay`, `4109→backfill`, `4110→gateway`. Returns a `restore()` function. Also prepends `/services` to gateway paths |
| `makeStep(overrides)` | Inngest `step` mock where `step.run(name, fn)` executes `fn()` immediately |
| `withTimeFaults(step, faults)` | Wraps step.run to advance fake timers after named steps (requires `vi.useFakeTimers()`) |
| `withEventPermutations(config)` | Permutation engine: generates all N! orderings of N effects, runs each with `setup/reset/invariant` callbacks; truncates at `maxRuns: 120` with Fisher-Yates shuffle |
| `makeApiKeyFixture(db, overrides)` | Inserts a valid `sk-lf-*` API key into PGlite for tRPC `apiKeyProcedure` tests |

**PGlite** (`@repo/console-test-db`): Creates a singleton in-memory Postgres instance per Vitest worker, runs all Drizzle migrations on startup. `createTestDb()` / `resetTestDb()` (TRUNCATE CASCADE all tables) / `closeTestDb()` manage its lifecycle.

#### Per-Test Mock Wiring Pattern (6-step)

Every test file follows this exact pattern:

1. **`vi.hoisted()`** — creates backing data structures (Map, arrays) and calls factory functions. Required because `vi.mock()` is statically hoisted by Vitest before any module code runs.
2. **`vi.mock()` declarations** — wires mocks into the module graph:
   - `@db/console/client` — getter returning live PGlite `db` instance
   - `@vendor/upstash` — `{ redis: redisMock }`
   - `@vendor/qstash` — `{ getQStashClient: () => qstashMock, Receiver: class { verify() → true } }`
   - `@vendor/inngest` — `{ Inngest: class { send = inngestSendMock; createFunction = ... } }`
   - `@vendor/inngest/hono` — `serve: vi.fn(() => () => new Response("ok"))` (no-op HTTP handler)
   - `@vendor/related-projects` / `@vercel/related-projects` — return `defaultHost` so inter-service URLs resolve to `localhost:41xx`
   - `@vendor/upstash-workflow/client` — stubs `workflowClient.trigger`
   - `@vendor/upstash-workflow/hono` — stubs `serve` as no-op
3. **App imports** — after all mocks are declared, import the Hono apps and any workflow modules that register Inngest handlers at module-load time
4. **`beforeAll`** — `db = await createTestDb()`
5. **`beforeEach`** — clear `qstashMessages.length`, `redisStore.clear()`, `vi.clearAllMocks()`, restore mock implementations
6. **`afterEach` / `afterAll`** — `resetTestDb()` / `closeTestDb()`

#### `__stubs__/` — Static Module Replacements

Wired via `vitest.config.ts` `resolve.alias` — replace the real packages for the entire test process:

- `sentry-core.ts` — no-op `@sentry/core` (all three `app.ts` files call `sentry-init.ts` at startup which uses `initAndBind` from `@sentry/core`)
- `server-only.ts` — empty module export (prevents Next.js `server-only` package from throwing outside Next.js)
- `gateway-service-clients.ts` — stub `createGatewayClient` that always returns `{ status: "active" }` from `getConnection`, `{ status: 200, data: {} }` from `executeEndpoint`, `"stub-token"` from `getToken`, `{ status: "cancelled" }` from `cancelBackfill`

---

### 2. Existing Integration Test Suites

#### Suite Coverage Map

| Suite | File | Services Spanned | What it validates |
|---|---|---|---|
| 0.1 | `contract-snapshots.test.ts` | gateway | Shape drift detection: gateway connection/token response shapes, dispatch body, backfill run body, execute body, relay replay shapes |
| 1 | `connections-relay-cache.integration.test.ts` | gateway + relay | Redis key namespace consistency (`gw:resource:*` written by gateway, read by relay); dedup SET NX semantics |
| 2 | `connections-backfill-trigger.integration.test.ts` | backfill + gateway | Backfill trigger auth contract; `cancelBackfillService` QStash message shape; GitHub OAuth no longer triggers backfill |
| 3 | `backfill-connections-api.integration.test.ts` | backfill + gateway | Orchestrator fetches connection/token via gateway HTTP; NonRetriableError on inactive connection; token decryption |
| 4 | `backfill-relay-dispatch.integration.test.ts` | relay | Service-auth webhook path; dedup logic; `WebhookEnvelope` shape |
| 5 | `full-stack-connection-lifecycle.integration.test.ts` | gateway + relay + backfill | Full connection lifecycle: trigger → orchestrate → dispatch; teardown → cancel → cache cleanup |
| 6 | `event-ordering.integration.test.ts` | gateway + relay + backfill | Permutation testing: all N! orderings of N concurrent effects produce identical final state |
| 7 | `connections-cli-oauth-flow.integration.test.ts` | gateway | CLI OAuth route: authorize, polling, inline callback, state token lifecycle |
| 8 | `api-console-connections.integration.test.ts` | api/console (tRPC) + gateway | tRPC `connectionsRouter` procedures with real gateway service mesh |
| 9 | `cli-oauth-full-flow.integration.test.ts` | api/console (tRPC) + gateway | Full CLI OAuth chain: tRPC cliAuthorize → gateway state → callback → poll |
| 10 | `connections-browser-oauth-flow.integration.test.ts` | gateway | Browser OAuth flow: authorize, callback (302 redirect), state replay protection |

#### Suite 5 — Full Stack Connection Lifecycle

`packages/integration-tests/src/full-stack-connection-lifecycle.integration.test.ts`

The canonical multi-service test. Three sub-suites (5.1, 5.2, 5.3) validate:
- 5.1: `POST /api/trigger` → `apps-backfill/run.requested` Inngest event; orchestrator → gateway fetch → returns `{ success: true, workUnits: 1, eventsProduced: 5 }`; relay accepts service-auth webhook with correct `WebhookEnvelope`
- 5.2: `cancelBackfillService` → QStash cancel message captured → delivered to backfill cancel route → `apps-backfill/run.cancelled` fired; duplicate relay delivery → exactly 1 QStash publish
- 5.3: Full teardown chain: seed DB + Redis → DELETE connection → simulate cancel QStash → deliver cancel → simulate cache cleanup → assert `hgetall(cacheKey)` returns null

#### Suite 6 — Event Ordering (Permutation Testing)

`packages/integration-tests/src/event-ordering.integration.test.ts`

FoundationDB-style simulation testing. Uses `withEventPermutations` from `harness.ts`:
- 6.1: 3 teardown effects (cancel, clear-cache, soft-delete) × 3! = **6 orderings** — all produce identical final state
- 6.2: 3 webhook dispatches × 3! = **6 orderings** — all produce 3 QStash messages + 3 dedup keys
- 6.3: 2 effects (backfill notify + relay dispatch) × 2! = **2 orderings** — both produce correct results
- 6.4: 4 gateway teardown steps × 4! = **24 orderings** — all produce identical state
- 6.5: 2 sends of same `deliveryId` × 2! = **2 orderings** — both produce exactly 1 QStash message

---

### 3. New Per-Service Test Files (Untracked)

Nine new test files have been added directly into each service. These are **single-service** and are not yet part of `packages/integration-tests/`.

#### Gateway (3 files — PGlite-backed)

All three gateway test files mount the `connections` router on a bare `Hono` instance and call `app.request()` directly. They use `@repo/console-test-db` (PGlite) for real DB state.

**`apps/gateway/src/routes/gateway-scenario-matrix.test.ts`**
- 72 scenarios: `provider(3) × tokenState(4) × upstreamStatus(3) × connectionStatus(2)`
- 7 invariants per scenario covering: revoked early-exit, missing-token still attempts, upstream passthrough (200/401/500), 401 retry with fresh token, refresh-on-expired
- Stubs `fetch` globally per-test via `vi.stubGlobal`
- Contains the `cartesian<T>()` engine (copy-per-file pattern)

**`apps/gateway/src/routes/connections.oauth.integration.test.ts`**
- `installation_id` fallback recovery in callbacks, token expiry/refresh, state replay protection, state lifecycle (single-use via `multi/exec`)
- Key mock: `mockMultiExec` for testing the atomic state consumption that prevents replay attacks

**`apps/gateway/src/routes/connections.proxy.integration.test.ts`**
- `GET /connections/:id/proxy/endpoints` (6 cases) + `POST /connections/:id/proxy/execute` (22 cases)
- Covers: auth, token injection, path/query param substitution, JSON body forwarding, raw response passthrough, 401 retry, AbortSignal timeout

#### Relay (3 files — in-memory stubs, no PGlite)

Relay tests capture the Upstash Workflow handler from `serve()` at module load time. No HTTP layer is tested.

**`apps/relay/src/routes/relay-scenario-matrix.test.ts`**
- 72 scenarios: `provider(4) × resolutionPath(3) × deduplication(3) × qstashResult(2)`
- 7 invariants: duplicate exit, persist-delivery insert, DLQ routing, envelope shape, Redis cache populate, failure propagation, Redis-unavailable rejection

**`apps/relay/src/routes/relay-fault-injection.test.ts`**
- 11 describe blocks, one per step boundary
- Covers: dedup Redis timeout/ECONNREFUSED, idempotent persist on retry, resolve-connection Redis throw, DB fallthrough throw, cache populate throw, retry-with-cached-dedup, publish rate limit error, DLQ publish throw, DLQ status update throw, `receivedAt` normalization (epoch seconds → ms), null `resourceId` → DLQ, `correlationId` propagation in headers

**`apps/relay/src/lib/replay.test.ts`**
- Tests `replayDeliveries()` function in isolation (no Hono app)
- Covers: null-payload skip, Redis del + workflow trigger + DB status reset, dedup key format, trigger payload shape (including `receivedAt` ISO→ms conversion), failure per-item, mixed batch (success/skip/fail split)

#### Backfill (3 files — in-memory stubs, no PGlite, no HTTP)

Backfill tests capture Inngest handler functions via the `createFunction` mock at module load time.

**`apps/backfill/src/workflows/scenario-matrix.test.ts`**
- Entity Worker: 48 scenarios `pageCount(3) × eventsPerPage(4) × rateLimitNearThreshold(2) × fetchFailsOnPage(2)` — 5 invariants (dispatch count, pages processed, events produced, failure on fetch error, sleep on rate limit)
- Orchestrator: 108 scenarios `resourceCount(3) × entityTypes(2) × gapCoverage(3) × workerOutcomes(3) × holdForReplay(2)` — 7 invariants (work units, dispatch+skip=workUnits, completed+failed=dispatched, success flag, eventsProduced, replay step call, persist step call)

**`apps/backfill/src/workflows/fault-injection.test.ts`**
- Entity worker: `executeApi` network errors (ECONNREFUSED, 403, 429), partial page success, `processResponse` throw, relay dispatch failures, rate-limit edge cases (remaining=0, resetAt in past, resetAt 1h future)
- Orchestrator: `getConnection` 500, null worker result, `upsertBackfillRun` rejection, `replayCatchup` MAX_ITERATIONS (500 calls), `remaining: NaN` loop exit, alternating success/reject

**`apps/backfill/src/workflows/step-replay.test.ts`**
- Tests Inngest step memoization idempotency
- `createRecordingStep()` executes callbacks live and appends `{ name, type, returnValue }` entries to a journal
- `createReplayStep()` replays journal entries in order without executing callbacks; throws if step name/type mismatches (detects step ordering bugs)
- 2 entity-worker cases + 2 orchestrator cases (single resource, mixed success/failure)

---

### 4. Neural Pipeline — Inngest Workflow Chain

The neural pipeline lives entirely in `api/console/src/inngest/workflow/neural/`. Five Inngest functions are registered at `/api/inngest` via `createInngestRouteContext()` (`api/console/src/inngest/index.ts:26-38`).

#### Function Chain

```
apps-console/event.capture
  ↓ (idempotency: workspaceId + sourceId)
  eventStore  [api/console/src/inngest/workflow/neural/event-store.ts:109]
    13 steps:
    1. generate-replay-safe-ids     → nanoid(), Date.now() (memoized)
    2. resolve-clerk-org-id         → DB lookup if not in event payload
    3. create-job                   → workspaceWorkflowRuns INSERT (idempotent)
    4. update-job-running           → status = "running", startedAt
    5. check-duplicate              → workspaceEvents by (workspaceId, sourceId)
    6. check-event-allowed          → workspaceIntegrations by (workspaceId, providerResourceId)
    7. evaluate-significance        → scoreSignificance() [CPU-only]
    8. extract-entities             → extractEntities() + extractFromRelations()
    9. store-observation            → workspaceEvents INSERT
   10. upsert-entities-and-junctions → workspaceEntities ON CONFLICT UPDATE
                                      workspaceEntityEvents INSERT
   11. emit-downstream-events      → sends apps-console/entity.upserted
   12. emit-event-stored           → sends apps-console/event.stored
   13. complete-job-success        → workspaceWorkflowRuns completed

apps-console/entity.upserted
  ↓
  entityGraph  [entity-graph.ts:15]
    2 steps:
    1. resolve-edges        → resolveEdges(): co-occurrence graph, workspaceEdges INSERT
    2. emit-entity-graphed  → sends apps-console/entity.graphed

apps-console/entity.graphed  [debounced 30s per entityExternalId]
  ↓
  entityEmbed  [entity-embed.ts:29]
    6 steps:
    1. fetch-entity             → workspaceEntities by externalId
    2. fetch-workspace          → orgWorkspaces by id
    3. fetch-narrative-inputs   → 4 parallel: genesis event, recent 3 events, graph edges, MAX(significanceScore)
    4. [CPU] buildEntityNarrative() → multi-section text
    5. embed-narrative          → embedding provider → float[] vector
    6. upsert-entity-vector     → Pinecone upsert: id=ent_{externalId}, layer="entities"

apps-console/event.stored
  ↓
  notificationDispatch  [workflow/notifications/dispatch.ts:8]
    Guard: exits if score < 70 or no clerkOrgId or Knock not configured
    1 step: trigger-knock-workflow → Knock API "observation-captured"
```

#### Key Design Details

- **Inngest idempotency key** at `event-store.ts:117-118` — prevents duplicate ingestion at the queue level, separate from the in-step `check-duplicate` DB check
- **Debounce** on `entityEmbed` (line 36-39) — 30s window per `entityExternalId` collapses burst events for the same entity into one embed call
- **Primary entity ordering** — the primary entity is always at index 0 of the `Map` because it's inserted first and wins deduplication with `confidence: 1.0` (event-store.ts:360-376, 461-462)
- **`NonRetriableError`** thrown for structural DB misses (entity/workspace not found), preventing Inngest from burning retries on non-transient failures
- **`createNeuralOnFailureHandler`** factory (`on-failure-handler.ts:44`) — generic type parameter for event payload inference, shared boilerplate across all neural functions. Currently only `eventStore` registers an `onFailure` handler.

#### Database Tables

| Table | Written by | Operation |
|---|---|---|
| `workspaceWorkflowRuns` | `eventStore` (createJob/updateJobStatus/completeJob) | INSERT + UPDATE |
| `workspaceEvents` | `eventStore` step 9 | INSERT |
| `workspaceEntities` | `eventStore` step 10 | INSERT ON CONFLICT DO UPDATE |
| `workspaceEntityEvents` | `eventStore` step 10 | INSERT ON CONFLICT DO NOTHING |
| `workspaceEdges` | `entityGraph` via `resolveEdges()` | INSERT ON CONFLICT DO NOTHING |

External services written: Pinecone (by `entityEmbed`), Knock (by `notificationDispatch`).

---

### 5. Service Communication Layer

#### Service URLs

All inter-service URLs are resolved at `packages/gateway-service-clients/src/urls.ts` via `withRelatedProject` (Vercel Related Projects). In development (`VERCEL_ENV !== "production" && !== "preview"`):

| Service | Dev URL | Production URL |
|---|---|---|
| gateway | `http://localhost:4110/services` | `https://gateway.lightfast.ai/services` |
| relay | `http://localhost:4108/api` | `https://relay.lightfast.ai/api` |
| backfill | `http://localhost:4109/api` | `https://backfill.lightfast.ai/api` |
| console | `http://localhost:3024` | `https://lightfast.ai` |

The test harness's `installServiceRouter` relies on port numbers matching these defaults. The `@vendor/related-projects` mock returns `defaultHost` directly.

#### Typed Service Clients (`@repo/gateway-service-clients`)

Three factory functions, all using `X-API-Key: GATEWAY_API_KEY` auth:

- `createGatewayClient` — `getConnection`, `getToken`, `getBackfillRuns`, `upsertBackfillRun`, `executeApi` (proxies provider API), `getApiEndpoints`, `getAuthorizeUrl`
- `createRelayClient` — `dispatchWebhook(provider, payload, holdForReplay?)`, `replayCatchup(installationId, batchSize)`
- `createBackfillClient` — `estimate`, `trigger`

The stub at `packages/integration-tests/src/__stubs__/gateway-service-clients.ts` replaces the whole package for all integration tests with hardcoded "always active" responses.

#### Full Ingestion Flow (External Webhook Path)

```
External provider
  → POST /api/webhooks/:provider  [relay, HMAC verified]
  → Upstash Workflow trigger: relayBaseUrl/workflows/webhook-delivery
  → step: dedup SET NX Redis
  → step: persist gwWebhookDeliveries
  → step: resolve-connection (Redis cache → PlanetScale fallback)
  → step: QStash publishJSON → {consoleUrl}/api/gateway/ingress
  → QStash delivers → apps-console/event.capture fires
  → eventStore Inngest function
  → [neural chain as above]
  → QStash callback → POST /api/admin/delivery-status → status: "delivered"
```

#### Full Ingestion Flow (Backfill Path)

```
Caller → POST /api/trigger [backfill, X-API-Key]
  → Inngest send: apps-backfill/run.requested
  → backfillOrchestrator:
      → gw.getConnection → gateway GET /gateway/:id
      → gw.getBackfillRuns → gateway GET /gateway/:id/backfill-runs
      → step.invoke backfillEntityWorker per (resource × entityType):
          → gw.executeApi → gateway POST /gateway/:id/proxy/execute → provider API
          → relay.dispatchWebhook (holdForReplay=true) → relay POST /api/webhooks/:provider [X-API-Key, X-Backfill-Hold]
          → relay stores as "received", returns held:true (no QStash forward)
      → relay.replayCatchup loop → relay POST /admin/replay/catchup
          → relay clears Redis dedup key + triggers workflow per held delivery
          → Upstash Workflow → QStash → apps-console/event.capture
  → gw.upsertBackfillRun → gateway POST /gateway/:id/backfill-runs
```

#### Key Constants

- `RESOURCE_CACHE_TTL = 86_400` — Redis resource cache TTL (relay/lib/cache.ts:13)
- `GITHUB_RATE_LIMIT_BUDGET = 4000` — entity worker throttle requests/hour (backfill/lib/constants.ts:6)
- `MAX_PAGES = 500` — pagination safety cap (backfill/lib/constants.ts:13)
- Replay batch size: `200` (backfill-orchestrator.ts:229)
- Max replay iterations: `500` (backfill-orchestrator.ts:230)
- Entity worker step.invoke timeout: `"4h"`; finish timeout: `"2h"`
- Orchestrator finish timeout: `"8h"`; QStash retries to Console: `5`

---

## Architecture Documentation

### The In-Process Multi-Service Test Architecture

The core insight is that Hono apps expose a `.request(path, init)` method that processes a `Request` object completely in-memory without touching network sockets. The test harness exploits this in two ways:

1. **Direct app invocation** (`app.request(...)`) — used when the test knows which service it's targeting. No `fetch` involved.

2. **`installServiceRouter`** — replaces `globalThis.fetch` with a port-dispatch function. When service-internal code calls `fetch("http://localhost:4110/...")`, it goes to `gatewayApp.request(...)` in-process. This is how tests exercise real inter-service call paths (e.g. the backfill orchestrator calling the gateway to get connection details).

The Inngest handler capture pattern enables direct invocation of workflow logic:
- `makeInngestMock(events, capturedHandlers)` — the `createFunction` mock stores handler closures keyed by function ID
- After `await import("@backfill/orchestrator")`, `capturedHandlers.get("apps-backfill/run.orchestrator")` is callable
- Tests invoke it as `handler({ event, step })` — completely synchronous, no Inngest server required

### Per-Service vs. Multi-Service Test Boundary

| Layer | Location | Services | DB | Infrastructure |
|---|---|---|---|---|
| Unit/single-service | `apps/{service}/src/**/*.test.ts` | 1 | In-memory stub or PGlite | Handler capture, vi.mock |
| Multi-service integration | `packages/integration-tests/src/` | 2-4 | PGlite | In-process routing, shared Redis Map |

The new per-service files (9 untracked) all belong in the **single-service** layer. They test internal workflow logic and HTTP contract in isolation, with no cross-service HTTP calls.

### Coverage Gap: Neural Pipeline

The pipeline breaks into two testing segments today:

```
[Covered by packages/integration-tests]
external-webhook/backfill-trigger → relay → (QStash) → console/api/gateway/ingress

[NOT covered]
apps-console/event.capture → eventStore → entityGraph → entityEmbed → Pinecone
                           → notificationDispatch → Knock
```

To add neural pipeline coverage to `packages/integration-tests/`, the following additional mocks would be needed:
- `@api/console` Inngest functions registered via `createInngestRouteContext()` — the `makeInngestMock` already captures handlers but the neural functions haven't been imported in any integration test file
- `@vendor/db` Drizzle operators — already needed for the relay scenario matrix
- Pinecone client mock — `packages/console-pinecone/src/index.ts` exports `consolePineconeClient`
- Knock client mock — `@vendor/knock` (or whichever notifications vendor package is used)
- Embedding provider mock — `createEmbeddingProviderForWorkspace()` from the AI packages

---

## Code References

- `packages/integration-tests/src/harness.ts` — all mock factories and test helpers
- `packages/integration-tests/src/setup.ts` — global env bootstrap
- `packages/integration-tests/vitest.config.ts` — path aliases and inline deps config
- `packages/integration-tests/src/__stubs__/gateway-service-clients.ts` — hardcoded service client stub
- `packages/integration-tests/src/__stubs__/sentry-core.ts` — no-op Sentry stub
- `packages/integration-tests/src/full-stack-connection-lifecycle.integration.test.ts` — Suite 5 (canonical multi-service test)
- `packages/integration-tests/src/event-ordering.integration.test.ts` — Suite 6 (permutation engine)
- `apps/gateway/src/routes/gateway-scenario-matrix.test.ts` — 72-scenario gateway matrix (new, untracked)
- `apps/relay/src/routes/relay-scenario-matrix.test.ts` — 72-scenario relay matrix (new, untracked)
- `apps/relay/src/routes/relay-fault-injection.test.ts` — relay fault injection (new, untracked)
- `apps/relay/src/lib/replay.test.ts` — `replayDeliveries` unit test (new, untracked)
- `apps/backfill/src/workflows/scenario-matrix.test.ts` — 48+108 scenario backfill matrix (new, untracked)
- `apps/backfill/src/workflows/fault-injection.test.ts` — backfill fault injection (new, untracked)
- `apps/backfill/src/workflows/step-replay.test.ts` — Inngest step memoization idempotency (new, untracked)
- `api/console/src/inngest/workflow/neural/event-store.ts:109` — `eventStore` function (13 steps)
- `api/console/src/inngest/workflow/neural/entity-graph.ts:15` — `entityGraph` function
- `api/console/src/inngest/workflow/neural/entity-embed.ts:29` — `entityEmbed` function (debounced 30s)
- `api/console/src/inngest/workflow/neural/narrative-builder.ts:31` — `buildEntityNarrative()`
- `api/console/src/inngest/workflow/neural/scoring.ts:90` — `scoreSignificance()`
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — `resolveEdges()` (8-phase algorithm)
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:137` — `extractEntities()`
- `api/console/src/inngest/workflow/neural/on-failure-handler.ts:44` — `createNeuralOnFailureHandler()`
- `api/console/src/inngest/workflow/notifications/dispatch.ts:8` — `notificationDispatch`
- `packages/gateway-service-clients/src/urls.ts` — all service URL resolution
- `packages/gateway-service-clients/src/gateway.ts:28` — `createGatewayClient`
- `packages/gateway-service-clients/src/relay.ts:21` — `createRelayClient`
- `apps/relay/src/lib/cache.ts` — Redis key patterns
- `apps/relay/src/routes/webhooks.ts:45` — inbound webhook handler (both paths)
- `apps/relay/src/routes/workflows.ts:39` — Upstash Workflow `webhook-delivery` handler
- `apps/backfill/src/workflows/backfill-orchestrator.ts` — Inngest orchestrator function
- `apps/backfill/src/workflows/entity-worker.ts` — Inngest entity worker function
- `apps/backfill/src/lib/constants.ts` — key rate limit and pagination constants

## Open Questions

1. **How to add neural pipeline integration tests** — The `makeInngestMock` in `harness.ts` already captures `createFunction` handlers. What would be needed is: (a) importing the neural index at module load time in a test file, (b) adding Pinecone/Knock/embedding provider mocks, (c) writing a test that calls `capturedHandlers.get("apps-console/event.store")({ event, step })` after a webhook delivery completes.

2. **`cartesian<T>()` duplication** — The same permutation engine is copy-pasted into three per-service test files. It doesn't exist yet in `harness.ts` — if it were added there, the per-service files could import it from the package instead.

3. **New per-service files and `packages/integration-tests/` coexistence** — The 9 new test files test at the single-service level. There is no overlap with the multi-service integration suites — they cover different levels of the stack. Running both together would require the new files to either be included in the `packages/integration-tests/` package or run independently via `pnpm --filter @lightfast/{gateway,relay,backfill} test`.

4. **`gateway-service-clients.ts` stub hardcodes "active" status** — The stub in `__stubs__/` always returns `{ status: "active" }` from `getConnection`. Tests that need to simulate revoked connections must either override this stub locally or call `gatewayApp.request()` directly (which uses the PGlite DB state). The backfill connections API suite (Suite 3) uses the direct gateway approach for this reason.
