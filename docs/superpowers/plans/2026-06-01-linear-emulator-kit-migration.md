# Linear Emulator → Kit Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `@repo/linear-emulator` from a standalone `node:http` server onto the shared `@repo/emulator-kit` by rewriting it as a `ServicePlugin` on `@emulators/core`, booted by `startEmulator` — exactly mirroring the X emulator — while preserving 100% of its current behavior (guarded by the existing test suite).

**Architecture:** Linear today is a ~450-line hand-rolled `node:http` server with duplicated lifecycle helpers and closure-held failure switches. After this migration it becomes `linear-plugin.ts` (a `ServicePlugin` whose routes are Hono handlers and whose failure switches live in the `Store`) plus a thin `server.ts` wrapper that calls `startEmulator(linearPlugin, …)`. The public `StartedLinearEmulator` becomes an alias of the kit's `StartedEmulator` (the previously-exposed `failures` field is dropped — no consumer reads it). Linear keeps its own `/failures` + `/reset` routes self-contained in the plugin (matching X; no kit promotion).

**Tech Stack:** TypeScript (ESM), `@emulators/core` (Hono `Context`/`ServicePlugin`/`Store`), `@repo/emulator-kit` (`startEmulator`), `vitest`, pnpm workspaces, Turborepo.

**Design context:** Extends `docs/superpowers/specs/2026-06-01-emulator-kit-and-x-emulator-design.md` (the deferred "Migrate Linear onto the kit" item). Failure-switch promotion into the kit is explicitly **out of scope** (only two consumers; YAGNI).

**Conventions observed (do not deviate):**
- Internal `@repo/*` packages export TS source directly; no build step.
- Linear's port stays **4568**; routes and wire-level responses are unchanged.
- Externals use `catalog:`; internal deps use `workspace:*`.
- Commit with explicit pathspecs (a concurrent agent may stage unrelated files). Do **not** `git push`.
- The existing `emulators/linear/src/__tests__/server.test.ts` (10 tests) is the regression guard and **must not be modified**.

---

## File Structure

**Create:**
- `emulators/linear/src/linear-plugin.ts` — the `ServicePlugin` (all 8 routes as Hono handlers + seed)

**Modify:**
- `emulators/linear/package.json` — add `@emulators/core` + `@repo/emulator-kit` deps
- `emulators/linear/src/server.ts` — replace the ~450-line server with a thin `startEmulator` wrapper

**Unchanged (verified):**
- `emulators/linear/src/start.ts` — uses `.listenUrl` / `.publicOrigin` / `.close()`, all present on `StartedEmulator`
- `emulators/linear/src/fixtures.ts`, `src/env.ts`, `src/env-sh.ts`
- `emulators/linear/src/__tests__/server.test.ts` — the behavior guard
- Dev wiring (`package.json` `_linear_emulator`, `turbo.json`, `apps/app` `with-related-projects`) — Linear already wired; port/route unchanged

---

## Task 1: Add kit + core dependencies to the Linear emulator

**Files:**
- Modify: `emulators/linear/package.json`

- [ ] **Step 1: Add the two dependencies**

In `emulators/linear/package.json`, replace the `"dependencies"` block:

```json
  "dependencies": {
    "@repo/linear-app-node": "workspace:*",
    "@t3-oss/env-core": "catalog:",
    "zod": "catalog:"
  },
```

with:

```json
  "dependencies": {
    "@emulators/core": "catalog:",
    "@repo/emulator-kit": "workspace:*",
    "@repo/linear-app-node": "workspace:*",
    "@t3-oss/env-core": "catalog:",
    "zod": "catalog:"
  },
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes; `@emulators/core` and `@repo/emulator-kit` linked into `emulators/linear` (lockfile gains the two entries under `emulators/linear:`).

- [ ] **Step 3: Verify the lockfile diff is only the Linear dep additions**

Run: `git --no-pager diff pnpm-lock.yaml`
Expected: the only changes are `'@emulators/core'` and `'@repo/emulator-kit': link:../kit` added under the `emulators/linear:` importer. If anything else changed, stop and investigate before committing.

- [ ] **Step 4: Commit**

```bash
git add emulators/linear/package.json pnpm-lock.yaml
git commit -m "chore(linear-emulator): add @emulators/core + @repo/emulator-kit deps" -- emulators/linear/package.json pnpm-lock.yaml
```

---

## Task 2: Create the Linear `ServicePlugin`

**Files:**
- Create: `emulators/linear/src/linear-plugin.ts`

- [ ] **Step 1: Create `emulators/linear/src/linear-plugin.ts`**

This ports every route from the old `server.ts` to Hono handlers, with failure switches moved into the `Store`. Behavior is identical: confidential-client validation (`client_id` **and** `client_secret`), no PKCE, and the full MCP JSON-RPC dispatch.

```ts
import type { Context, ServicePlugin, Store } from "@emulators/core";

