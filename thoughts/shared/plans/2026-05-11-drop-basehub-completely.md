# Drop BaseHub Completely from Codebase

## Overview

Remove all remaining BaseHub references from the repo. BaseHub is no longer used — the `vendor/cms` package has already been deleted, no source file imports it, no `package.json` depends on `basehub`, and no env file actually defines the BASEHUB tokens. What's left is a handful of stale config artifacts that still reference BaseHub: env schema entries that block `apps/www` from booting if anyone wires a Vercel env, Turborepo `passThroughEnv` declarations, a CSP block, an image `remotePatterns` entry, and a Biome ignore rule pointing at a file that no longer exists. This plan deletes those artifacts.

## Current State Analysis

A repo-wide search for `basehub`, `BaseHub`, and `BASEHUB` (excluding `node_modules`, `.next`, `tmp/next-forge/`, `pnpm-lock.yaml`, and `thoughts/`) returns matches in exactly six files:

- `apps/www/src/env.ts:11,35-40` — comment + `BASEHUB_TOKEN` (required) + `BASEHUB_CHANGELOG_TOKEN` (optional) in the server schema. `BASEHUB_TOKEN` is `.min(1).startsWith("bshb_pk_")` with no `.optional()`, so a `pnpm build:www` will fail validation unless `SKIP_ENV_VALIDATION` is set.
- `apps/www/src/middleware.ts:34-41` — CSP `connectSrc` block for `pump-router.basehub.com` and Pusher (Pusher entries exist only to support BaseHub draft-mode real-time updates per the comment; `pusher` appears nowhere else under `apps/`, `packages/`, or `vendor/`).
- `apps/www/turbo.json:31-33` — `BASEHUB_TOKEN`, `BASEHUB_ADMIN_TOKEN`, `BASEHUB_CHANGELOG_TOKEN` in `passThroughEnv`.
- `apps/app/turbo.json:30-31` — `BASEHUB_TOKEN`, `BASEHUB_ADMIN_TOKEN` in `passThroughEnv`.
- `vendor/next/src/config.ts:33` — `{ protocol: "https", hostname: "assets.basehub.com" }` in `images.remotePatterns`.
- `biome.jsonc:14` — `"!vendor/cms/basehub-types.d.ts"` in `files.includes` (the path no longer exists; `vendor/cms` is absent from `vendor/`).

Verification of zero runtime coupling:

- `grep -rn "basehub\|BASEHUB" apps/app/src apps/platform apps/www/src apps/desktop packages vendor api core db internal scripts` → only `apps/www/src/env.ts` and `apps/www/src/middleware.ts` (the two source files above). No `process.env.BASEHUB_*` reads, no `import ... from "basehub"`, no `@vendor/cms` or `@repo/cms` import anywhere.
- `grep -rn "basehub" **/package.json` → no matches outside `node_modules` and `tmp/next-forge/`. Workspace dependency lists are clean.
- `apps/www/.vercel/.env.development.local`, `apps/app/.vercel/.env.development.local`, `apps/platform/.vercel/.env.development.local` → none contain `BASEHUB`. Locally these vars are absent, which is why `apps/www` currently relies on `SKIP_ENV_VALIDATION` or never hitting prod build to avoid failure.
- `apps/{app,platform,www}/vercel.json` → no BaseHub references.
- `vendor/cms/` directory does not exist (already removed). `biome.jsonc:14` is a dangling ignore.

Out-of-scope reference (do not touch):

- `tmp/next-forge/**` — vendored upstream snapshot used as reference material; not part of the workspace and ignored by all build/lint pipelines.

### Key Discoveries:

- The Pusher CSP entries (`wss://ws-mt1.pusher.com`, `https://sockjs-mt1.pusher.com`) at `apps/www/src/middleware.ts:38-39` exist solely to enable BaseHub draft-mode real-time updates. No other code uses Pusher, so they go with BaseHub.
- `BASEHUB_TOKEN` is a required (non-optional) entry in `apps/www/src/env.ts:35`. Removing it tightens, not loosens, env validation — no risk of a silent regression.
- Biome's `files.includes` at `biome.jsonc:14` references a file that does not exist on disk. Biome tolerates this today; removing the entry is a no-op for behavior but cleans up the config.
- `assets.basehub.com` is the only image remote pattern that's BaseHub-specific; the other entries (`imagedelivery.net`, `avatars.githubusercontent.com`) are independent.

## Desired End State

A repo-wide `grep -rn "basehub\|BaseHub\|BASEHUB"` over the workspace (excluding `node_modules`, `.next`, `pnpm-lock.yaml`, `tmp/`, `thoughts/`, `.vercel/output/`) returns zero matches. `pnpm typecheck`, `pnpm check`, and a successful `apps/www` and `apps/app` build verify nothing depended on the removed entries.

## What We're NOT Doing

- Touching `tmp/next-forge/**` — out-of-tree reference material.
- Modifying `pnpm-lock.yaml` directly. `basehub` is not a workspace dependency; if any transitive lockfile entry survives, it gets cleaned by the next `pnpm install` and is not load-bearing.
- Removing the Vercel project env vars in the dashboard. That's a manual ops step the user can do separately; this plan only handles repo code.
- Refactoring CSP composition or env schema structure beyond removing BaseHub-specific entries.
- Removing MXBAI env vars in `apps/www/src/env.ts:41-42` — unrelated and still in use at `apps/www/src/app/(app)/(content)/api/search/route.ts`.

## Implementation Approach

Single-phase cleanup. All edits are mechanical removals across six files; there is no migration, no data, no runtime behavior to preserve. Execute every removal, then run automated verification.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

## Phase 1: Remove all BaseHub references [DONE]

### Overview

Strip the six BaseHub-related entries across env schema, middleware CSP, Turbo `passThroughEnv`, Next image `remotePatterns`, and Biome ignore list.

### Changes Required:

#### 1. `apps/www/src/env.ts`

**Changes**: Drop the stale comment at line 10-11 and the two `BASEHUB_*` entries from the `server` schema.

```ts
// Remove lines 10-11:
// NOTE: Avoid importing TS files from vendor packages at config-load time.
// Mirror the minimal BaseHub env schema here to prevent Node resolution issues.

// Remove lines 35-40 (BASEHUB_TOKEN and BASEHUB_CHANGELOG_TOKEN), leaving:
server: {
  HEALTH_CHECK_AUTH_TOKEN: z.string().min(32).optional(),
  PORT: z.coerce.number().positive().optional().default(3000),
  MXBAI_API_KEY: z.string().min(1),
  MXBAI_STORE_ID: z.string().min(1),
},
```

#### 2. `apps/www/src/middleware.ts`

**Changes**: Delete the entire BaseHub CSP block at lines 34-41 (comment + the object with `pump-router.basehub.com` and both Pusher domains). Remove the trailing comma on the preceding Apollo block if it becomes the last argument.

```ts
// Before (lines 29-42):
    // Apollo website tracker
    {
      scriptSrc: ["https://assets.apollo.io"],
      connectSrc: ["https://app.apollo.io"],
    },
    // BaseHub CMS (draft mode uses Pusher for real-time updates)
    {
      connectSrc: [
        "https://pump-router.basehub.com",
        "wss://ws-mt1.pusher.com",
        "https://sockjs-mt1.pusher.com",
      ],
    }
  )

// After:
    // Apollo website tracker
    {
      scriptSrc: ["https://assets.apollo.io"],
      connectSrc: ["https://app.apollo.io"],
    }
  )
```

#### 3. `apps/www/turbo.json`

**Changes**: Remove `BASEHUB_TOKEN`, `BASEHUB_ADMIN_TOKEN`, `BASEHUB_CHANGELOG_TOKEN` from `tasks.build.passThroughEnv` (lines 31-33).

#### 4. `apps/app/turbo.json`

