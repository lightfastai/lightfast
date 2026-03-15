# Neural Pipeline Integration Tests Implementation Plan

## Overview

Add integration test coverage for the `eventStore → entityGraph → entityEmbed` Inngest function chain to `packages/integration-tests/`. This is the only part of the ingestion pipeline with zero multi-service test coverage. The plan also adds permutation tests verifying that concurrent entity events converge to identical graph state regardless of processing order.

## Current State Analysis

`packages/integration-tests/` has 10 suites (Suite 0–9) covering the full path from external webhooks through relay → backfill → QStash delivery to Console. Coverage stops at `apps-console/event.capture`. Everything downstream — the four-function neural Inngest chain — is untested at the integration level.

**What's missing:**
- No mocks exist for `@repo/console-pinecone`, `@repo/console-embed`, or `@vendor/knock`
- No path aliases for `api/console/src/inngest/` in `packages/integration-tests/vitest.config.ts`
- `cartesian<T>()` is copy-pasted in 3 per-service test files but not exported from `harness.ts`
- `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` are missing from `setup.ts` (read by `@vendor/inngest/env` at `api/console/src/inngest/client/client.ts`)

**Key implementation facts:**
- The three neural functions are registered by calling `inngest.createFunction(...)` at module load time in their respective files. Importing `api/console/src/inngest/workflow/neural/index.ts` triggers all three registrations.
- Function IDs: `"apps-console/event.store"`, `"apps-console/entity.graph"`, `"apps-console/entity.embed"`
- `inngest.send()` is called inside `step.run()` closures (not via `step.sendEvent`). The mocked `Inngest` class's `send` instance method captures emitted events.
- `check-event-allowed` returns `true` if `providerConfig.sync.events` is empty/undefined (all events pass).
- GitHub `resourceId` = `String(attributes.repoId)` — the `workspaceIntegrations.providerResourceId` must match.
- `workspaceIntegrations` has FKs to both `gwInstallations` and `orgWorkspaces` — both must be seeded before the integration row.

## Desired End State

After this plan:
1. `pnpm --filter @lightfast/integration-tests test` includes a `neural-pipeline.integration.test.ts` suite covering the eventStore → entityGraph → entityEmbed chain
2. `event-ordering.integration.test.ts` includes Suite 6.5: 3-event permutation test verifying identical final graph state across all 6 orderings
3. `cartesian<T>()` is exported from `harness.ts` (the existing per-service copies remain in place — no migration of those files)

### Verification

#### Automated:
- [x] `pnpm --filter @lightfast/integration-tests test` passes with all new test cases
- [x] `pnpm --filter @lightfast/integration-tests typecheck` passes (no TypeScript errors in new test file)
- [x] `pnpm check` passes (no lint errors)

#### Manual:
- [ ] Review that the Pinecone upsert assertion in Suite 4 checks the correct `id` format (`ent_${externalId}`) and metadata shape (`layer: "entities"`, `provider: "github"`)
- [ ] Confirm permutation test Suite 6.7 is non-flaky across 5 consecutive runs: `for i in $(seq 5); do pnpm --filter @lightfast/integration-tests test --reporter=verbose 2>&1 | grep "6.7"; done`

## What We're NOT Doing

- **Not adding Knock/notificationDispatch coverage** — the three guard conditions are trivially simple; test effort is better spent on the graph/vector chain
- **Not migrating the 9 untracked per-service test files** — they are single-service tests and serve a different purpose; the plan scope is neural pipeline coverage only
- **Not removing the 3 local `cartesian()` copies** — they stay in place; we only add the export to `harness.ts`
- **Not adding a true end-to-end relay→neural test** — that can build on this foundation later

---

## Phase 1: Harness & Config Extensions

### Overview

Extend `vitest.config.ts`, `setup.ts`, and `harness.ts` to support neural pipeline test files. No new test files are created in this phase.

### Changes Required

#### 1. `packages/integration-tests/src/setup.ts`

Add Inngest env vars read by `@vendor/inngest/env` at module load (called from `api/console/src/inngest/client/client.ts`):

