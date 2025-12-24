# Zod Mixed Versioning Strategy Implementation Plan

## Overview

Remove the centralized Zod catalog version and implement a mixed versioning strategy where packages use specific Zod versions based on their dependency constraints. This enables most packages to upgrade to Zod v4 while packages with incompatible dependencies (drizzle-zod, MCP SDK) remain on Zod v3.

## Current State Analysis

### Catalog Configuration
- **Single catalog entry**: `zod: ^3.24.0` in `pnpm-workspace.yaml:19`
- **Override**: `zod-to-json-schema>zod: ^3.24.0` in `pnpm-workspace.yaml:92`
- **40 packages** use `catalog:` reference
- **3 packages** already use specific version `^3.25.76`

### Blocking Dependencies

| Package | Blocker | Reason |
|---------|---------|--------|
| `@vendor/db` | drizzle-zod ^0.7.1 | No Zod v4 support |
| `@db/chat` | drizzle-zod ^0.7.1 | Uses createInsertSchema/createSelectSchema |
| `@api/chat` | drizzle-zod schemas | Consumes schemas from @db/chat |
| `core/mcp` | @modelcontextprotocol/sdk | SDK incompatible with Zod v4 |

### Shared Package Concern
`@repo/console-types` is consumed by:
- `core/mcp` (requires v3)
- 9 other packages (can use v4)

**Decision**: Keep `@repo/console-types` on Zod v3 for compatibility. MCP is a critical integration.

## Desired End State

1. No `zod` entry in the default catalog
2. Two named catalogs: `zod3` and `zod4`
3. Each package explicitly declares which Zod version it uses
4. Packages with v3 blockers use `catalog:zod3`
5. All other packages use `catalog:zod4`
6. Override updated to reference `catalog:zod3`

### Verification
- `pnpm install` succeeds without errors
- `pnpm typecheck` passes across all packages
- `pnpm build` succeeds for all packages
- `pnpm lint` passes

## What We're NOT Doing

1. **Not migrating code syntax** - Only version configuration changes
2. **Not using subpath imports** (`zod/v4`) - Packages use single version
3. **Not updating drizzle-zod** - Waiting for upstream v4 support
4. **Not modifying MCP SDK integration** - Must stay on v3
5. **Not running codemods** - Syntax migration is separate effort

## Implementation Approach

This is a configuration-only change. We modify `pnpm-workspace.yaml` and individual `package.json` files to use named catalogs instead of the default catalog entry.

---

## Phase 1: Create Named Catalogs

### Overview
Add `zod3` and `zod4` named catalogs to `pnpm-workspace.yaml` and remove the default `zod` entry.

### Changes Required:

#### 1. pnpm-workspace.yaml
**File**: `pnpm-workspace.yaml`
**Changes**: Remove default zod, add named catalogs, update override

```yaml
# REMOVE from catalog: (line 19)
# zod: ^3.24.0

# ADD to catalogs: section (after tailwind4)
catalogs:
  tailwind4:
    tailwindcss: 4.1.11
    postcss: 8.5.6
    '@tailwindcss/postcss': 4.1.11
    '@tailwindcss/typography': ^0.5.16
  zod3:
    zod: ^3.25.76
  zod4:
    zod: ^4.0.0

# UPDATE override (line 92)
# FROM: zod-to-json-schema>zod: ^3.24.0
# TO:   zod-to-json-schema>zod: ^3.25.76
```

### Success Criteria:

#### Automated Verification:
- [ ] YAML syntax valid: `pnpm install` doesn't fail on parse
- [ ] Named catalogs recognized: `pnpm why zod` shows both versions

---

## Phase 2: Update v3-Locked Packages

### Overview
Update packages that must stay on Zod v3 due to drizzle-zod or MCP SDK dependencies.

### Changes Required:

#### 1. @vendor/db
**File**: `vendor/db/package.json`
**Change**: `"zod": "catalog:"` → `"zod": "catalog:zod3"`

#### 2. @db/chat
**File**: `db/chat/package.json`
**Change**: `"zod": "catalog:"` → `"zod": "catalog:zod3"`

#### 3. @api/chat
**File**: `api/chat/package.json`
**Change**: `"zod": "catalog:"` → `"zod": "catalog:zod3"`

#### 4. core/mcp
**File**: `core/mcp/package.json`
**Change**: `"zod": "catalog:"` → `"zod": "catalog:zod3"`

#### 5. @repo/console-types (shared by MCP)
**File**: `packages/console-types/package.json`
**Change**: `"zod": "catalog:"` → `"zod": "catalog:zod3"`

