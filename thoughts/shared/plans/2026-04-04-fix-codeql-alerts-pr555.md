# Fix CodeQL Code Scanning Alerts — PR #555

## Overview

Resolve all 5 high-priority CodeQL alerts on PR #555 (`refactor/drop-workspace-abstraction`). Three alerts are fixed by code changes (dead code removal, decode reorder, prototype hardening). Two false-positive CLI alerts are dismissed via the GitHub API.

## Current State Analysis

CodeQL default setup is enabled for `javascript-typescript` and `actions`. PR #555 has 21 open alerts: 5 in application code, 7 unpinned Action tags, 9 missing workflow permissions. This plan addresses the 5 application code alerts only.

### Key Discoveries:
- `generateStoreSlug` / `validateStoreSlug` in `db/app/src/utils/org-names.ts` are dead code — exported but never imported (`db/app/src/index.ts:65`)
- `decodeHtmlEntities` in `vendor/aeo/collect.ts:25-38` decodes `&amp;` first, enabling double-decode of later entities
- OAuth callback query object at `apps/platform/src/app/api/connect/[provider]/callback/route.ts:28` uses `{}` (technically vulnerable to prototype pollution, though unexploitable in practice)
- CLI alerts #35 (`sse.ts:36`) and #34 (`config.ts:49`) are standard auth patterns — false positives

Full research: `thoughts/shared/research/2026-04-04-codeql-alerts-pr555.md`

## Desired End State

All 5 application code CodeQL alerts are resolved:
- 3 alerts eliminated by code changes (no new alerts introduced)
- 2 alerts dismissed as "won't fix" via GitHub API
- CodeQL check on PR #555 passes (for application code alerts)

## What We're NOT Doing

- Fixing the 7 unpinned GitHub Action tag alerts (separate concern)
- Fixing the 9 missing workflow permissions alerts (separate concern)
- Adding a custom CodeQL workflow file (default setup is sufficient)
- Adding runtime validation to CLI API responses (out of scope)

## Implementation Approach

All 3 code changes are independent with zero cross-dependencies. They touch different packages (`db/app`, `vendor/aeo`, `apps/platform`) so there is no risk of conflicts. The GitHub API dismissals happen after code changes are pushed so CodeQL re-analyzes first.

## Phase 1: Code Fixes

### Overview
Three independent code changes that eliminate CodeQL alerts at the source.

### Changes Required:

#### 1. Remove dead code — Alert #94 (ReDoS)
**File**: `db/app/src/utils/org-names.ts`
**Action**: Delete the entire file

**File**: `db/app/src/index.ts`
**Changes**: Remove line 65 (the re-export)

Current line 65:
```ts
export { generateStoreSlug, validateStoreSlug } from "./utils/org-names";
```

Remove this line entirely. The only consumers of `@db/app` import `db`, `buildOrgNamespace`, schema tables, or types — none import `generateStoreSlug` or `validateStoreSlug`.

Verified consumers:
- `api/platform/src/inngest/functions/memory-entity-embed.ts:12` — imports `buildOrgNamespace` only
- `packages/app-test-data/src/cli/seed-integrations.ts:12` — imports `db` only

#### 2. Fix double-decode order — Alert #92
**File**: `vendor/aeo/collect.ts`
**Changes**: Move the `&amp;` → `&` replacement from first position to last position in `decodeHtmlEntities`

Current (lines 25-38):
```ts
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")      // ← runs first, creates double-decode path
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
}
```

After fix:
```ts
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x60;/g, "`")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&amp;/g, "&");     // ← runs last, no double-decode possible
}
```

By decoding `&amp;` last, the `&` it produces cannot match any earlier pattern (they've already run). This eliminates the double-decode path entirely.

#### 3. Harden query object — Alert #88 (Prototype Pollution)
**File**: `apps/platform/src/app/api/connect/[provider]/callback/route.ts`
**Changes**: Replace `{}` with `Object.create(null)` at line 28

Current (line 28):
```ts
const query: Record<string, string> = {};
```

After fix:
```ts
const query: Record<string, string> = Object.create(null);
```

`Object.create(null)` creates an object with no prototype chain, making `__proto__` assignment harmless. This is the standard hardening pattern for objects populated from external input. All existing static dot access (`query.code`, `query.state`, etc.) works identically on null-prototype objects.

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [x] No import errors from removed code: `pnpm build:app` and `pnpm build:platform`
- [x] Grep confirms no remaining references: `grep -r "generateStoreSlug\|validateStoreSlug" --include="*.ts" --exclude-dir=node_modules --exclude-dir=thoughts`

#### Manual Verification:
- [x] CodeQL re-analysis on PR #555 shows alerts #94, #92, #88 resolved
- [x] No new CodeQL alerts introduced by the changes

**Implementation Note**: After completing this phase, push the changes and wait for CodeQL to re-analyze before proceeding to Phase 2.

---

## Phase 2: Dismiss False-Positive CLI Alerts

### Overview
Dismiss alerts #35 and #34 via the GitHub API as "won't fix" — they are standard CLI authentication patterns (reading API key from config → sending as Bearer token; writing server response to config file).

### Changes Required:

#### 1. Dismiss Alert #35 — File data in outbound network request
**Command**:
```bash
gh api -X PATCH repos/lightfastai/lightfast/code-scanning/alerts/35 \
  -f state=dismissed \
  -f dismissed_reason="won't fix" \
  -f dismissed_comment="Standard CLI auth pattern: API key read from ~/.lightfast/config.json and sent as Bearer token to lightfast.ai. URL is Zod-validated with hardcoded default. See thoughts/shared/research/2026-04-04-codeql-alerts-pr555.md"
```

#### 2. Dismiss Alert #34 — Network data written to file
**Command**:
```bash
gh api -X PATCH repos/lightfastai/lightfast/code-scanning/alerts/34 \
  -f state=dismissed \
  -f dismissed_reason="won't fix" \
  -f dismissed_comment="Standard CLI login flow: server-issued credentials written to ~/.lightfast/config.json with 0o600 perms. Fixed file path, CSRF-protected auth, server-side JWT + org membership verification. See thoughts/shared/research/2026-04-04-codeql-alerts-pr555.md"
```

### Success Criteria:

#### Automated Verification:
- [x] `gh api repos/lightfastai/lightfast/code-scanning/alerts/35 --jq '.state'` returns `dismissed`
- [x] `gh api repos/lightfastai/lightfast/code-scanning/alerts/34 --jq '.state'` returns `dismissed`

#### Manual Verification:
- [x] PR #555 code scanning check no longer shows alerts #35 and #34

---

## Testing Strategy

### Automated:
- `pnpm typecheck` — confirms no broken imports from dead code removal
- `pnpm check` — linting passes
- `pnpm build:platform` — confirms OAuth callback route compiles with `Object.create(null)`

### Manual:
- CodeQL re-analysis on PR after push confirms 3 alerts resolved
- GitHub API dismissal confirmed for 2 remaining alerts

## Performance Considerations

None. All changes are zero-runtime-impact:
- Dead code removal reduces bundle size marginally
- `&amp;` decode reorder is same number of operations
- `Object.create(null)` is equivalent performance to `{}`

## References

- Research: `thoughts/shared/research/2026-04-04-codeql-alerts-pr555.md`
- PR: https://github.com/lightfastai/lightfast/pull/555
- CodeQL alerts: `gh api repos/lightfastai/lightfast/code-scanning/alerts?ref=refs/pull/555/head`
