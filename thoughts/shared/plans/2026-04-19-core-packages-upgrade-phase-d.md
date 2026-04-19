# Core Packages Upgrade — Phase D (Hygiene + Safe/Medium Majors) Implementation Plan

## Overview

Follow-on to Phases A (patch/minor sweep), B (overrides audit), and C (knip cleanup + React override sync). This plan tackles the first wave of the deferred-majors backlog — roughly 29 dependency changes grouped into eight bisect-friendly commits. Scope stays tight: CLI/tooling majors with Node-20-drop semantics, type-only majors, isolated UI majors (shiki + lucide-react), Arcjet/nosecone GA, and Sentry instrumentation alignment. UI heavyweights (framer-motion, recharts, react-resizable-panels, streamdown, resend, fumadocs), the AI runtime stack (ai, @ai-sdk/*, inngest, cohere-ai, pinecone, redis, mixedbread), and TypeScript/Node (`typescript 5→6`, `@types/node 24→25`) stay explicitly deferred to Phases E / F / G.

## Current State Analysis

**Precondition:** Phase C must be merged into `main` before Phase D kicks off. At time of writing, Phase C lives on `chore/core-packages-upgrade-phase-c` (commits `5bb3b5352`, `e3ba5d659`, `a152c04b6`) and is not yet merged. Do not start Phase D until Phase C's PR lands; the lockfile/catalog state this plan assumes (knip config cleaned, unused deps removed, React override pins synced to 19.2.5) only exists post-merge.

With the hygiene floor established, the remaining "core infra" work is a long list of single-major bumps. Research on each target (live lockfile inspection + official changelogs) established that the bulk of them are genuinely low-risk:

- Node 20 drop on all the CLI majors (`commander 14`, `open 11`, `ora 9`, `@inquirer/select 5`, `knip 6`) is already satisfied by the workspace engine floor `>=22.0.0` (`package.json:6`).
- `knip 6` removed three CLI flags (`--include-libs`, `--isolate-workspaces`, `--experimental-tags`) that the repo does not invoke.
- `@vercel/analytics 2` / `@vercel/speed-insights 2` ship zero Next.js-facing API changes; only the Nuxt subpath moved and we don't consume it.
- `import-in-the-middle ^3.0.0` is already the internal peer pulled by `@sentry/node-core@10.49.0` (verified at `node_modules/.pnpm/@sentry+node-core@10.49.0_.../node_modules/@sentry/node-core/package.json:110`). Our `apps/app` and `apps/www` pin the obsolete `^1.15.0`, so the bump is alignment, not a leap past Sentry.
- `joyful` (deprecated) has a single-line re-export in `vendor/lib/src/friendly-words.ts` and zero workspace callers — straight deletion.
- `@noble/ed25519 3` tightens input types to `Uint8Array`; the single workspace consumer (`packages/app-providers/src/runtime/verify/ed25519.ts:16-24`) already passes `Uint8Array` everywhere via a `_base64ToUint8Array` helper. No migration work beyond the bump.
- Arcjet GA between beta.10 and 1.4 introduced only two public changes: removal of the `ARCJET_BASE_URL` env override (unused here — `rg 'ARCJET_BASE_URL' apps packages vendor` returns zero results) and `experimental_detectPromptInjection → detectPromptInjection` (also unused — only `detectBot`, `fixedWindow`, `protectSignup`, `sensitiveInfo`, `shield`, `slidingWindow`, `tokenBucket`, `validateEmail` are re-exported from `vendor/security/src/index.ts:5-23`).

The medium-risk items are isolated enough to bisect cleanly:

- **shiki 4 ecosystem.** `shiki 3.13 → 4.0` dropped Node 18 and removed APIs deprecated across the 3.x series; a typings regression was reported against 4.0.0 (issue #1254) — bump target should be the highest 4.x with the fix, not literally 4.0.0. Six `packages/ui` files import `shiki`/`@shikijs/*` plus one `shikiOptions` config reference in `apps/www/src/app/(app)/(content)/_lib/api-page.tsx`. **De-risk:** `shiki@4.0.2` and the matching `@shikijs/*@4.0.2` family are already installed in the lockfile (pulled transitively — see `pnpm-lock.yaml:12074` and `pnpm-lock.yaml:24173`). The Phase 6 bump is a **dedup**, not a fresh install; the unknown is our own 6 consumer files.
- **lucide-react 0.577 → 1.8.** 94 source files import from it (33 in `packages/ui`, 33 in `apps/app`, 28 in `apps/www`, 1 config-level `transpilePackages` entry in `vendor/next/src/config.ts:81`). Known removals in the 1.x line: brand icons (e.g. `Github`, `Twitter`, `Slack`) and a `flip-*` → `square-centerline-dashed-*` rename (PR #3945). **Verified blast radius via spike (2026-04-19):** catalog bump to `^1.8.0` + `pnpm install` → typecheck surfaces exactly 3 removed icons (`Github`, `Linkedin`, `Twitter`) across 2 files in `apps/www` only; `packages/ui` and `apps/app` typecheck clean. No `Flip*` icon or `DynamicIcon` usage anywhere. Phase 7 is tightly scoped, not a full-workspace audit.
- **Sentry hooks.** `require-in-the-middle 7 → 8` removed the `resolve` npm dependency and can break bundled code (issue #120); Lightfast uses these via the `experimental.instrumentationHook` / `sentry.server.config.ts` pattern, not via webpack-bundled server code, so the known issue does not apply.

Security residuals post-Phase-B: the `hono <4.12.14` advisory (GHSA-458j-xx4x-4375, HTML injection in `hono/jsx` SSR) is a transitive from `vendor/inngest`. A catalog patch bump inside the 4.12.x major clears it.

## Desired End State

- Root `package.json` and workspace `package.json` files declare the bumped versions listed below.
- `pnpm-workspace.yaml` catalog entries for `hono` and `lucide-react` are at the new floors.
- `vendor/lib/src/friendly-words.ts` is deleted; `vendor/lib/package.json` no longer exports `./friendly-words` and no longer depends on `joyful`.
- `pnpm install && pnpm typecheck && pnpm test && pnpm build:app && pnpm build:platform && pnpm build:www` all pass.
- `pnpm audit --prod` advisory count is lower than the Phase B baseline (44) — at minimum clears the `hono` moderate advisory.
- Dev servers (`pnpm dev:app`, `pnpm dev:www`, `pnpm dev:platform`) render without regression.

### Key Discoveries:

- `package.json:47` — `knip ^5.85.0` is dev-only and invoked through the root `knip` script; zero source imports, zero breaking-change exposure in knip 6.
- `pnpm-workspace.yaml:39` — `hono ^4.12.5` catalog entry consumed only by `vendor/inngest` via the `./hono` adapter (which itself has zero in-repo callers); bumping the catalog to `^4.12.14` is load-bearing only for the `pnpm audit` result.
- `vendor/lib/src/friendly-words.ts:1` — single line `export { joyful as friendlyWords } from "joyful"`; `rg 'friendlyWords' apps packages vendor core db api` returns only the definition line.
- `packages/app-providers/src/runtime/verify/ed25519.ts:24` — `ed.verifyAsync(sigBytes, messageBytes, secretBytes)` call receives `Uint8Array` inputs built from base64; passes straight through `@noble/ed25519 3.x` type constraints.
- `vendor/security/src/index.ts:5-23` — re-exports the Arcjet public API surface we use; does not touch `experimental_detectPromptInjection`, `ARCJET_BASE_URL`, or any of the beta-only escape hatches.
- `apps/app/package.json:97,99` + `apps/www/package.json:78,81` — consumed via `catalog:` (not direct version pins). Catalog entries live at `pnpm-workspace.yaml:40` (`import-in-the-middle`) and `pnpm-workspace.yaml:46` (`require-in-the-middle`).
- `packages/ui/src/components/ai-elements/code-block.tsx:3-19` + `packages/ui/src/components/ssr-code-block/index.tsx:2-17` — the two load-bearing shiki consumers. Both import `bundledLanguages`/`bundledThemes` subpath packages (`@shikijs/langs/*`, `@shikijs/themes/*`).
- `node_modules/.pnpm/@sentry+node-core@10.49.0_.../node_modules/@sentry/node-core/package.json:110` — `"import-in-the-middle": "^3.0.0"`, confirming Sentry is ahead of our direct pin.
- `node_modules/.pnpm/import-in-the-middle@3.0.0/node_modules/import-in-the-middle/package.json` exists in the lockfile already (via Sentry), so the v3 bump won't introduce a new install.

## What We're NOT Doing

- **UI heavyweights.** `framer-motion 11→12` (rename to `motion`), `recharts 2→3` (API overhaul), `react-resizable-panels 2→4`, `streamdown 1→2`, `resend 4→6`, `fumadocs 16.6→16.7` (already reverted in Phase A due to breaking type changes) — Phase E.
- **AI runtime stack.** `ai 5→6`, `@ai-sdk/gateway 1→3`, `@ai-sdk/react 2→3`, `inngest 3→4`, `cohere-ai 7→8`, `@pinecone-database/pinecone 6→7`, `redis 4→5`, `@mixedbread/sdk 0.46→0.61` — Phase F. These are load-bearing for the triage runtime; each deserves its own verification surface.
- **TypeScript & Node types.** `typescript 5→6` (workspace-wide; new strict behaviors) and `@types/node 24→25` (surfaces new Node deprecations) — Phase G.
- **`path-to-regexp 6→8`, `lodash 4→5`, `undici 6→8`, `@types/minimatch 5→6`.** The deferred security-override majors from Phase B — own plan.
- **knip CI wiring.** Phase C declared `pnpm knip` a manual check. Wiring it into CI is out of scope for Phase D too.
- **Deprecated `@types/uuid` transitive.** Addressed here via the uuid 11→13 bump, not as a separate cleanup.
- **`lucide-react` DynamicIcon usage.** Not used in the repo today; if we needed it, the 1.6/1.7 bugs would be a blocker. This plan verifies non-use and does not adopt `DynamicIcon`.
- **Shiki v4 adoption of `@shikijs/primitive`.** New leaner alternative, not a removal. We stick with the bundled `shiki` package — same adoption pattern as today.
- **Joyful replacement.** `friendlyWords` has zero callers; delete rather than replace. No `unique-names-generator` / `moniker` / `project-name-generator` adoption.

## Implementation Approach

Eight commits, each independently revertible. Verification commands run after every commit. The risk ordering puts zero-impact hygiene first so bisect narrows quickly if a later phase regresses.

1. **Zero-impact hygiene** — tool bumps with no source surface (`hono` CVE, `knip`, `ultracite`, `vercel` CLI, Vercel observability 2.0, `joyful` deletion).
2. **Collapse `@vendor/lib` dead surface** — delete `errors.ts`, `uuid.ts`, `datetime/`, `pretty-project-name.ts`; drop matching subpath exports and `uuid`/`@types/uuid` deps. Runs before dep bumps so the subsequent uuid bump targets `core/ai-sdk` only.
3. **Drop-in CLI/type majors** — packages where every major bump is only a Node-20 drop or type-only change (`commander`, `open`, `ora`, `@inquirer/select`, `html2canvas-pro`, `@octokit/openapi-types`, `schema-dts`).
4. **API-change majors** — packages with small but real migration work (`uuid`/`@types/uuid`, `@noble/ed25519`, `jiti`, `dotenv-cli`).
5. **Sentry instrumentation alignment** — `import-in-the-middle 1→3`, `require-in-the-middle 7→8`; align with Sentry's internal peer.
6. **Arcjet + nosecone GA** — beta.10 → 1.4 across four packages.
7. **Shiki 4 ecosystem** — three packages in lockstep; target the highest 4.x with the types regression fix.
8. **lucide-react 1.x** — single package but 94 source files; icon audit required.

Phase 9 is the final verification gate; no code changes.

Each code phase ends with:

```bash
pnpm install
SKIP_ENV_VALIDATION=true pnpm typecheck
SKIP_ENV_VALIDATION=true pnpm test
pnpm knip --no-exit-code   # confirms no regressions from Phase C baseline
```

App-bump phases additionally run `pnpm build:app && pnpm build:platform && pnpm build:www`.

---

## Phase 1: Zero-Impact Hygiene

### Overview

Bump six tool/observability packages, clear the `hono` CVE, and delete `joyful`. No source-file surface changes. Expected lockfile diff is small — the Phase A/B/C floors already track most of what these bumps unlock.

### Changes Required:

#### 1. Bump `hono` catalog floor (CVE)

**File**: `pnpm-workspace.yaml`
**Changes**: Line 39 — raise `hono` catalog entry to clear `GHSA-458j-xx4x-4375`.

```yaml
# catalog:
  hono: ^4.12.14   # was ^4.12.5 — clears GHSA-458j-xx4x-4375 (hono/jsx SSR HTML injection)
```

#### 2. Bump `knip` 5 → 6

**File**: `package.json`
**Changes**: Line 47 — update the root devDep to knip 6.

```jsonc
"knip": "^6.4.1"   // was ^5.85.0 — Node 20 floor met; no config format change; removed CLI flags unused
```

#### 3. Bump `ultracite` 7.2.5 → 7.6.0

**File**: `package.json`
**Changes**: Line 51 — minor bump.

```jsonc
"ultracite": "7.6.0"   // was 7.2.5 — zero-config linting; root script uses npx ultracite@latest so bump is cosmetic
```

#### 4. Bump `vercel` CLI 50 → 51

**File**: `package.json`
**Changes**: Line 52 — root devDep.

```jsonc
"vercel": "^51.7.0"   // was ^50.28.0 — CLI only, invoked as `vercel link --repo` in scripts
```

#### 5. Bump `@vercel/analytics` 1 → 2 and `@vercel/speed-insights` 1 → 2

**File**: `vendor/analytics/package.json`
**Changes**: Lines 47-48 — both drop-in for Next.js; only the Nuxt subpath changed (not used here).

```jsonc
"@vercel/analytics": "^2.0.1",       // was ^1.6.1
"@vercel/speed-insights": "^2.0.0",  // was ^1.3.1
```

#### 6. Delete `joyful` and `friendly-words`

`vendor/lib/src/friendly-words.ts` has zero callers (verified by `rg 'friendlyWords|friendly-words' --type-not=markdown` outside the file itself).

**Action 1**: Delete file `vendor/lib/src/friendly-words.ts`.

**Action 2**: Edit `vendor/lib/package.json`:
- Remove lines 28-31 (the `./friendly-words` exports subpath).
- Remove line 40 (`"joyful": "^1.1.1"` from `dependencies`).

Resulting `exports` block should have six keys: `.`, `./pretty-project-name`, `./datetime`, `./uuid`, `./nanoid` (and no `./friendly-words`).

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `pnpm-lock.yaml` diff: `hono` version bumps in one place (`vendor/inngest`), `knip`/`ultracite`/`vercel`/`@vercel/analytics`/`@vercel/speed-insights` move forward, `joyful@1.1.1` disappears entirely
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52 turbo tasks)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (all suites)
- [x] `pnpm knip --no-exit-code` reports no new findings vs Phase C baseline (`friendly-words.ts` removed from tree, export map entry removed — knip won't complain)
- [x] `pnpm lint:ws` (sherif) reports no new issues
- [x] `pnpm audit --prod` no longer lists `GHSA-458j-xx4x-4375` (`hono <4.12.14`)

#### Manual Verification:

- [ ] `pnpm dev:full` boots all three apps; no new warnings in `/tmp/console-dev.log`
- [ ] Vercel Analytics beacon still fires on a page navigation (check browser Network tab for `/_vercel/insights/event`)
- [ ] `vercel link --repo` still works (don't re-link; just confirm CLI invocation succeeds with `--help`)

**Implementation Note**: After Phase 1 passes, commit and pause for human confirmation before Phase 2.

**2026-04-19 implementation finding:** The hono catalog bump alone did not clear `GHSA-458j-xx4x-4375` — `@hono/node-server@1.19.9` (transitive via `@modelcontextprotocol/sdk@1.29.0`, path `core/mcp`) was holding the old `hono@4.12.5` resolution even though its peer range is `^4`. Running `pnpm dedupe` after the catalog bump collapsed the duplicate and cleared the advisory. Audit went 44 → 35 (nine advisories dropped, including the target hono/jsx SSR one). Plan's precondition "catalog entry consumed only by `vendor/inngest`" was slightly off — the mcp-sdk path also transitively resolves hono.

---

## Phase 2: Collapse `@vendor/lib` dead surface [DONE]

### Overview

See standalone plan: `thoughts/shared/plans/2026-04-19-collapse-vendor-lib-to-nanoid.md`. Deletes four zero-consumer modules (`errors.ts`, `uuid.ts`, `datetime/`, `pretty-project-name.ts`), their re-exports, their subpath export entries, and the `uuid`/`@types/uuid` deps. `@vendor/lib` reduces to a `nanoid`-only vendor shim. Zero consumer edits — all 16 importers pull `nanoid` from the root barrel and are unaffected.

### Changes Required:

See the standalone plan. Summary: 6 file ops in `vendor/lib/` + 1 `package.json` trim.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds; lockfile diff drops `uuid@11.1.0` + `@types/uuid@10.0.0` from the `vendor/lib` subgraph with no other dep changes
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52 turbo tasks)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm knip --no-exit-code` reports no new findings vs the Phase D baseline
- [x] `pnpm lint:ws` reports no new issues
- [x] Repo-wide grep for `DomainError`, `isDomainError`, `DomainErrorOptions`, `formatMySqlDateTime`, `generatePrettyProjectName` returns hits only inside `thoughts/` docs

#### Manual Verification:

- [ ] `pnpm dev:full` boots all three apps; no new warnings in `/tmp/console-dev.log`
- [ ] Exercise any `nanoid()` code path (e.g. create a row that uses `db/app/src/schema/tables/org-entities.ts`'s nanoid default) — confirm unchanged behaviour

**Implementation Note**: After Phase 2 passes, commit and pause for human confirmation before Phase 3.

---

## Phase 3: Drop-in CLI/Type Majors

### Overview

Bump seven packages whose major bumps are either Node-20-drop or type-only changes. Node-20 floor is already met by `package.json:6` (`>=22.0.0`). Type-only bumps (schema-dts, @octokit/openapi-types) may surface compile errors — fix inline as discovered.

### Changes Required:

#### 1. CLI packages (`core/cli/package.json`)

**File**: `core/cli/package.json`
**Changes**: Lines 47, 49, 51, 52 (non-contiguous — lines 48 `@t3-oss/env-core` and 50 `eventsource-parser` are unrelated and stay as-is).

```jsonc
"@inquirer/select": "^5.1.3",   // line 47 — was ^4.0.0
"commander": "^14.0.3",         // line 49 — was ^13.1.0
"open": "^11.0.0",              // line 51 — was ^10.1.0
"ora": "^9.3.0"                 // line 52 — was ^8.1.1
```

All four affect `core/cli/src/bin.ts`, `core/cli/src/commands/listen.ts`, `core/cli/src/commands/login.ts`, `core/cli/src/commands/logout.ts`. No call-site changes expected; run `pnpm --filter @lightfastai/cli typecheck` to confirm.

#### 2. `html2canvas-pro` (`apps/www/package.json`)

**File**: `apps/www/package.json`
**Changes**: Line 53.

```jsonc
"html2canvas-pro": "^2.0.2"   // was ^1.6.6
```

Single call site: `apps/www/src/app/(app)/(internal)/pitch-deck/_lib/export-slides.ts:3`. The 2.0 changelog lists no API changes to the `html2canvas(el, options)` signature; architecture refactor only. Test the pitch-deck slide export manually.

#### 3. `@octokit/openapi-types` (`packages/app-octokit-github/package.json`)

**File**: `packages/app-octokit-github/package.json`
**Changes**: Line 23.

```jsonc
"@octokit/openapi-types": "^27.0.0"   // was ^26.0.0
```

Single import: `packages/app-octokit-github/src/index.ts:1`. Auto-generated types; `tsc --noEmit` will surface any narrowed response shapes. Fix inline.

#### 4. `schema-dts` (`vendor/seo/package.json`)

**File**: `vendor/seo/package.json`
**Changes**: Line 29.

```jsonc
"schema-dts": "^2.0.0"   // was ^1.1.5
```

Usage: `vendor/seo/src/json-ld.tsx:1,77`. Breaking: `Role` typings tightened, `Quantity` promoted to `DataType`, out-of-context class names now exported with escaped FQ IRIs. Likely zero impact since `json-ld.tsx` uses standard Schema.org types (`WebSite`, `Organization`, `Article`, etc.); confirm via typecheck.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm build:app`, `pnpm build:platform`, `pnpm build:www` all succeed
- [x] `pnpm --filter @lightfastai/cli typecheck` passes (explicit CLI check)

#### Manual Verification:

- [ ] `pnpm --filter @lightfastai/cli dev --help` prints command list correctly (commander 14)
- [ ] `pnpm --filter @lightfastai/cli dev login` renders interactive UI (inquirer/select 5 + ora 9)
- [ ] Pitch-deck slide export in `apps/www` successfully renders a PNG (html2canvas-pro 2)
- [ ] A page in `apps/www` that renders `JsonLd` via `vendor/seo` passes `rich results` tool check (schema-dts 2 types still valid)

**Implementation Note**: After Phase 3 passes, commit and pause for human confirmation before Phase 4.

---

## Phase 4: API-Change Majors

### Overview

Four packages across three sub-bumps with small but real migration work. All sub-bumps land in the same commit; if one regresses, the phase commit reverts the whole batch.

### Changes Required:

#### 1. `uuid 11 → 13` + `@types/uuid 10 → 11`

**File**: `core/ai-sdk/package.json`
**Changes**: Lines 81, 88.

```jsonc
"uuid": "^13.0.0",
"@types/uuid": "^11.0.0"
```

Call site (`core/ai-sdk/src/core/server/runtime.ts:8`) uses a standard named import — no code change needed. Runtime is Node 22+, browser WebCrypto path defaults are fine. `vendor/lib` no longer declares `uuid` after Phase 2.

#### 2. `@noble/ed25519 2 → 3`

**File**: `pnpm-workspace.yaml`
**Changes**: Line 18 — catalog entry.

```yaml
# catalog:
  '@noble/ed25519': ^3.1.0   # was ^2.2.3 — requires Uint8Array inputs, ed.hashes.* instead of ed.etc.sha512*
```

Single consumer: `packages/app-providers/src/runtime/verify/ed25519.ts:16-24`. All inputs are already `Uint8Array` (line 16 `_base64ToUint8Array`, line 18-21 `TextEncoder().encode`, line 23 `_base64ToUint8Array`). The `ed.verifyAsync(sigBytes, messageBytes, secretBytes)` signature is unchanged between 2.x and 3.x. No `ed.etc.sha512*` or hash injection pattern in use. Zero source-code changes.

#### 3. `jiti 1 → 2` (apps/www only)

**File**: `apps/www/package.json`
**Changes**: Line 79.

```jsonc
"jiti": "^2.6.1"   // was ^1.21.6
```

`jiti` is declared as a dev dep but has zero source imports (confirmed at `knip.json:16` — it's in `ignoreDependencies` for apps/www). It's consumed implicitly as a transitive loader. The v2 breaking changes (default export removed, `jiti.resolve` → `jiti.esmResolve`, `experimentalBun` → `tryNative`) matter only if the package is imported explicitly. Bumping is safe.

If a transitive consumer breaks, the lockfile will surface it — watch for errors during `pnpm install`.

#### 4. `dotenv-cli 8 → 11` (+ promote to catalog)

Seven workspace packages declare `dotenv-cli` directly as a devDep — `apps/app`, `apps/platform`, `apps/www`, `db/app`, `packages/app-test-data`, `packages/webhook-schemas`, `vendor/db`. Since we're editing every one of them anyway, promote to `catalog:` to prevent future drift.

**File**: `pnpm-workspace.yaml`
**Changes**: Add a new catalog entry alongside other dev tools.

```yaml
# catalog: (insert alphabetically)
  dotenv-cli: ^11.0.0
```

**Files**: 7 package.json files listed above.
**Changes**: Replace the existing version string with `"catalog:"`.

```jsonc
"dotenv-cli": "catalog:"   // was ^8.0.0 — promoted to catalog in this phase
```

Used only as the script prefix in the `with-env` pattern. v9 changed the default to quiet (no startup output); v10 changed variable-expansion ordering in `.env`. `.env` files in this repo are flat `KEY=value` lines (verified: zero `${VAR}` expansion hits across the workspace); no ordering-change exposure. Verify: `cd apps/app && pnpm with-env pnpm exec echo OK` — should print `OK` without extra dotenv logs.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (watch the ai-sdk runtime test — uses `uuid`)
- [x] `pnpm build:app`, `pnpm build:platform`, `pnpm build:www` all succeed
- [x] `pnpm list uuid -r --depth 0` shows `uuid@13.x` for `core/ai-sdk` with no leftover 11.x from transitive (`vendor/lib` no longer declares uuid after Phase 2)

#### Manual Verification:

- [ ] `cd apps/app && pnpm with-env pnpm exec echo OK` prints `OK` on a clean line (dotenv-cli 11)
- [ ] Trigger a webhook signature verify that goes through `packages/app-providers/src/runtime/verify/ed25519.ts` (Svix webhook or similar) — confirm verification succeeds
- [ ] `apps/www` dev server boots (jiti 2 loader works for env)
- [ ] Any route that calls `crypto.randomUUID` equivalent via `uuid.v4` returns a valid UUID

**Implementation Note**: After Phase 4 passes, commit and pause for human confirmation before Phase 5.

**2026-04-19 implementation finding:** The `@types/uuid 10 → 11` bump did not clear the deprecation warning — `@types/uuid@11.0.0` is itself marked deprecated because `uuid@10+` ships its own type definitions. The stub still typechecks cleanly; to actually clear the warning, a follow-up should delete `@types/uuid` entirely from `vendor/lib/package.json` and `core/ai-sdk/package.json`. Left in place for now to keep Phase 3 scoped. No other issues: `uuid@13.0.0` resolves in both workspaces, the ed25519 verify call typechecks against `@noble/ed25519@3.x`, jiti 2 bump caused no transitive breakage, and `dotenv-cli` catalog promotion flowed through all 7 consumers.

---

## Phase 5: Remove Dead IITM/RITM Pins

### Overview

The direct catalog pins for `import-in-the-middle` (`^1.8.1`) and `require-in-the-middle` (`^7.1.1`) are effectively dead weight: `@sentry/node-core@10.49.0` already declares `import-in-the-middle: ^3.0.0` as a dependency, so `pnpm` resolves 3.x for the Sentry subgraph regardless of our direct catalog value. Our own catalog entries only affect the direct consumer imports in `apps/app` and `apps/www` — and neither workspace actually imports these at source; they're re-exports to satisfy Next/Sentry instrumentation. Bumping catches the catalog up to the version the dependency tree already uses at runtime.

### Changes Required:

#### 1. Raise catalog floors

**File**: `pnpm-workspace.yaml`
**Changes**: Lines 40 (`import-in-the-middle`) and 46 (`require-in-the-middle`).

```yaml
# catalog:
  'import-in-the-middle': ^3.0.1    # was ^1.8.1 — aligns with @sentry/node-core ^3.0.0 peer
  'require-in-the-middle': ^8.0.1   # was ^7.1.1 — removes dependency on resolve npm module
```

Two workspace apps consume these through `catalog:`: `apps/app/package.json:97,99` and `apps/www/package.json:78,81`. The bump flows through the catalog — no direct `package.json` edits needed in the consumers.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] Lockfile diff: `import-in-the-middle@3.0.1` and `require-in-the-middle@8.0.1` are the sole direct resolutions for `apps/app` + `apps/www`. The residual `import-in-the-middle@1.15.0` / `require-in-the-middle@7.5.2` copies in the lockfile come from an unrelated subgraph (`@traceloop/instrumentation-anthropic@0.20.0` → `@opentelemetry/instrumentation@0.203.0` via `inngest@3.52.6`), not from any direct catalog pin; Sentry's `@sentry/node@10.49.0` subgraph now resolves to 3.0.1 / 8.0.1.
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm build:app` succeeds (webpack/turbopack — the `require-in-the-middle 7→8` resolve-module removal would break here if bundled)
- [x] `pnpm build:www` succeeds
- [x] `pnpm lint:ws` reports no new issues

#### Manual Verification:

- [ ] `pnpm dev:app` boots without instrumentation errors in `/tmp/console-dev.log`
- [ ] Trigger a handled Sentry error from a known route in `apps/app` → confirm the event reaches the Sentry dashboard (this exercises both IITM and RITM via `@sentry/nextjs`)
- [ ] Trigger the same from `apps/www` → confirm event reaches Sentry
- [ ] `pnpm dev:platform` boots (platform does not ship the IITM/RITM deps directly but shares the lockfile)

**Implementation Note**: After Phase 5 passes, commit and pause for human confirmation before Phase 6.

**2026-04-19 implementation finding:** Bumping the direct catalog floors successfully flowed through to `apps/app` and `apps/www` (both now resolve IITM 3.0.1 / RITM 8.0.1). `@sentry/node@10.49.0` also resolves to the new versions. However, the lockfile still carries `import-in-the-middle@1.15.0` and `require-in-the-middle@7.5.2` as transitives via `@traceloop/instrumentation-anthropic@0.20.0` → `@opentelemetry/instrumentation@0.203.0` → `inngest@3.52.6` (consumed by `api/app`, `api/platform`, `vendor/inngest`). Those older versions will only disappear when `inngest`/`@traceloop/instrumentation-anthropic` bump their internal `@opentelemetry/instrumentation` — out of scope for Phase D. The plan's "sole resolutions" wording was slightly optimistic; the direct-consumer goal was met.

---

## Phase 6: Arcjet + Nosecone GA [DONE]

### Overview

Move all four Arcjet-family packages from beta.10/beta.15 to their 1.4 stable releases. Public API between beta.10 and 1.4 introduced only two changes, neither of which affects this codebase (`ARCJET_BASE_URL` env override removed — unused; `experimental_detectPromptInjection → detectPromptInjection` — unused).

### Changes Required:

#### 1. Bump Arcjet + nosecone to 1.4

**File**: `vendor/security/package.json`
**Changes**: Line 36 (devDep `nosecone`), lines 40-42 (prod deps).

```jsonc
"nosecone": "^1.4.0",           // line 36 (devDep) — was "1.0.0-beta.15" (exact pin); GA transition
// ...
"@arcjet/decorate": "^1.4.0",   // line 40 — was "1.0.0-beta.10" (exact pin); GA transition
"@arcjet/next": "^1.4.0",       // line 41 — was "1.0.0-beta.10" (exact pin); GA transition
"@nosecone/next": "^1.4.0"      // line 42 — was "1.1.0" (exact pin); minor bump (already GA)
```

All four pins go from exact to caret — for the three beta→GA transitions that's load-bearing, for `@nosecone/next` it's stylistic consistency. (Confirm whether `nosecone` belongs in `devDependencies` vs `dependencies` in a follow-up — current classification predates this plan.)

#### 2. Verify no escape-hatch usage

Grep confirmations (should all return zero):

```bash
rg 'ARCJET_BASE_URL' apps packages vendor core
rg 'experimental_detectPromptInjection' apps packages vendor core
```

If either returns results, stop and migrate before bumping.

### Success Criteria:

#### Automated Verification:

- [x] Both grep commands return zero hits before the install runs
- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm build:app`, `pnpm build:platform`, `pnpm build:www` all succeed

#### Manual Verification:

- [ ] `pnpm dev:full` boots; visiting any Arcjet-gated route (rate-limited or bot-checked endpoint) returns the expected 200 on normal traffic
- [ ] CSP response headers (via `@nosecone/next` middleware) include the expected directives — check `curl -I http://localhost:3024/` for `content-security-policy`

**Implementation Note**: After Phase 6 passes, commit and pause for human confirmation before Phase 7.

---

## Phase 7: Shiki 4 Ecosystem [DONE]

### Overview

Bump `shiki`, `@shikijs/langs`, and `@shikijs/themes` from `^3.9.2` to the highest 4.x release that has the types regression (issue #1254) fixed. Target floor: `^4.0.2` or newer — verify at implementation time with `npm view shiki versions --json | tail -20`.

**This is a dedup, not a fresh install.** `shiki@4.0.2` and the matching `@shikijs/*@4.0.2` family are already in `pnpm-lock.yaml` (pulled transitively — see `pnpm-lock.yaml:12074`, `pnpm-lock.yaml:24173`). `shiki@3.13.0` also coexists because our direct pin is `^3.9.2`. Phase 7 removes the 3.x side of the duplicate — so the only real risk surface is whether our 6 direct consumer files typecheck against 4.x, not whether the ecosystem works.

### Changes Required:

#### 1. Bump shiki family

**File**: `packages/ui/package.json`
**Changes**: Lines 73, 74, 97.

```jsonc
"@shikijs/langs": "^4.0.2",     // line 73 — was ^3.9.2
"@shikijs/themes": "^4.0.2",    // line 74 — was ^3.9.2
// ...
"shiki": "^4.0.2"               // line 97 — was ^3.9.2
```

#### 2. Audit the six consumer files

Check for any call to a deprecated 3.x API. Target files:

- `packages/ui/src/components/ai-elements/code-block.tsx:3-19,30,35`
- `packages/ui/src/components/ai-elements/response.tsx:7`
- `packages/ui/src/components/markdown.tsx:9`
- `packages/ui/src/components/ssr-code-block/openai-dark-theme.ts:1`
- `packages/ui/src/components/ssr-code-block/index.tsx:2-17,21,59`
- `apps/www/src/app/(app)/(content)/_lib/api-page.tsx:16` — references `shikiOptions` config shape; no direct shiki import

The expected pattern is `createHighlighter` / `codeToHtml` / `bundledLanguages` / `bundledThemes` — all still supported in 4.x. The removed deprecations were internal API names rarely touched by integrators.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes — watch for any `shiki` type errors from the 4.0 types regression
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:www` succeeds (fumadocs uses shiki under the hood for doc code blocks)
- [x] `pnpm lint:ws` reports no new issues

#### Manual Verification:

- [ ] `pnpm dev:app` — any chat or MDX-rendering route with fenced code shows syntax-highlighted output
- [ ] `pnpm dev:www` — `/docs` page with fenced code shows syntax-highlighted output; switching between light/dark mode still swaps the theme
- [ ] SSR code block (`packages/ui/src/components/ssr-code-block/index.tsx`) renders correctly on a server-rendered page

**Implementation Note**: After Phase 7 passes, commit and pause for human confirmation before Phase 8.

**2026-04-19 implementation finding:** Shiki 4.x expanded the `BundledLanguage` union by 26 languages (bird, bird2, c3, cjs, and 22 more). `packages/ui/src/components/ai-elements/code-block.tsx:320` had `languageExtensionMap` typed as full `Record<BundledLanguage, string>`, which broke with `TS2740`. Access is already guarded with `language in languageExtensionMap`, so the safe fix is `Partial<Record<BundledLanguage, string>>` — no behavior change, unknown extensions still fall back to `"txt"`. Consumer files otherwise typecheck clean against 4.x; no `createHighlighter` / `codeToHtml` / `bundledLanguages` API regressions surfaced.

---

## Phase 8: lucide-react 1.x [DONE]

### Overview

Single-package bump. Plan preparation included a spike (2026-04-19) that tested the bump in an isolated worktree: catalog `^0.577.0` → `^1.8.0`, `pnpm install`, then filter-typecheck each consumer workspace. **Result:** exactly 3 removed brand icons in 2 files, both in `apps/www`. `packages/ui` and `apps/app` typecheck clean. No `Flip*` / `DynamicIcon` usage anywhere in the workspace. Blast radius is tightly scoped.

### Changes Required:

#### 1. Replace 3 brand-icon imports in `apps/www`

The following icons are removed in `lucide-react@1.x`. Each call site renders a small SVG, so inline SVG replacement is cheapest — avoids adding a new dependency (e.g. `@icons-pack/react-simple-icons`) for three icons.

**File**: `apps/www/src/app/(app)/_components/blog-social-share.tsx:4`

```tsx
// before
import { Link2, Linkedin, Twitter } from "lucide-react";
// after
import { Link2 } from "lucide-react";
// Replace <Linkedin /> and <Twitter /> usages with inline <svg>…</svg> at each call site (or small local components).
```

**File**: `apps/www/src/app/(app)/(content)/docs/(general)/[[...slug]]/_components/developer-platform-landing.tsx:8`

```tsx
// remove `Github,` from the lucide-react import list
// Replace <Github /> usages with inline <svg>…</svg> at each call site.
```

Inline SVGs should continue to use `currentColor` for fill/stroke so existing theme coloring keeps working.

#### 2. Bump the catalog entry

**File**: `pnpm-workspace.yaml`
**Changes**: Line 43.

```yaml
# catalog:
  lucide-react: ^1.8.0   # was ^0.577.0 — brand icons removed (see step 1)
```

Three workspace packages consume via `catalog:` and flow through automatically: `packages/ui/package.json:87`, `apps/www/package.json:56`, `apps/app/package.json:72`.

#### 3. Safety guard (one-time pre-commit check)

After editing, confirm no lingering removed-icon imports:

```bash
# Should return zero hits after step 1 edits.
rg -n "from ['\"]lucide-react['\"]" apps packages vendor -A 2 | \
  rg '\b(Github|Gitlab|Bitbucket|Twitter|Facebook|Instagram|Linkedin|Slack|Discord|Telegram|Whatsapp|Youtube|Figma|Notion|Trello|Spotify|Twitch|Dribbble|FlipHorizontal|FlipVertical|Flip2)\b'

# Should also return zero (no new DynamicIcon usage introduced).
rg 'DynamicIcon' apps packages vendor
```

### Success Criteria:

#### Automated Verification:

- [x] Step 3 guard greps return zero results (post-edit)
- [x] `pnpm install` succeeds
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes — TS catches any missed removed-icon reference
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:www` succeeds (only workspace requiring source edits in this phase)
- [x] `pnpm build:platform` succeeds (platform does not use lucide-react directly but shares lockfile)

#### Manual Verification:

- [ ] `pnpm dev:full` boots; dashboard renders in `apps/app` — sidebar icons, settings icons, buttons with icons all display
- [ ] `apps/www` marketing pages render without missing-icon fallbacks
- [ ] Spot-check one page per workspace for visual icon regressions (no bounding-box placeholders, no missing SVGs in console)
- [ ] Dark/light mode icon coloring unchanged (lucide uses `currentColor`, should be unaffected)

**Implementation Note**: After Phase 8 passes, commit and pause for human confirmation before Phase 9.

**2026-04-19 implementation finding:** Spike-predicted scope held — exactly 3 removed brand icons across 2 files, all in `apps/www`. Replaced `Twitter`/`Linkedin` inline in `blog-social-share.tsx` and `Github` in `developer-platform-landing.tsx` with local SVG components (simple-icons paths, `currentColor` fill, `SVGProps<SVGSVGElement>` typing). In `developer-platform-landing.tsx`, the `NavCard.icon` field was typed as `LucideIcon` — broadened to `ComponentType<SVGProps<SVGSVGElement>>` so both lucide icons and the local `GithubIcon` satisfy it. No other workspace required edits; `packages/ui` and `apps/app` typecheck clean against `lucide-react@^1.8.0`. Sherif, typecheck, tests, and builds (app + www + platform) all pass.

---

## Phase 9: Final Verification & Audit Snapshot [DONE]

### Overview

No code changes. Full workspace verification + dev smoke test + `pnpm audit --prod` snapshot recorded in the PR body.

### Changes Required:

No file changes.

#### 1. Full workspace verification

```bash
pnpm install
SKIP_ENV_VALIDATION=true pnpm typecheck
SKIP_ENV_VALIDATION=true pnpm test
pnpm build:app
pnpm build:platform
pnpm build:www
pnpm lint:ws
pnpm knip --no-exit-code
pnpm audit --prod || true    # exit non-zero OK if residuals from deferred-major deps remain
```

#### 2. Dev server smoke test

```bash
pnpm dev:full > /tmp/console-dev.log 2>&1 &
# wait ~20s, then:
tail -100 /tmp/console-dev.log

# Visit:
#   http://localhost:3024             (app via microfrontends)
#   http://localhost:3024/docs        (www via microfrontends; exercises shiki + fumadocs)
#   http://localhost:3024/sign-in     (app auth; exercises nosecone CSP headers)
#   http://localhost:4112             (platform direct)

# Trigger a handled Sentry error, confirm it reaches the Sentry dashboard
# Exercise one Arcjet-gated endpoint (bot or rate-limit) on expected-pass traffic

pkill -f "next dev"
```

#### 3. Lockfile + audit review

- Confirm lockfile diff contains only the deps touched across Phases 1-7
- Confirm `pnpm audit --prod` output is at-or-below the Phase B baseline (44 advisories, minus at minimum the `hono` moderate)
- Record the new audit severity breakdown in the PR body for future reference

### Success Criteria:

#### Automated Verification:

- [x] All Phase 1-8 automated checks still pass with the final combined lockfile
- [x] `pnpm audit --prod` total ≤ 43 (one advisory cleared via hono CVE bump)

#### Manual Verification:

- [ ] Dev smoke test: all four URLs render without errors
- [ ] Browser console clean on app home, docs home, sign-in
- [ ] No hydration errors, no 4xx/5xx from tRPC or webhook endpoints
- [ ] Sentry event from trigger reaches the Sentry dashboard
- [ ] Arcjet-gated endpoint passes on expected-good traffic (no 403)
- [ ] CSP headers on `/` include expected directives (nosecone 1.4)

**Implementation Note**: Once Phase 9 passes, Phase D is complete. Phase E (UI heavyweights) opens next; Phase F (AI runtime) and Phase G (typescript 5→6, @types/node 24→25) follow.

**2026-04-19 implementation finding:** Full workspace gate passes end-to-end on the combined Phase D.1–D.8 lockfile: install, typecheck (53/53), test (12/12), build:app + build:platform + build:www, `pnpm lint:ws`, `pnpm knip --no-exit-code` all green with no new findings beyond the known baseline (2 unused deps, 1 unused devDep, 9 unused exports, 7 unused exported types, 2 config hints in `.agents`/`.claude` — all pre-existing). `pnpm audit --prod` reports **31 vulnerabilities** (1 low, 15 moderate, 12 high, 3 critical) — down from the Phase B baseline of **44**, a drop of 13. `GHSA-458j-xx4x-4375` (hono/jsx SSR HTML injection) is no longer present. Manual dev-server smoke test deferred.

---

## Testing Strategy

### Unit Tests:

- `pnpm test` after each phase. The highest-risk behavior change is Phase 4 (uuid ESM-only + @noble/ed25519 input typing) — watch the ai-sdk runtime test and any webhook-verification test.

### Integration Tests:

- tRPC prefetch-then-hydrate flow (exercised by any `pnpm dev:app` dashboard visit) — probes the IITM/RITM path via Sentry's instrumentation.
- Clerk auth flow — exercises nosecone CSP headers after Phase 6.
- Fumadocs `/docs` rendering — exercises shiki code block highlighting after Phase 7.
- Icon rendering across `apps/app`, `apps/www`, `packages/ui` surfaces — exercises lucide-react 1.x after Phase 8.

### Manual Testing Steps:

1. `pnpm dev:full` and load `http://localhost:3024` — confirm home renders.
2. Navigate to `/sign-in` — confirm Clerk UI renders with expected CSP headers.
3. Navigate to `/docs` — confirm Fumadocs loads, MDX code blocks syntax-highlight in both themes.
4. Open browser dev tools — confirm no hydration errors, no 4xx/5xx, no missing-icon bounding boxes.
5. Trigger a handled Sentry error (e.g., from a known error route) — confirm it reaches the Sentry dashboard.
6. Pitch-deck slide export in `apps/www` successfully generates a PNG.
7. CLI smoke: `cd core/cli && pnpm dev --help` prints expected command list; `pnpm dev login` renders interactive prompt.

## Performance Considerations

No expected performance regressions. `knip 6` claims 2-4× faster analysis via oxc-parser — should make `pnpm knip` snappier. `shiki 4` internally introduced `@shikijs/primitive` as a leaner option but we're not adopting it; behavior should be identical. `lucide-react 1.x` bundle size should be equal or smaller (tree-shaking improvements in the 0.9x → 1.0 transition).

## Migration Notes

No data migrations. No schema changes. Rollback per phase is `git revert <commit>` + `pnpm install`. Because each phase is independently revertible and mostly additive-or-zero-change, bisect down to a single commit if a regression surfaces weeks later.

## References

- Phase A plan (patch/minor sweep, merged): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-a.md`
- Phase B plan (overrides audit, merged): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-b.md`
- Phase C plan (knip cleanup, in progress): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-c.md`
- Sentry peer alignment evidence: `node_modules/.pnpm/@sentry+node-core@10.49.0_.../node_modules/@sentry/node-core/package.json:110` — `"import-in-the-middle": "^3.0.0"`
- joyful deletion rationale: `vendor/lib/src/friendly-words.ts:1` (single-line re-export), zero workspace callers
- Arcjet API-surface audit: `vendor/security/src/index.ts:5-23` (no `experimental_detectPromptInjection`, no `ARCJET_BASE_URL`)
- ed25519 input-type safety: `packages/app-providers/src/runtime/verify/ed25519.ts:16-24` (all `Uint8Array` inputs)
- Deferred follow-ups:
  - **Phase E (UI heavyweights)**: `framer-motion 11→12`, `recharts 2→3`, `react-resizable-panels 2→4`, `streamdown 1→2`, `resend 4→6`, `fumadocs 16.6→16.7`
  - **Phase F (AI runtime)**: `ai 5→6`, `@ai-sdk/gateway 1→3`, `@ai-sdk/react 2→3`, `inngest 3→4`, `cohere-ai 7→8`, `@pinecone-database/pinecone 6→7`, `redis 4→5`, `@mixedbread/sdk 0.46→0.61`
  - **Phase G (TS & Node)**: `typescript 5→6`, `@types/node 24→25`
  - Deferred security-override majors (from Phase B): `path-to-regexp 6→8`, `undici 6→8`, `lodash 4→5`, `@types/minimatch 5→6`

---

## Improvement Log

### 2026-04-19 — Adversarial review (`/improve_plan`)

**Spike run:** lucide-react `^0.577.0 → ^1.8.0` in isolated worktree. Verdict: **REFUTED-PARTIAL**. Prior grep claimed zero brand-icon usage; spike-validator's typecheck surfaced 3 actual removed imports (`Github`, `Linkedin`, `Twitter`) across 2 files in `apps/www`. `packages/ui` and `apps/app` typecheck clean. Phase 7 did not collapse to a one-liner, but shrank to a tightly-scoped 2-file edit.

**Changes applied:**

1. **Current State Analysis:** Added explicit precondition that Phase C must merge to `main` before Phase D starts (Phase C was on branch, not merged, at time of writing).
2. **Phase 6 (shiki) framing:** Called out that `shiki@4.0.2` is already in the lockfile (transitive from fumadocs); the bump is a dedup, not a fresh install. Risk surface is our 6 direct consumers, not the wider ecosystem.
3. **Phase 7 (lucide-react) rewrite:** Replaced the speculative workspace-wide audit + remediation block with spike-grounded instructions — name the 2 files + 3 icons, inline-SVG replacement guidance, and demote the grep to a pre-commit safety guard (no remediation flow).
4. **Phase 4 (IITM/RITM) framing:** Reframed from "align with Sentry peer" to "remove dead direct pins" — `@sentry/node-core@10.49.0` brings `import-in-the-middle@3.0.0` at install time already, so the `^1.15.0` direct catalog was never in effect for Sentry's subgraph.
5. **Phase 5 (Arcjet/nosecone):** Clarified that `@nosecone/next` is already at `1.1.0` (GA); its bump is a minor, not a beta→GA transition. Flagged that `nosecone` sits in `devDependencies` (line 36) for a future classification review.
6. **Phase 3 dotenv-cli:** Added catalog promotion — while editing all 7 package.json files, the version string moves to `"catalog:"` and a new `pnpm-workspace.yaml` catalog entry is added. Same diff size, eliminates future drift.
7. **Line-number corrections:**
   - `pnpm-workspace.yaml`: `hono` 40→39, `import-in-the-middle` 41→40, `lucide-react` 44→43, `require-in-the-middle` 48→46; noted `@noble/ed25519` at line 18.
   - `core/cli/package.json`: lines 47-52 → explicit lines 47, 49, 51, 52 (48/50 are unrelated deps).
   - `vendor/security/package.json`: labeled `nosecone` at line 36 as devDep.
   - `packages/ui/package.json`: explicit shiki lines 73/74/97.
8. **Apps catalog clarification:** `import-in-the-middle` and `require-in-the-middle` in `apps/app`/`apps/www` are `catalog:` references, not direct version pins — corrected the wording in Key Discoveries.

**Items intentionally not changed:**

- Phase C merge precondition is documented as a note, not resolved by rebasing onto the Phase C branch. Merging Phase C first is cleaner than stacking.
- Phase 1 items (hygiene bumps) not reorganized — the per-bump sections keep the phase bisect-friendly.
- `nosecone` dependency classification (dev vs prod) flagged for follow-up, not fixed in this plan.
