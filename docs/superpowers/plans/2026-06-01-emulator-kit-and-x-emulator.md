# Emulator Kit + X Emulator (auth-only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared `@repo/emulator-kit` for emulator boot/lifecycle, build a new `@repo/x-emulator` (OAuth 2.0 PKCE auth-only slice) on top of it and `@emulators/core`, and lightly refactor the GitHub emulator to consume the kit's lifecycle primitives.

**Architecture:** Two layers. Layer A is the vendor substrate `@emulators/core` (`vercel-labs/emulate` 0.6.0) — a generic Hono router + in-memory `Store` + auth/OAuth toolkit, extended via the `ServicePlugin` interface (`{ name, register(), seed() }`). Layer B is `emulators/kit` (`@repo/emulator-kit`), a thin local library exposing `startEmulator(plugin, opts)` plus the `formatListenUrl`/`waitForListening`/`closeServer` primitives that are currently copy-pasted across emulators. The X emulator is one `ServicePlugin` booted by `startEmulator`. GitHub keeps its own boot but imports the shared primitives. Linear is untouched.

**Tech Stack:** TypeScript (ESM), `@emulators/core` (Hono-based), `@t3-oss/env-core` + `zod` for env parsing, `tsx` for dev/start, `vitest` for tests, pnpm workspaces (`emulators/*` glob), Turborepo, Portless dev routing.

**Design doc:** `docs/superpowers/specs/2026-06-01-emulator-kit-and-x-emulator-design.md`

**Conventions observed (do not deviate):**
- Internal `@repo/*` packages export TS source directly: `"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }`. No build step.
- Emulators live under `emulators/`; `emulators/*` is a pnpm workspace glob, so new packages auto-register (no `pnpm-workspace.yaml` edit).
- Ports: github `4567`, linear `4568`, **x `4569`**.
- Externals use `catalog:`; internal deps use `workspace:*`.
- Commit with explicit pathspecs (a concurrent agent may stage unrelated files). Do **not** `git push`.

---

## File Structure

**Create:**
- `emulators/kit/package.json` — `@repo/emulator-kit` manifest
- `emulators/kit/tsconfig.json` — extends `@repo/typescript-config/base.json`
- `emulators/kit/vitest.config.ts` — merges `@repo/vitest-config`
- `emulators/kit/src/index.ts` — lifecycle primitives + `startEmulator` + `StartedEmulator`
- `emulators/kit/src/__tests__/start-emulator.test.ts` — kit lifecycle test
- `emulators/x/package.json` — `@repo/x-emulator` manifest
- `emulators/x/tsconfig.json`, `emulators/x/vitest.config.ts`
- `emulators/x/src/fixtures.ts` — deterministic fixtures + env helpers
- `emulators/x/src/env.ts` — runtime env parsing
- `emulators/x/src/env-sh.ts` — `env:sh` emitter for `with-related-projects`
- `emulators/x/src/x-plugin.ts` — the `ServicePlugin` (routes + seed)
- `emulators/x/src/server.ts` — `startXEmulator()` wrapper over the kit
- `emulators/x/src/start.ts` — process entrypoint
- `emulators/x/src/__tests__/server.test.ts` — X emulator tests
- `emulators/x/README.md`

**Modify:**
- `emulators/github/src/server.ts` — delete 3 duplicated helpers, import from kit
- `emulators/github/package.json` — add `@repo/emulator-kit` dep
- `package.json` (root) — add `_x_emulator` script + `//#_x_emulator` to `dev`
- `turbo.json` — register `//#_x_emulator` root task
- `apps/app/package.json` — append X emulator to `with-related-projects`

---

## Task 1: Scaffold `@repo/emulator-kit` package

**Files:**
- Create: `emulators/kit/package.json`
- Create: `emulators/kit/tsconfig.json`
- Create: `emulators/kit/vitest.config.ts`
- Create: `emulators/kit/src/index.ts` (temporary empty export)

- [ ] **Step 1: Create `emulators/kit/package.json`**

```json
{
  "name": "@repo/emulator-kit",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@emulators/core": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Create `emulators/kit/tsconfig.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `emulators/kit/vitest.config.ts`**

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 4: Create `emulators/kit/src/index.ts` (temporary placeholder)**

```ts
export {};
```

- [ ] **Step 5: Install workspace deps so the new package links**

Run: `pnpm install`
Expected: completes; `@repo/emulator-kit` appears in the workspace (no missing-peer errors).

- [ ] **Step 6: Typecheck the empty package**

Run: `pnpm --filter @repo/emulator-kit typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add emulators/kit/package.json emulators/kit/tsconfig.json emulators/kit/vitest.config.ts emulators/kit/src/index.ts pnpm-lock.yaml
git commit -m "chore(emulator-kit): scaffold @repo/emulator-kit package"
```

---

## Task 2: Implement kit lifecycle + `startEmulator` (TDD)

**Files:**
- Test: `emulators/kit/src/__tests__/start-emulator.test.ts`
- Modify: `emulators/kit/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `emulators/kit/src/__tests__/start-emulator.test.ts`:

```ts
import type { ServicePlugin } from "@emulators/core";
import { afterEach, describe, expect, it } from "vitest";

import { type StartedEmulator, startEmulator } from "../index";

