---
date: 2026-05-07
last_revised: 2026-05-08
author: claude
git_commit: 4934a881efc6f02fc3b4bdac79c0a332c79ec138
branch: refactor/repo-barebones-reset
status: revised-after-multiwt-regression
tags: [plan, dev-proxy, portless, microfrontends, apps/platform, dev-harness]
---

# Dynamic dev-proxy supporting MFE + non-MFE apps Implementation Plan

## Overview

Refactor `@lightfastai/dev-proxy` so the **apps registry in `lightfast.dev.json` is the single source of truth** for app *identity* — `packageName` and a required `mfe: true|false` flag per entry. **Physical ports are not declared in config**; dev-proxy allocates them per (worktree, app) via its existing worktree-aware `generateMicrofrontendsPort` (djb2 + linear probe), so multiple worktrees boot concurrently without `EADDRINUSE`. The MFE proxy's `applications` map is **derived in-memory from `apps[mfe=true]` entries** — `microfrontends.json` retains only the `routing` rules (path-mapping for the marketing group). Non-MFE apps (today: `apps/platform`) get a portless subdomain (`platform.lightfast.localhost`) on the same aggregate as MFE apps; only MFE-flagged apps participate in the `@vercel/microfrontends` mesh. Both kinds are supervised by `lightfast-dev proxy turbo`. When zero MFE apps are local, the supervisor **skips spawning the MFE proxy and the aggregate-hostname route** entirely.

## Current State Analysis

Today every code path that builds the routing table in `dev-proxy@0.2.1` iterates `microfrontends.json applications`:

- `getPortlessProxyOrigins` (`packages/dev-proxy/src/index.ts:517-572`)
- `createVercelMicrofrontendsDevConfig` (`index.ts:574-688`)
- `inferLocalAppNames` (`index.ts:852`)
- `resolveApplicationPortlessName` (`index.ts:1206-1220`)
- `resolvePortlessApplicationUrl` (`index.ts:485-515`)

The schema's `microfrontends.apps[<name>]` override map keys against names that already exist in `applications`; it cannot register new apps. Per-app subdomains are spawned via `buildPortlessAppCommands` (`runtime.ts:472-497`), invoked from each app's own `dev` script through `startDevProxyAppCommand` (`runtime.ts:314-377`). The aggregate hostname (`lightfast.localhost`) is registered separately as a portless route via `buildPortlessRouteCommands` (`runtime.ts:499-520`) and points at the `@vercel/microfrontends` proxy port.

In the lightfast repo, `apps/platform` participates in the dev-origin allowlist (it imports `withPortlessProxy` and `getPortlessProxyOrigins`) but NOT in the proxy aggregate (no `microfrontends.json` entry, raw `next dev --port 4112`). Two consumer-side workarounds exist:

- `apps/app/src/origins.ts:30-35` — `platformUrl` is hardcoded `"http://localhost:4112"` in dev with the explicit comment "platform is intentionally not on portless".
- Root `package.json:20-21` — `dev:platform` and `dev:full` register platform with Inngest sync via `--app-url lightfast-platform=http://localhost:4112` (literal pass-through bypass) instead of `--mfe-app`.

## Desired End State

A single registry in `lightfast.dev.json` describes every app the proxy routes to; the proxy treats MFE-ness as one flag among several rather than as the gatekeeper for portless registration. **The registry is purely a declaration of identity — no physical ports.**

```json
{
  "$schema": "./node_modules/@lightfastai/dev-proxy/schema/config.schema.json",
  "portless": { "name": "lightfast", "port": 443, "https": true },
  "apps": {
    "lightfast-app":      { "packageName": "@lightfast/app",      "mfe": true  },
    "lightfast-www":      { "packageName": "@lightfast/www",      "mfe": true  },
    "lightfast-platform": { "packageName": "@lightfast/platform", "mfe": false }
  },
  "microfrontends": { "config": "apps/app/microfrontends.json" }
}
```

**Ports are allocated, not declared.** dev-proxy continues to use `generateMicrofrontendsPort` (djb2 + linear probe over a port range), seeded with `host === baseHost ? appName : '${host}:${appName}'`. In the primary worktree, seed is the bare app name; in a secondary worktree, the worktree-prefixed host is folded into the seed, so each worktree's apps land on distinct physical ports automatically. This is the 0.2.x behavior; the original Phase 0 of this plan accidentally replaced the seeded allocator with `entry.devPort` (regressing multi-worktree dev to `EADDRINUSE`), and is corrected in **Phase 3.5** below. Phase 3.5 also extends the same allocator to non-MFE entries so platform behaves identically.

`apps/app/microfrontends.json` is reduced to **path-routing rules only** (per-app `routing` arrays for the marketing group). The dev-proxy synthesizes `applications` from the registry's `apps[mfe=true]` entries at load time, merged with each entry's `routing` array if present.

Verification at the end of the plan:

- `pnpm dev:full` boots app + www + platform under one `lightfast-dev proxy turbo` invocation, with portless subdomains for all three.
- `pnpm dev:platform` runs platform on its own portless subdomain WITHOUT spawning the @vercel/microfrontends proxy (the supervisor skips it when zero MFE apps are local).
- `https://platform.lightfast.localhost` resolves and reverse-proxies to platform's Next.js dev server.
- `apps/app/src/origins.ts` `platformUrl` resolves through `resolveProjectUrl("lightfast-platform")` (no hardcoded `localhost:4112`).
- `apps/platform/src/cors.ts` startup guard fires only if portless is genuinely unreachable, not because platform is on a different mechanism.
- Inngest sync registers all three apps via the registry; both the `--app-url` and `--mfe-app` flags are removed from dev scripts (with a deprecation warning during the migration window).
- `dev-proxy@0.4.0` requires explicit `apps` in `lightfast.dev.json` — no back-compat fallback to deriving from `microfrontends.json applications`, and **no `devPort` field** (Phase 3.5 drops it from the schema). Lightfast is the primary consumer; fail-loud is preferable to silent two-source drift.
- Desktop's `LIGHTFAST_APP_ORIGIN` flow continues to work over portless TLS (Node fetch CA injection lands in this plan — see new Phase 5b).

### Key Discoveries:

- Portless natively supports per-subdomain routing via `portless run --name <name> --app-port <port>` (README, `node_modules/portless/README.md:167-179, 314`). dev-proxy already uses this for MFE apps via `buildPortlessAppCommands` (`runtime.ts:472-497`); non-MFE apps reuse the exact same mechanism, no in-house dispatcher needed.
- `@vercel/microfrontends`'s path-routing dispatcher only needs to know about MFE apps; non-MFE apps bypass it entirely by going straight from portless to their `devPort`.
- **The supervisor unconditionally spawns the MFE proxy + aggregate route today** (`runtime.ts:124-141`). Even with empty `applications`, `createVercelMicrofrontendsDevConfig` returns `{ appUrls: {}, appPorts: {}, localProxyPort: <claimed> }` (`index.ts:608-686`) and `startMicrofrontendsProxy` is invoked anyway. Confirmed by spike: the supervisor needs an explicit `if (hasMfeApps)` guard around lines 124-141 to skip the MFE proxy and the aggregate-hostname route registration in non-MFE-only mode.
- The schema's root has `additionalProperties: false` (`packages/dev-proxy/schema/config.schema.json`). Adding the new top-level `apps` field requires both adding the property definition AND ensuring the root validator continues to accept it. Existing `microfrontends.apps[<name>]` override map keyed against existing `applications` names is removable — its `portlessName` override moves into the registry as `apps[<name>].portlessName`.
- `apps/app/microfrontends.json` today contains `applications.{name}.{packageName, development.fallback, routing}`. Under this plan, `packageName` and `development.fallback` move to the apps registry (or the fallback is synthesized as `https://lightfast.ai` when not specified). `routing` arrays stay in `microfrontends.json` keyed by the same MFE app names.
- `apps/platform/next.config.ts:26-31` already calls `withPortlessProxy` (the wrapper is idempotent for non-MFE use today — it just injects `allowedDevOrigins`). No call-shape change required when platform joins the aggregate.
- All four `@lightfastai/dev-*` packages are in a `"fixed"` changeset group (`dev-harness/.changeset/config.json`); a single changeset bumps them in lockstep.
- **TLS open issue (cross-cutting, scoped into Phase 5b)**: `thoughts/shared/research/2026-05-06-desktop-exchange-tls-portless.md` documents that Electron main's Node `fetch` does not trust the portless CA (`~/.portless/ca.pem`). Adding `platform.lightfast.localhost` widens the surface where in-process Node fetch (server actions, internal tRPC, Inngest startup pings) could hit `SELF_SIGNED_CERT_IN_CHAIN`. Folded into this plan as Phase 5b: auto-inject `NODE_EXTRA_CA_CERTS` in `scripts/with-desktop-env.mjs`.

