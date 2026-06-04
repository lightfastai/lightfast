# Linear MCP Required Envs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Linear OAuth credentials required application env while preserving default real Linear endpoints and local emulator endpoint overrides.

**Architecture:** Follow the GitHub App env pattern: required values are enforced by `api/app/src/env.ts`, and connector config exposes an explicit parser plus an ambient runtime getter that still fails clearly when env validation is skipped. Linear missing-config UI is removed from reachable catalog behavior, while X remains optional and keeps its missing-config state.

**Tech Stack:** TypeScript, Zod via `@t3-oss/env-nextjs`, Vitest, Next.js app build env, Turborepo task env configuration.

---

### Task 1: Require Linear Credentials In API Env

**Files:**
- Modify: `api/app/src/__tests__/env.test.ts`
- Modify: `api/app/src/env.ts`

- [ ] **Step 1: Write the failing API env tests**

Update `api/app/src/__tests__/env.test.ts` so Linear keys are tracked and valid base env includes Linear credentials:

```ts
const LINEAR_ENV_KEYS = [
  "LINEAR_CLIENT_ID",
  "LINEAR_CLIENT_SECRET",
] as const;

const MUTATED_ENV_KEYS = [
  "CLERK_SECRET_KEY",
  "CONNECTOR_MCP_AUTH_SECRET",
  "ENCRYPTION_KEY",
  "INNGEST_APP_NAME",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "SKIP_ENV_VALIDATION",
  "UNKEY_API_ID",
  "UNKEY_ROOT_KEY",
  "VERCEL_ENV",
  ...GITHUB_APP_ENV_KEYS,
  ...LINEAR_ENV_KEYS,
] as const;
```

Add this test inside `describe("api app env", () => { ... })`:

```ts
it.each([
  "development",
  "preview",
  "production",
] as const)("requires Linear env during %s env module evaluation", async (vercelEnv) => {
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  setValidBaseEnv(vercelEnv);
  unsetLinearEnv();
  vi.resetModules();

  await expect(import("../env")).rejects.toThrow(
    "Invalid environment variables"
  );
  const loggedErrors = JSON.stringify(consoleErrorSpy.mock.calls);
  for (const key of LINEAR_ENV_KEYS) {
    expect(loggedErrors).toContain(key);
  }
});
```

Update `setValidBaseEnv`:

```ts
function setValidBaseEnv(vercelEnv: "development" | "preview" | "production") {
  process.env.CLERK_SECRET_KEY = "sk_test_fake-secret-key-for-tests";
  process.env.CONNECTOR_MCP_AUTH_SECRET = "x".repeat(32);
  process.env.ENCRYPTION_KEY = "0".repeat(64);
  process.env.INNGEST_APP_NAME = "lightfast-test";
  process.env.LINEAR_CLIENT_ID = "linear_client_test";
  process.env.LINEAR_CLIENT_SECRET = "linear_secret_test";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
    "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk";
  delete process.env.SKIP_ENV_VALIDATION;
  process.env.UNKEY_API_ID = "api_test";
  process.env.UNKEY_ROOT_KEY = "root_test";
  process.env.VERCEL_ENV = vercelEnv;
}

function unsetLinearEnv() {
  for (const key of LINEAR_ENV_KEYS) {
    delete process.env[key];
  }
}
```

- [ ] **Step 2: Run the env test and verify it fails**

Run:

```bash
pnpm --filter @api/app exec vitest run src/__tests__/env.test.ts
```

Expected: FAIL because `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` are still optional in `api/app/src/env.ts`.

- [ ] **Step 3: Make Linear credentials required**

In `api/app/src/env.ts`, change the Linear credential schema:

```ts
LINEAR_API_ORIGIN: z.string().url().optional(),
LINEAR_CLIENT_ID: z.string().min(1),
LINEAR_CLIENT_SECRET: z.string().min(1),
LINEAR_MCP_ENDPOINT: z.string().url().optional(),
```

Keep `experimental__runtimeEnv` entries for the same keys unchanged.

- [ ] **Step 4: Run the env test and verify it passes**

Run:

```bash
pnpm --filter @api/app exec vitest run src/__tests__/env.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the env contract**

Run:

```bash
git add api/app/src/__tests__/env.test.ts api/app/src/env.ts
git commit -m "feat: require linear connector env"
```

### Task 2: Rework Linear Connector Config Resolution

**Files:**
- Modify: `api/app/src/services/connectors/config.ts`
- Modify: `api/app/src/services/connectors/catalog.ts`
- Modify: `api/app/src/__tests__/connectors-flow.test.ts`

- [ ] **Step 1: Write failing connector config and catalog tests**

In `api/app/src/__tests__/connectors-flow.test.ts`, change the config import:

```ts
const {
  getLinearConnectorConfig,
  getXConnectorConfig,
  parseLinearConnectorConfig,
} = await import("../services/connectors/config");
```

In the `connector catalog services` test, remove the Linear missing-config subsection and keep the X assertion. The final missing-config part should be:

```ts
envMock.X_CLIENT_SECRET = undefined as unknown as string;
const missingXConfigRows = await listConnectorsForOrg(ctx());
expect(
  missingXConfigRows.find((row) => row.provider === "x")
).toMatchObject({
  connectAvailability: {
    missing: ["X_CLIENT_SECRET"],
    reason: "missing_config",
    status: "unavailable",
  },
});
```

Add Linear config coverage in `describe("connector OAuth attempts", () => { ... })` before the X config test:

```ts
it("resolves required Linear connector config with defaults and development overrides", () => {
  expect(
    parseLinearConnectorConfig({
      appOrigin: "https://app.lightfast.localhost",
      env: {
        LINEAR_CLIENT_ID: "linear_client_test",
        LINEAR_CLIENT_SECRET: "linear_secret_test",
      },
      nodeEnv: "production",
    })
  ).toMatchObject({
    clientId: "linear_client_test",
    clientSecret: "linear_secret_test",
    endpoints: {
      apiOrigin: "https://api.linear.app",
      appOrigin: "https://linear.app",
      mcpEndpoint: "https://mcp.linear.app/mcp",
      oauthAuthorizeUrl: "https://linear.app/oauth/authorize",
      oauthRevokeUrl: "https://api.linear.app/oauth/revoke",
      oauthTokenUrl: "https://api.linear.app/oauth/token",
      viewerUrl: "https://api.linear.app/graphql",
    },
  });

  expect(
    parseLinearConnectorConfig({
      appOrigin: "https://app.lightfast.localhost",
      env: {
        LINEAR_API_ORIGIN: "https://linear.test",
        LINEAR_CLIENT_ID: "linear_client_test",
        LINEAR_CLIENT_SECRET: "linear_secret_test",
        LINEAR_MCP_ENDPOINT: "https://linear.test/mcp",
      },
      nodeEnv: "development",
    })
  ).toMatchObject({
    endpoints: {
      apiOrigin: "https://linear.test",
      appOrigin: "https://linear.test",
      mcpEndpoint: "https://linear.test/mcp",
      oauthAuthorizeUrl: "https://linear.test/oauth/authorize",
      oauthRevokeUrl: "https://linear.test/oauth/revoke",
      oauthTokenUrl: "https://linear.test/oauth/token",
      viewerUrl: "https://linear.test/graphql",
    },
  });
});

it("rejects incomplete Linear connector config when env validation is skipped", () => {
  envMock.LINEAR_CLIENT_SECRET = undefined as unknown as string;

  expect(() =>
    getLinearConnectorConfig({
      appOrigin: "https://app.lightfast.localhost",
    })
  ).toThrow("Linear connector environment is incomplete.");
});

