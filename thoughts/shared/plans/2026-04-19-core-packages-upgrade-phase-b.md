# Core Packages Upgrade — Phase B (pnpm.overrides Audit) Implementation Plan

## Overview

Audit and clean up the `pnpm.overrides` block in the root `package.json`. Six overrides are dead weight (phantom / no-op / caret-already-past-pin) and can be removed. Six are load-bearing security pins, each with one or more published CVEs fixed in a patch release within the current major — bump them forward within the same major. Four are kept as-is (React/types control, `@opentelemetry/api` dedup, `path-to-regexp` major-gated). No major-version bumps in this phase.

> **Implementation note (2026-04-19):** The original draft classified `fast-xml-parser ^5.3.8` as dormant on the assumption that the caret resolved naturally. Verification on the live lockfile showed the override is load-bearing — `@aws-sdk/xml-builder` (via `cohere-ai>@aws-sdk/client-sagemaker>@aws-sdk/core`) declares `~5.2.5`, which without the override falls below the patched floor for four published advisories (one critical). Reclassified as a security pin and moved to Phase 2 with a bump to `^5.5.6`.

The `zod 4` item originally earmarked for Phase B is already resolved: the catalog is at `^4.0.0` resolving to `4.3.6` across the workspace, and the `zod-to-json-schema>zod ^3.25.76` override is confirmed phantom (see audit below).

## Current State Analysis

The `pnpm.overrides` block in `package.json:54-74` currently contains 18 entries accumulated across several security fix-ups and the Phase 3 `@opentelemetry/api` dedup. Three distinct classes of problem live there:

1. **Phantom overrides.** `zod-to-json-schema>zod ^3.25.76` targets a sub-dep that doesn't exist: `zod-to-json-schema@3.25.1` declares `zod` as a **peer** dep, not a direct dep, and resolves to the catalog `zod@4.3.6` in both consumer paths (`@ai-sdk/provider-utils@3.0.3` and `@modelcontextprotocol/sdk@1.29.0`). The override has no effect. `@types/minimatch 5.1.2` isn't in the lockfile at all — nothing depends on it. `mdast-util-to-hast ^13.2.1` pins a version that equals the latest published — no-op.

2. **Dormant overrides where the caret has caught up.** `qs ^6.14.2` now resolves `6.15.0` naturally, `body-parser ^2.2.1` resolves `2.2.2`, `cookie ^1.0.2` has no known CVEs and either floats forward (orpc>cookie@1.1.1) or back to the consumer's declared range (express>cookie@0.7.2 — also CVE-clean). In each case removing the override either doesn't change the resolution or lets it float to a non-vulnerable version. (`fast-xml-parser` was originally listed here but is reclassified — see class 3 and the implementation note above.)

3. **At-floor security pins with CVEs fixed upstream.** Six pins sit at the vulnerable version or one patch above, while fixed versions are available within the same major:
   - `undici ^6.23.0` (resolves `6.23.0`) — 3 advisories fixed in `6.24.0`; latest 6.x is `6.25.0`.
   - `tar ^7.5.8` (resolves `7.5.9`) — 2 path-traversal advisories fixed in `7.5.10`+; latest 7.x is `7.5.13`.
   - `basic-ftp ^5.2.0` (resolves `5.2.0`) — 3 advisories fixed across `5.2.1` → `5.3.0`.
   - `lodash ^4.17.23` (resolves `4.17.23`) — 2 prototype-pollution advisories fixed in `4.17.24`+; latest 4.x is `4.18.1`.
   - `lodash-es ^4.17.23` (resolves `4.17.23`) — same two advisories, same fix, latest `4.18.1`.
   - `fast-xml-parser ^5.3.8` (the `aws-sdk/xml-builder` consumer chain otherwise drops to `5.2.5`) — 4 advisories visible across `5.3.4`, `5.3.5`, `5.3.8`, and `5.5.6` patched floors; bump to `^5.5.6`.

The remaining four pins stay: `react / react-dom / @types/react / @types/react-dom` encode the project's deliberate React 19 major choice; `@opentelemetry/api 1.9.1` collapses a two-module-instances split introduced by `drizzle-orm@0.45.2` peer flavors (see Phase A plan line 317) — confirmed still at `1.9.1` in the lockfile; `path-to-regexp ^6.3.0` is intentionally gated below the 6→8 major and belongs with the deferred majors plan.

## Desired End State

