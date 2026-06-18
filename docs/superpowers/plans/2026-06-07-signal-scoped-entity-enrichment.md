# Signal-Scoped Entity Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build signal-scoped X/GitHub enrichment from persisted signal links into the canonical entity graph, with a temporary `orgPeople` projection bridge for existing signal UI resolution.

**Architecture:** Signal entity indexing emits a new enrichment event after persisting links. A dedicated workflow reloads unresolved persisted links, fetches eligible X/GitHub profiles through org provider access, adapts them into `EntityObservation[]`, and emits the existing `app/connector.profile.observed` graph ingress event. The graph workflow persists canonical entities, projects exact X/GitHub handle identities into `orgPeople`, and reconciles unresolved signal links.

**Tech Stack:** TypeScript, pnpm, Turborepo, Inngest, Drizzle/MySQL, Zod, Vitest, X/GitHub emulators, agent-browser.

---

## File Structure

- Modify `packages/app-validation/src/schemas/people.ts` to add `entity_graph` to `personSourceSchema`.
- Modify `db/app/src/utils/people.ts` to add graph-projection upsert helpers for `orgPeople`.
- Modify `db/app/src/utils/signal-entity-links.ts` to add signal enrichment target extraction from persisted links.
- Modify `db/app/src/index.ts` to export the new DB helpers.
- Modify `api/app/src/inngest/schemas/app.ts` to add `app/signal.entity-enrichment.requested` and optional source metadata on `app/connector.profile.observed`.
- Modify `api/app/src/inngest/workflow/index-signal-entities.ts` to emit enrichment requests after persisted team-visible signal links.
- Create `api/app/src/services/entity-enrichment/adapters.ts` for pure X/GitHub payload-to-observation adapters.
- Create `api/app/src/services/entity-enrichment/ids.ts` for stable ingestion/event ids.
- Create `api/app/src/services/entity-enrichment/provider-fetchers.ts` for org-scoped X/GitHub profile fetching.
- Create `api/app/src/inngest/workflow/enrich-signal-entities.ts` for the enrichment workflow.
- Modify `api/app/src/inngest/workflow/run-entity-resolution.ts` to project graph people into `orgPeople` and reconcile signal links.
- Modify `api/app/src/inngest/index.ts` to register the new workflow.
- Modify `packages/x-app-node/src/tools.ts` to request rich X user fields.
- Modify `api/app/src/services/connectors/x-mcp-bridge.ts` to export a reusable X access-token helper or move it to a reusable file.
- Modify `packages/github-app-node/src/user.ts` and `packages/github-app-node/src/index.ts` to preserve richer profile fields and add `getGitHubUserByLogin`.
- Modify `emulators/x/src/fixtures.ts` and `emulators/x/src/plugin/users.ts` to return richer user payloads.
- Modify `emulators/github/src/fixtures.ts` and `emulators/github/src/plugin/compatible-routes.ts` to support `GET /users/{login}` with richer profile fields.
- Add or extend tests in `db/app/src/__tests__/signal-entity-links.test.ts`, `db/app/src/__tests__/people.test.ts`, `api/app/src/__tests__/entity-index-workflow.test.ts`, `api/app/src/__tests__/entity-resolution-workflow.test.ts`, `api/app/src/__tests__/signal-entity-enrichment-workflow.test.ts`, `packages/x-app-node/src/__tests__/tools.test.ts`, `packages/github-app-node/src/__tests__/user.test.ts`, `emulators/x/src/__tests__/*`, and `emulators/github/src/__tests__/*`.
- Create `docs/superpowers/runbooks/2026-06-07-signal-enrichment-agent-browser.md` for the UI-driven local verification runbook.

## Task 1: Add `entity_graph` People Source

**Files:**
- Modify: `packages/app-validation/src/schemas/people.ts`
- Modify: `packages/app-validation/src/__tests__/people.test.ts`

- [ ] **Step 1: Write the failing contract test**

Add this expectation to `packages/app-validation/src/__tests__/people.test.ts`:

```ts
expect(personSourceSchema.options).toEqual([
  "signal",
  "team_member",
  "mixed",
  "entity_graph",
]);
expect(personSourceSchema.parse("entity_graph")).toBe("entity_graph");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @repo/app-validation test -- people.test.ts
```

Expected: FAIL because `entity_graph` is not in `personSourceSchema.options`.