it("rejects custom Linear endpoints outside development and test", () => {
  expect(() =>
    parseLinearConnectorConfig({
      appOrigin: "https://app.lightfast.localhost",
      env: {
        LINEAR_API_ORIGIN: "https://linear.test",
        LINEAR_CLIENT_ID: "linear_client_test",
        LINEAR_CLIENT_SECRET: "linear_secret_test",
      },
      nodeEnv: "production",
    })
  ).toThrow(
    expect.objectContaining({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" })
  );
});
```

Update the Linear flow missing-config test:

```ts
it("throws a clear error when skipped validation leaves Linear config incomplete", async () => {
  envMock.LINEAR_CLIENT_SECRET = undefined as unknown as string;

  await expect(startLinearConnectorOAuth(ctx())).rejects.toThrow(
    "Linear connector environment is incomplete."
  );
});
```

- [ ] **Step 2: Run connector tests and verify they fail**

Run:

```bash
pnpm --filter @api/app exec vitest run src/__tests__/connectors-flow.test.ts
```

Expected: FAIL because `parseLinearConnectorConfig` does not exist, Linear still returns `missing_config`, and catalog availability still checks Linear missing config.

- [ ] **Step 3: Implement the required Linear config parser and getter**

In `api/app/src/services/connectors/config.ts`, replace the Linear result union with required config parsing:

```ts
export interface LinearConnectorConfig {
  appOrigin: string;
  clientId: string;
  clientSecret: string;
  endpoints: LinearEndpoints;
}

interface LinearConnectorConfigEnv {
  LINEAR_API_ORIGIN?: string;
  LINEAR_CLIENT_ID?: string;
  LINEAR_CLIENT_SECRET?: string;
  LINEAR_MCP_ENDPOINT?: string;
}

interface RequiredLinearConnectorConfigValues {
  clientId: string;
  clientSecret: string;
}

function parseRequiredLinearConnectorConfig(
  configEnv: LinearConnectorConfigEnv
): RequiredLinearConnectorConfigValues {
  const clientId = configEnv.LINEAR_CLIENT_ID;
  const clientSecret = configEnv.LINEAR_CLIENT_SECRET;

  if (!(clientId && clientSecret)) {
    throw new Error("Linear connector environment is incomplete.");
  }

  return { clientId, clientSecret };
}

export function parseLinearConnectorConfig(input: {
  appOrigin?: string;
  appUrl?: string;
  env: LinearConnectorConfigEnv;
  nodeEnv?: string;
}): LinearConnectorConfig {
  const required = parseRequiredLinearConnectorConfig(input.env);
  const endpointOverrides = {
    ...(input.env.LINEAR_API_ORIGIN
      ? {
          apiOrigin: input.env.LINEAR_API_ORIGIN,
          appOrigin: input.env.LINEAR_API_ORIGIN,
        }
      : {}),
    ...(input.env.LINEAR_MCP_ENDPOINT
      ? { mcpEndpoint: input.env.LINEAR_MCP_ENDPOINT }
      : {}),
  };

  return {
    appOrigin:
      input.appOrigin ?? resolveConnectorAppOrigin({ appUrl: input.appUrl }),
    clientId: required.clientId,
    clientSecret: required.clientSecret,
    endpoints: resolveLinearEndpoints({
      endpointOverrides,
      nodeEnv: input.nodeEnv,
    }),
  };
}

export function getLinearConnectorConfig(
  input: {
    appOrigin?: string;
    appUrl?: string;
    nodeEnv?: string;
  } = {}
): LinearConnectorConfig {
  return parseLinearConnectorConfig({
    appOrigin: input.appOrigin,
    appUrl: input.appUrl,
    env: runtimeEnv,
    nodeEnv: input.nodeEnv,
  });
}

export function requireLinearConnectorConfig(
  input: Parameters<typeof getLinearConnectorConfig>[0] = {}
): LinearConnectorConfig {
  return getLinearConnectorConfig(input);
}
```

Remove the old `LinearConnectorConfigResult` type and the `TRPCError` import if no longer used in this file.

- [ ] **Step 4: Remove Linear missing-config catalog checks**

In `api/app/src/services/connectors/catalog.ts`, remove `getLinearConnectorConfig` from the import:

```ts
import { getXConnectorConfig } from "./config";
```

Remove the `if (input.provider === "linear") { ... }` block from `availabilityFor`. The X block remains unchanged.

- [ ] **Step 5: Run connector tests and verify they pass**

Run:

```bash
pnpm --filter @api/app exec vitest run src/__tests__/connectors-flow.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit connector config changes**

Run:

```bash
git add api/app/src/services/connectors/config.ts api/app/src/services/connectors/catalog.ts api/app/src/__tests__/connectors-flow.test.ts
git commit -m "feat: make linear connector config required"
```

### Task 3: Remove Reachable Linear Missing-Config UI Test Coverage

**Files:**
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx`

- [ ] **Step 1: Delete the Linear missing-config UI test**

Remove this test block from the connectors page test file:

```ts
it("disables connect when Linear config is missing", () => {
  renderClient([
    row({
      connectAvailability: {
        status: "unavailable",
        reason: "missing_config",
        missing: ["LINEAR_CLIENT_ID"],
      },
    }),
  ]);

  expect(screen.getByRole("button", { name: /^connect$/i })).toBeDisabled();
  expect(screen.getByText(/missing config/i)).toBeVisible();
  expect(screen.getByText(/LINEAR_CLIENT_ID/)).toBeVisible();
});
```

Keep the existing X missing-config test unchanged.

- [ ] **Step 2: Run the connectors page test**

Run:

```bash
pnpm --filter @lightfast/app exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx"
```

Expected: PASS.

- [ ] **Step 3: Commit UI test cleanup**

Run:

```bash
git add "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx"
git commit -m "test: remove linear missing config ui state"
```

### Task 4: Align Provider Routine Linear Env Failure

**Files:**
- Create: `packages/provider-routines/src/__tests__/linear.test.ts`
- Modify: `packages/provider-routines/src/linear.ts`

- [ ] **Step 1: Write the failing provider-routine adapter test**

Create `packages/provider-routines/src/__tests__/linear.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@db/app", () => ({
  getCurrentOrgConnectorConnection: vi.fn(),
  updateObservedConnectorTokens: vi.fn(),
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}));

