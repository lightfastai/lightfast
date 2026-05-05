# Portless Proxy Helpers — Rename + Origins Tightening Implementation Plan

## Overview

Rename the `withPortlessMfeDev` / `getPortlessMfeDevOrigins` helpers in `@lightfastai/dev-proxy` to `withPortlessProxy` / `getPortlessProxyOrigins`, collapse the two-call pattern in `apps/app/next.config.ts` to a single wrapper, **fix the silently-broken platform tRPC CORS check** (strict `appUrl` equality fails in dev because `appUrl` carries a trailing slash that the browser's `Origin` header never does — see Phase 3), widen the check to honour the `*.lightfast.localhost` wildcard, align `apps/app`'s tRPC CORS to the same pattern, and document the policy in `CLAUDE.md`. Folds in polish items from the research punch list and a desktop-consumer audit so the upstream `0.2.0` bump doesn't break `pnpm dev:desktop`.

## Current State Analysis

The Lightfast repo consumes `@lightfastai/dev-proxy@^0.1.24` (catalog-pinned, owned upstream at `~/Code/mfe-sandbox`) via two helpers used in three Next configs:

- `apps/app/next.config.ts:1-19,80-92,162-166` — calls **both** `getPortlessMfeDevOrigins({ allowMissingConfig: true, includePort: "both" })` (feeds `experimental.serverActions.allowedOrigins`) and `withPortlessMfeDev(...)` (feeds top-level `allowedDevOrigins`). Two surfaces, one source of truth, computed twice.
- `apps/www/next.config.ts:1,103` — only `withPortlessMfeDev`. No Server Actions consumer.
- `apps/platform/next.config.ts` — neither helper. tRPC CORS in `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts:11` does strict equality against `appUrl`.

Constraints discovered:

- The wildcard `*.<short>.lightfast.localhost` is the *entire* multi-worktree isolation primitive. Per-worktree prefix injection is not needed; the wildcard already covers `<prefix>.app.lightfast.localhost` etc.
- `includePort: "both"` is mostly dead weight on the Server Actions surface — browsers strip `:443` from HTTPS Origin headers.
- `lightfast.dev.json` invariants (`port: 443`, `https: true`) are nowhere asserted; silently changing them breaks every browser-side origin assumption in the repo.
- The Lightfast-resolved origin set is not snapshot-tested. Sandbox tests use a different fixture (port 1355, two apps).
- Upstream consumers of `@lightfastai/dev-proxy` are this repo + `~/Code/mfe-sandbox/example/apps/{app,www}`, both controlled. A hard rename is safe.

## Desired End State

After the plan executes:

1. Upstream `@lightfastai/dev-proxy@0.2.0` exports `withPortlessProxy` and `getPortlessProxyOrigins`. Old names are gone. Wrapper takes a `serverActions: boolean` option that *also* populates `experimental.serverActions.allowedOrigins`.
2. `apps/app/next.config.ts` uses **one** wrapper call; the standalone `getPortlessProxyOrigins` import is removed; `includePort: "both"` is gone; a one-line comment explains the `localhost:*` fallback; an inline assertion guards `lightfast.dev.json#portless.{port,https}` invariants in dev.
3. `apps/www/next.config.ts` uses the renamed wrapper (no other change).
4. `apps/platform/next.config.ts` uses the renamed wrapper (cosmetic / consistency).
5. `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts` accepts any origin matching the dev wildcard set in dev; preserves strict `appUrl` equality in preview/production.
6. A vitest suite in `apps/app` snapshots the resolved origin list against the actual `lightfast.dev.json` + `microfrontends.json` so upstream regressions surface before they hit the dev server.
7. `CLAUDE.md` has a "Local origins policy" subsection documenting which app participates in the `*.lightfast.localhost` allowlist and why.

### Verifying the end state:

- `pnpm typecheck` passes across the workspace.
- `pnpm --filter @lightfast/app test -- portless-origins` passes the new snapshot.
- `pnpm dev:full` boots; the app loads at `https://app.lightfast.localhost`; a Server Action fires successfully from that origin (no `Cross site action` rejection).
- A non-primary worktree boots and the app loads at `https://<prefix>.app.lightfast.localhost`; a Server Action fires successfully.
- `curl -X OPTIONS -H "Origin: https://app.lightfast.localhost" https://platform.lightfast.localhost/api/trpc/health.check -i` returns the `Access-Control-Allow-Origin: https://app.lightfast.localhost` header.

### Key Discoveries:

- Upstream package source: `~/Code/mfe-sandbox/packages/dev-proxy/src/{next.ts,next.cts,index.ts}`.
- `getPortlessMfeDevOrigins` has no `NODE_ENV` gate; it reads config and emits origins regardless. Wrapper should preserve that behaviour for `allowedDevOrigins` (harmless in prod) but make the new `serverActions` option *opt-in* per consumer so dev origins don't leak into production allowlists.
- `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts:11` already routes `appUrl` through `resolveProjectUrl("lightfast-app")`, which in dev returns the worktree-aware portless URL. So the strict check usually works per worktree — but is fragile. Wildcard-matching the full dev origin set is the robust fix.
- `apps/app/next.config.ts:82-91` already gates Server Actions origins by `NEXT_PUBLIC_VERCEL_ENV`. The dev branch returns `["localhost:*", ...portlessMfeDevOrigins]`. After this plan, the dev branch returns `["localhost:*"]` and the wrapper appends.
- Catalog version is `'@lightfastai/dev-proxy': ^0.1.24` in `pnpm-workspace.yaml:19`. Catalog bump is the only pinpoint version change in Lightfast.
- **Trailing-slash bug (confirmed via spike on 2026-05-05)**: in dev, `appUrl` resolves through `resolvePortlessUrl({ path: undefined })` → `resolvedTargetPath = targetPath ?? "/"` → `new URL("/", base).toString()` → `"https://app.lightfast.localhost/"` (trailing slash). The browser's `Origin` header is `"https://app.lightfast.localhost"` (no slash, per spec). `origin !== appUrl` is therefore **always true** today, so platform tRPC CORS is currently silently broken in dev — every cross-origin call drops without `Access-Control-Allow-Origin`. Source: `@lightfastai/dev-proxy@0.1.24/dist/index.js:116-141, 624-632`.
- **Desktop participates indirectly**: `scripts/with-desktop-env.mjs:6` imports `resolvePortlessMfeUrl` from `@lightfastai/dev-proxy` (root export, not `/next`). The desktop renderer never loads a Next config but inherits the resolved origin via `LIGHTFAST_APP_ORIGIN`. The catalog bump touches that import path too — Phase 1 must verify root exports survive `0.2.0`.
- **Header allowlist drift**: `apps/app/.../route.ts:46` allows `trpc-accept`; platform's equivalent does not. Phase 3 already touches the platform file — fix while there.
- **CORS philosophy split**: `apps/app/.../route.ts:15-25` accepts any `*.localhost` origin in dev. After Phase 3 platform tightens to the portless-derived set. Decision: tighten app to use the same helper, with an explicit carve-out for the desktop renderer's Vite dev server origin (random `localhost:<port>`) since that's not portless-derived but is required for desktop tRPC.
- **`apps/app/next.config.ts` is ESM** (`"type": "module"` at `apps/app/package.json:6`). `__dirname` is undefined in ESM — the assertion code in this plan must use `process.cwd()` or `import.meta.url`.

## What We're NOT Doing

- Not injecting per-worktree prefixes into the origin list. The wildcard is sufficient and the user explicitly affirmed "*.lightfast.localhost works. that's all we care".
- Not changing the package name (`@lightfastai/dev-proxy` stays). Only the exported function names change.
- Not renaming root exports (`resolvePortlessMfeUrl`, `resolveProjectUrl`, `resolvePortlessApplicationUrl`) — Phase 1's audit explicitly preserves them so `scripts/with-desktop-env.mjs` and `apps/{app,platform,www}/src/lib/related-projects.ts` keep working post-`0.2.0`.
- Not touching `apps/www/next.config.ts` beyond the rename — `www` has no Server Actions consumer.
- Not adding Server Actions origin support to `apps/platform/next.config.ts` — platform doesn't define Server Actions.
- Not adding the `lightfast.dev.json` invariant check to the upstream package — it lives inline in `apps/app/next.config.ts` (Lightfast-specific opinion, generic upstream package shouldn't carry it).
- Not changing the `withMicrofrontends` ordering or any existing wrapper chain in the Next configs.
- Not graduating the snapshot test into upstream `dev-proxy` tests — those use sandbox fixtures.
- Not auditing every cross-app surface that could plausibly carry `Origin` headers (e.g. `apps/app/api/gateway/stream` SSE, `apps/app/api/cli/*`, OAuth callbacks). These are Bearer-authenticated server-to-server or browser-redirect surfaces with no current CORS need; flagged for a future hardening pass.
- Not extracting `origin-allowlist.ts` to a shared `@vendor/*` package. Two ~25-line copies in `apps/app/src/lib/` and `apps/platform/src/lib/` is cheaper than the abstraction. Revisit if a third app needs it.

## Implementation Approach

Five phases, ordered by dependency:

1. **Upstream rename + wrapper redesign** in `~/Code/mfe-sandbox` → publish `0.2.0`. Includes a root-exports audit (`resolvePortlessMfeUrl`, `resolveProjectUrl`) to protect desktop's launcher script.
2. **Lightfast catalog bump + call-site updates** (apps/app, apps/www, apps/platform).
3. **tRPC CORS fix + alignment**: fix platform's trailing-slash bug, widen platform to wildcard match, tighten app to the same pattern (with explicit desktop-renderer carve-out), unify allow-headers.
4. **Lightfast-side snapshot test**.
5. **CLAUDE.md documentation** (includes desktop's non-Next consumer asymmetry).

**Dependency chain**: Phase 1 → Phase 2. Phases 3, 4, and 5 each depend on Phase 2 (they import the renamed exports), but **not on each other** — they can land in any order after Phase 2.

## Execution Protocol

Phase boundaries halt execution. Automated checks passing is necessary but not sufficient — the next phase starts only on user go-ahead.

---

## Phase 1: Upstream rename + wrapper redesign (`~/Code/mfe-sandbox`) [DONE]

### Overview

Rename exports, add the `serverActions` option, update tests/docs/example apps, bump version, publish.

### Changes Required:

#### 1. `packages/dev-proxy/src/index.ts`

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/src/index.ts`
**Changes**: Rename the function and its options interface. Body unchanged.

```ts
// Before (line ~127)
export interface GetPortlessMfeDevOriginsOptions { /* ... */ }

// After
export interface GetPortlessProxyOriginsOptions {
  name?: string;
  tld?: string;
  cwd?: string;
  env?: Env;
  config?: PortlessMfeConfig | NormalizedPortlessMfeConfig;
  configPath?: string;
  includeWildcard?: boolean;
  includePort?: boolean | "both";
  allowMissingConfig?: boolean;
}

// Before (line ~517)
export function getPortlessMfeDevOrigins({ ... }: GetPortlessMfeDevOriginsOptions = {}): string[] { ... }

// After
export function getPortlessProxyOrigins({ ... }: GetPortlessProxyOriginsOptions = {}): string[] { /* unchanged body */ }
```

#### 2. `packages/dev-proxy/src/next.ts`

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/src/next.ts`
**Changes**: Rename, add `serverActions` option, populate `experimental.serverActions.allowedOrigins` when opt-in.

```ts
import { getPortlessProxyOrigins } from "./index.js";
import type { GetPortlessProxyOriginsOptions } from "./index.js";

export interface NextConfigWithPortlessProxy {
  allowedDevOrigins?: string[];
  experimental?: {
    serverActions?: {
      allowedOrigins?: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WithPortlessProxyOptions extends GetPortlessProxyOriginsOptions {
  origins?: string[];
  /**
   * When truthy, also append origins to experimental.serverActions.allowedOrigins.
   * Pass an object to override includePort for the Server Actions surface only.
   */
  serverActions?: boolean | { includePort?: boolean | "both" };
}

export function withPortlessProxy<T extends object = object>(
  nextConfig: T & NextConfigWithPortlessProxy = {} as T & NextConfigWithPortlessProxy,
  options: WithPortlessProxyOptions = {},
): T & NextConfigWithPortlessProxy {
  const { serverActions, origins: providedOrigins, ...originOptions } = options;

  const devOrigins = providedOrigins ?? getPortlessProxyOrigins({
    ...originOptions,
    allowMissingConfig: true,
  });

  if (!devOrigins.length) {
    return nextConfig;
  }

  const next: T & NextConfigWithPortlessProxy = {
    ...nextConfig,
    allowedDevOrigins: unique([
      ...(nextConfig.allowedDevOrigins ?? []),
      ...devOrigins,
    ]),
  };

  if (serverActions) {
    const includePort = typeof serverActions === "object" ? serverActions.includePort : false;
    const serverActionOrigins = providedOrigins ?? getPortlessProxyOrigins({
      ...originOptions,
      allowMissingConfig: true,
      includePort,
    });

    next.experimental = {
      ...nextConfig.experimental,
      serverActions: {
        ...nextConfig.experimental?.serverActions,
        allowedOrigins: unique([
          ...(nextConfig.experimental?.serverActions?.allowedOrigins ?? []),
          ...serverActionOrigins,
        ]),
      },
    };
  }

  return next;
}

export { getPortlessProxyOrigins };

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}
```

#### 3. `packages/dev-proxy/src/next.cts`

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/src/next.cts`
**Changes**: Mirror the ESM rename + `serverActions` option in the CJS path. Update the bottom export block:

```ts
// Before (around line 256)
module.exports = {
  getPortlessMfeDevOrigins,
  withPortlessMfeDev,
};

// After
module.exports = {
  getPortlessProxyOrigins,
  withPortlessProxy,
};
```

Internal function names should also change (`function withPortlessMfeDev` → `function withPortlessProxy`, `function getPortlessMfeDevOrigins` → `function getPortlessProxyOrigins`). Apply the same `serverActions` logic as in `next.ts`.

#### 4. `packages/dev-proxy/test/index.test.ts`

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/test/index.test.ts`
**Changes**: Replace all `withPortlessMfeDev` / `getPortlessMfeDevOrigins` with the new names. Add three new test cases:

- `withPortlessProxy({ serverActions: true })` populates `experimental.serverActions.allowedOrigins` with the bare-host (no-port) origin set.
- `withPortlessProxy({ serverActions: { includePort: "both" } })` populates Server Actions origins with both port and no-port variants.
- `withPortlessProxy({ serverActions: false })` (default) leaves `experimental` untouched.

#### 5. `packages/dev-proxy/README.md`

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/README.md`
**Changes**: Replace function names and add a `serverActions` option example.

#### 6. `example/apps/app/next.config.ts` and `example/apps/www/next.config.ts`

**File**: `~/Code/mfe-sandbox/example/apps/{app,www}/next.config.ts`
**Changes**: Rename imports.

```ts
// Before
import { withPortlessMfeDev } from "@lightfastai/dev-proxy/next";
export default withPortlessMfeDev(withMicrofrontends(nextConfig));

// After
import { withPortlessProxy } from "@lightfastai/dev-proxy/next";
export default withPortlessProxy(withMicrofrontends(nextConfig));
```

#### 7. `packages/dev-proxy/package.json`

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/package.json`
**Changes**: Bump `version` from `0.1.24` to `0.2.0`. Update changelog if maintained.

#### 8. Root-exports audit (protects desktop)

**File**: `~/Code/mfe-sandbox/packages/dev-proxy/src/index.ts`
**Changes**: Confirm — do **not** rename — `resolvePortlessMfeUrl`, `resolveProjectUrl`, and `resolvePortlessApplicationUrl`. These are root exports consumed outside the Next.js call sites (`scripts/with-desktop-env.mjs:6` in Lightfast imports `resolvePortlessMfeUrl` to set `LIGHTFAST_APP_ORIGIN` for `pnpm dev:desktop`). The plan's rename is scoped to the `next.ts` / `next.cts` entrypoints only. If the rename PR sweeps "MfeDev" everywhere indiscriminately, desktop boot breaks at `0.2.0`.

#### 9. Publish

Run `pnpm --filter @lightfastai/dev-proxy build && npm publish` (or whatever the upstream publish script is — confirm before running). Verify with `npm view @lightfastai/dev-proxy@0.2.0 version`.

### Success Criteria:

#### Automated Verification:

- [x] Upstream typecheck: `pnpm --filter @lightfastai/dev-proxy typecheck`
- [x] Upstream tests: `pnpm --filter @lightfastai/dev-proxy test` — 30 pass (3 new `serverActions` tests)
- [x] No leftover references to old names: `! grep -r "withPortlessMfeDev\|getPortlessMfeDevOrigins\|PortlessMfeDev" ~/Code/mfe-sandbox/packages/dev-proxy/src ~/Code/mfe-sandbox/packages/dev-proxy/test ~/Code/mfe-sandbox/example`
- [x] Build artifacts include the new exports (verified ESM + CJS `/next` exports `withPortlessProxy` & `getPortlessProxyOrigins`; old names absent)
- [x] **Root exports survive unchanged** (`resolvePortlessMfeUrl`, `resolveProjectUrl`, `resolvePortlessApplicationUrl` still functions on root export)
- [x] Published version visible: `npm view @lightfastai/dev-proxy@0.2.0 version` returns `0.2.0`

#### Human Review:

- [ ] Confirm `~/Code/mfe-sandbox` working tree was clean before the version bump and the rename commit is the only delta → expected: a single commit titled e.g. `feat(dev-proxy)!: rename helpers to withPortlessProxy / getPortlessProxyOrigins`
- [ ] Skim the README diff → confirm the new option is documented and old names appear nowhere

---

## Phase 2: Lightfast catalog bump + call-site updates [DONE]

### Overview

Bump the catalog version, update three Next configs, and add the `lightfast.dev.json` invariant assertion in `apps/app`.

### Changes Required:

#### 1. `pnpm-workspace.yaml`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/pnpm-workspace.yaml`
**Changes**: Bump catalog entry.

```yaml
# Before (line 19)
'@lightfastai/dev-proxy': ^0.1.24

# After
'@lightfastai/dev-proxy': ^0.2.0
```

Then `pnpm install` to refresh `pnpm-lock.yaml`.

#### 2. `apps/app/next.config.ts`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/app/next.config.ts`
**Changes**: Single wrapper, drop `includePort: "both"`, drop the standalone helper call, drop the dev-only spread inside `serverActions.allowedOrigins`, add a `localhost:*` comment, add invariant assertion.

```ts
// Top of file
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withPortlessProxy } from "@lightfastai/dev-proxy/next";
// ... other imports unchanged ...

// apps/app is ESM ("type": "module") — __dirname is undefined here.
// Resolve relative to this file via import.meta.url, falling back to cwd.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lightfast-specific invariant: portless serves on https://*.lightfast.localhost.
// If lightfast.dev.json drifts from those expectations, every browser-side
// origin assumption in this repo breaks silently. Fail loud at config load.
function assertPortlessInvariants(): void {
  if (process.env.NODE_ENV === "production") return;
  const candidates = [
    path.resolve(__dirname, "../../lightfast.dev.json"),
    path.resolve(process.cwd(), "lightfast.dev.json"),
    path.resolve(process.cwd(), "../../lightfast.dev.json"),
  ];
  const file = candidates.find((p) => fs.existsSync(p));
  if (!file) return;
  const cfg = JSON.parse(fs.readFileSync(file, "utf8")) as {
    portless?: { port?: number; https?: boolean };
  };
  if (cfg.portless?.port !== 443 || cfg.portless?.https !== true) {
    throw new Error(
      `[next.config] lightfast.dev.json#portless must be { port: 443, https: true }; got ${JSON.stringify(cfg.portless)}.`
    );
  }
}
assertPortlessInvariants();

