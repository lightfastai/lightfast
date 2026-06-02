# Emulator Architecture Redesign — Design Spec

> Status: design approved in brainstorming; awaiting spec review before writing-plans.
> Date: 2026-06-01

## Goal

Eliminate the triplicated boot plumbing across the three owned emulators (github, linear, x) and give every emulator a structure where concerns — **oauth / viewer / mcp / webhook / seed / failures** — are first-class and addable, **without rewriting github's working, 36-test-covered composition logic**.

## Problem statement

Two distinct kinds of mess are tangled together today.

### 1. Triplicated boot plumbing

`env.ts`, `env-sh.ts`, and `start.ts` are ~95% byte-identical across all three emulators. The only genuine per-service differences are:

| file | what actually differs |
|---|---|
| `env.ts` | the `{SERVICE}_EMULATOR_ORIGIN` var name + default port (4567 / 4568 / 4569) |
| `env-sh.ts` | the same origin var name |
| `start.ts` | the `[service-emulator]` log prefix |
| `fixtures.ts` | nothing — the `shellQuote` + `format*EnvString` + `ENV_ASSIGNMENT_NAME_RE` block is **byte-for-byte identical** in all three |

`@repo/emulator-kit` today owns only the **listen lifecycle** (`startEmulator`, `formatListenUrl`, `waitForListening`, `closeServer`). It does **not** own the env / CLI / process lifecycle, so three copies of that drift independently.

### 2. No expression of "concerns / capabilities"

Each emulator is a flat folder. Nothing in the structure reveals that:

| capability | github | linear | x |
|---|---|---|---|
| OAuth | app + user (PKCE) | yes (no PKCE) | yes (PKCE S256) |
| App / installations | yes | — | — |
| Webhook | yes (`push.ts`, `push-webhook-payload.ts`) | future | future |
| MCP | — | yes (`/mcp` JSON-RPC) | — |
| rich seed | `GitHubSeedConfig` | minimal | minimal |
| failure switches | — | yes | yes |

Capabilities are smeared into one `*-plugin.ts` (linear/x) or split ad-hoc (github). When webhook is added to linear/x later, there is no slot for it.

### 3. Two structural facts the design must respect

- **github is the odd one out**: it wraps the *published* `@emulators/github` plugin and hand-wires `createServer` + a 953-line `github-compatible-routes.ts` fetch wrapper + an `appKeyResolver` + a monkey-patch of `server.webhooks.dispatch`. It does **not** go through `startEmulator`. It must keep its bespoke composition.
- **Fixtures have no shared contract**: every emulator invents its own export shape, and the env-projection (`get*EmulatorEnv`) + shell-format helpers sit next to genuinely per-service data with no boundary.

## Decisions (from brainstorming)

1. **Scope:** Own the boot layer + standardize structure. Kit owns env/cli/format/manifest/lifecycle; each emulator = manifest + fixtures(data) + plugin/(concerns) + 2-line bootstraps. **No** capability-composition framework yet (YAGNI — webhooks are "not now").
2. **github:** Boot layer + light relocate. github adopts the shared boot layer (kills its triplication) and its plugin composition is **relocated, not rewritten**. Logic stays byte-identical.
3. **env-projection:** lives in `manifest.ts`. `fixtures.ts` becomes pure data.
4. **Failure switches:** kept self-contained — each emulator owns its own `plugin/failures.ts`. No kit promotion.
5. **Execution:** spec → plan → user confirm → execute task-by-task.

## Architecture

```
TIER 1 — @repo/emulator-kit        (owns ALL shared plumbing)
   manifest contract · env schema · env:sh CLI · start harness
   · shell-format · startEmulator lifecycle

TIER 2 — per-emulator               (owns ONLY what is service-specific)
   manifest.ts  ·  fixtures.ts (data)  ·  plugin/ (concern fragments)
   ·  2-line start.ts + env-sh.ts bootstraps
```

## Tier 1 — `@repo/emulator-kit` (concern-split)

The kit is a single `src/index.ts` monolith today. Split it:

