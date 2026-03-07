# gwInstallations + workspaceIntegrations Final Architecture Plan

## Overview

Resolve all outstanding schema, data, and cache debt between `gwInstallations` and `workspaceIntegrations`. This plan covers six changes: NOT NULL FK migration, backfillConfig write path, accountLogin column removal, providerConfig.installationId elimination, Vercel OAuth display caching, and Linear organization backfill.

## Current State Analysis

The `gwInstallations` (org-scoped OAuth connection) and `workspaceIntegrations` (workspace-scoped source) tables have a 1:N relationship via a **nullable** FK. Several columns are either never written (`accountLogin`), never read from DB (`backfillConfig`), or redundant with JSONB data (`providerConfig.installationId`). Display name resolution makes live API calls for Vercel and shows raw IDs for resources. Linear's `organization` field is optional despite being available from the API.

### Key Discoveries:
- All 3 production INSERT paths always set `installationId` — only seed CLI omits it (`console-test-data/src/cli/seed-integrations.ts:118`)
- `accountLogin` column is never populated in production; `resolveFromGithubOrgSlug` at `workspace.ts:119` queries an always-null column
- `backfillConfig` has zero write paths — the UI (`source-settings-form.tsx`) renders it disabled/read-only
- `providerConfig.installationId` duplicates `gwInstallations.externalId` by construction (`providers/github/index.ts:267`)
- Vercel OAuth token exchange returns only IDs (not slugs/usernames) — a follow-up API call during `processCallback` is needed
- `fetchLinearContext` is module-private — must be exported for the backfill script

## Desired End State

After this plan is complete:

| Concern | Before | After |
|---|---|---|
| `workspaceIntegrations.installationId` | Nullable, `onDelete: "set null"` | NOT NULL, `onDelete: "cascade"` |
| `gwInstallations.accountLogin` | Nullable column, never populated | Dropped |
| `resolveFromGithubOrgSlug` procedure | Queries always-null column | Removed (dead code) |
| `gwInstallations.backfillConfig` | Column exists, zero write paths, read-only UI | tRPC mutation + editable UI + used as defaults by `notifyBackfill` |
| `providerConfig.installationId` (GitHub) | Duplicates `gwInstallations.externalId` | Removed from schema |
| `markGithubInstallationInactive` | Full table scan + in-memory JSONB filter | Indexed JOIN through FK path |
| Vercel display names | Live API calls on every `connections.vercel.list` | Cached in `providerAccountInfo` at OAuth callback |
| Linear `organization` | Optional in schema | Required; older installations backfilled |

### How to verify:
- `pnpm typecheck` passes with no errors
- `pnpm lint` passes
- All existing tests pass
- `pnpm db:generate` produces clean migration
- Vercel `connections.vercel.list` makes zero live Vercel API calls for display names
- `SourceSettingsForm` allows editing depth and entity types
- Linear `connections.linear.get` always returns non-null `organizationName` and `organizationUrlKey`

## What We're NOT Doing

- Resource-level display name cache (resolving `providerResourceId` -> human-readable repo/project name) — deferred to a future plan
- `gwResources` table changes — out of scope
- Webhook routing cache changes — existing `gw:resource:*` Redis pattern is unaffected
- UI redesign of the sources page — only enabling existing disabled form fields

## Implementation Approach

Five sequential phases, each independently deployable. Phase 1 (schema cleanup) is the foundation — Phases 2-5 build on it but are independent of each other.

---

## Phase 1: Schema Cleanup — NOT NULL FK + Drop accountLogin

### Overview
Make `installationId` NOT NULL with CASCADE delete, drop the unused `accountLogin` column, remove the dead `resolveFromGithubOrgSlug` procedure, and fix all downstream references.

### Changes Required:

#### 1. Fix seed CLI to include installationId
**File**: `packages/console-test-data/src/cli/seed-integrations.ts`
**Changes**: Add `installationId` to the INSERT values at line 118-128. The seed already creates `gwInstallations` rows — use their IDs.

#### 2. Schema changes
**File**: `db/console/src/schema/tables/workspace-integrations.ts`
**Changes**: At line 37-40, change:
```typescript
// Remove TODO comment, make NOT NULL with cascade
installationId: varchar("installation_id", { length: 191 })
  .notNull()
  .references(() => gwInstallations.id, { onDelete: "cascade" }),
```