```typescript
// Neural pipeline — Inngest client reads these at module load via @vendor/inngest/env
process.env.INNGEST_EVENT_KEY = "test-inngest-event-key";
process.env.INNGEST_SIGNING_KEY = "test-inngest-signing-key";
```

#### 2. `packages/integration-tests/vitest.config.ts`

**Add to `server.deps.inline`:**

```typescript
"@repo/console-pinecone",
"@repo/console-embed",
"@vendor/knock",
"@vendor/embed",
"@repo/console-providers",
"@repo/console-validation",
```

**Add to `resolve.alias`:**

```typescript
"@console/neural": resolve(root, "api/console/src/inngest/workflow/neural/index.ts"),
"@console/inngest-client": resolve(root, "api/console/src/inngest/client/client.ts"),
```

#### 3. `packages/integration-tests/src/harness.ts`

**Add `cartesian<T>()` export** (identical implementation to the per-service copies):

```typescript
/**
 * Generates all combinations of dimension arrays.
 * Exported here to avoid duplication; per-service test files have local copies
 * for historical reasons.
 */
export function cartesian<T extends Record<string, readonly unknown[]>>(
  dims: T
): Array<{ [K in keyof T]: T[K][number] }> {
  const keys = Object.keys(dims) as (keyof T)[];
  const values = keys.map((k) => dims[k]);
  if (values.some((v) => v.length === 0)) return [];
  const indices = values.map(() => 0);
  const results: Array<{ [K in keyof T]: T[K][number] }> = [];
  while (true) {
    const entry = {} as { [K in keyof T]: T[K][number] };
    for (let i = 0; i < keys.length; i++) {
      (entry as Record<keyof T, unknown>)[keys[i]!] = values[i]![indices[i]!];
    }
    results.push(entry);
    let carry = 1;
    for (let i = indices.length - 1; i >= 0 && carry; i--) {
      indices[i]! += carry;
      if (indices[i]! >= values[i]!.length) {
        indices[i] = 0;
        carry = 1;
      } else {
        carry = 0;
      }
    }
    if (carry) break;
  }
  return results;
}
```

**Add `makeConsolePineconeMock()` factory:**

```typescript
/**
 * Mock for @repo/console-pinecone's consolePineconeClient.
 * Captures all upsertVectors calls into the provided array.
 */
export function makeConsolePineconeMock(upserts: unknown[]) {
  return {
    consolePineconeClient: {
      upsertVectors: vi.fn(async (...args: unknown[]) => {
        upserts.push(args);
      }),
    },
  };
}
```

**Add `makeEmbeddingProviderMock()` factory:**

```typescript
/**
 * Mock for @repo/console-embed's createEmbeddingProviderForWorkspace.
 * Returns a provider that always returns a fixed 1024-dim zero vector.
 */
export function makeEmbeddingProviderMock() {
  const embed = vi.fn().mockResolvedValue([Array(1024).fill(0.1)]);
  const createEmbeddingProviderForWorkspace = vi.fn().mockReturnValue({ embed });
  return { createEmbeddingProviderForWorkspace, embed };
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/integration-tests typecheck` passes after config changes
- [x] All existing 10 suites still pass: `pnpm --filter @lightfast/integration-tests test`

---

## Phase 2: Neural Pipeline Integration Test

### Overview

Create `packages/integration-tests/src/neural-pipeline.integration.test.ts` covering the three-function chain. Uses PGlite for DB state (same as existing suites), in-memory mocks for Pinecone and embedding, and the handler-capture pattern established in the backfill/relay tests.

### DB Fixture Data

All tests share a common fixture seeded by `seedNeuralFixtures(db)`:

```
orgWorkspaces:
  id: "ws_test001"
  clerkOrgId: "org_test001"
  name: "test-workspace"
  slug: "test-ws"
  settings: {
    version: 1,
    embedding: {
      indexName: "lightfast-v1",
      namespaceName: "org_test001:ws_ws_test001",
      embeddingDim: 1024,
      embeddingModel: "embed-english-v3.0",
      embeddingProvider: "cohere",
      pineconeMetric: "cosine",
      pineconeCloud: "aws",
      pineconeRegion: "us-east-1",
    }
  }

gwInstallations:
  id: "inst_test001"
  provider: "github"
  externalId: "gh_install_123"
  connectedBy: "user_test001"
  orgId: "org_test001"
  status: "active"

workspaceIntegrations:
  workspaceId: "ws_test001"
  installationId: "inst_test001"
  provider: "github"
  connectedBy: "user_test001"
  providerResourceId: "567890123"          ← matches attributes.repoId in test events
  providerConfig: {
    type: "github",
    repoId: "567890123",
    repoName: "org/repo",
    installationId: "gh_install_123",
    sync: { autoSync: true }               ← no events filter → all events allowed
  }
```

### PostTransformEvent Fixture

```typescript
const baseEvent: PostTransformEvent = {
  deliveryId: "del_test001",
  sourceId: "github:pr:org/repo#100:merged",
  provider: "github",
  eventType: "pull_request.merged",
  occurredAt: "2026-03-14T10:00:00.000Z",
  entity: {
    provider: "github",
    entityType: "pr",
    entityId: "org/repo#100",
    title: "feat: add neural pipeline",
    url: "https://github.com/org/repo/pull/100",
    state: "merged",
  },
  relations: [
    {
      provider: "github",
      entityType: "repository",
      entityId: "org/repo",
      title: null,
      url: null,
      relationshipType: "belongs_to",
    },
    {
      provider: "github",
      entityType: "commit",
      entityId: "abc123def456",
      title: null,
      url: null,
      relationshipType: "merged_via",
    },
  ],
  title: "feat: add neural pipeline",
  body: "Implements the neural pipeline for entity embedding.",
  attributes: { repoId: 567890123 },    ← String(567890123) = "567890123" matches providerResourceId
};
```

### File: `packages/integration-tests/src/neural-pipeline.integration.test.ts`

**Structure (6-step wiring pattern):**

```typescript
// Step 1 — vi.hoisted(): allocate shared state
const { capturedHandlers, inngestEvents, pineconeUpserts } = vi.hoisted(() => ({
  capturedHandlers: new Map<string, (args: { event: unknown; step: unknown }) => Promise<unknown>>(),
  inngestEvents: [] as unknown[],
  pineconeUpserts: [] as unknown[],
}));

const { createEmbeddingProviderForWorkspace, embed } = vi.hoisted(() => {
  const embed = vi.fn().mockResolvedValue([Array(1024).fill(0.1)]);
  return {
    createEmbeddingProviderForWorkspace: vi.fn().mockReturnValue({ embed }),
    embed,
  };
});

// Step 2 — vi.mock() declarations (hoisted before imports)
vi.mock("@db/console/client", () => ({ get db() { return db; } }));

vi.mock("@vendor/inngest", () => ({
  Inngest: class {
    send = vi.fn(async (evts: unknown) => {
      const arr = Array.isArray(evts) ? evts : [evts];
      inngestEvents.push(...arr);
      return arr.map((_, i) => ({ id: `test-event-${i}` }));
    });
    createFunction = (
      config: { id: string },
      _trigger: unknown,
      handler: (args: { event: unknown; step: unknown }) => Promise<unknown>
    ) => {
      capturedHandlers.set(config.id, handler);
      return { id: config.id };
    };
  },
  NonRetriableError: class extends Error {
    name = "NonRetriableError" as const;
    constructor(message: string) { super(message); }
  },
  RetryAfterError: class extends Error {
    name = "RetryAfterError" as const;
    constructor(message: string) { super(message); }
  },
}));

vi.mock("@vendor/inngest/hono", () => ({ serve: vi.fn(() => () => new Response("ok")) }));

vi.mock("@repo/console-pinecone", () => ({
  consolePineconeClient: {
    upsertVectors: vi.fn(async (...args: unknown[]) => { pineconeUpserts.push(args); }),
  },
}));

vi.mock("@repo/console-embed", () => ({ createEmbeddingProviderForWorkspace }));

vi.mock("@vendor/knock", () => ({ notifications: null }));

// Step 3 — import neural modules (triggers createFunction registrations)
// Placed in beforeAll to ensure mocks are installed first
// (Static imports at module top would also work due to vi.mock hoisting)

// Step 4 — lifecycle hooks
let db: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  db = await createTestDb();
  await import("@console/neural"); // triggers eventStore, entityGraph, entityEmbed registrations
});

beforeEach(async () => {
  inngestEvents.length = 0;
  pineconeUpserts.length = 0;
  await resetTestDb();
  vi.clearAllMocks();
  // Re-install createEmbeddingProviderForWorkspace mock (cleared by clearAllMocks)
  createEmbeddingProviderForWorkspace.mockReturnValue({ embed });
  embed.mockResolvedValue([Array(1024).fill(0.1)]);
  // Seed shared fixtures
  await seedNeuralFixtures(db);
});

afterAll(async () => { await closeTestDb(); });
```

