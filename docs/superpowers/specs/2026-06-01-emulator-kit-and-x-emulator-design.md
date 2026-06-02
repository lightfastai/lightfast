# Emulator Kit + X Emulator (auth-only slice) — Design

**Date:** 2026-06-01
**Status:** Approved (design); pending implementation plan
**Author:** Jeevan Pillay (with Claude)

## Goal

Establish a consistent architecture for local service emulators so that every
emulator Lightfast owns is built the same way: on top of the
`@emulators/core` vendor substrate, with our own store collections, routes, and
seed piped in as a `ServicePlugin`. Introduce a thin local kit to remove the
boot/lifecycle duplication the substrate leaves to each caller, and prove the
pattern end-to-end by adding a new X (Twitter) emulator scoped to an auth-only
slice.

This is infrastructure work. All emulator code is dev-only; production runtime
must never import it.

## Background / current state

There is **no** local `emulators/core` package. The `core` that the GitHub
emulator imports is the third-party **`@emulators/core`** package from
**`vercel-labs/emulate`** (homepage `emulate.dev`), catalog-pinned at `0.6.0`
with two small local patches (`patches/@emulators__core@0.6.0.patch`,
`patches/emulate@0.6.0.patch`, both touching `authMiddleware`/`parseJsonBody`).

Two emulators exist today:

| | `@repo/github-emulator` | `@repo/linear-emulator` |
|---|---|---|
| Base | `@emulators/core` + official `@emulators/github` plugin | none — hand-rolled `node:http` server (~450 lines) |
| Why | GitHub has a published plugin and a large REST resource model | no published `@emulators/linear` plugin; small bespoke surface (OAuth + GraphQL + MCP) |

The split is incidental, not a missing abstraction. GitHub adopts a vendor
framework that happened to ship a GitHub plugin; Linear was hand-rolled because
that framework ships nothing for Linear and its surface was small.

### Feasibility verdict

`@emulators/core` is a **generic** emulator kernel, not GitHub-specific:

1. `@emulators/github` is literally `declare const githubPlugin: ServicePlugin` —
   the entire GitHub emulator is one plugin on the generic kernel.
2. `Store` is a generic in-memory DB: `store.collection<T>(name, indexFields)`
   defines arbitrary typed collections; `getData`/`setData` for loose state.
3. The router is a bundled Hono — `app.get/post/on(method, path, …)` accept
   arbitrary routes, so bespoke surfaces (GraphQL, MCP, OAuth) fit as plain
   handlers. It is not REST-resource-locked.

Core also ships an OAuth/auth toolkit we would otherwise hand-roll:
`authMiddleware`, `requireAuth`, `TokenMap`, `matchesRedirectUri`,
`constantTimeSecretEqual`, `parseCookies`, `renderFormPostPage`,
`WebhookDispatcher`, `filePersistence`, and pagination helpers.

**Conclusion:** Yes — every emulator we own can always depend on
`@emulators/core` and pipe in our own store/plugin/seed via the `ServicePlugin`
interface. That is the framework's intended extension model.

### Known caveats (designed-around, not blockers)

- `WebhookDispatcher` is GitHub-shaped (`{ owner, repo?, events[] }`); other
  services repurpose `owner` as a tenant key and ignore `repo`.
- `Entity` forces `{ id: number, created_at, updated_at }`; services with string
  IDs store the real id as a field and keep the numeric `id` internal.
- Auth `TokenMap` uses `login`/`id`/`scopes` (GitHub-ish field names).
- Pre-1.0 vendor with local patches: each version bump requires re-basing two
  small patches.
- The substrate does **not** solve boot/lifecycle duplication
  (`formatListenUrl`, `waitForListening`, `closeServer`, the `Started*` return
  shape are copied verbatim between the two emulators today). That is the gap
  the kit fills.

## Decisions

- **Substrate (Layer A):** standardize on `@emulators/core` for every emulator
  we own.
- **Kit (Layer B):** introduce `@repo/emulator-kit` for the boot/lifecycle code.
- **Kit location:** `emulators/kit` — all emulator-related code stays under
  `emulators/`, nothing leaks into `packages/` (emulators are not part of the
  app).