**File**: `db/console/src/schema/tables/gw-installations.ts`
**Changes**: Remove `accountLogin` column at line 17.

#### 3. Generate and apply migration
Run `pnpm db:generate` from `db/console/`. This will produce a migration that:
- Adds NOT NULL constraint to `installation_id` on `lightfast_workspace_integrations`
- Changes FK action from `set null` to `cascade`
- Drops `account_login` column from `lightfast_gw_installations`

#### 4. Change LEFT JOIN to INNER JOIN
**File**: `api/console/src/router/org/workspace.ts`
**Changes**: At line 607-611, change `leftJoin` to `innerJoin` in the `sources.list` query. Remove the `?? null` fallback at line 642 (no longer needed since JOIN always matches).

#### 5. Remove resolveFromGithubOrgSlug
**File**: `api/console/src/router/org/workspace.ts`
**Changes**: Delete the `resolveFromGithubOrgSlug` procedure at lines 112-164. It queries the now-dropped `accountLogin` column and is never called in production.

**File**: `packages/console-api-services/src/workspaces.ts`
**Changes**: Remove the `resolveFromGithubOrgSlug` method at lines 10-19. If this makes `WorkspacesService` empty, delete the file and remove its export from `packages/console-api-services/src/index.ts`.

#### 6. Fix debug inject-event context
**File**: `apps/console/src/app/api/debug/inject-event/_lib/context.ts`
**Changes**: At line 23, replace `installation.accountLogin ?? "acme"` with a read from `providerAccountInfo`. For GitHub: `(installation.providerAccountInfo as GitHubAccountInfo)?.raw?.account?.login ?? "acme"`.

#### 7. Fix gateway GET endpoint
**File**: `apps/gateway/src/routes/connections.ts`
**Changes**: At line 441, remove `accountLogin: installation.accountLogin` from the response object.

#### 8. Update test fixtures
**Files**:
- `apps/gateway/src/routes/connections.test.ts:745` — remove `accountLogin` from mock data
- `packages/integration-tests/src/__snapshots__/contract-snapshots.test.ts.snap:5` — remove `accountLogin` from snapshot (will auto-update on next test run)

### Success Criteria:

#### Automated Verification:
- [x] `pnpm db:generate` produces a clean migration (run from `db/console/`) — `0039_luxuriant_imperial_guard.sql`
- [ ] `pnpm db:migrate` applies cleanly
- [x] `pnpm typecheck` passes (no new errors introduced)
- [x] `pnpm lint` passes (only pre-existing failures in other packages)
- [x] All tests pass: `pnpm test` (only pre-existing backfill estimate failures unrelated to these changes)

#### Manual Verification:
- [ ] Sources page loads correctly — all integrations still display
- [ ] Deleting a `gwInstallation` cascades and removes linked `workspaceIntegrations` rows
- [ ] Gateway `GET /connections/:id` response no longer includes `accountLogin`

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Wire Up backfillConfig

### Overview
Add a tRPC mutation to update `backfillConfig` on `gwInstallations`, enable the form UI, and have `notifyBackfill()` use stored config as defaults when caller doesn't provide explicit values.

### Changes Required:

#### 1. Add tRPC mutation
**File**: `api/console/src/router/org/connections.ts`
**Changes**: Add a new mutation following the ownership pattern at lines 130-156:

```typescript
updateBackfillConfig: orgScopedProcedure
  .input(z.object({
    installationId: z.string().min(1),
    backfillConfig: z.object({
      depth: backfillDepthSchema,
      entityTypes: z.array(z.string()).min(1),
    }),
  }))
  .mutation(async ({ ctx, input }) => {
    await db
      .update(gwInstallations)
      .set({ backfillConfig: input.backfillConfig })
      .where(
        and(
          eq(gwInstallations.id, input.installationId),
          eq(gwInstallations.orgId, ctx.auth.orgId),
        ),
      );
    return { success: true };
  }),
```

Import `backfillDepthSchema` from `@repo/console-validation`.