### Test Suites

**Suite 1: `eventStore` — happy path**

```
inputs: apps-console/event.capture for baseEvent
assertions:
  - workspaceWorkflowRuns: 1 row, status = "completed"
  - workspaceEvents: 1 row, sourceId = baseEvent.sourceId
  - workspaceEntities: ≥1 row (primary entity: category matching entity.entityType, key matching entity.entityId)
  - workspaceEntityEvents: ≥1 junction row linking entity to event
  - inngestEvents: contains 1x apps-console/entity.upserted and 1x apps-console/event.stored
  - return value: { status: "stored" }
```

**Suite 2: `eventStore` — duplicate event (idempotency)**

```
inputs: 2x apps-console/event.capture with same sourceId
assertions:
  - first call: returns { status: "stored" }
  - second call: returns { status: "filtered", reason: ... }
  - workspaceEvents: exactly 1 row (no duplicate insert)
```

**Suite 3: `eventStore` — disallowed event type**

```
setup: update workspaceIntegrations.providerConfig.sync.events = ["issue_opened"]
        (explicitly whitelist only issue_opened, filtering out pull_request.merged)
assertions:
  - eventStore returns { status: "filtered", reason: "Event type not enabled in source config" }
  - workspaceEvents: 0 rows
```

**Suite 4: `eventStore` → `entityGraph` chain**

```
steps:
  1. Run eventStore with baseEvent
  2. Extract apps-console/entity.upserted from inngestEvents
  3. Run entityGraph with that event
assertions after step 3:
  - entityGraph returns { edgeCount: N } (N may be 0 for first event — no prior co-occurrences)
  - inngestEvents contains apps-console/entity.graphed
  - apps-console/entity.graphed.data.entityExternalId matches entity.upserted.data.entityExternalId
```

**Suite 5: `eventStore` → `entityGraph` → `entityEmbed` full chain**

```
steps:
  1. Run eventStore with baseEvent
  2. Run entityGraph with entity.upserted event
  3. Run entityEmbed with entity.graphed event
assertions after step 3:
  - pineconeUpserts: 1 entry
  - pineconeUpserts[0][1].ids[0] = `ent_${entityExternalId}`
  - pineconeUpserts[0][0] = "lightfast-v1"  (indexName from workspace settings)
  - pineconeUpserts[0][1].metadata[0].layer = "entities"
  - pineconeUpserts[0][1].metadata[0].provider = "github"
  - embed mock: called once
  - entityEmbed returns { status: "embedded" } or similar
```

**Suite 6: `entityEmbed` — NonRetriableError on missing entity**

```
inputs: apps-console/entity.graphed with entityExternalId = "nonexistent"
assertions:
  - entityEmbed step throws / rejects with NonRetriableError (or error message contains "not found")
  - pineconeUpserts: 0 entries
```

**Suite 7: `eventStore` — missing repoId attribute (no resourceId → filtered)**

```
inputs: event with attributes = {} (no repoId)
assertions:
  - eventStore returns { status: "filtered" } (check-event-allowed step returns false)
  - workspaceEvents: 0 rows
```

### Seeding Helper

