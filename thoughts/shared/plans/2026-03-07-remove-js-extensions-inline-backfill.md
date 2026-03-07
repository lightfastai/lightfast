# Remove .js Extensions from console-providers & Inline backfill.ts

## Overview

Remove accidental `.js` import extensions from `packages/console-providers/` (meant only for Hono apps) and from `api/console/src/lib/backfill.ts`. Inline `notifyBackfill` into its sole consumer `workspace.ts`, delete the standalone file, and rewrite the stale test to mock `createBackfillClient` properly.

## Current State Analysis

### `.js` extensions in console-providers
- Every internal relative import across ~25 source files uses `.js` extensions (~100+ occurrences)
- The package uses `tsc` to build and has `"type": "module"`, but the base tsconfig uses `"moduleResolution": "Bundler"` which does not require `.js` extensions
- `@noble/hashes` sub-path imports (e.g., `@noble/hashes/hmac.js`) **must keep** `.js` — the package's export map only defines `.js` keyed entries

### `backfill.ts` in api/console
- `api/console/src/lib/backfill.ts` exports a single function `notifyBackfill`
- Only imported by `api/console/src/router/org/workspace.ts:31` (used at lines 234 and 1177)
- Has a stale test file `backfill.test.ts` that mocks `fetch` directly, but the implementation uses `createBackfillClient` from `@repo/gateway-service-clients`
- Also contains `../env.js` import with `.js` extension

### Key Discoveries:
- `packages/console-providers/tsconfig.json` extends `@repo/typescript-config/base.json` which sets `"moduleResolution": "Bundler"` at `internal/typescript/base.json:19`
- `@noble/hashes@2.0.1` exports map only defines sub-paths with `.js` (e.g., `"./hmac.js": "./hmac.js"`) — these are mandatory
- `notifyBackfill` resolves `depth`/`entityTypes` from DB when omitted, then calls `createBackfillClient({ apiKey: env.GATEWAY_API_KEY }).trigger(payload)`
- Existing mock pattern for `createBackfillClient` found in `apps/backfill/src/workflows/backfill-orchestrator.test.ts:37-40`

## Desired End State

1. Zero `.js` extensions in internal relative imports across `packages/console-providers/src/` (external `@noble/hashes` sub-paths unchanged)
2. No `api/console/src/lib/backfill.ts` file — function inlined into `workspace.ts`
3. No `api/console/src/lib/backfill.test.ts` — tests rewritten in `workspace.test.ts` (or new `backfill.test.ts` that imports from workspace) to mock `createBackfillClient` instead of raw `fetch`
4. No `.js` extensions in `api/console/src/` imports