#### 2. Pass installationId to SourceSettingsForm
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx`
**Changes**: At line 271, also pass `installationId={integration.installationId}` as a prop to `<SourceSettingsForm>`. Since `installationId` is now NOT NULL (Phase 1), this is always available.

#### 3. Enable the form
**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/source-settings-form.tsx`
**Changes**:
- Add `installationId: string` to props (line 19-24)
- Add `useState` for `depth` and `entityTypes`, initialized from `backfillConfig` prop
- Remove `disabled` from the `<Select>` at line 94
- Add `onValueChange` handler to update depth state
- Add toggle/remove handlers for entity type badges
- Add a save button that calls `trpc.connections.updateBackfillConfig.useMutation()`
- On successful save, invalidate `workspace.sources.list` query

#### 4. Update notifyBackfill to use stored defaults
**File**: `api/console/src/lib/backfill.ts`
**Changes**: When `depth` or `entityTypes` are not explicitly provided in the function args (lines 10-18), fetch `gwInstallations.backfillConfig` from the DB and use those values as defaults before falling back to hardcoded defaults (depth: 30).

```typescript
export async function notifyBackfill(opts: {
  installationId: string;
  provider: SourceType;
  orgId: string;
  depth?: number;
  entityTypes?: string[];
  holdForReplay?: boolean;
  correlationId?: string;
}) {
  // If depth/entityTypes not provided, try to load from gwInstallations.backfillConfig
  let resolvedDepth = opts.depth;
  let resolvedEntityTypes = opts.entityTypes;

  if (resolvedDepth === undefined || resolvedEntityTypes === undefined) {
    const installation = await db.query.gwInstallations.findFirst({
      where: eq(gwInstallations.id, opts.installationId),
      columns: { backfillConfig: true },
    });
    if (installation?.backfillConfig) {
      resolvedDepth ??= installation.backfillConfig.depth;
      resolvedEntityTypes ??= installation.backfillConfig.entityTypes;
    }
  }

  const payload: BackfillTriggerPayload = {
    installationId: opts.installationId,
    provider: opts.provider,
    orgId: opts.orgId,
    ...(resolvedDepth !== undefined && { depth: resolvedDepth }),
    ...(resolvedEntityTypes !== undefined && { entityTypes: resolvedEntityTypes }),
    ...(opts.holdForReplay !== undefined && { holdForReplay: opts.holdForReplay }),
  };
  // ... rest unchanged
}
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (no new errors introduced)
- [x] `pnpm lint` passes (only pre-existing failures in other packages)
- [x] All tests pass: `pnpm test` (only pre-existing backfill estimate failures unrelated to these changes)

#### Manual Verification:
- [ ] Sources page shows backfill config as editable (depth dropdown + entity type toggles)
- [ ] Changing depth and saving persists the value (page refresh shows saved value)
- [ ] `notifyBackfill()` uses stored config when called without explicit depth/entityTypes
- [ ] Form correctly handles null `backfillConfig` (first-time setup for installations that have never configured it)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Remove providerConfig.installationId + Rewrite markGithubInstallationInactive

### Overview
Replace the full table scan + in-memory JSONB filter in `markGithubInstallationInactive` with an indexed JOIN through the now-NOT-NULL FK. Remove `installationId` from `githubProviderConfigSchema`.

### Changes Required:

#### 1. Rewrite markGithubInstallationInactive
**File**: `api/console/src/router/m2m/sources.ts`
**Changes**: Replace lines 188-249. Instead of loading all active sources and filtering in memory, use a JOIN:

```typescript
// Find sources linked to this GitHub installation via FK path
const installationSources = await db
  .select({
    id: workspaceIntegrations.id,
    workspaceId: workspaceIntegrations.workspaceId,
    providerConfig: workspaceIntegrations.providerConfig,
    providerResourceId: workspaceIntegrations.providerResourceId,
  })
  .from(workspaceIntegrations)
  .innerJoin(
    gwInstallations,
    eq(workspaceIntegrations.installationId, gwInstallations.id),
  )
  .where(
    and(
      eq(gwInstallations.provider, "github"),
      eq(gwInstallations.externalId, input.githubInstallationId),
      eq(workspaceIntegrations.isActive, true),
    ),
  );