```typescript
async function seedNeuralFixtures(db: TestDb) {
  const { gwInstallations, orgWorkspaces, workspaceIntegrations } =
    await import("@db/console/schema");

  await db.insert(gwInstallations).values({
    id: "inst_test001",
    provider: "github",
    externalId: "gh_install_123",
    connectedBy: "user_test001",
    orgId: "org_test001",
    status: "active",
  });

  await db.insert(orgWorkspaces).values({
    id: "ws_test001",
    clerkOrgId: "org_test001",
    name: "test-workspace",
    slug: "test-ws",
    settings: {
      version: 1,
      embedding: {
        indexName: "lightfast-v1",
        namespaceName: "org_test001:ws_ws_test001",
        embeddingDim: 1024,
        embeddingModel: "embed-english-v3.0",
        embeddingProvider: "cohere",
        pineconeMetric: "cosine",
        pineconeCloud: "aws",
        pineconeRegion: "us-east-1",
      },
    },
  });

  await db.insert(workspaceIntegrations).values({
    workspaceId: "ws_test001",
    installationId: "inst_test001",
    provider: "github",
    connectedBy: "user_test001",
    providerResourceId: "567890123",
    providerConfig: {
      type: "github",
      repoId: "567890123",
      repoName: "org/repo",
      installationId: "gh_install_123",
      sync: { autoSync: true },
    },
  });
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/integration-tests test` passes (all 7 new suites + existing 10)
- [x] `pnpm --filter @lightfast/integration-tests typecheck` passes

#### Manual Verification:
- [ ] Suite 5 (full chain): verify Pinecone upsert assertion checks correct `id` format and metadata shape
- [ ] Suite 6 (NonRetriableError): verify the error is not swallowed — the test should fail if no error is thrown

**Implementation Note**: After all automated tests pass, pause for manual review of Suite 5 and Suite 6 assertions before proceeding to Phase 3.

---

## Phase 3: Permutation Tests — Neural Graph Convergence

### Overview

Add Suite 6.5 to `packages/integration-tests/src/event-ordering.integration.test.ts` using `withEventPermutations` to verify that 3 concurrent events for co-occurring entities produce identical `workspaceEdges` state regardless of processing order.

### Why This Matters

`resolveEdges()` uses `ON CONFLICT DO NOTHING` with canonical edge keys (`min(a,b)-max(a,b)-type`). When 3 events arrive and each triggers `entityGraph`, the edges depend on which entity rows exist at query time. Processing order affects which co-occurrences are found — but the _final_ converged state (after all 3 entityGraph calls) should be identical. This tests the convergence property of the co-occurrence algorithm.

### Fixture

3 events, all in the same workspace, all touching the same GitHub PR `org/repo#100` via `relations`:

```typescript
const eventA: PostTransformEvent = {
  sourceId: "github:pr:org/repo#100:opened",
  eventType: "pull_request.opened",
  entity: { entityType: "pr", entityId: "org/repo#100", ... },
  relations: [
    { entityType: "repository", entityId: "org/repo", relationshipType: "belongs_to", ... },
  ],
  attributes: { repoId: 567890123 },
  ...
};

const eventB: PostTransformEvent = {
  sourceId: "github:commit:abc123:created",
  eventType: "push",
  entity: { entityType: "commit", entityId: "abc123", ... },
  relations: [
    { entityType: "repository", entityId: "org/repo", relationshipType: "pushed_to", ... },
    { entityType: "pr", entityId: "org/repo#100", relationshipType: "closes", ... },
  ],
  attributes: { repoId: 567890123 },
  ...
};

const eventC: PostTransformEvent = {
  sourceId: "github:issue:org/repo#50:opened",
  eventType: "issues.opened",
  entity: { entityType: "issue", entityId: "org/repo#50", ... },
  relations: [
    { entityType: "repository", entityId: "org/repo", relationshipType: "belongs_to", ... },
  ],
  attributes: { repoId: 567890123 },
  ...
};
```

These 3 events share `org/repo` as a relation, meaning their entities co-occur. After processing all 3:
- `pr:org/repo#100` and `commit:abc123` share 2 events (both relate to the PR) → edge
- `pr:org/repo#100` and `issue:org/repo#50` share 1 event (repo relation) → potential edge
- `commit:abc123` and `issue:org/repo#50` share 1 event → potential edge

