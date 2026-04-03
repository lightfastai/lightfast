---
date: 2026-04-03T00:00:00+00:00
researcher: claude
git_commit: 34f5b76837648856dc476b8f947679021f7a6679
branch: chore/remove-memory-api-key-service-auth
repository: lightfast
topic: "pnpm workspace config audit — .npmrc, turbo.json, pnpm-workspace.yaml, package.json overrides"
tags: [research, codebase, pnpm, turbo, monorepo, dependencies, cleanup]
status: complete
last_updated: 2026-04-03
---

# Research: pnpm Workspace Config Audit

**Date**: 2026-04-03
**Git Commit**: 34f5b76837648856dc476b8f947679021f7a6679
**Branch**: chore/remove-memory-api-key-service-auth

## Research Question

Investigate `.npmrc`, `turbo.json`, `pnpm-workspace.yaml`, and root `package.json` overrides — why they have `ignoredBuiltDependencies`, `onlyBuiltDependencies`, and extensive `pnpm.overrides` — and identify what can be cleaned up.

## Summary

The workspace config had accumulated several layers of stale entries over time. A `catalog:react19` catalog was accidentally dropped in commit `6012e7ce7` when React versions were bumped and moved to `pnpm.overrides`, but the 12 `package.json` references to it were never cleaned up — leaving the lockfile technically stale (it works under `--frozen-lockfile` but would fail on a fresh `pnpm install`). Five security-patch overrides exist only in the lockfile's `overrides:` block with no resolved packages, the stagehand package was removed from the repo but left its override behind, `.npmrc` contains two pnpm defaults (network-concurrency=16 and package-import-method=auto), and `linkWorkspacePackages` was set in both `.npmrc` and `pnpm-workspace.yaml`.

**All issues were cleaned up in this session.**

## Detailed Findings

### 1. `ignoredBuiltDependencies` vs `onlyBuiltDependencies` — Design Intent

**How it works:**
- `onlyBuiltDependencies` is a **whitelist**: pnpm runs lifecycle scripts ONLY for packages explicitly listed here. All others are blocked.
- `ignoredBuiltDependencies` suppresses the warning pnpm would otherwise emit for packages with lifecycle scripts that are NOT in the whitelist.
- Packages in BOTH lists: their lifecycle scripts are silenced without warning.

**The 6 packages in both lists** (bufferutil, core-js, core-js-pure, esbuild, protobufjs, sharp) are all purely transitive deps with no direct declarations in any workspace `package.json`. They arrive as:
- `bufferutil` → optional peer of `ws` (ws@7/8), itself pulled by socket.io, jsdom, @libsql/client
- `core-js` → `posthog-js`, `jspdf` (optional), `canvg`
- `core-js-pure` → Babel transform ecosystem
- `esbuild` → Vite, tsx, drizzle-kit, tailwindcss (429 lockfile occurrences)
- `protobufjs` → `@grpc/proto-loader` → `@opentelemetry/*` → `@sentry/nextjs`, `inngest`, Next.js
- `sharp` → optional dep of `next@16.2.1`

**The 5 packages in `onlyBuiltDependencies` only** (those that actually run scripts):
- `@clerk/shared` — direct dep of `vendor/clerk/package.json:45`, runs postinstall to generate runtime artifacts
- `@sentry/cli` — transitive via `@sentry/bundler-plugin-core` → `@sentry/nextjs`, downloads platform binary
- `@tailwindcss/oxide` — transitive via `@tailwindcss/postcss@4.2.1`, Rust/WASM native binary for Tailwind v4
- `@vercel/speed-insights` — direct dep of `vendor/analytics/package.json:48`, runs postinstall for Vercel integration

**Ghost removed:** `@lightfastai/dual` — appeared in `onlyBuiltDependencies` but had zero presence in any workspace `package.json`, zero lockfile entries, and doesn't exist as a workspace package. Origin: likely a planned package that was never created or was renamed.

### 2. `pnpm.overrides` — What's There and Why