```

This leverages the unique index on `(provider, externalId)` at `gw-installations.ts:54-57` for an efficient lookup instead of scanning the entire table.

#### 2. Remove installationId from githubProviderConfigSchema
**File**: `packages/console-providers/src/provider-config.ts`
**Changes**: Remove `installationId: z.string()` from the GitHub variant at line 16. This field was only read at `m2m/sources.ts:201` (now rewritten) and is always equal to `gwInstallations.externalId`.

#### 3. Update buildProviderConfig for GitHub
**File**: `packages/console-providers/src/providers/github/index.ts`
**Changes**: At line 267, remove `installationId: installationExternalId` from the returned config object. Remove `installationExternalId` from the function parameters if it's no longer used for anything else.

#### 4. Update callers of buildProviderConfig
**File**: `api/console/src/router/org/workspace.ts`
**Changes**: At line 1229, stop passing `installationExternalId` (or the parameter name used) to `buildProviderConfig`.

**File**: `api/console/src/router/user/workspace.ts`
**Changes**: At lines 239-255, if this INSERT manually constructs a GitHub providerConfig, remove the `installationId` field.

#### 5. Update seed data
**File**: `packages/console-test-data/src/cli/seed-integrations.ts`
**Changes**: At line 39, remove `installationId` from any manually-constructed providerConfig objects for GitHub seeds.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes (ensures no remaining references to `providerConfig.installationId`)
- [x] `pnpm lint` passes (only pre-existing failures in `@api/console`, `@lightfast/console`, `@repo/integration-tests`)
- [x] All tests pass: `pnpm test` (only pre-existing backfill estimate failures unrelated to these changes)

#### Manual Verification:
- [ ] GitHub installation deletion (via webhook `installation.deleted`) correctly deactivates all linked sources
- [ ] No regressions in source listing or webhook delivery

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Vercel OAuth Display Caching

### Overview
Eliminate live Vercel API calls in `connections.vercel.list` by caching `team_slug` and `username` in `providerAccountInfo` during the OAuth callback.

### Changes Required:

#### 1. Extend VercelOAuthRaw schema
**File**: `packages/console-providers/src/providers/vercel/auth.ts`
**Changes**: At lines 7-12, add optional cached display fields:

```typescript
export const vercelOAuthRawSchema = z.object({
  token_type: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
  // Cached display fields (resolved during OAuth callback)
  team_slug: z.string().optional(),
  username: z.string().optional(),
});
```

These are optional so existing installations without cached data still validate.

#### 2. Add display name resolution to processCallback
**File**: `packages/console-providers/src/providers/vercel/index.ts`
**Changes**: After the token exchange at line 190-192 (where we have `accessToken` available), add follow-up API calls to resolve display names before building `accountInfo`:

```typescript
// Resolve display name during callback (eliminates live API calls later)
let teamSlug: string | undefined;
let username: string | undefined;

if (parsed.team_id) {
  try {
    const teamRes = await fetch(`https://api.vercel.com/v2/teams/${parsed.team_id}`, {
      headers: { Authorization: `Bearer ${oauthTokens.accessToken}` },
    });
    if (teamRes.ok) {
      const teamData = await teamRes.json();
      teamSlug = teamData.slug;
    }
  } catch { /* fall through — display will use raw ID */ }
} else {
  try {
    const userRes = await fetch("https://api.vercel.com/v2/user", {
      headers: { Authorization: `Bearer ${oauthTokens.accessToken}` },
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      username = userData.user?.username;
    }
  } catch { /* fall through */ }
}
```

Then include in the `raw` object at lines 203-225:
```typescript
raw: {
  token_type: parsed.token_type,
  installation_id: parsed.installation_id,
  user_id: parsed.user_id,
  team_id: parsed.team_id ?? null,
  ...(teamSlug && { team_slug: teamSlug }),
  ...(username && { username }),
},
```

#### 3. Update connections.vercel.list to use cached data
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 554-632, replace the live API call block. Instead of calling `getInstallationToken` + Vercel API:

```typescript
// Use cached display data from providerAccountInfo
let accountLogin: string;
if (info.raw.team_id) {
  accountLogin = info.raw.team_slug ?? info.raw.team_id;
} else {
  accountLogin = info.raw.username ?? info.raw.user_id;
}
```

Remove the `getInstallationToken` call, the `fetch` calls to Vercel API, and the try/catch blocks. Remove the TODO comment at lines 569-570.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] All tests pass: `pnpm test`

#### Manual Verification:
- [ ] Connect a new Vercel installation — verify `team_slug` or `username` appears in `providerAccountInfo` after callback
- [ ] `connections.vercel.list` returns human-readable labels without making external API calls
- [ ] Existing Vercel installations (without cached data) gracefully fall back to raw IDs
- [ ] Re-connecting an existing Vercel installation updates the cached display fields

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Linear Organization Backfill + Make Required

### Overview
Backfill `organization` data for existing Linear installations, then make the field required in the schema. Export `fetchLinearContext` for the backfill script.

### Changes Required:

#### 1. Export fetchLinearContext
**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: At line 25, change `fetchLinearContext` from a module-private function to an exported function. It already has a clean interface: takes `accessToken: string`, returns `{ externalId, organizationName?, organizationUrlKey? }`.

#### 2. Create backfill CLI script
**File**: `packages/console-test-data/src/cli/backfill-linear-organization.ts`
**Changes**: New file following the pattern at `reconcile-pinecone-external-ids.ts`:

```typescript
#!/usr/bin/env npx tsx
import { db } from "@db/console";
import { gwInstallations } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createGatewayClient } from "@repo/gateway-service-clients";
import { fetchLinearContext } from "@repo/console-providers/providers/linear";

