---
date: 2026-04-18T04:10:02Z
researcher: claude
git_commit: def3188247d51fcddacad733f19acb572959332f
branch: main
topic: "Event-driven agent runtime on platform/event.stored — .lightfast config + skills + memory, accretive v1"
tags: [research, design, agent-runtime, dotlightfast, skills, inngest, github-provider, ai-sdk]
status: complete
last_updated: 2026-04-18
---

# Research & Design: Event-Driven Agent Runtime (v1 vertical slice)

**Date**: 2026-04-18T04:10:02Z
**Git Commit**: def3188247d51fcddacad733f19acb572959332f
**Branch**: main

## Research Question

Design the most accretive first step to implement an event-driven agent runtime that:
1. Triggers on `platform/event.stored` via Inngest
2. Loads `.lightfast/` config from the customer's GitHub repo (SPEC.md + skills/ + memory/)
3. Runs a single LLM triage call to decide what to do
4. Can invoke a skill (load full `SKILL.md` + `command/*.md`, re-run agent with tools)

Minimize delta to existing code while touching every surface so the pattern is established end-to-end.

---

## Summary

The architecture is well-positioned for this feature, but several claims in the original draft were wrong and required adversarial review (see Improvement Log at end). Verified surfaces:

- **Event emission point exists.** `platformEventStore` emits `platform/event.stored` at `api/platform/src/inngest/functions/platform-event-store.ts:557-566`. A new listener function is a pure addition — no modification to existing emitters.
- **Repo → installation → token resolution is established.** `platform-repo-index-sync.ts` is the closest existing analog, using 4 steps (`check-context-config`, `resolve-installation`, `fetch-readme`, `update-cache`). Note: that function scopes by `providerResourceId + isActive`; for triage we scope by `clerkOrgId` (which has a unique index on `orgRepoIndexes`).
- **`@repo/app-config` was DELETED on main** (commit `e0b66b2b5`). The parser must live in a new package `@repo/dotlightfast` — not extend the removed one.
- **GitHub provider needs two new endpoints.** Spike confirmed (see Improvement Log): `get-tree` (`/repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1`) + `get-blob` (`/repos/{owner}/{repo}/git/blobs/{file_sha}`) slot into the existing `ApiEndpoint` interface with zero type changes. This replaces ~54 recursive `get-file-contents` calls with ~33 calls and eliminates all directory-listing round-trips.
- **`orgRepoIndexes` already identifies the "primary indexed repo" per org** (unique on `clerkOrgId`), with `repoFullName` (owner/repo) and `providerResourceId` (GitHub numeric repo id). v1 assumes `.lightfast/` lives in this same repo (confirmed, Open Question #5).
- **`generateObject` precedent exists** (`packages/app-rerank/src/providers/llm.ts:154`). v1 follows that pattern inside `step.run`, since there is zero `step.ai.infer` precedent in the codebase.
- **Memory writes (PUT to GitHub) deferred.** No GitHub endpoint in `api.ts` uses anything other than `GET` today. `ApiEndpoint.method` may allow more at the type level, but every declared endpoint is `GET`. v1 reads only; memory writes go in v2.

---

## Detailed Findings

### Event emission surface — `platform/event.stored`

**File:** `api/platform/src/inngest/functions/platform-event-store.ts:557-566`

The event is emitted as step 7b of the `platformEventStore` function:

```ts
await step.sendEvent("emit-event-stored", {
  name: "platform/event.stored" as const,
  data: {
    clerkOrgId,
    eventExternalId: observation.externalId,
    sourceType: sourceEvent.eventType,
    significanceScore: significance.score,
    correlationId,
  },
});
```

**Schema:** `api/platform/src/inngest/schemas/platform.ts:73-79`
```ts
"platform/event.stored": z.object({
  clerkOrgId: z.string(),
  eventExternalId: z.string(),
  sourceType: z.string(),
  significanceScore: z.number(),
  correlationId: z.string().optional(),
})
```

The emit is fire-and-forget. No existing listener exists; the neural pipeline listens to `platform/entity.upserted` and `platform/entity.graphed` instead. The `platform/event.stored` event is currently unused.

### Inngest function registration pattern

**File:** `api/platform/src/inngest/index.ts:50-68`

All functions are registered as a flat array in `createInngestRouteContext()`:
```ts
serve({
  client: inngest,
  functions: [
    ingestDelivery, platformEventStore, platformEntityGraph, ...
  ],
  servePath: "/api/inngest",
})
```

Adding a new function requires (1) creating the function file, (2) importing it in `index.ts`, (3) adding to the array. That is the entire wiring.

### Function pattern for a listener — `platformEntityGraph` as template

**File:** `api/platform/src/inngest/functions/platform-entity-graph.ts:26-51`

```ts
export const platformEntityGraph = inngest.createFunction(
  { id: "platform/entity.graph", retries: 3, timeouts: { start: "1m", finish: "2m" } },
  { event: "platform/entity.upserted" },
  async ({ event, step }) => {
    const { clerkOrgId, internalEventId, provider, entityRefs, correlationId } = event.data;
    await step.run("resolve-edges", () => resolveEdges(...));
    await step.sendEvent("emit-entity-graphed", { ... });
  }
);
```

**Key patterns used:**
- `step.run("step-name", async () => { ... })` for side-effect steps (DB writes, external calls)
- `step.sendEvent` for fanout
- Typed `event.data` destructuring from the Zod schema

### Repo → org → token resolution

The canonical example is `api/platform/src/inngest/functions/platform-repo-index-sync.ts` — it is structurally almost identical to what we need:

**Step 1 — Load org's indexed repo** (lines 50-68):
```ts
const contextConfig = await db
  .select()
  .from(orgRepoIndexes)
  .where(and(
    eq(orgRepoIndexes.providerResourceId, data.resourceId),
    eq(orgRepoIndexes.isActive, true),
  ))
  .limit(1);
```

For v1 we query by `clerkOrgId` instead (the unique key on `orgRepoIndexes`).

**Step 2 — Resolve installation** (lines 75-106):
```ts
const rows = await db
  .select({ ... })
  .from(orgIntegrations)
  .innerJoin(gatewayInstallations, eq(...))
  .where(eq(orgIntegrations.id, contextConfig.integrationId));
```

Returns `{ id, externalId, provider }` from `gatewayInstallations`.

**Step 3 — Mint installation token** (lines 109-117):
```ts
const providerDef = getProvider("github");
const config = providerConfigs.github;
const { token } = await getActiveTokenForInstallation(installationInfo, config, providerDef);
```

`getActiveTokenForInstallation` is at `api/platform/src/lib/token-helpers.ts:14-70`. For GitHub (kind: `app-token`), `_storedAccessToken` is always ignored; `providerDef.auth.getActiveToken` calls `POST https://api.github.com/app/installations/{externalId}/access_tokens` to mint a fresh short-lived token.

### GitHub file reads — `platform.proxy.execute`

**File:** `api/platform/src/router/platform/proxy.ts:90-265`

The canonical read path is the platform proxy. Callers construct `createPlatformCaller()` (from `packages/platform-trpc/src/caller.ts:20`) and call `proxy.execute({ installationId, endpointId, pathParams, queryParams?, body? })`.

**`get-file-contents` response shape** (`packages/app-providers/src/providers/github/api.ts`):
- Single file: `{ type: "file", content: "<base64>", sha, size? }`
- Directory: `Array<{ type: "file" | "dir", name, path, sha, ... }>`

**Important:** The same endpoint returns a directory listing when the path is a directory. So reading `.lightfast/skills` returns the list of subdirectories, and we iterate to read each `.lightfast/skills/<name>/SKILL.md`. No Git Tree API needed for v1.

**Alternative direct-fetch pattern** exists at `platform-repo-index-sync.ts:130-138` (bypasses proxy, uses raw `fetch` with the installation token). The proxy path is preferred for v1 because it already handles 401 refresh, rate-limit parsing, and response validation.

### GitHub Git Tree API — required for efficient `.lightfast/` discovery

Verified via spike (see Improvement Log). For a 10-skill `.lightfast/` tree, the original directory-walk plan requires ~54 HTTP calls (get-repo + per-directory listings + per-file contents). A single Git Tree API call (`GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1`) returns the full recursive tree metadata, cutting total calls to ~33 (1 get-repo + 1 get-tree + 31 get-blob) and eliminating all directory-listing round-trips.

**Two new endpoints must be added to `packages/app-providers/src/providers/github/api.ts`:**

```ts
"get-tree": {
  method: "GET",
  path: "/repos/{owner}/{repo}/git/trees/{tree_sha}",
  description: "Get a git tree by SHA. Use ?recursive=1 for full recursion.",
  responseSchema: githubTreeSchema,  // { sha, tree: Array<{path, mode, type, sha, size?}>, truncated }
},
"get-blob": {
  method: "GET",
  path: "/repos/{owner}/{repo}/git/blobs/{file_sha}",
  description: "Get a git blob (base64-encoded file bytes).",
  responseSchema: githubBlobSchema,  // { sha, content, encoding, size }
},
```

Both fit the existing `ApiEndpoint` interface without type changes. `?recursive=1` passes via the proxy's existing `queryParams` mechanism. Edge case: `truncated: true` returns on huge trees (>7MB / >100k entries) — fallback would re-request the `.lightfast/` subtree specifically; not a concern for realistic configs.

### GitHub file writes — not currently supported

All GitHub endpoints in `packages/app-providers/src/providers/github/api.ts` use `method: "GET"` today (no POST or PUT declared). No `PUT /repos/{owner}/{repo}/contents/{path}` endpoint exists for memory commits.

**Options for v2 (not v1):**
1. Extend `ApiEndpoint.method` to include `"PUT"` and add `put-file-contents` to `githubApi.endpoints`. Proxy already JSON-stringifies bodies (`proxy.ts:203-206`).
2. Or: direct `fetch` in a `writeMemory` tool's handler, following the `platform-repo-index-sync.ts:130-138` pattern.

v1 skips memory writes entirely.

### `@repo/app-config` was deleted — new package required

**Current state:** `packages/app-config/` does NOT exist on main. Commit `e0b66b2b5` ("refactor(app-config): delete package, inline constants into consumers") removed it. Any design that extends `@repo/app-config` is building on a dead package.

**Decision for v1:** introduce a new package `@repo/dotlightfast` for the `.lightfast/` parser and schemas (see Delta 1 below). Do not revive `@repo/app-config`.

### `core/ai-sdk` — createAgent + tool pattern

**File:** `core/ai-sdk/src/core/primitives/agent.ts:324-333`

```ts
createAgent<TRuntimeContext, TTools>(options: AgentOptions<TRuntimeContext, TTools>): Agent<TRuntimeContext, TTools>
```

`AgentOptions` merges `LightfastConfig` (`name`, `system`, `tools`, `createRuntimeContext`, `cache`) with Vercel's `StreamTextParams` (minus message/tool/system fields which Lightfast owns).

**`Agent.buildStreamParams`** (`agent.ts:159-308`) returns a plain `Parameters<typeof streamText>[0]` object. This method can be called standalone — no HTTP dependency. But it requires a `memory` object in `StreamOptions`; simpler alternative is to call Vercel `generateText` directly.

**Tool pattern** (`packages/app-ai/src/org-search.ts`):
```ts
export function orgSearchTool() {
  return createTool<LightfastAnswerRuntimeContext>({
    description: "...",
    inputSchema: SearchRequestSchema,
    outputSchema: SearchResponseSchema,
    execute: async (input, context) => {
      const handler = context.tools?.orgSearch?.handler;
      if (!handler) throw new Error(...);
      return handler(input);
    }
  });
}
```

Two-level factory: `orgSearchTool()` → `ToolFactory` → when merged context arrives → `AiTool`. The tool `execute` delegates to an injected handler — the handler is wired per-request in `createRuntimeContext`. This keeps the tool declaration pure (no DB / HTTP coupling) and makes testing/mocking simple.

**No existing programmatic (non-HTTP) usage of `createAgent`.** All current usage is via `fetchRequestHandler` in the answer route (`apps/app/src/app/(api)/v1/answer/[...v]/route.ts`).

### `orgRepoIndexes` — the "primary repo" per org

**File:** `db/app/src/schema/tables/org-repo-indexes.ts`

Key fields:
- `clerkOrgId` — **unique** (one indexed repo per org)
- `integrationId` — FK to `orgIntegrations`
- `repoFullName` — e.g., `"acme/.lightfast"` or whatever repo the customer pointed to
- `providerResourceId` — numeric GitHub repo id
- `cachedContent` — currently holds README.md text
- `contentSha`, `lastSyncCommitSha`, `isActive`, `indexingStatus`, `lastSyncedAt`

v1 treats this table as the source of truth for "which repo does `.lightfast/` live in for this org."

---

## Architecture for v1 (Accretive First Step)

The v1 vertical slice is a **single new Inngest function** (`platform/agent.triage`) that exercises every surface end-to-end, plus minimal package additions. Concrete deltas per package:

### Delta 1 — New package `@repo/dotlightfast`

**Location:** `packages/dotlightfast/` — new workspace package. NOT extending the deleted `@repo/app-config`.

**New files:**
- `packages/dotlightfast/package.json` — standard `@repo/*` package skeleton
- `packages/dotlightfast/src/schema.ts` — Zod schemas for skill frontmatter + config shape
- `packages/dotlightfast/src/parse-tree.ts` — pure function: takes a Git Tree response + blob fetcher, returns `DotLightfastConfig`
- `packages/dotlightfast/src/index.ts` — barrel

**Schemas:**
```ts
export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().min(1),
});

export type SkillManifest = {
  name: string;
  description: string;
  hasCommand: boolean;      // .lightfast/skills/<name>/command/<name>.md exists
  path: string;             // .lightfast/skills/<name>/
};

export type DotLightfastConfig = {
  spec: string | null;                 // SPEC.md content (bounded to ~8KB)
  skills: SkillManifest[];             // manifests only; SKILL.md body not loaded
  memoryIndex: string | null;          // memory/MEMORY.md content, null for v1
};
```

**Parser signature** (operates on Git Tree output + selective blob fetches):
```ts
export async function parseDotLightfastFromTree(args: {
  tree: GithubTreeResponse;            // from get-tree ?recursive=1
  readBlob: (fileSha: string) => Promise<string>;  // returns utf-8 decoded body
}): Promise<Result<DotLightfastConfig, DotLightfastError>>
```

Behavior:
1. Filter `tree.tree` for entries whose `path` starts with `.lightfast/`.
2. If `.lightfast/SPEC.md` is present, `readBlob` its sha → `spec`.
3. For each `.lightfast/skills/<name>/SKILL.md`, `readBlob` → parse frontmatter only → push `SkillManifest`. Skip skills whose frontmatter fails schema validation (log; continue).
4. `hasCommand` is inferred from tree paths, no blob fetch needed.
5. If `tree.truncated === true`, return error; caller retries with narrower tree path.

**Why a new package, not inline in api/platform:** the same parser will be reused by the v2 skill-execution function and potentially by a future `apps/app` preview endpoint. Single-consumer-today, multi-consumer-soon warrants the boundary. Parser is pure — no DB, no HTTP, trivially testable.

**No `Fetcher` abstraction:** the original design wrapped all I/O through a generic fetcher. With the Git Tree API, there are exactly two call types (tree + blob) and both are Inngest-step concerns. Keeping the parser pure and letting the Inngest function wire proxy calls directly is simpler.

### Delta 2 — `api/platform/src/inngest/schemas/platform.ts`

**New event schema** (additive):
```ts
"platform/agent.decided": z.object({
  clerkOrgId: z.string(),
  eventExternalId: z.string(),
  decision: z.enum(["skip", "invoke"]),
  skillName: z.string().optional(),
  reasoning: z.string(),
  correlationId: z.string().optional(),
}),
```

Adds to the existing `platformEvents` record. No breaking change.

### Delta 3 — `api/platform/src/inngest/functions/platform-agent-triage.ts` (new)

The heart of v1. Listens to `platform/event.stored`, gates on significance, loads `.lightfast/` via Git Tree API, runs one `generateObject` triage call.

```ts
export const platformAgentTriage = inngest.createFunction(
  {
    id: "platform/agent.triage",
    retries: 2,
    idempotency: "event.data.clerkOrgId + '-' + event.data.eventExternalId",
    concurrency: { limit: 5, key: "event.data.clerkOrgId" },
    timeouts: { start: "1m", finish: "3m" },
  },
  { event: "platform/event.stored" },
  async ({ event, step }) => {
    const { clerkOrgId, eventExternalId, sourceType, significanceScore, correlationId } = event.data;

    // Gate 0: significance threshold. Skip low-signal events without any DB/HTTP work.
    if (significanceScore < TRIAGE_SIGNIFICANCE_THRESHOLD) {
      return { skipped: "below_significance_threshold", significanceScore };
    }

    // Step 1: resolve org's indexed repo + installation (clerkOrgId is unique on orgRepoIndexes)
    const ctx = await step.run("resolve-repo-context", async () => {
      const rows = await db
        .select({
          integrationId: orgRepoIndexes.integrationId,
          repoFullName: orgRepoIndexes.repoFullName,
          installationId: gatewayInstallations.id,
          installationExternalId: gatewayInstallations.externalId,
          provider: gatewayInstallations.provider,
        })
        .from(orgRepoIndexes)
        .innerJoin(orgIntegrations, eq(orgIntegrations.id, orgRepoIndexes.integrationId))
        .innerJoin(gatewayInstallations, eq(gatewayInstallations.id, orgIntegrations.installationId))
        .where(and(
          eq(orgRepoIndexes.clerkOrgId, clerkOrgId),
          eq(orgRepoIndexes.isActive, true),
          eq(gatewayInstallations.provider, "github"),
        ))
        .limit(1);
      if (!rows[0]) return null;
      const [owner, repo] = rows[0].repoFullName.split("/");
      return { installationId: rows[0].installationId, owner, repo };
    });
    if (!ctx) return { skipped: "no_active_repo_index" };

    // Step 2: fetch repo default-branch SHA (needed for tree lookup)
    const treeSha = await step.run("resolve-tree-sha", async () => {
      const platform = createPlatformCaller();
      const res = await platform.proxy.execute({
        installationId: ctx.installationId,
        endpointId: "get-repo",
        pathParams: { owner: ctx.owner, repo: ctx.repo },
      });
      if (res.status === 404) return null;
      if (res.status !== 200) throw new Error(`get-repo ${res.status}`);
      // default_branch → then one more call could resolve sha, OR use the branch name as tree_sha (GitHub accepts both)
      return (res.data as { default_branch: string }).default_branch;
    });
    if (!treeSha) return { skipped: "repo_not_accessible" };

    // Step 3: fetch recursive tree (single call replaces directory walk)
    const tree = await step.run("fetch-tree", async () => {
      const platform = createPlatformCaller();
      const res = await platform.proxy.execute({
        installationId: ctx.installationId,
        endpointId: "get-tree",
        pathParams: { owner: ctx.owner, repo: ctx.repo, tree_sha: treeSha },
        queryParams: { recursive: "1" },
      });
      if (res.status === 404) return null;
      if (res.status !== 200) throw new Error(`get-tree ${res.status}`);
      return res.data as GithubTreeResponse;
    });
    if (!tree) return { skipped: "no_repo_tree" };

    const hasDotLightfast = tree.tree.some(e => e.path.startsWith(".lightfast/"));
    if (!hasDotLightfast) return { skipped: "no_dotlightfast_config" };

    // Step 4: parse + fetch only the blobs we need (SPEC.md + each SKILL.md frontmatter)
    const config = await step.run("parse-dotlightfast", async () => {
      const platform = createPlatformCaller();
      const readBlob = async (sha: string) => {
        const res = await platform.proxy.execute({
          installationId: ctx.installationId,
          endpointId: "get-blob",
          pathParams: { owner: ctx.owner, repo: ctx.repo, file_sha: sha },
        });
        if (res.status !== 200) throw new Error(`get-blob ${res.status}`);
        const blob = res.data as { content: string; encoding: "base64" };
        return Buffer.from(blob.content, blob.encoding).toString("utf-8");
      };
      const result = await parseDotLightfastFromTree({ tree, readBlob });
      return result.match(v => v, err => { throw err; });
    });
    if (!config.spec && config.skills.length === 0) {
      return { skipped: "dotlightfast_empty" };
    }

    // Step 5: load the stored event row for triage context
    const eventRow = await step.run("load-event", async () => {
      const rows = await db.select().from(orgEvents)
        .where(eq(orgEvents.externalId, eventExternalId))
        .limit(1);
      return rows[0] ?? null;
    });
    if (!eventRow) return { skipped: "event_row_missing" };

    // Step 6: triage LLM call. skillName is constrained to loaded skill names OR "none".
    const decision = await step.run("triage", async () => {
      const skillNames = config.skills.map(s => s.name);
      const DecisionSchema = z.object({
        decision: z.enum(["skip", "invoke"]),
        skillName: skillNames.length > 0
          ? z.enum([...skillNames, "none"] as [string, ...string[]])
          : z.literal("none"),
        reasoning: z.string().min(1).max(500),
      });
      const { object } = await generateObject({
        model: gateway("anthropic/claude-haiku-4.5"),  // triage is cheap; reserve Sonnet for skill execution in v2
        schema: DecisionSchema,
        system: buildTriageSystemPrompt({ spec: config.spec, skills: config.skills }),
        prompt: buildEventPrompt(eventRow),
      });
      return object;
    });

    // Step 7: emit decision event (downstream consumers can pick this up in v2)
    await step.sendEvent("emit-agent-decided", {
      name: "platform/agent.decided" as const,
      data: {
        clerkOrgId,
        eventExternalId,
        decision: decision.decision,
        skillName: decision.skillName === "none" ? undefined : decision.skillName,
        reasoning: decision.reasoning,
        correlationId,
      },
    });

    return { decision: decision.decision, skillName: decision.skillName };
  }
);
```

**Key design choices (post-review):**
- **Significance gate at step 0.** `significanceScore` already rides the event; skipping below threshold avoids all downstream work for noise. Threshold constant `TRIAGE_SIGNIFICANCE_THRESHOLD = 0.3` lives in `api/platform/src/lib/constants.ts`.
- **`z.enum(skillNames)` prevents hallucinated skill invocations.** The LLM can only emit names that actually exist.
- **Status-based 404 handling.** `proxy.execute` returns `{ status, data, headers }` — it does NOT throw on non-200. The original plan's `try/catch(is404)` was wrong.
- **Git Tree API replaces N+1 directory walks.** Three proxy calls for discovery (`get-repo`, `get-tree`, `get-blob` × N) instead of ~50.
- **Haiku, not Sonnet.** Existing precedent (`packages/app-rerank/src/providers/llm.ts:154`) uses Haiku for structured scoring. Triage has the same shape. Keep Sonnet for v2 skill execution.

**v1 explicitly does NOT:**
- Load full `SKILL.md` body or `command/*.md` (only manifests)
- Execute tools (no `sendNotification`, no `writeMemory`)
- Write to memory
- Create a second LLM call for skill execution

The downstream skill-execution function listens to `platform/agent.decided` — that is v2. v1 stops at "the agent decided X," logs the decision, and we manually verify behavior on real events before wiring tools.

### Delta 4 — `api/platform/src/inngest/index.ts`

Two lines: import `platformAgentTriage` and add to the `functions` array.

### Delta 5 — `apps/app/src/ai/prompts/triage-prompt.ts` (new) OR `@repo/prompt-engine`

Two options:
- **Option A (simpler):** Place `buildTriageSystemPrompt` inside `api/platform/src/lib/triage-prompt.ts` — it is only used by the Inngest function.
- **Option B (future-aligned):** Add a new `SectionProvider` set to `@repo/prompt-engine` that mirrors how `buildAnswerSystemPrompt` is structured. Worth considering if we want skill-execution prompts to share provider logic later.

For v1, go with Option A. The prompt composes: internal instructions + `SPEC.md` content + skill manifest list (name + description, one per line). ~500 tokens system overhead on top of the event payload.

### Delta 6 — Triage decision schema (inline, not a separate file)

No shared schema file needed. The decision schema is built *inside* the triage step because `skillName` must be a `z.enum(skillNames)` dynamically derived from the loaded config — a static schema file would either hallucinate names or duplicate the enum construction logic. See the `DecisionSchema` construction inside step 6 of Delta 3.

### Delta 7 — GitHub provider: add `get-tree` and `get-blob` endpoints

**File:** `packages/app-providers/src/providers/github/api.ts` — extend the `githubApi.endpoints` map:

```ts
"get-tree": {
  method: "GET",
  path: "/repos/{owner}/{repo}/git/trees/{tree_sha}",
  description: "Get a git tree by SHA or branch name. Supports ?recursive=1.",
  responseSchema: z.object({
    sha: z.string(),
    url: z.string(),
    tree: z.array(z.object({
      path: z.string(),
      mode: z.string(),
      type: z.enum(["blob", "tree", "commit"]),
      sha: z.string(),
      size: z.number().optional(),
      url: z.string().optional(),
    })),
    truncated: z.boolean(),
  }),
},
"get-blob": {
  method: "GET",
  path: "/repos/{owner}/{repo}/git/blobs/{file_sha}",
  description: "Get a git blob by SHA. Returns base64-encoded file bytes.",
  responseSchema: z.object({
    sha: z.string(),
    node_id: z.string(),
    size: z.number(),
    url: z.string(),
    content: z.string(),
    encoding: z.literal("base64"),
  }),
},
```

Both fit `ApiEndpoint` without interface changes. Spike confirmed (see Improvement Log).

### Delta 8 — Guard `providerConfigs.github` presence

`api/platform/src/lib/provider-configs.ts` returns `undefined` from `providerConfigs.github` if GitHub env vars aren't configured. The triage function must guard against this before attempting token minting. Recommend a shared helper:

```ts
// api/platform/src/lib/require-github-provider.ts
export function requireGithubProvider() {
  const config = providerConfigs.github;
  if (!config) throw new Error("GitHub provider not configured — missing env vars");
  return { config, providerDef: getProvider("github") };
}
```

Call at function entry after `significanceScore` gate; treat as a fatal configuration error (no retry value).

---

## What Each Surface Looks Like After v1

| Surface | v1 Delta | v2+ Follow-on |
|---|---|---|
| `@repo/dotlightfast` (new) | new package: skill schema + `parseDotLightfastFromTree` | + memory schema, writeable tree builder |
| `api/platform` Inngest | +1 function (`platformAgentTriage`), +1 event (`agent.decided`), +1 constant (`TRIAGE_SIGNIFICANCE_THRESHOLD`) | +1 function (`platformSkillExecute`) listening to `agent.decided` |
| GitHub provider | +2 endpoints (`get-tree`, `get-blob`). Zero interface changes. | +`put-file-contents` endpoint (PUT method may require `ApiEndpoint.method` extension) |
| `core/ai-sdk` | **no change** (use Vercel `generateObject` directly) | Optional: helper for non-HTTP agent runs that reuses `createAgent` |
| Tools | **none added** in v1 | +`sendNotification` (Slack webhook), +`writeMemory` (commits to `.lightfast/memory/`) |
| Database | **no schema change** — reuse `orgRepoIndexes` | Optional: `orgAgentDecisions` log table |

---

## Code References

- `api/platform/src/inngest/functions/platform-event-store.ts:557-566` — `platform/event.stored` emit site
- `api/platform/src/inngest/schemas/platform.ts:73-79` — event schema
- `api/platform/src/inngest/functions/platform-entity-graph.ts:26-51` — listener pattern template
- `api/platform/src/inngest/functions/platform-repo-index-sync.ts:50-172` — full org-repo resolution + token mint + GitHub fetch pattern
- `api/platform/src/inngest/index.ts:50-68` — function registration
- `api/platform/src/lib/token-helpers.ts:14-70` — `getActiveTokenForInstallation`
- `api/platform/src/router/platform/proxy.ts:90-265` — `proxy.execute` generic proxy
- `api/platform/src/lib/provider-configs.ts:38-62` — lazy provider config proxy
- `packages/app-providers/src/providers/github/index.ts:34-76` — GitHub App JWT + installation token mint
- `packages/app-providers/src/providers/github/api.ts:77` — `ApiEndpoint.method` limited to `"GET" | "POST"`
- `packages/app-providers/src/providers/github/api.ts:128-184` — endpoint catalog
- `packages/platform-trpc/src/caller.ts:20` — `createPlatformCaller`
- `packages/app-config/src/schema.ts:21-60` — existing `LightfastConfigSchema`
- `packages/app-config/src/parse.ts:50-133` — existing `loadConfig`
- `db/app/src/schema/tables/org-repo-indexes.ts` — `orgRepoIndexes` schema
- `db/app/src/schema/tables/org-integrations.ts` — `orgIntegrations`
- `db/app/src/schema/tables/gateway-installations.ts` — `gatewayInstallations`
- `db/app/src/schema/tables/gateway-tokens.ts` — `gatewayTokens` (AES-256-GCM encrypted)
- `core/ai-sdk/src/core/primitives/agent.ts:97-333` — `LightfastConfig`, `AgentOptions`, `createAgent`
- `core/ai-sdk/src/core/primitives/tool.ts:44-72` — `createTool`, `ToolFactory`
- `core/ai-sdk/src/core/server/adapters/fetch.ts:136-254` — `fetchRequestHandler`
- `apps/app/src/app/(api)/v1/answer/[...v]/route.ts:29-146` — complete existing agent usage for reference
- `apps/app/src/ai/runtime/memory.ts` — `AnswerRedisMemory` — reference impl of `Memory`
- `apps/app/src/ai/prompts/system-prompt.ts` — `buildAnswerSystemPrompt` — reference impl of prompt builder
- `packages/app-ai/src/org-search.ts` — `orgSearchTool` — reference impl of a tool

## Architecture Documentation

### The v1 Flow (end-to-end)

```
┌────────────────────────────────────────────────────────────────────┐
│  Existing: webhook → ingest-delivery → event.capture → event.store │
│                                                        │           │
│                                                        ▼           │
│                                            emits platform/event.stored
│                                                        │           │
│  ═══════════════════════════════════ v1 STARTS HERE ═══════════════│
│                                                        ▼           │
│  platformAgentTriage (new Inngest fn)                              │
│    │                                                               │
│    ├── step.run("resolve-repo-context")                            │
│    │     ├── query orgRepoIndexes by clerkOrgId                    │
│    │     └── join orgIntegrations, gatewayInstallations            │
│    │                                                               │
│    ├── step.run("load-dotlightfast")                               │
│    │     ├── createPlatformCaller()                                │
│    │     ├── build Fetcher wrapping proxy.execute(get-file-contents)
│    │     └── parseDotLightfast(fetcher) → SPEC.md + skill manifests│
│    │                                                               │
│    ├── step.run("load-event")                                      │
│    │     └── query orgEvents by eventExternalId                    │
│    │                                                               │
│    ├── step.run("triage")                                          │
│    │     └── generateObject({                                      │
│    │          model: gateway("anthropic/claude-sonnet-4.6"),       │
│    │          schema: TriageDecisionSchema,                        │
│    │          system: <internal> + SPEC.md + skill manifests,      │
│    │          prompt: <event payload>,                             │
│    │        })                                                     │
│    │                                                               │
│    └── step.sendEvent("platform/agent.decided", { decision, ... }) │
│                                                                    │
│  ═══════════════════════════════════ v2+ follow-on ════════════════│
│                                                                    │
│  platformSkillExecute (listens to platform/agent.decided)          │
│    ├── load full SKILL.md + command/<name>.md                      │
│    ├── build execution prompt                                      │
│    ├── run agent with tools: [sendNotification, writeMemory, ...]  │
│    └── ...                                                         │
└────────────────────────────────────────────────────────────────────┘
```

### Why a single LLM call for triage is sufficient for v1

`generateObject` with a constrained enum output (`skip` | `invoke`) and `z.enum(skillNames)` for skill selection keeps the triage call small, cheap, and hallucination-proof. Skill bodies are NOT loaded into the triage prompt — only frontmatter descriptions. This mirrors Claude Code's own discovery-vs-full-load split where descriptions are always in context but bodies load on invocation. Token budget per event:

- Internal system prompt: ~300 tokens
- SPEC.md: bounded to 2000 tokens (truncate if larger)
- Skill manifests (name + description): ~20-50 tokens each, bounded to 20 skills
- Event payload: ~500 tokens
- **Total input: ~3000 tokens** for the common case
- Output: constrained enum + ~100 token reasoning

With Claude Haiku 4.5 pricing (same model class used by the reranker), this is well under a cent per triaged event. Combined with the `significanceScore >= 0.3` gate, most orgs will trigger triage on well under half of stored events.

### Why defer memory writes to v2

The GitHub provider currently rejects non-GET/POST methods at the type level (`api.ts:77`). Adding PUT requires extending `ApiEndpoint.method` to include `"PUT"` and adding a `put-file-contents` endpoint definition. The `proxy.execute` machinery itself already supports JSON bodies (`proxy.ts:203-206`), so the runtime work is minimal — but it is a genuine API-surface change to a widely-consumed package. Keeping v1 read-only avoids that change landing in the same PR as the agent runtime.

### Why not retrofit `createAgent` for Inngest

`createAgent` is designed around `fetchRequestHandler` + a `Memory` backend + session/stream lifecycle. For a single-turn triage call, `generateObject` from `ai` is far simpler and introduces no coupling to memory/session semantics. Using `createAgent` for the v2 skill-execution function (which may want tools + multi-step) makes more sense — but v1 doesn't need it.

### Idempotency

`platformAgentTriage` uses `idempotency: "event.data.clerkOrgId + '-' + event.data.eventExternalId"`. This prevents duplicate triage calls if Inngest replays the `platform/event.stored` event (e.g., on webhook redelivery). Matches the pattern used by `platformEventStore` itself.

### Failure modes (v1)

- `significanceScore < 0.3` → return `{ skipped: "below_significance_threshold" }`. No DB/HTTP/LLM work performed.
- No active `orgRepoIndexes` row → `{ skipped: "no_active_repo_index" }`. Fine — not every org has wired `.lightfast`.
- Repo not accessible (404 on `get-repo`) → `{ skipped: "repo_not_accessible" }`. Covers revoked installations and renamed/deleted repos.
- Tree has no `.lightfast/` paths → `{ skipped: "no_dotlightfast_config" }`. Treated as opt-in.
- SPEC.md absent AND skills array empty → `{ skipped: "dotlightfast_empty" }`.
- Individual SKILL.md with invalid frontmatter → parser logs and skips that skill, continues.
- `tree.truncated === true` → parser returns error → step throws → Inngest retries. v2 fallback: re-request `.lightfast/` subtree specifically.
- `orgEvents` row missing for `eventExternalId` → `{ skipped: "event_row_missing" }`. Race condition — rare; triage fires before the event-store transaction commits.
- GitHub 401 → proxy's existing 401 refresh logic handles it.
- `providerConfigs.github` undefined (env misconfig) → fatal error, no retry (bad config won't self-heal).
- LLM generation failure → function retries via Inngest's `retries: 2`. On final failure, no `agent.decided` event is emitted.

## Historical Context (from thoughts/)

No existing documents in `thoughts/` relate to this topic. Several filenames in git status (`2026-04-07-dotlightfast-context-indexing.md`, `2026-04-10-lightfast-github-skill.md`) are referenced but the files themselves are not on disk on the `main` branch (they exist only in the git worktrees at `.claude/worktrees/agent-*/`).

The existing `orgRepoIndexes` feature (PR #595, worktree `agent-a64cb1aa`) is the immediate precedent — it landed the concept that an org has one "primary Lightfast-aware repo" that gets scanned on push. v1 builds directly on that model.

## Related Research

None yet for this topic.

## Open Questions

1. **Should triage-prompt live in `@repo/prompt-engine` or inline in `api/platform/`?** Staying inline in v1 keeps blast radius small; moving to prompt-engine makes sense once we have 2+ prompts using the same sections.

2. **What is the retention policy for `platform/agent.decided` events?** Inngest retains events per the platform's config. If we need a durable audit log, an `orgAgentDecisions` table might be needed in v2. For v1, Inngest event history is sufficient.

3. **How should v1 behave when `.lightfast/SPEC.md` is absent but skills exist (or vice versa)?** Current design: proceed if either is present. Alternative: require SPEC.md as a gate (treat skill-only config as misconfigured). Lean toward permissive for v1.

4. ~~Should the triage function be sampled?~~ **Resolved.** Gate on `significanceScore >= 0.3` (see Delta 3, step 0). Threshold is a constant for v1; can be made per-org in v2 if needed.

5. **Does `.lightfast/` live in the same repo as the indexed repo, or a separate convention repo?** The current `orgRepoIndexes` model says "one repo per org," which implies the customer picks one repo and puts `.lightfast/` there. Confirmed as the v1 assumption. If customers put `.lightfast/` in a *separate* repo, v1 silently returns `{ skipped: "no_dotlightfast_config" }` — acceptable failure mode; escalate in v2 if it becomes a pattern.

6. **`get-tree` SHA resolution — branch name vs SHA.** GitHub's `/repos/{owner}/{repo}/git/trees/{tree_sha}` accepts either a branch name OR a commit/tree SHA. v1 uses the default-branch name (from `get-repo`), which is simpler but means the tree can shift between steps of a single triage run. For a single-turn triage this is fine; skill execution in v2 should pin to a specific commit SHA.

## Improvement Log

Adversarial review performed 2026-04-18 against the original draft. See the section above each delta for the final design; this log summarizes what was challenged and why.

### Critical fixes applied

1. **`@repo/app-config` is deleted on main** (commit `e0b66b2b5`). Original Delta 1 extended this dead package. Fixed: introduced new package `@repo/dotlightfast` instead. (User decision.)
2. **404 handling was wrong.** `proxy.execute` returns `{ status, data, headers }`; it does not throw on non-200. Original `try/catch(is404)` never fires. Fixed: status-based checks (`if (res.status === 404) return null`).
3. **Skill hallucination risk.** Original `skillName: z.string().optional()` allowed the LLM to invent skill names. Fixed: `z.enum([...skillNames, "none"])` built inside the triage step from loaded manifests.

### High-leverage improvements applied

4. **Git Tree API replaces N+1 directory walks.** Spike (isolation worktree `agent-ad3823de`) CONFIRMED that adding two endpoints (`get-tree`, `get-blob`) slots into the existing `ApiEndpoint` interface with zero type changes. For a 10-skill config: 54 calls → 33 calls (~40% reduction), and directory-listing round-trips eliminated entirely. New Delta 7 captures the endpoint definitions.
5. **Significance gate.** Original plan ran triage on 100% of events. `event.data.significanceScore` already rides the event; gating at `>= 0.3` skips noise with zero DB/HTTP/LLM work. Open Question #4 resolved.
6. **Model choice: Haiku, not Sonnet.** Existing codebase precedent (`packages/app-rerank/src/providers/llm.ts:154`) uses Haiku for structured scoring. Triage is the same shape. Sonnet reserved for v2 skill execution where reasoning matters more.
7. **Fetcher abstraction dropped.** Original design wrapped all I/O in a generic `Fetcher` callback passed to the parser. With Git Tree API, there are exactly two call shapes (tree + blob), both Inngest-step concerns. Parser now takes `{ tree, readBlob }` directly — no premature abstraction.
8. **Provider-config guard.** `providerConfigs.github` returns `undefined` if env vars aren't set. Added Delta 8 (`requireGithubProvider` helper) so misconfiguration surfaces clearly rather than crashing mid-step.

### Factual corrections

9. Original doc claimed `platform-repo-index-sync.ts` had a "3-step resolution pattern" — it has 4 steps (`check-context-config`, `resolve-installation`, `fetch-readme`, `update-cache`). Corrected.
10. Original doc claimed `ApiEndpoint.method` allows `"GET" | "POST"` — every declared endpoint in `github/api.ts` is `GET`. Corrected.
11. Original doc implied `clerkOrgId` was the lookup key in the existing repo-sync function — actually that function scopes by `providerResourceId + isActive`. Triage is the first function to scope by `clerkOrgId` (which does have a unique index on `orgRepoIndexes`).

### User scope decisions

- **Parser location:** new package `@repo/dotlightfast` (not inline, not revived `@repo/app-config`).
- **Fetch strategy:** live-fetch per event (rejected push-time caching in `orgRepoIndexes.cachedContent` — kept v1 surface smaller; may revisit in v2).
- **Triage gating:** `significanceScore >= 0.3`.
- **Spike:** approved and executed; verdict CONFIRMED.

### Spike artifact

- Worktree: `.claude/worktrees/agent-ad3823de/`
- Spike file: `packages/app-providers/src/providers/github/spike-parse-tree.ts` (~95 lines, typechecks against existing `ApiEndpoint` interface without modifications).
- Key finding: ~40% call reduction, zero interface changes, only edge case is `truncated: true` on repos with >100k tree entries (not a concern for realistic `.lightfast/` configs).