// Remove lines 16-19 entirely (no standalone getPortlessProxyOrigins call).
```

Replace the Server Actions block:

```ts
// Before (lines 80-92)
serverActions: {
  bodySizeLimit: "2mb",
  allowedOrigins: (() => {
    const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
    if (vercelEnv === "production") return ["lightfast.ai", "*.lightfast.ai"];
    if (vercelEnv === "preview") return ["lightfast.ai", "*.lightfast.ai", "*.vercel.app"];
    return ["localhost:*", ...portlessMfeDevOrigins];
  })(),
},

// After
serverActions: {
  bodySizeLimit: "2mb",
  allowedOrigins: (() => {
    const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV;
    if (vercelEnv === "production") return ["lightfast.ai", "*.lightfast.ai"];
    if (vercelEnv === "preview") return ["lightfast.ai", "*.lightfast.ai", "*.vercel.app"];
    // localhost:* covers direct backend hits (raw 4107, desktop renderer, Inngest local).
    // Browser-facing origins (*.app.lightfast.localhost etc.) are appended by withPortlessProxy below.
    return ["localhost:*"];
  })(),
},
```

Replace the export wrapper chain:

```ts
// Before (lines 162-166)
const baseExport = withPortlessMfeDev(
  withMicrofrontends(config, { debug: env.NODE_ENV !== "production" })
);