#### 6. Packages already on specific version (keep as-is or update to catalog:zod3)
These packages already use `^3.25.76`:
- `examples/nextjs-ai-chatbot/package.json`
- `core/ai-sdk/package.json`
- `packages/ai-tools/package.json`

**Change**: `"zod": "^3.25.76"` → `"zod": "catalog:zod3"` (for consistency)

### Success Criteria:

#### Automated Verification:
- [ ] Install succeeds: `pnpm install`
- [ ] Type check passes: `pnpm --filter @vendor/db typecheck`
- [ ] Type check passes: `pnpm --filter @db/chat typecheck`
- [ ] Type check passes: `pnpm --filter @api/chat typecheck`
- [ ] Build passes: `pnpm --filter @api/chat build`

---

## Phase 3: Update v4-Compatible Packages

### Overview
Update all remaining packages to use Zod v4 via the named catalog.

### Packages to Update (35 packages):

#### Apps (5)
- `apps/www/package.json`
- `apps/console/package.json`
- `apps/chat/package.json`
- `apps/docs/package.json`
- `apps/auth/package.json`

#### API (1)
- `api/console/package.json`

#### Database (1)
- `db/console/package.json`

#### Vendor (11)
- `vendor/upstash/package.json`
- `vendor/storage/package.json`
- `vendor/inngest/package.json`
- `vendor/clerk/package.json`
- `vendor/embed/package.json`
- `vendor/cms/package.json`
- `vendor/pinecone/package.json`
- `vendor/observability/package.json`
- `vendor/security/package.json`
- `vendor/analytics/package.json`
- `vendor/email/package.json`
- `vendor/upstash-workflow/package.json`

#### Packages (17)
- `packages/email/package.json`
- `packages/console-validation/package.json`
- `packages/console-auth-middleware/package.json`
- `packages/console-clerk-m2m/package.json`
- `packages/console-config/package.json`
- `packages/cms-workflows/package.json`
- `packages/console-rerank/package.json`
- `packages/ai/package.json`
- `packages/chat-ai/package.json`
- `packages/console-api-key/package.json`
- `packages/console-oauth/package.json`
- `packages/console-octokit-github/package.json`
- `packages/ui/package.json`
- `packages/console-vercel/package.json`
- `packages/app-urls/package.json`
- `packages/console-webhooks/package.json`

### Change Pattern:
For each file: `"zod": "catalog:"` → `"zod": "catalog:zod4"`

### Success Criteria:

#### Automated Verification:
- [ ] Install succeeds: `pnpm install`
- [ ] Full typecheck passes: `pnpm typecheck`
- [ ] Full build passes: `pnpm build:console && pnpm build:www && pnpm build:chat`
- [ ] Lint passes: `pnpm lint`

#### Manual Verification:
- [ ] Dev server starts: `pnpm dev:console`
- [ ] No runtime Zod errors in browser console

---

## Phase 4: Verify Mixed Version Coexistence

### Overview
Confirm that v3 and v4 packages can coexist in the same monorepo without conflicts.

### Verification Steps:

1. **Check resolved versions**:
```bash
pnpm why zod
# Should show both 3.25.76 and 4.0.0 in different packages
```

2. **Verify no version conflicts**:
```bash
pnpm ls zod --depth=0
# Each package should have exactly one zod version
```

3. **Test package boundaries**:
- v3 packages should not import from v4 packages that expose Zod types
- v4 packages should not import from v3 packages that expose Zod types

### Success Criteria:

#### Automated Verification:
- [ ] No peer dependency warnings: `pnpm install 2>&1 | grep -i "peer"`
- [ ] Full test suite passes: `pnpm test` (if available)
- [ ] Build all apps: `SKIP_ENV_VALIDATION=true pnpm build`

#### Manual Verification:
- [ ] Console app functional with forms (uses Zod v4)
- [ ] Chat app functional (uses Zod v3 for drizzle-zod schemas)
- [ ] MCP server starts without errors

---

## Testing Strategy

### Unit Tests:
- Run existing test suites after migration
- No new tests needed (configuration change only)

### Integration Tests:
- Build all packages
- Start dev servers
- Verify form validation works (react-hook-form + zod)
- Verify tRPC routes work (input/output validation)
- Verify drizzle-zod schemas still generate correctly

### Manual Testing Steps:
1. Start console app, submit a form with validation
2. Start chat app, send a message (triggers drizzle-zod schemas)
3. Run MCP server with a test query

