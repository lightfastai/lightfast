# Emulator Architecture Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the triplicated env/CLI/process plumbing into `@repo/emulator-kit` and split each emulator into concern modules (oauth / viewer / mcp / users / auth / failures), without changing any HTTP behavior.

**Architecture:** Two tiers. The kit owns a manifest contract + env schema + env:sh CLI + start harness + shell-format + the existing listen lifecycle. Each emulator declares an `EmulatorManifest` (name/port/originEnvVar/env-projection/start) and composes its `ServicePlugin` from register-fragments. github keeps its bespoke composition (vendor plugin + 953-line compatible-routes + webhook), only relocated.

**Tech Stack:** TypeScript (ESM, TS source consumed directly across `@repo/*`), `@emulators/core` (bundled Hono + Store + auth toolkit), `@t3-oss/env-core` + `zod`, `tsx` (dev/start), `vitest`, biome/ultracite (`pnpm check`).

**Design spec:** `docs/superpowers/specs/2026-06-01-emulator-architecture-redesign-design.md`

**Guardrails:** the existing `server.test.ts` suites (x 9, linear 10, github server 30 + oauth 5) are behavioral regression guards — they must pass after every emulator task. Commit with explicit pathspecs (a concurrent agent may pre-stage files); do not push.

---

## Task 1: Kit — manifest, format, env, cli + lifecycle split

**Files:**
- Create: `emulators/kit/src/manifest.ts`
- Create: `emulators/kit/src/format.ts`
- Create: `emulators/kit/src/env.ts`
- Create: `emulators/kit/src/cli.ts`
- Create: `emulators/kit/src/lifecycle.ts` (move current `index.ts` body here)
- Modify: `emulators/kit/src/index.ts` (becomes re-exports)
- Modify: `emulators/kit/package.json` (add `@t3-oss/env-core`, `zod`)

- [ ] **Step 1: Add kit deps**

In `emulators/kit/package.json`, add to `dependencies` (alphabetical, before `@emulators/core` stays first):

```json
  "dependencies": {
    "@emulators/core": "catalog:",
    "@t3-oss/env-core": "catalog:",
    "zod": "catalog:"
  },
```

Run: `pnpm install`

- [ ] **Step 2: Move the current lifecycle into `lifecycle.ts`**

`git mv emulators/kit/src/index.ts emulators/kit/src/lifecycle.ts`

(Content is unchanged — it still exports `startEmulator`, `formatListenUrl`, `waitForListening`, `closeServer`, and the `StartedEmulator`/`StartEmulatorOptions`/`StartEmulatorContext`/`EmulatorServer` types.)

- [ ] **Step 3: Create `manifest.ts`**

```ts
export interface EmulatorStartInput {
  appOrigin?: string;
  host?: string;
  port?: number;
  publicOrigin?: string;
}

export interface RunnableEmulator {
  close(): Promise<void>;
  listenUrl: string;
  publicOrigin: string;
}

export interface EmulatorManifest {
  env(appOrigin: string, emulatorOrigin: string): Record<string, string>;
  name: string;
  originEnvVar: string;
  port: number;
  start(input: EmulatorStartInput): Promise<RunnableEmulator>;
}
```

- [ ] **Step 4: Create `format.ts`** (the block that was copy-pasted into all three `fixtures.ts`)

```ts
const ENV_ASSIGNMENT_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function formatEnvString(env: Record<string, string>): string {
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

- [ ] **Step 5: Create `env.ts`** (the single copy of `create*EmulatorRuntimeEnv`, computed origin key)

```ts
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import type { EmulatorManifest } from "./manifest";

export interface ResolvedEmulatorEnv {
  appOrigin: string;
  emulatorOrigin?: string;
  host: string;
  port: number;
}

export function createEmulatorEnv(
  manifest: EmulatorManifest,
  runtimeEnv: NodeJS.ProcessEnv = process.env
): ResolvedEmulatorEnv {
  const env = createEnv({
    emptyStringAsUndefined: true,
    runtimeEnv: {
      HOST: runtimeEnv.HOST,
      LIGHTFAST_APP_ORIGIN: runtimeEnv.LIGHTFAST_APP_ORIGIN,
      PORT: runtimeEnv.PORT,
      PORTLESS_URL: runtimeEnv.PORTLESS_URL,
      [manifest.originEnvVar]: runtimeEnv[manifest.originEnvVar],
    },
    server: {
      HOST: z.string().min(1).default("127.0.0.1"),
      LIGHTFAST_APP_ORIGIN: z
        .string()
        .url()
        .default("https://lightfast.localhost"),
      PORT: z.coerce.number().int().min(1).max(65_535).default(manifest.port),
      PORTLESS_URL: z.string().url().optional(),
      [manifest.originEnvVar]: z.string().url().optional(),
    },
    skipValidation:
      !!runtimeEnv.SKIP_ENV_VALIDATION ||
      runtimeEnv.npm_lifecycle_event === "lint",
  });

  const originValue = (env as Record<string, string | undefined>)[
    manifest.originEnvVar
  ];

  return {
    appOrigin: env.LIGHTFAST_APP_ORIGIN,
    emulatorOrigin: originValue ?? env.PORTLESS_URL,
    host: env.HOST,
    port: env.PORT,
  };
}
```

- [ ] **Step 6: Create `cli.ts`** (single copy of `env-sh` arg parsing + `start` process harness)

```ts
import { createEmulatorEnv } from "./env";
import { formatEnvString } from "./format";
import type { EmulatorManifest } from "./manifest";

