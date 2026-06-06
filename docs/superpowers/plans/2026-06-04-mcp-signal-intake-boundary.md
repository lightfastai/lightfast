# MCP Signal Intake Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move hosted MCP signal creation behind an app-owned internal command so MCP no longer imports app signal queueing internals or needs Inngest env.

**Architecture:** Add a shared service-JWT primitive that accepts an explicit secret, caller, and audience. Add `POST /api/internal/mcp/signals` in `apps/app`; it verifies caller `mcp`, calls app signal intake, and owns Inngest enqueueing. Replace the MCP `signals.create` default dependency with an app-command client that signs a service JWT and posts to the app origin.

**Tech Stack:** TypeScript, Next.js route handlers, TanStack Start MCP app, Vitest, Zod, jose via `@vendor/jose`, Vercel production deploys.

---

## File Structure

- Create `api/app/src/service-jwt.ts`: shared service JWT sign/verify helper with explicit `jwtSecret`, `caller`, and `audience` inputs; no app env import.
- Modify `api/app/package.json`: export `./service-jwt`.
- Modify `packages/api-contract/src/schemas/signals.ts`: add the internal MCP signal command input schema and type.
- Modify `packages/api-contract/src/index.ts`: export the new command schema/type.
- Create `api/app/src/__tests__/service-jwt.test.ts`: unit tests for caller, audience, expiry, and token-use validation.
- Create `apps/app/src/app/(internal)/api/internal/mcp/signals/route.ts`: app-owned internal command route for MCP signal creation.
- Create `apps/app/src/__tests__/app/api/internal/mcp-signals-route.test.ts`: route tests for service JWT auth, body parsing, and app signal service calls.
- Create `apps/mcp/src/tools/app-signal-intake.ts`: MCP-side app command adapter.
- Create `apps/mcp/src/__tests__/app-signal-intake.test.ts`: adapter tests for signed request, output validation, and upstream error mapping.
- Modify `apps/mcp/src/tools/execute.ts`: use the app signal intake adapter for `signals.create`, keep default dependency lazy-loading.
- Modify `apps/mcp/src/__tests__/tools.test.ts`: prove `signals.create` no longer imports `@api/app/signals/service`.

## Task 1: Shared Service JWT Primitive

**Files:**
- Create: `api/app/src/service-jwt.ts`
- Modify: `api/app/package.json`
- Test: `api/app/src/__tests__/service-jwt.test.ts`

- [ ] **Step 1: Write the failing service JWT tests**

Create `api/app/src/__tests__/service-jwt.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  signServiceJWT,
  verifyServiceJWT,
} from "../service-jwt";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

describe("service JWT", () => {
  it("signs and verifies an mcp caller for the app audience", async () => {
    const token = await signServiceJWT({
      audience: "lightfast-app",
      caller: "mcp",
      jwtSecret,
    });

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).resolves.toEqual({
      audience: "lightfast-app",
      caller: "mcp",
    });
  });

  it("rejects the wrong audience", async () => {
    const token = await signServiceJWT({
      audience: "lightfast-platform",
      caller: "mcp",
      jwtSecret,
    });

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).rejects.toMatchObject({
      code: "invalid_token",
      status: 401,
    });
  });

  it("rejects callers not allowed by the receiving route", async () => {
    const token = await signServiceJWT({
      audience: "lightfast-app",
      caller: "app",
      jwtSecret,
    });

    await expect(
      verifyServiceJWT({
        allowedCallers: ["mcp"],
        audience: "lightfast-app",
        jwtSecret,
        token,
      })
    ).rejects.toMatchObject({
      code: "disallowed_caller",
      status: 403,
    });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/service-jwt.test.ts
```

Expected: FAIL because `../service-jwt` does not exist.

- [ ] **Step 3: Implement `api/app/src/service-jwt.ts`**

Implement:

