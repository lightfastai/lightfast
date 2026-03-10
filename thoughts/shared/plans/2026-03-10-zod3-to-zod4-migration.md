# Zod v3 → v4 Migration Plan

## Overview

Migrate all 24 remaining packages from `catalog:zod3` (`^3.25.76`) to `catalog:zod4` (`^4.0.0`), then remove the `zod3` catalog entry from `pnpm-workspace.yaml` entirely.

## Current State Analysis

**Already on zod v4 (14 packages):** `api/console`, `apps/console`, `apps/gateway`, `apps/docs`, `core/ai-sdk`, `core/cli`, `core/mcp`, `packages/console-validation`, `packages/console-providers`, `packages/console-ai`, `packages/console-openapi`, `packages/console-upstash-realtime`, `packages/console-clerk-m2m`, `packages/console-vercel`

**Still on zod v3 (24 packages):**

| Package | Zod Usage |
|---|---|
| `vendor/upstash` | env schema only |
| `vendor/analytics` | env schema only |
| `vendor/upstash-workflow` | env schema only |
| `vendor/email` | env schema only |
| `vendor/cms` | env schema only |
| `vendor/qstash` | env schema only |
| `vendor/db` | env schema + re-exports `drizzle-zod` |
| `vendor/clerk` | env schema only |
| `vendor/knock` | env schema only |
| `vendor/pinecone` | env schema only |
| `vendor/observability` | env schema only |
| `vendor/vercel-flags` | env schema only |
| `vendor/inngest` | env schema only |
| `vendor/security` | env schema only |
| `vendor/embed` | env schema only |
| `apps/www` | env schema only |
| `apps/relay` | listed in deps but no zod imports in source |
| `apps/auth` | env schema + form validation (`.safeParse`, `.flatten()`) |
| `apps/backfill` | env schema + Inngest event schemas + cross-version `any` cast |
| `packages/prompt-engine` | `z.enum()`, `z.infer` |
| `packages/console-config` | `z.object()`, `z.literal()`, `ZodError` type import |
| `packages/console-octokit-github` | env schema only |
| `packages/console-rerank` | `z.object()`, `.describe()` |
| `packages/ui` | listed in deps but no zod imports in source |

### Key Discoveries:
- **Zero third-party blockers**: All deps with zod peer deps accept `^4.0.0`:
  - `drizzle-zod@0.8.3`: `^3.25.0 || ^4.0.0`
  - `inngest@3.52.6`: `^3.25.0 || ^4.0.0`
  - `@t3-oss/env-core@0.13.10`: `^3.24.0 || ^4.0.0`
  - `@t3-oss/env-nextjs@0.13.10`: `^3.24.0 || ^4.0.0`
  - `ai@5.0.52`: `^3.25.76 || ^4`
  - `zod-openapi@5.4.6`: `^3.25.74 || ^4.0.0`
- **No import changes needed**: All packages use `import { z } from "zod"` — identical in v3 and v4
- **All APIs used are v3/v4 compatible**: `z.string()`, `z.object()`, `z.enum()`, `.safeParse()`, `.flatten()`, `.describe()`, `ZodError`, `z.infer` all work in both versions
- **One cross-version workaround exists**: `apps/backfill/src/inngest/client.ts:18` casts to `any` because `backfillTriggerPayload` (from v4 `@repo/console-validation`) was being `.extend()`ed with v3 schemas. Once backfill is also v4, the cast is removable.

## Desired End State

- All packages use `catalog:zod4`
- `zod3` catalog entry removed from `pnpm-workspace.yaml`
- Cross-version `any` cast in `apps/backfill/src/inngest/client.ts` removed
- `pnpm check && pnpm typecheck` passes cleanly

## What We're NOT Doing

- Not adopting zod v4-only APIs (`z.interface`, `z.templateLiteral`, etc.) — that's future work
- Not changing any import paths (no `zod/v4` sub-path imports)
- Not refactoring any validation logic — just swapping the version

## Implementation Approach

This is a mechanical migration: swap catalog refs, install, typecheck, clean up one workaround, remove old catalog. No source code changes needed except the backfill `any` cast cleanup.

---

## Phase 1: Bulk Catalog Swap