const SENSITIVE_ENV_KEY_PATTERN = /(?:KEY|SECRET|TOKEN|PRIVATE)/i;

function readOption(name: string): string | undefined {
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

function redactEnvValueForLog(key: string, value: string): string {
  return SENSITIVE_ENV_KEY_PATTERN.test(key) ? "<redacted>" : value;
}

export function runEnvSh(manifest: EmulatorManifest): void {
  const appOrigin = readOption("--app-origin");
  const emulatorOrigin = readOption("--emulator-origin");

  const env = createEmulatorEnv(manifest, {
    ...process.env,
    ...(appOrigin ? { LIGHTFAST_APP_ORIGIN: appOrigin } : {}),
    ...(emulatorOrigin ? { [manifest.originEnvVar]: emulatorOrigin } : {}),
  });

  const origin = env.emulatorOrigin ?? `http://127.0.0.1:${env.port}`;
  console.log(formatEnvString(manifest.env(env.appOrigin, origin)));
}

export async function runStart(manifest: EmulatorManifest): Promise<void> {
  const env = createEmulatorEnv(manifest);
  const emulator = await manifest.start({
    appOrigin: env.appOrigin,
    host: env.host,
    port: env.port,
    publicOrigin: env.emulatorOrigin,
  });

  const label = `[${manifest.name}-emulator]`;
  console.log(`${label} listening on ${emulator.listenUrl}`);
  console.log(`${label} public origin ${emulator.publicOrigin}`);
  for (const [key, value] of Object.entries(
    manifest.env(env.appOrigin, emulator.publicOrigin)
  )) {
    console.log(`${key}=${JSON.stringify(redactEnvValueForLog(key, value))}`);
  }

  const close = async (signal: NodeJS.Signals) => {
    console.log(`${label} received ${signal}, shutting down`);
    await emulator.close();
    process.exit(0);
  };

  process.on("SIGINT", (signal) => {
    void close(signal);
  });
  process.on("SIGTERM", (signal) => {
    void close(signal);
  });
}
```

> Behavior note: `runEnvSh`'s `?? \`http://127.0.0.1:${env.port}\`` reproduces the old per-fixture default origin (github 4567 / linear 4568 / x 4569), since `formatListenUrl("127.0.0.1", port)` equals that string.

- [ ] **Step 7: Rewrite `index.ts` as re-exports**

```ts
export * from "./cli";
export * from "./env";
export * from "./format";
export * from "./lifecycle";
export * from "./manifest";
```

- [ ] **Step 8: Typecheck the kit**

Run: `pnpm --filter @repo/emulator-kit typecheck`
Expected: PASS. (If `createEnv`'s computed-key inference complains, the `as Record<string, string | undefined>` cast in `env.ts` resolves it.)

- [ ] **Step 9: Run existing kit tests**

Run: `pnpm --filter @repo/emulator-kit test`
Expected: existing `start-emulator.test.ts` (3 tests) PASS — `startEmulator` re-exported via `lifecycle.ts`.

- [ ] **Step 10: Commit**

```bash
git add emulators/kit/src/manifest.ts emulators/kit/src/format.ts emulators/kit/src/env.ts emulators/kit/src/cli.ts emulators/kit/src/lifecycle.ts emulators/kit/src/index.ts emulators/kit/package.json pnpm-lock.yaml
git commit -m "feat(emulator-kit): own env/cli/format + manifest contract; split lifecycle"
```

---

## Task 2: Kit tests — env + cli (absorb deleted per-emulator coverage)

**Files:**
- Create: `emulators/kit/src/__tests__/env.test.ts`
- Create: `emulators/kit/src/__tests__/cli.test.ts`

- [ ] **Step 1: Write `env.test.ts`**

```ts
import { describe, expect, it } from "vitest";

import { createEmulatorEnv } from "../env";
import type { EmulatorManifest } from "../manifest";

const manifest: EmulatorManifest = {
  name: "test",
  port: 4599,
  originEnvVar: "TEST_EMULATOR_ORIGIN",
  env: () => ({}),
  start: () =>
    Promise.resolve({
      close: () => Promise.resolve(),
      listenUrl: "http://127.0.0.1:4599",
      publicOrigin: "http://127.0.0.1:4599",
    }),
};

describe("createEmulatorEnv", () => {
  it("defaults port to the manifest port and host to loopback", () => {
    const env = createEmulatorEnv(manifest, { SKIP_ENV_VALIDATION: "1" });
    expect(env.port).toBe(4599);
    expect(env.host).toBe("127.0.0.1");
    expect(env.appOrigin).toBe("https://lightfast.localhost");
    expect(env.emulatorOrigin).toBeUndefined();
  });

  it("reads the manifest origin var and prefers it over PORTLESS_URL", () => {
    const env = createEmulatorEnv(manifest, {
      SKIP_ENV_VALIDATION: "1",
      TEST_EMULATOR_ORIGIN: "https://test.lightfast.localhost",
      PORTLESS_URL: "https://fallback.lightfast.localhost",
    });
    expect(env.emulatorOrigin).toBe("https://test.lightfast.localhost");
  });

  it("falls back to PORTLESS_URL when the origin var is absent", () => {
    const env = createEmulatorEnv(manifest, {
      SKIP_ENV_VALIDATION: "1",
      PORTLESS_URL: "https://fallback.lightfast.localhost",
    });
    expect(env.emulatorOrigin).toBe("https://fallback.lightfast.localhost");
  });

  it("coerces PORT and respects an explicit override", () => {
    const env = createEmulatorEnv(manifest, {
      SKIP_ENV_VALIDATION: "1",
      PORT: "5005",
    });
    expect(env.port).toBe(5005);
  });
});
```

- [ ] **Step 2: Write `cli.test.ts`** (arg parsing + emitted env string via a real manifest)

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { runEnvSh } from "../cli";
import type { EmulatorManifest } from "../manifest";

const manifest: EmulatorManifest = {
  name: "test",
  port: 4599,
  originEnvVar: "TEST_EMULATOR_ORIGIN",
  env: (_appOrigin, emulatorOrigin) => ({
    TEST_API_ORIGIN: emulatorOrigin,
    TEST_CLIENT_ID: "test_client",
  }),
  start: () =>
    Promise.resolve({
      close: () => Promise.resolve(),
      listenUrl: "http://127.0.0.1:4599",
      publicOrigin: "http://127.0.0.1:4599",
    }),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runEnvSh", () => {
  it("emits shell assignments using --emulator-origin", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const argv = [
      ...process.argv.slice(0, 2),
      "--app-origin",
      "https://app.lightfast.localhost",
      "--emulator-origin",
      "https://test.lightfast.localhost",
    ];
    vi.spyOn(process, "argv", "get").mockReturnValue(argv);

    runEnvSh(manifest);

    expect(log).toHaveBeenCalledWith(
      "TEST_API_ORIGIN='https://test.lightfast.localhost'\nTEST_CLIENT_ID='test_client'"
    );
  });

  it("falls back to the manifest port origin when no flags are passed", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "argv", "get").mockReturnValue(process.argv.slice(0, 2));

    runEnvSh(manifest);

    expect(log).toHaveBeenCalledWith(
      "TEST_API_ORIGIN='http://127.0.0.1:4599'\nTEST_CLIENT_ID='test_client'"
    );
  });
});
```

- [ ] **Step 3: Run kit tests**

Run: `pnpm --filter @repo/emulator-kit test`
Expected: PASS (start-emulator 3 + env 4 + cli 2 = 9).

- [ ] **Step 4: Commit**

```bash
git add emulators/kit/src/__tests__/env.test.ts emulators/kit/src/__tests__/cli.test.ts
git commit -m "test(emulator-kit): cover createEmulatorEnv + runEnvSh"
```

---

## Task 3: x — concern-split + manifest + thin bootstraps

**Files:**
- Create: `emulators/x/src/plugin/failures.ts`
- Create: `emulators/x/src/plugin/auth.ts`
- Create: `emulators/x/src/plugin/oauth.ts`
- Create: `emulators/x/src/plugin/users.ts`
- Create: `emulators/x/src/plugin/index.ts`
- Create: `emulators/x/src/manifest.ts`
- Modify: `emulators/x/src/server.ts` (one import line)
- Rewrite: `emulators/x/src/start.ts`, `emulators/x/src/env-sh.ts`
- Modify: `emulators/x/src/fixtures.ts` (drop format helpers + env projection)
- Delete: `emulators/x/src/env.ts`, `emulators/x/src/x-plugin.ts`
- Modify: `emulators/x/package.json` (drop now-unused deps)

- [ ] **Step 1: Create `plugin/failures.ts`** (route bodies verbatim from `x-plugin.ts:173-200`)

```ts
import type { AppEnv, Hono, Store } from "@emulators/core";

