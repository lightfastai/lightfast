# Console Providers Type Safety — Implementation Plan

## Overview

Eliminate all unsafe type casts (`as X`, `as unknown as X`) from `packages/console-providers/` by tightening Zod schemas, threading generics, and typing adapter functions. 25 casts total — 9 `res.data as X`, 7 `payload as X`, 5 `rawData as Record`, 2 `as unknown as PreTransform*`, 2 `providerAccountInfo as X`. No new dependencies (no Effect-TS). No consumer migration. Zero breaking changes.

## Current State Analysis

The package has a clean architecture (factory pattern, `as const` registry, compile-time type derivation). However, three interface boundaries erase types:

1. **`ProxyExecuteResponse.data: unknown`** (`provider/api.ts:58`) — every `executeApi` call requires a cast on the response
2. **`ResourcePickerDef.providerAccountInfo: unknown`** (`provider/resource-picker.ts:41,56`) — Vercel must cast to access `raw.team_id`
3. **`WebhookDef.extractEventType(headers, payload: unknown)`** (`provider/webhook.ts:57-59`) — all webhook extractors cast payload

Plus two structural gaps:
4. **GitHub backfill adapters** use `as unknown as PreTransform*` because `buildRepoData` returns `Record<string, unknown>` instead of matching `ghRepositorySchema`
5. **OAuth token exchange** casts `rawData as Record<string, unknown>` instead of using the Zod schema already in scope

### Key Discoveries:
- `ResponseDataFor<P, E>` already exists at `registry.ts:307-313` but is only used at the `ExecuteApiFn` interface in `gateway-service-clients` — never flows into provider callbacks
- `ResourcePickerDef` is not generic (`shape.ts:63`), even though `BaseProviderFields` has `TAccountInfoSchema` — the type isn't threaded
- Linear and Sentry backfill adapters use `satisfies` successfully — GitHub is the only provider with `as unknown as` casts
- 5 of 9 `res.data` casts have precise Zod response schemas available; 4 need schemas tightened (Linear GraphQL `data: z.unknown()`, Vercel `get-team`/`get-user` using `z.record`)
- Only Vercel reads `providerAccountInfo` in both `enrichInstallation` and `listResources` — other providers ignore it
- `OAuthTokens.raw` is already typed `Record<string, unknown>` (`primitives.ts:29`) — the cast from `unknown` is always post-Zod-parse and structurally safe

## Desired End State

After all phases:
- Zero `as X` casts in provider implementations (`providers/*/index.ts`)
- Zero `as unknown as X` casts in backfill adapters (`providers/*/backfill.ts`)
- `ResourcePickerDef` is generic over `TAccountInfo` — Vercel's callbacks receive typed account info
- All `res.data` responses are validated through Zod schemas — runtime type safety, not just compile-time assertions
- Webhook payload extractors receive `Record<string, unknown>` instead of `unknown`
- OAuth token exchange uses validated Zod output instead of casting

### Verification:
```bash
pnpm typecheck                                      # zero errors across all apps
pnpm check                                          # zero lint errors
pnpm --filter @repo/console-providers test           # all tests pass
# Grep for remaining casts:
rg "as unknown as|res\.data as|payload as \{|rawData as" packages/console-providers/src/providers/
# Should return zero matches
```

## What We're NOT Doing

- **Effect-TS introduction** — the type problems are generic erasure, not error typing; Effect doesn't address the root causes and would require migrating 54 consumer files
- **Making `ApiEndpoint.responseSchema` generic** — would cascade through every interface; Zod parse at call sites is simpler
- **Typed `ResourcePickerExecuteApiFn` with generics** — the closure binding in tRPC procedures erases the provider/endpoint context; Zod parse at the boundary is more practical
- **Changing `BackfillEntityHandler.cursor` from `unknown`** — the `typedEntityHandler<TCursor>` erasure at `provider/backfill.ts:90` is intentional and correct for heterogeneous collections
- **Modifying `ExecuteApiFn` overloads** in `gateway-service-clients` — the narrow overload already works for typed call sites; this plan fixes the provider-internal casts
- **Registry iteration casts** (`source as SourceType`, `eventDef as EventDefinition`, `registry as Record<EventKey, ...>`) — these are pragmatic casts working around `Object.entries()` losing key narrowing; acceptable TypeScript limitation