- `pnpm.overrides` contains exactly 12 entries (down from 18): the 4 React-family pins, `@opentelemetry/api`, `path-to-regexp`, and 6 security pins bumped to the latest patch within their current major.
- `pnpm audit --prod` advisory count drops vs baseline (no new high/critical advisories introduced; `fast-xml-parser`/`undici`/`tar`/`lodash`/`lodash-es`/`basic-ftp` advisories are cleared).
- `pnpm-lock.yaml` shows the 6 bumped packages resolving at their new floors; the 6 removed overrides either resolve identically (no-op) or float to a non-vulnerable version (`cookie` may split per consumer).
- `pnpm install && pnpm typecheck && pnpm test && pnpm build:app && pnpm build:platform && pnpm build:www` pass.
- Dev servers (`pnpm dev:app`, `pnpm dev:www`, `pnpm dev:platform`) start and render without regression.

### Key Discoveries:

- `package.json:62` — `zod-to-json-schema>zod ^3.25.76` has no effect: `zod-to-json-schema@3.25.1` declares `zod` as peer, both consumers resolve `zod@4.3.6` from the catalog. Lockfile confirms: `zod-to-json-schema: 3.25.1(zod@4.3.6)`.
- `package.json:60` — `@types/minimatch 5.1.2` is not present in `pnpm-lock.yaml` (no transitive consumer).
- `package.json:69` — `mdast-util-to-hast ^13.2.1` pins the latest published version; override is a no-op.
- `package.json:70-73` — `qs`/`body-parser`/`fast-xml-parser`/`cookie`: resolved versions are already at-or-past the pinned floor without the override.
- `package.json:63-68` — `tar`/`basic-ftp`/`undici`/`lodash`/`lodash-es`: stuck at or near the vulnerable version; `pnpm audit` surfaces advisories that a within-major patch bump clears.
- `package.json:61` — `@opentelemetry/api 1.9.1` remains required (drizzle-orm peer split, Phase A plan line 317). Keep as-is.
- Catalog `zod: ^4.0.0` already loosened from the exact `4.0.0` the Phase A doc referenced; resolving to `4.3.6` in all 20+ workspace packages via `pnpm list zod --depth=0 -r`.

## What We're NOT Doing

- **Major-version bumps.** Deferred: `undici 6→8`, `path-to-regexp 6→8`, `lodash 4→5`, `@types/minimatch 5→6`. All belong with the deferred-majors plan.
- **Adding new overrides.** No new pins. If a new advisory surfaces during implementation, note it and defer the fix to its own change.
- **Dependency version bumps outside the overrides block.** Catalog entries, workspace package.json deps, and direct-versioned deps are untouched. Phase A closed those.
- **zod catalog changes.** Already at `^4.0.0` → `4.3.6`. Nothing to do.
- **Documenting overrides in a sibling file.** `package.json` is JSON (no comments). The rationale for each kept pin lives in this plan + commit messages + git blame. No `docs/pnpm-overrides.md` file.
- **`@opentelemetry/api` reconsideration.** Stay at `1.9.1`. If drizzle-orm peer range changes in a future bump, revisit then.

## Implementation Approach

Three phases, one commit each, merged between so bisect stays useful:

1. **Prune dead overrides** — remove 7 no-op/dormant entries. Expected lockfile diff is small: a couple of transitive deps float forward by one patch.
2. **Bump security-pin floors** — 5 overrides, CVE fixes only, within-major.
3. **Verify** — full workspace build + dev smoke test + `pnpm audit` snapshot for posterity.

Each phase ends with `pnpm install`, then the phase-specific verification.

---

## Phase 1: Prune Dead Overrides

### Overview

Remove six overrides that have no effect or are strictly dominated by the caret, and bump `fast-xml-parser` from `^5.3.8` to `^5.5.6` (now classified as a security pin). The goal is a reviewable lockfile diff: no version changes, forward floats for `cookie` (per-consumer split, all CVE-clean), and `fast-xml-parser` consolidated upward in both consumer chains.

### Changes Required:

#### 1. Remove phantom and dormant entries from `pnpm.overrides`, bump `fast-xml-parser`

**File**: `package.json`
**Changes**: Delete the six lines below from the `pnpm.overrides` block, and update `fast-xml-parser` from `^5.3.8` to `^5.5.6`. Preserve trailing-comma JSON validity.

```jsonc
// REMOVE these entries from "pnpm.overrides":
"@types/minimatch": "5.1.2",           // not in lockfile, no consumer
"zod-to-json-schema>zod": "^3.25.76",  // zod-to-json-schema declares zod as peer; override has no effect
"cookie": "^1.0.2",                     // no known CVEs; resolved 1.0.2 matches latest 1.0.x
"mdast-util-to-hast": "^13.2.1",       // pin equals latest; no-op
"qs": "^6.14.2",                        // caret already resolves 6.15.0 naturally
"body-parser": "^2.2.1",                // caret already resolves 2.2.2 naturally

// UPDATE in place (load-bearing — aws-sdk consumer asks for ~5.2.5 and would regress):
"fast-xml-parser": "^5.3.8" → "^5.5.6"  // clears GHSA chain through 5.5.6 patched floor
```

