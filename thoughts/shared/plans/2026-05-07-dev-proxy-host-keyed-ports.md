---
date: 2026-05-07
author: claude
git_commit: de7ce7f98c30f5f1db5400979a75b64a384d638e
branch: refactor/repo-barebones-reset-v2
status: draft
tags: [plan, dev-proxy, portless, microfrontends, multi-worktree, regression-fix]
---

# Host-keyed dev-proxy ports (multi-worktree fix) Implementation Plan

## Overview

Drop `devPort` from the `apps` registry entirely and resolve every app's dev port deterministically from `(host, appName)`. The supervisor and per-app commands compute identical ports without file-coordination because the function is pure. Per-worktree the host is per-worktree (portless already detects the prefix), so ports automatically diverge across worktrees and `next dev` instances stop colliding on shared TCP ports.

This is the follow-up to the regression discovered in manual verification of `2026-05-07-dev-proxy-dynamic-mfe-non-mfe.md` Phase 4: a second worktree could not boot because `--app-port <fixed>` from the registry told portless to bind the same TCP port that the primary worktree's `next dev` already owned.

## Current State Analysis

After the parent plan (`@lightfastai/dev-proxy@0.3.x`):

- `lightfast.dev.json` declares `apps[<name>].devPort: <int>` for each app (`lightfast.dev.json:11,17,23` — 5502/6868/4112).
- Schema (`dev-harness/packages/dev-proxy/schema/config.schema.json:40`) makes `devPort` a required field on every entry.
- Supervisor (`dev-harness/packages/dev-proxy/src/index.ts:758`) builds `appPorts` straight from `entry.devPort` for MFE entries.
- Per-app command (`dev-harness/packages/dev-proxy/src/runtime.ts:367`) reads `entry.devPort` directly and passes it to portless via `buildPortlessAppCommands --app-port <fixed>`.
- portless's `--app-port` skips its own auto-assignment (`node_modules/portless/README.md:351`), so two worktrees both bind the same TCP port and the second `next dev` fails with `EADDRINUSE`.

What still works on a single worktree (proven in Phase 4 manual verification):