```ts
import { jwtVerify, SignJWT } from "@vendor/jose";
import { z } from "zod";

export const SERVICE_JWT_CALLERS = ["app", "inngest", "cron", "mcp"] as const;
export const SERVICE_JWT_AUDIENCES = [
  "lightfast-platform",
  "lightfast-app",
] as const;

export type ServiceJwtCaller = (typeof SERVICE_JWT_CALLERS)[number];
export type ServiceJwtAudience = (typeof SERVICE_JWT_AUDIENCES)[number];

export type ServiceJwtErrorCode = "invalid_token" | "disallowed_caller";

export class ServiceJwtError extends Error {
  constructor(
    readonly code: ServiceJwtErrorCode,
    message: string,
    readonly status: 401 | 403,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "ServiceJwtError";
  }
}

const serviceJwtPayloadSchema = z
  .object({
    iss: z.enum(SERVICE_JWT_CALLERS),
    token_use: z.literal("service_access"),
  })
  .passthrough();

function secretKey(jwtSecret: string): Uint8Array {
  return new TextEncoder().encode(jwtSecret);
}

export async function signServiceJWT(input: {
  audience: ServiceJwtAudience;
  caller: ServiceJwtCaller;
  jwtSecret: string;
  ttlSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = input.ttlSeconds ?? 60;

  return await new SignJWT({ token_use: "service_access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(input.caller)
    .setAudience(input.audience)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(secretKey(input.jwtSecret));
}

export async function verifyServiceJWT(input: {
  allowedCallers?: readonly ServiceJwtCaller[];
  audience: ServiceJwtAudience;
  jwtSecret: string;
  token: string;
}): Promise<{ audience: ServiceJwtAudience; caller: ServiceJwtCaller }> {
  try {
    const { payload } = await jwtVerify(input.token, secretKey(input.jwtSecret), {
      algorithms: ["HS256"],
      audience: input.audience,
    });
    const parsed = serviceJwtPayloadSchema.parse(payload);
    const caller = parsed.iss;

    if (
      input.allowedCallers &&
      !input.allowedCallers.includes(caller)
    ) {
      throw new ServiceJwtError(
        "disallowed_caller",
        "Service caller is not allowed for this command.",
        403
      );
    }

    return {
      audience: input.audience,
      caller,
    };
  } catch (error) {
    if (error instanceof ServiceJwtError) {
      throw error;
    }
    throw new ServiceJwtError("invalid_token", "Service token is invalid.", 401, {
      cause: error,
    });
  }
}
```

Update `api/app/package.json` exports:

```json
"./service-jwt": {
  "types": "./src/service-jwt.ts",
  "default": "./src/service-jwt.ts"
}
```

- [ ] **Step 4: Run the service JWT test**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/service-jwt.test.ts
```

Expected: PASS.

## Task 2: App-Owned MCP Signal Command Route

**Files:**
- Modify: `packages/api-contract/src/schemas/signals.ts`
- Modify: `packages/api-contract/src/index.ts`
- Create: `apps/app/src/app/(internal)/api/internal/mcp/signals/route.ts`
- Test: `apps/app/src/__tests__/app/api/internal/mcp-signals-route.test.ts`

- [ ] **Step 1: Add the internal command schema**

In `packages/api-contract/src/schemas/signals.ts`, add near `createSignalInput`:

```ts
export const createMcpSignalCommandInput = z.object({
  actor: z.object({
    clientId: z.string().min(1),
    grantId: z.string().min(1),
    kind: z.literal("mcp"),
    orgId: z.string().min(1),
    userId: z.string().min(1),
  }),
  input: createSignalInput.shape.input,
});
```

Add the type:

```ts
export type CreateMcpSignalCommandInput = z.infer<
  typeof createMcpSignalCommandInput
>;
```

Ensure `packages/api-contract/src/index.ts` exports the new schema and type with the other signal exports.

- [ ] **Step 2: Write route tests**

Create `apps/app/src/__tests__/app/api/internal/mcp-signals-route.test.ts`:

```ts
import { signServiceJWT } from "@api/app/service-jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSignalForActorMock = vi.fn();

