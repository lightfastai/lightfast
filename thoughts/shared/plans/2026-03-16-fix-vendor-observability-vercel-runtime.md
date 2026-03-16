# Fix @vendor/observability Vercel Runtime ERR_MODULE_NOT_FOUND

## Overview

All three Hono services (gateway, relay, backfill) crash at startup on Vercel with `ERR_MODULE_NOT_FOUND` because `@vendor/observability`'s exports map points to raw `.ts` source files. Node.js cannot execute `.ts` files at runtime. The fix follows the established pattern used for `@vendor/inngest` (commit `aae89d045`) and `@db/console` (commit `3e9c9fd72`).

## Current State Analysis

**The error:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/var/task/apps/gateway/node_modules/@vendor/observability/src/sentry.ts'
imported from /var/task/apps/gateway/src/sentry-init.js
```

**Root cause:** `vendor/observability/package.json` maps all 12 export subpaths to raw `.ts` source files (e.g. `"./sentry": "./src/sentry.ts"`). The build script (`tsc`) inherits `emitDeclarationOnly: true` from `internal-package.json`, so only `.d.ts` declaration files are emitted to `dist/` — no `.js` files exist.

**Why it only affects Vercel:** Locally, `srvx --import tsx` handles `.ts` imports natively. On Vercel, the deployed function resolves `@vendor/observability/sentry` via the `node_modules` symlink → follows the exports map → finds `src/sentry.ts` → Node.js cannot execute `.ts`.

### Key Discoveries:
- All other 10 workspace deps consumed by the services already export compiled `dist/*.js` files
- `@vendor/observability` is the sole broken package
- The same fix pattern was already applied to `@vendor/inngest` and `@db/console`
- Current `dist/` output has no `src/` prefix (e.g. `dist/sentry.d.ts`, not `dist/src/sentry.d.ts`)
- The existing `./log` export has a stale `types` path pointing to `./dist/src/log.d.ts` which doesn't exist

## Desired End State

`@vendor/observability` emits `.js` files alongside `.d.ts` files, and all exports resolve to compiled `dist/*.js` paths. All three Hono services deploy and start successfully on Vercel.

### Verification:
- `pnpm --filter @vendor/observability build` produces `.js` files in `dist/`
- `pnpm build:gateway`, `pnpm build:relay`, `pnpm build:backfill` succeed
- `pnpm typecheck` passes
- Services start without `ERR_MODULE_NOT_FOUND` on Vercel

## What We're NOT Doing

- Not changing the build tool from `tsc` to `tsup` (tsc is sufficient since observability has no complex bundling needs)
- Not modifying any service code — only the vendor package
- Not changing how `noExternal` works in the service tsup configs

## Implementation Approach

Single-phase fix: override `emitDeclarationOnly` and update exports map. Same pattern as `@vendor/inngest`.

## Phase 1: Fix @vendor/observability Build and Exports

### Overview
Make `tsc` emit JS output and point all exports to compiled `dist/` files.

### Changes Required:

#### 1. Override emitDeclarationOnly in tsconfig
**File**: `vendor/observability/tsconfig.json`
**Changes**: Add `"emitDeclarationOnly": false` to compilerOptions

```json
{
  "extends": "@repo/typescript-config/internal-package.json",
  "compilerOptions": {
    "emitDeclarationOnly": false
  },
  "include": ["*.ts", "src"],
  "exclude": ["node_modules", "dist"]
}
```

#### 2. Update all exports to point to compiled dist/ files
**File**: `vendor/observability/package.json`
**Changes**: Replace all 12 export subpaths with `{ "types": "./dist/...", "default": "./dist/..." }` format

```json
"exports": {
  "./sentry-env": {
    "types": "./dist/env/sentry-env.d.ts",
    "default": "./dist/env/sentry-env.js"
  },
  "./sentry": {
    "types": "./dist/sentry.d.ts",
    "default": "./dist/sentry.js"
  },
  "./betterstack-env": {
    "types": "./dist/env/betterstack-env.d.ts",
    "default": "./dist/env/betterstack-env.js"
  },
  "./log": {
    "types": "./dist/log.d.ts",
    "default": "./dist/log.js"
  },
  "./client-log": {
    "types": "./dist/client-log.d.ts",
    "default": "./dist/client-log.js"
  },
  "./types": {
    "types": "./dist/types.d.ts",
    "default": "./dist/types.js"
  },
  "./error": {
    "types": "./dist/error.d.ts",
    "default": "./dist/error.js"
  },
  "./async-executor": {
    "types": "./dist/async-executor.d.ts",
    "default": "./dist/async-executor.js"
  },
  "./error-formatter": {
    "types": "./dist/error-formatter.d.ts",
    "default": "./dist/error-formatter.js"
  },
  "./use-logger": {
    "types": "./dist/use-logger.d.ts",
    "default": "./dist/use-logger.js"
  },
  "./service-log": {
    "types": "./dist/service-log.d.ts",
    "default": "./dist/service-log.js"
  },
  "./print-routes": {
    "types": "./dist/print-routes.d.ts",
    "default": "./dist/print-routes.js"
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] Build produces JS: `pnpm --filter @vendor/observability build && ls vendor/observability/dist/sentry.js`
- [ ] All dist files exist: `ls vendor/observability/dist/{sentry,log,error,types,service-log,client-log,async-executor,error-formatter,use-logger,print-routes}.js vendor/observability/dist/env/{sentry-env,betterstack-env}.js`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm check`
- [ ] Gateway builds: `pnpm build:gateway`
- [ ] Relay builds: `pnpm build:relay`
- [ ] Backfill builds: `pnpm build:backfill`

#### Manual Verification:
- [ ] Deploy gateway to Vercel — no ERR_MODULE_NOT_FOUND at startup
- [ ] Deploy relay to Vercel — no ERR_MODULE_NOT_FOUND at startup
- [ ] Deploy backfill to Vercel — no ERR_MODULE_NOT_FOUND at startup

**Implementation Note**: After completing automated verification, deploy to Vercel to confirm the runtime fix works.

---

## References

- Previous fix for `@vendor/inngest`: commit `aae89d045` — same pattern (emitDeclarationOnly override + export map update)
- Previous fix for `@db/console`: commit `3e9c9fd72` — same pattern
- Error source: `apps/gateway/src/sentry-init.ts:1` → `@vendor/observability/sentry`
- Broken exports: `vendor/observability/package.json:7-22`
- Build config: `vendor/observability/tsconfig.json` inherits `emitDeclarationOnly: true` from `internal/typescript/internal-package.json:7`