- portless prefix detection from git branch (`packages/dev-proxy/src/index.ts:1107` — `defaultDetectWorktreePrefix`) correctly produces `<wt>.app.lightfast.localhost`.
- `microfrontends.local.json` is per-checkout (lives in each worktree's tree).
- The MFE proxy reads `applications.{name}.development.local` from that file and dispatches correctly.
- `generateMicrofrontendsPort(seed)` is exported but not actually called from anywhere in `src/` — historical dead path; current code allocates app ports purely from `entry.devPort`.
- **`resolveLocalProxyPort` (`index.ts:1165-1185`) already implements the host-keyed pattern we want for app ports.** It calls `choosePort(\`${host}:proxy\`, { min, max, usedPorts, portAvailable })`, where `choosePort` (`index.ts:1187-1219`) hashes the seed via `positiveHash`, picks a starting offset in the range, and linear-probes past unavailable TCP ports. App-port allocation should reuse `choosePort` with seed `${host}:appName` to stay symmetric with proxy-port allocation.

The parent plan's "Open Regression" block (`2026-05-07-dev-proxy-dynamic-mfe-non-mfe.md:509-520`) lists three fix shapes. This plan implements **Option 3's schema** (registry stores only `packageName + mfe`) **driven by Option 2's mechanism** (host-keyed deterministic hash via the existing `choosePort` primitive). The two are complementary: Option 3 is the public contract, Option 2 is the implementation.

## Desired End State

`lightfast.dev.json`:

```json
{
  "$schema": "./node_modules/@lightfastai/dev-proxy/schema/config.schema.json",
  "portless": { "name": "lightfast", "port": 443, "https": true },
  "apps": {
    "lightfast-app":      { "packageName": "@lightfast/app",      "fallback": "https://lightfast.ai", "mfe": true  },
    "lightfast-www":      { "packageName": "@lightfast/www",      "fallback": "https://lightfast.ai", "mfe": true  },
    "lightfast-platform": { "packageName": "@lightfast/platform", "fallback": "https://lightfast.ai", "mfe": false }
  },
  "microfrontends": { "config": "apps/app/microfrontends.json" }
}
```

`@lightfastai/dev-proxy@0.4.0`:

- Schema's per-entry `required` is `["packageName", "mfe"]`; `devPort` is no longer recognized (rejected by `additionalProperties: false`).
- `AppEntry` and `AppRegistryEntryConfig` types lose the `devPort` field.
- New helper `resolveBaseHost(config, env?)` returns `${config.portless.name}.${tld}` from a single source of truth (replaces 3 inline duplicates today: `index.ts:522`, `index.ts:1402`, plus the new call sites).
- New helper `resolveAppPort({ appName, host, baseHost, usedPorts?, range?, portAvailable? }): Promise<number>` calls `choosePort(seed, ...)` with `seed = host === baseHost ? appName : \`${host}:${appName}\``. Same primitive `resolveLocalProxyPort` uses; the `portAvailable` linear-probe gives birthday-paradox safety automatically.
- Supervisor (`createVercelMicrofrontendsDevConfig`) computes `appPorts` via the resolver, threading a `usedPorts` set across MFE entries to avoid same-batch collisions.
- Per-app command (`startDevProxyAppCommand`) computes `appPort` via the resolver for both MFE and non-MFE entries.

Verification:

- `pnpm dev` boots cleanly in two worktrees concurrently. Each gets distinct portless URLs (`https://app.lightfast.localhost` and `https://<wt>.app.lightfast.localhost`) and distinct `next dev` ports. Neither `next dev` crashes with `EADDRINUSE`.
- `apps/platform/package.json`'s `dev` script no longer hardcodes `--port 4112`. The platform's `next dev` listens on the hash-derived port that portless injects via `PORT`.
- `https://platform.lightfast.localhost` resolves on the primary worktree; `https://<wt>.platform.lightfast.localhost` resolves on a linked worktree.

### Key Discoveries:

- The 0.2.x seed `host === baseHost ? appName : ${host}:${appName}` is the correct shape: it gives stable ports on the primary worktree (good DX, restartable, matches muscle memory if anything was hardcoded against it before) and per-worktree-distinct ports on linked worktrees.
- `choosePort(seed, { min, max, usedPorts, portAvailable })` already exists at `packages/dev-proxy/src/index.ts:1187-1219` and is the primitive `resolveLocalProxyPort` already uses. Reusing it for app ports gives free birthday-paradox protection: the `portAvailable` linear-probe slides past any occupied TCP port, so cross-worktree hash collisions self-recover instead of producing `EADDRINUSE`.
- `choosePort` accepts a `usedPorts: Set<number>` for within-batch collision-avoidance. The supervisor threads one across MFE entries; the per-app command resolves a single entry so an empty set is fine.
- `createVercelMicrofrontendsDevConfig` is called by both the supervisor (`runtime.ts:99`) AND the per-app command in MFE mode (`runtime.ts:372`). The per-app MFE invocation is guarded by `write: !appEnv.VC_MICROFRONTENDS_CONFIG`, so when the supervisor has already written `microfrontends.local.json` the per-app re-resolves but does not overwrite. Because the resolver is deterministic on `(host, appName)` (modulo unavailable-port skipping, which both call sites observe identically since `next dev` doesn't bind until after both have computed), both paths agree on the port without IPC.
- portless's `--app-port` still gets passed (we want explicit binding so the MFE proxy's `appPorts` agree with what `next dev` listens on). The hash makes the value per-worktree, so the EADDRINUSE no longer happens.
- Cross-worktree hash collisions in `[3000, 8000)` over ~3 apps × N worktrees are rare; with `portAvailable` probing they're invisible. Without probing (the rejected design), recovery would have meant renaming a branch or killing the colliding process.
- `apps/app/microfrontends.json` and the MFE routing rules are unaffected — only the port allocation changes.

## What We're NOT Doing

- NOT keeping `devPort` as an optional pin. The schema strictly rejects it; lightfast updates `lightfast.dev.json` in the same release.
- NOT touching the parent plan's design (registry as source of truth for app identity, `mfe` flag, MFE-skip behavior, Phase 5b TLS work). All of that stands.
- NOT changing portless's `--app-port` strategy. We still pass an explicit value; the difference is the value is now host-derived.
- NOT introducing file-coordination across worktrees (Option C). Worktrees stay independent by construction; the `portAvailable` probe in `choosePort` is local to each process and avoids EADDRINUSE without any cross-process state.
- NOT introducing a new port-allocation primitive. We reuse `choosePort` (the same function `resolveLocalProxyPort` calls). The `generateMicrofrontendsPort` export — which is unused inside `src/` today — stays as-is for any external consumers that import it directly.
- NOT migrating other dev-proxy consumers. Lightfast is the primary consumer and updates in lockstep.
- NOT rewriting the parent plan's Phase 4 verification (already passed for single-worktree). Only the multi-worktree scenario is in scope here.

## Implementation Approach

Land dev-harness changes (Phases 0–1) → cut `@lightfastai/dev-*@0.4.0` → adopt in lightfast (Phases 2–4). Each dev-harness phase is independently testable in `dev-harness/example/`. Phase 3 is the multi-worktree verification that proves the regression is fixed.

The change is small in surface area but cuts across schema, types, loader, two runtime entry points, and the lightfast config + scripts. Phase 0 lands the entire dev-proxy edit as one atomic diff (schema/types/loader removal + `resolveBaseHost` + `resolveAppPort` + supervisor + per-app wiring). The build is never intentionally broken at a phase boundary.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 0: Drop `devPort`, add host-keyed resolvers, wire supervisor + per-app (dev-harness)

### Overview

One atomic dev-harness diff: schema + types + loader lose `devPort`; new `resolveBaseHost` and `resolveAppPort` helpers go in next to the existing `resolveLocalProxyPort` (same primitive, same shape); supervisor and per-app command call them. Build stays green throughout — no deliberate-breakage phase boundary.

### Changes Required:

#### 1. JSON schema

**File**: `dev-harness/packages/dev-proxy/schema/config.schema.json`

Drop `devPort` from `apps[*].required` and from `apps[*].properties`. The per-entry `additionalProperties: false` then strictly rejects any `devPort` field, which is the migration signal we want.

```diff
       "additionalProperties": false,
-      "required": ["packageName", "devPort", "mfe"],
+      "required": ["packageName", "mfe"],
       "properties": {
         "packageName": { "type": "string", "minLength": 1 },
-        "devPort":     { "type": "integer", "minimum": 1, "maximum": 65535 },
         "portlessName":{ "type": "string", "minLength": 1 },
         "fallback":    { "type": "string", "format": "uri" },
         "mfe":         { "type": "boolean" }
       }
```

#### 2. Types

**File**: `dev-harness/packages/dev-proxy/src/index.ts:31-47`

Drop `devPort` from `AppRegistryEntryConfig` and `AppEntry`:

```diff
 export interface AppRegistryEntryConfig {
   packageName: string;
-  devPort: number;
   portlessName?: string;
   fallback?: string;
   mfe: boolean;
 }

 export interface AppEntry {
   name: string;
   packageName: string;
-  devPort: number;
   portlessName: string;
   fallback: string;
   mfe: boolean;
   routing?: unknown[];
 }
```

#### 3. Loader

**File**: `dev-harness/packages/dev-proxy/src/index.ts:373-396` and `:418-436`

Drop the `devPort: raw.devPort` line in the loader. Drop the `devPort` validation branch in `validateAppRegistryEntry` (the schema's `additionalProperties: false` does the same job at parse time, with a better error path).

```diff
 function validateAppRegistryEntry(name: string, raw: AppRegistryEntryConfig): void {
   if (!raw || typeof raw !== "object") {
     throw new Error(`apps.${name} must be an object.`);
   }
   if (typeof raw.packageName !== "string" || !raw.packageName.trim()) {
     throw new Error(`apps.${name}.packageName must be a non-empty string.`);
   }
-  if (
-    typeof raw.devPort !== "number" ||
-    !Number.isInteger(raw.devPort) ||
-    raw.devPort < 1 ||
-    raw.devPort > 65535
-  ) {
-    throw new Error(`apps.${name}.devPort must be an integer between 1 and 65535.`);
-  }
   if (typeof raw.mfe !== "boolean") {
     throw new Error(`apps.${name}.mfe must be a boolean.`);
   }
 }
```

```diff
     const entry: AppEntry = {
       name,
       packageName: raw.packageName,
-      devPort: raw.devPort,
       portlessName,
       fallback,
       mfe: raw.mfe,
       ...(routing ? { routing } : {}),
     };
```

#### 4. `resolveBaseHost` helper (dedupe inline `${name}.${tld}` constructions)

**File**: `dev-harness/packages/dev-proxy/src/index.ts` (new export, near `resolvePortlessHost`)

`baseHost = ${portlessName}.${tld}` is currently inlined at `index.ts:522` (in `resolveRuntimeIdentity`) and `index.ts:1402` (in `portlessUrlMatchesName`). Add a single helper and route both existing sites plus the new supervisor/per-app sites through it.

```ts
export function resolveBaseHost(
  config: NormalizedDevProxyConfig,
  env: Env = process.env,
): string {
  const tld = env.PORTLESS_TLD || config.portless.tld;
  return `${config.portless.name}.${tld}`;
}
```

Update `resolveRuntimeIdentity` and `portlessUrlMatchesName` to call it. (Both already have `config` and `env` in scope; `portlessUrlMatchesName` accepts a `name` parameter — leave that signature alone if downstream consumers exist, but inside the function delegate to `resolveBaseHost` when `name === config.portless.name`.)

#### 5. `resolveAppPort` helper (host-keyed, reuses `choosePort`)

**File**: `dev-harness/packages/dev-proxy/src/index.ts` (new export, next to `resolveLocalProxyPort` at line 1165)

Mirrors `resolveLocalProxyPort`: takes a host, hashes a host-scoped seed, asks `choosePort` to pick a deterministic port (probing past unavailable TCP ports automatically). The proxy port and app port now use one primitive.

```ts
export interface ResolveAppPortOptions {
  appName: string;
  host: string;
  baseHost: string;
  range?: NormalizedPortRange;
  usedPorts?: Set<number>;
  portAvailable?: PortAvailable;
}

export async function resolveAppPort({
  appName,
  host,
  baseHost,
  range = DEFAULT_MFE_APP_PORT_RANGE,
  usedPorts = new Set<number>(),
  portAvailable = isPortAvailable,
}: ResolveAppPortOptions): Promise<number> {
  const seed = host === baseHost ? appName : `${host}:${appName}`;
  return choosePort(seed, {
    min: range.min,
    max: range.max,
    usedPorts,
    portAvailable,
  });
}
```

Notes:
- Returns a `Promise<number>` because `choosePort` does a TCP probe. Both call sites are already async (`createVercelMicrofrontendsDevConfig` already `await`s `resolveLocalProxyPort`; `startDevProxyAppCommand` already `await`s `loadPortlessMfeConfig`).
- No `appName` non-empty guard, no `minPort`/`maxPort` knobs — the registry guarantees `appName`, and `range` is sufficient. Per CLAUDE.md: don't add error handling for cases that can't happen, don't add features beyond what the task requires.

#### 6. Supervisor — replace `entry.devPort`

**File**: `dev-harness/packages/dev-proxy/src/index.ts:702-810` (`createVercelMicrofrontendsDevConfig`)

```diff
   const host = resolvePortlessHost({ /* unchanged */ });
+  const baseHost = resolveBaseHost(normalized, env);
   const localProxyPort = await resolveLocalProxyPort(host, { /* unchanged */ });
   /* ... */
-  const appPorts = Object.fromEntries(mfeEntries.map((entry) => [entry.name, entry.devPort]));
+  const usedPorts = new Set<number>([localProxyPort]);
+  const appPorts: Record<string, number> = {};
+  for (const entry of mfeEntries) {
+    const port = await resolveAppPort({
+      appName: entry.name,
+      host,
+      baseHost,
+      usedPorts,
+      portAvailable,
+    });
+    appPorts[entry.name] = port;
+    usedPorts.add(port);
+  }
```

Threading `localProxyPort` into the initial `usedPorts` prevents the proxy port and any app port from colliding within the same supervisor process. Threading the set across MFE entries prevents two apps from picking the same port in one resolution batch — `choosePort` linear-probes past anything in the set.

#### 7. Per-app command — compute `appPort` via resolver

**File**: `dev-harness/packages/dev-proxy/src/runtime.ts:332-408` (`startDevProxyAppCommand`)

```diff
   const config = await loadPortlessMfeConfig({ cwd, configPath });
   const registry = loadAppRegistry(config);
   const appEnv = withExistingMicrofrontendsProxyPort(promoteDevProxyAppCommandEnv(env));
   /* ... locate appName via inferLocalAppNames ... */
   const entry = registry.byName[appName];
   if (!entry) { /* unchanged throw */ }

   const portlessName = entry.portlessName;
-  const appPort = entry.devPort;
+  const baseHost = resolveBaseHost(config, appEnv);
+  const host = resolvePortlessHost({
+    name: portlessName,
+    cwd: config.root,
+    env: appEnv,
+    config,
+  });
+  const appPort = await resolveAppPort({ appName, host, baseHost });
```

Notes:
- For non-MFE apps, `host` is the per-app portless host (`<wt>.platform.lightfast.localhost` on a worktree, `platform.lightfast.localhost` on primary). Different per-worktree → different seed → different port.
- For MFE apps in supervisor mode, the supervisor has already written `microfrontends.local.json` with the same port (deterministic on `(host, appName)`). The per-app resolver call agrees with the supervisor without IPC. If `portAvailable` skips a port in the supervisor due to a race with another worktree, the per-app call observes the same TCP state and skips identically.

#### 8. Sandbox fixture

**File**: `dev-harness/lightfast.dev.json`

Drop the three `devPort` fields. Schema validation passes under the new schema; the resolver fills in ports at runtime.

```diff
   "apps": {
-    "app":      { "packageName": "@example/app",      "devPort": 4101, "fallback": "https://app.example.com",      "mfe": true  },
-    "www":      { "packageName": "@example/www",      "devPort": 4102, "fallback": "https://www.example.com",      "mfe": true  },
-    "platform": { "packageName": "@example/platform", "devPort": 4103, "fallback": "https://platform.example.com", "mfe": false }
+    "app":      { "packageName": "@example/app",      "fallback": "https://app.example.com",      "mfe": true  },
+    "www":      { "packageName": "@example/www",      "fallback": "https://www.example.com",      "mfe": true  },
+    "platform": { "packageName": "@example/platform", "fallback": "https://platform.example.com", "mfe": false }
   }
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness --filter @lightfastai/dev-proxy typecheck` clean.
- [x] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness --filter @lightfastai/dev-proxy build` clean.
- [x] Smoke: `cd dev-harness && pnpm dev` boots; `microfrontends.local.json` shows `applications.app.development.local=4782` and `applications.www.development.local=6144` (both in `[3000, 8000)`, pairwise distinct, distinct from `localProxyPort=9203`). `next dev` processes verified listening on 4782 and 6144; MFE proxy listening on 9203. Programmatic resolver also confirmed worktree-distinct ports (`feature-x` worktree → `app=6948 www=5586 proxy=9344`).

---

## Phase 1: Tests + cut `@lightfastai/dev-*@0.4.0` (dev-harness) [DONE]

### Overview

Add coverage for the resolver and the registry's new shape, update existing fixtures that reference `devPort`, and cut the coordinated minor bump.

### Changes Required:

#### 1. Resolver tests

**File**: `dev-harness/packages/dev-proxy/test/index.test.ts` (extend)

- `resolveAppPort` is deterministic (multiple calls with the same `(host, appName)` and an unoccupied probe predicate return the same port).
- `resolveAppPort` uses seed `appName` when `host === baseHost`; uses seed `${host}:${appName}` when `host !== baseHost` — verify by injecting an `isPortAvailable: () => true` and asserting the port matches `choosePort` called directly with the expected seed.
- Different `host` for the same `appName` (almost always) returns a different port — assert by sampling N realistic worktree-prefixed hosts.
- `usedPorts` causes linear-probe to skip occupied ports.
- `portAvailable: false` for the hash starting offset triggers probe to next available port (proves the EADDRINUSE-recovery path).
- `resolveBaseHost(config, env)` returns `${config.portless.name}.${tld}`; `env.PORTLESS_TLD` overrides `config.portless.tld`.

#### 2. Registry-shape tests

Update existing fixtures (the 30+ matches grepped during Phase 0) to drop `devPort`. Two failure-mode tests:

- A config with `devPort` declared throws because the schema now rejects it via `additionalProperties: false`.
- The error message points at `apps.<name>.devPort` so contributors immediately know what to remove.

#### 3. Supervisor + per-app behavioral tests

**File**: `dev-harness/packages/dev-proxy/test/runtime.test.ts` (extend)

- `createVercelMicrofrontendsDevConfig` produces distinct `appPorts` for the same registry against two different `host` values (one primary, one prefixed).
- `startDevProxyAppCommand` resolves the same `appPort` value as `createVercelMicrofrontendsDevConfig`'s entry for the same `(host, appName)` (proves both paths agree).
- `startDevProxyAppCommand` for a non-MFE entry resolves a port and passes it via `--app-port` to portless.

#### 4. Changeset

**File**: `dev-harness/.changeset/host-keyed-ports.md` (new)

```md
---
"@lightfastai/dev-proxy": minor
"@lightfastai/dev-cli": minor
"@lightfastai/dev-core": minor
"@lightfastai/dev-services": minor
---

feat(dev-proxy): host-keyed port allocation; drop `devPort` from apps registry

BREAKING: `apps[<name>].devPort` is no longer accepted in `lightfast.dev.json`. The dev-proxy now derives every app's port from `(host, appName)` via `choosePort` — the same primitive `resolveLocalProxyPort` already used for the MFE proxy port. Seed: `host === baseHost ? appName : ${host}:${appName}`. Primary-worktree ports are stable (deterministic). Linked worktrees automatically get distinct ports because their host carries a per-worktree prefix. The `choosePort` `portAvailable` probe gives free birthday-paradox protection — a rare hash collision slides past the occupied port instead of failing.

This unblocks concurrent multi-worktree development. Two worktrees can run `pnpm dev` simultaneously without `next dev` colliding on shared TCP ports.

Migration: remove every `devPort` field from your `lightfast.dev.json` `apps` entries. Per-entry `additionalProperties: false` will fail loudly during config load if any are left. Drop any hardcoded `--port <n>` flags from app `dev` scripts; portless injects `PORT` via `--app-port <hash>` automatically.
```

#### 5. Pack & link sanity check

```bash
cd /Users/jeevanpillay/Code/@lightfastai/dev-harness
pnpm changeset version  # bumps all four to 0.4.0 via the fixed group
pnpm build
pnpm pack:check
```

### Success Criteria:

#### Automated Verification:

- [x] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness test` passes (all four packages green; 79 tests total: dev-core 7, dev-proxy 54, dev-services 14, dev-cli 4).
- [x] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness pack:check` passes (all four tarballs built and dry-run OK).
- [x] `pnpm --dir /Users/jeevanpillay/Code/@lightfastai/dev-harness changeset:status` reports all four packages bumping to `0.4.0` via the fixed group.

---

## Phase 2: Adopt in lightfast — catalog bump, registry rewrite, platform dev script

### Overview

Pull `@lightfastai/dev-*@0.4.0` into the catalog, drop `devPort` from `lightfast.dev.json`, and remove the now-stale `--port 4112` from `apps/platform/package.json` `dev`.

**Dependency:** This phase assumes the parent plan's Phase 5/6 (platform on portless via `lightfast-dev proxy app`) has landed. If it hasn't, hold this phase and finish the parent plan first — otherwise the platform dev script edit (step 3) puts platform on portless without the supporting wiring.

### Changes Required:

#### 1. Catalog bump

**File**: `pnpm-workspace.yaml`

```diff
-'@lightfastai/dev-cli':      ^0.3.0
-'@lightfastai/dev-core':     ^0.3.0
-'@lightfastai/dev-proxy':    ^0.3.0
-'@lightfastai/dev-services': ^0.3.0
+'@lightfastai/dev-cli':      ^0.4.0
+'@lightfastai/dev-core':     ^0.4.0
+'@lightfastai/dev-proxy':    ^0.4.0
+'@lightfastai/dev-services': ^0.4.0
```

`pnpm install` updates the lockfile.

#### 2. `lightfast.dev.json`

**File**: `lightfast.dev.json`

Drop the three `devPort` lines (`:11,17,23`). Resulting file matches the "Desired End State" template above.

#### 3. Platform's `dev` script

**File**: `apps/platform/package.json:11`

```diff
-"dev": "pnpm with-env next dev --port 4112 --turbo",
+"dev": "pnpm with-env lightfast-dev proxy app -- next dev --turbo",
```

Drop the explicit `--port 4112`. portless injects `PORT` (the hash-derived value) via `buildPortlessAppCommands --app-port`. Next.js respects `PORT`. This also brings platform in line with the parent plan's Phase 6 (`apps/platform` runs through `lightfast-dev proxy app`).

If the parent plan's Phase 6 has already landed by the time this plan executes, this step is a no-op — `lightfast-dev proxy app -- next dev --turbo` is already the script. Verify before editing.

#### 4. `start` script

**File**: `apps/platform/package.json:12`

The `start` script (`next start -p 4112`) is for Vercel production builds, not local dev. Leave it untouched; production deploys still bind a known port.

### Success Criteria:

#### Automated Verification:

- [x] `pnpm install` completes; `pnpm-lock.yaml` updates only the four `@lightfastai/dev-*` entries.
- [x] `lightfast.dev.json` validates against the bundled JSON Schema (the schema now strictly rejects `devPort`, so the absence is required).
- [x] `pnpm typecheck` clean.
- [x] `pnpm build:app && pnpm build:platform` clean (no behavioral path is exercised here, but type/import wiring is).

---

## Phase 3: Multi-worktree verification (lightfast) [DONE]

### Overview

The whole point of this plan. Boot two worktrees concurrently, prove both get portless URLs that resolve, prove neither `next dev` crashes with `EADDRINUSE`. This is gated on Phases 0–2 being green.

### Changes Required:

No code changes. This phase is the verification gate.

### Success Criteria:

#### Automated Verification:

- [x] In the primary worktree (current branch): `pnpm dev:full > /tmp/lf-primary.log 2>&1 &`. Within 60s, `curl -k -o /dev/null -w "%{http_code}\n" https://app.lightfast.localhost` returns 200/307. Captured ports from `microfrontends.local.json`: `lightfast-app=3119`, `lightfast-www=4481`, `lightfast-platform=7493`, `localProxyPort=9355`. (Used `dev:full` instead of `dev` because `pnpm dev` does not include platform; comparing platform requires it.)
- [x] In a second worktree (`git worktree add /tmp/lf-wt2 -b test/multiwt-foo`, copied `lightfast.dev.json`/`pnpm-workspace.yaml`/`pnpm-lock.yaml` from primary plus the three `apps/<app>/.vercel/.env.development.local` files which are not in git, then `pnpm install`). `pnpm dev:full` came up; `curl -k https://multiwt-foo.app.lightfast.localhost` returns 307. Branch `test/multiwt-foo` produces prefix `multiwt-foo` (not `test-multiwt-foo`) — `defaultDetectWorktreePrefix` uses the branch's last segment. Worktree ports: `lightfast-app=3027`, `lightfast-www=6670`, `lightfast-platform=4068`, `localProxyPort=9372`.
- [x] All four ports differ (primary 3119/4481/7493/9355 vs worktree 3027/6670/4068/9372). Eight distinct values, no overlap.
- [x] Neither log contains `EADDRINUSE` (verified `grep -c EADDRINUSE` returned 0 for both).
- [x] Both processes can be cleanly stopped (`pkill -f "next dev|lightfast-dev|@vercel/microfrontends"`); restarting primary reproduced the identical ports `3119/4481/7493/9355` (deterministic hash confirmed).

#### Human Review:

- [x] Driven via `agent-browser` (URL prefix corrected: `multiwt-foo`, not `test-multiwt-foo`):
  - `https://app.lightfast.localhost` → 307 → `/sign-in?redirect_url=%2F`, title "Sign In - Lightfast Auth".
  - `https://multiwt-foo.app.lightfast.localhost` → 307 → `/sign-in?redirect_url=%2F` on the worktree host (prefix preserved through redirect, no cross-host leak), same title.
  - `https://www.lightfast.localhost` and `https://multiwt-foo.www.lightfast.localhost` → both 200, title "Superintelligence Layer for Founders", host prefix preserved.
- [x] `https://platform.lightfast.localhost/api/health` and `https://multiwt-foo.platform.lightfast.localhost/api/health` both return `{"status":"ok","service":"memory",...}` with **distinct timestamps** (28 ms apart) — independent Next.js processes, no shared backend.

---

## Phase 4: Docs cleanup

### Overview

Update CLAUDE.md's architecture diagram (no longer references fixed raw ports `:4107`/`:4101`/`:4112` as authoritative), and append a partial-resolution note to `MULTI_WORKTREE_BLOCKERS.md` B3.

**Dependency:** The platform diagram update assumes the parent plan's Phase 5 (platform on portless) has landed. Coordinate with that plan's diagram update if it hasn't.

### Changes Required:

#### 1. CLAUDE.md architecture diagram

**File**: `CLAUDE.md:11-43`

The diagram currently shows raw ports. Replace with hash-derived language:

```diff
-│      ├─ app   https://[<wt>.]app.lightfast.localhost   (raw :4107)               │
+│      ├─ app   https://[<wt>.]app.lightfast.localhost   (raw :auto, host-keyed)   │
-│      └─ www   https://[<wt>.]www.lightfast.localhost   (raw :4101)               │
+│      └─ www   https://[<wt>.]www.lightfast.localhost   (raw :auto, host-keyed)   │
-│  platform   http://localhost:4112   (raw; not on Portless / MFE)                 │
+│  platform   https://[<wt>.]platform.lightfast.localhost   (raw :auto, non-MFE)   │
```

(The platform line also reflects the parent plan's Phase 5 — platform is on portless now. Coordinate with that diagram update if it hasn't already landed.)

Add one line in the "Source of truth" block:

```
│  Ports:      derived per-worktree from (host, appName) — no manual pinning       │
```

#### 2. `MULTI_WORKTREE_BLOCKERS.md` B3 partial-resolution note

**File**: `dev-harness/MULTI_WORKTREE_BLOCKERS.md:135-194`

Add a `**Status:** partially resolved (2026-05-07)` line and append:

> Per-app `next dev` ports are now host-keyed (see plan `2026-05-07-dev-proxy-host-keyed-ports.md`). Two worktrees can run `pnpm dev` concurrently without TCP collisions. The MFE proxy's `localProxyPort` is also host-keyed. Remaining B3 work: desktop renderer port (`5173`), Inngest dev server port, and any other shared global resources documented in B6.

#### 3. Update parent plan's "Open Regression" pointer

**File**: `thoughts/shared/plans/2026-05-07-dev-proxy-dynamic-mfe-non-mfe.md`

Replace the three "fix options" block with a single line: "Resolved by `2026-05-07-dev-proxy-host-keyed-ports.md` (Option 3 schema, Option 2 mechanism — host-keyed `choosePort`)." Keep the regression description for historical context.

### Success Criteria:

#### Automated Verification:

- [x] `grep -rn "localhost:4112\|localhost:4107\|localhost:4101" CLAUDE.md` returns zero matches.
- [x] `grep -n "Status:" dev-harness/MULTI_WORKTREE_BLOCKERS.md | grep "B3\|partially resolved"` shows the updated status.

#### Human Review:

- [ ] Read CLAUDE.md top-to-bottom. The architecture box is internally consistent: no stale "raw :4107" claims, no references that contradict the host-keyed model.

---

## Testing Strategy

### Unit Tests (dev-harness, Phases 0–1):

- `resolveAppPort`: deterministic, host-sensitive, `usedPorts` skip, `portAvailable: false` triggers probe.
- `resolveBaseHost`: `env.PORTLESS_TLD` overrides `config.portless.tld`.
- `loadAppRegistry`: rejects `devPort` field via schema (`additionalProperties: false`).
- `createVercelMicrofrontendsDevConfig`: produces distinct `appPorts` for primary vs prefixed host fixtures.
- `startDevProxyAppCommand`: resolves the same port the supervisor would for `(host, appName)`.

### Integration Tests:

- `dev-harness/example/`: `pnpm dev` boots; ports in `microfrontends.local.json` match `resolveAppPort` outputs.
- Lightfast end-to-end smoke (Phase 3): two worktrees, both up, distinct ports, no collisions.

### What's NOT tested automatically:

- The actual EADDRINUSE regression — that's Phase 3's two-worktree verification.
- Hash collisions across worktrees (rare; `choosePort`'s probe makes this self-recovering anyway).

## Migration Notes

Lightfast is the primary `@lightfastai/dev-*` consumer; ship the catalog bump and the `lightfast.dev.json` rewrite together. Other downstream consumers (none today) update on their own schedule when they pull `0.4.0`.

If a contributor has a stale local checkout with `devPort` in `lightfast.dev.json`, the schema validator throws on config load with a path that points at the unknown property — easy to spot and fix. No silent fallback.

`apps/platform/package.json` `dev` no longer hardcodes `--port 4112`. Anyone running `pnpm --filter @lightfast/platform dev` directly still works (portless injects `PORT` via `--app-port <hash>`); the platform listens on whatever the hash produces for the current worktree.

`packages/app-test-data/src/config.ts:4` already had its `DEFAULT_PLATFORM_BASE_URL` updated to `https://platform.lightfast.localhost` in the parent plan's Phase 5. No action here.

If `apps/app/src/origins.ts` resolves `platformUrl` through `resolveProjectUrl("lightfast-platform")` (parent plan's Phase 5), it produces a portless URL, not a raw `localhost:<port>` URL. So app→platform calls are unaffected by the port change.

## Performance Considerations

No runtime hot-path changes. Resolver is called once per process startup. Hash function is O(name length).

## References

- Parent plan (regression source): `thoughts/shared/plans/2026-05-07-dev-proxy-dynamic-mfe-non-mfe.md:509-520` — "Open Regression" block lists three fix options; this plan picks Option 3's schema + Option 2's mechanism.
- Prior-art primitive (the model for `resolveAppPort`): `dev-harness/packages/dev-proxy/src/index.ts:1165-1185` (`resolveLocalProxyPort`) and `:1187-1219` (`choosePort`).
- Inline `${name}.${tld}` constructions to dedupe: `dev-harness/packages/dev-proxy/src/index.ts:522` (`resolveRuntimeIdentity`) and `:1402` (`portlessUrlMatchesName`).
- Unused-but-exported legacy hash: `dev-harness/packages/dev-proxy/src/index.ts:812-843` (`generateMicrofrontendsPort`) — kept for external API stability; not used by the new resolver.
- Worktree prefix detection: `dev-harness/packages/dev-proxy/src/index.ts:1107` (`defaultDetectWorktreePrefix` + `resolvePortlessHost`).
- Supervisor port-assignment site: `dev-harness/packages/dev-proxy/src/index.ts:758`.
- Per-app port-assignment site: `dev-harness/packages/dev-proxy/src/runtime.ts:367`.
- portless `--app-port` semantics: `dev-harness/node_modules/portless/README.md:351`, `:363`.
- Multi-worktree blocker tracker: `dev-harness/MULTI_WORKTREE_BLOCKERS.md` (B3 specifically).

## Improvement Log

**2026-05-07 — adversarial review (`/improve_plan`):**

- **Replaced `resolveAppPort` design.** Original wrapped the legacy unused `generateMicrofrontendsPort` and explicitly opted out of any port-availability fallback ("Option C") on grounds of file-coordination complexity. Review found `choosePort` (already used by `resolveLocalProxyPort` in the same file) provides per-process port-probing without any file coordination. New `resolveAppPort` wraps `choosePort`, gives free birthday-paradox protection, and keeps the proxy port and app ports on one primitive. Removed the speculative `minPort`/`maxPort` knobs and `if (!appName) throw` guard per CLAUDE.md scope guidance.
- **Added `resolveBaseHost` helper.** `${portlessName}.${tld}` was inlined at three places before this plan and the plan would have added two more. Single helper replaces all five sites.
- **Merged Phase 0 + Phase 1.** Original Phase 0 deliberately left the build broken with "typecheck reports the deliberate failures" as the only success criterion — not a reviewable boundary. Now one atomic dev-harness diff (schema + types + loader + helpers + supervisor + per-app wiring). Phases renumbered: tests/release → Phase 1, lightfast adoption → Phase 2, multi-worktree verification → Phase 3, docs → Phase 4.
- **Corrected parent-plan option framing.** The plan was labelled "Option 3 (drop the pin)" but actually implements Option 3's schema + Option 2's host-keyed hash mechanism. Both are complementary, not mutually exclusive; framing now says so.
- **Added explicit dependency callouts** on parent plan's Phase 5/6 in Phase 2 and Phase 4 (platform-on-portless wiring is a prerequisite for the platform dev-script edit and for the CLAUDE.md diagram update).
- **Corrected stale claim** about `generateMicrofrontendsPort` being "no longer called from `createVercelMicrofrontendsDevConfig`" — it was never called from src/ at all today; it's an unused export. Now described accurately in Current State Analysis and References.

No spike was run — the changes are grounded in code already verified by the research agents (`choosePort` signature and behavior, `resolveLocalProxyPort` call shape, baseHost duplication sites).