export interface FailureSwitches {
  accessTokenExpired: boolean;
  refresh: boolean;
  usersMe: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "refresh",
  "usersMe",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

export function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, refresh: false, usersMe: false };
}

export function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

export function seedFailures(store: Store): void {
  store.setData("failures", defaultFailures());
}

export function registerFailures(app: Hono<AppEnv>, store: Store): void {
  app.post("/failures", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<
      Record<keyof FailureSwitches, unknown>
    > | null;
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
}
```

- [ ] **Step 2: Create `plugin/auth.ts`** (verbatim from `x-plugin.ts:64-78`)

```ts
import type { Context, Store } from "@emulators/core";

import { X_EMULATOR_FIXTURES } from "../fixtures";
import { getFailures } from "./failures";

export function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}

export function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === X_EMULATOR_FIXTURES.accessToken
  );
}
```

- [ ] **Step 3: Create `plugin/oauth.ts`** (route bodies verbatim from `x-plugin.ts:83-161`)

```ts
import { createHash } from "node:crypto";

import type { AppEnv, Hono, Store } from "@emulators/core";

import {
  X_EMULATOR_FIXTURES,
  X_EMULATOR_OAUTH_CODE,
  X_EMULATOR_SCOPE,
} from "../fixtures";
import { getFailures } from "./failures";