import {
  LINEAR_EMULATOR_FIXTURES,
  LINEAR_EMULATOR_OAUTH_CODE,
  LINEAR_EMULATOR_TOOLS,
} from "./fixtures";

const TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 2_592_000;

interface FailureSwitches {
  accessTokenExpired: boolean;
  mcpListTools: boolean;
  refresh: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "mcpListTools",
  "refresh",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, mcpListTools: false, refresh: false };
}

function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

function tokenResponse() {
  return {
    access_token: LINEAR_EMULATOR_FIXTURES.accessToken,
    expires_in: TOKEN_EXPIRES_IN_SECONDS,
    refresh_token: LINEAR_EMULATOR_FIXTURES.refreshToken,
    refresh_token_expires_in: REFRESH_TOKEN_EXPIRES_IN_SECONDS,
    scope: "read,write",
    token_type: "Bearer",
  };
}

function viewerResponse() {
  return {
    data: {
      viewer: {
        id: LINEAR_EMULATOR_FIXTURES.actorId,
        name: LINEAR_EMULATOR_FIXTURES.actorName,
        organization: {
          id: LINEAR_EMULATOR_FIXTURES.workspaceId,
          name: LINEAR_EMULATOR_FIXTURES.workspaceName,
        },
      },
    },
  };
}

function clientCredentialsValid(clientId: unknown, clientSecret: unknown): boolean {
  return (
    String(clientId ?? "") === LINEAR_EMULATOR_FIXTURES.oauthClientId &&
    String(clientSecret ?? "") === LINEAR_EMULATOR_FIXTURES.oauthClientSecret
  );
}

function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}

function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === LINEAR_EMULATOR_FIXTURES.accessToken
  );
}

interface McpRequestBody {
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: unknown };
}