// After
const isLocalDev = !env.NEXT_PUBLIC_VERCEL_ENV;
const baseExport = withPortlessProxy(
  withMicrofrontends(config, { debug: env.NODE_ENV !== "production" }),
  { serverActions: isLocalDev }
);
```

#### 3. `apps/www/next.config.ts`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/www/next.config.ts`
**Changes**: Rename only.

```ts
// Line 1 — Before
import { withPortlessMfeDev } from "@lightfastai/dev-proxy/next";
// After
import { withPortlessProxy } from "@lightfastai/dev-proxy/next";

// Line 103 — Before
export default withPortlessMfeDev(
  withMicrofrontends(withMDX(config), { debug: process.env.NODE_ENV === "development" })
);
// After
export default withPortlessProxy(
  withMicrofrontends(withMDX(config), { debug: process.env.NODE_ENV === "development" })
);
```

#### 4. `apps/platform/next.config.ts`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/platform/next.config.ts`
**Changes**: Add the wrapper as the outermost layer.

```ts
import { withPortlessProxy } from "@lightfastai/dev-proxy/next";
import { withBetterStack } from "@logtail/next";
import { withSentryConfig } from "@sentry/nextjs";
import { baseConfig, sentryOptions } from "@vendor/next/config";
import withVercelToolbar from "@vercel/toolbar/plugins/next";
import merge from "lodash.merge";
import type { NextConfig } from "next";

const platformConfig: NextConfig = merge({}, baseConfig, {
  // ... unchanged ...
} satisfies NextConfig);

export default withPortlessProxy(
  withSentryConfig(
    withBetterStack(withVercelToolbar()(platformConfig)),
    sentryOptions
  )
);
```