const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 7200;

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

export function registerOAuth(app: Hono<AppEnv>, store: Store): void {
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
}
```

- [ ] **Step 4: Create `plugin/users.ts`** (route body verbatim from `x-plugin.ts:163-171`; `XUserRow`/`userResponse` from `25-29`/`53-62`)

```ts
import type { AppEnv, Entity, Hono, Store } from "@emulators/core";

import { X_EMULATOR_FIXTURES } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";

export interface XUserRow extends Entity {
  name: string;
  username: string;
  x_id: string;
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

export function registerUsers(app: Hono<AppEnv>, store: Store): void {
  app.get("/2/users/me", (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ title: "Unauthorized", status: 401 }, 401);
    }
    if (getFailures(store).usersMe) {
      return c.json({ title: "Internal Error", status: 500 }, 500);
    }
    return c.json(userResponse(store), 200);
  });
}
```

- [ ] **Step 5: Create `plugin/index.ts`** (composition; seed preserves `x-plugin.ts:202-209` exactly)

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
      name: X_EMULATOR_FIXTURES.userName,
      username: X_EMULATOR_FIXTURES.username,
      x_id: X_EMULATOR_FIXTURES.userId,
    });
  },
};
```

- [ ] **Step 6: Point `server.ts` at the new plugin** (one line)

In `emulators/x/src/server.ts`, change:
```ts
import { xPlugin } from "./x-plugin";
```
to:
```ts
import { xPlugin } from "./plugin";
```

- [ ] **Step 7: Create `manifest.ts`**

```ts
import type { EmulatorManifest } from "@repo/emulator-kit";

import { X_EMULATOR_FIXTURES } from "./fixtures";
import { startXEmulator } from "./server";

export const xManifest: EmulatorManifest = {
  name: "x",
  port: 4569,
  originEnvVar: "X_EMULATOR_ORIGIN",
  env: (_appOrigin, emulatorOrigin) => ({
    X_API_ORIGIN: emulatorOrigin,
    X_CLIENT_ID: X_EMULATOR_FIXTURES.oauthClientId,
    X_CLIENT_SECRET: X_EMULATOR_FIXTURES.oauthClientSecret,
    X_OAUTH_ORIGIN: emulatorOrigin,
  }),
  start: startXEmulator,
};
```

- [ ] **Step 8: Rewrite `start.ts` and `env-sh.ts` as bootstraps**

`emulators/x/src/start.ts`:
```ts
import { runStart } from "@repo/emulator-kit";

import { xManifest } from "./manifest";

await runStart(xManifest);
```

`emulators/x/src/env-sh.ts`:
```ts
import { runEnvSh } from "@repo/emulator-kit";

import { xManifest } from "./manifest";

runEnvSh(xManifest);
```

- [ ] **Step 9: Trim `fixtures.ts`** — delete `getXEmulatorEnv`, `formatXEmulatorEnvString`, `shellQuote`, `ENV_ASSIGNMENT_NAME_RE` (env projection now lives in `manifest.ts`, formatting in the kit). Keep `X_EMULATOR_FIXTURES`, `X_EMULATOR_OAUTH_CODE`, `X_EMULATOR_SCOPE`.