const env = {
  GATEWAY_URL: process.env.GATEWAY_URL!,
  GATEWAY_API_KEY: process.env.GATEWAY_API_KEY!,
};

async function main() {
  const gw = createGatewayClient({ apiKey: env.GATEWAY_API_KEY });

  // Find all Linear installations
  const linearInstallations = await db
    .select()
    .from(gwInstallations)
    .where(eq(gwInstallations.provider, "linear"));

  console.log(`Found ${linearInstallations.length} Linear installations`);

  for (const inst of linearInstallations) {
    const info = inst.providerAccountInfo as any;
    if (info?.organization?.name && info?.organization?.urlKey) {
      console.log(`  [skip] ${inst.id} — already has organization data`);
      continue;
    }

    try {
      // Decrypt token via gateway
      const token = await gw.getToken(inst.id);

      // Fetch organization data from Linear API
      const context = await fetchLinearContext(token.accessToken);

      if (!context.organizationName && !context.organizationUrlKey) {
        console.log(`  [warn] ${inst.id} — Linear API returned no organization data`);
        continue;
      }

      // Update providerAccountInfo with organization data
      const updatedInfo = {
        ...info,
        organization: {
          id: context.externalId,
          name: context.organizationName,
          urlKey: context.organizationUrlKey,
        },
      };

      await db
        .update(gwInstallations)
        .set({ providerAccountInfo: updatedInfo })
        .where(eq(gwInstallations.id, inst.id));

      console.log(`  [ok] ${inst.id} — backfilled: ${context.organizationName} (${context.organizationUrlKey})`);
    } catch (err) {
      console.error(`  [err] ${inst.id} — ${err}`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run with: `cd apps/console && pnpm with-env tsx ../../packages/console-test-data/src/cli/backfill-linear-organization.ts`

#### 3. Make organization required in schema
**File**: `packages/console-providers/src/providers/linear/auth.ts`
**Changes**: After running the backfill successfully, change line 23-27:

```typescript
organization: z.object({
  id: z.string(),
  name: z.string(),
  urlKey: z.string(),
}),
```

Remove `.optional()` from `organization`, `name`, and `urlKey`.

#### 4. Update processCallback to always include organization
**File**: `packages/console-providers/src/providers/linear/index.ts`
**Changes**: At lines 347-355, remove the conditional spread. Always include the `organization` block. If the Linear API doesn't return organization data, use fallback values:

```typescript
organization: {
  id: linearContext.externalId,
  name: linearContext.organizationName ?? "",
  urlKey: linearContext.organizationUrlKey ?? "",
},
```

#### 5. Update connections.linear.get consumer
**File**: `api/console/src/router/org/connections.ts`
**Changes**: At lines 789-805, remove the optional chaining since `organization` is now required:

```typescript
return {
  ...
  organizationName: info.organization.name,
  organizationUrlKey: info.organization.urlKey,
};
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm typecheck` passes (ensures all optional chaining is removed where `organization` is now required)
- [ ] `pnpm lint` passes
- [ ] All tests pass: `pnpm test`
- [ ] Backfill script runs successfully against dev/staging data

#### Manual Verification:
- [ ] All existing Linear installations have `organization` data in `providerAccountInfo`
- [ ] New Linear connections store `organization` data at callback time
- [ ] `connections.linear.get` returns non-null `organizationName` and `organizationUrlKey`
- [ ] Linear installations where the API genuinely returns no organization data are handled (empty string fallback)

**Implementation Note**: The backfill script (step 2) MUST be run and verified BEFORE making the schema required (step 3). Step 3 should only be applied after confirming all existing rows have been backfilled.

---

## Testing Strategy

### Unit Tests:
- New test for `updateBackfillConfig` mutation (Phase 2) — verify ownership enforcement
- Update `markGithubInstallationInactive` tests (Phase 3) — verify JOIN-based logic
- Update Vercel callback tests (Phase 4) — verify `team_slug`/`username` stored in accountInfo

### Integration Tests:
- Contract snapshot at `contract-snapshots.test.ts.snap` will need updating (remove `accountLogin`)
- `api-console-connections.integration.test.ts` assertions may need updating for new Vercel accountInfo shape

### Manual Testing Steps:
1. Connect a new GitHub installation — verify cascade delete works
2. Edit backfill config on sources page — verify persistence
3. Connect a new Vercel installation — verify cached display name
4. Connect a new Linear installation — verify organization data stored
5. Delete a `gwInstallation` — verify all linked `workspaceIntegrations` are cascade-deleted

## Performance Considerations

- **Phase 3** is a significant performance improvement: `markGithubInstallationInactive` goes from O(all active sources) full table scan to O(1) indexed lookup via `(provider, externalId)` unique index
- **Phase 4** eliminates 2 external API calls per Vercel installation on every `connections.vercel.list` request
- **Phase 2** adds one optional DB read to `notifyBackfill()` — only triggered when caller doesn't provide explicit depth/entityTypes

## Migration Notes

- **Phase 1**: The NOT NULL migration requires no data backfill (confirmed: no NULL rows in production). The `accountLogin` drop is purely destructive — no data loss since the column is always null.
- **Phase 4**: Existing Vercel installations will show raw IDs until re-connected (no retroactive backfill). This is the same behavior they have today on API errors.
- **Phase 5**: The backfill script must run before schema change. Run against staging first. Installations where Linear API returns no organization data will get empty-string fallbacks.

## Dependency Graph

```
Phase 1 (Schema Cleanup)
   |
   +---> Phase 2 (backfillConfig) — needs NOT NULL for installationId prop
   |
   +---> Phase 3 (providerConfig.installationId removal) — needs NOT NULL FK for JOIN
   |
   +---> Phase 4 (Vercel OAuth caching) — independent, but cleaner after Phase 1
   |
   +---> Phase 5 (Linear organization) — independent
```

Phase 1 must go first. Phases 2-5 can proceed in any order after Phase 1.

## References

- Research document: `thoughts/shared/research/2026-03-07-gw-installations-workspace-integrations-table-linking.md`
- Schema: `db/console/src/schema/tables/gw-installations.ts`, `db/console/src/schema/tables/workspace-integrations.ts`
- Provider config: `packages/console-providers/src/provider-config.ts`
- Backfill validation: `packages/console-validation/src/schemas/gateway.ts`
- Sources list query: `api/console/src/router/org/workspace.ts:582-649`
- M2M sources router: `api/console/src/router/m2m/sources.ts:188-249`
- Connections router: `api/console/src/router/org/connections.ts`
- Gateway OAuth callback: `apps/gateway/src/routes/connections.ts:269-289`
- Backfill orchestrator: `apps/backfill/src/workflows/backfill-orchestrator.ts`
- Source settings form: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/source-settings-form.tsx`
- Linear provider: `packages/console-providers/src/providers/linear/index.ts`
- Vercel provider: `packages/console-providers/src/providers/vercel/index.ts`
- CLI script pattern: `packages/console-test-data/src/cli/reconcile-pinecone-external-ids.ts`