## Implementation Approach

Phases are ordered by blast radius and risk. Phase 1 fixes the most dangerous casts (double-cast `as unknown as`). Phase 2 adds runtime validation to the most numerous casts. Phase 3 is a clean generic threading change. Phases 4-5 are lower-priority housekeeping.

Each phase is independently deployable. No consumer files change in any phase — all fixes are inside `packages/console-providers/src/`.

---

## Phase 1: Fix GitHub Backfill Adapter Double-Casts

### Overview
Eliminate the 2 `as unknown as PreTransform*` casts in `providers/github/backfill.ts` — the only unsafe double-casts in the package. Follow the `satisfies` pattern that Linear and Sentry already use.

### Changes Required:

#### 1. Type `buildRepoData` return to match `ghRepositorySchema`
**File**: `packages/console-providers/src/providers/github/backfill.ts`
**Changes**: Instead of returning `Record<string, unknown>`, return a typed object that satisfies the repository shape the transformers expect.

```typescript
// ── before ──
function buildRepoData(ctx: BackfillContext): Record<string, unknown> {
  // ...
  return {
    id: repoId,
    name,
    full_name: repoFullName,
    html_url: `https://github.com/${repoFullName}`,
    private: false,
    owner: { login: owner },
    default_branch: "main",
  };
}

// ── after ──
function buildRepoData(ctx: BackfillContext) {
  const repoFullName = ctx.resource.resourceName;
  const repoId = Number(ctx.resource.providerResourceId);
  const [owner = "", name = ""] = repoFullName.split("/");
  return {
    id: repoId,
    name,
    full_name: repoFullName,
    html_url: `https://github.com/${repoFullName}`,
    private: false,
    owner: { login: owner },
    default_branch: "main",
  } as const;
}
```

Remove the explicit `: Record<string, unknown>` return type so TypeScript infers the literal shape. The `as const` ensures literal types are preserved.

#### 2. Replace `as unknown as` with `satisfies` in adapter functions
**File**: `packages/console-providers/src/providers/github/backfill.ts`
**Changes**: Change both adapter return statements from `as unknown as PreTransform*` to `satisfies PreTransform*`.

The `sender: pr.user` field is `GitHubPR["user"]` which may be nullable. The `PreTransformGitHubPullRequestEvent` requires `sender: ghUserSchema` (non-nullable). The transformer (`transformers.ts`) never reads `sender` — but the schema requires it. Two options:

**Option A (preferred)**: Provide a fallback sender to satisfy the schema:
```typescript
// ── adaptGitHubPRForTransformer ──
return {
  action,
  number: pr.number,
  pull_request: { /* ... same ... */ },
  repository: buildRepoData(ctx),   // now returns typed object, not Record<string, unknown>
  sender: pr.user ?? { login: "unknown", id: 0, avatar_url: "" },
} satisfies PreTransformGitHubPullRequestEvent;

// ── adaptGitHubIssueForTransformer ──
return {
  action,
  issue: { /* ... same ... */ },
  repository: buildRepoData(ctx),
  sender: issue.user ?? { login: "unknown", id: 0, avatar_url: "" },
} satisfies PreTransformGitHubIssuesEvent;
```

**Option B**: If `satisfies` still fails due to nested shape mismatches (e.g., `pull_request.user` nullable), define a `BackfillPullRequestEvent` type that is a `Pick<>` of only the fields the transformer reads:
```typescript
type BackfillPRPayload = Pick<PreTransformGitHubPullRequestEvent,
  "action" | "number" | "pull_request" | "repository"