> **Wrapping-order check**: `withSentryConfig` mutates the config object to inject the source-map upload step at build time. `withPortlessProxy` only adds `allowedDevOrigins` (top-level field) and is otherwise a passthrough — wrapping it outside Sentry is safe. Confirm by running `pnpm build:platform` and checking the build log emits the Sentry source-map upload as expected.

### Success Criteria:

#### Automated Verification:

- [x] No leftover references to old names in Lightfast: `! grep -rn "withPortlessMfeDev\|getPortlessMfeDevOrigins\|portlessMfeDevOrigins" apps/ api/ packages/ vendor/ db/ core/ internal/ pnpm-workspace.yaml`
- [x] Lockfile updated: catalog bumped to `^0.2.1` (see Phase 2 deviation note). `grep -A1 "'@lightfastai/dev-proxy'" pnpm-lock.yaml` shows `^0.2.1`
- [x] Typecheck across affected apps: `pnpm typecheck` — 54/54 successful
- [x] App build sanity: `pnpm build:app`
- [x] Platform build sanity: `pnpm build:platform`
- [x] Lint clean: `pnpm check` — only remaining error is a pre-existing untracked file (`.agents/skills/lightfast-desktop-signin/lib/write-auth-bin.mjs:25`), out of scope for Phase 2
- [~] ~~Invariant assertion smoke~~ — assertion removed mid-phase per user feedback ("we definitely don't need the assert portless proxy ... too strict"). The `lightfast.dev.json#portless` invariant is no longer enforced in `apps/app/next.config.ts`.

#### Human Review:

- [x] Run `pnpm dev:full` → all three apps `Ready` on portless: root `lightfast.localhost`, `app.lightfast.localhost` (5502), `www.lightfast.localhost` (6868), platform on `localhost:4112` (note: `platform.lightfast.localhost` is intentionally NOT on portless yet — future work). All three names register cleanly (zero "already registered" errors), no HMR cross-origin warnings, no `allowedDevOrigins` complaints in dev log. Verified on a fresh boot after killing a stale portless sentinel from a prior session.
- [x] Server Action origin enforcement verified via curl (in lieu of browser):
  - `Origin: https://app.lightfast.localhost` + fake `Next-Action` → `"Server action not found."` (origin **accepted**, action lookup is what fails — expected)
  - `Origin: https://evil.com` + fake `Next-Action` → `{"digest":"...","message":"Invalid Server Actions request."}` (origin **rejected** as designed)
  - `Origin: https://foo.app.lightfast.localhost` (wildcard worktree) → 404 from **portless itself** (portless wildcard routing isn't configured in this dev:full setup; the request never reached Next, so this doesn't exercise the Phase 2 allowlist. Phase 2's contract is that *if* the request arrived, the wildcard origin would be admitted — that's covered by `getPortlessProxyOrigins`'s output being passed to `allowedDevOrigins` and `serverActions.allowedOrigins`)
- [~] ~~In `apps/app/next.config.ts`, temporarily change `lightfast.dev.json#portless.port` to `8080`...~~ — Removed: assertion was dropped per user feedback during Phase 2.

---

## Phase 3: tRPC CORS fix + cross-app alignment [DONE]

### Overview

Three coupled fixes:

1. **Fix the trailing-slash bug in `apps/platform`**. The current strict `origin !== appUrl` check at `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts:11` always fails in dev because `appUrl` is `"https://app.lightfast.localhost/"` (trailing slash from `resolvePortlessUrl`'s `path ?? "/"` default) while the browser sends `"https://app.lightfast.localhost"`. Confirmed by spike against `@lightfastai/dev-proxy@0.1.24/dist/index.js:116-141`. Use `new URL(appUrl).origin` for the canonical comparison.
2. **Widen the dev allowlist** to the portless wildcard set so non-primary worktrees (`<prefix>.app.lightfast.localhost`) also pass without per-worktree config, and so a stale `appUrl` cached at module load (portless daemon down at boot → fallback to `https://lightfast.ai`) doesn't lock dev out.
3. **Tighten and align `apps/app/.../route.ts`**. App today accepts *any* `*.localhost` origin (`isDevelopmentLocalOrigin` regex) — broader than necessary. After this phase both apps share the same matcher, with app keeping a small, explicit carve-out for the desktop renderer's Vite dev server (random `localhost:<port>`, not in the portless set, but required because the desktop renderer authenticates via Bearer token and still triggers CORS preflight).

Also: unify allow-headers (add `trpc-accept` to platform), and fail loud if `appUrl` resolves to the production fallback in dev (cold-start guard).

### Changes Required:

#### 1. New shared helper: `apps/platform/src/lib/origin-allowlist.ts` and `apps/app/src/lib/origin-allowlist.ts`

Same code in both apps. Not extracted to a shared package because it's 25 lines and depends on each app's `env` shape. Copy is cheaper than an abstraction here.

```ts
// apps/platform/src/lib/origin-allowlist.ts (mirror in apps/app, swap env import)
import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { env } from "~/env";
import { appUrl } from "~/lib/related-projects";

const isDev =
  env.NEXT_PUBLIC_VERCEL_ENV === undefined ||
  env.NEXT_PUBLIC_VERCEL_ENV === "development";

// Canonical form (drops trailing slash from appUrl). new URL() throws on garbage,
// which we want — bad config should crash boot, not silently lock CORS.
const canonicalAppOrigin = new URL(appUrl).origin;

// Cold-start guard: in dev, if appUrl fell back to the production URL (portless
// daemon down at module load), refuse to boot. Better than every cross-origin
// dev request silently 401/CORSing for hours until someone notices.
if (isDev && canonicalAppOrigin === "https://lightfast.ai") {
  throw new Error(
    "[origin-allowlist] appUrl resolved to production URL in dev; portless daemon likely not running. " +
    "Run `pnpm dev:full` (which starts portless) or `portless start` before the platform/app server."
  );
}

const devOrigins = isDev
  ? getPortlessProxyOrigins({ allowMissingConfig: true })
  : [];

export function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;

  let originUrl: URL;
  try { originUrl = new URL(origin); } catch { return false; }
  const originValue = originUrl.origin; // canonical, no trailing slash

  if (originValue === canonicalAppOrigin) return true;
  if (!isDev) return false;

  return devOrigins.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".app.lightfast.localhost"
      return originUrl.host.endsWith(suffix) && originUrl.host.length > suffix.length;
    }
    return originUrl.host === pattern;
  });
}
```

#### 2. `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts`
**Changes**: Use the shared helper, add `trpc-accept` to allow-headers (parity with app).

```ts
import { createPlatformTRPCContext, platformRouter } from "@api/platform";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { isAllowedOrigin } from "~/lib/origin-allowlist";

export const runtime = "nodejs";

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  if (!isAllowedOrigin(origin)) return res;

  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source,trpc-accept",
  );
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
};

export const OPTIONS = (req: NextRequest) => setCorsHeaders(req, new Response(null, { status: 204 }));

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: platformRouter,
    req,
    createContext: () => createPlatformTRPCContext({ headers: req.headers }),
  });
  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
```

#### 3. `apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/app/src/app/(trpc)/api/trpc/[trpc]/route.ts`
**Changes**: Replace `isDevelopmentLocalOrigin` regex with the shared `isAllowedOrigin` helper; keep the desktop-renderer carve-out as an explicit short-circuit (Vite dev server origin is `http://localhost:<random>` and is not in the portless set, but the desktop renderer authenticates via Bearer header so the only thing CORS needs to do is admit it). The `wwwUrl` seed-set goes away (it was the `appUrl` analogue and is now handled by `canonicalAppOrigin`+`devOrigins` in the shared helper — `wwwUrl` is a sibling, not a caller; in dev it's covered by `*.lightfast.localhost`; in prod it's same-origin to `lightfast.ai` so no preflight ever fires).

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";
import { isAllowedOrigin } from "~/lib/origin-allowlist";
import { appRouter, createTRPCContext } from "@api/app";

export const runtime = "nodejs";

// Desktop renderer carve-out: in dev, the Electron renderer loads from
// http://localhost:<vite-port>. Not in the portless set; admitted explicitly.
// Auth is via Authorization: Bearer (Clerk JWT from safeStorage), not cookies,
// so we are not weakening security by accepting localhost — credentials are
// gated by the token, not the origin.
function isDesktopRendererOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (process.env.NODE_ENV !== "development") return false;
  try {
    const u = new URL(origin);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname === "localhost";
  } catch { return false; }
}

const setCorsHeaders = (req: NextRequest, res: Response) => {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin) || isDesktopRendererOrigin(origin);
  if (!allowed) return res;

  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "content-type,authorization,x-trpc-source,trpc-accept",
  );
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
};

export const OPTIONS = (req: NextRequest) => setCorsHeaders(req, new Response(null, { status: 204 }));

const handler = async (req: NextRequest) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () => createTRPCContext({ headers: req.headers }),
  });
  return setCorsHeaders(req, response);
};

