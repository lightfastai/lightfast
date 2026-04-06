# Provider console.error Cleanup + Inngest Silent Catch Blocks

## Overview

Bundle two quick observability fixes from the remaining-work inventory: (1) align the Sentry provider's token-exchange error handling with the established `readErrorBody` pattern, and (2) add `log.warn` to four Inngest catch blocks that currently swallow errors silently.

## Current State Analysis

### Item 2 — Sentry `console.error`

`packages/app-providers/src/providers/sentry/index.ts:62-68` uses raw `response.text()` + `console.error` instead of `readErrorBody`. This is the only provider function that deviates — the same file already imports `readErrorBody` (line 6) and uses it correctly at lines 329 and 368.

### Item 3 — Inngest silent catches

Four catch blocks discard errors without logging:

| File | Line | What's lost |
|------|------|-------------|
| `delivery-recovery.ts` | 83 | `getProvider()` / `extractResourceId()` failure reason |
| `delivery-recovery.ts` | 138 | Per-delivery outer-loop failure reason |
| `health-check.ts` | 91 | `getActiveTokenForInstallation()` failure reason |
| `health-check.ts` | 107 | `providerDef.healthCheck.check()` failure reason |

The `health-check.ts` catches delegate to `recordTransientFailure()` which logs `log.warn` but doesn't include the error that caused the failure.

### Established patterns

**Error body reading** (12 existing call sites):
```ts
const body = await readErrorBody(response);
throw new Error(`Provider token exchange failed: ${response.status} ${body}`);
```

**Inngest catch logging** (e.g. `connection-lifecycle.ts:86-94`, `token-refresh.ts:117-125`):
```ts
} catch (err) {
  log.warn("[function-tag] description", {
    contextField: value,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

## Desired End State

- The Sentry provider token-exchange uses `readErrorBody` and includes the truncated body in the thrown error message — consistent with all other provider error sites.
- All four Inngest silent catches bind the error and log it via `log.warn`, preserving the error reason for debugging.
- No `console.error` remains in provider token-exchange code.

### Verification

- `pnpm check` passes (lint)
- `pnpm typecheck` passes
- `pnpm build:platform` succeeds

## What We're NOT Doing

- Touching `packages/app-providers/src/runtime/validation.ts` — `logValidationErrors()` is an exported utility with intentional `console.error` for Zod failures; not part of this fix.
- Changing `recordTransientFailure`'s signature to accept an error — we log the error at the catch site instead, keeping the helper focused on DB + threshold logic.
- Adding `parseError` to these sites — the Inngest catch blocks follow the manual `err instanceof Error ? err.message : String(err)` pattern used in all other Inngest functions. Consistency within the Inngest layer matters more than using the utility here (which also has a `server-only` guard).

## Phase 1: Sentry Provider `readErrorBody` Alignment [DONE]

### Overview

Replace raw `response.text()` + `console.error` with `readErrorBody` + include body in thrown error.

### Changes Required

**File**: `packages/app-providers/src/providers/sentry/index.ts`

Replace lines 62-68:

```ts
// BEFORE
if (!response.ok) {
  const errorBody = await response.text();
  console.error("[sentry] token exchange failed:", {
    status: response.status,
    body: errorBody,
  });
  throw new Error(`Sentry token exchange failed: ${response.status}`);
}
```

```ts
// AFTER
if (!response.ok) {
  const body = await readErrorBody(response);
  throw new Error(`Sentry token exchange failed: ${response.status} ${body}`);
}
```

`readErrorBody` is already imported on line 6. The error body (truncated to 200 chars) is now in the thrown message, which Sentry captures via the `sentryMiddleware` on the Inngest client — no separate `console.error` needed.

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes

---

## Phase 2: Inngest Silent Catch Blocks [DONE]

### Overview

Add error binding + `log.warn` to four catch blocks across two files.

### Changes Required

#### 1. `delivery-recovery.ts` — inner extraction catch (line 83)

**File**: `api/platform/src/inngest/functions/delivery-recovery.ts`

```ts
// BEFORE (line 83-85)
} catch {
  // If extraction fails, proceed with null — ingest delivery handles it
}
```

```ts
// AFTER
} catch (err) {
  log.warn("[delivery-recovery] resource extraction failed — proceeding with null", {
    deliveryId: delivery.deliveryId,
    provider: providerName,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

#### 2. `delivery-recovery.ts` — outer per-delivery catch (line 138)

```ts
// BEFORE (line 138-139)
} catch {
  failed.push(delivery.deliveryId);
}
```

```ts
// AFTER
} catch (err) {
  log.warn("[delivery-recovery] replay failed for delivery", {
    deliveryId: delivery.deliveryId,
    provider: delivery.provider,
    error: err instanceof Error ? err.message : String(err),
  });
  failed.push(delivery.deliveryId);
}
```

#### 3. `health-check.ts` — token fetch catch (line 91)

```ts
// BEFORE (line 91-95)
} catch {
  // If we can't get the token, we can't probe — treat as transient
  await recordTransientFailure(installation);
  return;
}
```

```ts
// AFTER
} catch (err) {
  log.warn("[health-check] token fetch failed — recording transient failure", {
    installationId: installation.id,
    provider: providerName,
    error: err instanceof Error ? err.message : String(err),
  });
  await recordTransientFailure(installation);
  return;
}
```

#### 4. `health-check.ts` — health probe catch (line 107)

```ts
// BEFORE (line 107-110)
} catch {
  // Network error / timeout — treat as transient failure
  await recordTransientFailure(installation);
  return;
}
```

```ts
// AFTER
} catch (err) {
  log.warn("[health-check] probe failed — recording transient failure", {
    installationId: installation.id,
    provider: providerName,
    error: err instanceof Error ? err.message : String(err),
  });
  await recordTransientFailure(installation);
  return;
}
```

### Success Criteria

#### Automated Verification

- [x] `pnpm check` passes
- [x] `pnpm typecheck` passes
- [x] `pnpm build:platform` succeeds

## References

- Research: `thoughts/shared/research/2026-04-05-observability-remaining-work-inventory.md` — Items 2 and 3
- Established pattern: `packages/app-providers/src/providers/github/index.ts` (readErrorBody usage)
- Established pattern: `api/platform/src/inngest/functions/connection-lifecycle.ts:86-94` (catch logging)