vi.mock("@api/app/signals/service", () => ({
  createSignalForActor: createSignalForActorMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("~/env", () => ({
  env: {
    SERVICE_JWT_SECRET: "test-service-jwt-secret-at-least-32-chars",
  },
}));

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

async function token(input: {
  audience?: "lightfast-app" | "lightfast-platform";
  caller?: "app" | "mcp";
} = {}) {
  return await signServiceJWT({
    audience: input.audience ?? "lightfast-app",
    caller: input.caller ?? "mcp",
    jwtSecret,
  });
}

function request(body: unknown, bearerToken?: string): Request {
  return new Request("https://lightfast.ai/api/internal/mcp/signals", {
    body: JSON.stringify(body),
    headers: {
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  });
}

describe("internal MCP signal route", () => {
  beforeEach(() => {
    createSignalForActorMock.mockReset();
  });

  it("rejects missing service bearer tokens", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(request({ input: "Signal" }));

    expect(res.status).toBe(401);
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("rejects service tokens with the wrong audience", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request({ input: "Signal" }, await token({ audience: "lightfast-platform" }))
    );

    expect(res.status).toBe(401);
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("rejects service callers other than mcp", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(request({ input: "Signal" }, await token({ caller: "app" })));

    expect(res.status).toBe(403);
    expect(createSignalForActorMock).not.toHaveBeenCalled();
  });

  it("creates a signal with MCP attribution", async () => {
    createSignalForActorMock.mockResolvedValueOnce({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/signals/route"
    );

    const res = await POST(
      request(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "  Production smoke signal  ",
        },
        await token()
      )
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });
    expect(createSignalForActorMock).toHaveBeenCalledWith(
      { kind: "mock-db" },
      {
        actor: {
          clientId: "mcp_client_test",
          grantId: "mcp_grant_test",
          kind: "mcp",
          orgId: "org_test",
          userId: "user_test",
        },
        input: "Production smoke signal",
      }
    );
  });
});
```

- [ ] **Step 3: Implement the route**

Create `apps/app/src/app/(internal)/api/internal/mcp/signals/route.ts`:

```ts
import { verifyServiceJWT } from "@api/app/service-jwt";
import { createSignalForActor } from "@api/app/signals/service";
import { db } from "@db/app/client";
import { createMcpSignalCommandInput } from "@repo/api-contract";
import { env } from "~/env";

export const runtime = "nodejs";

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function jsonError(error: string, message: string, status: number): Response {
  return Response.json({ error, message }, { status });
}

function isSignalCreateQueueErrorLike(error: unknown): error is Error {
  return error instanceof Error && error.name === "SignalCreateQueueError";
}

export async function POST(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) {
    return jsonError("missing_token", "Service bearer token is required.", 401);
  }

  try {
    await verifyServiceJWT({
      allowedCallers: ["mcp"],
      audience: "lightfast-app",
      jwtSecret: env.SERVICE_JWT_SECRET,
      token,
    });
  } catch (error) {
    const status =
      error instanceof Error && "status" in error
        ? Number((error as { status: unknown }).status)
        : 401;
    return jsonError(
      status === 403 ? "disallowed_caller" : "invalid_token",
      status === 403
        ? "Service caller is not allowed for this command."
        : "Service token is invalid.",
      status === 403 ? 403 : 401
    );
  }

  const body = await request.json().catch(() => undefined);
  const parsed = createMcpSignalCommandInput.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "invalid_request",
      "MCP signal command request is invalid.",
      400
    );
  }

  try {
    const result = await createSignalForActor(db, parsed.data);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (isSignalCreateQueueErrorLike(error)) {
      return jsonError(
        "signal_enqueue_failed",
        error.message,
        500
      );
    }
    return jsonError("internal_error", "Failed to create signal.", 500);
  }
}
```

- [ ] **Step 4: Run route tests**

Run:

```bash
pnpm --filter @lightfast/app exec vitest run 'src/__tests__/app/api/internal/mcp-signals-route.test.ts'
```

Expected: PASS.

## Task 3: MCP App Signal Intake Adapter

**Files:**
- Create: `apps/mcp/src/tools/app-signal-intake.ts`
- Modify: `apps/mcp/src/tools/execute.ts`
- Test: `apps/mcp/src/__tests__/app-signal-intake.test.ts`
- Test: `apps/mcp/src/__tests__/tools.test.ts`

- [ ] **Step 1: Write adapter tests**

Create `apps/mcp/src/__tests__/app-signal-intake.test.ts`:

```ts
import { jwtVerify } from "@vendor/jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