export const linearPlugin: ServicePlugin = {
  name: "linear",
  register(app, store) {
    app.get("/oauth/authorize", (c) => {
      const clientId = c.req.query("client_id");
      const redirectUri = c.req.query("redirect_uri");
      if (clientId !== LINEAR_EMULATOR_FIXTURES.oauthClientId || !redirectUri) {
        return c.json({ error: "invalid_request" }, 400);
      }

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set("code", LINEAR_EMULATOR_OAUTH_CODE);
      const state = c.req.query("state");
      if (state) {
        redirectUrl.searchParams.set("state", state);
      }
      return c.redirect(redirectUrl.toString(), 302);
    });

    app.post("/oauth/token", async (c) => {
      const form = await c.req.parseBody();
      if (!clientCredentialsValid(form.client_id, form.client_secret)) {
        return c.json({ error: "invalid_client" }, 401);
      }

      const grantType = String(form.grant_type ?? "");
      if (grantType === "authorization_code") {
        if (String(form.code ?? "") !== LINEAR_EMULATOR_OAUTH_CODE) {
          return c.json({ error: "invalid_grant" }, 400);
        }
        return c.json(tokenResponse(), 200);
      }

      if (grantType === "refresh_token") {
        const failures = getFailures(store);
        if (
          failures.refresh ||
          String(form.refresh_token ?? "") !== LINEAR_EMULATOR_FIXTURES.refreshToken
        ) {
          return c.json({ error: "invalid_grant" }, 400);
        }
        return c.json(tokenResponse(), 200);
      }

      return c.json({ error: "unsupported_grant_type" }, 400);
    });

    app.post("/oauth/revoke", async (c) => {
      const form = await c.req.parseBody();
      if (!clientCredentialsValid(form.client_id, form.client_secret)) {
        return c.json({ error: "invalid_client" }, 401);
      }

      const token = String(form.token ?? "");
      if (
        token === LINEAR_EMULATOR_FIXTURES.accessToken ||
        token === LINEAR_EMULATOR_FIXTURES.refreshToken
      ) {
        return c.body(null, 200);
      }
      return c.json({ error: "invalid_token" }, 400);
    });

    app.get("/viewer", (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ error: "invalid_token" }, 401);
      }
      return c.json(viewerResponse(), 200);
    });

    app.post("/graphql", (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ error: "invalid_token" }, 401);
      }
      return c.json(viewerResponse(), 200);
    });

    app.post("/mcp", async (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ error: "invalid_token" }, 401);
      }

      const body = (await c.req.json().catch(() => null)) as McpRequestBody | null;
      if (!body?.method) {
        return c.json({ error: "invalid_request" }, 400);
      }

      if (body.id === undefined || body.id === null) {
        return c.body(null, 202);
      }

      if (body.method === "initialize") {
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: {
              capabilities: { tools: {} },
              protocolVersion: "2025-06-18",
              serverInfo: { name: "linear-emulator", version: "0.1.0" },
            },
          },
          200
        );
      }

      if (body.method === "tools/list") {
        if (getFailures(store).mcpListTools) {
          return c.json(
            {
              error: { code: -32_003, message: "Linear MCP list-tools failure" },
              id: body.id,
              jsonrpc: "2.0",
            },
            500
          );
        }
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: { tools: LINEAR_EMULATOR_TOOLS },
          },
          200
        );
      }

      if (body.method === "tools/call") {
        const name = body.params?.name;
        const tool = LINEAR_EMULATOR_TOOLS.find((item) => item.name === name);
        if (!tool) {
          return c.json(
            {
              error: { code: -32_602, message: `Unknown tool: ${name ?? ""}` },
              id: body.id,
              jsonrpc: "2.0",
            },
            200
          );
        }

        const structuredContent = {
          arguments: body.params?.arguments ?? {},
          ok: true,
          tool: tool.name,
        };
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: {
              content: [
                { type: "text", text: JSON.stringify(structuredContent, null, 2) },
              ],
              structuredContent,
            },
          },
          200
        );
      }

      return c.json(
        {
          error: { code: -32_601, message: `Unsupported method: ${body.method}` },
          id: body.id,
          jsonrpc: "2.0",
        },
        200
      );
    });

    app.post("/failures", async (c) => {
      const body = (await c.req.json().catch(() => null)) as
        | Partial<Record<keyof FailureSwitches, unknown>>
        | null;
      if (body !== null && (typeof body !== "object" || Array.isArray(body))) {
        return c.json({ error: "invalid_failure_switches" }, 400);
      }

      const failures = getFailures(store);
      for (const name of failureSwitchNames) {
        const value = body?.[name];
        if (value === undefined) {
          continue;
        }
        if (typeof value !== "boolean") {
          return c.json({ error: "invalid_failure_switch", field: name }, 400);
        }
        failures[name] = value;
      }
      store.setData("failures", failures);
      return c.json({ failures }, 200);
    });

    app.post("/reset", (c) => {
      const failures = defaultFailures();
      store.setData("failures", failures);
      return c.json({ failures }, 200);
    });
  },
  seed(store) {
    store.setData("failures", defaultFailures());
  },
};
```

- [ ] **Step 2: Typecheck the plugin in isolation (server.ts still old)**

Run: `pnpm --filter @repo/linear-emulator typecheck`
Expected: PASS. (The old `server.ts` still compiles; the new `linear-plugin.ts` adds no errors. If `clientCredentialsValid` or `Context` usage errors, fix before continuing.)

---

## Task 3: Rewrite `server.ts` as a thin kit wrapper + verify behavior parity

**Files:**
- Modify: `emulators/linear/src/server.ts`

- [ ] **Step 1: Replace the entire contents of `emulators/linear/src/server.ts`**

```ts
import { type StartedEmulator, startEmulator } from "@repo/emulator-kit";

import { linearPlugin } from "./linear-plugin";

export interface StartLinearEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedLinearEmulator = StartedEmulator;