After removal + bump, the `pnpm.overrides` block should contain exactly 12 entries:

```jsonc
"pnpm": {
  "overrides": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@opentelemetry/api": "1.9.1",
    "tar": "^7.5.8",
    "basic-ftp": "^5.2.0",
    "undici": "^6.23.0",
    "lodash": "^4.17.23",
    "lodash-es": "^4.17.23",
    "path-to-regexp": "^6.3.0",
    "fast-xml-parser": "^5.5.6"
  }
}
```

(Phase 2 updates the remaining five security-pin values in place.)

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds with no errors
- [x] Lockfile diff: `cookie` splits per-consumer (express→0.7.2, orpc→1.1.1; both CVE-clean); `fast-xml-parser` consolidates from 5.4.1 → 5.7.1 (one resolved version, both consumer chains satisfied via the new `^5.5.6` floor); `qs`, `body-parser`, `mdast-util-to-hast` resolutions unchanged; `@types/minimatch` not present in lockfile; `zod-to-json-schema` peer constraint relaxes from `^3.25.76` → `^3.25 || ^4` with no resolution change.
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes (52 turbo tasks)
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (11 turbo tasks)
- [x] `pnpm lint:ws` (sherif) reports no new issues

#### Manual Verification:

- [x] `pnpm audit --prod` baseline 57 → post 55 (-2 advisories: 1 low | 29 moderate | 22 high | 3 critical). The `^5.5.6` `fast-xml-parser` floor cleared two extra advisories beyond the baseline.
- [x] Spot-check via `pnpm why zod-to-json-schema` that `zod-to-json-schema@3.25.1` still resolves a single version (confirmed: 1 version found across `@ai-sdk/provider-utils@3.0.3` and `@modelcontextprotocol/sdk@1.29.0`, all using `zod@4.3.6` from the catalog).

**Implementation Note**: After Phase 1 passes automated + manual verification, commit and pause for human confirmation before starting Phase 2.

---

## Phase 2: Bump Security-Pin Floors (Within Major)

### Overview

Raise the five stuck security-pin floors to the latest patch within the current major. Each bump clears one or more published advisories. No major-version changes — those stay deferred.

### Changes Required:

#### 1. Bump CVE-affected overrides to latest within major

**File**: `package.json`
**Changes**: Update the five values in `pnpm.overrides`. Keep carets so future patches inside the same major flow through without another override edit.

```jsonc
// Before → After
"undici":     "^6.23.0" → "^6.25.0"   // clears GHSA-f269-vfmq-vjvj, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8
"tar":        "^7.5.8"  → "^7.5.13"   // clears GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256
"basic-ftp":  "^5.2.0"  → "^5.3.0"    // clears GHSA-6v7q-wjvx-w8wg + FTP Command Injection + DoS
"lodash":     "^4.17.23" → "^4.18.1"  // clears GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh (prototype pollution)
"lodash-es":  "^4.17.23" → "^4.18.1"  // same two advisories as lodash
```

Final `pnpm.overrides` block after Phase 2:

```jsonc
"pnpm": {
  "overrides": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@opentelemetry/api": "1.9.1",
    "tar": "^7.5.13",
    "basic-ftp": "^5.3.0",
    "undici": "^6.25.0",
    "lodash": "^4.18.1",
    "lodash-es": "^4.18.1",
    "path-to-regexp": "^6.3.0",
    "fast-xml-parser": "^5.5.6"
  }
}
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` succeeds
- [x] Lockfile diff shows the five target packages resolving at their new versions (`undici@6.25.0`, `tar@7.5.13`, `basic-ftp@5.3.0`, `lodash@4.18.1`, `lodash-es@4.18.1`)
- [x] `SKIP_ENV_VALIDATION=true pnpm typecheck` passes
- [x] `SKIP_ENV_VALIDATION=true pnpm test` passes (444 tests)
- [x] `pnpm build:app` succeeds
- [x] `pnpm build:platform` succeeds
- [x] `pnpm build:www` succeeds
- [x] `pnpm lint:ws` reports no new issues

#### Manual Verification:

- [x] `pnpm audit --prod` advisory count for `undici`, `tar`, `basic-ftp`, `lodash`, `lodash-es` drops to zero high/critical (residuals may remain from other packages — note and defer)
- [x] tRPC: prefetch-then-hydrate flow works on app dashboard (undici is transitive via `vercel>@vercel/blob>undici`; a fetch-layer regression would show up here)
- [x] Vercel Blob / CLI operations still work if exercised (path: `vercel` → `undici`, `vercel` → `basic-ftp`)
- [x] Recharts-rendered pages in `packages/ui` still load (`lodash` path: `packages/ui>recharts>lodash`)
- [x] Fumadocs pages render (`lodash-es` path: `packages/ui>streamdown>mermaid>lodash-es`)
- [x] No new runtime warnings in dev server console