const { defaultLinearProviderRoutineAdapter } = await import("../linear");

const now = new Date("2026-06-04T00:00:00.000Z");

function connection() {
  return {
    accessTokenExpiresAt: new Date("2099-06-04T00:00:00.000Z"),
    clerkOrgId: "org_acme",
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    id: 1,
    mcpEndpoint: "https://mcp.linear.app/mcp",
    provider: "linear",
    refreshTokenExpiresAt: new Date("2099-06-04T00:00:00.000Z"),
    status: "active",
  };
}

describe("defaultLinearProviderRoutineAdapter", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects incomplete ambient Linear env before reading token material", async () => {
    vi.stubEnv("ENCRYPTION_KEY", "0".repeat(64));
    vi.stubEnv("LINEAR_CLIENT_ID", "");
    vi.stubEnv("LINEAR_CLIENT_SECRET", "linear_secret_test");

    await expect(
      defaultLinearProviderRoutineAdapter.getAccessToken({
        connection: connection() as never,
        db: {} as never,
        log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        now: () => now,
      })
    ).rejects.toMatchObject({
      code: "LINEAR_TOKEN_REFRESH_FAILED",
      message: "Linear connector environment is incomplete.",
    });
  });
});
```

- [ ] **Step 2: Run the provider-routine Linear test and verify it fails**

Run:

```bash
pnpm --filter @repo/provider-routines exec vitest run src/__tests__/linear.test.ts
```

Expected: FAIL because `packages/provider-routines/src/linear.ts` still throws `Linear connector config is missing.`

- [ ] **Step 3: Update the defensive error message**

In `packages/provider-routines/src/linear.ts`, change the missing-env error:

```ts
if (!(clientId && clientSecret && encryptionKey)) {
  throw linearError(
    "LINEAR_TOKEN_REFRESH_FAILED",
    "Linear connector environment is incomplete."
  );
}
```

- [ ] **Step 4: Run provider-routine tests**

Run:

```bash
pnpm --filter @repo/provider-routines exec vitest run src/__tests__/linear.test.ts src/__tests__/call.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit provider-routine defensive guard**

Run:

```bash
git add packages/provider-routines/src/__tests__/linear.test.ts packages/provider-routines/src/linear.ts
git commit -m "fix: align linear provider routine env failure"
```

### Task 5: Propagate Linear Env Through App Build

**Files:**
- Modify: `apps/app/turbo.json`

- [ ] **Step 1: Update Turbo env configuration**

In `apps/app/turbo.json`, add endpoint overrides to build `env`:

```json
"LINEAR_API_ORIGIN",
"LINEAR_MCP_ENDPOINT",
```

Add credentials to build `passThroughEnv`:

```json
"LINEAR_CLIENT_ID",
"LINEAR_CLIENT_SECRET",
```

Keep credentials out of public env lists.

- [ ] **Step 2: Run a JSON validity check**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/app/turbo.json', 'utf8')); console.log('apps/app/turbo.json ok')"
```

Expected: prints `apps/app/turbo.json ok`.

- [ ] **Step 3: Commit Turbo env propagation**

Run:

```bash
git add apps/app/turbo.json
git commit -m "chore: pass linear env to app builds"
```

### Task 6: Final Verification

**Files:**
- Read-only verification across modified packages.

- [ ] **Step 1: Run focused API tests**

Run:

```bash
pnpm --filter @api/app exec vitest run src/__tests__/env.test.ts src/__tests__/connectors-flow.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run focused app UI test**

Run:

```bash
pnpm --filter @lightfast/app exec vitest run "src/__tests__/app/(app)/(pending-not-allowed)/[slug]/connectors-page.test.tsx"
```

Expected: PASS.

- [ ] **Step 3: Run focused provider-routines tests**

Run:

```bash
pnpm --filter @repo/provider-routines exec vitest run src/__tests__/linear.test.ts src/__tests__/call.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run package typechecks**

Run:

```bash
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
pnpm --filter @repo/provider-routines typecheck
```

Expected: PASS.

- [ ] **Step 5: Inspect final git status**

Run:

```bash
git status --short
```

Expected: clean working tree after commits, or only intentional uncommitted user files unrelated to this plan.