- [ ] **Step 10: Delete the obsolete files**

```bash
git rm emulators/x/src/env.ts emulators/x/src/x-plugin.ts
```

- [ ] **Step 11: Drop now-unused deps from `emulators/x/package.json`**

Confirm nothing else imports them:
Run: `grep -rn "@t3-oss/env-core\|from \"zod\"\|from 'zod'" emulators/x/src` → expect no matches.
Then remove `"@t3-oss/env-core": "catalog:"` and `"zod": "catalog:"` from `dependencies`. Run `pnpm install`.

- [ ] **Step 12: Typecheck + tests (the regression guard)**

Run: `pnpm --filter @repo/x-emulator typecheck`
Run: `pnpm --filter @repo/x-emulator test`
Expected: PASS (9 tests, unchanged — they import `startXEmulator` from `../server`).

- [ ] **Step 13: Verify env:sh output is byte-identical to before**

Run: `pnpm --filter @repo/x-emulator env:sh -- --app-origin https://app.lightfast.localhost --emulator-origin https://x.lightfast.localhost`
Expected: `X_API_ORIGIN='https://x.lightfast.localhost'` … same keys/values as the pre-migration output.

- [ ] **Step 14: Commit**

```bash
git add emulators/x pnpm-lock.yaml
git commit -m "refactor(x-emulator): concern-split plugin + manifest on emulator-kit"
```

---

## Task 4: linear — concern-split + manifest + thin bootstraps

**Files:**
- Create: `emulators/linear/src/plugin/{failures,auth,oauth,viewer,mcp,index}.ts`
- Create: `emulators/linear/src/manifest.ts`
- Modify: `emulators/linear/src/server.ts` (one import line)
- Rewrite: `emulators/linear/src/start.ts`, `emulators/linear/src/env-sh.ts`
- Modify: `emulators/linear/src/fixtures.ts` (drop format helpers + env projection)
- Delete: `emulators/linear/src/env.ts`, `emulators/linear/src/linear-plugin.ts`
- Modify: `emulators/linear/package.json` (drop now-unused deps)

- [ ] **Step 1: Create `plugin/failures.ts`** (verbatim from `linear-plugin.ts:12-30,273-304`)

```ts
import type { AppEnv, Hono, Store } from "@emulators/core";

export interface FailureSwitches {
  accessTokenExpired: boolean;
  mcpListTools: boolean;
  refresh: boolean;
}

const failureSwitchNames = [
  "accessTokenExpired",
  "mcpListTools",
  "refresh",
] as const satisfies ReadonlyArray<keyof FailureSwitches>;

export function defaultFailures(): FailureSwitches {
  return { accessTokenExpired: false, mcpListTools: false, refresh: false };
}

export function getFailures(store: Store): FailureSwitches {
  return store.getData<FailureSwitches>("failures") ?? defaultFailures();
}

export function seedFailures(store: Store): void {
  store.setData("failures", defaultFailures());
}

export function registerFailures(app: Hono<AppEnv>, store: Store): void {
  app.post("/failures", async (c) => {
    const body = (await c.req.json().catch(() => null)) as Partial<
      Record<keyof FailureSwitches, unknown>
    > | null;
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
}
```

- [ ] **Step 2: Create `plugin/auth.ts`** (verbatim from `linear-plugin.ts:68-82`)

```ts
import type { Context, Store } from "@emulators/core";

import { LINEAR_EMULATOR_FIXTURES } from "../fixtures";
import { getFailures } from "./failures";

export function bearerToken(c: Context): string | undefined {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return;
  }
  return authorization.slice("Bearer ".length);
}

export function isValidBearer(c: Context, store: Store): boolean {
  const failures = getFailures(store);
  return (
    !failures.accessTokenExpired &&
    bearerToken(c) === LINEAR_EMULATOR_FIXTURES.accessToken
  );
}
```

- [ ] **Step 3: Create `plugin/oauth.ts`** (route bodies verbatim from `linear-plugin.ts:93-152`; helpers `32-41,58-66`)

```ts
import type { AppEnv, Hono, Store } from "@emulators/core";

import { LINEAR_EMULATOR_FIXTURES, LINEAR_EMULATOR_OAUTH_CODE } from "../fixtures";
import { getFailures } from "./failures";

const TOKEN_EXPIRES_IN_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRES_IN_SECONDS = 2_592_000;

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

function clientCredentialsValid(
  clientId: unknown,
  clientSecret: unknown
): boolean {
  return (
    String(clientId ?? "") === LINEAR_EMULATOR_FIXTURES.oauthClientId &&
    String(clientSecret ?? "") === LINEAR_EMULATOR_FIXTURES.oauthClientSecret
  );
}

export function registerOAuth(app: Hono<AppEnv>, store: Store): void {
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
        String(form.refresh_token ?? "") !==
          LINEAR_EMULATOR_FIXTURES.refreshToken
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
}
```