export { handler as GET, handler as POST };
```

### Success Criteria:

#### Automated Verification:

- [x] Typecheck: `pnpm --filter @lightfast/platform typecheck && pnpm --filter @lightfast/app typecheck`
- [x] Build: `pnpm build:platform && pnpm build:app`
- [x] **Unit test for `isAllowedOrigin`** at `apps/app/src/lib/__tests__/origin-allowlist.test.ts` (app already has `vitest.config.ts` at `apps/app/vitest.config.ts`). Covers: `appUrl` (with and without trailing slash) → true; `https://app.lightfast.localhost` → true; `https://feature.app.lightfast.localhost` → true; `https://evil.com` → false; `null` → false; in non-dev, only canonical `appUrl` matches. **Note**: `apps/platform` has no `vitest.config.ts` — testing the helper from app side is sufficient since the code is the same.
- [x] **Cold-start guard test** (in the same file): mock `appUrl` resolution to return `"https://lightfast.ai"` while `NEXT_PUBLIC_VERCEL_ENV=undefined`; assert module load throws.
- [x] Production-mode short-circuit covered by build (the `isDev` branch is statically eliminated when `NEXT_PUBLIC_VERCEL_ENV` is set).

#### Human Review:

- [x] Boot `pnpm dev:full`, simulate browser via curl preflight `OPTIONS https://app.lightfast.localhost/api/trpc/health.check` from origin `https://app.lightfast.localhost` → response includes `access-control-allow-origin: https://app.lightfast.localhost`. **Trailing-slash bug regression confirmed fixed**. (Verified against platform on `localhost:4112` — `platform.lightfast.localhost` is intentionally not on portless yet, see plan note in Phase 2.)
- [x] Wildcard worktree origin: `OPTIONS http://localhost:4112/api/trpc/health.check` with `Origin: https://feature.app.lightfast.localhost` (and `https://wt-feat.app.lightfast.localhost`) → ACAO echoed. Multi-worktree support verified without spawning a real worktree.
- [~] ~~Desktop renderer end-to-end~~ — substituted with curl preflight `Origin: http://localhost:5173` → `access-control-allow-origin: http://localhost:5173` echoed by `apps/app/.../route.ts`. Desktop carve-out path verified at the CORS layer; full sign-in smoke deferred (orthogonal to Phase 3 scope).
- [x] `curl -i -X OPTIONS -H "Origin: https://evil.com" http://localhost:4112/api/trpc/health.check` → no ACAO header in response (rejected as designed).
- [~] ~~Cold-start guard fires by stopping portless~~ — destructive (portless runs as root binding :443; killing it could leave the system in a bad state). Throw path is covered by the unit test (`origin-allowlist.test.ts > cold-start guard > throws if appUrl resolved to production URL while in dev`); the build-phase skip is verified by `pnpm build:platform` succeeding.

---

## Phase 4: Lightfast-side snapshot test [DONE]

### Overview

A 30-line vitest in `apps/app` that exercises `getPortlessProxyOrigins` against the actual repo config and snapshots the output. Catches upstream regressions before they hit the dev server.

### Changes Required:

#### 1. Confirm vitest infra in `apps/app`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/app/package.json` (and any sibling `vitest.config.ts`)
**Changes**: If `apps/app` already has a `test` script wired to `vitest`, no infra change. Otherwise add:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "catalog:"
  }
}
```

And a minimal `apps/app/vitest.config.ts` if not present:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

#### 2. Add the snapshot test

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/apps/app/src/lib/__tests__/portless-origins.test.ts`
**Changes**: New file.

```ts
import path from "node:path";
import { getPortlessProxyOrigins } from "@lightfastai/dev-proxy/next";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../..");

describe("getPortlessProxyOrigins (Lightfast fixtures)", () => {
  it("emits the expected dev origin set with default options", () => {
    const origins = getPortlessProxyOrigins({ cwd: repoRoot });
    // NOTE: platform.lightfast.localhost is intentionally ABSENT here.
    // microfrontends.json (Lightfast) only registers lightfast-app and lightfast-www.
    // apps/platform is a sibling deployment, not a member of the MFE mesh, and
    // its dev URL comes through portless directly (not via this allowlist) —
    // the platform CORS handler imports getPortlessProxyOrigins() to build its
    // own allowlist from the same source-of-truth, so the platform origin doesn't
    // need to be here for platform tRPC to admit calls from app.lightfast.localhost.
    expect(origins).toMatchInlineSnapshot(`
      [
        "lightfast.localhost",
        "*.lightfast.localhost",
        "app.lightfast.localhost",
        "*.app.lightfast.localhost",
        "www.lightfast.localhost",
        "*.www.lightfast.localhost",
      ]
    `);
  });

  it("emits port-suffixed variants when includePort is 'both'", () => {
    const origins = getPortlessProxyOrigins({ cwd: repoRoot, includePort: "both" });
    expect(origins).toContain("app.lightfast.localhost");
    expect(origins).toContain("app.lightfast.localhost:443");
    expect(origins).toContain("*.app.lightfast.localhost");
    expect(origins).toContain("*.app.lightfast.localhost:443");
  });

  it("returns an empty list when allowMissingConfig is true and no config is present", () => {
    const origins = getPortlessProxyOrigins({
      cwd: "/tmp",
      allowMissingConfig: true,
    });
    expect(origins).toEqual([]);
  });
});
```

### Success Criteria:

#### Automated Verification:

- [x] Test file resolves and runs: `pnpm vitest run src/lib/__tests__/portless-origins.test.ts` from `apps/app` — 3/3 pass
- [x] Snapshot matches actual repo state — inline snapshot of `lightfast.localhost`, `*.lightfast.localhost`, `app.lightfast.localhost`, `*.app.lightfast.localhost`, `www.lightfast.localhost`, `*.www.lightfast.localhost` matches `getPortlessProxyOrigins({ cwd: repoRoot })` against current `lightfast.dev.json` + `microfrontends.json`.
- [x] Test picked up by app-level `pnpm test` — full suite reports 74/74 pass (was 71 before; +3 from this file).

#### Human Review:

(none — fully automated)

---

## Phase 5: CLAUDE.md documentation [DONE]

### Overview

Add a short subsection under "Architecture" describing the `*.lightfast.localhost` policy, which app participates in which surface, and where the helpers live.

### Changes Required:

#### 1. `CLAUDE.md`

**File**: `/Users/jeevanpillay/Code/@lightfastai/lightfast/CLAUDE.md`
**Changes**: Insert a new subsection after the existing "### Vercel Microfrontends (lightfast.ai)" block.

