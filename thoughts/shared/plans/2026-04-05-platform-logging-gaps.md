# Platform Logging Gaps — Implementation Plan

## Overview

Add structured logging to the platform service's critical paths that currently have zero observability. The entire data plane (proxy, token vault, backfill estimation) and all three tRPC router files have no logger. When something breaks — like the recent `token_error: GitHub installation token request failed: 401` — there's almost no structured telemetry to diagnose it.

This plan is strictly additive: no behavior changes, no refactoring, no new error handling logic. Every catch block that currently swallows errors continues to swallow them; we just log before swallowing. The one exception is `github/index.ts` where we read the response body to include it in the error message.

All `proxy.execute` logs carry a request-scoped `requestId` (via `nanoid` from `@repo/lib`). This turns interleaved concurrent logs into traceable per-request stories — filter by `requestId` in BetterStack to see the complete lifecycle of a single proxy call.

## Current State Analysis

- 17 files already import `log` from `@vendor/observability/log/next`
- Zero `console.*` calls — the codebase is clean
- The logger is a singleton: `import { log } from "@vendor/observability/log/next"`
- Convention: `log.level("[module/context] description", { ...fields })`
- In production, uses Logtail (BetterStack); in development, falls back to `console`

### Key Discoveries:

- `proxy.ts` has 3 bare `catch {}` blocks with no error binding (lines 159, 210, 232)
- `token-helpers.ts:111-113` and `125-127` — silent catches cause the 401 retry to silently not execute
- `github/index.ts:61-64` — GitHub's error response body (which includes the actual reason) is thrown away
- `trpc.ts:86-91` — `errorFormatter` replaces `INTERNAL_SERVER_ERROR` messages with `"An unexpected error occurred"` in production, so the route-level `onError` log entry is sanitized. The fix is to log **before** throwing the `TRPCError`.

## Desired End State