- [ ] **Step 4: Create `plugin/viewer.ts`** (route bodies verbatim from `linear-plugin.ts:154-166`; `viewerResponse` `43-56`)

```ts
import type { AppEnv, Hono, Store } from "@emulators/core";

import { LINEAR_EMULATOR_FIXTURES } from "../fixtures";
import { isValidBearer } from "./auth";

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

export function registerViewer(app: Hono<AppEnv>, store: Store): void {
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
}
```

- [ ] **Step 5: Create `plugin/mcp.ts`** (route body verbatim from `linear-plugin.ts:168-271`; `McpRequestBody` `84-88`)

```ts
import type { AppEnv, Hono, Store } from "@emulators/core";

import { LINEAR_EMULATOR_TOOLS } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";

interface McpRequestBody {
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: unknown };
}

export function registerMcp(app: Hono<AppEnv>, store: Store): void {
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
}
```

- [ ] **Step 6: Create `plugin/index.ts`** (composition; seed = `seedFailures`, matching `linear-plugin.ts:302-304`)

```ts
import type { ServicePlugin } from "@emulators/core";

import { registerFailures, seedFailures } from "./failures";
import { registerMcp } from "./mcp";
import { registerOAuth } from "./oauth";
import { registerViewer } from "./viewer";

export const linearPlugin: ServicePlugin = {
  name: "linear",
  register(app, store) {
    registerOAuth(app, store);
    registerViewer(app, store);
    registerMcp(app, store);
    registerFailures(app, store);
  },
  seed(store) {
    seedFailures(store);
  },
};
```

- [ ] **Step 7: Point `server.ts` at the new plugin** (one line)

In `emulators/linear/src/server.ts`, change `import { linearPlugin } from "./linear-plugin";` → `import { linearPlugin } from "./plugin";`.

- [ ] **Step 8: Create `manifest.ts`**

```ts
import type { EmulatorManifest } from "@repo/emulator-kit";

import { LINEAR_EMULATOR_FIXTURES } from "./fixtures";
import { startLinearEmulator } from "./server";

export const linearManifest: EmulatorManifest = {
  name: "linear",
  port: 4568,
  originEnvVar: "LINEAR_EMULATOR_ORIGIN",
  env: (_appOrigin, emulatorOrigin) => ({
    LINEAR_API_ORIGIN: emulatorOrigin,
    LINEAR_CLIENT_ID: LINEAR_EMULATOR_FIXTURES.oauthClientId,
    LINEAR_CLIENT_SECRET: LINEAR_EMULATOR_FIXTURES.oauthClientSecret,
    LINEAR_MCP_ENDPOINT: `${emulatorOrigin}/mcp`,
  }),
  start: startLinearEmulator,
};
```

- [ ] **Step 9: Rewrite `start.ts` and `env-sh.ts` as bootstraps**

`emulators/linear/src/start.ts`:
```ts
import { runStart } from "@repo/emulator-kit";

import { linearManifest } from "./manifest";

await runStart(linearManifest);
```

`emulators/linear/src/env-sh.ts`:
```ts
import { runEnvSh } from "@repo/emulator-kit";

import { linearManifest } from "./manifest";

runEnvSh(linearManifest);
```

- [ ] **Step 10: Trim `fixtures.ts`** — delete `getLinearEmulatorEnv`, `formatLinearEmulatorEnvString`, `shellQuote`, `ENV_ASSIGNMENT_NAME_RE`. Keep `LINEAR_EMULATOR_FIXTURES`, `LINEAR_EMULATOR_OAUTH_CODE`, `LINEAR_EMULATOR_TOOLS`.

- [ ] **Step 11: Delete obsolete files + drop unused deps**

```bash
git rm emulators/linear/src/env.ts emulators/linear/src/linear-plugin.ts
```
Run: `grep -rn "@t3-oss/env-core\|from \"zod\"" emulators/linear/src` → expect no matches; then remove `@t3-oss/env-core` and `zod` from `emulators/linear/package.json` `dependencies`. `pnpm install`.

- [ ] **Step 12: Typecheck + tests**

Run: `pnpm --filter @repo/linear-emulator typecheck`
Run: `pnpm --filter @repo/linear-emulator test`
Expected: PASS (10 tests, unchanged — incl. the real `listLinearMcpTools` assertion).

- [ ] **Step 13: Verify env:sh output byte-identical (incl. `LINEAR_MCP_ENDPOINT`)**