> & { sender: PreTransformGitHubPullRequestEvent["sender"] | null };
```
Then update the transformer to accept both: `payload: PreTransformGitHubPullRequestEvent | BackfillPRPayload`. This is more invasive; try Option A first.

#### 3. Thread `ctx` parameter to adapter functions
**File**: `packages/console-providers/src/providers/github/backfill.ts`
**Changes**: `adaptGitHubPRForTransformer` and `adaptGitHubIssueForTransformer` currently receive `repo: Record<string, unknown>` as their second parameter. Change to receive `ctx: BackfillContext` and call `buildRepoData(ctx)` internally — removes the need to pass the untyped repo object around.

```typescript
// ── before ──
export function adaptGitHubPRForTransformer(
  pr: GitHubPR,
  repo: Record<string, unknown>
): PreTransformGitHubPullRequestEvent {

// ── after ──
export function adaptGitHubPRForTransformer(
  pr: GitHubPR,
  ctx: BackfillContext
): PreTransformGitHubPullRequestEvent {
  const repo = buildRepoData(ctx);
```

Update both call sites in `processResponse` (lines 139, 185) to pass `ctx` instead of `repoData`.

### Success Criteria:

#### Automated Verification:
- [x] `rg "as unknown as" packages/console-providers/src/providers/github/backfill.ts` returns zero matches
- [x] Type checking passes: `pnpm typecheck`
- [x] Tests pass: `pnpm --filter @repo/console-providers test`
- [x] Lint passes: `pnpm check`

#### Manual Verification:
- [ ] The `satisfies` assertion compiles without error — confirms structural compatibility
- [ ] GitHub backfill still produces identical events (compare test snapshots if any)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 2: Zod Parse at `res.data` Boundaries in ResourcePicker Callbacks

### Overview
Replace all 9 `res.data as X` casts in `providers/*/index.ts` with Zod schema `.parse()` calls. This eliminates the casts AND adds runtime validation — a cast tells TypeScript "trust me", a parse tells the runtime "verify this".

### Changes Required:

#### 1. Tighten response schemas where too wide

**File**: `packages/console-providers/src/providers/linear/api.ts`
**Changes**: The `"graphql"` endpoint has `responseSchema: graphqlResponseSchema` where `data: z.unknown()`. Add query-specific response schemas for the two GraphQL queries used in `resourcePicker`:

```typescript
// ── New schemas (add after graphqlResponseSchema) ──

/** Response shape for `{ viewer { organization { name urlKey } } }` */
export const graphqlViewerOrgResponseSchema = z.object({
  data: z.object({
    viewer: z.object({
      organization: z.object({
        name: z.string().optional(),
        urlKey: z.string().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

/** Response shape for `{ teams { nodes { id name key description color } } }` */
export const graphqlTeamsResponseSchema = z.object({
  data: z.object({
    teams: z.object({
      nodes: z.array(z.object({
        id: z.string(),
        name: z.string(),
        key: z.string(),
        description: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
      })).optional(),
    }).optional(),
  }).optional(),
});
```

**File**: `packages/console-providers/src/providers/vercel/api.ts`
**Changes**: The `"get-team"` and `"get-user"` endpoints have wide `z.record(z.string(), z.unknown())` schemas. Add precise schemas:

```typescript
// ── Precise response schemas ──

export const vercelTeamResponseSchema = z.object({
  slug: z.string().optional(),
  name: z.string().optional(),
}).passthrough();

export const vercelUserResponseSchema = z.object({
  user: z.object({
    username: z.string().optional(),
  }).passthrough().optional(),
}).passthrough();
```

Update the endpoint definitions to use these schemas (replace the `z.record(...)` on `"get-team"` and `"get-user"`).

#### 2. Replace `res.data as X` with schema `.parse(res.data)` in all providers

**File**: `packages/console-providers/src/providers/github/index.ts`
```typescript
// ── line 261: enrichInstallation ──
// before: const data = res.data as { account?: { login?: string; ... } };
// after:
import { githubAppInstallationSchema } from "./api";
const data = githubAppInstallationSchema.parse(res.data);

// ── line 285: listResources ──
// before: const data = res.data as { repositories: Array<...> };
// after:
import { githubInstallationReposSchema } from "./api";
const data = githubInstallationReposSchema.parse(res.data);
```

**File**: `packages/console-providers/src/providers/linear/index.ts`
```typescript
// ── line 308: enrichInstallation ──
// before: const data = res.data as { data?: { viewer?: { organization?: { name?: string } } } };
// after:
import { graphqlViewerOrgResponseSchema } from "./api";
const data = graphqlViewerOrgResponseSchema.parse(res.data);

// ── line 328: listResources ──
// before: const data = res.data as { data?: { teams?: { nodes?: Array<...> } } };
// after:
import { graphqlTeamsResponseSchema } from "./api";
const data = graphqlTeamsResponseSchema.parse(res.data);
```

**File**: `packages/console-providers/src/providers/sentry/index.ts`
```typescript
// ── line 201: enrichInstallation ──
// before: const orgs = res.data as Array<{ name?: string; slug?: string }>;
// after:
import { sentryOrganizationSchema } from "./api";
const orgs = z.array(sentryOrganizationSchema).parse(res.data);

// ── line 215: listResources ──
// before: const projects = res.data as Array<{ id: string; ... }>;
// after:
import { sentryProjectSchema } from "./api";
const projects = z.array(sentryProjectSchema).parse(res.data);
```

**File**: `packages/console-providers/src/providers/vercel/index.ts`
```typescript
// ── line 180: enrichInstallation (get-team) ──
// before: const team = res.data as { slug?: string };
// after:
import { vercelTeamResponseSchema, vercelUserResponseSchema } from "./api";
const team = vercelTeamResponseSchema.parse(res.data);

// ── line 188: enrichInstallation (get-user) ──
// before: const user = res.data as { user?: { username?: string } };
// after:
const user = vercelUserResponseSchema.parse(res.data);

// ── line 218: listResources ──
// before: const data = res.data as { projects: Array<...> };
// after:
import { vercelProjectsListSchema } from "./api";
const data = vercelProjectsListSchema.parse(res.data);
```

#### 3. Wrap in try-catch for defensive error handling
Since `resourcePicker` callbacks document "Should handle errors internally and return fallback data", wrap the `.parse()` in each callback's existing error handling or add a try-catch that returns the appropriate fallback.

### Success Criteria:

#### Automated Verification:
- [x] `rg "res\.data as" packages/console-providers/src/providers/` returns zero matches
- [x] Type checking passes: `pnpm typecheck`
- [x] Tests pass: `pnpm --filter @repo/console-providers test`
- [x] Lint passes: `pnpm check` (console-providers/ files clean; 3 pre-existing errors in integration-tests/ unrelated to Phase 2)

#### Manual Verification:
- [ ] ResourcePicker still works in the UI for all 5 providers (connect → enrich → list resources)
- [ ] Verify Zod parse doesn't reject valid API responses (check that schemas use `.passthrough()` or `.optional()` generously)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 3: Generic `ResourcePickerDef<TAccountInfo>`

### Overview
Thread the `TAccountInfo` generic through `ResourcePickerDef` so that `providerAccountInfo` is typed at the interface level. This eliminates the 2 casts in `providers/vercel/index.ts:171,206` and makes the interface self-documenting.

### Changes Required:

#### 1. Make `ResourcePickerDef` generic
**File**: `packages/console-providers/src/provider/resource-picker.ts`

```typescript
// ── before ──
export interface ResourcePickerDef {
  readonly enrichInstallation: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      id: string;
      externalId: string;
      providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedInstallation>;
  readonly installationMode: InstallationMode;
  readonly listResources: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      readonly id: string;
      readonly externalId: string;
      readonly providerAccountInfo: unknown;
    }
  ) => Promise<NormalizedResource[]>;
  readonly resourceLabel: string;
}

// ── after ──
export interface ResourcePickerDef<TAccountInfo = unknown> {
  readonly enrichInstallation: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      id: string;
      externalId: string;
      providerAccountInfo: TAccountInfo;
    }
  ) => Promise<NormalizedInstallation>;
  readonly installationMode: InstallationMode;
  readonly listResources: (
    executeApi: ResourcePickerExecuteApiFn,
    installation: {
      readonly id: string;
      readonly externalId: string;
      readonly providerAccountInfo: TAccountInfo;
    }
  ) => Promise<NormalizedResource[]>;
  readonly resourceLabel: string;
}
```

The default `= unknown` preserves backwards compatibility — existing code that uses `ResourcePickerDef` without a type parameter continues to work.

#### 2. Thread `TAccountInfo` through `BaseProviderFields`
**File**: `packages/console-providers/src/provider/shape.ts`

```typescript
// ── before (line 63) ──
readonly resourcePicker: ResourcePickerDef;

// ── after ──
readonly resourcePicker: ResourcePickerDef<
  z.infer<TAccountInfoSchema> | null
>;
```

The `| null` accounts for installations where `providerAccountInfo` hasn't been populated yet. `z.infer<TAccountInfoSchema>` resolves to the concrete account info type (e.g., `VercelAccountInfo`).

#### 3. Remove casts in Vercel's resourcePicker callbacks
**File**: `packages/console-providers/src/providers/vercel/index.ts`

```typescript
// ── line 171: enrichInstallation ──
// before:
const info = inst.providerAccountInfo as {
  raw?: { team_id?: string; user_id?: string; configuration_id?: string };
} | null;

// after (providerAccountInfo is now typed as VercelAccountInfo | null):
const info = inst.providerAccountInfo;
// Access info?.raw?.team_id directly — TypeScript knows the shape

// ── line 206: listResources ──
// before:
const info = installation.providerAccountInfo as {
  raw?: { team_id?: string };
} | null;

// after:
const info = installation.providerAccountInfo;
```

Note: `VercelAccountInfo` (from `providers/vercel/auth.ts`) must include `raw` with `team_id`, `user_id`, `configuration_id` fields. Verify the `vercelAccountInfoSchema` has these fields in `raw: z.unknown()` — if `raw` is `z.unknown()`, the cast is still needed for the nested access. In that case, tighten the `vercelAccountInfoSchema.raw` to:
```typescript
raw: z.object({
  team_id: z.string().optional(),
  user_id: z.string().optional(),
  configuration_id: z.string().optional(),
}).passthrough().nullable(),
```

### Success Criteria:

#### Automated Verification:
- [x] `rg "providerAccountInfo as" packages/console-providers/src/providers/` returns zero matches
- [x] Type checking passes: `pnpm --filter @repo/console-providers typecheck` + `pnpm --filter @api/console typecheck`
- [x] Tests pass: `pnpm --filter @repo/console-providers test` (363 tests)
- [ ] Lint passes: `pnpm check`
- [x] Consumer type check: `pnpm --filter @api/console typecheck` (tRPC procedures pass `providerAccountInfo` to callbacks)

#### Manual Verification:
- [ ] Vercel resource picker still works (team-scoped installations show team projects, user-scoped show user projects)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding.

---

## Phase 4: Type Webhook Payload Extractors (Low Priority)

### Overview
Eliminate 7 `payload as { ... }` casts in webhook extractor functions by widening the `payload` parameter from `unknown` to `Record<string, unknown>`.

### Changes Required:

#### 1. Change `WebhookDef` extractor signatures
**File**: `packages/console-providers/src/provider/webhook.ts`

```typescript
// ── before ──
extractDeliveryId: (headers: Headers, payload: unknown) => string;
extractEventType: (headers: Headers, payload: unknown) => string;
extractResourceId: (payload: unknown) => string | null;

// ── after ──
extractDeliveryId: (headers: Headers, payload: Record<string, unknown>) => string;
extractEventType: (headers: Headers, payload: Record<string, unknown>) => string;
extractResourceId: (payload: Record<string, unknown>) => string | null;
```

This is safe because `parsePayload` (the preceding step in the pipeline) always returns a parsed JSON object. Also change `parsePayload` return type:

```typescript
// ── before ──
parsePayload: (raw: unknown) => unknown;

// ── after ──
parsePayload: (raw: unknown) => Record<string, unknown>;
```

#### 2. Update all provider extractors
Remove `const p = payload as { type?: string }` patterns — access `payload.type` etc. directly with optional chaining:

```typescript
// ── linear/index.ts:375 — before ──
extractEventType: (_headers, payload) => {
  const p = payload as { type?: string; action?: string };
  return p.action ? `${p.type}.${p.action}` : (p.type ?? "unknown");
},

// ── after ──
extractEventType: (_headers, payload) => {
  const type = typeof payload.type === "string" ? payload.type : "unknown";
  const action = typeof payload.action === "string" ? payload.action : null;
  return action ? `${type}.${action}` : type;
},
```

Apply similar changes to all 7 cast sites across github, linear, sentry, vercel.

#### 3. Update relay caller to assert `Record<string, unknown>`
**File**: `apps/relay/src/middleware/webhook.ts` (or wherever `parsePayload` result is passed to extractors)
The relay middleware should ensure `parsePayload()` result is handled as `Record<string, unknown>`. If `parsePayload` in any provider returns a non-object (e.g., an array), add a guard.

### Success Criteria:

#### Automated Verification:
- [ ] `rg "payload as \{" packages/console-providers/src/providers/` returns zero matches
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Tests pass: `pnpm --filter @repo/console-providers test`
- [ ] Relay still compiles: `pnpm --filter relay typecheck`

---

## Phase 5: Type OAuth Token Exchange (Low Priority)

### Overview
Eliminate 5 `rawData as Record<string, unknown>` casts in OAuth token exchange functions.

### Changes Required:

#### 1. Use Zod-validated output instead of casting

In each OAuth exchange function, `rawData` is `unknown` from `response.json()`, then immediately validated through the provider's OAuth response schema. The validated result already contains all fields. Use the validated output for `raw`:

```typescript
// ── before (pattern in linear/index.ts:140-145) ──
const rawData: unknown = await response.json();
const data = linearOAuthResponseSchema.parse(rawData);
return {
  accessToken: data.access_token,
  // ...
  raw: rawData as Record<string, unknown>,  // ← cast
};

// ── after ──
const rawData: unknown = await response.json();
const data = linearOAuthResponseSchema.parse(rawData);
return {
  accessToken: data.access_token,
  // ...
  raw: data as Record<string, unknown>,  // data is already validated — safe widening
};
```

Alternatively, use `z.record(z.string(), z.unknown()).parse(rawData)` before constructing the return object — this adds runtime validation of the cast.

The simplest approach: since `OAuthTokens.raw` exists to capture the full provider response for debugging, and `data` (the Zod-parsed output) contains all the fields, just assign `data` directly. The widening from `z.infer<typeof linearOAuthResponseSchema>` to `Record<string, unknown>` is structurally valid.

### Success Criteria:

#### Automated Verification:
- [ ] `rg "rawData as" packages/console-providers/src/providers/` returns zero matches
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Tests pass: `pnpm --filter @repo/console-providers test`

---

## Testing Strategy

### Unit Tests:
- Existing tests in `providers/github/index.test.ts`, `providers/linear/index.test.ts`, `providers/sentry/index.test.ts`, `providers/vercel/index.test.ts` cover the core provider logic
- `registry.test.ts` covers registry derivation and event key correctness
- `crypto.test.ts` covers HMAC/timing-safe operations
- No new test files needed — existing tests validate the behavior; the changes are type-level

### Type-Level Tests:
- After Phase 2, `pnpm typecheck` confirms Zod schemas match the data shapes previously asserted via casts
- After Phase 3, `pnpm typecheck` confirms the generic `TAccountInfo` threads through correctly

### Regression Strategy:
- Run `pnpm --filter @repo/console-providers test` after each phase
- Run `pnpm typecheck` (full monorepo) after each phase to catch consumer breakage
- The Zod `.parse()` calls in Phase 2 are **strictly more correct** than casts — they add runtime validation that didn't exist before

## Performance Considerations

- Phase 2 adds Zod `.parse()` calls in `resourcePicker` callbacks — these run once per installation during the source setup flow (not hot path). The overhead is negligible.
- No bundle size changes — Zod is already a dependency.

## References

- Existing architecture plan: `thoughts/shared/plans/2026-03-18-provider-architecture-redesign.md`
- Type system definitions: `packages/console-providers/src/provider/` (shape.ts, api.ts, resource-picker.ts, webhook.ts)
- Registry: `packages/console-providers/src/registry.ts`
- Gateway service client: `packages/gateway-service-clients/src/gateway.ts` (ExecuteApiFn overloads)
- tRPC consumer: `api/console/src/router/org/connections.ts` (closure binding for executeApi)