- [ ] **Step 3: Add the schema value**

Update `packages/app-validation/src/schemas/people.ts`:

```ts
export const personSourceSchema = z.enum([
  "signal",
  "team_member",
  "mixed",
  "entity_graph",
]);
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
pnpm --filter @repo/app-validation test -- people.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app-validation/src/schemas/people.ts packages/app-validation/src/__tests__/people.test.ts
git commit -m "feat: add entity graph people source"
```

## Task 2: Extract Signal Enrichment Targets From Persisted Links

**Files:**
- Modify: `db/app/src/utils/signal-entity-links.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/__tests__/signal-entity-links.test.ts`

- [ ] **Step 1: Write target extraction tests**

Add tests covering:

```ts
expect(
  listSignalEntityEnrichmentTargets(db, {
    clerkOrgId,
    signalId,
  })
).resolves.toMatchObject({
  github: [
    {
      provider: "github",
      normalizedValue: "avachen",
      value: "avachen",
      linkIds: [expect.any(Number)],
    },
  ],
  skipped: expect.arrayContaining([
    expect.objectContaining({ reason: "unsupported_mention_kind" }),
  ]),
  x: [
    {
      provider: "x",
      normalizedValue: "ava_ai",
      value: "ava_ai",
      linkIds: [expect.any(Number), expect.any(Number)],
    },
  ],
});
```

Test fixtures should include unresolved links for:

- `@ava_ai` -> X target.
- `https://x.com/ava_ai` -> same X target, deduped.
- `https://github.com/avachen` -> GitHub target.
- `name`, `email`, `https://linkedin.com/in/ava`, and bare `ava_ai` handle -> skipped.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @db/app test -- signal-entity-links.test.ts
```

Expected: FAIL because `listSignalEntityEnrichmentTargets` is not exported.

- [ ] **Step 3: Implement the helper**

Add exported types and function to `db/app/src/utils/signal-entity-links.ts`:

```ts
export interface SignalEntityEnrichmentTarget {
  linkIds: number[];
  normalizedValue: string;
  provider: "x" | "github";
  value: string;
}

export interface SignalEntityEnrichmentSkippedTarget {
  anchorText: string;
  linkId: number;
  mentionKind: SignalEntityLink["mentionKind"];
  reason:
    | "already_resolved"
    | "unsupported_mention_kind"
    | "unsupported_profile_url"
    | "ambiguous_handle"
    | "over_cap";
}

export interface SignalEntityEnrichmentTargetsResult {
  github: SignalEntityEnrichmentTarget[];
  skipped: SignalEntityEnrichmentSkippedTarget[];
  x: SignalEntityEnrichmentTarget[];
}
```

Implementation rules:

```ts
const MAX_TARGETS_PER_PROVIDER = 10;

function targetFromLink(link: SignalEntityLink):
  | { provider: "x" | "github"; value: string }
  | { reason: SignalEntityEnrichmentSkippedTarget["reason"] } {
  if (link.resolvedPersonId) {
    return { reason: "already_resolved" };
  }
  if (link.mentionKind === "handle") {
    return link.anchorText.trim().startsWith("@")
      ? { provider: "x", value: link.anchorText.trim().replace(/^@/, "") }
      : { reason: "ambiguous_handle" };
  }
  if (link.mentionKind !== "profile_url") {
    return { reason: "unsupported_mention_kind" };
  }
  const parsed = profileTargetFromUrl(link.anchorText);
  return parsed ?? { reason: "unsupported_profile_url" };
}
```

Use `new URL()`, lower-case hosts, strip `www.`, require exactly one path segment, reject reserved X/Twitter path segments already present in the deterministic extractor, dedupe by `${provider}:${normalizedValue}`, and append over-cap targets to `skipped`.

- [ ] **Step 4: Export the helper**

Add exports in `db/app/src/index.ts`:

```ts
export {
  listSignalEntityEnrichmentTargets,
  type SignalEntityEnrichmentTarget,
  type SignalEntityEnrichmentTargetsResult,
  type SignalEntityEnrichmentSkippedTarget,
} from "./utils/signal-entity-links";
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @db/app test -- signal-entity-links.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/signal-entity-links.ts db/app/src/index.ts db/app/src/__tests__/signal-entity-links.test.ts
git commit -m "feat: derive signal enrichment targets"
```

## Task 3: Add Event Schemas

**Files:**
- Modify: `api/app/src/inngest/schemas/app.ts`
- Modify: `api/app/src/__tests__/entity-index-workflow.test.ts`
- Modify: `api/app/src/__tests__/entity-resolution-workflow.test.ts`

- [ ] **Step 1: Write schema tests**

Add assertions that parse:

```ts
appEvents["app/signal.entity-enrichment.requested"].schema.parse({
  clerkOrgId: "org_123",
  reason: "signal_indexed",
  signalId: "signal_123",
});