- **X emulator:** new `@repo/x-emulator`, built as a `ServicePlugin` on the kit.
  Scoped to an **auth-only slice**.
- **GitHub:** light refactor onto the kit (its existing tests guard the change).
- **Linear:** standalone, untouched for now; migrate onto the kit later.

## Architecture

```
Layer A (vendor):   @emulators/core  (vercel-labs/emulate 0.6.0)
                    Hono router · generic Store · auth/OAuth/webhook toolkit
                    ServicePlugin = { name, register(), seed() }

Layer B (ours):     @repo/emulator-kit  (emulators/kit)
                    startEmulator(plugin, opts) · formatListenUrl /
                    waitForListening / closeServer · StartedEmulator

Emulators:          @repo/x-emulator      = xPlugin + fixtures (NEW, on kit)
                    @repo/github-emulator = githubPlugin (light refactor onto kit)
                    @repo/linear-emulator = standalone (untouched)
```

## Component 1 — `@repo/emulator-kit` (`emulators/kit`)

A library package (not a runnable emulator). Owns only the genuinely-duplicated
lifecycle code.

```ts
// emulators/kit/src/index.ts
export interface StartedEmulator {
  app: Hono<AppEnv>;
  store: Store;
  webhooks: WebhookDispatcher;
  tokenMap: TokenMap;
  listenUrl: string;
  publicOrigin: string;
  url: string;
  reset(): void;
  close(): Promise<void>;
}

export interface StartEmulatorOptions extends ServerOptions {
  host?: string;
  port?: number;
  appOrigin?: string;
  publicOrigin?: string;
  // Escape hatches so GitHub's quirks fit without bending the kit:
  createFetch?(server, ctx): FetchHandler; // default: server.app.fetch
  seed?(server, ctx): void;                // default: plugin.seed?.(store, publicOrigin)
  onReady?(server): void;                  // GitHub overrides webhooks.dispatch here
}

export function startEmulator(
  plugin: ServicePlugin,
  opts?: StartEmulatorOptions,
): Promise<StartedEmulator>;

// Exported primitives (escape hatch if the hooks get ugly):
export { formatListenUrl, waitForListening, closeServer };
```

`startEmulator` wires `core.createServer(plugin, serverOptions)` →
`serve({ fetch, hostname, port })` → `waitForListening` → returns a
`StartedEmulator`. The `createFetch`/`seed`/`onReady` hooks exist so the GitHub
emulator (which wraps `app.fetch` with `createGitHubCompatibleFetch`, overrides
`webhooks.dispatch`, and seeds in multiple steps) can route through the same
entrypoint.

**Scope discipline:** kit v1 is lifecycle only. The `/failures` + `/reset`
failure-switch convention stays in the X plugin for now; it is promoted into the
kit when Linear migrates (rule of three — two consumers today is not enough to
fix the shared shape).

**Risk:** if the three hooks turn into hook-soup during the GitHub refactor,
GitHub falls back to the exported primitives and keeps its own boot function.
Decided during implementation, not now.

## Component 2 — `@repo/x-emulator` (`emulators/x`)

Structure mirrors `emulators/linear`. Auth-only slice.

```ts
// emulators/x/src/x-plugin.ts
export const xPlugin: ServicePlugin = {
  name: "x",
  register(app, store, _webhooks, baseUrl, tokenMap) {
    app.get ("/oauth2/authorize", c => /* validate client_id + redirect_uri + S256 challenge -> 302 ?code&state */);
    app.post("/oauth2/token",     c => /* authorization_code (verify PKCE S256) + refresh_token grants */);
    app.post("/oauth2/revoke",    c => /* 200 / invalid_token */);
    app.get ("/2/users/me",       requireAuth(), c => /* { data: { id, name, username } } */);
    app.post("/failures",         c => store.setData("failures", merge(...)));
    app.post("/reset",            c => store.setData("failures", defaults()));
  },
  seed(store) {
    store.collection("users").insert(X_FIXTURES.user);
    // + token fixtures
  },
};
```

Routes (auth-only slice):

- `GET  /oauth2/authorize` — OAuth 2.0 PKCE; validate `client_id`,
  `redirect_uri`, `code_challenge` (`S256`), `state`; 302 to `redirect_uri` with
  `code` + `state`.
