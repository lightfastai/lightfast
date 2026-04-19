# Core Packages Upgrade — Phase A (Safe Minor/Patch Sweep) Implementation Plan

## Overview

Bring the workspace up to the latest patch and minor versions within the current major for core packages (Next, React, Tailwind, tRPC, TanStack Query, Vitest, Sentry, Drizzle, Radix, Remotion, etc.), and reconcile the catalog with existing hard-pinned bypasses so `pnpm-workspace.yaml` becomes the single source of truth. No major upgrades in this phase; the `pnpm.overrides` audit is deferred to Phase B.

## Current State Analysis

The catalog in `pnpm-workspace.yaml` already tracks the latest majors for the headline packages (`next 16.2.1`, `react 19.2.4`, `zod 4.0.0`, `tailwindcss 4.2.1`, `typescript ^5.8.2`, `vitest 4.0.18`, `@trpc/* 11.12.0`). What it does not track is the steady drift of patch/minor releases since those majors landed — `pnpm outdated -r` surfaces ~50 bumps available inside the current majors.

In parallel, two hygiene issues have accumulated:

1. **Catalog bypasses.** `core/lightfast/package.json:50` and `core/ai-sdk/package.json:87` declare `"@types/node": "^24.3.0"` directly instead of using `"catalog:"`. Because pnpm hoists, the 24.x resolution flows to every workspace that *does* use `catalog:`, making the catalog entry `^20.16.11` effectively fiction. The same pattern exists for `typescript`: the catalog says `^5.8.2`, but the root `package.json:50` plus `core/lightfast/package.json:53` and `core/ai-sdk/package.json:92` pin `^5.9.2`, and the actual installed version is 5.9.3.

2. **Engine/types mismatch.** Root `package.json` declares `"node": ">=22.0.0"` while the catalog's `@types/node` is capped at v20. Even though resolution lands on 24.x via the bypasses, the catalog floor should match reality (≥22, and realistically the current ≥24 line everyone is already on).

Deprecated catalog entries (`@types/uuid 10.0.0`) and deprecated transitive usage (`joyful` via `packages/lib/src/friendly-words.ts`) exist but are out of Phase A scope — they require replacement work or major bumps.

## Desired End State

- Catalog in `pnpm-workspace.yaml` is the single source of truth: no workspace package hard-pins `@types/node` or `typescript`.
- Every core package is at the latest release within its current major (patch + minor bumps applied).
- `pnpm install && pnpm typecheck && pnpm test && pnpm build:app && pnpm build:platform && pnpm build:www` all pass.
- Dev servers (`pnpm dev:app`, `pnpm dev:www`, `pnpm dev:platform`) start and render without regression.

### Key Discoveries:

- `pnpm-workspace.yaml:29` — `@types/node: ^20.16.11` is floor-wrong (real resolution is 24.9.1 due to core/* pins)
- `pnpm-workspace.yaml:51` — `typescript: ^5.8.2` is floor-wrong (real resolution is 5.9.3 via root + core/* pins)
- `core/lightfast/package.json:50,53` and `core/ai-sdk/package.json:87,92` — the two bypasses driving the drift
- `package.json:50` — root devDep `typescript: ^5.9.2` is the third source of truth for TS
- `vendor/inngest/package.json:36,39` — `hono` catalog entry is still consumed here (not dead)
- `apps/app/package.json` and `apps/www/package.json` both consume `babel-plugin-react-compiler` (not dead)
- `packages/lib/src/friendly-words.ts` — only consumer of the deprecated `joyful` package (flagged, not addressed here)

## What We're NOT Doing

- **Major-version bumps.** Deferred explicitly: `ai 5→6`, `@ai-sdk/gateway 1→3`, `@ai-sdk/react 2→3`, `inngest 3→4`, `framer-motion 11→12`, `typescript 5→6`, `shiki 3→4`, `@shikijs/* 3→4`, `recharts 2→3`, `redis 4→5`, `resend 4→6`, `react-resizable-panels 2→4`, `lucide-react 0.577→1.8`, `@arcjet/* beta.10→1.4`, `@vercel/analytics 1→2`, `@vercel/speed-insights 1→2`, `@pinecone-database/pinecone 6→7`, `cohere-ai 7→8`, `commander 13→14`, `dotenv-cli 8→11`, `html2canvas-pro 1→2`, `import-in-the-middle 1→3`, `require-in-the-middle 7→8`, `jiti 1→2`, `knip 5→6`, `@mixedbread/sdk 0.46→0.61`, `nosecone beta→1.4`, `open 10→11`, `ora 8→9`, `schema-dts 1→2`, `streamdown 1→2`, `uuid 11→13`, `vercel 50→51`.
- **Deprecated dep replacement.** `@types/uuid 10.0.0` (deprecated, major bump to 11) and `joyful 1.1.1` (deprecated, needs replacement in `packages/lib/src/friendly-words.ts`) stay as-is.
- **`pnpm.overrides` audit.** The `zod-to-json-schema>zod ^3.25.76` pin and the security pins (`undici`, `cookie`, `tar`, `qs`, `body-parser`, `path-to-regexp`, `fast-xml-parser`, `lodash`, `lodash-es`) are Phase B.
- **Zod version change.** `zod 4.0.0` stays pinned exact in Phase A; loosening to `^4.0.0` or bumping within 4.x is folded into the Phase B overrides audit since the sub-dep pin is related.
- **Catalog restructure.** No renaming, reorganizing, or moving entries between `catalog` and `catalogs:*`.

## Implementation Approach

Work in four phases, merging after each phase so bisect stays useful if a regression surfaces later:

1. **Alignment first** — reconcile the catalog bypasses so subsequent bumps flow through one place.
2. **Patch sweep** — zero-friction `x.y.Z` bumps, done catalog-wide in one pass.
3. **Minor sweep** — `x.Y.z` bumps inside the same major, same pass.
4. **Verification** — full workspace build + dev smoke test before marking done.

Each phase is one commit. After every phase, run `pnpm install` to refresh the lockfile, then the verification commands for that phase.

---

## Phase 1: Catalog Alignment

### Overview

Remove the three hard-pinned bypasses and update the catalog floors so `pnpm-workspace.yaml` reflects reality. No package versions change in this phase — `pnpm install` should produce a lockfile diff limited to the `specifiers` block.

### Changes Required:

#### 1. Raise catalog floors

**File**: `pnpm-workspace.yaml`
**Changes**: Update `@types/node` and `typescript` entries to match currently-resolved versions.

```yaml
# catalog:
  '@types/node': ^24.9.1     # was ^20.16.11
  typescript: ^5.9.2         # was ^5.8.2
```

#### 2. Drop `@types/node` bypass in core packages

**File**: `core/lightfast/package.json`
**Changes**: Line 50 — replace hard pin with catalog reference.

```jsonc
// devDependencies
"@types/node": "catalog:",   // was "^24.3.0"
```

**File**: `core/ai-sdk/package.json`
**Changes**: Line 87 — same replacement.

```jsonc
"@types/node": "catalog:",   // was "^24.3.0"
```

#### 3. Drop `typescript` bypass in core packages and root

**File**: `core/lightfast/package.json`
**Changes**: Line 53 — catalog reference.

```jsonc
"typescript": "catalog:",    // was "^5.9.2"
```

**File**: `core/ai-sdk/package.json`
**Changes**: Line 92 — catalog reference.

```jsonc
"typescript": "catalog:",    // was "^5.9.2"
```

**File**: `package.json` (root)
**Changes**: Line 50 — the root devDep `typescript` is load-bearing for tooling like `tsc --version` outside a workspace context. Keep it, but bump it forward so it is ≥ catalog floor. No need to switch to `catalog:` here since the root isn't a workspace member.

```jsonc
"typescript": "^5.9.2"       // already at this value; verify no regression
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds with no errors
- [x] Lockfile diff affects only `specifiers` / `importers` metadata for the two core packages (no version changes in resolved deps) — scope extended as the plan predicted: peer-dep `@types/node` consumers consolidated 20.x/22.x → 24.9.1, which is the intended unification
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [ ] `pnpm check` passes — reports 96 errors + 1 warning, confirmed identical on clean `main`; pre-existing, not introduced by Phase 1

#### Manual Verification:

- [ ] `pnpm dev:app` boots without TypeScript errors in terminal
- [ ] `pnpm dev:platform` boots without TypeScript errors
- [x] Confirmed via `pnpm list @types/node -r --depth 0` that all packages now resolve 24.x from the catalog (single line: `@types/node@24.9.1`)

**Implementation Note**: After Phase 1 passes automated and manual verification, pause for human confirmation before starting Phase 2.

---

## Phase 2: Patch Sweep

### Overview

Apply all `x.y.Z` bumps where only the patch number changes. These are the lowest-risk updates and should land together as a single commit.

### Changes Required:

#### 1. Catalog patch bumps

**File**: `pnpm-workspace.yaml`
**Changes**: Update the `catalog:` and scoped catalog entries below. Exact target versions will be resolved to whatever `npm view <pkg> version` reports at implementation time; the versions listed are as of 2026-04-19.

```yaml
# catalog:
  '@neondatabase/serverless': ^1.1.0     # was ^1.0.2 (minor, but only x.y bump — moved to Phase 3)
  '@noble/hashes': ^2.2.0                # Phase 3 (2.0 → 2.2, minor)
  '@t3-oss/env-core': ^0.13.11           # was ^0.13.10
  '@t3-oss/env-nextjs': ^0.13.11         # was ^0.13.10
  '@upstash/redis': ^1.37.0              # Phase 3 (minor)
  '@vitest/coverage-v8': ^4.1.4          # Phase 3 (minor)
  '@vitest/expect': ^4.1.4                # Phase 3 (minor)
  drizzle-orm: ^0.45.2                    # was ^0.45.1
  nanoid: ^5.1.9                          # was ^5.1.5
  vitest: ^4.1.4                          # Phase 3 (minor)

# catalogs.react19:
  react: ^19.2.5                          # was ^19.2.4
  react-dom: ^19.2.5                      # was ^19.2.4

# catalogs.next16:
  next: ^16.2.4                           # was ^16.2.1

# catalogs.tailwind4:
  tailwindcss: 4.2.2                      # was 4.2.1
  postcss: 8.5.10                         # was 8.5.8
  '@tailwindcss/postcss': 4.2.2           # was 4.2.1
```

Phase 2 catalog set (patches only): `drizzle-orm`, `nanoid`, `@t3-oss/env-core`, `@t3-oss/env-nextjs`, `react`, `react-dom`, `next`, `tailwindcss`, `postcss`, `@tailwindcss/postcss`.

#### 2. Root devDependency patches

**File**: `package.json`
**Changes**: Lines 45–52 — bump patch versions in root `devDependencies`.

```jsonc
"devDependencies": {
  "@biomejs/biome": "2.4.12",     // was 2.4.6
  "turbo": "2.9.6",                // was 2.9.3
  "turbo-ignore": "2.9.6"          // was 2.9.3
  // @changesets/cli, knip, typescript, ultracite, vercel remain unchanged
}
```

#### 3. Direct-versioned patches in individual packages

Run `pnpm outdated -r --format json` and apply patch-level bumps (only where `x.y` is unchanged) to every package.json that declares the dep directly rather than via catalog. Specifically:

- `@next/bundle-analyzer 16.1.6 → 16.2.4` — wherever declared directly (same version as `next`)
- `@radix-ui/react-aspect-ratio 1.1.7 → 1.1.8`
- `@radix-ui/react-avatar 1.1.10 → 1.1.11`
- `@radix-ui/react-label 2.1.7 → 2.1.8`
- `@radix-ui/react-progress 1.1.7 → 1.1.8`
- `@radix-ui/react-separator 1.1.7 → 1.1.8`
- `@remotion/bundler 4.0.434 → 4.0.448`
- `@remotion/cli 4.0.434 → 4.0.448`
- `@remotion/fonts 4.0.434 → 4.0.448`
- `@remotion/renderer 4.0.434 → 4.0.448`
- `remotion 4.0.434 → 4.0.448`
- `@orpc/client 1.13.13 → 1.13.14`
- `@orpc/contract 1.13.13 → 1.13.14`
- `@orpc/openapi 1.13.13 → 1.13.14`
- `@orpc/openapi-client 1.13.13 → 1.13.14`
- `@orpc/server 1.13.13 → 1.13.14`
- `@orpc/zod 1.13.13 → 1.13.14`
- `zustand 5.0.11 → 5.0.12`
- `drizzle-kit 0.31.9 → 0.31.10`

Use `grep -rn '"<pkg>":' apps packages vendor core db api --include=package.json` to locate each consumer, then `pnpm update <pkg> --recursive --latest --filter '*'` or edit by hand. Prefer editing package.jsons so the diff is reviewable.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52/52 tasks)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (11/11 tasks, 444 tests)
- [ ] `pnpm check` passes — pre-existing 96 errors + 1 warning on `main`, unchanged
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds
- [x] `pnpm build:www` succeeds

#### Manual Verification:

- [ ] `pnpm dev:full` starts all three apps, serves `http://localhost:3024` via microfrontends
- [ ] App home page renders, auth routes (`/sign-in`, `/sign-up`, `/early-access`) load
- [ ] WWW marketing + `/docs` route render
- [ ] Platform `http://localhost:4112` responds on its health/tRPC endpoint
- [ ] No hydration errors in browser console

**Implementation Note**: Pause for human confirmation after Phase 2 before starting Phase 3.

---

## Phase 3: Minor Sweep

### Overview

Apply all `x.Y.z` bumps where the minor version advances inside the same major. Higher blast radius than Phase 2 because minors can include new APIs, deprecations, or behavior tweaks, even when semver-safe.

### Changes Required:

#### 1. Catalog minor bumps

**File**: `pnpm-workspace.yaml`

```yaml
# catalog:
  '@clerk/backend': ^3.2.13               # was 3.2.3 (no caret — add one? keep exact per existing pattern; TBD per clerk stability)
  '@clerk/nextjs': ^7.2.3                 # was 7.0.1
  '@clerk/shared': ^4.8.2                 # was 4.0.0 — 8 minors of accumulated Clerk changes; review release notes
  '@neondatabase/serverless': ^1.1.0      # was ^1.0.2
  '@noble/hashes': ^2.2.0                 # was ^2.0.1
  '@sentry/core': ^10.49.0                # was ^10.42.0
  '@sentry/nextjs': ^10.49.0              # was ^10.42.0
  '@tanstack/react-query': ^5.99.1        # was ^5.90.21
  '@trpc/client': ^11.16.0                # was ^11.12.0
  '@trpc/server': ^11.16.0                # was ^11.12.0
  '@trpc/tanstack-react-query': ^11.16.0  # was ^11.12.0
  '@upstash/redis': ^1.37.0               # was ^1.36.3
  '@vitest/coverage-v8': ^4.1.4           # was ^4.0.18
  '@vitest/expect': ^4.1.4                # was ^4.0.18
  jose: ^6.2.2                             # was ^6.1.2
  react-hook-form: ^7.72.1                 # was ^7.71.2
  vitest: ^4.1.4                           # was ^4.0.18
```

Clerk/tRPC/TanStack Query are the highest-risk minors in this batch — verify auth flows and tRPC hydration (`prefetch()` before `<HydrateClient>`, per CLAUDE.md rule 3) still work.

#### 2. Direct-versioned minor bumps

- `@vitest/ui 4.0.18 → 4.1.4`
- `@mixedbread/cli 2.3.0 → 2.3.2` (patch — could also live in Phase 2, group here since it's the only mixedbread package we're touching)
- `fumadocs-core 16.6.10 → 16.7.16`
- `fumadocs-ui 16.6.10 → 16.7.16`
- `fumadocs-mdx 14.2.9 → 14.3.0`
- `fumadocs-openapi 10.3.16 → 10.7.1` (largest jump in fumadocs — scan changelog)
- `eventsource-parser 3.0.6 → 3.0.7`
- `@vercel/microfrontends 2.3.0 → 2.3.2`
- `@upstash/redis` direct consumers (if any outside catalog)
- `happy-dom 20.8.9 → 20.9.0`
- `@modelcontextprotocol/sdk 1.27.1 → 1.29.0`
- `@octokit/plugin-retry 8.0.3 → 8.1.0`
- `@paper-design/shaders-react 0.0.72 → 0.0.76`
- `svix 1.86.0 → 1.90.0`
- `@turbo/gen 2.8.14 → 2.9.6`
- `@changesets/cli 2.30.0 → 2.31.0`
- `@inquirer/select 4.4.2 → 5.1.3` — **confirm this is a minor inside 4.x or stop; 4.x → 5.x is a major, remove from Phase 3 if so**. Per the outdated output the jump is 4.4.2 → 5.1.3 (major). Skip in Phase A.
- `resumable-stream 2.2.10 → 2.2.12`
- `posthog-js 1.359.1 → 1.369.3`
- `posthog-node 5.28.0 → 5.29.2`
- `@planetscale/database 1.19.0 → 1.20.1`
- `autoprefixer 10.4.27 → 10.5.0`

Note: `@inquirer/select` moves from 4.x → 5.x (major) — exclude from Phase 3, defer with the other majors.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52/52 after fumadocs revert + `@opentelemetry/api` dedup)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (11/11, 444 tests)
- [ ] `pnpm check` passes — pre-existing 96 errors + 1 warning on `main`, unchanged
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds
- [x] `pnpm build:www` succeeds

#### Phase 3 deltas from the written plan

- **Fumadocs reverted, not bumped.** `fumadocs-core`, `fumadocs-ui`, `fumadocs-mdx`, and `fumadocs-openapi` hold at their Phase 2 versions (`16.6.10`, `14.2.9`, `10.3.16`). The 16.7.x minor ships breaking type changes (`paremeters`→`parameters` slot rename, `AuthField.original` removed, stricter `MDXComponents` type, `createApiPageStaticPage` signature now takes `(slots, ctx, method)`). That migration belongs in its own PR. `fumadocs-openapi` was pinned exact (no caret) so the `^` no longer drifts into 10.7.x.
- **`@opentelemetry/api` pinned to `1.9.1` in `pnpm.overrides`.** The Phase 3 catalog/dep bumps split drizzle-orm@0.45.2 into two peer flavors (one with `@opentelemetry/api@1.9.0`, one with `1.9.1`), which made tRPC routers in `api/app/src/router/org/connections.ts` fail with "Argument of type 'SQL<unknown>' is not assignable to parameter of type 'SQL<unknown>'" — classic two-module-instances error. One override collapses both flavors. This is the only new `pnpm.overrides` entry; the broader audit stays Phase B.
- **`@upstash/redis` floor in `vendor/upstash/package.json` raised to `^1.37.0`** to match the new catalog. Sherif flagged the drift (vendor/upstash at `^1.35.1`, core/ai-sdk at `^1.37.0`) during postinstall.

#### Manual Verification:

- [ ] tRPC: prefetch-then-hydrate flows still work on app (e.g. dashboard loads without UNAUTHORIZED)
- [ ] Clerk auth: sign-in and sign-up flows complete, org switcher still works
- [ ] Sentry: trigger a handled error and confirm it appears in the Sentry project
- [ ] Vitest: `pnpm test` runs in all filters, no runner-level crashes
- [ ] Inngest dev: functions register and trigger via the local Inngest dev server
- [ ] Fumadocs: `/docs` navigates, search works, MDX code blocks render (no fumadocs bump in Phase 3 — behavior should be identical to main)

**Implementation Note**: Pause for human confirmation after Phase 3 before starting Phase 4.

---

## Phase 4: Final Verification & Cleanup

### Overview

A final pass against the whole repo, plus dev-server smoke test, before declaring Phase A done and opening the door to Phase B (overrides audit).

### Changes Required:

No code changes. This phase is verification only.

#### 1. Full workspace verification

```bash
pnpm install
pnpm check
SKIP_ENV_VALIDATION=true pnpm typecheck
SKIP_ENV_VALIDATION=true pnpm test
pnpm build:app
pnpm build:platform
pnpm build:www
```

#### 2. Dev server smoke test

```bash
pnpm dev:full > /tmp/console-dev.log 2>&1 &
# wait ~20s, then:
tail -50 /tmp/console-dev.log
# visit:
#   http://localhost:3024             (app via microfrontends)
#   http://localhost:3024/docs        (www via microfrontends)
#   http://localhost:3024/sign-in     (app auth)
#   http://localhost:4112             (platform direct)
# then:
pkill -f "next dev"
```

#### 3. Lockfile review

- [ ] Confirm `pnpm-lock.yaml` diff contains only the deps we intended to bump (catch surprise transitive upgrades)
- [ ] Confirm no new workspace-level warnings from `pnpm install`

### Success Criteria:

#### Automated Verification:

- [x] All Phase 2 and Phase 3 automated checks still pass after the combined lockfile (full turbo cache hit on typecheck/test/build — nothing invalidated)
- [x] `pnpm lint:ws` (sherif) reports no new issues (`✓ No issues found`)

#### Manual Verification:

- [ ] Dev smoke test: all four URLs above render without errors
- [ ] Browser console clean on app home, docs home, sign-in
- [x] `pnpm outdated -r` output for Phase A target deps shows `current === latest` within their current major. Residuals are all expected: explicitly-deferred majors (react-resizable-panels, typescript, lucide-react, @mixedbread/sdk, uuid, vercel, @arcjet/*, nosecone), the pre-existing `@t3-oss/env-nextjs ^0.12.0` direct pin in `apps/app` (bypass, not Phase A scope), reverted fumadocs 16.7.x (breaking changes — own PR), and `react/react-dom` exact pins `19.2.4` in package.jsons (pre-existing, resolve to 19.2.5 via `pnpm.overrides`).

**Implementation Note**: Once Phase 4 passes, Phase A is complete. Open a PR, merge, then start the Phase B overrides audit as a separate effort.

---

## Testing Strategy

### Unit Tests:

- `pnpm test` across the workspace after each phase. Vitest minor bump (4.0 → 4.1) is the only test-tooling change; watch for new deprecation warnings in the runner output.

### Integration Tests:

- tRPC hydration flow (prefetch → HydrateClient) on at least one app and one platform route.
- Clerk auth flow (sign-in, sign-up, org switch).
- Inngest workflow registration + one end-to-end trigger from the local dev server.

### Manual Testing Steps:

1. `pnpm dev:full` and load `http://localhost:3024` — confirm home renders.
2. Navigate to `/sign-in` — confirm Clerk UI renders and lets you sign in.
3. Navigate to `/docs` — confirm Fumadocs loads, left nav populates, MDX code blocks syntax-highlight.
4. Open browser dev tools, confirm no hydration errors and no 4xx/5xx from tRPC or webhook endpoints.
5. Trigger a handled Sentry error (e.g. from a test route) and confirm it reaches the Sentry dashboard.

## Performance Considerations

No expected performance impact — all changes are same-major releases. If Next 16.2.4 or React 19.2.5 ships a behavioral change, it would show up as a render regression during manual dev smoke test.

## Migration Notes

No data migrations. No schema changes. Rollback is `git revert` of each phase commit + `pnpm install`.

## References

- Source of outdated data: `pnpm outdated -r --format json` run on 2026-04-19
- Catalog: `pnpm-workspace.yaml` (project root)
- Bypasses: `core/lightfast/package.json:50,53`, `core/ai-sdk/package.json:87,92`, `package.json:50`
- Deferred deprecated dep: `packages/lib/src/friendly-words.ts` (joyful)
- Follow-up: Phase B — `pnpm.overrides` audit (including the `zod-to-json-schema>zod ^3.25.76` pin and the security overrides block in `package.json:54-73`)