**Changes**: Remove `BASEHUB_TOKEN`, `BASEHUB_ADMIN_TOKEN` from `tasks.build.passThroughEnv` (lines 30-31).

#### 5. `vendor/next/src/config.ts`

**Changes**: Remove the `assets.basehub.com` entry from `images.remotePatterns` at line 33.

```ts
// Before:
remotePatterns: [
  { protocol: "https", hostname: "imagedelivery.net" },
  { protocol: "https", hostname: "assets.basehub.com" },
  { protocol: "https", hostname: "avatars.githubusercontent.com" },
],

// After:
remotePatterns: [
  { protocol: "https", hostname: "imagedelivery.net" },
  { protocol: "https", hostname: "avatars.githubusercontent.com" },
],
```

#### 6. `biome.jsonc`

**Changes**: Remove `"!vendor/cms/basehub-types.d.ts"` from `files.includes` at line 14.

### Success Criteria:

#### Automated Verification:

- [x] Repo-wide grep returns zero workspace matches: `grep -rn "basehub\|BaseHub\|BASEHUB" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" --include="*.json" --include="*.jsonc" --include="*.md" /Users/jeevanpillay/Code/@lightfastai/lightfast 2>/dev/null | grep -v node_modules | grep -v ".next" | grep -v "pnpm-lock" | grep -v "tmp/" | grep -v "thoughts/" | grep -v ".vercel/output"` → empty.
- [x] Type checking passes: `pnpm typecheck` (37/37 tasks).
- [x] Lint passes on touched files: `npx ultracite check apps/www/src/env.ts apps/www/src/middleware.ts apps/www/turbo.json apps/app/turbo.json vendor/next/src/config.ts biome.jsonc` → clean. (Repo-wide `pnpm check` reports one pre-existing error in `.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs`, an untracked file unrelated to this work.)
- [x] `apps/www` builds: `pnpm build:www` → success in 25.7s.
- [x] `apps/app` builds: `pnpm build:app` → success in 17.5s.
- [x] `apps/www` boots `pnpm dev:www` without throwing `BASEHUB_TOKEN` env-validation errors and without requiring `SKIP_ENV_VALIDATION` — `next dev --turbopack` reports `✓ Ready in 349ms`, no env-validation error in console.

#### Human Review:

- [x] Fetched `http://localhost:4481/` (the underlying Next.js port; portless aggregate had unrelated boot noise) → HTTP 200, response CSP `connect-src` contains only `'self' https://vitals.vercel-insights.com https://us.i.posthog.com https://us.posthog.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://assets.unicorn.studio https://app.apollo.io` — zero `basehub.com`, `pump-router`, `pusher.com`, or `sockjs-mt1.pusher.com` matches in the full headers dump. HTML body grep for `basehub|pump-router|pusher.com|sockjs` → 0 matches.

## Testing Strategy

### Unit Tests:

- N/A — pure deletion of unused config. No test files reference BaseHub (`grep -rn "basehub" --include="*.test.*" --include="*.spec.*"` returns zero).

### Integration Tests:

- `apps/www` boot + page-render check covered under Human Review above.

## Performance Considerations

None. CSP header shortens by ~70 bytes; Next image patterns list shrinks by one entry. Both are negligible.

## Migration Notes

- Vercel project env vars: `BASEHUB_TOKEN`, `BASEHUB_ADMIN_TOKEN`, `BASEHUB_CHANGELOG_TOKEN` can be removed from the Vercel dashboard for the `www` and `app` projects as a follow-up. Not load-bearing — Turborepo will simply stop passing them through, which is the desired end state.
- No data migration. No flag rollout needed.

## References

- Triggering request: user said "drop basehub completely from codebase. we dont use basehub anymore."
- Files touched: `apps/www/src/env.ts`, `apps/www/src/middleware.ts`, `apps/www/turbo.json`, `apps/app/turbo.json`, `vendor/next/src/config.ts`, `biome.jsonc`.