- `POST /oauth2/token` — `authorization_code` grant verifies PKCE
  (`sha256(code_verifier)` base64url === stored `code_challenge`) via
  `node:crypto`; `refresh_token` grant issues new tokens.
- `POST /oauth2/revoke` — 200 for known tokens, `invalid_token` otherwise.
- `GET  /2/users/me` — bearer-validated; returns X v2 shape
  `{ data: { id, name, username } }`.
- `POST /failures` — set failure switches.
- `POST /reset` — clear failure switches.

Baked-in decisions (approved):

- **OAuth 2.0 + PKCE, public client** (`client_id` in body, no secret). Real
  S256 validation, because connectors get PKCE wrong and the emulator should
  enforce it. Confidential/Basic-auth variant deferred.
- **Failure switches:** `accessTokenExpired` (→ `/2/users/me` 401), `refresh`
  (→ refresh grant `invalid_grant`), `usersMe` (→ 500). Mirrors Linear's switches
  and exists to test the connector's token-refresh path.
- **Auth via core's toolkit:** seed `tokens` into `createServer`, guard
  `/2/users/me` with `requireAuth()` plus a thin failure-switch check in front,
  rather than re-hand-rolling bearer validation.
- **No `@repo/x-app-*` dependency.** GitHub/Linear emulators import a production
  contract package to share fixtures; there is no X connector yet, so X's
  fixtures are self-contained and migrate into a contract package when the real
  connector lands.

## Component 3 — GitHub light refactor

Move `formatListenUrl`/`waitForListening`/`closeServer` and the `Started*` shape
out of `emulators/github/src/server.ts` into the kit; boot through
`startEmulator` using the `createFetch`/`seed`/`onReady` hooks. Service-specific
logic (`github-compatible-routes.ts`, `push-webhook-payload.ts`) stays in the
GitHub package. Guarded by the existing `server.test.ts` / `env.test.ts`.

## Dev / infra wiring

| Seam | File | Change |
|---|---|---|
| Port | — | github 4567, linear 4568 → **x = 4569** |
| Route | Portless | `https://x.lightfast.localhost`, name `x.lightfast` |
| Dev task | root `package.json` | add `_x_emulator` script (clone `_linear_emulator`, swap names/filter); append `//#_x_emulator` to `dev` |
| Turbo | `turbo.json` | register the `_x_emulator` root task (mirror `_linear_emulator`) |
| Env inject | `apps/app/package.json` → `with-related-projects` | append `@repo/x-emulator env:sh` with `--app-origin` / `--emulator-origin` |

`emulators/*` is a pnpm workspace glob, so both `emulators/kit` and `emulators/x`
auto-register; no `pnpm-workspace.yaml` edit needed.

**Honest gap:** the emulator boots and serves at `x.lightfast.localhost`, and
`X_*` env is injected into the app dev process, but **nothing in the app consumes
it yet** (no X connector). The deliverable is proven emulator infrastructure
ready for the connector — the same state Linear's slice was scoped to. The kit
refactor of GitHub is verifiable immediately via its existing tests.

## Testing

- `emulators/x/src/__tests__/server.test.ts` — mirror Linear's: OAuth happy
  path, PKCE rejection on bad verifier, refresh grant, each failure switch,
  `/2/users/me` bearer + 401.
- `emulators/kit/src/__tests__/` — small `startEmulator` lifecycle test
  (listen → reset → close).
- GitHub refactor guarded by existing `server.test.ts` / `env.test.ts` (green =
  no regression).

## File layout

```
emulators/kit/    package.json, tsconfig.json, vitest.config.ts,
                  src/index.ts, src/__tests__/
emulators/x/      package.json, tsconfig.json, vitest.config.ts, README.md,
                  src/{x-plugin.ts, server.ts, start.ts, env.ts, env-sh.ts,
                       fixtures.ts, __tests__/server.test.ts}
```

## Out of scope (YAGNI)

- Migrating Linear onto the kit.
- X read/write endpoints (mentions, search, posting) — added when a connector
  needs them.
- An `@repo/x-app-node` contract package — lands with the real connector.
- Promoting failure-switches into the kit — waits for the second kit consumer.