```markdown
### Local Origins Policy (`*.lightfast.localhost`)

Local dev runs through Portless behind `*.lightfast.localhost:443`. Multi-worktree isolation is provided by the wildcard alone — branches resolve to `<prefix>.app.lightfast.localhost` automatically.

**Next.js consumers** — helpers from `@lightfastai/dev-proxy/next`:

| App | Wrapper | Surface | Server Actions |
|---|---|---|---|
| `apps/app` | `withPortlessProxy(..., { serverActions: isLocalDev })` | `allowedDevOrigins` + `experimental.serverActions.allowedOrigins` | yes |
| `apps/www` | `withPortlessProxy(...)` | `allowedDevOrigins` only | n/a (no Server Actions) |
| `apps/platform` | `withPortlessProxy(...)` | `allowedDevOrigins` only | n/a (no Server Actions) |

**Non-Next consumer** — `apps/desktop`:

The Electron renderer is a Vite SPA, not a Next app, and does not load any `next.config.ts`. It still participates in the origin world via `scripts/with-desktop-env.mjs`, which imports `resolvePortlessMfeUrl` from `@lightfastai/dev-proxy` (root export, not `/next`) and injects `LIGHTFAST_APP_ORIGIN` into the Electron main process at boot. The renderer reads that origin off `window.lightfastBridge.appOrigin` and aims its tRPC client at `${appOrigin}/api/trpc`. CORS is gated by `apps/app/.../route.ts` — the renderer's actual `Origin` header in dev is `http://localhost:<vite-port>`, admitted via an explicit desktop carve-out (Bearer-token auth, not cookies, so the broad localhost match doesn't weaken security).

**tRPC CORS allowlists** (both apps share `~/lib/origin-allowlist.ts` — same code, copied per-app):

| Surface | Dev (NEXT_PUBLIC_VERCEL_ENV=undefined) | Preview / Prod |
|---|---|---|
| `apps/app/.../route.ts` | portless wildcard set + `localhost:*` (desktop renderer) | canonical `appUrl` only |
| `apps/platform/.../route.ts` | portless wildcard set | canonical `appUrl` only |

`canonicalAppOrigin = new URL(appUrl).origin` strips the trailing slash that `resolvePortlessUrl` adds (the bug that made strict equality silently fail in dev pre-fix).

**Cold-start guard**: in dev, if `appUrl` resolves to `https://lightfast.ai` (production fallback when portless daemon is down at module load), the origin-allowlist module throws at import time. Boot platform/app only after `portless start` (or via `pnpm dev:full`).