appEvents["app/connector.profile.observed"].schema.parse({
  clerkOrgId: "org_123",
  ingestionId: "ing_123",
  observations: [validObservation],
  resolverVersion: "signal-entity-enrichment-v1",
  source: {
    kind: "signal_entity_enrichment",
    reason: "signal_indexed",
    signalId: "signal_123",
  },
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm --filter @api/app test -- entity-index-workflow.test.ts entity-resolution-workflow.test.ts
```

Expected: FAIL because the new event and optional source metadata do not exist.

- [ ] **Step 3: Implement schemas**

Add:

```ts
const signalEntityEnrichmentReasonSchema = z.enum([
  "signal_indexed",
  "manual_retry",
  "backfill",
]);

const connectorProfileObservedSourceSchema = z
  .object({
    kind: z.literal("signal_entity_enrichment"),
    reason: signalEntityEnrichmentReasonSchema,
    signalId: signalIdSchema,
  })
  .strict();
```

Add event:

```ts
"app/signal.entity-enrichment.requested": eventType(
  "app/signal.entity-enrichment.requested",
  {
    schema: z.object({
      clerkOrgId: z.string().min(1),
      reason: signalEntityEnrichmentReasonSchema,
      signalId: signalIdSchema,
    }),
  }
),
```

Extend `app/connector.profile.observed`:

```ts
source: connectorProfileObservedSourceSchema.optional(),
```

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @api/app test -- entity-index-workflow.test.ts entity-resolution-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/schemas/app.ts api/app/src/__tests__/entity-index-workflow.test.ts api/app/src/__tests__/entity-resolution-workflow.test.ts
git commit -m "feat: add signal entity enrichment events"
```

## Task 4: Queue Enrichment After Signal Entity Indexing

**Files:**
- Modify: `api/app/src/inngest/workflow/index-signal-entities.ts`
- Modify: `api/app/src/__tests__/entity-index-workflow.test.ts`

- [ ] **Step 1: Write workflow test**

In the indexed-path test, assert:

```ts
expect(step.sendEvent).toHaveBeenCalledWith("queue signal entity enrichment", {
  name: "app/signal.entity-enrichment.requested",
  data: {
    clerkOrgId: "org_123",
    reason: "signal_indexed",
    signalId: "signal_123",
  },
});
```

Add a skipped-signal test asserting no enrichment event is sent when `shouldIndexSignalEntities` returns false.

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
pnpm --filter @api/app test -- entity-index-workflow.test.ts
```

Expected: FAIL because no enrichment event is sent.

- [ ] **Step 3: Emit the event after persistence**

After `persisted` is returned:

```ts
await step.sendEvent("queue signal entity enrichment", {
  name: "app/signal.entity-enrichment.requested",
  data: {
    clerkOrgId,
    reason: "signal_indexed" as const,
    signalId,
  },
});
```

- [ ] **Step 4: Run focused test**

Run:

```bash
pnpm --filter @api/app test -- entity-index-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/workflow/index-signal-entities.ts api/app/src/__tests__/entity-index-workflow.test.ts
git commit -m "feat: queue signal entity enrichment"
```

## Task 5: Add Provider Payload Adapters And Stable IDs

**Files:**
- Create: `api/app/src/services/entity-enrichment/adapters.ts`
- Create: `api/app/src/services/entity-enrichment/ids.ts`
- Create: `api/app/src/services/entity-enrichment/index.ts`
- Create: `api/app/src/__tests__/entity-enrichment-adapters.test.ts`

- [ ] **Step 1: Write adapter and id tests**

Tests should assert:

```ts
expect(xUserPayloadToObservation({
  id: "1",
  username: "Ava_AI",
  name: "Ava Chen",
  description: "Founder at Acme.",
  location: "San Francisco",
  url: "https://acme.com",
}, observedAt)).toEqual({
  provider: "x",
  observedAt: observedAt.toISOString(),
  profile: {
    id: "1",
    username: "Ava_AI",
    name: "Ava Chen",
    description: "Founder at Acme.",
    location: "San Francisco",
    url: "https://acme.com",
  },
});
```

Also assert that stable ids ignore `observedAt` but change when normalized profile content changes:

```ts
expect(
  signalProfileObservationIds({
    clerkOrgId,
    observations: [{ ...observation, observedAt: firstObservedAt.toISOString() }],
    signalId,
  }).ingestionId
).toBe(
  signalProfileObservationIds({
    clerkOrgId,
    observations: [{ ...observation, observedAt: secondObservedAt.toISOString() }],
    signalId,
  }).ingestionId
);
expect(first.ingestionId).not.toBe(second.ingestionId);
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
pnpm --filter @api/app test -- entity-enrichment-adapters.test.ts
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement adapters**

Implement:

```ts
export function xUserPayloadToObservation(
  payload: unknown,
  observedAt: Date
): EntityObservation | null;

export function githubUserPayloadToObservation(
  payload: unknown,
  observedAt: Date
): EntityObservation | null;
```

Use Zod schemas with nullable optional string fields. Return `null` when required provider ids/handles are absent.

- [ ] **Step 4: Implement stable ids**

Implement:

```ts
export function signalProfileObservationIds(input: {
  clerkOrgId: string;
  observations: EntityObservation[];
  signalId: string;
}): { eventId: string; ingestionId: string } {
  const normalizedObservations = input.observations.map((observation) => ({
    profile: observation.profile,
    provider: observation.provider,
  }));
  const normalized = JSON.stringify({
    clerkOrgId: input.clerkOrgId,
    observations: normalizedObservations,
    signalId: input.signalId,
  });
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return {
    eventId: `signal-entity-enrichment-${input.clerkOrgId}-${input.signalId}-${hash}`,
    ingestionId: `signal:${input.signalId}:${hash}`,
  };
}
```

- [ ] **Step 5: Run focused test**

Run:

```bash
pnpm --filter @api/app test -- entity-enrichment-adapters.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/services/entity-enrichment api/app/src/__tests__/entity-enrichment-adapters.test.ts
git commit -m "feat: add entity enrichment adapters"
```

## Task 6: Add X And GitHub Profile Fetchers

**Files:**
- Modify: `api/app/src/services/connectors/x-mcp-bridge.ts`
- Create: `api/app/src/services/entity-enrichment/provider-fetchers.ts`
- Create: `api/app/src/__tests__/signal-entity-enrichment-fetchers.test.ts`
- Modify: `packages/github-app-node/src/user.ts`
- Modify: `packages/github-app-node/src/index.ts`
- Modify: `packages/github-app-node/src/__tests__/user.test.ts`

- [ ] **Step 1: Write GitHub client tests**

Extend `packages/github-app-node/src/__tests__/user.test.ts`:

```ts
await expect(getGitHubUserByLogin({
  apiBaseUrl: "https://github.lightfast.localhost",
  apiVersion: "2022-11-28",
  login: "avachen",
  token: "installation_token",
})).resolves.toMatchObject({
  id: "12345",
  login: "avachen",
  name: "Ava Chen",
  company: "Acme",
  twitterUsername: "ava_ai",
});
```

- [ ] **Step 2: Implement richer GitHub user parsing**

In `packages/github-app-node/src/user.ts`, expand the raw schema and exported type:

```ts
const nullableStringSchema = z.string().nullable().optional();

const rawGitHubUserSchema = z.object({
  bio: nullableStringSchema,
  blog: nullableStringSchema,
  company: nullableStringSchema,
  email: nullableStringSchema,
  id: z.union([z.number(), z.string().min(1)]),
  location: nullableStringSchema,
  login: z.string().min(1),
  name: nullableStringSchema,
  twitter_username: nullableStringSchema,
  type: z.string().min(1),
});
```

Add:

```ts
export async function getGitHubUserByLogin(input: {
  apiBaseUrl?: string;
  apiVersion?: string;
  fetch?: typeof fetch;
  login: string;
  token?: string;
}): Promise<GitHubUserProfile>
```

- [ ] **Step 3: Export reusable X token helper**

In `api/app/src/services/connectors/x-mcp-bridge.ts`, export the existing helper as:

```ts
export async function getFreshXConnectorAccessToken(input: {
  config: ReturnType<typeof requireXConnectorConfig>;
  connection: OrgConnectorConnection;
}): Promise<string> {
  return await getFreshXBridgeAccessToken(input);
}
```

Keep the existing internal function body in one place to avoid duplicated refresh logic.

- [ ] **Step 4: Write app fetcher tests**

Tests should mock:

- `getCurrentOrgConnectorConnection` for X.
- `getActiveOrgBinding` and `getCachedGitHubInstallationToken` for GitHub.
- `executeXApiTool` and `getGitHubUserByLogin`.

Assert missing provider access returns diagnostics and successful fetches return raw payload arrays.

- [ ] **Step 5: Implement `provider-fetchers.ts`**

Export:

```ts
export async function fetchSignalEntityProfiles(input: {
  clerkOrgId: string;
  targets: SignalEntityEnrichmentTargetsResult;
}): Promise<{
  diagnostics: Record<string, number>;
  githubPayloads: unknown[];
  xPayloads: unknown[];
}>
```

Rules:

- X: require active `getCurrentOrgConnectorConnection(db, { clerkOrgId, provider: "x" })`; get token through `getFreshXConnectorAccessToken`; call `executeXApiTool({ name: "getUsersByUsernames" })`; accept both `{ data: object }` and `{ data: object[] }`.
- GitHub: require active `getActiveOrgBinding(db, clerkOrgId)` with `provider === "github"` and `providerInstallationId`; call `getCachedGitHubInstallationToken`; call `getGitHubUserByLogin` once per login.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --filter @repo/github-app-node test -- user.test.ts
pnpm --filter @api/app test -- signal-entity-enrichment-fetchers.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/github-app-node/src/user.ts packages/github-app-node/src/index.ts packages/github-app-node/src/__tests__/user.test.ts api/app/src/services/connectors/x-mcp-bridge.ts api/app/src/services/entity-enrichment/provider-fetchers.ts api/app/src/__tests__/signal-entity-enrichment-fetchers.test.ts
git commit -m "feat: fetch signal enrichment profiles"
```

## Task 7: Implement Signal Enrichment Workflow

**Files:**
- Create: `api/app/src/inngest/workflow/enrich-signal-entities.ts`
- Modify: `api/app/src/inngest/index.ts`
- Create: `api/app/src/__tests__/signal-entity-enrichment-workflow.test.ts`

- [ ] **Step 1: Write workflow tests**

Test cases:

- Missing targets returns `{ status: "skipped", reason: "no_targets" }`.
- Missing provider access returns diagnostics and does not send `app/connector.profile.observed`.
- Mixed X/GitHub success sends one `app/connector.profile.observed` event with `source.kind = "signal_entity_enrichment"`.

Assert:

```ts
expect(step.sendEvent).toHaveBeenCalledWith("emit profile observations", {
  id: expect.stringMatching(/^signal-entity-enrichment-/),
  name: "app/connector.profile.observed",
  data: expect.objectContaining({
    clerkOrgId,
    resolverVersion: "signal-entity-enrichment-v1",
    source: {
      kind: "signal_entity_enrichment",
      reason: "signal_indexed",
      signalId,
    },
  }),
});
```

- [ ] **Step 2: Implement workflow**

Create `enrichSignalEntities`:

```ts
export const enrichSignalEntities = inngest.createFunction(
  {
    id: "enrich-signal-entities",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId + "-" + event.data.reason',
    retries: 3,
    timeouts: { finish: "10m", start: "10m" },
    triggers: appEvents["app/signal.entity-enrichment.requested"],
  },
  async ({ event, step }) => {
    const targets = await step.run("load enrichment targets", () =>
      listSignalEntityEnrichmentTargets(db, event.data)
    );
    if (targets.x.length === 0 && targets.github.length === 0) {
      return { status: "skipped" as const, reason: "no_targets", targets };
    }

    const fetched = await step.run("fetch provider profiles", () =>
      fetchSignalEntityProfiles({
        clerkOrgId: event.data.clerkOrgId,
        targets,
      })
    );
    const observedAt = new Date();
    const observations = [
      ...fetched.xPayloads.map((payload) =>
        xUserPayloadToObservation(payload, observedAt)
      ),
      ...fetched.githubPayloads.map((payload) =>
        githubUserPayloadToObservation(payload, observedAt)
      ),
    ].filter(isNonNullish);

    if (observations.length === 0) {
      return { status: "skipped" as const, observations: 0, targets };
    }

    const ids = signalProfileObservationIds({
      clerkOrgId: event.data.clerkOrgId,
      observations,
      signalId: event.data.signalId,
    });

    await step.sendEvent("emit profile observations", {
      id: ids.eventId,
      name: "app/connector.profile.observed",
      data: {
        clerkOrgId: event.data.clerkOrgId,
        ingestionId: ids.ingestionId,
        observations,
        resolverVersion: "signal-entity-enrichment-v1",
        source: {
          kind: "signal_entity_enrichment",
          reason: event.data.reason,
          signalId: event.data.signalId,
        },
      },
    });

    return { status: "queued" as const, observations: observations.length };
  }
);
```

- [ ] **Step 3: Register workflow**

Add to `api/app/src/inngest/index.ts` imports and functions array:

```ts
import { enrichSignalEntities } from "./workflow/enrich-signal-entities";
```

```ts
enrichSignalEntities,
```

- [ ] **Step 4: Run workflow tests**

Run:

```bash
pnpm --filter @api/app test -- signal-entity-enrichment-workflow.test.ts inngest-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/workflow/enrich-signal-entities.ts api/app/src/inngest/index.ts api/app/src/__tests__/signal-entity-enrichment-workflow.test.ts api/app/src/__tests__/inngest-route.test.ts
git commit -m "feat: add signal entity enrichment workflow"
```

## Task 8: Project Graph People Into `orgPeople`

**Files:**
- Modify: `db/app/src/utils/people.ts`
- Modify: `db/app/src/utils/entity-graph.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/__tests__/people.test.ts`
- Modify: `db/app/src/__tests__/entity-graph.test.ts`

- [ ] **Step 1: Write projection tests**

Add tests that:

- Insert or mock a graph person with X and GitHub source identities.
- Project into `orgPeople`.
- Assert two rows are returned.
- Assert new rows have `personSource: "entity_graph"`.
- Assert an existing `signal` row becomes `mixed`.
- Assert metadata contains graph person public id, canonical key, status, confidence, source identity key, source identity public id, resolver version, and source signal metadata.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
pnpm --filter @db/app test -- people.test.ts entity-graph.test.ts
```

Expected: FAIL because projection helper does not exist.

- [ ] **Step 3: Implement projection helper**

Add:

```ts
export async function projectEntityGraphPeopleToOrgPeople(
  db: Database,
  input: {
    clerkOrgId: string;
    resolverVersion: string;
    source?: Record<string, unknown>;
    sourceIdentityKeys: string[];
  }
): Promise<Person[]>
```

Implementation:

- Load source identities by key.
- Join to graph people where source identity is primary or listed in candidate output source identity keys.
- Project only X/GitHub handle identities.
- Upsert `orgPeople` by identity key.
- New row uses `personSource: "entity_graph"`.
- Duplicate row source update uses:

```ts
personSource: sql`CASE
  WHEN ${people.personSource} = 'entity_graph' THEN 'entity_graph'
  ELSE 'mixed'
END`
```

- [ ] **Step 4: Export helper**

Add to `db/app/src/index.ts`:

```ts
export { projectEntityGraphPeopleToOrgPeople } from "./utils/people";
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
pnpm --filter @db/app test -- people.test.ts entity-graph.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add db/app/src/utils/people.ts db/app/src/utils/entity-graph.ts db/app/src/index.ts db/app/src/__tests__/people.test.ts db/app/src/__tests__/entity-graph.test.ts
git commit -m "feat: project graph people to people bridge"
```

## Task 9: Reconcile Signal Links After Entity Resolution

**Files:**
- Modify: `api/app/src/inngest/workflow/run-entity-resolution.ts`
- Modify: `api/app/src/__tests__/entity-resolution-workflow.test.ts`

- [ ] **Step 1: Write workflow test**

Mock `projectEntityGraphPeopleToOrgPeople` and `reconcileSignalEntityLinksForPeople`.

Assert:

```ts
expect(projectEntityGraphPeopleToOrgPeopleMock).toHaveBeenCalledWith(db, {
  clerkOrgId,
  resolverVersion: "signal-entity-enrichment-v1",
  source: {
    kind: "signal_entity_enrichment",
    reason: "signal_indexed",
    signalId,
  },
  sourceIdentityKeys: expect.arrayContaining(["x:handle:ava_ai"]),
});
expect(reconcileSignalEntityLinksForPeopleMock).toHaveBeenCalledWith(db, {
  clerkOrgId,
  people: projectedPeople,
});
```

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
pnpm --filter @api/app test -- entity-resolution-workflow.test.ts
```

Expected: FAIL because projection is not called.

- [ ] **Step 3: Update workflow**

After `ingestEntityObservations`:

```ts
const projectedPeople = await step.run("project entity graph people", () =>
  projectEntityGraphPeopleToOrgPeople(db, {
    clerkOrgId: event.data.clerkOrgId,
    resolverVersion,
    source: event.data.source,
    sourceIdentityKeys: event.data.observations.map((observation) =>
      observation.provider === "x"
        ? `x:handle:${observation.profile.username.trim().toLowerCase()}`
        : `github:handle:${observation.profile.login.trim().toLowerCase()}`
    ),
  })
);

const reconciled = await step.run("reconcile signal entity links", () =>
  reconcileSignalEntityLinksForPeople(db, {
    clerkOrgId: event.data.clerkOrgId,
    people: projectedPeople,
  })
);
```

Return `projectedPeople: projectedPeople.length` and `entityLinksResolved: reconciled.resolved` in workflow output and `app/entity.graph.persisted` data.

- [ ] **Step 4: Run focused test**

Run:

```bash
pnpm --filter @api/app test -- entity-resolution-workflow.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest/workflow/run-entity-resolution.ts api/app/src/__tests__/entity-resolution-workflow.test.ts
git commit -m "feat: reconcile signal links after entity graph persistence"
```

## Task 10: Upgrade X User Tool Payloads And Emulator

**Files:**
- Modify: `packages/x-app-node/src/tools.ts`
- Modify: `packages/x-app-node/src/__tests__/tools.test.ts`
- Modify: `emulators/x/src/fixtures.ts`
- Modify: `emulators/x/src/plugin/users.ts`
- Modify or add: `emulators/x/src/__tests__/*`

- [ ] **Step 1: Write X tool URL tests**

Assert each X user lookup URL includes:

```txt
user.fields=id%2Cname%2Cusername%2Cdescription%2Clocation%2Curl
```

- [ ] **Step 2: Update `xApiToolUrl`**

Add shared params for user endpoints:

```ts
const X_USER_FIELDS = "id,name,username,description,location,url";
```

Use `withQuery` for `/2/users/me`, `/2/users/by/username/:username`, `/2/users/by`, `/2/users/:id`, and `/2/users`.

- [ ] **Step 3: Upgrade emulator users**

Extend `XUserRow` and fixtures with:

```ts
description?: string;
location?: string;
url?: string;
```

Return these in `userJson`.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @repo/x-app-node test -- tools.test.ts
pnpm --filter @repo/x-emulator test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/x-app-node/src/tools.ts packages/x-app-node/src/__tests__/tools.test.ts emulators/x/src/fixtures.ts emulators/x/src/plugin/users.ts emulators/x/src/__tests__
git commit -m "feat: return rich x user profiles"
```

## Task 11: Upgrade GitHub Emulator Profile Lookup

**Files:**
- Modify: `emulators/github/src/fixtures.ts`
- Modify: `emulators/github/src/plugin/compatible-routes.ts`
- Modify: `emulators/github/src/__tests__/server.test.ts`

- [ ] **Step 1: Write emulator test**

Assert:

```ts
const res = await fetch(`${emulator.url}/users/emulator-dev`, {
  headers: { authorization: `Bearer ${GITHUB_EMULATOR_FIXTURES.userToken}` },
});
await expect(res.json()).resolves.toMatchObject({
  login: "emulator-dev",
  name: "Emulator Dev",
  company: "Lightfast Labs",
  blog: "https://lightfast.ai",
  twitter_username: "lightfast_dev",
});
```

- [ ] **Step 2: Add fixture fields**

Add `company`, `blog`, `location`, `twitter_username`, and `bio` to the emulator user seed.

- [ ] **Step 3: Implement route**

In `compatible-routes.ts`, handle:

```ts
if (request.method === "GET" && /^\/users\/[^/]+$/.test(url.pathname)) {
  const login = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
  const user = findUserByLogin(input.store, login);
  return user ? json(formatUser(user)) : json({ message: "Not Found" }, 404);
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @repo/github-emulator test -- server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add emulators/github/src/fixtures.ts emulators/github/src/plugin/compatible-routes.ts emulators/github/src/__tests__/server.test.ts
git commit -m "feat: emulate github user profiles"
```

## Task 12: Add Dev Retry Action And UI Verification Runbook

> Superseded note: the original implementation used the workspace entity graph
> tRPC router. That router was migrated to explicit entity graph domain commands
> plus the `@api/app/tanstack/entity-graph` adapter. Use the current runbook for
> live retry instructions.

**Files:**
- Current live domain command:
  `api/app/src/domain/entity-graph/commands.ts`
- Current live TanStack adapter:
  `api/app/src/adapters/tanstack/entity-graph.ts`
- Current verification runbook:
  `docs/superpowers/runbooks/2026-06-07-signal-enrichment-agent-browser.md`

- [ ] **Step 1: Write agent-browser runbook**

Create a runbook with exact commands:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
agent-browser open https://lightfast.localhost
agent-browser snapshot -i
```

Then steps:

1. Navigate to Signals.
2. Create a signal containing `@ava_ai` and `https://github.com/avachen`.
3. Wait for the signal detail to show entity links.
4. Wait for links to resolve.
5. Capture a screenshot.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm --filter @api/app test -- entity-graph-domain-commands.test.ts entity-graph-tanstack-adapter-source.test.ts workspace-entity-graph-router-source.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/app/src/domain/entity-graph api/app/src/adapters/tanstack/entity-graph.ts api/app/src/__tests__/entity-graph-domain-commands.test.ts api/app/src/__tests__/entity-graph-tanstack-adapter-source.test.ts api/app/src/__tests__/workspace-entity-graph-router-source.test.ts docs/superpowers/runbooks/2026-06-07-signal-enrichment-agent-browser.md
git commit -m "feat: add signal enrichment retry harness"
```

## Task 13: Final Verification

**Files:**
- No source edits unless verification reveals defects.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @repo/app-validation test
pnpm --filter @db/app test -- signal-entity-links.test.ts people.test.ts entity-graph.test.ts
pnpm --filter @api/app test -- entity-index-workflow.test.ts entity-resolution-workflow.test.ts signal-entity-enrichment-workflow.test.ts signal-entity-enrichment-fetchers.test.ts entity-enrichment-adapters.test.ts entity-graph-domain-commands.test.ts entity-graph-tanstack-adapter-source.test.ts workspace-entity-graph-router-source.test.ts inngest-route.test.ts
pnpm --filter @repo/x-app-node test
pnpm --filter @repo/github-app-node test
pnpm --filter @repo/x-emulator test
pnpm --filter @repo/github-emulator test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run local UI verification**

Start dev:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

In another shell, follow `docs/superpowers/runbooks/2026-06-07-signal-enrichment-agent-browser.md`.

Expected:

- Signal detail initially shows linked people.
- Enrichment workflow queues profile observations.
- Signal detail resolves eligible X/GitHub mentions.
- People UI shows bridge rows with `entity_graph` or `mixed` provenance.

- [ ] **Step 4: Commit verification fixes**

If verification required source changes:

```bash
git add <changed-files>
git commit -m "fix: stabilize signal entity enrichment"
```

If no fixes were required, do not create an empty commit.

## Self-Review Checklist

- Spec coverage: tasks cover signal-only activation, new enrichment event, persisted-link target extraction, X/GitHub org provider access, adapters, deterministic ids, graph projection, signal reconciliation, emulator upgrades, dev retry, and agent-browser verification.
- Placeholder scan: this plan contains no `TBD`, `TODO`, or unspecified implementation branches.
- Type consistency: event names, reason values, provider values, `personSource: "entity_graph"`, and resolver version `signal-entity-enrichment-v1` are consistent across tasks.
- Idempotency sanity: profile-observation ids hash normalized provider/profile content, not `observedAt`, so unchanged profiles dedupe and changed profile content re-runs.