**Implementation Note**: After Phase 2 passes, commit and pause for human confirmation before Phase 3.

---

## Phase 3: Final Verification

### Overview

No code changes. Full workspace verification + dev smoke test + a final `pnpm audit` snapshot recorded in the commit message for future reference.

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
pnpm audit --prod || true   # record output in commit body; exit code non-zero is OK if residuals are from deferred-major deps
```

#### 2. Dev server smoke test

```bash
pnpm dev:full > /tmp/console-dev.log 2>&1 &
# wait ~20s, then:
tail -100 /tmp/console-dev.log
# visit:
#   http://localhost:3024             (app via microfrontends)
#   http://localhost:3024/docs        (www via microfrontends)
#   http://localhost:3024/sign-in     (app auth)
#   http://localhost:4112             (platform direct)
# then:
pkill -f "next dev"
```

#### 3. Lockfile review

```bash
git diff pnpm-lock.yaml | head -200
# Confirm:
#  - Five security-pin packages at new versions
#  - Removed overrides: no transitive regressions, at most one-patch floats for cookie/qs/body-parser/fast-xml-parser
#  - No surprise unrelated upgrades
```

### Success Criteria:

#### Automated Verification:

- [ ] All Phase 1 + Phase 2 automated checks still pass (full turbo cache hit expected — nothing invalidated)
- [ ] `pnpm audit --prod` output attached to the merge PR body for traceability

#### Manual Verification:

- [ ] Dev smoke test: all four URLs render without errors
- [ ] Browser console clean on app home, docs home, sign-in
- [ ] No hydration errors, no 4xx/5xx from tRPC or webhook endpoints
- [ ] Trigger one handled Sentry error and confirm it reaches the Sentry project

**Implementation Note**: Once Phase 3 passes, Phase B is complete. The remaining core-packages work is the deferred-majors plan (`ai 5→6`, `@ai-sdk/* *→latest`, `inngest 3→4`, `typescript 5→6`, etc.) — open that as a separate planning effort when prioritized.

---

## Testing Strategy

### Unit Tests:

- `pnpm test` after each phase. The `lodash`/`lodash-es` bumps are the likeliest to surface test-visible behavior differences (prototype-pollution fixes can subtly change `_.merge` / `_.set` semantics). Watch `packages/ui` tests and any packages that consume recharts/streamdown.

### Integration Tests:

- tRPC prefetch-hydrate flow (exercised implicitly by any `pnpm dev:app` dashboard visit; undici sits under the fetch layer).
- Clerk auth flow (cookie changes would bubble here — `cookie` is being removed from overrides).
- Fumadocs `/docs` rendering (`lodash-es` via mermaid).

### Manual Testing Steps:

1. `pnpm dev:full` and load `http://localhost:3024` — confirm home renders.
2. Navigate to `/sign-in` — confirm Clerk UI renders and sign-in completes.
3. Navigate to `/docs` — confirm Fumadocs loads, left nav populates, MDX code blocks render.
4. Open browser dev tools, confirm no hydration errors and no 4xx/5xx from tRPC or webhook endpoints.
5. Trigger a handled Sentry error and confirm it reaches the Sentry dashboard.

## Performance Considerations

No expected performance impact. All changes are within-major patch bumps or removals of overrides that were already no-op. If `undici` 6.24→6.25 or `lodash` 4.17→4.18 ships a behavioral regression, it would appear as a dev-server or test runner change — caught by Phase 3 smoke test.

## Migration Notes

No data migrations. No schema changes. Rollback per phase is `git revert <commit>` + `pnpm install`.

## References

- Phase A plan (predecessor): `thoughts/shared/plans/2026-04-19-core-packages-upgrade-phase-a.md`
- Source of overrides state: `package.json:54-74`
- Lockfile evidence: `pnpm-lock.yaml` (`zod-to-json-schema@3.25.1(zod@4.3.6)`; security pins at floor)
- CVE references:
  - `undici`: GHSA-f269-vfmq-vjvj, GHSA-vrm6-8vpv-qv8q, GHSA-v9p9-hfj2-hcw8
  - `tar`: GHSA-qffp-2rhf-9h96, GHSA-9ppj-qmqm-q256
  - `basic-ftp`: GHSA-6v7q-wjvx-w8wg
  - `lodash` / `lodash-es`: GHSA-r5fr-rjxr-66jc, GHSA-f23m-r3pf-42rh
- Deferred follow-ups (next plan): `undici 6→8`, `path-to-regexp 6→8`, `lodash 4→5`, `@types/minimatch 5→6`, plus the deferred-majors list from Phase A (`ai`, `@ai-sdk/*`, `inngest`, `typescript`, `framer-motion`, …).