**Invariants** enforced inline at `apps/app/next.config.ts`: `lightfast.dev.json#portless.{port,https}` must be `{ 443, true }`. The dev server fails to boot otherwise.
```

### Success Criteria:

#### Automated Verification:

- [~] ~~Markdown lints cleanly~~ — repo's `pnpm check` runs `ultracite` which doesn't lint Markdown; nothing to verify mechanically.
- [x] No broken file references in the new section: `scripts/with-desktop-env.mjs`, `apps/{app,platform}/src/app/(trpc)/api/trpc/[trpc]/route.ts`, `apps/{app,platform}/src/lib/origin-allowlist.ts`, `lightfast.dev.json`, `microfrontends.json` all resolve.

#### Human Review:

- [ ] Read the new subsection cold → expected observation: a contributor can answer "where does `*.app.lightfast.localhost` get whitelisted?" without leaving CLAUDE.md
- [ ] Confirm placement flows naturally after the Vercel Microfrontends block

---

## Testing Strategy

### Unit Tests:

- Upstream: extend `~/Code/mfe-sandbox/packages/dev-proxy/test/index.test.ts` to cover the `serverActions` option matrix (default off, `true`, `{ includePort: "both" }`).
- Lightfast: snapshot test in `apps/app` (Phase 4).
- Platform: optional inline `isAllowedOrigin` unit test (Phase 3).

### Integration Tests:

- Manual smoke in primary worktree: `pnpm dev:full` → app loads, Server Action fires, platform tRPC call succeeds.
- Manual smoke in non-primary worktree: same flow at `<prefix>.app.lightfast.localhost`.
- Negative manual: `curl -X OPTIONS -H "Origin: https://evil.com" ...` does not get an `Access-Control-Allow-Origin` header.

## Performance Considerations

- `getPortlessProxyOrigins` reads `lightfast.dev.json` + `microfrontends.json` once at module load; no per-request cost.
- The wildcard match in platform CORS does at most ~10 `endsWith` comparisons per request; negligible.
- The inline invariant assertion runs once at config load (only in dev); zero production cost.

## Migration Notes

- Old function names disappear in Phase 1's `0.2.0` publish. Any external consumer of `@lightfastai/dev-proxy@0.1.x` breaks at upgrade. The known consumers are this repo + `~/Code/mfe-sandbox/example/apps/*`, both updated in this plan.
- The `@lightfastai/dev-proxy` semver bump (0.1 → 0.2) signals the breaking rename.
- No data migration. No env-var changes.

## References

- Source research: `thoughts/shared/research/2026-05-05-portless-mfe-dev-origins-allowedorigins.md`
- Upstream package: `~/Code/mfe-sandbox/packages/dev-proxy/`
- Upstream gap inventory: `~/Code/mfe-sandbox/MULTI_WORKTREE_BLOCKERS.md` (sections B3, B5, B10)
- Catalog pin: `pnpm-workspace.yaml:19`
- Current call sites: `apps/app/next.config.ts:1-19,80-92,162-166`, `apps/www/next.config.ts:1,103`, `apps/platform/src/app/(trpc)/api/trpc/[trpc]/route.ts:1-25`
- Desktop launcher consumer: `scripts/with-desktop-env.mjs:6,58` (imports `resolvePortlessMfeUrl` from `@lightfastai/dev-proxy` root)
- Trailing-slash bug source: `@lightfastai/dev-proxy@0.1.24/dist/index.js:116-141, 624-632`
- Related plan (PR #630, untouched by this work): `thoughts/shared/plans/2026-05-05-pr630-related-projects-allowlist.md`

---

## Improvement Log

**2026-05-05 — Adversarial review pass (`/improve_plan`)**

Driven by: deep audit of URL/CORS/origin surfaces across `apps/app`, `apps/www`, `apps/platform`, `apps/desktop`. Spike confirmed one critical bug; user picked all three recommended scope answers.

**Spike result — CONFIRMED**: Platform tRPC CORS is currently **silently broken in dev**. `appUrl` resolves to `"https://app.lightfast.localhost/"` (trailing slash from `resolvePortlessUrl`'s `path ?? "/"` default) while the browser's `Origin` header is `"https://app.lightfast.localhost"` (no slash). The strict `origin !== appUrl` check at `apps/platform/.../route.ts:11` is therefore always true → no `Access-Control-Allow-Origin` header is ever written in dev. Verified by running `@lightfastai/dev-proxy@0.1.24/dist/index.js`'s `resolvePortlessUrl` with mocked portless URL and observing `withTargetPath(base, "/")` → `new URL("/", base).toString()` returns the slashed form.

**Changes made**:

1. **Phase 3 reframed** as a coupled fix (not just "widening"): explicitly names the trailing-slash bug as the root cause, switches the comparator to `new URL(appUrl).origin`, widens to wildcard for cold-start + worktree resilience, and aligns `apps/app/.../route.ts` to use the same shared helper. Added a desktop-renderer carve-out (Bearer auth means localhost CORS admission is safe).

2. **Phase 1 audit step added**: confirm `resolvePortlessMfeUrl`, `resolveProjectUrl`, `resolvePortlessApplicationUrl` survive `0.2.0` unchanged. Protects `pnpm dev:desktop` (consumes root export, not `/next`).

3. **Critical ESM bug fixed**: `apps/app` is `"type": "module"`; the proposed assertion used `__dirname` (undefined in ESM). Replaced with `fileURLToPath(import.meta.url)`. Dropped the broken `node -e "require('./next.config.ts')"` verification step.

4. **Header drift closed**: `trpc-accept` added to platform's allow-headers (parity with app).

5. **Cold-start guard added**: if `appUrl` resolves to `https://lightfast.ai` in dev (portless daemon down at module load), `origin-allowlist.ts` throws at import. Better to crash boot than silently 401 every cross-origin call for hours.

6. **Phase 5 docs expanded**: added desktop as a "non-Next consumer" of the origin world, documented the asymmetry where `apps/app/.../route.ts` keeps a `localhost:*` carve-out for the Vite renderer while `apps/platform/.../route.ts` doesn't, explained `canonicalAppOrigin` and the cold-start guard.

7. **Phase 4 snapshot annotated**: comment added explaining why `lightfast-platform` is intentionally absent from the origin set (not a member of the MFE mesh in `microfrontends.json`).

8. **Test infra clarified**: `apps/platform` has no `vitest.config.ts`. Test the shared helper from `apps/app` side only — code is identical and `apps/app/vitest.config.ts` already exists.

9. **Sentry wrapping order check** added to Phase 2 platform changes (passthrough — should be fine, but verify build log).

**Out of scope, flagged for future**: cross-app surfaces that don't currently need CORS (gateway SSE, CLI endpoints, OAuth callbacks). Bearer-authenticated server-to-server or browser-redirect surfaces — no breakage today, but a future hardening pass should audit.

**Not done — explicit decisions**:
- Did not extract `origin-allowlist.ts` to `@vendor/*`. Two 25-line copies < premature abstraction; revisit at three consumers.
- Did not drop the wildcard match in favor of just `new URL(appUrl).origin` strict equality. The wildcard buys non-primary worktree support and cold-start resilience for one extra `endsWith` per request.

---

**2026-05-05 — Phase 2 deviations**

1. **Upstream type bug discovered + patched (0.2.0 → 0.2.1)**: The published `@lightfastai/dev-proxy@0.2.0` shipped `NextConfigWithPortlessProxy` with index signatures (`[key: string]: unknown`) on `experimental` and `experimental.serverActions`. Next's `ExperimentalConfig` is a closed type without an index signature, so the intersection `T & NextConfigWithPortlessProxy` couldn't be satisfied by `NextConfig` — every Next consumer call site failed typecheck:

   ```
   Type 'ExperimentalConfig' is not assignable to type
     '{ [key: string]: unknown; serverActions?: ... }'.
   Index signature for type 'string' is missing in type 'ExperimentalConfig'.
   ```

   Phase 1's upstream tests didn't catch it (they use untyped fixtures, not real `NextConfig`). Patched in `~/Code/mfe-sandbox/packages/dev-proxy/src/next.ts` by dropping the index-signature requirements (the wrapper just spreads — it doesn't read arbitrary keys). Bumped to `0.2.1`, published. Lightfast catalog now pinned at `^0.2.1`. CTS path was already correctly loose (`[key: string]: any`) so no change there.

2. **Removed `assertPortlessInvariants` from `apps/app/next.config.ts`** per user feedback ("we definitely don't need the assert portless proxy ... too strict"). Original rationale was to fail loud on `lightfast.dev.json#portless.{port,https}` drift, but the cost (~40 lines of ESM-aware fs/path scaffolding, three candidate path resolutions, one inline JSON schema check) outweighed the benefit for a config file that is rarely touched. The Phase 5 CLAUDE.md doc block referencing this assertion will need to be removed when Phase 5 lands.

---

**2026-05-05 — Phase 3 deviations**

1. **Added `appUrl` self-export to `apps/app/src/lib/related-projects.ts`**. The plan's helper code imports `appUrl` from `~/lib/related-projects`, but the app's related-projects file only exported `wwwUrl` and `platformUrl` (the app didn't reference itself). Added `appUrl` as a self-resolving export: in dev → `resolveProjectUrl("lightfast-app")` (portless URL); in preview/prod → `https://lightfast.ai` (microfrontends serves under one domain so this is correct for both). The plan's "(mirror in apps/app, swap env import)" instruction is therefore expanded to "swap env import + add appUrl self-reference".

2. **Cold-start guard skips Next build phase**. As written, `if (isDev && canonicalAppOrigin === "https://lightfast.ai") throw …` fired during `next build`'s page-data collection (no portless running, but also no need for it). Added `isBuildPhase = process.env.NEXT_PHASE?.includes("build") ?? false` and gate the throw on `!isBuildPhase`. The guard still fires during `next dev` boot and at request time on the production server (where it's a no-op because `isDev` is false), preserving the intent: crash dev boot when portless is missing, silent in production.

3. **Did not extract a test for `apps/platform/src/lib/origin-allowlist.ts`**. The two helpers are byte-identical (same code). Per the plan's note ("testing the helper from app side is sufficient since the code is the same"), the unit test lives only in `apps/app/src/lib/__tests__/origin-allowlist.test.ts`.

---

**2026-05-05 — Phase 5 deviations**

1. **Dropped the `assertPortlessInvariants` paragraph** from the CLAUDE.md doc block (per Phase 2 deviation #2 — the assertion was removed mid-implementation). The "Invariants enforced inline at `apps/app/next.config.ts`" line in the plan's draft was omitted from the rendered section.

2. **Added a build-phase note to the cold-start guard documentation** (per Phase 3 deviation #2). The CLAUDE.md section now states that the guard is skipped during `next build` so production builds don't need portless running — useful context for a future contributor debugging an unexpected throw.

3. **Repo's `pnpm check` does not lint Markdown** (it runs `ultracite`, which is a JS/TS Biome wrapper). The plan's "Markdown lints cleanly" automated check is not mechanically enforceable here; verified manually that file references in the new section all resolve.