### Verification:
- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm --filter @repo/console-providers test` passes
- `pnpm --filter @api/console test` passes (rewritten tests green)

## What We're NOT Doing

- Removing `.js` from `@noble/hashes` sub-path imports (those are mandatory)
- Changing build config (tsc, tsconfig, package.json exports)
- Refactoring `notifyBackfill` logic — just moving it
- Touching other single-caller lib files (`actor-linking.ts`, `actor-identity.ts`, `token-vault.ts`)
- Removing `.js` from Hono apps (`apps/backfill/`, `apps/relay/`, `apps/gateway/`) — those legitimately need them

## Implementation Approach

Single phase. Two independent workstreams executed together:
1. Bulk find-and-replace `.js` extensions in `console-providers/src/`
2. Inline `notifyBackfill`, delete files, rewrite tests

## Changes Required

### 1. Strip `.js` extensions from console-providers internal imports

**Files** (all in `packages/console-providers/src/`):

Every `.ts` file listed below needs all internal relative imports changed from `from "./foo.js"` / `from "../../foo.js"` to `from "./foo"` / `from "../../foo"`.

**DO NOT touch** the 4 imports in `src/crypto.ts` for `@noble/hashes/*.js` — those are external sub-path exports.

Files to modify:
- `src/index.ts` — ~30 imports
- `src/define.ts` — 2 imports
- `src/registry.ts` — 8 imports
- `src/dispatch.ts` — 5 imports
- `src/gateway.ts` — 1 import
- `src/display.ts` — 2 imports
- `src/validation.ts` — 2 imports
- `src/event-normalization.ts` — 1 import
- `src/crypto.test.ts` — 1 import
- `src/registry.typetest.ts` — 6 imports
- `src/__tests__/display-sync.test.ts` — 2 imports
- `src/providers/github/auth.ts` — 1 import
- `src/providers/github/index.ts` — 5 imports
- `src/providers/github/transformers.ts` — 5 imports
- `src/providers/vercel/auth.ts` — 1 import
- `src/providers/vercel/index.ts` — 5 imports
- `src/providers/vercel/transformers.ts` — 5 imports
- `src/providers/linear/auth.ts` — 1 import
- `src/providers/linear/index.ts` — 5 imports
- `src/providers/linear/transformers.ts` — 5 imports
- `src/providers/sentry/auth.ts` — 1 import
- `src/providers/sentry/index.ts` — 5 imports
- `src/providers/sentry/transformers.ts` — 5 imports

**Pattern**: For each file, replace all occurrences of `.js"` at the end of relative import paths with `"`. Specifically:
```
from "./foo.js"     →  from "./foo"
from "../../bar.js" →  from "../../bar"
```

**Exception**: In `src/crypto.ts`, do NOT modify:
```ts
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
```

### 2. Inline `notifyBackfill` into workspace.ts

**File**: `api/console/src/router/org/workspace.ts`

**Changes**:
1. Remove import: `import { notifyBackfill } from "../../lib/backfill";`
2. Add imports at top of file:
```ts
import type { BackfillTriggerPayload } from "@repo/console-validation";
import { createBackfillClient } from "@repo/gateway-service-clients";
```
3. Add the `notifyBackfill` function at the bottom of the file (or just above the router definition), preserving the same signature and logic but importing `env` from the file's existing env import (verify `workspace.ts` already imports `env`).

Note: `SourceType` is already available in workspace.ts via `@repo/console-providers`. `db` and `gwInstallations`/`eq` need to be checked — if not already imported, add them.

### 3. Delete backfill.ts

**Delete**: `api/console/src/lib/backfill.ts`

### 4. Rewrite backfill tests

**Delete**: `api/console/src/lib/backfill.test.ts`

**Create**: `api/console/src/router/org/__tests__/notify-backfill.test.ts` (or co-locate in existing workspace test file if one exists)

The new tests should mock `@repo/gateway-service-clients` following the established pattern:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockTrigger = vi.fn();

vi.mock("@repo/gateway-service-clients", () => ({
  createBackfillClient: () => ({ trigger: mockTrigger }),
}));

vi.mock("@db/console/client", () => ({
  db: { query: { gwInstallations: { findFirst: vi.fn() } } },
}));

vi.mock("@db/console/schema", () => ({
  gwInstallations: { id: "id", backfillConfig: "backfillConfig" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
}));

vi.mock("../../../env", () => ({
  env: { GATEWAY_API_KEY: "test-gw-key" },
}));

// Import after mocks
import { notifyBackfill } from "../workspace";

describe("notifyBackfill", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createBackfillClient.trigger with correct payload", async () => {
    mockTrigger.mockResolvedValue({ status: "ok", installationId: "inst-1" });

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: ["pull_request"],
    });

    expect(mockTrigger).toHaveBeenCalledWith({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      depth: 30,
      entityTypes: ["pull_request"],
    });
  });

  it("does not throw when trigger rejects", async () => {
    mockTrigger.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      notifyBackfill({
        installationId: "inst-1",
        provider: "github",
        orgId: "org-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("forwards holdForReplay when provided", async () => {
    mockTrigger.mockResolvedValue({ status: "ok", installationId: "inst-1" });

    await notifyBackfill({
      installationId: "inst-1",
      provider: "github",
      orgId: "org-1",
      holdForReplay: true,
    });

    expect(mockTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ holdForReplay: true }),
    );
  });
});
```

Note: The exact mock structure and import paths should be verified during implementation. The test file may need to export `notifyBackfill` from workspace.ts — if workspace.ts only exports the router, the function should be exported as a named export as well.

### 5. Remove `.js` from backfill.ts env import (handled by deletion)

Since we're deleting `backfill.ts`, the `../env.js` import disappears automatically.

## Success Criteria

### Automated Verification:
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [x] console-providers tests pass: `pnpm --filter @repo/console-providers test` — 177 tests ✓
- [x] api/console tests pass: `pnpm --filter @api/console test` — 5 tests ✓
- [x] No `.js` in internal relative imports in console-providers: `grep -r 'from "\./.*\.js"' packages/console-providers/src/ | grep -v '@noble/hashes' | wc -l` returns 0 ✓
- [x] No `.js` in internal relative imports in console-providers (parent paths): `grep -r 'from "\.\./.*\.js"' packages/console-providers/src/ | wc -l` returns 0 ✓
- [x] `backfill.ts` and `backfill.test.ts` no longer exist in `api/console/src/lib/` ✓

### Manual Verification:
- [ ] Verify `pnpm dev:console` starts without errors
- [ ] Trigger a backfill via the UI to confirm the inlined function works end-to-end

**Implementation Note**: After completing all changes and automated verification passes, pause for manual confirmation that the dev server starts and backfill triggering works before considering this complete.

## Testing Strategy

### Unit Tests:
- Rewritten `notify-backfill.test.ts` covers:
  - Correct payload forwarding to `createBackfillClient().trigger()`
  - Error swallowing (best-effort behavior)
  - Optional field forwarding (`holdForReplay`, `depth`, `entityTypes`)
  - DB fallback for missing `depth`/`entityTypes` (if testable without full DB mock)

### Integration Tests:
- Existing workspace router tests should continue to pass unchanged

## Migration Notes

- No database changes
- No API changes — `notifyBackfill` is an internal function, not exposed via API
- The function signature stays identical, just moves files

## References

- `packages/console-providers/tsconfig.json` extends `internal/typescript/base.json` (moduleResolution: Bundler)
- `@noble/hashes@2.0.1` package.json exports map: only `.js` keyed sub-paths
- Mock pattern: `apps/backfill/src/workflows/backfill-orchestrator.test.ts:37-40`
- `createBackfillClient` source: `packages/gateway-service-clients/src/backfill.ts:15`