```
emulators/kit/src/
  manifest.ts    EmulatorManifest + RunnableEmulator + EmulatorStartInput   ← NEW (the seam)
  env.ts         createEmulatorEnv(manifest, runtimeEnv?) → ResolvedEmulatorEnv
  cli.ts         runEnvSh(manifest) · runStart(manifest)
  format.ts      formatEnvString() + shellQuote() (+ ENV_ASSIGNMENT_NAME_RE)
  lifecycle.ts   startEmulator, formatListenUrl, waitForListening, closeServer,
                 StartedEmulator, StartEmulatorOptions, StartEmulatorContext, EmulatorServer
  index.ts       re-exports all of the above
  __tests__/
    start-emulator.test.ts   (existing — unchanged)
    env.test.ts              (NEW — createEmulatorEnv via a test manifest)
    cli.test.ts              (NEW — runEnvSh arg parsing + output; optional runStart smoke)
```

### `manifest.ts` — the contract (the heart of the redesign)

```ts
export interface RunnableEmulator {        // minimal surface the start harness consumes
  close(): Promise<void>;
  listenUrl: string;
  publicOrigin: string;
}

export interface EmulatorStartInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export interface EmulatorManifest {
  name: string;          // "x"  → ServicePlugin name + "[x-emulator]" log prefix
  port: number;          // 4569 → default PORT
  originEnvVar: string;  // "X_EMULATOR_ORIGIN" → dynamic env-schema key
  env(appOrigin: string, emulatorOrigin: string): Record<string, string>; // app-facing projection
  start(input: EmulatorStartInput): Promise<RunnableEmulator>;
}
```

Both linear/x (`StartedEmulator`) and github (`StartedGitHubEmulator`) returns are structural supersets of `RunnableEmulator`, so **github's `startGitHubEmulator` needs zero logic changes** to satisfy `manifest.start`.

### `env.ts` — schema factory with a computed key

```ts
export interface ResolvedEmulatorEnv {
  appOrigin: string;
  emulatorOrigin?: string;
  host: string;
  port: number;
}

export function createEmulatorEnv(
  manifest: EmulatorManifest,
  runtimeEnv: NodeJS.ProcessEnv = process.env
): ResolvedEmulatorEnv;
```

Builds the `@t3-oss/env-core` schema with a **computed property key** `[manifest.originEnvVar]: z.string().url().optional()`, plus the shared `HOST` / `LIGHTFAST_APP_ORIGIN` / `PORTLESS_URL` / `PORT` (default `manifest.port`). Returns `emulatorOrigin = env[originEnvVar] ?? env.PORTLESS_URL`. This is the single copy of what was three identical `create*EmulatorRuntimeEnv` functions.

### `cli.ts` — the process harness (one copy)

```ts
export function runEnvSh(manifest: EmulatorManifest): void;   // replaces every src/env-sh.ts body
export function runStart(manifest: EmulatorManifest): Promise<void>; // replaces every src/start.ts body
```

- `runEnvSh`: parses `--app-origin` / `--emulator-origin` from `process.argv`, layers them onto `process.env`, calls `createEmulatorEnv`, then `console.log(formatEnvString(manifest.env(appOrigin, emulatorOrigin)))`.
- `runStart`: `createEmulatorEnv` → `manifest.start({ appOrigin, host, port, publicOrigin: emulatorOrigin })` → logs `[<name>-emulator] listening on …` / `public origin …`, then the redacted `manifest.env(...)` assignments (the `/(?:KEY|SECRET|TOKEN|PRIVATE)/i` → `<redacted>` rule moves here), then installs `SIGINT`/`SIGTERM` handlers calling `emulator.close()`.

### `format.ts` — the de-duplicated shell formatter

```ts
export function formatEnvString(env: Record<string, string>): string;
```

The exact `ENV_ASSIGNMENT_NAME_RE` + `shellQuote` + NUL-byte guard block currently copy-pasted into all three `fixtures.ts`. Each `fixtures.ts` loses `format*EnvString`, `shellQuote`, and `ENV_ASSIGNMENT_NAME_RE`.

### `lifecycle.ts`

Today's `src/index.ts` content verbatim (`startEmulator`, `formatListenUrl`, `waitForListening`, `closeServer`, and the `Started*`/`StartEmulator*`/`EmulatorServer` types). Pure file move; `index.ts` re-exports it.

## Tier 2 — per-emulator layouts

### x — full concern-split (reference for the simplest case)