Run: `pnpm --filter @repo/linear-emulator env:sh -- --app-origin https://app.lightfast.localhost --emulator-origin https://linear.lightfast.localhost`
Expected: includes `LINEAR_MCP_ENDPOINT='https://linear.lightfast.localhost/mcp'`.

- [ ] **Step 14: Commit**

```bash
git add emulators/linear pnpm-lock.yaml
git commit -m "refactor(linear-emulator): concern-split plugin + manifest on emulator-kit"
```

---

## Task 5: github — boot layer + light relocate

**Files:**
- Create: `emulators/github/src/manifest.ts`
- Move: `server.ts` → `plugin/index.ts`; `github-compatible-routes.ts` → `plugin/compatible-routes.ts`; `push.ts` → `plugin/webhook/push.ts`; `push-webhook-payload.ts` → `plugin/webhook/push-payload.ts`
- Rewrite: `emulators/github/src/start.ts`, `emulators/github/src/env-sh.ts`
- Modify: `emulators/github/src/fixtures.ts` (drop format helpers)
- Delete: `emulators/github/src/env.ts`
- Move/replace: `__tests__/env.test.ts` coverage → kit; add `__tests__/manifest.test.ts`
- Modify test import specifiers in `server.test.ts`, `oauth-user-account.test.ts`, `test-helpers.ts`
- Modify: `emulators/github/package.json` (drop now-unused deps if any)

- [ ] **Step 1: Relocate the composition files (logic byte-identical)**

```bash
mkdir -p emulators/github/src/plugin/webhook
git mv emulators/github/src/server.ts emulators/github/src/plugin/index.ts
git mv emulators/github/src/github-compatible-routes.ts emulators/github/src/plugin/compatible-routes.ts
git mv emulators/github/src/push.ts emulators/github/src/plugin/webhook/push.ts
git mv emulators/github/src/push-webhook-payload.ts emulators/github/src/plugin/webhook/push-payload.ts
```

- [ ] **Step 2: Fix relative imports inside the moved files** (mechanical, per the spec table)

- `plugin/index.ts`: `./fixtures` → `../fixtures`; `./github-compatible-routes` → `./compatible-routes`; `./push-webhook-payload` → `./webhook/push-payload`.
- `plugin/compatible-routes.ts`: `./fixtures` → `../fixtures`.
- `plugin/webhook/push.ts`: `./fixtures` → `../../fixtures` (if present); `./push-webhook-payload` → `./push-payload` (if present).
- `plugin/webhook/push-payload.ts`: `./fixtures` → `../../fixtures` (if present).

Run (to find every spec to fix): `grep -rn "from \"\\.\\./\\|from \"\\./" emulators/github/src/plugin`

- [ ] **Step 3: Create `manifest.ts`**

```ts
import type { EmulatorManifest } from "@repo/emulator-kit";

import { getGitHubEmulatorEnv } from "./fixtures";
import { startGitHubEmulator } from "./plugin";

export const githubManifest: EmulatorManifest = {
  name: "github",
  port: 4567,
  originEnvVar: "GITHUB_EMULATOR_ORIGIN",
  env: getGitHubEmulatorEnv,
  start: startGitHubEmulator,
};
```

> `getGitHubEmulatorEnv(_appOrigin, emulatorOrigin)` already matches the `env(appOrigin, emulatorOrigin)` shape. `startGitHubEmulator` returns a structural superset of `RunnableEmulator`, so it satisfies `manifest.start` with no signature change.

- [ ] **Step 4: Rewrite `start.ts` and `env-sh.ts` as bootstraps**

`emulators/github/src/start.ts`:
```ts
import { runStart } from "@repo/emulator-kit";

import { githubManifest } from "./manifest";

await runStart(githubManifest);
```

`emulators/github/src/env-sh.ts`:
```ts
import { runEnvSh } from "@repo/emulator-kit";

import { githubManifest } from "./manifest";

runEnvSh(githubManifest);
```

- [ ] **Step 5: Trim `fixtures.ts`** — delete `formatGitHubEmulatorEnvString`, `shellQuote`, `ENV_ASSIGNMENT_NAME_RE`. Keep `GITHUB_EMULATOR_FIXTURES`, `createGitHubEmulatorSeed`, `getGitHubEmulatorEnv`, the RSA key.

- [ ] **Step 6: Delete `env.ts`**

```bash
git rm emulators/github/src/env.ts
```

- [ ] **Step 7: Update test import specifiers** (assertions unchanged)