## What We're NOT Doing

- NOT adding any new dispatcher or reverse-proxy implementation inside dev-proxy. Portless's native per-subdomain routing is sufficient.
- NOT keeping the `--app-url` literal pass-through in dev-services. It's removed in Phase 6 with a single deprecation-warning window during the migration commit.
- NOT keeping the `proxy alias` subcommand from the original draft — no phase has a workflow that uses it, removed for scope.
- NOT keeping the `derived-from-microfrontends` back-compat path. Lightfast is the primary `dev-proxy` consumer; require explicit `apps` in `lightfast.dev.json`. Fail loudly if the field is missing.
- NOT changing `@vercel/microfrontends` invocation surface for MFE apps. Their `appPorts`, generated config, and proxy port allocation behavior stay identical (modulo the in-memory synthesis of `applications` from the registry).
- NOT moving Inngest pipeline ownership between platform and app, nor changing platform's tRPC CORS allow-list semantics. Only the URL-resolution path changes.
- NOT changing `apps/platform/next.config.ts`'s `withPortlessProxy` call surface; the only effect there is that the auto-injected `allowedDevOrigins` list grows.
- NOT addressing prod/preview Vercel deployment URLs for platform. The `withRelatedProject` `defaultHost` in non-local environments (`https://lightfast-platform.vercel.app` or similar) is out of scope.

## Implementation Approach

Land everything in dev-harness first (Phases 0–3), cut a `@lightfastai/dev-*` minor, then adopt in lightfast (Phases 4–7, with a small new Phase 5b for desktop TLS hardening). Each dev-harness phase is independently testable in `dev-harness/example/`. The lightfast phases are sequential after the catalog bump.

The registry's `mfe` flag is REQUIRED — an explicit boolean per app, no default. **There is no second registry** — `microfrontends.json applications` is no longer the source of truth for MFE app identity; only `routing` arrays remain there. The dev-proxy synthesizes the `applications` map from `apps[mfe=true]` entries at load time, merging in each entry's `routing` array if defined in `microfrontends.json`.

No backward-compat fallback. If `lightfast.dev.json` has no top-level `apps` field, `loadAppRegistry` throws with: `"lightfast.dev.json must declare an 'apps' registry; deriving from microfrontends.json is no longer supported in dev-proxy@0.3.0+."` (Phase 3.5 also rejects `apps[*].devPort` as an unknown property in 0.4.0+.)

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Apps registry — schema, types, loader, applications synthesis (dev-harness) [DONE — partially superseded by Phase 3.5]

> **Correction:** Phase 0 shipped with `devPort` as a required field on each `apps[*]` entry, and replaced dev-proxy's worktree-aware port allocator with `entry.devPort` at `index.ts:758`. This regressed multi-worktree dev (`EADDRINUSE`). Phase 3.5 drops `devPort` from the schema, restores the seeded `generateMicrofrontendsPort` call, and ships the correction as `dev-proxy@0.4.0`. The descriptions in this Phase 0 reflect what was originally shipped in `0.3.0`; cross-reference Phase 3.5 for what 0.4.0 actually looks like.

### Overview

Add the top-level `apps` field to the schema and a `loadAppRegistry` function that returns a normalized `AppEntry[]`. Synthesize the MFE proxy's `applications` map in-memory from `apps[mfe=true]` entries (merging `routing` arrays from `microfrontends.json` keyed by app name). Refactor every iteration site to read from the registry.

### Changes Required:

#### 1. JSON schema

**File**: `dev-harness/packages/dev-proxy/schema/config.schema.json`

Today the root has `additionalProperties: false`. Add a top-level `apps` property alongside `portless` and `microfrontends`. The schema patch must add the field definition AND ensure the root `additionalProperties: false` constraint continues to allow it (i.e. add `apps` to the root `properties` block — extras stay rejected).

```json
"apps": {
  "type": "object",
  "minProperties": 1,
  "additionalProperties": {
    "type": "object",
    "additionalProperties": false,
    "required": ["packageName", "devPort", "mfe"],
    "properties": {
      "packageName": { "type": "string", "minLength": 1 },
      "devPort":     { "type": "integer", "minimum": 1, "maximum": 65535 },
      "portlessName":{ "type": "string", "minLength": 1 },
      "fallback":    { "type": "string", "format": "uri" },
      "mfe":         { "type": "boolean" }
    }
  }
}
```

The existing `microfrontends.apps` override map (`schema/config.schema.json:41-69`) is **removed** — its `portlessName` override moves into `apps[<name>].portlessName`, and `dir`/`path` overrides were unused by lightfast.

#### 2. Registry types and loader

**File**: `dev-harness/packages/dev-proxy/src/index.ts`

```ts
export interface AppEntry {
  name: string;
  packageName: string;
  devPort: number;
  portlessName: string;
  fallback: string; // defaults to "https://lightfast.ai" if not set
  mfe: boolean;
  routing?: MicrofrontendRouting; // synthesized from microfrontends.json if mfe
}

export interface AppRegistry {
  entries: AppEntry[];
  byName: Record<string, AppEntry>;
}

export function loadAppRegistry(config: NormalizedPackageConfig): AppRegistry;
```

Resolution: `config.apps` MUST be non-empty. For each entry, compute `portlessName` from the explicit override or `<packageShortName>.<config.portless.name>`. Default `fallback` to `"https://lightfast.ai"` if not specified. If the entry is `mfe: true` AND `microfrontends.json` declares a `routing` array under that key, attach it.

If `config.apps` is missing or empty: throw `"lightfast.dev.json must declare a non-empty 'apps' registry; deriving from microfrontends.json is no longer supported in dev-proxy@0.3.0+."`

#### 3. Synthesize `applications` from registry

**File**: `dev-harness/packages/dev-proxy/src/index.ts`

Replace the existing `readMicrofrontendsConfig` flow. Add `synthesizeApplicationsFromRegistry(registry, microfrontendsRouting)` that builds the in-memory equivalent of today's `microfrontends.json applications`:

```ts
function synthesizeApplicationsFromRegistry(registry: AppRegistry): MicrofrontendsApplications {
  return Object.fromEntries(
    registry.entries
      .filter(e => e.mfe)
      .map(e => [e.name, {
        packageName: e.packageName,
        development: { fallback: e.fallback },
        ...(e.routing ? { routing: e.routing } : {}),
      }])
  );
}
```

`microfrontends.json` is still read from disk if present, but ONLY to extract per-app `routing` arrays. If `microfrontends.json` is absent, all MFE apps work without routing rules (default group only).

#### 4. Refactor iteration sites to read from registry

**File**: `dev-harness/packages/dev-proxy/src/index.ts`

| Function | Current line | New behavior |
|---|---|---|
| `getPortlessProxyOrigins` | 517-572 | Iterate `registry.entries`, not `applications`. Include all entries (MFE + non-MFE). |
| `createVercelMicrofrontendsDevConfig` | 574-688 | Build internal `applications` via `synthesizeApplicationsFromRegistry(registry)`. **0.3.0 used `entry.devPort` for `appPorts[entry.name]` directly — Phase 3.5 reverts this to the worktree-aware seeded `generateMicrofrontendsPort` callsite (so multi-worktree dev works).** |
| `inferLocalAppNames` | 852 | Resolve from `registry.entries`, not `applications`. Both MFE and non-MFE app dirs are inferable. |
| `resolveApplicationPortlessName` | 1206-1220 | Look up in `registry.byName` and return `entry.portlessName`. |
| `resolvePortlessApplicationUrl` | 477-515 | Look up in `registry.byName`; works for any registered app regardless of `mfe`. Rename to `resolvePortlessAppUrl` (no deprecation alias — minor bump). |

#### 5. CommonJS shim

**File**: `dev-harness/packages/dev-proxy/src/projects.cts`

This is a single-line CJS re-export shim (`module.exports = require("./projects.js")`). No changes needed.

**File**: `dev-harness/packages/dev-proxy/src/projects.ts`

`resolveProjectUrl(name)` — switch its lookup to the registry (was reading `applications` directly). Now resolves any registered app regardless of `mfe`.

### Success Criteria:

#### Automated Verification:

- [x] Type-check passes in dev-harness: `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness typecheck`
- [x] dev-proxy unit tests pass: `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness --filter @lightfastai/dev-proxy test`
- [x] New tests cover: registry happy path, missing `apps` throws with documented message, non-MFE entry round-trips through `resolveProjectUrl`, `synthesizeApplicationsFromRegistry` matches today's `microfrontends.json applications` shape exactly for the lightfast fixture.
- [x] Schema rejects `apps` entries missing `mfe`: covered via `loadAppRegistry` runtime test (no AJV in dev-harness; runtime validation mirrors schema constraints).
- [x] Schema rejects empty `apps: {}`: covered via `loadAppRegistry` runtime test.
- [x] Schema continues to reject unknown root properties (`additionalProperties: false` retained at root + `required: ["apps"]` added).