async function importAdapter() {
  vi.stubEnv("MCP_AUTH_ISSUER", "https://lightfast.ai");
  vi.stubEnv("MCP_RESOURCE_URL", "https://mcp.lightfast.ai/mcp");
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);
  return await import("../tools/app-signal-intake");
}

describe("app signal intake adapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("posts MCP signal commands to the app with a service JWT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          status: "queued",
          visibilityScope: "user",
        }),
        { status: 200 }
      )
    );
    const { createSignalForActorViaApp } = await importAdapter();

    await expect(
      createSignalForActorViaApp(
        {} as never,
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Signal from MCP",
        },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://lightfast.ai/api/internal/mcp/signals",
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, init] = fetchMock.mock.calls[0];
    const authorization = (init?.headers as Record<string, string>).authorization;
    const bearer = authorization.replace(/^Bearer\s+/, "");
    const { payload } = await jwtVerify(
      bearer,
      new TextEncoder().encode(jwtSecret),
      { audience: "lightfast-app" }
    );
    expect(payload).toMatchObject({
      iss: "mcp",
      token_use: "service_access",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Signal from MCP",
    });
  });

  it("throws a stable upstream error for non-2xx app responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        { error: "signal_enqueue_failed", message: "Failed to queue signal." },
        { status: 500 }
      )
    );
    const { createSignalForActorViaApp } = await importAdapter();

    await expect(
      createSignalForActorViaApp(
        {} as never,
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Signal from MCP",
        },
        { fetch: fetchMock }
      )
    ).rejects.toMatchObject({
      code: "app_signal_intake_failed",
      status: 502,
    });
  });
});
```

- [ ] **Step 2: Implement the adapter**

Create `apps/mcp/src/tools/app-signal-intake.ts`:

```ts
import type { Database } from "@db/app";
import { signServiceJWT } from "@api/app/service-jwt";
import {
  createMcpSignalCommandInput,
  createSignalOutput,
  type CreateSignalOutput,
} from "@repo/api-contract";

import { env } from "../env";

type Fetch = typeof fetch;

export class AppSignalIntakeError extends Error {
  readonly code = "app_signal_intake_failed";
  readonly status = 502;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AppSignalIntakeError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  return await response.json().catch(() => undefined);
}

function appSignalUrl(): string {
  return new URL("/api/internal/mcp/signals", env.MCP_AUTH_ISSUER).toString();
}

