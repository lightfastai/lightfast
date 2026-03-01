# Fix All Lint Errors Implementation Plan

## Overview

Fix all 31 lint errors across 4 packages (`@lightfast/backfill`, `@lightfast/connections`, `@lightfast/gateway`, `@lightfast/console`). All fixes are mechanical — no logic changes.

## Current State Analysis

`pnpm lint` returns 31 errors across 10 files in 4 packages. The errors fall into 6 categories:

| Rule | Count | Files | Auto-fixable? |
|---|---|---|---|
| `curly` (missing braces) | 10 | 6 files | Yes (`--fix`) |
| `restrict-template-expressions` | 12 | 3 files | No (manual) |
| `import-x/order` | 2 | 2 files | Yes (`--fix`) |
| `prefer-nullish-coalescing` | 2 | 1 file | No (manual) |
| `no-non-null-assertion` | 1 | 1 file | No (manual) |
| `require-await` | 1 | 1 file | No (manual) |
| `prefer-regexp-exec` | 1 | 1 file | No (manual) |

Additionally, 34 `export *` **warnings** exist in `@lightfastai/ai-sdk`, `@repo/ai`, and `@db/chat`. These are tree-shaking recommendations, not errors.

## What We're NOT Doing

- Fixing the 34 `export *` warnings (barrel file refactoring is a separate, larger effort)
- Changing any business logic
- Refactoring beyond what's needed to satisfy the lint rules

## Implementation Approach

Single phase — fix all 31 errors with minimal changes.

## Phase 1: Fix All Lint Errors

### Overview
Fix all errors grouped by rule type and file.

### Changes Required:

#### 1. Auto-fix `curly` and `import-x/order` (12 errors → 0)

Run eslint `--fix` on the affected files to auto-fix the `curly` (missing braces) and `import-x/order` errors:

**Files:**
- `apps/backfill/src/env.ts` (1 curly)
- `apps/backfill/src/middleware/lifecycle.ts` (3 curly)
- `apps/backfill/src/middleware/sentry.ts` (1 import-x/order, 2 curly)
- `apps/connections/src/env.ts` (1 curly)
- `apps/connections/src/middleware/lifecycle.ts` (3 curly)
- `apps/connections/src/middleware/sentry.ts` (1 import-x/order, 2 curly)

**Command:**
```bash
cd apps/backfill && npx eslint --fix src/env.ts src/middleware/lifecycle.ts src/middleware/sentry.ts
cd apps/connections && npx eslint --fix src/env.ts src/middleware/lifecycle.ts src/middleware/sentry.ts
```

#### 2. Fix `restrict-template-expressions` in lifecycle middleware (12 errors → 0)

**Root cause:** Template literals reference properties from `Record<string, unknown>`, so ESLint flags them as unsafe.

**Fix:** Use the already-typed local variables instead of reading back from the `entry` object.

**File**: `apps/backfill/src/middleware/lifecycle.ts` (lines 81-82)
```typescript
// Before (entry properties are typed `unknown`):
let line = `${prefix} ${entry.method} ${entry.path} ${entry.status} ${duration}ms from ${source} [${entry.requestId}]`;
if (error) line += ` error="${error}"`;

// After (use typed locals directly):
let line = `${prefix} ${c.req.method} ${c.req.path} ${entry.status as number} ${duration}ms from ${source} [${String(c.get("requestId"))}]`;
if (error) { line += ` error="${error}"`; }
```

**File**: `apps/connections/src/middleware/lifecycle.ts` (lines 81-82)
Same fix as above.

**File**: `apps/gateway/src/middleware/lifecycle.ts` (lines 84-85)
Same fix as above.

#### 3. Fix `prefer-regexp-exec` in gateway lifecycle (1 error → 0)

**File**: `apps/gateway/src/middleware/lifecycle.ts` (line 66)
```typescript
// Before:
c.req.path.match(/^\/api\/webhooks\/(\w+)/)?.[1] ?? undefined;

// After:
/^\/api\/webhooks\/(\w+)/.exec(c.req.path)?.[1] ?? undefined;
```

#### 4. Fix `require-await` in OrgApiKeysPage (1 error → 0)

**File**: `apps/console/src/app/(app)/(org)/[slug]/(manage)/settings/api-keys/page.tsx` (line 18)

`prefetch()` is synchronous (registers prefetch, doesn't return a promise). Remove `async`.

```typescript
// Before:
export default async function OrgApiKeysPage() {

// After:
export default function OrgApiKeysPage() {
```

#### 5. Fix `no-non-null-assertion` in installed-sources (1 error → 0)

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx` (line 158)

```typescript
// Before:
.map((p) => ({ provider: p as string, resources: grouped.get(p)! })),

// After (safe because the preceding .filter guarantees the key exists):
.map((p) => ({ provider: p as string, resources: grouped.get(p) ?? [] })),
```

#### 6. Fix `prefer-nullish-coalescing` in installed-sources (2 errors → 0)

**File**: `apps/console/src/app/(app)/(org)/[slug]/[workspaceName]/(manage)/sources/_components/installed-sources.tsx`

```typescript
// Line 274 — documentCount: `0` should NOT fall through, so `??` is more correct:
// Before:
const documentCount = integration.documentCount || metadata?.documentCount;
// After:
const documentCount = integration.documentCount ?? metadata?.documentCount;

// Line 284 — repoFullName: use `??` for consistency:
// Before:
resourceName = metadata?.repoFullName || "Unknown repo";
// After:
resourceName = metadata?.repoFullName ?? "Unknown repo";
```

### Success Criteria:

#### Automated Verification:
- [ ] Linting passes with zero errors: `pnpm lint`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Build succeeds: `pnpm build:console`

#### Manual Verification:
- [ ] None required — all changes are mechanical lint fixes with no logic impact