```
x/src/
  manifest.ts    name "x", port 4569, originEnvVar "X_EMULATOR_ORIGIN", env(), start: startXEmulator
  server.ts      KEPT — startXEmulator wrapper; ONE-LINE change: import xPlugin from "./plugin"
  fixtures.ts    DATA ONLY: X_EMULATOR_FIXTURES, X_EMULATOR_OAUTH_CODE, X_EMULATOR_SCOPE
  plugin/
    oauth.ts     registerOAuth   — /oauth2/authorize (PKCE S256), /oauth2/token, /oauth2/revoke
    users.ts     registerUsers   — /2/users/me (usersMe failure switch); owns XUserRow + userResponse
    auth.ts      bearerToken, isValidBearer (imports getFailures from ./failures)
    failures.ts  registerFailures, FailureSwitches, defaultFailures, getFailures, seedFailures
                 — /failures, /reset; switches: accessTokenExpired, refresh, usersMe
    index.ts     xPlugin: ServicePlugin (name "x") composing oauth+users+failures + seed(store)
  start.ts       2 lines (runStart(xManifest))
  env-sh.ts      2 lines (runEnvSh(xManifest))
  __tests__/server.test.ts   UNCHANGED (imports startXEmulator from ../server; 9-test guard)
```

Tests import `startXEmulator` and `X_EMULATOR_FIXTURES`/`X_EMULATOR_OAUTH_CODE` from `../server`/`../fixtures` — both survive, so the suite is **literally unchanged**.