---

## Phase 1: Origin enumeration + Inngest helpers driven by registry (dev-harness)

### Overview

Once the registry is the source of truth, downstream helpers (`withPortlessProxy`, `resolveProjectUrl`, dev-services Inngest sync) need their semantics extended to non-MFE apps. `resolvePortlessApplicationUrl` is renamed to `resolvePortlessAppUrl` in this minor bump (no deprecation alias — minor versions can rename).

### Changes Required:

#### 1. `withPortlessProxy` and `getPortlessProxyOrigins`

**File**: `dev-harness/packages/dev-proxy/src/next.ts` (and `next.cts`)

No public surface change. Internally it now picks up non-MFE entries automatically because Phase 0 made `getPortlessProxyOrigins` registry-driven. Add a test fixture proving that a config with `lightfast-platform: { mfe: false }` produces `platform.lightfast.localhost` and `*.platform.lightfast.localhost` in the returned list.

#### 2. `resolvePortlessAppUrl` rename (Phase 0 introduced; this phase removes the old name)

**File**: `dev-harness/packages/dev-proxy/src/index.ts`

Phase 0 added `resolvePortlessAppUrl`. This phase removes the old `resolvePortlessApplicationUrl` export entirely — minor bump, fail loudly. Update internal call sites (`projects.ts`, `runtime.ts`, any `dev-services` consumer) to use the new name.

#### 3. dev-services Inngest sync helper