export function startLinearEmulator(
  input: StartLinearEmulatorInput = {}
): Promise<StartedLinearEmulator> {
  return startEmulator(linearPlugin, {
    appOrigin: input.appOrigin,
    host: input.host,
    port: input.port ?? 4568,
    publicOrigin: input.publicOrigin,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @repo/linear-emulator typecheck`
Expected: PASS — no leftover references to the deleted helpers; `start.ts` and the test still compile against `StartLinearEmulatorInput` / `StartedLinearEmulator` / `startLinearEmulator`.

- [ ] **Step 3: Run the existing test suite (the regression guard) — must stay green**

Run: `pnpm --filter @repo/linear-emulator test`
Expected: PASS — all 10 tests green, including:
- OAuth authorization-code flow (302 with code + state, token exchange)
- invalid client credentials → 401
- refresh + forced refresh-failure switch → 200 then 400
- `/viewer` + `/graphql` viewer payload, `/oauth/revoke` → 200
- missing/invalid MCP bearer → 401
- deterministic `tools/list` (raw POST) → tools array
- deterministic `tools/list` **through the real `listLinearMcpTools` client** → equals `LINEAR_EMULATOR_TOOLS`
- `mcpListTools` failure switch → 500 with `-32003`
- non-boolean failure switch → 400 `invalid_failure_switch`
- `/reset` clears switches → `/viewer` 200 again

If the real-MCP-client test fails, that is the highest-risk parity point — inspect the JSON-RPC response shape against the old `handleMcp` before changing anything else.

- [ ] **Step 4: Biome check on the changed files; apply fixes if any**

Run: `npx ultracite@latest check emulators/linear/src/linear-plugin.ts emulators/linear/src/server.ts`
Expected: no errors. If Biome reports formatting/sorting fixes, run:
`npx ultracite@latest fix emulators/linear/src/linear-plugin.ts emulators/linear/src/server.ts`
then re-run the check (expect clean) and re-run the test suite (expect 10 green).

- [ ] **Step 5: Commit**

```bash
git add emulators/linear/src/linear-plugin.ts emulators/linear/src/server.ts
git commit -m "refactor(linear-emulator): migrate onto @repo/emulator-kit as a ServicePlugin" -- emulators/linear/src/linear-plugin.ts emulators/linear/src/server.ts
```

---

## Task 4: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Typecheck all four emulator packages**

Run: `pnpm --filter @repo/emulator-kit --filter @repo/x-emulator --filter @repo/github-emulator --filter @repo/linear-emulator typecheck`
Expected: PASS for all four.

- [ ] **Step 2: Run all four emulator test suites**

Run: `pnpm --filter @repo/emulator-kit --filter @repo/x-emulator --filter @repo/github-emulator --filter @repo/linear-emulator test`
Expected: PASS — kit 3, X 9, GitHub 36, Linear 10.

- [ ] **Step 3: Confirm the dev wiring for Linear is unchanged**

Run: `pnpm --silent --filter @repo/linear-emulator env:sh -- --app-origin https://lightfast.localhost --emulator-origin http://127.0.0.1:4568`
Expected output (exact — proves the env contract is untouched):

```text
LINEAR_CLIENT_ID='linear_lightfast_local'
LINEAR_CLIENT_SECRET='linear-local-secret'
LINEAR_API_ORIGIN='http://127.0.0.1:4568'
LINEAR_MCP_ENDPOINT='http://127.0.0.1:4568/mcp'
```

- [ ] **Step 4: Smoke-test the dev entrypoint boots and serves**

Run (background): `PORT=4568 pnpm --filter @repo/linear-emulator dev > /tmp/linear-emulator-smoke.log 2>&1 &`
Then once `listening on` appears in the log:
`curl -s http://127.0.0.1:4568/viewer -H "authorization: Bearer linear_access_valid"`
Expected: `{"data":{"viewer":{"id":"linear_actor_lightfast_local","name":"Lightfast Local","organization":{"id":"linear_workspace_lightfast_emulated","name":"lightfast-emulated"}}}}`
Then stop it: `pkill -f "emulators/linear/src/start.ts"`

- [ ] **Step 5: Confirm GitHub/X/kit were not touched by this migration**

Run: `git status --porcelain emulators/github emulators/x emulators/kit`
Expected: empty output (this migration only changed `emulators/linear` + the lockfile).

---

## Self-Review

**Spec coverage:**
- Migrate Linear onto the kit as a `ServicePlugin` on `@emulators/core` → Tasks 2–3. ✓
- Preserve all 8 routes + exact wire responses → Task 2 (ported verbatim), guarded by Task 3 Step 3. ✓
- Confidential client (id + secret), no PKCE → `clientCredentialsValid` in Task 2. ✓
- Failure switches into the `Store`, self-contained `/failures` + `/reset` (no kit promotion) → Task 2 plugin; chosen scope. ✓
- `StartedLinearEmulator = StartedEmulator`, drop unused `failures` field → Task 3 (verified no consumer reads it). ✓
- Port 4568, dev wiring untouched → Task 3 Step 1 (`?? 4568`), Task 4 Step 3. ✓
- Existing tests unchanged + green → Task 3 Step 3, Task 4 Step 2. ✓
- GitHub/X/kit untouched → Task 4 Step 5. ✓

**Placeholder scan:** No TBD/TODO; `linear-plugin.ts` and `server.ts` are shown in full; every command has expected output. ✓

**Type consistency:** `StartedEmulator` (kit) ← `StartedLinearEmulator` (server.ts) ← used by `start.ts`/test. `startEmulator(plugin, options)` matches its call. `FailureSwitches` keys (`accessTokenExpired`/`mcpListTools`/`refresh`) are identical to the old server and the test's switch names. `LINEAR_EMULATOR_FIXTURES` field names (`oauthClientId`, `oauthClientSecret`, `accessToken`, `refreshToken`, `actorId`, `actorName`, `workspaceId`, `workspaceName`), `LINEAR_EMULATOR_OAUTH_CODE`, and `LINEAR_EMULATOR_TOOLS` match `fixtures.ts`. The `?? 4568` default preserves both the production port and the `port: 0` test path (`0 ?? 4568 === 0`). ✓