`manifest.ts` references the kept `startXEmulator` (uniform with github's `startGitHubEmulator`):

```ts
import type { EmulatorManifest } from "@repo/emulator-kit";
import { X_EMULATOR_FIXTURES } from "./fixtures";
import { startXEmulator } from "./server";

export const xManifest: EmulatorManifest = {
  name: "x",
  port: 4569,
  originEnvVar: "X_EMULATOR_ORIGIN",
  env: (_appOrigin, emulatorOrigin) => ({
    X_CLIENT_ID: X_EMULATOR_FIXTURES.oauthClientId,
    X_CLIENT_SECRET: X_EMULATOR_FIXTURES.oauthClientSecret,
    X_API_ORIGIN: emulatorOrigin,
    X_OAUTH_ORIGIN: emulatorOrigin,
  }),
  start: startXEmulator,
};
```

`plugin/index.ts` (composition):

```ts
import type { ServicePlugin } from "@emulators/core";
import { X_EMULATOR_FIXTURES } from "../fixtures";
import { registerFailures, seedFailures } from "./failures";
import { registerOAuth } from "./oauth";
import { registerUsers, type XUserRow } from "./users";

export const xPlugin: ServicePlugin = {
  name: "x",
  register(app, store) {
    registerOAuth(app, store);
    registerUsers(app, store);
    registerFailures(app, store);
  },
  seed(store) {
    seedFailures(store);
    store.collection<XUserRow>("users").insert({
      x_id: X_EMULATOR_FIXTURES.userId,
      name: X_EMULATOR_FIXTURES.userName,
      username: X_EMULATOR_FIXTURES.username,
    });
  },
};
```

Each `register*` fragment is a `(app: Hono<AppEnv>, store: Store) => void` that owns its routes and route-local helpers (PKCE hashing + `tokenResponse` stay in `oauth.ts`). The seed preserves the original behavior exactly (set default failures + insert the seeded user).

**Dependency direction (no cycles):** `failures.ts` → (none) · `auth.ts` → `failures` · `oauth.ts` → `failures` · `users.ts` → `auth` + `failures` · `index.ts` → all.

### linear — full concern-split (same shape as x, + viewer + mcp)

```
linear/src/
  manifest.ts    name "linear", port 4568, originEnvVar "LINEAR_EMULATOR_ORIGIN", env(), start: startLinearEmulator
  server.ts      KEPT — startLinearEmulator wrapper; ONE-LINE change: import linearPlugin from "./plugin"
  fixtures.ts    DATA ONLY: LINEAR_EMULATOR_FIXTURES, LINEAR_EMULATOR_OAUTH_CODE, LINEAR_EMULATOR_TOOLS
  plugin/
    oauth.ts     registerOAuth   — /oauth/authorize (no PKCE), /oauth/token, /oauth/revoke;
                 owns tokenResponse + clientCredentialsValid
    viewer.ts    registerViewer  — /viewer, /graphql (bearer → viewerResponse); owns viewerResponse
    mcp.ts       registerMcp     — /mcp JSON-RPC (initialize / tools/list / tools/call / 202 / -32601);
                 honors mcpListTools failure (-32003, 500); owns McpRequestBody
    auth.ts      bearerToken, isValidBearer (imports getFailures from ./failures)
    failures.ts  registerFailures, FailureSwitches, defaultFailures, getFailures, seedFailures
                 — /failures, /reset; switches: accessTokenExpired, mcpListTools, refresh
    index.ts     linearPlugin: ServicePlugin (name "linear") composing oauth+viewer+mcp+failures + seed(store)
  start.ts       2 lines (runStart(linearManifest))
  env-sh.ts      2 lines (runEnvSh(linearManifest))
  __tests__/server.test.ts   UNCHANGED (imports startLinearEmulator from ../server; 10-test guard,
                              incl. the real listLinearMcpTools assertion from @repo/linear-app-node)
```

`manifest.env` returns `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_API_ORIGIN`, `LINEAR_MCP_ENDPOINT: \`${emulatorOrigin}/mcp\``.

The deferred `shared.ts`-vs-co-location decision is now resolved: a per-emulator `auth.ts` holds `bearerToken`/`isValidBearer`; the `FailureSwitches` machinery + `getFailures` live in `failures.ts`. Route-local helpers (`tokenResponse`, `clientCredentialsValid`, `viewerResponse`, `McpRequestBody`) co-locate with the concern that uses them.

**Dependency direction (no cycles):** `failures.ts` → (none) · `auth.ts` → `failures` · `oauth.ts` → `failures` · `viewer.ts` → `auth` · `mcp.ts` → `auth` + `failures` · `index.ts` → all.

### github — boot layer + light relocate (logic byte-identical)

```
github/src/
  manifest.ts    NEW — name "github", port 4567, originEnvVar "GITHUB_EMULATOR_ORIGIN",
                 env: getGitHubEmulatorEnv, start: startGitHubEmulator
  fixtures.ts    DATA ONLY — GITHUB_EMULATOR_FIXTURES, createGitHubEmulatorSeed, getGitHubEmulatorEnv,
                 RSA private key; LOSES formatGitHubEmulatorEnvString/shellQuote/ENV_ASSIGNMENT_NAME_RE (→ kit)
  plugin/
    index.ts            ← server.ts, SAME logic: startGitHubEmulator, addOrgMembership, appKeyResolver,
                          createServer(githubPlugin, …), webhooks.dispatch patch, seed()
    compatible-routes.ts ← github-compatible-routes.ts, moved unchanged (953 L)
    webhook/
      push.ts            ← push.ts, moved unchanged (188 L)
      push-payload.ts    ← push-webhook-payload.ts, moved unchanged (166 L)
  start.ts       2 lines (runStart(githubManifest))
  env-sh.ts      2 lines (runEnvSh(githubManifest))
  __tests__/
    server.test.ts             (30 tests) import specifiers → ../plugin, ../plugin/compatible-routes
    oauth-user-account.test.ts (5 tests)  import specifiers → ../plugin, ../plugin/compatible-routes
    test-helpers.ts            import specifier → ../plugin
    env.test.ts                (3 tests) REMOVED here; its env-schema coverage moves to
                               kit/__tests__/env.test.ts, replaced by a small manifest.test.ts
                               (asserts githubManifest.env(...) → GITHUB_APP_* vars)
```

**Relative-import updates when files move into `plugin/`** (mechanical, not logic — but required or the build breaks):

| file | import was | becomes |
|---|---|---|
| `plugin/index.ts` (←server.ts) | `./fixtures` | `../fixtures` |
| `plugin/index.ts` | `./github-compatible-routes` | `./compatible-routes` |
| `plugin/index.ts` | `./push-webhook-payload` | `./webhook/push-payload` |
| `plugin/compatible-routes.ts` | `./fixtures` | `../fixtures` |
| `plugin/webhook/push.ts` | `./fixtures` / `./push-webhook-payload` | `../../fixtures` / `./push-payload` |
| `plugin/webhook/push-payload.ts` | `./fixtures` (if any) | `../../fixtures` |

`startGitHubEmulator` is **not** rewritten to use `startEmulator` (even though every hook it needs — `appKeyResolver`, `tokens`, `createFetch`, `onReady`, `seed` override — already exists on `StartEmulatorOptions`). That collapse is explicitly **out of scope** for this pass to keep the 35-test composition guard (5 oauth-user-account + 30 server) byte-identical; it is noted as a possible future follow-up.

## The 2-line bootstraps (identical pattern in all three)

```ts
// <svc>/src/start.ts
import { runStart } from "@repo/emulator-kit";
import { <svc>Manifest } from "./manifest";
await runStart(<svc>Manifest);
```

```ts
// <svc>/src/env-sh.ts
import { runEnvSh } from "@repo/emulator-kit";
import { <svc>Manifest } from "./manifest";
runEnvSh(<svc>Manifest);
```

`package.json` scripts (`"dev": "tsx ./src/start.ts"`, `"env:sh": "tsx ./src/env-sh.ts"`) and the root `apps/app/package.json` `with-related-projects` wiring are **unchanged** — the entrypoint files just get thinner.

## File-by-file disposition

| current | becomes |
|---|---|
| `kit/src/index.ts` | split → `lifecycle.ts` + re-export `index.ts`; gains `manifest.ts`, `env.ts`, `cli.ts`, `format.ts` |
| `{github,linear,x}/src/env.ts` | **deleted** → `kit/createEmulatorEnv` |
| `{github,linear,x}/src/env-sh.ts` | **2-line bootstrap** → `kit/runEnvSh` |
| `{github,linear,x}/src/start.ts` | **2-line bootstrap** → `kit/runStart` |
| `*/fixtures.ts` format helpers | **deleted** → `kit/formatEnvString` |
| `*/fixtures.ts` `get*EmulatorEnv` | **moved** → `manifest.ts` `env()` |
| `{linear,x}/src/server.ts` | **kept**; one-line import change (`./*-plugin` → `./plugin`) |
| `x/src/x-plugin.ts` | split → `x/src/plugin/{oauth,users,auth,failures,index}.ts` (bodies verbatim) |
| `linear/src/linear-plugin.ts` | split → `linear/src/plugin/{oauth,viewer,mcp,auth,failures,index}.ts` (bodies verbatim) |
| `github/src/server.ts` | moved → `github/src/plugin/index.ts` (logic unchanged; relative imports updated) |
| `github/src/github-compatible-routes.ts` | moved → `github/src/plugin/compatible-routes.ts` (unchanged) |
| `github/src/push.ts` | moved → `github/src/plugin/webhook/push.ts` (unchanged) |
| `github/src/push-webhook-payload.ts` | moved → `github/src/plugin/webhook/push-payload.ts` (unchanged) |

## Migration order (tests guard every step)

1. **Kit** — add `manifest.ts`, `env.ts`, `cli.ts`, `format.ts`; split `index.ts` → `lifecycle.ts`; add kit env/cli tests. Kit tests green.
2. **x** (simplest) — manifest + `plugin/` split + 2-line bootstraps; delete `env.ts`. 9 tests green.
3. **linear** — same pattern + `mcp.ts`/`viewer.ts`. 10 tests green.
4. **github** — add manifest; relocate `server.ts`/routes/webhook into `plugin/` (with the relative-import updates above); delete `env.ts`, thin `env-sh.ts`/`start.ts` to bootstraps; migrate `env.test.ts`'s 3 tests to kit + add `manifest.test.ts`; update test import specifiers. The 35 composition tests (5 oauth-user-account + 30 server) stay green.
5. **Full sweep** — `pnpm check` (biome/ultracite) + `pnpm typecheck` + all tests + one live `pnpm dev` smoke per service (x `/2/users/me`, linear `/viewer` + `/mcp tools/list`, github OAuth/webhook).

## Testing strategy

- Existing per-emulator `server.test.ts` suites are the **regression guard** and stay behaviorally unchanged (only github's import specifiers move). They must pass after each step.
- Kit gains `env.test.ts` (computed-key schema, port defaulting, `PORTLESS_URL` fallback) and `cli.test.ts` (arg parsing + emitted env string; redaction). These absorb the coverage deleted from each emulator's `env.ts`/`env-sh.ts`.
- github gains a small `manifest.test.ts` asserting the `env()` projection emits the expected `GITHUB_APP_*` keys (the part of the old `env.test.ts` that is github-specific).

## Out of scope (explicit YAGNI)

- No capability-composition framework (`withOAuth()`/`withMcp()` kit modules). Concerns are plain register-fragments, not a framework.
- No webhook for linear/x now — but `plugin/` leaves an obvious slot (`plugin/webhook.ts` + one line in `index.ts`) for the marketplace-integration work later.
- No promotion of failure switches to the kit (kept self-contained per decision 4).
- No rewrite of github's `startGitHubEmulator` to route through `startEmulator` (kept byte-identical; possible future follow-up).

## Constraints (carried)

- Emulator code is **dev-only**; production runtime must never import it.
- Commit only when asked; commit with explicit pathspecs (a concurrent agent may pre-stage unrelated files); do not push.