**File**: `dev-harness/packages/dev-services/src/inngest-dev-sync.ts` (the function that lightfast's `scripts/dev-services.mjs:297-340` calls into)

Replace `buildInngestDevSyncTargets` with `buildInngestDevSyncTargetsFromRegistry({ registry, servePath })`. The previous function relied on `--mfe-app`/`--app-url` flag distinction; the new one iterates `registry.entries` directly. Each entry contributes one target at `${resolvePortlessAppUrl(entry.name)}${servePath}`.

### Success Criteria:

#### Automated Verification:

- [ ] dev-proxy tests cover: `getPortlessProxyOrigins` returns non-MFE app subdomain when registry has one; `resolvePortlessAppUrl("lightfast-platform")` returns `https://platform.lightfast.localhost` against the lightfast-shaped fixture.
- [ ] dev-services tests cover: `buildInngestDevSyncTargetsFromRegistry` returns one target per app regardless of `mfe`.
- [ ] Old `resolvePortlessApplicationUrl` export no longer present: tsc errors on any internal call site that wasn't updated; package's `dist/` no longer ships the symbol.

---

## Phase 2: proxy turbo supports non-MFE apps + skips MFE proxy when no MFE locals (dev-harness)

### Overview

`startDevProxyTurboCommand` (`runtime.ts:69-163`) and `startDevProxyAppCommand` (`runtime.ts:314-377`) need adaptations so non-MFE entries flow through cleanly. Critically, **the supervisor must skip spawning `startMicrofrontendsProxy` AND `buildPortlessRouteCommands` when no MFE apps are local** — confirmed by spike that the current code unconditionally spawns both at `runtime.ts:124-141`, and `@vercel/microfrontends`'s behavior with empty `applications` is undefined.

### Changes Required:

#### 1. `startDevProxyTurboCommand` — conditional skip when no MFE locals

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts:69-163`

After `resolvedLocalApps` is computed (~line 115), gate the MFE proxy spawn AND the aggregate-hostname route registration on `hasMfeApps`:

```ts
const hasMfeApps = resolvedLocalApps.some(name => registry.byName[name]?.mfe === true);

if (hasMfeApps) {
  // existing lines 124-141 — startMicrofrontendsProxy + buildPortlessRouteCommands
  proxy = await startMicrofrontendsProxy({ /* ... */ });
  route = await spawnWithFallback(
    buildPortlessRouteCommands({ portlessName, appPort: result.localProxyPort }),
    { cwd: config.root, env: portlessEnv, stdio },
  );
}
```

Additionally, `localAppNames` passed to the MFE proxy MUST be filtered to MFE apps only when `hasMfeApps` is true.

**Rationale**: when zero MFE apps are local (e.g. `dev:platform` runs platform alone), there is nothing for `@vercel/microfrontends` to dispatch, and the aggregate `lightfast.localhost` host has nowhere to point. Spawning both wastes a port and creates a process that can fail in undefined ways with empty `applications`.

**Risk note**: When the aggregate route is skipped, `https://lightfast.localhost` (the bare aggregate URL) does not resolve. Anything that reads `LIGHTFAST_APP_ORIGIN` and expects the bare aggregate would fail. Mitigated because:
- `apps/{app,platform}/src/origins.ts` resolve their canonical app URLs via `resolveProjectUrl(<specific-app>)` which returns the per-subdomain URL, not the aggregate.
- `getPortlessProxyOrigins` (the CORS allowlist source) emits per-subdomain origin patterns, not the bare aggregate.
- The bare aggregate is only used by desktop's `LIGHTFAST_APP_ORIGIN` resolver. Phase 5b's TLS work assumes `with-desktop-env.mjs` resolves to a per-subdomain URL — verify in that phase.

Add a runtime warning when the bare aggregate is skipped: `[dev-proxy] Skipping @vercel/microfrontends proxy (no MFE apps in --local-app list); https://<portless-name>.localhost will not resolve.`

#### 2. `startDevProxyAppCommand` — support non-MFE apps

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts:314-377`

Currently fetches `appPort` from `result.appPorts[appName]` (the `@vercel/microfrontends` synthetic dispatch port, line 346). For non-MFE entries, pull `appPort` directly from `registry.byName[appName].devPort` and bypass the `createVercelMicrofrontendsDevConfig` call entirely (it's only needed for MFE port allocation):

```ts
const entry = registry.byName[appName];
if (!entry) {
  throw new Error(
    `Dev proxy app command must be run from a configured app directory; ${appName} is not in apps registry.`
  );
}
const appPort = entry.devPort;
const portlessName = entry.portlessName;
// buildPortlessAppCommands invocation unchanged
```

#### 3. `inferLocalAppNames` accepts non-MFE entries

**File**: `dev-harness/packages/dev-proxy/src/index.ts:852`

Already updated in Phase 0 to read from registry. Verify it correctly resolves an `apps/platform`-shaped cwd to `lightfast-platform` when `mfe: false` (test added in Phase 0).

### Success Criteria:

#### Automated Verification:

- [x] Unit tests cover registry-driven runtime helpers: `filterMfeLocalApps` partitions correctly (mixed, non-MFE-only, empty); `buildAppDirsFromRegistry` resolves dirs for both MFE and non-MFE apps; `inferLocalAppNames` resolves a non-MFE app from cwd inside its package.
- [x] `pnpm --filter @lightfastai/dev-proxy typecheck` passes.
- [x] `pnpm --filter @lightfastai/dev-proxy test` passes (43/43).
- [ ] **Deferred to Phase 3** (requires `dev-harness/example/apps/platform` fixture): integration test for `lightfast-dev proxy turbo --local-app lightfast-platform run dev -F @lightfast/platform` against a fixture with `lightfast-platform: { mfe: false }` AND `lightfast-app: { mfe: true }`. Verify MFE proxy is NOT spawned (`lsof -iTCP:<localProxyPort>` unbound) and `platform.example.localhost` resolves to platform's `devPort`.
- [ ] **Deferred to Phase 3**: integration test for mixed `--local-app lightfast-app` + `--local-app lightfast-platform` — MFE proxy IS spawned, both subdomains resolve, aggregate `https://example.localhost` ALSO resolves.
- [ ] **Deferred to Phase 3**: `lightfast-dev proxy app -- next dev …` from a non-MFE app's cwd succeeds.
- [ ] **Deferred to Phase 3** (mocking-based): runtime warning fires when the MFE proxy is skipped (capture stdout).

#### Human Review:

- [ ] **Deferred to Phase 3** (requires fixture): In `dev-harness/example/`, run `pnpm dev:full` (mixed MFE + non-MFE locals) and visit `https://platform.example.localhost` in a browser → expect platform's Next dev page to load.

---

## Phase 3: Tests + cut `@lightfastai/dev-*` 0.3.0 (dev-harness) [DONE]

### Overview

Add comprehensive coverage across the registry, supervisor, and CLI surfaces; cut a coordinated minor bump for all four `@lightfastai/dev-*` packages via the existing `fixed` changeset group; verify `pnpm pack` artifacts.

### Changes Required:

#### 1. Test matrix

**File**: `dev-harness/packages/dev-proxy/src/__tests__/registry.test.ts` (new)

- Explicit `apps` registry → entries returned as-is, with computed `portlessName`.
- Missing or empty `apps` → throws with the documented error message about deriving from `microfrontends.json` no longer being supported.
- `synthesizeApplicationsFromRegistry` against the lightfast fixture → output matches today's `microfrontends.json applications` shape exactly (snapshot test).
- `apps[name].routing` from `microfrontends.json` is correctly merged into the synthesized application entry.
- Schema validation: missing `mfe` field in an `apps` entry → JSON Schema error.
- Schema validation: empty `apps: {}` → JSON Schema error (`minProperties: 1`).
- Schema validation: unknown root property (regression for `additionalProperties: false`).

**File**: `dev-harness/packages/dev-proxy/src/__tests__/origins.test.ts` (extend)

- Non-MFE entry adds its subdomain to `getPortlessProxyOrigins` output.

**File**: `dev-harness/packages/dev-proxy/src/__tests__/runtime.test.ts` (extend)

- `startDevProxyAppCommand` resolves `devPort` from registry for non-MFE apps.
- `startDevProxyTurboCommand` filters `@vercel/microfrontends` participants to MFE entries only.
- `startDevProxyTurboCommand` SKIPS spawning the MFE proxy AND the aggregate-hostname route when no MFE apps are local. Verify by mocking `startMicrofrontendsProxy` and `spawnWithFallback` (for the route) and asserting they're not called.
- Runtime warning is emitted on the skip path.

**File**: `dev-harness/example/apps/platform/` (new fixture)

A minimal Next.js app with `mfe: false` to exercise the Phase 2 integration test. Mirrors `apps/app` and `apps/www` shapes.

#### 2. Changeset

**File**: `dev-harness/.changeset/dynamic-mfe-non-mfe.md` (new)

```md
---
"@lightfastai/dev-proxy": minor
"@lightfastai/dev-cli": minor
"@lightfastai/dev-core": minor
"@lightfastai/dev-services": minor
---

feat(dev-proxy): unified apps registry supports MFE and non-MFE apps

BREAKING: lightfast.dev.json now requires a top-level `apps` registry; deriving from microfrontends.json is no longer supported. Each entry declares `packageName`, `devPort`, and a required `mfe` flag. `microfrontends.json` is now the path-routing spec only — `applications` are synthesized from the registry's `apps[mfe=true]` entries.

BREAKING: `resolvePortlessApplicationUrl` is renamed to `resolvePortlessAppUrl`.

Non-MFE apps register portless subdomains and participate in the dev-origin allowlist without joining the @vercel/microfrontends mesh. The supervisor (`startDevProxyTurboCommand`) now skips spawning the MFE proxy and the aggregate-hostname route when zero MFE apps are local.
```

#### 3. Pack & local-link sanity check

```bash
cd /Users/jeevanpillay/Code/@lightfastai/dev-harness
pnpm changeset version  # bumps all four to the same minor
pnpm build
pnpm pack:check          # exists per recent CI commit (8ad0791)
```

### Success Criteria:

#### Automated Verification:

- [x] All new + existing tests pass: `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness test` — 8 tasks successful (46/46 dev-proxy + 4/4 dev-cli + others).
- [x] `pnpm pack:check` runs cleanly across all four `@lightfastai/dev-*` packages (existing CI gate).
- [x] Version files reflect the new minor consistently across all four packages: `pnpm changeset:status` reports all four bumping to 0.3.0 via the `fixed` group.
- [ ] Type-check across the workspace: `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness typecheck` — published `@lightfastai/*` packages typecheck clean; `@example/{app,www,platform}` fail with a pre-existing `NextConfigWithPortlessProxy` variance issue (verified present on the pre-Phase-3 baseline; not introduced by this work).
- [ ] Integration test from Phase 2 still passes against the just-built `dist/` — fixture (`example/apps/platform`) is in place; spawning portless-backed integration is left for manual verification (no automated harness in dev-harness today).

---

## Phase 3.5: Drop `devPort` + restore worktree-aware port allocation; cut dev-proxy 0.4.0 (dev-harness)

### Overview

Phase 0 of this plan replaced dev-proxy's worktree-aware `generateMicrofrontendsPort(seed)` with `entry.devPort`, pinning each app to a single physical port. **Two worktrees both try to bind that one port and one fails with `EADDRINUSE`** (regression confirmed empirically against the in-progress Phase 4 lightfast.dev.json).

This phase reverts that decision: `devPort` is dropped from the schema entirely, the registry becomes a pure identity declaration (`packageName` + `mfe`), and the seeded allocator is restored at the MFE callsite — and extended to the non-MFE branch in `startDevProxyAppCommand` so platform also gets per-worktree-distinct ports. Cut as `dev-proxy@0.4.0` (schema break vs. 0.3.x).

The user-visible contract: contributors never read or pin raw ports; everything goes through portless URLs (`https://[<wt>.]<sub>.lightfast.localhost`). Whatever physical port Next.js binds is an implementation detail of dev-proxy and may differ across machines, sessions, and worktrees.

### Changes Required:

#### 1. Schema — drop `devPort`

**File**: `dev-harness/packages/dev-proxy/schema/config.schema.json`

```diff
 "additionalProperties": {
   "type": "object",
   "additionalProperties": false,
-  "required": ["packageName", "devPort", "mfe"],
+  "required": ["packageName", "mfe"],
   "properties": {
     "packageName": { "type": "string", "minLength": 1 },
-    "devPort":     { "type": "integer", "minimum": 1, "maximum": 65535 },
     "portlessName":{ "type": "string", "minLength": 1 },
     "fallback":    { "type": "string", "format": "uri" },
     "mfe":         { "type": "boolean" }
   }
 }
```

Schema's root `additionalProperties: false` continues to reject any `devPort` that sneaks through from a stale config — fail-loud per the plan's no-back-compat policy.

#### 2. `AppEntry` type and `loadAppRegistry`

**File**: `dev-harness/packages/dev-proxy/src/index.ts`

```diff
 export interface AppEntry {
   name: string;
   packageName: string;
-  devPort: number;
   portlessName: string;
   fallback: string;
   mfe: boolean;
   routing?: MicrofrontendRouting;
 }
```

`loadAppRegistry` removes the `devPort` read and the corresponding runtime validation (the field's existence/range was checked there because the dev-harness has no AJV at runtime).

#### 3. Restore worktree-aware allocation in MFE flow

**File**: `dev-harness/packages/dev-proxy/src/index.ts:758`

Replace the literal lookup with the seeded allocator (this is what 0.2.x did before the original Phase 0 regression):

```diff
-const appPorts = Object.fromEntries(mfeEntries.map((entry) => [entry.name, entry.devPort]));
+const baseHost = `${normalized.portless.name}.localhost`;
+const usedPorts = new Set<number>();
+const appPorts = Object.fromEntries(
+  mfeEntries.map((entry) => {
+    const seed = host === baseHost ? entry.name : `${host}:${entry.name}`;
+    const port = generateMicrofrontendsPort(seed, { usedPorts });
+    usedPorts.add(port);
+    return [entry.name, port];
+  }),
+);
```

The `host` variable is already in scope at this point (computed earlier in `createVercelMicrofrontendsDevConfig`). `usedPorts` deduplicates intra-host MFE collisions.

#### 4. Apply the same allocator to the non-MFE branch

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts:367`

```diff
-const appPort = entry.devPort;
+const portlessUrl = resolvePortlessUrl({
+  name: portlessName,
+  cwd: config.root,
+  env: appEnv,
+  config,
+  getPortlessUrl,
+  detectWorktreePrefix,
+  preferCurrentPortlessUrl: false,
+});
+const host = new URL(portlessUrl).hostname;
+const baseHost = `${config.portless.name}.localhost`;
+const seed = host === baseHost ? entry.name : `${host}:${entry.name}`;
+const appPort = generateMicrofrontendsPort(seed);
```

For MFE entries, the `if (entry.mfe)` branch a few lines below still pulls from `result.appPorts[appName]`, which now reflects the corrected allocation from change #3 — no further edit needed there.

`startDevProxyAppCommand` only ever runs for one local app, so the non-MFE branch doesn't need a `usedPorts` set.

#### 5. Tests — worktree-distinctness + schema regression

**File**: `dev-harness/packages/dev-proxy/src/__tests__/runtime.test.ts` (extend)

- New: with two distinct hosts (`lightfast.localhost` vs. `wt2.lightfast.localhost`), `createVercelMicrofrontendsDevConfig`'s `appPorts` for the same app name differ.
- New: `startDevProxyAppCommand` non-MFE path emits a different `--app-port` argument under a worktree-prefixed host than under the base host.

**File**: `dev-harness/packages/dev-proxy/src/__tests__/registry.test.ts` (extend)

- Schema rejects `apps[*].devPort` (the field was required in 0.3.x; in 0.4.0 it's an unknown property and `additionalProperties: false` fires).
- `loadAppRegistry` returns entries without a `devPort` field.

#### 6. Changeset — cut 0.4.0

**File**: `dev-harness/.changeset/drop-devport-restore-allocator.md` (new)

```md
---
"@lightfastai/dev-proxy": minor
"@lightfastai/dev-cli": minor
"@lightfastai/dev-core": minor
"@lightfastai/dev-services": minor
---

feat(dev-proxy): drop devPort from app registry; restore worktree-aware port allocation

BREAKING (vs 0.3.x): `apps[*].devPort` is no longer accepted in `lightfast.dev.json` (and is required-removed from the schema). Ports are allocated per (worktree, app) via `generateMicrofrontendsPort` (djb2 + linear probe), seeded with `host === baseHost ? appName : '${host}:${appName}'` — restoring the 0.2.x behavior where each worktree gets distinct ports automatically. 0.3.0's pinned-port allocation regressed multi-worktree dev with `EADDRINUSE` and is reverted.

Non-MFE apps now use the same allocator as MFE apps (replacing the literal-port lookup added in 0.3.0). Their portless URL is unchanged; only the underlying physical port is now worktree-distinct.
```

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness typecheck` passes.
- [ ] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness --filter @lightfastai/dev-proxy test` passes; the new worktree-distinctness tests assert distinct ports across two hosts for the same app name.
- [ ] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness changeset:status` reports all four `@lightfastai/dev-*` packages bumping to 0.4.0 via the existing `fixed` group.
- [ ] `pnpm pack:check` is clean.
- [ ] Schema regression test: `apps[*].devPort` is rejected.

#### Human Review:

- [ ] In `dev-harness/example/`, run two parallel `pnpm dev:full` invocations from two different worktrees → both boot, per-worktree subdomains both resolve, no `EADDRINUSE`.

---

## Phase 4: Bump catalog + rewrite `lightfast.dev.json` + reduce `microfrontends.json` (lightfast)

### Overview

Pull the new `0.4.0` dev-* minor into the lightfast catalog, rewrite `lightfast.dev.json` to use the identity-only `apps` registry (no `devPort`), and reduce `apps/app/microfrontends.json` to routing-only. dev-proxy allocates per-worktree-distinct physical ports automatically.

### Changes Required:

#### 1. Catalog bump

**File**: `pnpm-workspace.yaml`

Bump these four lines to `^0.4.0` (cut in Phase 3.5):

```yaml
'@lightfastai/dev-cli': ^0.4.0
'@lightfastai/dev-core': ^0.4.0
'@lightfastai/dev-proxy': ^0.4.0
'@lightfastai/dev-services': ^0.4.0
```

Run `pnpm install` to update the lockfile.

#### 2. `lightfast.dev.json`

**File**: `lightfast.dev.json`

Replace contents with the identity-only registry:

```json
{
  "$schema": "./node_modules/@lightfastai/dev-proxy/schema/config.schema.json",
  "portless": {
    "name": "lightfast",
    "port": 443,
    "https": true
  },
  "apps": {
    "lightfast-app":      { "packageName": "@lightfast/app",      "fallback": "https://lightfast.ai", "mfe": true  },
    "lightfast-www":      { "packageName": "@lightfast/www",      "fallback": "https://lightfast.ai", "mfe": true  },
    "lightfast-platform": { "packageName": "@lightfast/platform", "fallback": "https://lightfast.ai", "mfe": false }
  },
  "microfrontends": {
    "config": "apps/app/microfrontends.json"
  }
}
```

#### 3. Reduce `apps/app/microfrontends.json` to routing-only

**File**: `apps/app/microfrontends.json`

Drop `packageName` and `development.fallback` from each application (now in the registry, sans `devPort`). Keep only `routing` arrays, which `lightfast-www` uses for the marketing group:

```json
{
  "$schema": "https://openapi.vercel.sh/microfrontends.json",
  "applications": {
    "lightfast-app": {},
    "lightfast-www": {
      "routing": [
        { "group": "marketing", "paths": ["...existing list..."] }
      ]
    }
  }
}
```

dev-proxy synthesizes the rest from the registry. (Note: Phase 4's verification confirmed the Vercel schema requires either `development.fallback` or `routing` per entry, so a minimal `development.fallback` may be needed on the otherwise-empty MFE entry — inert at runtime since dev-proxy now synthesizes `applications` from the registry.)

#### 4. Add platform's `package.json` portless alias

**File**: `apps/platform/package.json:6`

Add `"portless": "platform.lightfast"` (mirror of `apps/app/package.json:7`, `apps/www/package.json:7`).

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm install` succeeds; `pnpm-lock.yaml` updates the four dev-* entries to `0.4.0`.
- [ ] `pnpm typecheck` passes (no callers touched yet).
- [ ] `loadAppRegistry` smoke check returns three entries without a `devPort` field (deep import via `dist/index.js`).
- [ ] `lightfast.dev.json` validates against the bundled `0.4.0` JSON Schema; the prior `devPort`-bearing version of the file fails validation against the same schema (regression check).
- [ ] `apps/app/microfrontends.json` still validates against `https://openapi.vercel.sh/microfrontends.json` (retain a minimal `development.fallback` on each MFE entry — inert at runtime since dev-proxy synthesizes `applications` from the registry).

#### Human Review:

- [ ] Boot `pnpm dev` (app+www only) on the **primary** worktree — both subdomains resolve, aggregate `lightfast.localhost` resolves; whatever physical ports Next bound to are visible in the dev banner but not pinned to specific numbers.
- [ ] Boot `pnpm dev` again in a **secondary** worktree without stopping the primary — both worktrees' subdomains resolve; the secondary's `next dev` instances bind on different physical ports than the primary's; no `EADDRINUSE`. This is the regression Phase 3.5 fixes.

#### Manual-verification gotcha (surfaced in Phase 7 docs)

A merge from `main` mid-session can revert `pnpm-lock.yaml` to the pre-bump state while leaving `pnpm-workspace.yaml` at the new catalog version — `node_modules` then go stale. Mitigation: re-run `pnpm install` after any catalog change or merge that touches `pnpm-workspace.yaml`. Phase 7 mentions this in the migration notes.

---

## Phase 5: Wire platform onto portless (lightfast)

### Overview

Now that the registry exists and `resolveProjectUrl("lightfast-platform")` returns `https://platform.lightfast.localhost`, remove the in-repo `localhost:4112` hardcode and the "platform is intentionally not on portless" carveout.

### Changes Required:

#### 1. `apps/app/src/origins.ts`

**File**: `apps/app/src/origins.ts:28-35`

Replace:

```ts
// platform is intentionally not on portless (raw :4112 in dev) — see CLAUDE.md
// "platform → http://localhost:4112 (raw backend; not yet on Portless / MFE)".
export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isLocal
    ? "http://localhost:4112"
    : "https://lightfast-platform.vercel.app",
});
```

With:

```ts
export const platformUrl = withRelatedProject({
  projectName: "lightfast-platform",
  defaultHost: isLocal
    ? resolveProjectUrl("lightfast-platform")
    : "https://lightfast-platform.vercel.app",
});
```

#### 2. `apps/platform/src/cors.ts`

**File**: `apps/platform/src/cors.ts:12-17`

The guard text references "portless daemon likely not running" which is still correct, but tightens slightly because `appUrl` resolution and the platform's own URL now share the same source. Update the message to reflect that running `pnpm dev:full` (or `pnpm dev:platform` after Phase 6) starts everything:

```ts
if (isDev && !isBuildPhase && canonicalAppOrigin === "https://lightfast.ai") {
  throw new Error(
    "[cors] appUrl resolved to production URL in dev; portless daemon likely not running. " +
      "Run `pnpm dev:full` or `pnpm dev:platform` (which start portless) before the platform server."
  );
}
```

Behavior unchanged otherwise; `isAllowedOrigin` (`cors.ts:23-49`) keeps using `devOriginPatterns` which now includes the `*.platform.lightfast.localhost` entry too.

#### 3. `apps/platform/src/origins.ts` — no changes

Both `appUrl` and `devOriginPatterns` already use `resolveProjectUrl` / `getPortlessProxyOrigins`, both of which are now registry-driven. No file edits required.

#### 4. `apps/app/src/__tests__/origins.test.ts` — update test assertion

**File**: `apps/app/src/__tests__/origins.test.ts:64-67`

The test currently asserts `expect(platformUrl).toBe("http://localhost:4112")`. After the Phase 5 origins.ts change, update to:

```ts
it("platformUrl resolves to the portless self URL", async () => {
  const { platformUrl } = await import("../origins");
  expect(platformUrl).toBe("https://platform.lightfast.localhost");
});
```

#### 5. `packages/app-test-data/src/config.ts` — update default

**File**: `packages/app-test-data/src/config.ts:4`

Currently: `const DEFAULT_PLATFORM_BASE_URL = "http://localhost:4112";`

Change to: `const DEFAULT_PLATFORM_BASE_URL = "https://platform.lightfast.localhost";`

Audit downstream consumers of `DEFAULT_PLATFORM_BASE_URL` — any test that mocks `fetch` against the literal `localhost:4112` host needs updating to the new portless host.

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm typecheck` passes.
- [ ] Grep verifies no `localhost:4112` literal remains in source/scripts/docs: `grep -rn "localhost:4112" apps packages scripts api package.json --include="*.ts" --include="*.tsx" --include="*.json" --include="*.mjs" --include="*.md"` returns only build-output (`.next/`, `.vercel/output/`) and historical thoughts/plans/research files.
- [ ] `apps/app` build succeeds: `pnpm build:app`.
- [ ] `apps/platform` build succeeds: `pnpm build:platform`.
- [ ] `apps/app` tests pass: `pnpm --filter @lightfast/app test` (the origins.test.ts update lands here).
- [ ] `packages/app-test-data` consumers' tests pass.

#### Human Review:

- [ ] Run `pnpm dev:full` (after Phase 6 wires `dev:platform`); open `https://app.lightfast.localhost` and trigger a tRPC request to platform → expect successful response and CORS headers echoing the app's portless origin (visible in DevTools Network tab).

---

## Phase 5b: Desktop TLS — auto-inject portless CA in `with-desktop-env.mjs` (lightfast)

### Overview

Adding `platform.lightfast.localhost` widens the surface where in-process Node `fetch` could hit `SELF_SIGNED_CERT_IN_CHAIN`. Per `thoughts/shared/research/2026-05-06-desktop-exchange-tls-portless.md` (open issue), the lowest-blast-radius fix is to inject `NODE_EXTRA_CA_CERTS=~/.portless/ca.pem` in `scripts/with-desktop-env.mjs` so Electron main's Node fetch trusts the portless CA. This phase folds that fix into this plan because the platform-on-portless migration would otherwise broaden exposure.

### Changes Required:

#### 1. `scripts/with-desktop-env.mjs` — set `NODE_EXTRA_CA_CERTS`

**File**: `scripts/with-desktop-env.mjs`

After the existing `LIGHTFAST_APP_ORIGIN` resolution (~line 101), check whether the resolved origin uses `https://*.localhost` (portless) and the CA exists. If both, set `NODE_EXTRA_CA_CERTS` (only if not already set by the caller):

```js
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const portlessCa = path.join(os.homedir(), ".portless/ca.pem");
const isPortlessOrigin = /https:\/\/[\w.-]+\.localhost/.test(resolvedOrigin);

if (isPortlessOrigin && existsSync(portlessCa) && !env.NODE_EXTRA_CA_CERTS) {
  env.NODE_EXTRA_CA_CERTS = portlessCa;
}
```

If the CA file is missing, log a warning pointing the user to start portless first — do not fail.

#### 2. Verify desktop `LIGHTFAST_APP_ORIGIN` resolution post-Phase-2

`with-desktop-env.mjs` resolves `LIGHTFAST_APP_ORIGIN` via `resolvePortlessMfeUrl` (`scripts/with-desktop-env.mjs:8,101`). With Phase 2's MFE-skip logic, when desktop runs against `dev:platform` alone the bare aggregate URL doesn't resolve. Confirm `resolvePortlessMfeUrl` returns a per-subdomain URL (e.g. `https://app.lightfast.localhost`), not the bare aggregate. If it returns the aggregate, change desktop's flow to resolve a specific subdomain.

### Success Criteria:

#### Automated Verification:

- [ ] `node scripts/with-desktop-env.mjs --print` outputs both the origin and the `NODE_EXTRA_CA_CERTS` value when portless CA exists.
- [ ] When `~/.portless/ca.pem` doesn't exist, `--print` warns but exits 0.

#### Human Review:

- [ ] Boot `pnpm dev:desktop` after `pnpm dev:full`. Sign in via Clerk → token exchange POST to `https://app.lightfast.localhost/api/desktop/auth/exchange` succeeds (no `SELF_SIGNED_CERT_IN_CHAIN`).

---

## Phase 6: Root dev scripts unify around the registry (lightfast)

### Overview

Replace the `--mfe-app` vs `--app-url` bifurcation with a single registry-driven `--register-app` flag. Move platform under `lightfast-dev proxy turbo` supervision so `dev:platform` and `dev:full` are now homogeneous. Convert ALL FOUR dev scripts at once (`dev`, `dev:app`, `dev:platform`, `dev:full`); `--mfe-app` and `--app-url` are removed entirely from these scripts in this phase, with one minor's worth of deprecation-warning runtime support in `dev-services.mjs` for any contributor running them by hand.

### Changes Required:

#### 1. Root `package.json` dev scripts — convert all four

**File**: `package.json:17-22`

Before (lines 17-21, abbreviated):

```json
"dev":          "node scripts/dev-services.mjs inngest-sync --mfe-app lightfast-app -- lightfast-dev proxy turbo ... -F @lightfast/app -F @lightfast/www ...",
"dev:app":      "node scripts/dev-services.mjs inngest-sync --mfe-app lightfast-app -- lightfast-dev proxy turbo ... -F @lightfast/app ...",
"dev:platform": "node scripts/dev-services.mjs inngest-sync --app-url lightfast-platform=http://localhost:4112 -- turbo run dev -F @lightfast/platform --continue",
"dev:full":     "node scripts/dev-services.mjs inngest-sync --mfe-app lightfast-app --app-url lightfast-platform=http://localhost:4112 -- lightfast-dev proxy turbo --local-app lightfast-www --local-app lightfast-app run dev --concurrency=15 -F @lightfast/www -F @lightfast/app -F @lightfast/platform --continue",
```

After:

```json
"dev":          "node scripts/dev-services.mjs inngest-sync --register-app lightfast-app -- lightfast-dev proxy turbo --local-app lightfast-app --local-app lightfast-www run dev -F @lightfast/app -F @lightfast/www --continue",
"dev:app":      "node scripts/dev-services.mjs inngest-sync --register-app lightfast-app -- lightfast-dev proxy turbo --local-app lightfast-app run dev -F @lightfast/app --continue",
"dev:platform": "node scripts/dev-services.mjs inngest-sync --register-app lightfast-platform -- lightfast-dev proxy turbo --local-app lightfast-platform run dev -F @lightfast/platform --continue",
"dev:full":     "node scripts/dev-services.mjs inngest-sync --register-app lightfast-app --register-app lightfast-platform -- lightfast-dev proxy turbo --local-app lightfast-www --local-app lightfast-app --local-app lightfast-platform run dev --concurrency=15 -F @lightfast/www -F @lightfast/app -F @lightfast/platform --continue",
```

Keep the existing `dev` and `dev:app` shape unchanged otherwise — the only delta is `--mfe-app` → `--register-app`.

`dev:platform` is now special: it is the only script that exercises Phase 2's MFE-skip path (only platform is local; the MFE proxy is not spawned). Verification covers both this case and the mixed case (`dev:full`).

#### 2. `scripts/dev-services.mjs` — add `--register-app`, remove `--mfe-app` and `--app-url`

**File**: `scripts/dev-services.mjs:410-455` (parseOptions) and `:342-379` (resolveInngestTargets)

Add `case "--register-app":` to `parseOptions` (which currently throws on unknown flags via `default: throw new Error(...)`). The flag pushes to a new `options.registerApps: string[]`.

In `resolveInngestTargets`:

```js
const proxy = await import("@lightfastai/dev-proxy");
const config = proxy.loadPortlessMfeConfigSync({ cwd: repoRoot });
const targets = options.registerApps.map(name => ({
  name,
  url: `${proxy.resolvePortlessAppUrl({ app: name, config })}${servePath}`,
}));
```

Remove the existing `options.mfeApps` and `options.appUrls` parsing and resolution. Add a `default:` arm in `parseOptions` that recognizes `--mfe-app` and `--app-url` and fails loudly with: `"--mfe-app and --app-url were removed in dev-proxy 0.4.0; use --register-app <name>."` — this surfaces immediately for anyone with stale local scripts.

#### 3. `apps/platform/package.json` dev script

**File**: `apps/platform/package.json:10`

Before:

```json
"dev": "pnpm with-env next dev --port 4112 --turbo",
```

After (consistent with `apps/app/package.json:13` and `apps/www/package.json:17` patterns):

```json
"dev": "pnpm with-env lightfast-dev proxy app -- next dev --turbo",
```

Drop the explicit `--port 4112`. portless injects `PORT=<allocated-port>` via `buildPortlessAppCommands --app-port`, where the allocated port is the worktree-aware hash output from Phase 3.5. Next.js respects `PORT`. The port differs across worktrees and across machines; consumers always navigate through `https://platform.lightfast.localhost` (or `https://<wt>.platform.lightfast.localhost`).

### Success Criteria:

#### Automated Verification:

- [ ] `pnpm dev:platform` boots and `https://platform.lightfast.localhost` resolves:

  ```bash
  pnpm dev:platform > /tmp/dev-platform.log 2>&1 &
  sleep 30 && curl -k -s -o /dev/null -w "%{http_code}\n" https://platform.lightfast.localhost
  pkill -f "next dev"
  ```

  Expected: HTTP 200 (or 308/redirect from middleware).
- [ ] `pnpm dev:platform`'s log contains the runtime warning from Phase 2 about skipping the MFE proxy.
- [ ] `pnpm dev:platform` does NOT bind the `localProxyPort` (the port that would have been claimed by the MFE proxy). Verify with `lsof -iTCP:<port>` returning nothing.
- [ ] `pnpm dev:full` boots all three apps and each `<sub>.lightfast.localhost` URL resolves; `https://lightfast.localhost` (the bare aggregate) ALSO resolves because MFE apps are present.
- [ ] `apps/platform/package.json` `dev` script no longer hardcodes `--port 4112`.
- [ ] `grep -rn "localhost:4112" package.json scripts/ apps/ 2>/dev/null` returns zero matches (raw port references gone from runtime sources).
- [ ] `node scripts/dev-services.mjs inngest-sync --register-app lightfast-platform -- echo ok` (smoke run) produces an Inngest target URL matching `https://platform.lightfast.localhost`.
- [ ] `node scripts/dev-services.mjs inngest-sync --mfe-app lightfast-app -- echo ok` exits non-zero with the documented removal message.

#### Human Review:

- [ ] During `pnpm dev:full`, verify in the platform's startup logs that no "[cors] appUrl resolved to production URL" guard fires → log shows the platform's Next dev banner with the portless URL, not a thrown error.
- [ ] Trigger a tRPC request from the desktop renderer (running `pnpm dev:desktop`) and confirm the request reaches platform via the bearer/origin path. Origin allowlist should still include `localhost:<vite>` for the renderer.

---

## Phase 7: Docs + handoff (lightfast)

### Overview

Reflect the new architecture in CLAUDE.md, update the cross-referenced research doc, and create a handoff so the next contributor can navigate the new model.

### Changes Required:

#### 1. `CLAUDE.md` architecture diagram

**File**: `CLAUDE.md:11-43`

Update the architecture box: platform moves from the "raw; not on Portless / MFE" line into the portless aggregate section. New shape:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Local dev — Portless HTTPS aggregate (port 443)                                 │
│  https://[<wt>.]lightfast.localhost                                              │
│      │                                                                           │
│      ├─ app       https://[<wt>.]app.lightfast.localhost                         │
│      │           @api/app · MFE · default group                                  │
│      ├─ www       https://[<wt>.]www.lightfast.localhost                         │
│      │           marketing + docs · MFE · marketing group                        │
│      └─ platform  https://[<wt>.]platform.lightfast.localhost                    │
│                  @api/platform · NON-MFE · OAuth/webhooks/neural pipeline        │
│                                                                                  │
│  Physical ports are allocated per (worktree, app) by dev-proxy's hash + linear   │
│  probe; never pinned in config. Always navigate via the portless URLs above.     │
│                                                                                  │
│  Source of truth                                                                 │
│  ─────────────────                                                               │
│  Apps registry:  lightfast.dev.json `apps` (per-app: packageName, mfe)           │
│  MFE mesh:       apps/app/microfrontends.json (path routing for mfe:true apps)   │
│  ...                                                                             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Agent skill docs

**Files**: `.agents/skills/lightfast-inngest/SKILL.md:61` and `.claude/skills/lightfast-inngest/SKILL.md:61`

Both files reference platform's URL as `http://localhost:4112/api/inngest` in the platform sync target table. Update to `https://platform.lightfast.localhost/api/inngest`.

#### 3. Research follow-up

**File**: `thoughts/shared/research/2026-05-07-dev-proxy-non-mfe-portless.md`

Add a `## Update — 2026-MM-DD` section at the bottom that links to this plan and the cut dev-proxy version, marking the three Open Questions as resolved with the answers from the plan creation.

**File**: `thoughts/shared/research/2026-05-06-desktop-exchange-tls-portless.md`

Mark the open issue resolved by Phase 5b's `with-desktop-env.mjs` change.

#### 4. Handoff

**File**: `thoughts/shared/handoffs/general/<timestamp>_dev-proxy-dynamic-mfe.md` (new)

Per the repo's handoff template; reference the dev-harness PR, the lightfast PR, and the architecture diagram.

### Success Criteria:

#### Automated Verification:

- [ ] CLAUDE.md still parses as valid markdown (`npx markdownlint CLAUDE.md` or equivalent if part of repo's lint pipeline).
- [ ] No broken references: `grep -rn "localhost:4112" CLAUDE.md .agents/skills .claude/skills` returns zero matches.

#### Human Review:

- [ ] Read CLAUDE.md top-to-bottom: the architecture diagram is internally consistent, no contradictions with `lightfast.dev.json`, no stale "platform is not on portless" claims anywhere.

---

## Testing Strategy

### Unit Tests (dev-harness, Phases 0–3):

- `loadAppRegistry`: registry happy path, missing-`apps` throws, missing-`mfe`-flag schema error.
- `synthesizeApplicationsFromRegistry`: snapshot match against today's `microfrontends.json applications` shape.
- `getPortlessProxyOrigins`: includes non-MFE entries.
- `resolvePortlessAppUrl`: works for any registered app.
- `buildInngestDevSyncTargetsFromRegistry`: emits targets for all entries.
- `startDevProxyTurboCommand`:
  - Mixed locals (MFE + non-MFE): filters MFE proxy participants, spawns proxy and aggregate route.
  - Non-MFE-only locals: SKIPS MFE proxy + aggregate route entirely; warning emitted.
- `startDevProxyAppCommand`: resolves `appPort` from registry's `devPort` for non-MFE apps.

### Integration Tests:

- `dev-harness/example/apps/platform/` fixture: `lightfast-dev proxy turbo --local-app example-platform run dev -F @example/platform` boots without spawning the MFE proxy; the portless route for the platform subdomain resolves.
- Lightfast end-to-end smoke (Phase 6): `pnpm dev:platform` (non-MFE-only path) and `pnpm dev:full` (mixed path) — both verified via curl.
- Desktop TLS smoke (Phase 5b): `pnpm dev:desktop` token exchange POST to portless TLS host succeeds.

## Performance Considerations

No runtime hot-path changes. The registry is loaded once per dev session at process startup.

## Migration Notes

`lightfast.dev.json` is rewritten in a single commit during Phase 4. There's no rolling migration — the catalog bump, the config change, and the `microfrontends.json` reduction ride together.

There is **no back-compat fallback** in `dev-proxy@0.3.0`. Configs missing `apps` throw the documented error message. Lightfast is the primary consumer; other downstream consumers are responsible for updating their `lightfast.dev.json` when they pull the bump.

If a contributor pulls the lightfast change without first updating their `node_modules`, they'll see "Unknown property `apps`" from the schema validator — easy to spot and fix with `pnpm install`.

The `--mfe-app` and `--app-url` flags in `dev-services.mjs` are removed in this same change. Anyone running stale local scripts gets a fail-loud error message pointing to `--register-app`.

`apps/app/microfrontends.json` is reduced to routing-only. If contributors had local clones with custom `applications` entries, they need to migrate those to `lightfast.dev.json` `apps`.

## References

- Original research: `thoughts/shared/research/2026-05-07-dev-proxy-non-mfe-portless.md`
- Related research: `thoughts/shared/research/2026-05-06-architecture-reset-barebones.md`, `thoughts/shared/research/2026-05-06-desktop-exchange-tls-portless.md`
- Schema today: `dev-harness/packages/dev-proxy/schema/config.schema.json`
- Iteration sites today: `dev-harness/packages/dev-proxy/src/index.ts:485-572,852,1206-1220`
- Per-app portless registration today: `dev-harness/packages/dev-proxy/src/runtime.ts:314-377,472-497`
- Aggregate-route registration today: `dev-harness/packages/dev-proxy/src/runtime.ts:131-141,499-520`
- Platform's current carveout: `apps/app/src/origins.ts:28-35`, `apps/platform/src/cors.ts:12-17`
- Inngest sync workaround: `package.json:20-21`, `scripts/dev-services.mjs:297-340`
- Portless CLI surface: `node_modules/portless/README.md` (commands at line 307; `alias` at 314; subdomains at 167-179)

---

## Improvement Log

### 2026-05-07 — adversarial review pass

Plan revised after `/improve_plan` review. Key changes:

**Design simplifications**
- **Eliminated dual sources of truth**: `microfrontends.json applications` no longer authoritative. The registry is the single source; dev-proxy synthesizes `applications` from `apps[mfe=true]` entries in-memory. `microfrontends.json` reduced to routing-only. Phase 0 removes the bijection-validation rules (3 throws collapsed into 0); Phase 4 reduces `apps/app/microfrontends.json` to routing arrays. Eliminates `packageName` duplication.
- **Dropped back-compat path** (`source: "derived-from-microfrontends"`): require explicit `apps` in `lightfast.dev.json`, fail loudly on missing. Lightfast is the primary consumer; defensive future-proofing was untested-by-real-consumer code. Removes ~30% of Phase 0.
- **Dropped `proxy alias` subcommand**: scope creep; no phase had a workflow that used it. Removed from Phase 2.
- **Dropped `resolvePortlessApplicationUrl` deprecation alias**: minor versions can rename. Phase 1 removes the old export entirely.

**Spike result (CONFIRMED)** — *MFE proxy zero-locals behavior*
- **Hypothesis**: When zero MFE apps are local, `startDevProxyTurboCommand` should skip spawning `startMicrofrontendsProxy` AND `buildPortlessRouteCommands`.
- **Verdict**: CONFIRMED — required change. Reading `runtime.ts:124-141` shows both are spawned unconditionally. With empty `applications`, `createVercelMicrofrontendsDevConfig` returns empty maps but still claims a `localProxyPort`; behavior of `@vercel/microfrontends` with empty config is undefined.
- **Plan impact**: Phase 2 now has an explicit `if (hasMfeApps)` guard around the MFE-proxy + aggregate-route spawn. Runtime warning emitted on the skip path. Risk noted: bare aggregate `https://lightfast.localhost` doesn't resolve in non-MFE-only mode; per-subdomain URLs are unaffected.

**TLS sequencing — folded into plan**
- New **Phase 5b**: auto-inject `NODE_EXTRA_CA_CERTS=~/.portless/ca.pem` in `scripts/with-desktop-env.mjs`. Cited 2026-05-06 research's option 1 (lowest-blast-radius fix). Adding `platform.lightfast.localhost` widens Node-fetch TLS exposure; folding the fix in prevents a regression window.

**Flag migration — fully consolidated**
- Phase 6 converts ALL FOUR dev scripts (`dev`, `dev:app`, `dev:platform`, `dev:full`) at once. `--mfe-app` and `--app-url` removed from scripts and from `dev-services.mjs`'s parser; stale local scripts get a fail-loud error pointing to `--register-app`.

**Critical findings — file additions to phases**
- Phase 5: added `apps/app/src/__tests__/origins.test.ts:64-67` (test asserts `localhost:4112`; would silently break) and `packages/app-test-data/src/config.ts:4` (`DEFAULT_PLATFORM_BASE_URL` constant) to "Changes Required". Original grep success criterion would have caught the test but not the test-data constant.
- Phase 7: added `.agents/skills/lightfast-inngest/SKILL.md:61` and `.claude/skills/lightfast-inngest/SKILL.md:61` (both reference platform's URL).
- Phase 4: added a port-verification step before committing the explicit `devPort` values for `lightfast-app`/`lightfast-www`. The original plan hardcoded 4107/4101 without proof these match the current hash allocator's output.
- Phase 0: explicit treatment of the schema's root `additionalProperties: false` constraint — added regression test.

**Removed dead weight**
- `TODO: automate via Playwright smoke` markers from Phase 5/6 success criteria.

### 2026-05-07 — Phase 4 manual-verification findings

**Single-worktree dev — PASSED.** `pnpm dev` boots both apps on the pinned registry ports; portless URLs resolve (HTTP 307/200/200); `MFE_CONFIG` is synthesized to match the registry. The "no surprise port changes after upgrade" goal is verified for the primary worktree.

**Multi-worktree dev — REGRESSED. Deferred to a new Phase 4b.** Running `pnpm dev` in a secondary worktree fails with `EADDRINUSE :::5502 / :::6868`. Pre-Phase-4, `appPorts` were hash-allocated with `seed = host === baseHost ? appName : ${host}:${appName}`, giving each worktree distinct ports automatically. Phase 4's fixed `entry.devPort` shares one value across all worktrees, and portless's `--app-port <fixed>` skips per-worktree auto-assignment. portless still detects the worktree prefix correctly and routes `<wt>.app.lightfast.localhost` — the failure is purely the `next dev` port collision, not the URL/routing layer. Resolved by `2026-05-07-dev-proxy-host-keyed-ports.md` (Option 3 schema, Option 2 mechanism — host-keyed `choosePort`).

**Releases produced during Phase 4**:
- `@lightfastai/dev-* 0.3.0` — initial cut from Phase 3's changeset (registry + non-MFE supervisor work).
- `@lightfastai/dev-* 0.3.1` — patch dropping `[key: string]: unknown` index signatures from `NextConfigWithPortlessProxy.experimental.{,serverActions}`. Required to pass `apps/app` typecheck against Next 16's `ExperimentalConfig` (which has no index signature). 0.3.0 was DOA for downstream Next-16 consumers; 0.3.1 is the practical floor.

**Manual-verification gotcha worth surfacing in Phase 7 docs**: a mid-session merge from `main` reverted `pnpm-lock.yaml` to pre-bump state while leaving `pnpm-workspace.yaml` at `^0.3.1`; node_modules were stale at 0.2.1. The first `pnpm dev` failed cryptically (`Dev proxy app command must be run from exactly one configured app directory`) because the 0.2.1 runtime parsed our reduced `microfrontends.json` (no `packageName`) and lost the cwd-to-app mapping. **Mitigation**: always re-run `pnpm install` after any merge or rebase that touches the workspace catalog; document this in Phase 7's migration notes.

### 2026-05-08 — multi-worktree regression: `devPort` removed; allocator restored

The Phase 4b "decide between three fix options" block is closed. **Decision: drop `devPort` entirely from the registry** (option 3 from the prior log entry). New phase **Phase 3.5** lands the corrective dev-proxy work and cuts `dev-proxy@0.4.0`.

**Why option 3 over options 1 and 2**
- The user's stated requirement is "I don't care what ports are assigned on any worktree or main… all I care is they all start and have portless URLs." Pinning is not a goal; it was a misread of the SSoT principle. The registry is the SSoT for *identity*, not for the OS port namespace (which is a process-local resource).
- Option 1 (hybrid pin-on-primary, auto-assign-on-secondary) introduces two code paths and asymmetric semantics; primary contributors would see different ports than CI, secondary worktrees, and other devs. More surface area for confusion.
- Option 2 (keep `devPort` as docs-only) leaves a dead field in the schema that future readers will assume is load-bearing. Better to remove.
- Option 3 unifies MFE and non-MFE handling under one allocator and matches the 0.2.x worktree-distinct behavior that already worked for MFE apps.

**Plan deltas**
- **Phase 0**: marked `[DONE — partially superseded by Phase 3.5]` with a callout explaining the regression. The schema/types/iteration-site descriptions in Phase 0 reflect what 0.3.0 shipped; the real behavior in 0.4.0 is in Phase 3.5.
- **Phase 3.5 (new)**: drop `devPort` from schema + `AppEntry`; restore the seeded `generateMicrofrontendsPort(seed)` callsite at `index.ts:758`; apply the same allocator to the non-MFE branch in `runtime.ts:367`; cut `0.4.0` via the existing `fixed` changeset group.
- **Phase 4**: catalog bumps to `^0.4.0`. `lightfast.dev.json` rewritten without `devPort`. The "verify ports" sub-step is deleted entirely — there are no ports to verify. Success criteria reset to unchecked since the registry shape changes.
- **Phase 6**: `apps/platform/package.json` dev script still drops `--port 4112`; the prose now reflects that the injected port is hash-allocated, not the registry's `devPort`.
- **Phase 7**: CLAUDE.md architecture diagram drops the `(raw :NNNN)` annotations and adds a one-line note that physical ports are allocated per (worktree, app), never pinned. The `apps registry` line is updated to `(per-app: packageName, mfe)`.

**Why this is safe to ship as a `0.4.0` minor (not a `0.3.x` patch)**
- `apps[*].devPort` was required in 0.3.x and is now rejected by the schema. That's a breaking config change — minor bump per semver.
- Lightfast is the primary consumer; the catalog bump and the `lightfast.dev.json` rewrite ride together in Phase 4. No other downstream consumers exist today.

**Verification gates added**
- New automated test: with two distinct hosts (`lightfast.localhost` vs. `wt2.lightfast.localhost`), the same app name resolves to different ports.
- New schema regression test: `apps[*].devPort` is rejected in 0.4.0.
- New human-review item in Phase 4: boot two worktrees in parallel, both resolve, no `EADDRINUSE`. This is the gate that the original Phase 4 manual run failed.