Every critical path in the platform service produces structured log entries for:
- Token acquisition attempts and failures (with provider, installationId, and error reason)
- Outbound API proxy calls (with provider, endpoint, status, duration, requestId)
- 401 retry attempts (whether attempted, whether token differed, retry outcome, requestId)
- Token refresh failures (which step failed and why)
- GitHub API errors (with GitHub's actual error message from the response body)
- Backfill estimate probe failures (which resource, which entity type, why)

### Verification:

After implementation, run `pnpm build:platform` to confirm no type errors. Then grep for `@vendor/observability/log/next` across `api/platform/src/` — every file listed as `NO LOGGER` in the research document should now have an import.

## What We're NOT Doing

- No behavior changes — catch blocks that swallow errors still swallow them
- No new try/catch wrappers around code that currently doesn't have them
- No changes to the tRPC `errorFormatter` or `onError` handler
- No logging in pure/library files (`jwt.ts`, `encryption.ts`, `scoring.ts`, `transform.ts`, etc.)
- No performance-path logging (e.g., inside hot loops or per-item processing)
- No Tier 2/3 changes to `oauth/state.ts` — Redis operations are low-risk and the logging would be noisy for a low-signal path

## Implementation Approach

Work in severity tiers. Each phase is independently mergeable. All changes follow the existing pattern: `import { log } from "@vendor/observability/log/next"` and `log.level("[module] message", { fields })`.

---

## Phase 1: Critical Data Plane (Tier 1)

### Overview

Fix the three files responsible for the production blind spot: the proxy router, token helpers, and GitHub provider's installation token function.

### Changes Required:

#### 1. `api/platform/src/router/memory/proxy.ts` — Add structured logging to the data plane

**File**: `api/platform/src/router/memory/proxy.ts`

**Add imports** (after line 16):

```typescript
import { nanoid } from "@repo/lib";
import { log } from "@vendor/observability/log/next";
```

**Add request-scoped correlation ID** (at the top of the `execute` mutation body, line 99, before the DB lookup):

```typescript
      const requestId = nanoid();
```

Every `log.*` call inside `execute` includes `requestId` as a field. This turns interleaved concurrent logs into traceable per-request stories — filter by `requestId` in BetterStack to see the complete lifecycle of a single proxy call.

**Log before throwing token error** (replace lines 159-165):

```typescript
      } catch (err) {
        const message = err instanceof Error ? err.message : "token_error";
        log.error("[proxy] token acquisition failed", {
          requestId,
          installationId: input.installationId,
          provider: providerName,
          endpointId: input.endpointId,
          tokenPath: endpoint.buildAuth ? "buildAuth" : "installation",
          error: message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `token_error: ${message}`,
        });
      }
```

**Log outbound fetch** (replace lines 202-203):

```typescript
      // Execute with 401 retry
      const fetchStart = Date.now();
      let response = await fetch(url, fetchOptions);
      log.info("[proxy] outbound fetch", {
        requestId,
        provider: providerName,
        endpointId: input.endpointId,
        method: endpoint.method,
        status: response.status,
        durationMs: Date.now() - fetchStart,
      });
```

**Log 401 retry block** (replace lines 205-229):

```typescript
      if (response.status === 401) {
        let freshToken: string | null = null;
        if (endpoint.buildAuth) {
          try {
            freshToken = await endpoint.buildAuth(config);
          } catch (err) {
            log.warn("[proxy] buildAuth retry failed", {
              requestId,
              provider: providerName,
              endpointId: input.endpointId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        } else {
          // SAFETY: getProvider() returns the full generic ProviderDefinition<TConfig, ...>
          // but the helper takes the base ProviderDefinition. The generic parameters are
          // erased at runtime -- the cast is safe because the concrete type is a supertype.
          freshToken = await forceRefreshToken(
            installation,
            config,
            providerDef as ProviderDefinition
          );
        }
        if (freshToken && freshToken !== token) {
          headers.Authorization = api.buildAuthHeader
            ? api.buildAuthHeader(freshToken)
            : `Bearer ${freshToken}`;
          const retryStart = Date.now();
          response = await fetch(url, { ...fetchOptions, headers });
          log.info("[proxy] 401 retry", {
            requestId,
            provider: providerName,
            endpointId: input.endpointId,
            retryStatus: response.status,
            durationMs: Date.now() - retryStart,
          });
        } else {
          log.warn("[proxy] 401 retry skipped", {
            requestId,
            provider: providerName,
            endpointId: input.endpointId,
            reason: !freshToken ? "no_fresh_token" : "token_unchanged",
          });
        }
      }
```

#### 2. `api/platform/src/lib/token-helpers.ts` — Log silent catch blocks

**File**: `api/platform/src/lib/token-helpers.ts`

**Add import** (after line 5):

```typescript
import { log } from "@vendor/observability/log/next";
```

**Log refresh token failure** (replace lines 111-113):

```typescript
    } catch (err) {
      log.warn("[token-helpers] refresh token exchange failed — falling through to getActiveToken", {
        installationId: installation.id,
        provider: installation.provider,
        error: err instanceof Error ? err.message : String(err),
      });
    }
```

**Log getActiveToken fallback failure** (replace lines 125-127):

```typescript
  } catch (err) {
    log.warn("[token-helpers] getActiveToken fallback failed — returning null", {
      installationId: installation.id,
      provider: installation.provider,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
```

#### 3. `packages/app-providers/src/providers/github/index.ts` — Capture GitHub's error response body

**File**: `packages/app-providers/src/providers/github/index.ts`

**Replace lines 61-65** (the `!response.ok` check):

```typescript
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `GitHub installation token request failed: ${response.status} — ${errorBody || "(empty body)"}`
    );
  }
```

Note: This is the one behavioral change. The error message now includes GitHub's response body (e.g., `"Bad credentials"`, `"This installation has been suspended"`). This propagates through `getActiveTokenForInstallation` → `proxy.ts` catch → the structured log we just added. The `text()` call is wrapped in `.catch(() => "")` so it can't fail.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm build:platform` passes with no type errors
- [ ] `pnpm check` passes (lint)
- [ ] `pnpm typecheck` passes

#### Manual Verification:

- [ ] Trigger a proxy.execute call via the app and verify structured log entries appear in the dev console for token acquisition and outbound fetch
- [ ] Simulate a 401 by using an expired token and verify the retry log entries appear
- [ ] Verify the GitHub error body appears in the error message when using an invalid installation ID

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Operational Visibility (Tier 2)

### Overview

Add logging to the three tRPC router files and the token store. These are paths where failures are recoverable but currently undiagnosable.

### Changes Required:

#### 4. `api/platform/src/router/memory/connections.ts` — Log error paths

**File**: `api/platform/src/router/memory/connections.ts`

**Add import** (after line 24):

```typescript
import { log } from "@vendor/observability/log/next";
```

**Log getToken errors** (replace lines 122-143 — the catch block):

```typescript
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        if (message === "no_token_found") {
          log.warn("[connections] getToken — no token found", {
            installationId: input.id,
            provider: providerName,
          });
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "no_token_found",
          });
        }
        if (
          message === "token_expired" ||
          message === "token_expired:no_refresh_token"
        ) {
          log.warn("[connections] getToken — token expired", {
            installationId: input.id,
            provider: providerName,
            reason: message,
          });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message,
          });
        }
        log.error("[connections] getToken — unexpected failure", {
          installationId: input.id,
          provider: providerName,
          error: message,
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `token_generation_failed: ${message}`,
        });
      }