- `__tests__/server.test.ts`: `../server` → `../plugin`; `../github-compatible-routes` → `../plugin/compatible-routes`.
- `__tests__/oauth-user-account.test.ts`: `../server` → `../plugin`; `../github-compatible-routes` → `../plugin/compatible-routes`.
- `__tests__/test-helpers.ts`: `../server` → `../plugin`.

- [ ] **Step 8: Migrate `env.test.ts`**

The kit's `env.test.ts` (Task 2) already covers `createEmulatorEnv` generically. Replace github's env-schema test with a manifest projection test:

```bash
git rm emulators/github/src/__tests__/env.test.ts
```

Create `emulators/github/src/__tests__/manifest.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { GITHUB_EMULATOR_FIXTURES } from "../fixtures";
import { githubManifest } from "../manifest";

describe("githubManifest.env", () => {
  it("projects the GitHub App env from the emulator origin", () => {
    const env = githubManifest.env(
      "https://app.lightfast.localhost",
      "https://github.lightfast.localhost"
    );
    expect(env.GITHUB_APP_ENDPOINT_ORIGIN).toBe(
      "https://github.lightfast.localhost"
    );
    expect(env.GITHUB_APP_CLIENT_ID).toBe(
      GITHUB_EMULATOR_FIXTURES.oauthClientId
    );
    expect(env.GITHUB_APP_ID).toBe(String(GITHUB_EMULATOR_FIXTURES.githubAppId));
    expect(env.GITHUB_APP_PRIVATE_KEY).toContain("\\n");
  });
});
```

- [ ] **Step 9: Drop now-unused deps if any**

Run: `grep -rn "@t3-oss/env-core\|from \"zod\"" emulators/github/src` → if no matches, remove `@t3-oss/env-core` and `zod` from `emulators/github/package.json` `dependencies`. `pnpm install`. (If github still imports zod somewhere — e.g. a route schema — leave them.)

- [ ] **Step 10: Typecheck + full github tests**

Run: `pnpm --filter @repo/github-emulator typecheck`
Run: `pnpm --filter @repo/github-emulator test`
Expected: PASS — 35 composition tests (oauth-user-account 5 + server 30) + manifest 1.

- [ ] **Step 11: Verify env:sh output byte-identical**

Run: `pnpm --filter @repo/github-emulator env:sh -- --app-origin https://app.lightfast.localhost --emulator-origin https://github.lightfast.localhost`
Expected: same `GITHUB_APP_*` keys/values as before (incl. `GITHUB_APP_PRIVATE_KEY` with escaped `\n`).

- [ ] **Step 12: Commit**

```bash
git add emulators/github pnpm-lock.yaml
git commit -m "refactor(github-emulator): adopt emulator-kit boot layer; relocate composition into plugin/"
```

---

## Task 6: Full verification sweep

- [ ] **Step 1: Biome/ultracite**

Run: `npx ultracite@latest check emulators` — fix any sorting/formatting via `npx ultracite@latest fix emulators`, then re-check clean.

- [ ] **Step 2: All emulator typechecks + tests**

```bash
pnpm --filter @repo/emulator-kit --filter @repo/x-emulator --filter @repo/linear-emulator --filter @repo/github-emulator typecheck
pnpm --filter @repo/emulator-kit --filter @repo/x-emulator --filter @repo/linear-emulator --filter @repo/github-emulator test
```
Expected: kit 9 + x 9 + linear 10 + github 36 = 64 tests green.

- [ ] **Step 3: Confirm `apps/app` wiring still resolves**

The root `apps/app/package.json` `with-related-projects` calls each emulator's `env:sh` — unchanged. Sanity check it still parses:
Run: `node -e "JSON.parse(require('fs').readFileSync('apps/app/package.json','utf8'))"`

- [ ] **Step 4: Live smoke per service** (manual — requires `pnpm dev`)

Boot `pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color`; confirm Portless serves each emulator and:
- x: `GET https://x.lightfast.localhost/2/users/me` with the seeded bearer → user payload.
- linear: `GET /viewer` → viewer; `POST /mcp` `tools/list` → 10 tools.
- github: OAuth app-token + a push webhook dispatch still fire (covered by tests; spot-check via the app's connector flow if convenient).

- [ ] **Step 5: Final commit (if Step 1 produced fixes)**

```bash
git add emulators
git commit -m "chore(emulators): biome fixups after kit migration"
```

---

## Notes / out of scope

- No capability-composition framework (register-fragments only).
- No webhook for linear/x (the `plugin/` folder leaves an obvious `webhook.ts` slot for later marketplace work).
- github's `startGitHubEmulator` is not collapsed into `startEmulator` (kept byte-identical; possible future follow-up).
- Emulator code stays dev-only; production runtime must never import it.
- Commit with explicit pathspecs; do not push. Spec + plan docs stay uncommitted until the user asks.