### Overview
Change `"zod": "catalog:zod3"` → `"zod": "catalog:zod4"` in all 24 package.json files.

### Changes Required:

#### All 24 package.json files
**Change**: `"zod": "catalog:zod3"` → `"zod": "catalog:zod4"`

Files:
- `vendor/upstash/package.json`
- `vendor/analytics/package.json`
- `vendor/upstash-workflow/package.json`
- `vendor/email/package.json`
- `vendor/cms/package.json`
- `vendor/qstash/package.json`
- `vendor/db/package.json`
- `vendor/clerk/package.json`
- `vendor/knock/package.json`
- `vendor/pinecone/package.json`
- `vendor/observability/package.json`
- `vendor/vercel-flags/package.json`
- `vendor/inngest/package.json`
- `vendor/security/package.json`
- `vendor/embed/package.json`
- `apps/www/package.json`
- `apps/relay/package.json`
- `apps/auth/package.json`
- `apps/backfill/package.json`
- `packages/prompt-engine/package.json`
- `packages/console-config/package.json`
- `packages/console-octokit-github/package.json`
- `packages/console-rerank/package.json`
- `packages/ui/package.json`

### Success Criteria:

#### Automated Verification:
- [ ] No `catalog:zod3` references remain: `grep -r "catalog:zod3" --include="package.json"` returns nothing
- [ ] `pnpm install` succeeds without errors

---

## Phase 2: Clean Up Cross-Version Workaround

### Overview
Remove the `any` cast and inline v3 compatibility schema in `apps/backfill/src/inngest/client.ts`, now that both sides use zod v4.

### Changes Required:

#### `apps/backfill/src/inngest/client.ts`
**Before:**
```typescript
// Inline Zod v3-compatible depth schema (console-validation uses Zod v4)
const backfillDepthSchemaV3 = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);

// ...
const eventsMap = {
  "apps-backfill/run.requested": backfillTriggerPayload.extend({
    correlationId: z.string().optional(),
  }) as any,
  // ...
    depth: backfillDepthSchemaV3,
```

**After:**
```typescript
const eventsMap = {
  "apps-backfill/run.requested": backfillTriggerPayload.extend({
    correlationId: z.string().optional(),
  }),
  // ...
    depth: z.union([z.literal(7), z.literal(30), z.literal(90)]),
```

- Remove the `backfillDepthSchemaV3` variable and its comment
- Remove the `as any` cast on line 18
- Inline the depth union or import it from `@repo/console-validation` if available there

### Success Criteria:

#### Automated Verification:
- [ ] No `as any` cast on the `backfillTriggerPayload.extend()` call
- [ ] No `backfillDepthSchemaV3` variable remaining
- [ ] `pnpm typecheck` passes

---

## Phase 3: Remove zod3 Catalog

### Overview
Delete the `zod3` catalog entry from `pnpm-workspace.yaml`.

### Changes Required:

#### `pnpm-workspace.yaml`
**Remove:**
```yaml
  zod3:
    zod: ^3.25.76
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm install` succeeds
- [ ] `pnpm check && pnpm typecheck` passes
- [ ] `grep -r "zod3" pnpm-workspace.yaml` returns nothing
- [ ] `grep -r "catalog:zod3" --include="package.json"` returns nothing

**Implementation Note**: After all phases complete, run `pnpm check && pnpm typecheck` as final verification.

---

## Testing Strategy

### Automated:
- `pnpm install` — lockfile resolves cleanly
- `pnpm typecheck` — no type regressions from v3→v4
- `pnpm check` — linting passes

### Manual:
- Console app loads and works (zod used in form validation, tRPC, env)
- Auth flows work (zod used in sign-in/sign-up form validation)
- Backfill triggers work (zod used in Inngest event schemas)

## Risk Assessment

**Risk: Very Low**
- All third-party deps accept zod v4
- All zod APIs used are compatible across v3/v4
- 14 packages already proven on v4
- No import changes needed
- Only 1 source code change (removing an `any` cast)

## References

- Recent v4 migration commit: `0d5ab9e25` — `fix(console): upgrade zod from v3 to v4 for apps/console and core/ai-sdk`
- Zod v4 changelog: breaking changes are minimal for the API surface used in this codebase