**React 19 alignment (4 entries):** `react`, `react-dom`, `@types/react`, `@types/react-dom`
Forces a single version across the entire dep tree. Without these, packages declaring `react: ^18` peers would trigger multi-version installs.

**Type definition pinning (1 entry):** `@types/minimatch: 5.1.2` (exact pin)
Resolves version conflict between: `vercel@50.28.0` (wants 3.0.3), `@mixedbread/cli@2.3.0` (wants ^6.0.0), `drizzle-kit` (wants ^5.1.2). The exact pin enforces a single install.

**Peer version coercion (1 entry):** `zod-to-json-schema>zod: ^3.25.76`
`zod-to-json-schema@3.25.1` (transitive of `@modelcontextprotocol/sdk` in `core/mcp`) doesn't support zod v4. This scoped override forces it to use zod v3 while the rest of the workspace runs zod v4.

**Active security patches (8 entries):**
| Override | Transitive path |
|---|---|
| `tar: ^7.5.8` | `@mapbox/node-pre-gyp` → `vercel` (root devDep) |
| `basic-ftp: ^5.2.0` | `get-uri` → `pac-proxy-agent` |
| `undici: ^6.23.0` | Node.js-adjacent packages |
| `cookie: ^1.0.2` | `express` → `inngest` |
| `lodash: ^4.17.23` | `recharts` → `packages/ui` |
| `lodash-es: ^4.17.23` | `mermaid` → `dagre-d3-es` → `chevrotain` |
| `mdast-util-to-hast: ^13.2.1` | `react-markdown` → `packages/ui` |
| `qs: ^6.14.2`, `body-parser: ^2.2.1`, `path-to-regexp: ^6.3.0` | `express` → `inngest` |
| `fast-xml-parser: ^5.3.8` | `openapi-sampler` → `fumadocs-openapi` → `apps/www` |

**Removed (stale/ghost entries):**
- `@browserbasehq/stagehand>dotenv: ^17.2.1` — stagehand was removed from the repo; zero lockfile presence
- `jws: ^4.0.1`, `prismjs: ^1.30.0`, `serialize-javascript: ^7.0.3`, `jsondiffpatch: ^0.7.2`, `diff: ^4.0.4` — appeared only in the lockfile's `overrides:` block with no resolved packages or snapshots. These transitive deps were patched but have since been dropped from the install tree.

### 3. `.npmrc` — What Each Setting Does

**Kept (all meaningful):**
- `auto-install-peers=true` — auto-installs peer deps
- `enable-pre-post-scripts=true` — required for root `postinstall: pnpm lint:ws` to fire
- `link-workspace-packages=true` — enables `workspace:*` protocol linking
- `prefer-workspace-packages=true` — prefers local packages over registry
- `shared-workspace-lockfile=true` — single root-level `pnpm-lock.yaml`
- `fetch-retries=3`, `fetch-retry-mintimeout=10000`, `fetch-retry-maxtimeout=60000` — needed for flaky CI network
- `side-effects-cache=true` — caches postinstall results (speeds up repeated installs)
- `side-effects-cache-readonly=false` — CI runners write to cache (used with `actions/setup-node` cache)
- `modules-cache-max-age=604800` — 7-day orphan package TTL

**Removed (pnpm defaults):**
- `network-concurrency=16` — this is pnpm's default; was explicitly documenting the default
- `package-import-method=auto` — this is pnpm's default; was explicitly documenting the default

**Removed (duplicate):**
- `linkWorkspacePackages: true` in `pnpm-workspace.yaml:79` — same setting as `link-workspace-packages=true` in `.npmrc`; the `.npmrc` is the canonical location for pnpm settings

### 4. `turbo.json` — Boundaries System

The monorepo enforces three dependency boundary rules via Turborepo's tag system:

**Tag assignments:**
- `vendor` (17 packages) — thin SDK re-export wrappers in `vendor/`
- `internal` (2 packages) — tooling configs in `internal/` (typescript, vitest-config)
- `packages` (22 tagged + 3 untagged) — shared library packages in `packages/`
- `data` (1 package) — `db/app`
- `api` (2 packages) — `api/app`, `api/platform`
- `app` (3 packages) — `apps/app`, `apps/platform`, `apps/www`
- `core` (4 packages) — standalone SDK/CLI packages in `core/`

**Rules:**
1. `vendor` cannot depend on `packages`, `data`, `api`, or `app` (vendor is a foundation layer)
2. `internal` cannot depend on any other tag (tooling configs must stay independent)
3. `app` cannot be depended on by anything else (apps are leaf nodes)

**`implicitDependencies: ["~"]`** — within-directory siblings are treated as implicit peers for boundary enforcement, even without explicit `dependencies` entries.

**4 untagged packages** (outside boundary enforcement): `vendor/upstash-realtime`, `packages/app-providers`, `packages/app-upstash-realtime`, `packages/platform-trpc`

### 5. Catalog System

**Default catalog** (48 entries): Used via `catalog:` syntax across all 54 workspace packages. Well-adopted.

**Named catalogs:**
- `catalog:react19` — **was accidentally dropped** in commit `6012e7ce7` when React was bumped. Restored in this session with current versions (`^19.2.4`). Referenced in 12 places across 7 files.
- `catalog:next16` — `next: ^16.2.1`. Used in 10 packages.
- `catalog:tailwind4` — tailwindcss, postcss, @tailwindcss/postcss, @tailwindcss/typography. Used in 4 packages.

**Catalog entries not used via `catalog:` syntax:**
- `braintrust: ^0.2.1` — in catalog but no workspace package references it via `catalog:`
- `fast-check: ^3.23.2` — same
- `postgres: ^3.4.5` — same
- `redis: ^5.6.0` — `core/ai-sdk` uses redis but hardcoded to `^4.7.0` (different major version)
- `dotenv-cli: ^8.0.0` — 6 packages use it but all hardcode `"^8.0.0"` directly

## Changes Made in This Session

### `pnpm-workspace.yaml`
1. **Restored** `catalog:react19` with `react: ^19.2.4`, `react-dom: ^19.2.4`, `@types/react: ^19.2.14`, `@types/react-dom: ^19.2.3`
2. **Removed** `@lightfastai/dual` from `onlyBuiltDependencies` (ghost entry)
3. **Removed** duplicate `linkWorkspacePackages: true` (already in `.npmrc`)

### `package.json` (pnpm.overrides)
4. **Removed** `@browserbasehq/stagehand>dotenv` (stagehand removed from repo)
5. **Removed** `jws`, `prismjs`, `serialize-javascript`, `jsondiffpatch`, `diff` (not in resolved dep tree)

### `.npmrc`
6. **Removed** `network-concurrency=16` (pnpm default)
7. **Removed** `package-import-method=auto` (pnpm default)

## Code References

- `pnpm-workspace.yaml:62-74` — catalogs block (react19, next16, tailwind4)
- `pnpm-workspace.yaml:76-94` — ignoredBuiltDependencies and onlyBuiltDependencies
- `package.json:55-75` — pnpm.overrides
- `.npmrc:1-27` — all pnpm settings
- `turbo.json:85-101` — boundaries configuration
- `vendor/clerk/package.json:48-49` — example of `catalog:react19` usage
- `vendor/analytics/package.json:52` — example of `catalog:react19` usage
- `core/mcp/package.json` — source of `zod-to-json-schema>zod` override need
- `packages/ui/package.json` — source of lodash and mdast-util-to-hast override need
- `apps/www/package.json` — source of fast-xml-parser override need

## Open Questions

- `braintrust`, `fast-check`, `postgres`, `redis` in the default catalog are unused via `catalog:` syntax — packages either hardcode versions or these are legacy entries from removed features. Worth auditing in a separate pass.
- 4 packages missing turbo boundary tags: `vendor/upstash-realtime`, `packages/app-providers`, `packages/app-upstash-realtime`, `packages/platform-trpc`