const pingPlugin: ServicePlugin = {
  name: "ping",
  register(app, store) {
    app.get("/ping", (c) =>
      c.json({ ok: true, count: store.getData<number>("count") ?? 0 })
    );
  },
  seed(store) {
    store.setData("count", 1);
  },
};

let emulator: StartedEmulator | undefined;

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

describe("@repo/emulator-kit startEmulator", () => {
  it("boots a plugin, serves its routes, and reports a listen url", async () => {
    emulator = await startEmulator(pingPlugin, { port: 0 });
    expect(emulator.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const res = await fetch(`${emulator.url}/ping`);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, count: 1 });
  });

  it("reset re-runs the plugin seed", async () => {
    emulator = await startEmulator(pingPlugin, { port: 0 });
    emulator.store.setData("count", 99);

    const before = await (await fetch(`${emulator.url}/ping`)).json();
    expect(before).toEqual({ ok: true, count: 99 });

    emulator.reset();
    const after = await (await fetch(`${emulator.url}/ping`)).json();
    expect(after).toEqual({ ok: true, count: 1 });
  });

  it("close stops the server", async () => {
    const local = await startEmulator(pingPlugin, { port: 0 });
    const { url } = local;
    await local.close();
    await expect(fetch(`${url}/ping`)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @repo/emulator-kit test`
Expected: FAIL — `startEmulator` / `StartedEmulator` not exported from `../index`.

- [ ] **Step 3: Implement the kit in `emulators/kit/src/index.ts`**

Replace the entire file with:

```ts
import type { Server } from "node:http";

import {
  type AppEnv,
  type FetchHandler,
  type Hono,
  type ServerOptions,
  type ServicePlugin,
  type Store,
  type TokenMap,
  type WebhookDispatcher,
  createServer,
  serve,
} from "@emulators/core";

export type EmulatorServer = ReturnType<typeof createServer>;

export interface StartEmulatorContext {
  appOrigin?: string;
  publicOrigin?: string;
}

export interface StartEmulatorOptions extends ServerOptions {
  host?: string;
  port?: number;
  appOrigin?: string;
  publicOrigin?: string;
  /** Wrap the fetch handler (e.g. host-routing shims). Default: server.app.fetch. */
  createFetch?(server: EmulatorServer, ctx: StartEmulatorContext): FetchHandler;
  /** Override seeding. Default: store.reset() then plugin.seed(store, publicOrigin). */
  seed?(server: EmulatorServer, ctx: StartEmulatorContext): void;
  /** Mutate the server before it starts listening (e.g. override webhooks.dispatch). */
  onReady?(server: EmulatorServer): void;
}

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

export function formatListenUrl(host: string, port: number): string {
  const urlHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  const formattedHost = urlHost.includes(":") ? `[${urlHost}]` : urlHost;
  return `http://${formattedHost}:${port}`;
}

export function waitForListening(httpServer: Server): Promise<void> {
  if (httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onListening = () => {
      cleanup();
      resolve();
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
  });
}

export function closeServer(httpServer: Server): Promise<void> {
  if (!httpServer.listening) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function startEmulator(
  plugin: ServicePlugin,
  options: StartEmulatorOptions = {}
): Promise<StartedEmulator> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 0;

  const server = createServer(plugin, {
    appKeyResolver: options.appKeyResolver,
    baseUrl: options.publicOrigin,
    docsUrl: options.docsUrl,
    fallbackUser: options.fallbackUser,
    port: port || undefined,
    tokens: options.tokens,
  });

  const ctx: StartEmulatorContext = {
    appOrigin: options.appOrigin,
    publicOrigin: options.publicOrigin,
  };

  const runSeed = () => {
    if (options.seed) {
      options.seed(server, ctx);
      return;
    }
    server.store.reset();
    plugin.seed?.(server.store, options.publicOrigin ?? "");
  };

  runSeed();
  options.onReady?.(server);

  const fetchHandler: FetchHandler = options.createFetch
    ? options.createFetch(server, ctx)
    : server.app.fetch;

  const httpServer = serve({
    fetch: fetchHandler,
    hostname: host,
    port,
  });

  await waitForListening(httpServer).catch(async (error: unknown) => {
    await closeServer(httpServer).catch(() => undefined);
    throw error;
  });

  const address = httpServer.address();
  const resolvedPort =
    typeof address === "object" && address ? address.port : port;
  const listenUrl = formatListenUrl(host, resolvedPort);
  const publicOrigin = options.publicOrigin ?? listenUrl;

  let closed = false;

  return {
    app: server.app,
    store: server.store,
    webhooks: server.webhooks,
    tokenMap: server.tokenMap,
    listenUrl,
    publicOrigin,
    url: listenUrl,
    reset: runSeed,
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      await closeServer(httpServer);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @repo/emulator-kit test`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @repo/emulator-kit typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add emulators/kit/src/index.ts emulators/kit/src/__tests__/start-emulator.test.ts
git commit -m "feat(emulator-kit): add startEmulator + lifecycle primitives"
```

---

## Task 3: Refactor GitHub emulator onto the kit primitives

This is the **light** refactor: GitHub keeps its own boot function but deletes the three lifecycle helpers it duplicates and imports them from the kit. GitHub's existing tests guard the change.

**Files:**
- Modify: `emulators/github/package.json` (add dep)
- Modify: `emulators/github/src/server.ts` (delete 3 functions, add import)

- [ ] **Step 1: Add the kit dependency to `emulators/github/package.json`**

In the `"dependencies"` object, add (keep alphabetical-ish ordering with the existing `@repo/github-app-contract`):

```json
    "@repo/emulator-kit": "workspace:*",
```

Resulting `"dependencies"` block:

```json
  "dependencies": {
    "@repo/emulator-kit": "workspace:*",
    "@repo/github-app-contract": "workspace:*",
    "@t3-oss/env-core": "catalog:",
    "zod": "catalog:"
  },
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: completes; `@repo/emulator-kit` linked into `emulators/github`.

- [ ] **Step 3: Add the kit import to `emulators/github/src/server.ts`**

After the existing `@emulators/github` import block (the one importing `getGitHubStore`, `githubPlugin`, `seedFromConfig`), add:

```ts
import {
  closeServer,
  formatListenUrl,
  waitForListening,
} from "@repo/emulator-kit";
```

- [ ] **Step 4: Delete the three now-duplicated local functions from `emulators/github/src/server.ts`**

Delete these three function definitions in full (they are now imported from the kit):
- `function waitForListening(httpServer: Server) { ... }`
- `function closeServer(httpServer: Server) { ... }`
- `function formatListenUrl(host: string, port: number) { ... }`

Leave everything else (including `import type { Server } from "node:http";`, `addOrgMembership`, `startGitHubEmulator`, the `webhooks.dispatch` override) unchanged.

- [ ] **Step 5: Typecheck GitHub emulator**

Run: `pnpm --filter @repo/github-emulator typecheck`
Expected: PASS (no unused-import or missing-symbol errors).

- [ ] **Step 6: Run GitHub emulator tests (regression guard)**

Run: `pnpm --filter @repo/github-emulator test`
Expected: PASS — all existing `server.test.ts` / `env.test.ts` / `oauth-user-account.test.ts` tests green, proving the kit primitives are behavior-identical.

- [ ] **Step 7: Commit**

```bash
git add emulators/github/package.json emulators/github/src/server.ts pnpm-lock.yaml
git commit -m "refactor(github-emulator): use @repo/emulator-kit lifecycle primitives"
```

---

## Task 4: Scaffold `@repo/x-emulator` (configs, fixtures, env)

**Files:**
- Create: `emulators/x/package.json`, `emulators/x/tsconfig.json`, `emulators/x/vitest.config.ts`
- Create: `emulators/x/src/fixtures.ts`, `emulators/x/src/env.ts`, `emulators/x/src/env-sh.ts`

- [ ] **Step 1: Create `emulators/x/package.json`**

```json
{
  "name": "@repo/x-emulator",
  "version": "0.1.0",
  "private": true,
  "license": "Apache-2.0",
  "type": "module",
  "sideEffects": false,
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "dev": "tsx ./src/start.ts",
    "env:sh": "tsx ./src/env-sh.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@emulators/core": "catalog:",
    "@repo/emulator-kit": "workspace:*",
    "@t3-oss/env-core": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@repo/vitest-config": "workspace:*",
    "@types/node": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

- [ ] **Step 2: Create `emulators/x/tsconfig.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "dom", "dom.iterable"]
  },
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `emulators/x/vitest.config.ts`**

```ts
import sharedConfig from "@repo/vitest-config";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      globals: true,
      environment: "node",
    },
  })
);
```

- [ ] **Step 4: Create `emulators/x/src/fixtures.ts`**

```ts
export const X_EMULATOR_FIXTURES = {
  oauthClientId: "x_lightfast_local",
  oauthClientSecret: "x-local-secret",
  userId: "x_user_lightfast_local",
  userName: "Lightfast Local",
  username: "lightfast_dev",
  accessToken: "x_access_valid",
  refreshToken: "x_refresh_valid",
} as const;

export const X_EMULATOR_OAUTH_CODE = "x_oauth_code_lightfast_local";

export const X_EMULATOR_SCOPE = "tweet.read users.read offline.access";

export function getXEmulatorEnv(
  _appOrigin: string,
  emulatorOrigin = "http://127.0.0.1:4569"
) {
  return {
    X_CLIENT_ID: X_EMULATOR_FIXTURES.oauthClientId,
    X_CLIENT_SECRET: X_EMULATOR_FIXTURES.oauthClientSecret,
    X_API_ORIGIN: emulatorOrigin,
    X_OAUTH_ORIGIN: emulatorOrigin,
  };
}

const ENV_ASSIGNMENT_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function shellQuote(value: string) {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatXEmulatorEnvString(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => {
      if (!ENV_ASSIGNMENT_NAME_RE.test(key)) {
        throw new Error(`Invalid environment variable name: ${key}`);
      }
      if (value.includes("\0")) {
        throw new Error(
          `Environment variable ${key} contains a NUL byte and cannot be passed to env -S`
        );
      }
      return `${key}=${shellQuote(value)}`;
    })
    .join("\n");
}
```

- [ ] **Step 5: Create `emulators/x/src/env.ts`**

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export interface XEmulatorRuntimeEnv {
  appOrigin: string;
  emulatorOrigin?: string;
  host: string;
  port: number;
}

export function createXEmulatorRuntimeEnv(
  runtimeEnv: NodeJS.ProcessEnv = process.env
): XEmulatorRuntimeEnv {
  const env = createEnv({
    server: {
      HOST: z.string().min(1).default("127.0.0.1"),
      LIGHTFAST_APP_ORIGIN: z
        .string()
        .url()
        .default("https://lightfast.localhost"),
      X_EMULATOR_ORIGIN: z.string().url().optional(),
      PORT: z.coerce.number().int().min(1).max(65_535).default(4569),
      PORTLESS_URL: z.string().url().optional(),
    },
    runtimeEnv: {
      HOST: runtimeEnv.HOST,
      LIGHTFAST_APP_ORIGIN: runtimeEnv.LIGHTFAST_APP_ORIGIN,
      X_EMULATOR_ORIGIN: runtimeEnv.X_EMULATOR_ORIGIN,
      PORT: runtimeEnv.PORT,
      PORTLESS_URL: runtimeEnv.PORTLESS_URL,
    },
    emptyStringAsUndefined: true,
    skipValidation:
      !!runtimeEnv.SKIP_ENV_VALIDATION ||
      runtimeEnv.npm_lifecycle_event === "lint",
  });

  return {
    appOrigin: env.LIGHTFAST_APP_ORIGIN,
    emulatorOrigin: env.X_EMULATOR_ORIGIN ?? env.PORTLESS_URL,
    host: env.HOST,
    port: env.PORT,
  };
}
```

- [ ] **Step 6: Create `emulators/x/src/env-sh.ts`**

```ts
import { createXEmulatorRuntimeEnv } from "./env";
import { formatXEmulatorEnvString, getXEmulatorEnv } from "./fixtures";

function readOption(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }

  return value;
}

function createRuntimeEnvWithOptions(): NodeJS.ProcessEnv {
  const appOrigin = readOption("--app-origin");
  const emulatorOrigin = readOption("--emulator-origin");

  return {
    ...process.env,
    ...(appOrigin ? { LIGHTFAST_APP_ORIGIN: appOrigin } : {}),
    ...(emulatorOrigin ? { X_EMULATOR_ORIGIN: emulatorOrigin } : {}),
  };
}

const env = createXEmulatorRuntimeEnv(createRuntimeEnvWithOptions());

console.log(
  formatXEmulatorEnvString(getXEmulatorEnv(env.appOrigin, env.emulatorOrigin))
);
```

- [ ] **Step 7: Install + typecheck**

Run: `pnpm install`
Then: `pnpm --filter @repo/x-emulator typecheck`
Expected: install completes; typecheck FAILS only because `server.ts`/`start.ts`/`x-plugin.ts` referenced by later tasks don't exist yet — but `fixtures.ts`/`env.ts`/`env-sh.ts` themselves must have no type errors. (If typecheck errors come only from missing `./server`/`./start` imports, that's fine because those files aren't created yet; there are no such imports in this task's files, so typecheck should actually PASS here.)
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add emulators/x/package.json emulators/x/tsconfig.json emulators/x/vitest.config.ts emulators/x/src/fixtures.ts emulators/x/src/env.ts emulators/x/src/env-sh.ts pnpm-lock.yaml
git commit -m "chore(x-emulator): scaffold @repo/x-emulator package and env wiring"
```

---

## Task 5: Implement the X plugin + server wrapper (TDD)

**Files:**
- Test: `emulators/x/src/__tests__/server.test.ts`
- Create: `emulators/x/src/x-plugin.ts`
- Create: `emulators/x/src/server.ts`

- [ ] **Step 1: Write the failing test**

Create `emulators/x/src/__tests__/server.test.ts`:

```ts
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { X_EMULATOR_FIXTURES, X_EMULATOR_OAUTH_CODE } from "../fixtures";
import { type StartedXEmulator, startXEmulator } from "../server";

const VERIFIER = "x_pkce_verifier_lightfast_local_0123456789";
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const REDIRECT_URI = "https://app.lightfast.localhost/api/connectors/x/callback";

let emulator: StartedXEmulator | undefined;

async function start() {
  emulator = await startXEmulator({ port: 0 });
  return emulator;
}

async function postForm(path: string, body: Record<string, string>) {
  const active = emulator ?? (await start());
  return await fetch(`${active.url}${path}`, {
    body: new URLSearchParams(body),
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

async function authorize(extra: Record<string, string> = {}) {
  const active = emulator ?? (await start());
  const url = new URL("/oauth2/authorize", active.url);
  url.searchParams.set("client_id", X_EMULATOR_FIXTURES.oauthClientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("code_challenge", CHALLENGE);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", "state_123");
  for (const [key, value] of Object.entries(extra)) {
    url.searchParams.set(key, value);
  }
  return await fetch(url, { redirect: "manual" });
}

afterEach(async () => {
  await emulator?.close();
  emulator = undefined;
});

describe("@repo/x-emulator", () => {
  it("completes the OAuth 2.0 PKCE authorization code flow", async () => {
    const authorizeRes = await authorize();
    expect(authorizeRes.status).toBe(302);

    const redirectUrl = new URL(authorizeRes.headers.get("location") ?? "");
    expect(redirectUrl.searchParams.get("code")).toBe(X_EMULATOR_OAUTH_CODE);
    expect(redirectUrl.searchParams.get("state")).toBe("state_123");

    const tokenRes = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      code: X_EMULATOR_OAUTH_CODE,
      code_verifier: VERIFIER,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });
    expect(tokenRes.status).toBe(200);
    await expect(tokenRes.json()).resolves.toMatchObject({
      access_token: X_EMULATOR_FIXTURES.accessToken,
      refresh_token: X_EMULATOR_FIXTURES.refreshToken,
      token_type: "bearer",
      expires_in: 7200,
    });
  });

  it("rejects a token exchange with an invalid PKCE verifier", async () => {
    await authorize();
    const res = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      code: X_EMULATOR_OAUTH_CODE,
      code_verifier: "wrong-verifier",
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid_grant" });
  });

  it("rejects an authorize request missing the PKCE challenge", async () => {
    const active = await start();
    const url = new URL("/oauth2/authorize", active.url);
    url.searchParams.set("client_id", X_EMULATOR_FIXTURES.oauthClientId);
    url.searchParams.set("redirect_uri", REDIRECT_URI);
    const res = await fetch(url, { redirect: "manual" });
    expect(res.status).toBe(400);
  });

  it("refreshes tokens and supports a forced refresh failure", async () => {
    const active = await start();

    const refreshRes = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      grant_type: "refresh_token",
      refresh_token: X_EMULATOR_FIXTURES.refreshToken,
    });
    expect(refreshRes.status).toBe(200);

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ refresh: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    const failedRes = await postForm("/oauth2/token", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      grant_type: "refresh_token",
      refresh_token: X_EMULATOR_FIXTURES.refreshToken,
    });
    expect(failedRes.status).toBe(400);
  });

  it("serves the authenticated user and revokes valid tokens", async () => {
    const active = await start();
    const authorization = `Bearer ${X_EMULATOR_FIXTURES.accessToken}`;

    const meRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization },
    });
    expect(meRes.status).toBe(200);
    await expect(meRes.json()).resolves.toMatchObject({
      data: {
        id: X_EMULATOR_FIXTURES.userId,
        username: X_EMULATOR_FIXTURES.username,
      },
    });

    const revokeRes = await postForm("/oauth2/revoke", {
      client_id: X_EMULATOR_FIXTURES.oauthClientId,
      token: X_EMULATOR_FIXTURES.accessToken,
    });
    expect(revokeRes.status).toBe(200);
  });

  it("rejects missing and invalid bearer tokens on /2/users/me", async () => {
    const active = await start();

    const missingRes = await fetch(`${active.url}/2/users/me`);
    expect(missingRes.status).toBe(401);

    const invalidRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(invalidRes.status).toBe(401);
  });

  it("supports the accessTokenExpired switch and reset", async () => {
    const active = await start();
    const authorization = `Bearer ${X_EMULATOR_FIXTURES.accessToken}`;

    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ accessTokenExpired: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const expiredRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization },
    });
    expect(expiredRes.status).toBe(401);

    const resetRes = await fetch(`${active.url}/reset`, { method: "POST" });
    expect(resetRes.status).toBe(200);

    const okRes = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization },
    });
    expect(okRes.status).toBe(200);
  });

  it("supports the usersMe failure switch", async () => {
    const active = await start();
    await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ usersMe: true }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const res = await fetch(`${active.url}/2/users/me`, {
      headers: { authorization: `Bearer ${X_EMULATOR_FIXTURES.accessToken}` },
    });
    expect(res.status).toBe(500);
  });

  it("rejects non-boolean failure switch values", async () => {
    const active = await start();
    const res = await fetch(`${active.url}/failures`, {
      body: JSON.stringify({ refresh: "false" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_failure_switch",
      field: "refresh",
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @repo/x-emulator test`
Expected: FAIL — `../server` (and `startXEmulator`) does not exist.

- [ ] **Step 3: Implement `emulators/x/src/x-plugin.ts`**

```ts
import { createHash } from "node:crypto";

import type { Context, Entity, ServicePlugin, Store } from "@emulators/core";

import {
  X_EMULATOR_FIXTURES,
  X_EMULATOR_OAUTH_CODE,
  X_EMULATOR_SCOPE,
} from "./fixtures";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 7200;

interface FailureSwitches {
  accessTokenExpired: boolean;
  refresh: boolean;
  usersMe: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "refresh",
  "usersMe",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

interface XUserRow extends Entity {
  x_id: string;
  name: string;
  username: string;
}

function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, refresh: false, usersMe: false };
}

function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function tokenResponse() {
  return {
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
    access_token: X_EMULATOR_FIXTURES.accessToken,
    scope: X_EMULATOR_SCOPE,
    refresh_token: X_EMULATOR_FIXTURES.refreshToken,
  };
}

function userResponse(store: Store) {
  const user = store.collection<XUserRow>("users").all()[0];
  return {
    data: {
      id: user?.x_id ?? X_EMULATOR_FIXTURES.userId,
      name: user?.name ?? X_EMULATOR_FIXTURES.userName,
      username: user?.username ?? X_EMULATOR_FIXTURES.username,
    },
  };
}

function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  return authorization.slice("Bearer ".length);
}

function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === X_EMULATOR_FIXTURES.accessToken
  );
}

export const xPlugin: ServicePlugin = {
  name: "x",
  register(app, store) {
    app.get("/oauth2/authorize", (c) => {
      const clientId = c.req.query("client_id");
      const redirectUri = c.req.query("redirect_uri");
      const codeChallenge = c.req.query("code_challenge");
      const codeChallengeMethod = c.req.query("code_challenge_method");

      if (
        clientId !== X_EMULATOR_FIXTURES.oauthClientId ||
        !redirectUri ||
        !codeChallenge ||
        codeChallengeMethod !== "S256"
      ) {
        return c.json({ error: "invalid_request" }, 400);
      }

      store.setData(`pkce:${X_EMULATOR_OAUTH_CODE}`, codeChallenge);

      const redirectUrl = new URL(redirectUri);
      redirectUrl.searchParams.set("code", X_EMULATOR_OAUTH_CODE);
      const state = c.req.query("state");
      if (state) {
        redirectUrl.searchParams.set("state", state);
      }
      return c.redirect(redirectUrl.toString(), 302);
    });

    app.post("/oauth2/token", async (c) => {
      const form = await c.req.parseBody();
      const clientId = String(form.client_id ?? "");
      const grantType = String(form.grant_type ?? "");

      if (clientId !== X_EMULATOR_FIXTURES.oauthClientId) {
        return c.json({ error: "invalid_client" }, 401);
      }

      if (grantType === "authorization_code") {
        const code = String(form.code ?? "");
        const codeVerifier = String(form.code_verifier ?? "");
        const expectedChallenge = store.getData<string>(`pkce:${code}`);

        if (
          code !== X_EMULATOR_OAUTH_CODE ||
          !codeVerifier ||
          !expectedChallenge ||
          pkceChallengeFromVerifier(codeVerifier) !== expectedChallenge
        ) {
          return c.json({ error: "invalid_grant" }, 400);
        }
        return c.json(tokenResponse(), 200);
      }

      if (grantType === "refresh_token") {
        const failures = getFailures(store);
        if (
          failures.refresh ||
          String(form.refresh_token ?? "") !== X_EMULATOR_FIXTURES.refreshToken
        ) {
          return c.json({ error: "invalid_grant" }, 400);
        }
        return c.json(tokenResponse(), 200);
      }

      return c.json({ error: "unsupported_grant_type" }, 400);
    });

    app.post("/oauth2/revoke", async (c) => {
      const form = await c.req.parseBody();
      if (String(form.client_id ?? "") !== X_EMULATOR_FIXTURES.oauthClientId) {
        return c.json({ error: "invalid_client" }, 401);
      }
      const token = String(form.token ?? "");
      if (
        token === X_EMULATOR_FIXTURES.accessToken ||
        token === X_EMULATOR_FIXTURES.refreshToken
      ) {
        return c.body(null, 200);
      }
      return c.json({ error: "invalid_token" }, 400);
    });

    app.get("/2/users/me", (c) => {
      if (!isValidBearer(c, store)) {
        return c.json({ title: "Unauthorized", status: 401 }, 401);
      }
      if (getFailures(store).usersMe) {
        return c.json({ title: "Internal Error", status: 500 }, 500);
      }
      return c.json(userResponse(store), 200);
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
    store.collection<XUserRow>("users").insert({
      x_id: X_EMULATOR_FIXTURES.userId,
      name: X_EMULATOR_FIXTURES.userName,
      username: X_EMULATOR_FIXTURES.username,
    });
  },
};
```

- [ ] **Step 4: Implement `emulators/x/src/server.ts`**

```ts
import { type StartedEmulator, startEmulator } from "@repo/emulator-kit";

import { xPlugin } from "./x-plugin";

export interface StartXEmulatorInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export type StartedXEmulator = StartedEmulator;

export function startXEmulator(
  input: StartXEmulatorInput = {}
): Promise<StartedXEmulator> {
  return startEmulator(xPlugin, {
    appOrigin: input.appOrigin,
    host: input.host,
    port: input.port ?? 4569,
    publicOrigin: input.publicOrigin,
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @repo/x-emulator test`
Expected: PASS (all `@repo/x-emulator` tests).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @repo/x-emulator typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add emulators/x/src/x-plugin.ts emulators/x/src/server.ts emulators/x/src/__tests__/server.test.ts
git commit -m "feat(x-emulator): OAuth 2.0 PKCE auth-only plugin on @repo/emulator-kit"
```

---

## Task 6: Add the process entrypoint + README

**Files:**
- Create: `emulators/x/src/start.ts`
- Create: `emulators/x/README.md`

- [ ] **Step 1: Create `emulators/x/src/start.ts`**

```ts
import { createXEmulatorRuntimeEnv } from "./env";
import { getXEmulatorEnv } from "./fixtures";
import { startXEmulator } from "./server";

const env = createXEmulatorRuntimeEnv();

const sensitiveEnvKeyPattern = /(?:KEY|SECRET|TOKEN|PRIVATE)/i;

function redactEnvValueForLog(key: string, value: string): string {
  if (sensitiveEnvKeyPattern.test(key)) {
    return "<redacted>";
  }

  return value;
}

const emulator = await startXEmulator({
  appOrigin: env.appOrigin,
  host: env.host,
  port: env.port,
  publicOrigin: env.emulatorOrigin,
});

console.log(`[x-emulator] listening on ${emulator.listenUrl}`);
console.log(`[x-emulator] public origin ${emulator.publicOrigin}`);
for (const [key, value] of Object.entries(
  getXEmulatorEnv(env.appOrigin, emulator.publicOrigin)
)) {
  console.log(`${key}=${JSON.stringify(redactEnvValueForLog(key, value))}`);
}

async function close(signal: NodeJS.Signals) {
  console.log(`[x-emulator] received ${signal}, shutting down`);
  await emulator.close();
  process.exit(0);
}

process.on("SIGINT", (signal) => {
  void close(signal);
});

process.on("SIGTERM", (signal) => {
  void close(signal);
});
```

- [ ] **Step 2: Create `emulators/x/README.md`**

```markdown
# X Emulator

Local development harness for the X (Twitter) connector slice. This package is
dev-only; production runtime code must not import it.

Built on `@emulators/core` (vercel-labs/emulate) via the shared
`@repo/emulator-kit`. Scoped to an OAuth 2.0 PKCE auth-only slice.

## Run

From the repository root, `pnpm dev` starts the emulator through Portless
alongside app, www, platform, Inngest, QStash, GitHub, Linear, and the MFE
proxy:

```bash
pnpm dev
```

The emulator is routed at:

```text
https://x.lightfast.localhost
```

The app dev process receives deterministic `X_*` values from `@lightfast/app`'s
`with-related-projects` wrapper. Do not copy worktree-specific emulator URLs
into `.vercel/.env.development.local`.

To run only the emulator:

```bash
pnpm --filter @repo/x-emulator dev
```

## Endpoints

- `GET /oauth2/authorize` (OAuth 2.0 PKCE, `S256`)
- `POST /oauth2/token` (`authorization_code` + `refresh_token` grants)
- `POST /oauth2/revoke`
- `GET /2/users/me`
- `POST /failures`
- `POST /reset`

`POST /failures` accepts JSON booleans for `accessTokenExpired`, `refresh`, and
`usersMe`. `POST /reset` clears all failure switches.

## Configuration

Optional environment variables:

```bash
PORT=4569
HOST=127.0.0.1
LIGHTFAST_APP_ORIGIN=https://lightfast.localhost
X_EMULATOR_ORIGIN=https://x.lightfast.localhost
```

## Test

```bash
pnpm --filter @repo/x-emulator test -- src/__tests__/server.test.ts
pnpm --filter @repo/x-emulator typecheck
```
```

- [ ] **Step 3: Smoke-test the dev entrypoint boots**

Run: `PORT=4569 pnpm --filter @repo/x-emulator dev`
Expected: prints `[x-emulator] listening on http://127.0.0.1:4569` and the `X_*` lines (secrets redacted). In another shell, `curl -s http://127.0.0.1:4569/2/users/me -H "authorization: Bearer x_access_valid"` returns the user JSON. Stop with Ctrl-C.

- [ ] **Step 4: Commit**

```bash
git add emulators/x/src/start.ts emulators/x/README.md
git commit -m "feat(x-emulator): add dev entrypoint and README"
```

---

## Task 7: Wire the X emulator into the dev orchestration

**Files:**
- Modify: `package.json` (root)
- Modify: `turbo.json`
- Modify: `apps/app/package.json`

- [ ] **Step 1: Add the `_x_emulator` root script in `package.json`**

Immediately after the `"_linear_emulator": "...",` line, add:

```json
    "_x_emulator": "portless run --name x.lightfast sh -c 'LIGHTFAST_APP_ORIGIN=\"$(portless get app.lightfast)\" X_EMULATOR_ORIGIN=\"$(portless get x.lightfast)\" pnpm --filter @repo/x-emulator dev'",
```

- [ ] **Step 2: Add `//#_x_emulator` to the root `dev` task in `package.json`**

Change the `dev` script from:

```json
    "dev": "portless proxy start && turbo run dev:next @lightfast/app#mfe:proxy //#_inngest //#_qstash //#_github_emulator //#_linear_emulator --concurrency=15 -F @lightfast/www -F @lightfast/app -F @lightfast/platform --continue",
```

to (insert `//#_x_emulator` after `//#_linear_emulator`):

```json
    "dev": "portless proxy start && turbo run dev:next @lightfast/app#mfe:proxy //#_inngest //#_qstash //#_github_emulator //#_linear_emulator //#_x_emulator --concurrency=15 -F @lightfast/www -F @lightfast/app -F @lightfast/platform --continue",
```

- [ ] **Step 3: Register the `//#_x_emulator` task in `turbo.json`**

Immediately after the `"//#_linear_emulator": { ... },` block, add:

```json
    "//#_x_emulator": {
      "cache": false,
      "persistent": true
    },
```

- [ ] **Step 4: Append the X emulator to `with-related-projects` in `apps/app/package.json`**

Replace the existing `"with-related-projects"` value so the `env -S` argument
concatenates a third emulator env block (a `\n` then the x-emulator `env:sh`
output), inserted after the linear block and before the closing `\"`:

```json
    "with-related-projects": "env -S \"$(pnpm --silent --filter @repo/github-emulator env:sh -- --app-origin \"$(portless get app.lightfast)\" --emulator-origin \"$(portless get github.lightfast)\")\n$(pnpm --silent --filter @repo/linear-emulator env:sh -- --app-origin \"$(portless get app.lightfast)\" --emulator-origin \"$(portless get linear.lightfast)\")\n$(pnpm --silent --filter @repo/x-emulator env:sh -- --app-origin \"$(portless get app.lightfast)\" --emulator-origin \"$(portless get x.lightfast)\")\" INNGEST_SERVE_ORIGIN=$(portless get app.lightfast) NEXT_PUBLIC_APP_URL=$(portless get app.lightfast) NEXT_PUBLIC_WWW_URL=$(portless get www.lightfast) NEXT_PUBLIC_PLATFORM_URL=$(portless get platform.lightfast) INNGEST_DEV=$(portless get inngest.lightfast) QSTASH_URL=$(portless get qstash.lightfast)",
```

- [ ] **Step 5: Verify `env:sh` emits valid `env -S` assignments**

Run: `pnpm --silent --filter @repo/x-emulator env:sh -- --app-origin https://lightfast.localhost --emulator-origin http://127.0.0.1:4569`
Expected output (exact):

```text
X_CLIENT_ID='x_lightfast_local'
X_CLIENT_SECRET='x-local-secret'
X_API_ORIGIN='http://127.0.0.1:4569'
X_OAUTH_ORIGIN='http://127.0.0.1:4569'
```

- [ ] **Step 6: Verify the JSON edits parse**

Run: `node -e "require('./package.json'); require('./turbo.json'); require('./apps/app/package.json'); console.log('json ok')"`
Expected: `json ok` (no SyntaxError from the edited files).

- [ ] **Step 7: Commit**

```bash
git add package.json turbo.json apps/app/package.json
git commit -m "feat(dev): wire @repo/x-emulator into pnpm dev + with-related-projects"
```

---

## Task 8: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the three touched/created packages**

Run: `pnpm --filter @repo/emulator-kit --filter @repo/x-emulator --filter @repo/github-emulator typecheck`
Expected: PASS for all three.

- [ ] **Step 2: Run all three emulator test suites**

Run: `pnpm --filter @repo/emulator-kit --filter @repo/x-emulator --filter @repo/github-emulator test`
Expected: PASS for all three (kit lifecycle, X plugin, GitHub regression).

- [ ] **Step 3: Lint/format check on changed files**

Run: `pnpm check`
Expected: PASS (Biome reports no errors on the new/edited files). If Biome reports formatting fixes, apply them, then re-run and re-stage.

- [ ] **Step 4: Confirm Linear was not touched**

Run: `git status --porcelain emulators/linear`
Expected: empty output (no changes under `emulators/linear`).

- [ ] **Step 5: Boot the full dev stack and confirm the X route resolves (manual)**

Run: `pnpm dev` (in a scratch terminal), then once Portless is up:
`curl -s https://x.lightfast.localhost/2/users/me -H "authorization: Bearer x_access_valid"`
Expected: returns `{"data":{"id":"x_user_lightfast_local","name":"Lightfast Local","username":"lightfast_dev"}}`. Stop the dev stack afterward (`pkill -f "next dev"` / Ctrl-C).

> Note: nothing in the app consumes `X_*` yet (no X connector exists). This step proves the emulator boots and routes under Portless — the deliverable is connector-ready infrastructure, matching how the Linear slice is scoped.

- [ ] **Step 6: Final commit (only if `pnpm check` applied formatting)**

```bash
git add emulators/kit emulators/x
git commit -m "style(emulators): apply biome formatting"
```

---

## Self-Review

**Spec coverage:**
- Layer A substrate (`@emulators/core` + `ServicePlugin`) → Tasks 2, 5 (kit wraps `createServer`; X is a `ServicePlugin`). ✓
- Layer B kit at `emulators/kit` → Tasks 1–2. ✓
- X auth-only slice (PKCE authorize/token/revoke, `/2/users/me`, failures, reset) → Task 5 routes + tests. ✓
- Three failure switches `accessTokenExpired`/`refresh`/`usersMe` → Task 5 (`x-plugin.ts` + tests). ✓
- Real S256 PKCE validation → Task 5 (`pkceChallengeFromVerifier`, invalid-verifier test). ✓
- Self-contained fixtures, no `@repo/x-app-*` dep → Task 4 (`fixtures.ts`; package.json has no such dep). ✓
- GitHub light refactor onto kit primitives → Task 3. ✓
- Linear untouched → Task 8 Step 4 guard. ✓
- Dev wiring (port 4569, `x.lightfast`, root `dev` task, turbo task, `with-related-projects`) → Task 7. ✓
- Testing (X suite, kit lifecycle, github regression) → Tasks 2, 5, 8. ✓
- "X env injected but unconsumed" honesty → Task 8 Step 5 note. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full file or exact edit; every command has expected output. ✓

**Type consistency:** `StartedEmulator` (kit) is reused as `StartedXEmulator` (server.ts) and imported in the X test. `startEmulator(plugin, options)` signature matches its call in `server.ts`. `FailureSwitches` keys (`accessTokenExpired`/`refresh`/`usersMe`) are identical across `x-plugin.ts` and `server.test.ts`. `X_EMULATOR_FIXTURES` field names (`oauthClientId`, `accessToken`, `refreshToken`, `userId`, `userName`, `username`) match between `fixtures.ts`, `x-plugin.ts`, and `server.test.ts`. `getXEmulatorEnv` keys match the Task 7 Step 5 expected output. ✓