## Performance Considerations

- **Bundle size**: Zod v4 is 2x smaller, should reduce bundle for v4 packages
- **Install time**: Two versions installed, minimal impact
- **Type checking**: May be slightly slower with mixed versions

## Migration Notes

### Future Migration Path
When drizzle-zod adds Zod v4 support:
1. Update `drizzle-zod` version in catalog
2. Move `@vendor/db`, `@db/chat`, `@api/chat` to `catalog:zod4`
3. Eventually remove `zod3` catalog when all packages migrated

### Rollback Plan
If issues arise:
1. Revert `pnpm-workspace.yaml` changes
2. Revert all `package.json` changes to use `catalog:`
3. Run `pnpm install`

## References

- Research document: `thoughts/shared/research/2025-12-24-zod-v4-migration-breaking-changes.md`
- drizzle-zod v4 support: https://github.com/drizzle-team/drizzle-orm/issues/4625
- MCP SDK compatibility: https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429
- Zod v4 changelog: https://zod.dev/v4/changelog

---

## Package Assignment Summary

### catalog:zod3 (8 packages)
| Package | Reason |
|---------|--------|
| `@vendor/db` | drizzle-zod dependency |
| `@db/chat` | drizzle-zod usage |
| `@api/chat` | consumes drizzle-zod schemas |
| `core/mcp` | MCP SDK incompatibility |
| `@repo/console-types` | consumed by MCP |
| `examples/nextjs-ai-chatbot` | already on specific v3 |
| `core/ai-sdk` | already on specific v3 |
| `packages/ai-tools` | already on specific v3 |

### catalog:zod4 (35 packages)
All remaining packages that currently use `catalog:` reference.

---

## Implementation Results (2025-12-24)

### What Was Implemented

1. **Catalog Infrastructure Created** ✅
   - Removed default `zod` entry from catalog
   - Added `zod3` catalog: `zod: ^3.25.76`
   - Added `zod4` catalog: `zod: ^4.0.0`
   - Updated override: `zod-to-json-schema>zod: ^3.25.76`

2. **All Packages on zod3** ✅
   - All 43 packages now use `catalog:zod3`
   - `examples/nextjs-ai-chatbot` updated from `file:` to `workspace:*` reference

### Why All Packages Use zod3 (Not Mixed)

During implementation, we discovered that Zod v4 has breaking API changes that require code migration:

| Breaking Change | Affected Package | v3 API | v4 API |
|-----------------|------------------|--------|--------|
| `.passthrough()` signature | `@repo/console-validation` | `z.object({}).passthrough()` | Requires message argument |
| `.ip()` removed | `@repo/console-validation` | `z.string().ip()` | Use `z.ipv4()` or `z.ipv6()` |
| `ZodError.errors` | `@repo/console-config` | `error.errors` | Property renamed |
| `z.record()` inference | `@api/console` | `Record<string, string>` | `Record<string, unknown>` |
| `ZodType` shape | `@api/console` | Full type | Missing properties |

Since `@repo/console-validation` is a foundational package imported by most of the codebase, and it uses v3-specific APIs, **all packages must remain on v3** to maintain type compatibility.

### Verified Working

- [x] `pnpm install` succeeds
- [x] `pnpm build:console` succeeds
- [x] `pnpm build:www` succeeds
- [x] `pnpm build:chat` succeeds
- [x] v3-locked packages typecheck: `@vendor/db`, `@db/chat`, `@api/chat`

### Pre-existing Issues (Unrelated to Zod)

- `@lightfastai/ai-sdk` typecheck: AI SDK type errors in test files (`toUIMessageStreamResponse`, `stepIndex`)
- Lint failures across 33 packages: Pre-existing eslint issues

### Path to Zod v4

To enable v4 adoption, the following code migration is required:

1. **Update `@repo/console-validation`**:
   - Replace `.passthrough()` calls with v4 syntax
   - Replace `.ip()` with `z.ipv4()` / `z.ipv6()`

2. **Update `@repo/console-config`**:
   - Update `ZodError` property access

3. **Update `@api/console`**:
   - Fix `z.record()` type annotations
   - Update `ZodType` usage

4. **Wait for upstream support**:
   - drizzle-zod v4 support: https://github.com/drizzle-team/drizzle-orm/issues/4625
   - MCP SDK v4 support: https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1429

Once code is migrated and upstream deps support v4, packages can be moved from `catalog:zod3` to `catalog:zod4` incrementally.