The invariant: the total distinct edge count after all 3 eventStore + entityGraph calls is the same for all 6 orderings.

### Suite 6.5 Structure

Add to `event-ordering.integration.test.ts` in the `describe("6 — Event Ordering (Permutation Testing)")` block:

```typescript
describe("6.5 — neural entity co-occurrence edges converge under 3! event orderings", () => {
  // Requires neural handler capture — add import and mock setup
  // (same vi.mock pattern as neural-pipeline.integration.test.ts)

  it("produces identical workspaceEdges count for all orderings", async () => {
    await withEventPermutations({
      effects: [eventA, eventB, eventC].map((evt) => ({
        label: evt.sourceId,
        fn: async () => {
          const step = makeStep();
          // Run eventStore → get entity.upserted → run entityGraph
          const esResult = await eventStoreHandler({
            event: { data: { workspaceId: "ws_test001", clerkOrgId: "org_test001", sourceEvent: evt } },
            step,
          });
          if (esResult?.status !== "stored") return;
          const upsertedEvent = inngestEvents.find(
            (e) => e.name === "apps-console/entity.upserted" && e.data.entityExternalId === ...
          );
          if (!upsertedEvent) return;
          await entityGraphHandler({ event: { data: upsertedEvent.data }, step: makeStep() });
        },
      })),
      reset: async () => {
        inngestEvents.length = 0;
        await resetTestDb();
        vi.clearAllMocks();
        await seedNeuralFixtures(db);
      },
      setup: async () => {},
      invariant: async () => {
        const edges = await db.select().from(workspaceEdgesTable);
        // Same count for all orderings — exact count depends on edge rule evaluation
        // Assert count > 0 and consistent
        expect(edges.length).toBeGreaterThan(0);
        // Store count in first run and assert equality across all runs
      },
      maxRuns: 6, // exactly 3! = 6
    });
  });
});
```

**Note on `withEventPermutations` signature:** Review `harness.ts:529` to align the exact callback parameter names (`setup`/`reset`/`invariant` vs the actual API). The invariant closure needs access to the run-0 edge count to compare subsequent runs — adjust using a module-level variable or closure.

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @lightfast/integration-tests test event-ordering` passes with Suite 6.7 included
- [ ] Suite 6.7 is non-flaky: run 3× and assert all 6 orderings pass each time

#### Manual Verification:
- [x] Confirm the edge count assertion in Suite 6.7 is tight — `expect(edges.length).toBe(1)` (issue#50↔issue#51 "references" edge via PR co-occurrence). Also fixed `edge-resolver.ts` to normalize canonical direction in `deduplicateEdgeCandidates` to prevent bidirectional duplicate inserts across separate `resolveEdges` calls.

**Implementation Note**: After Suite 6.5 is green, tighten the invariant from `> 0` to the exact edge count discovered during the first green run.

---

## References

- Research doc: `thoughts/shared/research/2026-03-14-multi-app-integration-testing.md`
- `packages/integration-tests/src/harness.ts` — `makeStep`, `withEventPermutations`, mock factories
- `packages/integration-tests/src/setup.ts` — env bootstrap
- `packages/integration-tests/vitest.config.ts` — aliases and inline deps
- `api/console/src/inngest/workflow/neural/event-store.ts:109` — eventStore (13 steps)
- `api/console/src/inngest/workflow/neural/entity-graph.ts:15` — entityGraph
- `api/console/src/inngest/workflow/neural/entity-embed.ts:47` — entityEmbed (debounce config)
- `api/console/src/inngest/workflow/neural/edge-resolver.ts:26` — resolveEdges (8-phase)
- `api/console/src/inngest/client/client.ts:125` — Inngest singleton with eventsMap
- `packages/console-pinecone/src/index.ts` — consolePineconeClient export
- `packages/console-embed/src/utils.ts` — createEmbeddingProviderForWorkspace
- `db/console/src/schema/tables/workspace-integrations.ts` — providerResourceId FK constraints
- `db/console/src/schema/tables/org-workspaces.ts` — WorkspaceSettings.embedding shape