```

**Log disconnect** (add after line 187 — after the DB insert, before the Inngest send):

```typescript
      log.info("[connections] disconnect initiated", {
        installationId: input.id,
        provider: input.provider,
        fromStatus: installation.status,
      });
```

#### 5. `api/platform/src/router/memory/backfill.ts` — Log silent catches and Inngest dispatch failures

**File**: `api/platform/src/router/memory/backfill.ts`

**Add import** (after line 28):

```typescript
import { log } from "@vendor/observability/log/next";
```

**Log trigger Inngest dispatch failure** (replace lines 96-101):

```typescript
      } catch (err) {
        log.error("[backfill] trigger — failed to enqueue", {
          installationId: input.installationId,
          provider: input.provider,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to enqueue backfill: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
```

**Log cancel Inngest dispatch failure** (replace lines 141-146):

```typescript
      } catch (err) {
        log.error("[backfill] cancel — failed to enqueue", {
          installationId: input.installationId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to enqueue cancellation: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
```

**Log resolveResourceMeta failure** (replace lines 254-264):

```typescript
            } catch (err) {
              log.warn("[backfill] resolveResourceMeta failed", {
                provider,
                providerResourceId: r.providerResourceId,
                error: err instanceof Error ? err.message : String(err),
              });
              if (resourceNameRequiredForRouting) {
                // GitHub/Sentry: can't estimate without valid path segments — skip
                return null;
              }
              // Linear/Vercel: resourceName not used in buildRequest — fallback is safe
              return {
                providerResourceId: r.providerResourceId,
                resourceName: r.providerResourceId,
              };
            }
```

**Log probe failure** (replace lines 367-376):

```typescript
            } catch (err) {
              log.warn("[backfill] estimate probe failed", {
                provider,
                entityType,
                providerResourceId: resource.providerResourceId,
                error: err instanceof Error ? err.message : String(err),
              });
              return {
                entityType,
                sample: {
                  resourceId: resource.providerResourceId,
                  returnedCount: -1,
                  hasMore: false,
                },
              };
            }
```

#### 6. `api/platform/src/lib/token-store.ts` — Log token write/update operations

**File**: `api/platform/src/lib/token-store.ts`

**Add import** (after line 5):

```typescript
import { log } from "@vendor/observability/log/next";
```

**Log writeTokenRecord** (add after line 48 — after the DB upsert, before function end):

```typescript
  log.info("[token-store] token record written", {
    installationId,
    hasRefreshToken: !!oauthTokens.refreshToken,
    expiresIn: oauthTokens.expiresIn ?? null,
  });
```

**Log updateTokenRecord** (add after line 115 — after the DB update, before function end):

```typescript
  log.info("[token-store] token record updated", {
    tokenId,
    hasNewRefreshToken: !!oauthTokens.refreshToken,
    reusedExistingRefresh: !oauthTokens.refreshToken && !!existingEncryptedRefreshToken,
  });
```

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm build:platform` passes with no type errors
- [ ] `pnpm check` passes (lint)
- [ ] `pnpm typecheck` passes

#### Manual Verification:

- [ ] Trigger a `getToken` call for an active connection — no log expected on success path (only errors log)
- [ ] Trigger a `disconnect` and verify the `[connections] disconnect initiated` log appears
- [ ] Verify backfill estimate logs show resource resolution and probe results in dev console

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Inngest Catch Block Fixes (Tier 3)

### Overview

Fix 4 catch blocks in files that already have the logger imported but discard error objects.

### Changes Required:

#### 7. `api/platform/src/inngest/functions/health-check.ts` — Bind and log error objects

**File**: `api/platform/src/inngest/functions/health-check.ts`

**Log getActiveTokenForInstallation failure** (replace lines 91-94):

```typescript
        } catch (err) {
          log.warn("[health-check] token acquisition failed — treating as transient", {
            installationId: installation.id,
            provider: providerName,
            error: err instanceof Error ? err.message : String(err),
          });
          await recordTransientFailure(installation);
          return;
        }
```

**Log healthCheck.check failure** (replace lines 107-110):

```typescript
        } catch (err) {
          log.warn("[health-check] probe failed — treating as transient", {
            installationId: installation.id,
            provider: providerName,
            error: err instanceof Error ? err.message : String(err),
          });
          await recordTransientFailure(installation);
          return;
        }
```

#### 8. `api/platform/src/inngest/functions/delivery-recovery.ts` — Bind and log error objects

**File**: `api/platform/src/inngest/functions/delivery-recovery.ts`

**Log extractResourceId failure** (replace lines 83-85):

```typescript
          } catch (err) {
            log.warn("[delivery-recovery] extractResourceId failed — proceeding with null", {
              deliveryId: delivery.deliveryId,
              provider: delivery.provider,
              error: err instanceof Error ? err.message : String(err),
            });
          }
```

**Log outer per-delivery catch** (replace lines 138-140):

```typescript
        } catch (err) {
          log.error("[delivery-recovery] delivery replay failed", {
            deliveryId: delivery.deliveryId,
            provider: delivery.provider,
            error: err instanceof Error ? err.message : String(err),
          });
          failed.push(delivery.deliveryId);
        }
```

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm build:platform` passes with no type errors
- [ ] `pnpm check` passes (lint)
- [ ] `pnpm typecheck` passes

#### Manual Verification:

- [ ] Health check cron runs and logs appear for each probed installation
- [ ] Delivery recovery cron runs without errors

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding.

---

## Testing Strategy

### Unit Tests:

No new unit tests required. These are purely additive log calls that don't change behavior. The existing test suite validates behavior is unchanged.

### Integration Tests:

- Run `pnpm build:platform` — confirms all imports resolve and types are correct
- Run `pnpm typecheck` — confirms no type regressions across the monorepo

### Manual Testing Steps:

1. Start `pnpm dev:platform` and trigger a proxy.execute call via the app
2. Verify structured log entries in the terminal for `[proxy]` namespace
3. Disconnect a connection and verify `[connections] disconnect initiated` appears
4. Check that `[token-store]` log entries appear during OAuth callback flows

## Performance Considerations

- All log calls are cheap (`console.log` in dev, Logtail HTTP batched in production)
- The only new async operation is `response.text()` in `github/index.ts` — but this only fires on error paths (non-200 responses), which are already slow by definition
- The `Date.now()` calls for duration measurement in `proxy.ts` add negligible overhead

## References

- Research: `thoughts/shared/research/2026-04-05-platform-logging-gaps.md`
- Logger implementation: `vendor/observability/src/log/next.ts`
- Logger type interface: `vendor/observability/src/log/types.ts`
- Production error sanitization: `api/platform/src/trpc.ts:86-91`