function messageFromBody(body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof (body as { message: unknown }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return "App signal intake command failed.";
}

export async function createSignalForActorViaApp(
  _db: Database,
  input: {
    actor: {
      clientId: string;
      grantId: string;
      kind: "mcp";
      orgId: string;
      userId: string;
    };
    input: string;
  },
  dependencies: { fetch?: Fetch } = {}
): Promise<CreateSignalOutput> {
  const body = createMcpSignalCommandInput.parse(input);
  const serviceToken = await signServiceJWT({
    audience: "lightfast-app",
    caller: "mcp",
    jwtSecret: env.SERVICE_JWT_SECRET,
  });
  const requestFetch = dependencies.fetch ?? fetch;
  const response = await requestFetch(appSignalUrl(), {
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${serviceToken}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  const responseBody = await readJson(response);

  if (!response.ok) {
    throw new AppSignalIntakeError(messageFromBody(responseBody));
  }

  try {
    return createSignalOutput.parse(responseBody);
  } catch (error) {
    throw new AppSignalIntakeError(
      "App signal intake response was invalid.",
      { cause: error }
    );
  }
}
```

- [ ] **Step 3: Switch MCP `signals.create` default dependency**

In `apps/mcp/src/tools/execute.ts`, replace the `signals.create` default dependency import of `@api/app/signals/service` with `./app-signal-intake`:

```ts
const [appSignalIntake, mcpOauth] = await Promise.all([
  import("./app-signal-intake"),
  import("@api/app/mcp-oauth"),
]);
return {
  ...base,
  assertOrgAccess: mcpOauth.assertHostedMcpOrgAccess,
  callProviderRoutine: unavailableCallProviderRoutine,
  createSignalForActor: appSignalIntake.createSignalForActorViaApp,
  findProviderRoutines: unavailableFindProviderRoutines,
  getVisibleSignalByPublicId: dbApp.getVisibleSignalByPublicId,
};
```

Update `apps/mcp/src/__tests__/tools.test.ts` so the default dependency test mocks `../tools/app-signal-intake` and asserts `@api/app/signals/service` is not loaded.

- [ ] **Step 4: Run MCP tests**

Run:

```bash
pnpm --filter @lightfast/mcp test -- src/__tests__/app-signal-intake.test.ts src/__tests__/tools.test.ts
```

Expected: PASS.

## Task 4: Verification and Production Smoke

**Files:**
- Modify only if validation reveals a real issue.

- [ ] **Step 1: Run focused validation**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/service-jwt.test.ts src/__tests__/signal-create-service.test.ts
pnpm --filter @lightfast/app exec vitest run 'src/__tests__/app/api/internal/mcp-signals-route.test.ts'
pnpm --filter @lightfast/mcp test -- src/__tests__/app-signal-intake.test.ts src/__tests__/tools.test.ts
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @lightfast/mcp typecheck
git diff --check
```

Expected: all commands pass.

- [ ] **Step 2: Confirm MCP env still excludes Inngest**

Run:

```bash
pnpm dlx vercel@latest env ls production --scope lightfast --no-color --non-interactive --cwd apps/mcp
```

Expected: `INNGEST_APP_NAME`, `INNGEST_EVENT_KEY`, and `INNGEST_SIGNING_KEY` are absent.

- [ ] **Step 3: Deploy app and MCP**

Run:

```bash
pnpm dlx vercel@latest --prod --scope lightfast --cwd apps/app --no-color --non-interactive
pnpm dlx vercel@latest --prod --scope lightfast --cwd apps/mcp --no-color --non-interactive
```

Expected: both commands produce production deployment URLs.

- [ ] **Step 4: Run Claude Code MCP smoke**

Run:

```bash
claude mcp get lightfast
claude -p --debug --debug-file /tmp/claude-lightfast-health-after-boundary.log --permission-mode bypassPermissions --allowedTools 'mcp__lightfast__lightfast_system_health' --output-format stream-json 'Use the Lightfast MCP tool lightfast_system_health exactly once and report only the raw JSON result from the tool.'
claude -p --debug --debug-file /tmp/claude-lightfast-signal-after-boundary.log --permission-mode bypassPermissions --allowedTools 'mcp__lightfast__lightfast_signals_create,mcp__lightfast__lightfast_signals_get' --output-format stream-json 'Use Lightfast MCP tools only. First call lightfast_signals_create with input "Lightfast MCP production smoke test after app-owned signal intake on 2026-06-04. No action required." Then call lightfast_signals_get using the created signal id. Report only one compact JSON object with keys created and fetched.'
```

Expected:

- Claude MCP config reports `Connected`.
- Health returns `{"status":"ok",...}`.
- Signal create returns a queued signal id.
- Signal get returns that same id and input.
