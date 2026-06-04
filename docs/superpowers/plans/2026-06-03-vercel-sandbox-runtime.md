# Vercel Sandbox Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the internal Vercel Sandbox runtime and multi-command Developer Sandbox Run service that can execute real CLI commands with all enabled org Developer Connections loaded after policy passes.

**Architecture:** Third-party SDK access lives in `@vendor/vercel-sandbox`; reusable runtime interfaces and the Vercel adapter live in `@repo/sandbox-runtime`; `api/app` owns Lightfast-specific sandbox runs, command policy, credential lease materialization, redaction, persistence, and cleanup. The first external proof is a gated non-secret Vercel Sandbox smoke script, not UI, MCP, or public tRPC.

**Tech Stack:** pnpm workspace packages, `@vercel/sandbox@2.1.0`, Vitest, Drizzle MySQL/Vitess, Inngest cron cleanup, existing `@db/app` and Developer Connections services.

---

## File Structure

- Modify `pnpm-workspace.yaml`
  - Add `@vercel/sandbox` to the shared catalog at `^2.1.0`.
- Create `vendor/vercel-sandbox/package.json`
  - Vendor wrapper package for the official SDK.
- Create `vendor/vercel-sandbox/tsconfig.json`
  - Standard vendor TypeScript config.
- Create `vendor/vercel-sandbox/src/index.ts`
  - Re-export only the SDK values/types Lightfast needs.
- Create `packages/sandbox-runtime/package.json`
  - Reusable runtime package depending on `@vendor/vercel-sandbox`.
- Create `packages/sandbox-runtime/tsconfig.json`
  - Standard package TypeScript config.
- Create `packages/sandbox-runtime/vitest.config.ts`
  - Standard node Vitest config.
- Create `packages/sandbox-runtime/src/types.ts`
  - Provider-neutral `SandboxRuntime` interfaces.
- Create `packages/sandbox-runtime/src/vercel.ts`
  - `@vercel/sandbox` adapter.
- Create `packages/sandbox-runtime/src/testing.ts`
  - Explicit test-only in-memory runtime.
- Create `packages/sandbox-runtime/src/index.ts`
  - Public exports.
- Create `packages/sandbox-runtime/src/__tests__/sandbox-runtime.test.ts`
  - Runtime adapter and test-double coverage.
- Leave `db/app/package.json` unchanged
  - Keep DB status string unions local so `@db/app` does not depend on runtime code.
- Create `db/app/src/schema/tables/developer-sandbox-runs.ts`
  - Owns `lightfast_developer_sandbox_runs` and `lightfast_developer_sandbox_commands`.
- Modify `db/app/src/schema/tables/index.ts`
  - Re-export new tables and types.
- Modify `db/app/src/schema/index.ts`
  - Re-export new tables and types.
- Modify `db/app/src/index.ts`
  - Re-export new DB helper APIs.
- Create `db/app/src/utils/developer-sandbox-runs.ts`
  - Run/command persistence helpers and stale-run selection.
- Modify `db/app/src/utils/developer-connections.ts`
  - Add lease listing/revocation helpers by sandbox run id.
- Create `db/app/src/__tests__/developer-sandbox-runs.test.ts`
  - DB schema/helper tests.
- Modify `db/app/src/__tests__/developer-connections.test.ts`
  - Cover new lease helper exports.
- Create `api/app/src/services/developer-sandbox-runs/policy.ts`
  - Best-effort command guardrail.
- Create `api/app/src/services/developer-sandbox-runs/redaction.ts`
  - Redaction helper for returned stdout/stderr.
- Create `api/app/src/services/developer-sandbox-runs/index.ts`
  - Lightfast run service.
- Create `api/app/src/__tests__/developer-sandbox-policy.test.ts`
  - Policy/redaction tests.
- Create `api/app/src/__tests__/developer-sandbox-runs-service.test.ts`
  - Service orchestration tests.
- Modify `api/app/src/services/developer-connections/leases.ts`
  - Add all-enabled lease issuance and materialization helpers for sandbox runs.
- Modify `api/app/src/__tests__/developer-connections-service.test.ts`
  - Cover all-enabled lease issuance.
- Create `api/app/src/inngest/workflow/cleanup-developer-sandbox-runs.ts`
  - Cron cleanup/reaper for expired runs.
- Modify `api/app/src/inngest/index.ts`
  - Register cleanup workflow.
- Create `api/app/src/__tests__/developer-sandbox-cleanup-workflow.test.ts`
  - Workflow registration/handler tests.
- Modify `api/app/package.json`
  - Add `@repo/sandbox-runtime` and a `smoke:sandbox-runtime` script.
- Create `api/app/scripts/smoke-vercel-sandbox-runtime.ts`
  - Gated non-secret Vercel Sandbox smoke script.
- Generate Drizzle migration with `pnpm db:generate`
  - Never hand-write SQL.

---

### Task 1: Add `@vendor/vercel-sandbox`

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `vendor/vercel-sandbox/package.json`
- Create: `vendor/vercel-sandbox/tsconfig.json`
- Create: `vendor/vercel-sandbox/src/index.ts`

- [ ] **Step 1: Run the package typecheck before the package exists**

Run:

```bash
pnpm --filter @vendor/vercel-sandbox typecheck
```

Expected: FAIL because `@vendor/vercel-sandbox` does not exist yet.

- [ ] **Step 2: Add the SDK to the catalog**

In `pnpm-workspace.yaml`, add this entry in the `catalog:` section near the other `@vercel/*` entries:

```yaml
  '@vercel/sandbox': ^2.1.0
```

- [ ] **Step 3: Create the vendor package metadata**

Create `vendor/vercel-sandbox/package.json`:

```json
{
  "name": "@vendor/vercel-sandbox",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "license": "Apache-2.0",
  "scripts": {
    "clean": "git clean -xdf .cache .turbo node_modules",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vercel/sandbox": "catalog:"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "typescript": "catalog:"
  }
}
```

Create `vendor/vercel-sandbox/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create the vendor re-export**

Create `vendor/vercel-sandbox/src/index.ts`:

```ts
export {
  APIError,
  Command,
  CommandFinished,
  FileSystem,
  Sandbox,
  Snapshot,
  StreamError,
} from "@vercel/sandbox";

export type {
  CommandOutput,
  NetworkPolicy,
  SerializedCommand,
  SerializedCommandFinished,
  SerializedSandbox,
} from "@vercel/sandbox";
```

- [ ] **Step 5: Install dependencies**

Run:

```bash
pnpm install
```

Expected: PASS and `pnpm-lock.yaml` updates with `@vercel/sandbox@2.1.0`.

- [ ] **Step 6: Verify the vendor package**

Run:

```bash
pnpm --filter @vendor/vercel-sandbox typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml vendor/vercel-sandbox
git commit -m "feat: add vercel sandbox vendor package"
```

---

### Task 2: Add `@repo/sandbox-runtime`

**Files:**
- Create: `packages/sandbox-runtime/package.json`
- Create: `packages/sandbox-runtime/tsconfig.json`
- Create: `packages/sandbox-runtime/vitest.config.ts`
- Create: `packages/sandbox-runtime/src/types.ts`
- Create: `packages/sandbox-runtime/src/vercel.ts`
- Create: `packages/sandbox-runtime/src/testing.ts`
- Create: `packages/sandbox-runtime/src/index.ts`
- Create: `packages/sandbox-runtime/src/__tests__/sandbox-runtime.test.ts`

- [ ] **Step 1: Write the failing runtime tests**

Create `packages/sandbox-runtime/src/__tests__/sandbox-runtime.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();
const getMock = vi.fn();

vi.mock("@vendor/vercel-sandbox", () => ({
  Sandbox: {
    create: createMock,
    get: getMock,
  },
}));

const {
  createInMemorySandboxRuntimeForTests,
  createVercelSandboxRuntime,
} = await import("../index");

function sdkSandbox(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "sandbox_test",
    status: "running",
    runCommand: vi.fn(async () => ({
      cmdId: "cmd_sdk_1",
      exitCode: 0,
      logs: async function* logs() {
        yield { stream: "stdout" as const, data: "hello\n" };
      },
      stdout: vi.fn(async () => "hello\n"),
      stderr: vi.fn(async () => ""),
      wait: vi.fn(),
      kill: vi.fn(),
    })),
    writeFiles: vi.fn(async () => undefined),
    readFileToBuffer: vi.fn(async () => Buffer.from("file contents")),
    updateNetworkPolicy: vi.fn(async () => "allow-all"),
    stop: vi.fn(async () => ({ status: "stopped" })),
    ...overrides,
  };
}

describe("@repo/sandbox-runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a Vercel sandbox and normalizes command output", async () => {
    const sdk = sdkSandbox();
    createMock.mockResolvedValue(sdk);

    const runtime = createVercelSandboxRuntime();
    const sandbox = await runtime.create({
      name: "developer-sandbox-run-1",
      runtime: "node24",
      timeoutMs: 300_000,
      resources: { vcpus: 2 },
      networkPolicy: "allow-all",
    });

    const command = await sandbox.exec({
      cmd: "node",
      args: ["--version"],
      env: { LIGHTFAST_SANDBOX_SMOKE: "1" },
      timeoutMs: 10_000,
    });

    await expect(command.stdout()).resolves.toBe("hello\n");
    await expect(command.stderr()).resolves.toBe("");
    await expect(command.wait()).resolves.toEqual({ exitCode: 0 });
    expect(createMock).toHaveBeenCalledWith({
      name: "developer-sandbox-run-1",
      runtime: "node24",
      timeout: 300_000,
      resources: { vcpus: 2 },
      networkPolicy: "allow-all",
      ports: undefined,
    });
    expect(sdk.runCommand).toHaveBeenCalledWith({
      cmd: "node",
      args: ["--version"],
      cwd: undefined,
      detached: false,
      env: { LIGHTFAST_SANDBOX_SMOKE: "1" },
      timeoutMs: 10_000,
    });
  });

  it("passes file and lifecycle operations through the Vercel sandbox", async () => {
    const sdk = sdkSandbox();
    getMock.mockResolvedValue(sdk);

    const runtime = createVercelSandboxRuntime();
    const sandbox = await runtime.get("sandbox_test");

    await sandbox.writeFiles([
      { path: "/vercel/sandbox/test.txt", content: "contents", mode: 0o600 },
    ]);
    await expect(
      sandbox.readFileToBuffer("/vercel/sandbox/test.txt")
    ).resolves.toEqual(Buffer.from("file contents"));
    await sandbox.updateNetworkPolicy("deny-all");
    await sandbox.stop();

    expect(getMock).toHaveBeenCalledWith({ name: "sandbox_test" });
    expect(sdk.writeFiles).toHaveBeenCalledWith([
      { path: "/vercel/sandbox/test.txt", content: "contents", mode: 0o600 },
    ]);
    expect(sdk.readFileToBuffer).toHaveBeenCalledWith({
      path: "/vercel/sandbox/test.txt",
    });
    expect(sdk.updateNetworkPolicy).toHaveBeenCalledWith("deny-all");
    expect(sdk.stop).toHaveBeenCalled();
  });

  it("provides an explicit in-memory runtime for tests only", async () => {
    const runtime = createInMemorySandboxRuntimeForTests();
    const sandbox = await runtime.create({ name: "test-run" });

    await sandbox.writeFiles([{ path: "/tmp/a.txt", content: "a" }]);
    const command = await sandbox.exec({
      cmd: "echo",
      args: ["hello"],
      env: { EXAMPLE: "1" },
    });

    await expect(command.stdout()).resolves.toBe("");
    await expect(command.stderr()).resolves.toBe("");
    await expect(command.wait()).resolves.toEqual({ exitCode: 0 });
    expect(runtime.calls).toMatchObject({
      create: [{ name: "test-run" }],
      exec: [{ cmd: "echo", args: ["hello"], env: { EXAMPLE: "1" } }],
      writeFiles: [[{ path: "/tmp/a.txt", content: "a" }]],
    });
  });
});
```

- [ ] **Step 2: Run the runtime tests to verify they fail**

Run:

```bash
pnpm --filter @repo/sandbox-runtime test
```

Expected: FAIL because the package does not exist yet.

- [ ] **Step 3: Create package metadata**

Create `packages/sandbox-runtime/package.json`:

```json
{
  "name": "@repo/sandbox-runtime",
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
    "@vendor/vercel-sandbox": "workspace:*"
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

Create `packages/sandbox-runtime/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

Create `packages/sandbox-runtime/vitest.config.ts`:

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

- [ ] **Step 4: Implement runtime types**

Create `packages/sandbox-runtime/src/types.ts`:

```ts
import type { NetworkPolicy } from "@vendor/vercel-sandbox";

export type SandboxRuntimeName = "vercel";
export type SandboxStatus =
  | "pending"
  | "running"
  | "stopping"
  | "stopped"
  | "failed"
  | string;
export type SandboxRuntimeRuntime = "node24" | "node22" | "python3.13";
export type SandboxNetworkPolicy = NetworkPolicy;

export interface SandboxCreateInput {
  name?: string;
  runtime?: SandboxRuntimeRuntime;
  timeoutMs?: number;
  resources?: { vcpus?: number };
  networkPolicy?: SandboxNetworkPolicy;
  ports?: number[];
}

export interface SandboxFile {
  path: string;
  content: string | Uint8Array;
  mode?: number;
}

export interface SandboxExecInput {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  detached?: boolean;
}

export interface SandboxLogChunk {
  stream: "stderr" | "stdout";
  data: string;
}

export interface SandboxCommandResult {
  exitCode: number | null;
}

export interface SandboxCommand {
  id: string;
  logs(): AsyncIterable<SandboxLogChunk>;
  wait(): Promise<SandboxCommandResult>;
  stdout(): Promise<string>;
  stderr(): Promise<string>;
  kill(): Promise<void>;
}

export interface SandboxHandle {
  id: string;
  status: SandboxStatus;
  writeFiles(files: SandboxFile[]): Promise<void>;
  readFileToBuffer(path: string): Promise<Buffer | null>;
  exec(input: SandboxExecInput): Promise<SandboxCommand>;
  updateNetworkPolicy(policy: SandboxNetworkPolicy): Promise<void>;
  stop(): Promise<void>;
}

export interface SandboxRuntime {
  create(input?: SandboxCreateInput): Promise<SandboxHandle>;
  get(id: string): Promise<SandboxHandle>;
  destroy(id: string): Promise<void>;
}
```

- [ ] **Step 5: Implement the Vercel adapter**

Create `packages/sandbox-runtime/src/vercel.ts`:

```ts
import { Sandbox } from "@vendor/vercel-sandbox";
import type {
  SandboxCommand,
  SandboxCreateInput,
  SandboxExecInput,
  SandboxHandle,
  SandboxNetworkPolicy,
  SandboxRuntime,
} from "./types";

type VercelSandbox = Awaited<ReturnType<typeof Sandbox.create>>;
type VercelCommand = Awaited<ReturnType<VercelSandbox["runCommand"]>>;

function wrapCommand(command: VercelCommand): SandboxCommand {
  return {
    id: "cmdId" in command ? command.cmdId : "unknown",
    logs: () => command.logs(),
    wait: async () => {
      const finished = await command.wait();
      return { exitCode: finished.exitCode };
    },
    stdout: () => command.stdout(),
    stderr: () => command.stderr(),
    kill: async () => {
      await command.kill();
    },
  };
}

function createHandle(sandbox: VercelSandbox): SandboxHandle {
  return {
    id: sandbox.name,
    get status() {
      return sandbox.status;
    },
    async writeFiles(files) {
      await sandbox.writeFiles(files);
    },
    async readFileToBuffer(path) {
      return await sandbox.readFileToBuffer({ path });
    },
    async exec(input: SandboxExecInput) {
      const command = await sandbox.runCommand({
        cmd: input.cmd,
        args: input.args,
        cwd: input.cwd,
        detached: input.detached ?? false,
        env: input.env,
        timeoutMs: input.timeoutMs,
      });
      return wrapCommand(command);
    },
    async updateNetworkPolicy(policy: SandboxNetworkPolicy) {
      await sandbox.updateNetworkPolicy(policy);
    },
    async stop() {
      await sandbox.stop();
    },
  };
}

export function createVercelSandboxRuntime(): SandboxRuntime {
  return {
    async create(input: SandboxCreateInput = {}) {
      const sandbox = await Sandbox.create({
        name: input.name,
        runtime: input.runtime ?? "node24",
        timeout: input.timeoutMs,
        resources: input.resources?.vcpus
          ? { vcpus: input.resources.vcpus }
          : undefined,
        networkPolicy: input.networkPolicy,
        ports: input.ports,
      });
      return createHandle(sandbox);
    },
    async get(id: string) {
      const sandbox = await Sandbox.get({ name: id });
      return createHandle(sandbox);
    },
    async destroy(id: string) {
      const sandbox = await Sandbox.get({ name: id });
      await sandbox.stop();
    },
  };
}
```

- [ ] **Step 6: Implement the test runtime**

Create `packages/sandbox-runtime/src/testing.ts`:

```ts
import type {
  SandboxCreateInput,
  SandboxExecInput,
  SandboxFile,
  SandboxHandle,
  SandboxNetworkPolicy,
  SandboxRuntime,
} from "./types";

interface InMemoryRuntimeCalls {
  create: SandboxCreateInput[];
  destroy: string[];
  exec: SandboxExecInput[];
  get: string[];
  networkPolicy: SandboxNetworkPolicy[];
  stop: string[];
  writeFiles: SandboxFile[][];
}

export interface InMemorySandboxRuntimeForTests extends SandboxRuntime {
  calls: InMemoryRuntimeCalls;
}

export function createInMemorySandboxRuntimeForTests(): InMemorySandboxRuntimeForTests {
  const calls: InMemoryRuntimeCalls = {
    create: [],
    destroy: [],
    exec: [],
    get: [],
    networkPolicy: [],
    stop: [],
    writeFiles: [],
  };

  function handle(id: string): SandboxHandle {
    return {
      id,
      status: "running",
      async writeFiles(files) {
        calls.writeFiles.push(files);
      },
      async readFileToBuffer() {
        return null;
      },
      async exec(input) {
        calls.exec.push(input);
        return {
          id: `command_${calls.exec.length}`,
          async *logs() {},
          async wait() {
            return { exitCode: 0 };
          },
          async stdout() {
            return "";
          },
          async stderr() {
            return "";
          },
          async kill() {},
        };
      },
      async updateNetworkPolicy(policy) {
        calls.networkPolicy.push(policy);
      },
      async stop() {
        calls.stop.push(id);
      },
    };
  }

  return {
    calls,
    async create(input = {}) {
      calls.create.push(input);
      return handle(input.name ?? "in_memory_sandbox");
    },
    async get(id) {
      calls.get.push(id);
      return handle(id);
    },
    async destroy(id) {
      calls.destroy.push(id);
    },
  };
}
```

- [ ] **Step 7: Add package exports**

Create `packages/sandbox-runtime/src/index.ts`:

```ts
export type {
  SandboxCommand,
  SandboxCommandResult,
  SandboxCreateInput,
  SandboxExecInput,
  SandboxFile,
  SandboxHandle,
  SandboxLogChunk,
  SandboxNetworkPolicy,
  SandboxRuntime,
  SandboxRuntimeName,
  SandboxRuntimeRuntime,
  SandboxStatus,
} from "./types";
export { createInMemorySandboxRuntimeForTests } from "./testing";
export type { InMemorySandboxRuntimeForTests } from "./testing";
export { createVercelSandboxRuntime } from "./vercel";
```

- [ ] **Step 8: Verify the runtime package**

Run:

```bash
pnpm --filter @repo/sandbox-runtime test
pnpm --filter @repo/sandbox-runtime typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/sandbox-runtime
git commit -m "feat: add sandbox runtime package"
```

---

### Task 3: Persist Developer Sandbox Runs And Commands

**Files:**
- Create: `db/app/src/schema/tables/developer-sandbox-runs.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Modify: `db/app/src/index.ts`
- Create: `db/app/src/utils/developer-sandbox-runs.ts`
- Create: `db/app/src/__tests__/developer-sandbox-runs.test.ts`

- [ ] **Step 1: Write the failing DB tests**

Create `db/app/src/__tests__/developer-sandbox-runs.test.ts`:

```ts
import {
  createDeveloperSandboxCommandId,
  createDeveloperSandboxRunId,
  developerSandboxCommands,
  developerSandboxRuns,
} from "../schema";
import {
  createDeveloperSandboxCommand,
  createDeveloperSandboxRun,
  getDeveloperSandboxRunByPublicId,
  listExpiredDeveloperSandboxRuns,
  markDeveloperSandboxCommandFinished,
  markDeveloperSandboxCommandRunning,
  markDeveloperSandboxRunCredentialsLoaded,
  markDeveloperSandboxRunExpired,
  markDeveloperSandboxRunStopped,
} from "../utils/developer-sandbox-runs";
import { describe, expect, it } from "vitest";

describe("developer sandbox run schema", () => {
  it("creates prefixed public ids", () => {
    expect(createDeveloperSandboxRunId()).toMatch(
      /^developer_sandbox_run_[0-9a-f-]{36}$/
    );
    expect(createDeveloperSandboxCommandId()).toMatch(
      /^developer_sandbox_command_[0-9a-f-]{36}$/
    );
  });

  it("defines run and command table names", () => {
    expect(developerSandboxRuns[Symbol.for("drizzle:Name")]).toBe(
      "lightfast_developer_sandbox_runs"
    );
    expect(developerSandboxCommands[Symbol.for("drizzle:Name")]).toBe(
      "lightfast_developer_sandbox_commands"
    );
  });

  it("exports the expected helper functions", () => {
    expect(typeof createDeveloperSandboxRun).toBe("function");
    expect(typeof getDeveloperSandboxRunByPublicId).toBe("function");
    expect(typeof markDeveloperSandboxRunCredentialsLoaded).toBe("function");
    expect(typeof markDeveloperSandboxRunStopped).toBe("function");
    expect(typeof markDeveloperSandboxRunExpired).toBe("function");
    expect(typeof listExpiredDeveloperSandboxRuns).toBe("function");
    expect(typeof createDeveloperSandboxCommand).toBe("function");
    expect(typeof markDeveloperSandboxCommandRunning).toBe("function");
    expect(typeof markDeveloperSandboxCommandFinished).toBe("function");
  });
});
```

- [ ] **Step 2: Run the DB test to verify it fails**

Run:

```bash
pnpm --filter @db/app test -- developer-sandbox-runs.test.ts
```

Expected: FAIL because the schema/helper files do not exist.

- [ ] **Step 3: Create the schema**

Create `db/app/src/schema/tables/developer-sandbox-runs.ts`:

```ts
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  json,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const DEVELOPER_SANDBOX_RUN_ID_PREFIX = "developer_sandbox_run_";
export const DEVELOPER_SANDBOX_COMMAND_ID_PREFIX =
  "developer_sandbox_command_";

export type DeveloperSandboxRunStatus =
  | "created"
  | "running"
  | "stopping"
  | "stopped"
  | "expired"
  | "failed";

export type DeveloperSandboxCommandStatus =
  | "completed"
  | "denied"
  | "failed"
  | "pending"
  | "running";

export type DeveloperSandboxPolicyDecision = "allowed" | "denied";

const PUBLIC_ID_LENGTH = 96;
const CLERK_ID_LENGTH = 64;
const PROVIDER_REF_LENGTH = 128;
const CODE_LENGTH = 32;

export function createDeveloperSandboxRunId() {
  return `${DEVELOPER_SANDBOX_RUN_ID_PREFIX}${randomUUID()}`;
}

export function createDeveloperSandboxCommandId() {
  return `${DEVELOPER_SANDBOX_COMMAND_ID_PREFIX}${randomUUID()}`;
}

export const developerSandboxRuns = mysqlTable(
  "lightfast_developer_sandbox_runs",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperSandboxRunId),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    actorUserId: varchar("actor_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    workflowRunId: varchar("workflow_run_id", {
      length: PROVIDER_REF_LENGTH,
    }),
    vercelSandboxId: varchar("vercel_sandbox_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperSandboxRunStatus>()
      .notNull(),
    credentialsLoadedAt: timestamp("credentials_loaded_at", {
      mode: "date",
      fsp: 3,
    }),
    expiresAt: timestamp("expires_at", { mode: "date", fsp: 3 }).notNull(),
    stoppedAt: timestamp("stopped_at", { mode: "date", fsp: 3 }),
    cleanupAttemptedAt: timestamp("cleanup_attempted_at", {
      mode: "date",
      fsp: 3,
    }),
    cleanupFailureCode: varchar("cleanup_failure_code", {
      length: CODE_LENGTH,
    }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("developer_sandbox_runs_public_id_uq").on(
      table.publicId
    ),
    orgActorStatusIdx: index("developer_sandbox_runs_org_actor_status_idx").on(
      table.clerkOrgId,
      table.actorUserId,
      table.status
    ),
    expiryIdx: index("developer_sandbox_runs_expiry_idx").on(
      table.status,
      table.expiresAt
    ),
  })
);

export const developerSandboxCommands = mysqlTable(
  "lightfast_developer_sandbox_commands",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),
    publicId: varchar("public_id", { length: PUBLIC_ID_LENGTH })
      .notNull()
      .$defaultFn(createDeveloperSandboxCommandId),
    sandboxRunId: bigint("sandbox_run_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    sandboxRunPublicId: varchar("sandbox_run_public_id", {
      length: PUBLIC_ID_LENGTH,
    }).notNull(),
    clerkOrgId: varchar("clerk_org_id", { length: CLERK_ID_LENGTH }).notNull(),
    actorUserId: varchar("actor_user_id", {
      length: CLERK_ID_LENGTH,
    }).notNull(),
    cmd: text("cmd").notNull(),
    args: json("args").$type<string[]>().notNull(),
    cwd: text("cwd"),
    status: varchar("status", { length: CODE_LENGTH })
      .$type<DeveloperSandboxCommandStatus>()
      .notNull(),
    policyDecision: varchar("policy_decision", { length: CODE_LENGTH })
      .$type<DeveloperSandboxPolicyDecision>()
      .notNull(),
    policyRuleId: varchar("policy_rule_id", { length: PROVIDER_REF_LENGTH }),
    policyReason: text("policy_reason"),
    exitCode: bigint("exit_code", { mode: "number" }),
    stdoutBytes: bigint("stdout_bytes", { mode: "number", unsigned: true }),
    stderrBytes: bigint("stderr_bytes", { mode: "number", unsigned: true }),
    redactionCount: bigint("redaction_count", {
      mode: "number",
      unsigned: true,
    }),
    startedAt: timestamp("started_at", { mode: "date", fsp: 3 }),
    finishedAt: timestamp("finished_at", { mode: "date", fsp: 3 }),
    createdAt: timestamp("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    publicIdUq: uniqueIndex("developer_sandbox_commands_public_id_uq").on(
      table.publicId
    ),
    runStatusIdx: index("developer_sandbox_commands_run_status_idx").on(
      table.sandboxRunId,
      table.status
    ),
    orgActorCreatedIdx: index("developer_sandbox_commands_org_actor_idx").on(
      table.clerkOrgId,
      table.actorUserId,
      table.createdAt
    ),
  })
);

export type DeveloperSandboxRun = typeof developerSandboxRuns.$inferSelect;
export type InsertDeveloperSandboxRun =
  typeof developerSandboxRuns.$inferInsert;
export type DeveloperSandboxCommand =
  typeof developerSandboxCommands.$inferSelect;
export type InsertDeveloperSandboxCommand =
  typeof developerSandboxCommands.$inferInsert;
```

- [ ] **Step 4: Add DB helpers**

Create `db/app/src/utils/developer-sandbox-runs.ts`:

```ts
import { and, eq, inArray, lte } from "drizzle-orm";
import type { Database } from "../client";
import type {
  DeveloperSandboxCommand,
  DeveloperSandboxPolicyDecision,
  DeveloperSandboxRun,
  DeveloperSandboxRunStatus,
} from "../schema";
import { developerSandboxCommands, developerSandboxRuns } from "../schema";
import { getRowsAffected } from "./drizzle-results";

const DEFAULT_SANDBOX_TTL_MS = 15 * 60 * 1000;
const MAX_SANDBOX_TTL_MS = 30 * 60 * 1000;

export function developerSandboxRunExpiresAt(
  now: Date,
  requestedTtlMs = DEFAULT_SANDBOX_TTL_MS
) {
  return new Date(now.getTime() + Math.min(requestedTtlMs, MAX_SANDBOX_TTL_MS));
}

export async function createDeveloperSandboxRun(
  db: Database,
  input: {
    actorUserId: string;
    clerkOrgId: string;
    vercelSandboxId: string;
    workflowRunId?: string | null;
    now: Date;
    requestedTtlMs?: number;
  }
): Promise<DeveloperSandboxRun> {
  const [inserted] = await db
    .insert(developerSandboxRuns)
    .values({
      actorUserId: input.actorUserId,
      clerkOrgId: input.clerkOrgId,
      expiresAt: developerSandboxRunExpiresAt(input.now, input.requestedTtlMs),
      status: "running",
      vercelSandboxId: input.vercelSandboxId,
      workflowRunId: input.workflowRunId ?? null,
    })
    .$returningId();

  if (!inserted?.id) {
    throw new Error("Failed to insert developer sandbox run");
  }

  const row = await getDeveloperSandboxRunById(db, inserted.id);
  if (!row) {
    throw new Error("Failed to load inserted developer sandbox run");
  }
  return row;
}

export async function getDeveloperSandboxRunById(
  db: Database,
  id: number
): Promise<DeveloperSandboxRun | undefined> {
  const [row] = await db
    .select()
    .from(developerSandboxRuns)
    .where(eq(developerSandboxRuns.id, id))
    .limit(1);
  return row;
}

export async function getDeveloperSandboxRunByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<DeveloperSandboxRun | undefined> {
  const [row] = await db
    .select()
    .from(developerSandboxRuns)
    .where(
      and(
        eq(developerSandboxRuns.clerkOrgId, input.clerkOrgId),
        eq(developerSandboxRuns.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export async function markDeveloperSandboxRunCredentialsLoaded(
  db: Database,
  input: { id: number; loadedAt: Date }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(developerSandboxRuns)
    .set({ credentialsLoadedAt: input.loadedAt, updatedAt: input.loadedAt })
    .where(eq(developerSandboxRuns.id, input.id));
  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.id);
}

export async function markDeveloperSandboxRunStopped(
  db: Database,
  input: { id: number; stoppedAt: Date }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(developerSandboxRuns)
    .set({
      status: "stopped",
      stoppedAt: input.stoppedAt,
      updatedAt: input.stoppedAt,
    })
    .where(eq(developerSandboxRuns.id, input.id));
  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.id);
}

export async function markDeveloperSandboxRunExpired(
  db: Database,
  input: {
    id: number;
    expiredAt: Date;
    cleanupFailureCode?: string | null;
  }
): Promise<DeveloperSandboxRun | undefined> {
  const result = await db
    .update(developerSandboxRuns)
    .set({
      cleanupAttemptedAt: input.expiredAt,
      cleanupFailureCode: input.cleanupFailureCode ?? null,
      status: input.cleanupFailureCode ? "failed" : "expired",
      updatedAt: input.expiredAt,
    })
    .where(eq(developerSandboxRuns.id, input.id));
  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxRunById(db, input.id);
}

export async function listExpiredDeveloperSandboxRuns(
  db: Database,
  input: { now: Date; limit: number }
): Promise<DeveloperSandboxRun[]> {
  return await db
    .select()
    .from(developerSandboxRuns)
    .where(
      and(
        inArray(developerSandboxRuns.status, ["created", "running"]),
        lte(developerSandboxRuns.expiresAt, input.now)
      )
    )
    .limit(input.limit);
}

export async function createDeveloperSandboxCommand(
  db: Database,
  input: {
    actorUserId: string;
    args: string[];
    clerkOrgId: string;
    cmd: string;
    cwd?: string | null;
    policyDecision: DeveloperSandboxPolicyDecision;
    policyReason?: string | null;
    policyRuleId?: string | null;
    sandboxRunId: number;
    sandboxRunPublicId: string;
    status: DeveloperSandboxCommand["status"];
  }
): Promise<DeveloperSandboxCommand> {
  const [inserted] = await db
    .insert(developerSandboxCommands)
    .values({
      actorUserId: input.actorUserId,
      args: input.args,
      clerkOrgId: input.clerkOrgId,
      cmd: input.cmd,
      cwd: input.cwd ?? null,
      policyDecision: input.policyDecision,
      policyReason: input.policyReason ?? null,
      policyRuleId: input.policyRuleId ?? null,
      sandboxRunId: input.sandboxRunId,
      sandboxRunPublicId: input.sandboxRunPublicId,
      status: input.status,
    })
    .$returningId();

  if (!inserted?.id) {
    throw new Error("Failed to insert developer sandbox command");
  }

  const row = await getDeveloperSandboxCommandById(db, inserted.id);
  if (!row) {
    throw new Error("Failed to load inserted developer sandbox command");
  }
  return row;
}

export async function getDeveloperSandboxCommandById(
  db: Database,
  id: number
): Promise<DeveloperSandboxCommand | undefined> {
  const [row] = await db
    .select()
    .from(developerSandboxCommands)
    .where(eq(developerSandboxCommands.id, id))
    .limit(1);
  return row;
}

export async function markDeveloperSandboxCommandRunning(
  db: Database,
  input: { id: number; startedAt: Date }
): Promise<DeveloperSandboxCommand | undefined> {
  const result = await db
    .update(developerSandboxCommands)
    .set({
      startedAt: input.startedAt,
      status: "running",
      updatedAt: input.startedAt,
    })
    .where(eq(developerSandboxCommands.id, input.id));
  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxCommandById(db, input.id);
}

export async function markDeveloperSandboxCommandFinished(
  db: Database,
  input: {
    exitCode: number | null;
    finishedAt: Date;
    id: number;
    redactionCount: number;
    status: "completed" | "failed";
    stderrBytes: number;
    stdoutBytes: number;
  }
): Promise<DeveloperSandboxCommand | undefined> {
  const result = await db
    .update(developerSandboxCommands)
    .set({
      exitCode: input.exitCode,
      finishedAt: input.finishedAt,
      redactionCount: input.redactionCount,
      status: input.status,
      stderrBytes: input.stderrBytes,
      stdoutBytes: input.stdoutBytes,
      updatedAt: input.finishedAt,
    })
    .where(eq(developerSandboxCommands.id, input.id));
  if (getRowsAffected(result) === 0) {
    return;
  }
  return await getDeveloperSandboxCommandById(db, input.id);
}
```

- [ ] **Step 5: Export schema and helpers**

Update `db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, and `db/app/src/index.ts` to export the new table objects, id helpers, status types, row types, and utility functions. Keep export members sorted by the repo formatter.

- [ ] **Step 6: Run DB verification**

Run:

```bash
pnpm --filter @db/app test -- developer-sandbox-runs.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/app/src/schema db/app/src/utils/developer-sandbox-runs.ts db/app/src/__tests__/developer-sandbox-runs.test.ts db/app/src/index.ts
git commit -m "feat: add developer sandbox run storage"
```

---

### Task 4: Add Sandbox Lease Listing And Bulk Revocation Helpers

**Files:**
- Modify: `db/app/src/utils/developer-connections.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/__tests__/developer-connections.test.ts`

- [ ] **Step 1: Extend the failing helper test**

In `db/app/src/__tests__/developer-connections.test.ts`, add these expectations to the helper export test:

```ts
import {
  listIssuedDeveloperConnectionLeasesForSandboxRun,
  revokeDeveloperConnectionLeasesForSandboxRun,
} from "../utils/developer-connections";

expect(typeof listIssuedDeveloperConnectionLeasesForSandboxRun).toBe(
  "function"
);
expect(typeof revokeDeveloperConnectionLeasesForSandboxRun).toBe("function");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @db/app test -- developer-connections.test.ts
```

Expected: FAIL because the new helpers are not exported.

- [ ] **Step 3: Implement lease helpers**

In `db/app/src/utils/developer-connections.ts`, add:

```ts
export async function listIssuedDeveloperConnectionLeasesForSandboxRun(
  db: Database,
  input: { clerkOrgId: string; sandboxRunId: string }
): Promise<DeveloperConnectionLease[]> {
  return await db
    .select()
    .from(developerConnectionLeases)
    .where(
      and(
        eq(developerConnectionLeases.clerkOrgId, input.clerkOrgId),
        eq(developerConnectionLeases.sandboxRunId, input.sandboxRunId),
        eq(developerConnectionLeases.status, "issued")
      )
    );
}

export async function revokeDeveloperConnectionLeasesForSandboxRun(
  db: Database,
  input: { clerkOrgId: string; revokedAt: Date; sandboxRunId: string }
) {
  const leases = await listIssuedDeveloperConnectionLeasesForSandboxRun(
    db,
    input
  );

  for (const lease of leases) {
    await revokeDeveloperConnectionLease(db, {
      leaseId: lease.id,
      revokedAt: input.revokedAt,
    });
  }

  return { revoked: leases.length };
}
```

Export both helpers from `db/app/src/index.ts`.

- [ ] **Step 4: Run DB verification**

Run:

```bash
pnpm --filter @db/app test -- developer-connections.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add db/app/src/utils/developer-connections.ts db/app/src/index.ts db/app/src/__tests__/developer-connections.test.ts
git commit -m "feat: add developer connection lease cleanup helpers"
```

---

### Task 5: Add Command Policy And Redaction

**Files:**
- Create: `api/app/src/services/developer-sandbox-runs/policy.ts`
- Create: `api/app/src/services/developer-sandbox-runs/redaction.ts`
- Create: `api/app/src/__tests__/developer-sandbox-policy.test.ts`

- [ ] **Step 1: Write failing policy/redaction tests**

Create `api/app/src/__tests__/developer-sandbox-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  evaluateDeveloperSandboxCommandPolicy,
  normalizeCommandTextForPolicy,
} from "../services/developer-sandbox-runs/policy";
import { redactDeveloperSandboxOutput } from "../services/developer-sandbox-runs/redaction";

describe("developer sandbox command policy", () => {
  it("blocks default CLI auth mutation commands", () => {
    for (const command of [
      { cmd: "pscale", args: ["auth", "login"] },
      { cmd: "pscale", args: ["auth", "logout"] },
      { cmd: "upstash", args: ["auth", "login"] },
      { cmd: "upstash", args: ["auth", "logout"] },
      { cmd: "sentry", args: ["auth", "login"] },
      { cmd: "sentry", args: ["auth", "logout"] },
      { cmd: "clerk", args: ["auth", "login"] },
      { cmd: "clerk", args: ["auth", "logout"] },
    ]) {
      expect(evaluateDeveloperSandboxCommandPolicy(command)).toEqual({
        allowed: false,
        reason: expect.stringContaining("auth/session"),
        ruleId: "lightfast_default_cli_auth_mutation",
      });
    }
  });

  it("detects auth mutation inside shell command text", () => {
    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "bash",
        args: ["-lc", "pnpm test && pscale auth logout"],
      })
    ).toEqual({
      allowed: false,
      reason: expect.stringContaining("auth/session"),
      ruleId: "lightfast_default_cli_auth_mutation",
    });
  });

  it("allows ordinary shell commands and provider resource commands", () => {
    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "bash",
        args: ["-lc", "pnpm test && pscale branch list lightfast"],
      })
    ).toEqual({ allowed: true });
    expect(
      evaluateDeveloperSandboxCommandPolicy({
        cmd: "pscale",
        args: ["database", "delete", "example"],
      })
    ).toEqual({ allowed: true });
  });

  it("normalizes separators for best-effort matching", () => {
    expect(
      normalizeCommandTextForPolicy("pnpm test;\\nclerk auth login")
    ).toContain("clerk auth login");
  });
});

describe("developer sandbox redaction", () => {
  it("redacts non-empty secret values from output", () => {
    expect(
      redactDeveloperSandboxOutput("token=secret-one and secret-two", [
        "secret-one",
        "",
        "secret-two",
      ])
    ).toEqual({
      redactionCount: 2,
      text: "token=[REDACTED] and [REDACTED]",
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- developer-sandbox-policy.test.ts
```

Expected: FAIL because the policy/redaction modules do not exist.

- [ ] **Step 3: Implement policy**

Create `api/app/src/services/developer-sandbox-runs/policy.ts`:

```ts
export interface DeveloperSandboxCommandPolicyInput {
  args?: string[];
  cmd: string;
}

export type DeveloperSandboxCommandPolicyResult =
  | { allowed: true }
  | { allowed: false; reason: string; ruleId: string };

const AUTH_MUTATION_PATTERNS = [
  "pscale auth login",
  "pscale auth logout",
  "upstash auth login",
  "upstash auth logout",
  "sentry auth login",
  "sentry auth logout",
  "clerk auth login",
  "clerk auth logout",
];

export function normalizeCommandTextForPolicy(commandText: string) {
  return commandText
    .toLowerCase()
    .replace(/[;&|]+/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function commandText(input: DeveloperSandboxCommandPolicyInput) {
  const args = input.args ?? [];
  const shellText =
    ["bash", "sh", "zsh", "fish"].includes(input.cmd) &&
    (args.includes("-c") || args.includes("-lc"))
      ? args.at(-1)
      : undefined;
  return shellText ? `${input.cmd} ${shellText}` : [input.cmd, ...args].join(" ");
}

export function evaluateDeveloperSandboxCommandPolicy(
  input: DeveloperSandboxCommandPolicyInput
): DeveloperSandboxCommandPolicyResult {
  const normalized = normalizeCommandTextForPolicy(commandText(input));

  if (AUTH_MUTATION_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return {
      allowed: false,
      reason:
        "Lightfast manages CLI auth/session state inside developer sandboxes.",
      ruleId: "lightfast_default_cli_auth_mutation",
    };
  }

  return { allowed: true };
}
```

- [ ] **Step 4: Implement redaction**

Create `api/app/src/services/developer-sandbox-runs/redaction.ts`:

```ts
export function redactDeveloperSandboxOutput(
  text: string,
  secrets: string[]
): { redactionCount: number; text: string } {
  let redacted = text;
  let redactionCount = 0;

  for (const secret of secrets) {
    if (!secret) {
      continue;
    }
    const occurrences = redacted.split(secret).length - 1;
    if (occurrences === 0) {
      continue;
    }
    redacted = redacted.split(secret).join("[REDACTED]");
    redactionCount += occurrences;
  }

  return { redactionCount, text: redacted };
}
```

- [ ] **Step 5: Verify policy/redaction**

Run:

```bash
pnpm --filter @api/app test -- developer-sandbox-policy.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/src/services/developer-sandbox-runs api/app/src/__tests__/developer-sandbox-policy.test.ts
git commit -m "feat: add developer sandbox command policy"
```

---

### Task 6: Add Developer Connection Materialization For Sandbox Runs

**Files:**
- Modify: `api/app/src/services/developer-connections/leases.ts`
- Modify: `api/app/src/services/developer-connections/index.ts`
- Modify: `api/app/src/__tests__/developer-connections-service.test.ts`

- [ ] **Step 1: Add failing service tests**

In `api/app/src/__tests__/developer-connections-service.test.ts`, import the new function from the existing dynamic import:

```ts
const {
  issueAllEnabledDeveloperConnectionLeases,
  // existing imports...
} = await import("../services/developer-connections");
```

Add this test:

```ts
it("issues leases for all enabled connected developer connections", async () => {
  listCurrentDeveloperConnectionsMock.mockResolvedValue([
    {
      id: 1,
      publicId: "developer_connection_1",
      clerkOrgId: "org_acme",
      provider: "sentry",
      providerAccountName: "lightfast/app",
      providerAccountId: "lightfast/app",
      status: "connected",
      enabledForSandboxes: true,
      credentialKind: "sentry_token",
      credentialSchemaVersion: "1",
      encryptedCredential: 'encrypted:{"token":"sentry-token"}',
      scopes: ["project:read"],
      metadata: {},
      expiresAt: null,
      lastVerifiedAt: null,
      lastUsedAt: null,
      lastUsedByUserId: null,
      createdByUserId: "user_admin",
      updatedByUserId: "user_admin",
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
      updatedAt: new Date("2026-06-03T00:00:00.000Z"),
      revokedAt: null,
    },
    {
      id: 2,
      publicId: "developer_connection_2",
      clerkOrgId: "org_acme",
      provider: "clerk",
      providerAccountName: "clerk/dev",
      providerAccountId: "app_1:dev",
      status: "connected",
      enabledForSandboxes: false,
      credentialKind: "clerk_instance_secret",
      credentialSchemaVersion: "1",
      encryptedCredential: 'encrypted:{"secretKey":"sk_test_disabled"}',
      scopes: ["clerk:instance"],
      metadata: {},
      expiresAt: null,
      lastVerifiedAt: null,
      lastUsedAt: null,
      lastUsedByUserId: null,
      createdByUserId: "user_admin",
      updatedByUserId: "user_admin",
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
      updatedAt: new Date("2026-06-03T00:00:00.000Z"),
      revokedAt: null,
    },
  ]);

  await expect(
    issueAllEnabledDeveloperConnectionLeases(ctx(), {
      sandboxRunId: "developer_sandbox_run_1",
      workflowRunId: "workflow_1",
    })
  ).resolves.toEqual({
    entries: [
      expect.objectContaining({
        lease: expect.objectContaining({ provider: "sentry" }),
        materialization: {
          env: { SENTRY_AUTH_TOKEN: "sentry-token" },
          files: [],
          provider: "sentry",
        },
      }),
    ],
  });
});
```

- [ ] **Step 2: Run service tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- developer-connections-service.test.ts
```

Expected: FAIL because `issueAllEnabledDeveloperConnectionLeases` is not exported.

- [ ] **Step 3: Implement all-enabled lease issuance**

In `api/app/src/services/developer-connections/leases.ts`, add:

```ts
export async function issueAllEnabledDeveloperConnectionLeases(
  ctx: DeveloperConnectionServiceContext,
  input: { sandboxRunId: string; workflowRunId: string }
) {
  const identity = ctx.auth.identity;
  if (identity.type !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const current = await listCurrentDeveloperConnections(ctx.db, {
    clerkOrgId: identity.orgId,
  });
  const enabled = current.filter(
    (connection) =>
      connection.status === "connected" &&
      connection.enabledForSandboxes &&
      connection.encryptedCredential
  );
  const issuedAt = new Date();
  const entries = [];

  for (const connection of enabled) {
    const lease = await issueDeveloperConnectionLease(ctx.db, {
      actorUserId: identity.userId,
      clerkOrgId: identity.orgId,
      connectionId: connection.id,
      issuedAt,
      provider: connection.provider,
      sandboxRunId: input.sandboxRunId,
      workflowRunId: input.workflowRunId,
    });
    const credentialPayload = await decryptDeveloperCredential<
      Record<string, unknown>
    >(connection.encryptedCredential);
    entries.push({
      lease,
      materialization: materializeDeveloperCredential({
        credentialPayload,
        provider: connection.provider,
      }),
    });
  }

  return { entries };
}
```

Export `issueAllEnabledDeveloperConnectionLeases` from `api/app/src/services/developer-connections/index.ts`.

- [ ] **Step 4: Verify service tests**

Run:

```bash
pnpm --filter @api/app test -- developer-connections-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/services/developer-connections api/app/src/__tests__/developer-connections-service.test.ts
git commit -m "feat: issue all enabled developer connection leases"
```

---

### Task 7: Add Developer Sandbox Run Service

**Files:**
- Create: `api/app/src/services/developer-sandbox-runs/index.ts`
- Create: `api/app/src/__tests__/developer-sandbox-runs-service.test.ts`
- Modify: `api/app/package.json`

- [ ] **Step 1: Add the API dependency**

In `api/app/package.json`, add:

```json
"@repo/sandbox-runtime": "workspace:*"
```

- [ ] **Step 2: Write failing service tests**

Create `api/app/src/__tests__/developer-sandbox-runs-service.test.ts`:

```ts
import type { Database } from "@db/app";
import { createInMemorySandboxRuntimeForTests } from "@repo/sandbox-runtime";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createDeveloperSandboxRunMock = vi.fn();
const getDeveloperSandboxRunByPublicIdMock = vi.fn();
const createDeveloperSandboxCommandMock = vi.fn();
const markDeveloperSandboxCommandRunningMock = vi.fn();
const markDeveloperSandboxCommandFinishedMock = vi.fn();
const markDeveloperSandboxRunCredentialsLoadedMock = vi.fn();
const markDeveloperSandboxRunStoppedMock = vi.fn();
const revokeDeveloperConnectionLeasesForSandboxRunMock = vi.fn();
const issueAllEnabledDeveloperConnectionLeasesMock = vi.fn();

vi.mock("@db/app", () => ({
  createDeveloperSandboxCommand: createDeveloperSandboxCommandMock,
  createDeveloperSandboxRun: createDeveloperSandboxRunMock,
  getDeveloperSandboxRunByPublicId: getDeveloperSandboxRunByPublicIdMock,
  markDeveloperSandboxCommandFinished:
    markDeveloperSandboxCommandFinishedMock,
  markDeveloperSandboxCommandRunning: markDeveloperSandboxCommandRunningMock,
  markDeveloperSandboxRunCredentialsLoaded:
    markDeveloperSandboxRunCredentialsLoadedMock,
  markDeveloperSandboxRunStopped: markDeveloperSandboxRunStoppedMock,
  revokeDeveloperConnectionLeasesForSandboxRun:
    revokeDeveloperConnectionLeasesForSandboxRunMock,
}));

vi.mock("../services/developer-connections", () => ({
  issueAllEnabledDeveloperConnectionLeases:
    issueAllEnabledDeveloperConnectionLeasesMock,
}));

const { createDeveloperSandboxRunService } = await import(
  "../services/developer-sandbox-runs"
);

const now = new Date("2026-06-03T00:00:00.000Z");
const runRow = {
  id: 1,
  publicId: "developer_sandbox_run_1",
  clerkOrgId: "org_acme",
  actorUserId: "user_admin",
  workflowRunId: "workflow_1",
  vercelSandboxId: "vercel_sandbox_1",
  status: "running",
  credentialsLoadedAt: null,
  expiresAt: new Date("2026-06-03T00:15:00.000Z"),
  stoppedAt: null,
  cleanupAttemptedAt: null,
  cleanupFailureCode: null,
  createdAt: now,
  updatedAt: now,
};

function ctx() {
  return {
    auth: {
      identity: {
        type: "active" as const,
        userId: "user_admin",
        orgId: "org_acme",
        orgGate: {
          bindingStatus: "bound" as const,
          nextSetupRequirement: null,
        },
      },
    },
  };
}

describe("developer sandbox run service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDeveloperSandboxRunMock.mockResolvedValue(runRow);
    getDeveloperSandboxRunByPublicIdMock.mockResolvedValue(runRow);
    createDeveloperSandboxCommandMock.mockResolvedValue({
      id: 11,
      publicId: "developer_sandbox_command_1",
    });
    markDeveloperSandboxCommandRunningMock.mockResolvedValue({});
    markDeveloperSandboxCommandFinishedMock.mockResolvedValue({});
    markDeveloperSandboxRunCredentialsLoadedMock.mockResolvedValue({
      ...runRow,
      credentialsLoadedAt: now,
    });
    markDeveloperSandboxRunStoppedMock.mockResolvedValue({
      ...runRow,
      status: "stopped",
      stoppedAt: now,
    });
    revokeDeveloperConnectionLeasesForSandboxRunMock.mockResolvedValue({
      revoked: 1,
    });
    issueAllEnabledDeveloperConnectionLeasesMock.mockResolvedValue({
      entries: [
        {
          lease: {
            id: 10,
            publicId: "developer_connection_lease_1",
            provider: "sentry",
          },
          materialization: {
            env: { SENTRY_AUTH_TOKEN: "sentry-secret" },
            files: [
              {
                path: ".sentryclirc",
                contents: "token=sentry-secret",
                mode: "0600",
              },
            ],
            provider: "sentry",
          },
        },
      ],
    });
  });

  it("creates a sandbox run without loading credentials", async () => {
    const runtime = createInMemorySandboxRuntimeForTests();
    const service = createDeveloperSandboxRunService({
      db: {} as Database,
      now: () => now,
      runtime,
    });

    await expect(
      service.createRun(ctx(), { workflowRunId: "workflow_1" })
    ).resolves.toMatchObject({
      publicId: "developer_sandbox_run_1",
      status: "running",
    });

    expect(runtime.calls.create).toHaveLength(1);
    expect(issueAllEnabledDeveloperConnectionLeasesMock).not.toHaveBeenCalled();
  });

  it("loads all enabled credentials on the first allowed command and redacts output", async () => {
    const runtime = createInMemorySandboxRuntimeForTests();
    const service = createDeveloperSandboxRunService({
      db: {} as Database,
      now: () => now,
      runtime,
    });

    await service.createRun(ctx(), { workflowRunId: "workflow_1" });
    const result = await service.runCommand(ctx(), {
      args: ["-lc", "echo sentry-secret"],
      cmd: "bash",
      runId: "developer_sandbox_run_1",
    });

    expect(result).toMatchObject({
      exitCode: 0,
      redactionCount: 0,
      stderr: "",
      stdout: "",
    });
    expect(issueAllEnabledDeveloperConnectionLeasesMock).toHaveBeenCalledWith(
      expect.objectContaining({ db: {} }),
      {
        sandboxRunId: "developer_sandbox_run_1",
        workflowRunId: "workflow_1",
      }
    );
    expect(runtime.calls.writeFiles[0]).toEqual([
      {
        content: "token=sentry-secret",
        mode: 0o600,
        path: "/vercel/sandbox/.lightfast/provider-auth/developer_connection_lease_1/.sentryclirc",
      },
    ]);
    expect(runtime.calls.exec[0]).toMatchObject({
      args: ["-lc", "echo sentry-secret"],
      cmd: "bash",
      env: { SENTRY_AUTH_TOKEN: "sentry-secret" },
    });
  });

  it("rejects policy-denied commands before loading credentials", async () => {
    const runtime = createInMemorySandboxRuntimeForTests();
    const service = createDeveloperSandboxRunService({
      db: {} as Database,
      now: () => now,
      runtime,
    });

    await service.createRun(ctx(), { workflowRunId: "workflow_1" });
    await expect(
      service.runCommand(ctx(), {
        args: ["auth", "login"],
        cmd: "clerk",
        runId: "developer_sandbox_run_1",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(issueAllEnabledDeveloperConnectionLeasesMock).not.toHaveBeenCalled();
    expect(runtime.calls.exec).toEqual([]);
  });

  it("stops a run and revokes all leases", async () => {
    const runtime = createInMemorySandboxRuntimeForTests();
    const service = createDeveloperSandboxRunService({
      db: {} as Database,
      now: () => now,
      runtime,
    });

    await service.stopRun(ctx(), { runId: "developer_sandbox_run_1" });

    expect(revokeDeveloperConnectionLeasesForSandboxRunMock).toHaveBeenCalled();
    expect(runtime.calls.get).toEqual(["vercel_sandbox_1"]);
    expect(runtime.calls.stop).toEqual(["vercel_sandbox_1"]);
    expect(markDeveloperSandboxRunStoppedMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the service tests to verify they fail**

Run:

```bash
pnpm --filter @api/app test -- developer-sandbox-runs-service.test.ts
```

Expected: FAIL because the service does not exist.

- [ ] **Step 4: Implement the service**

Create `api/app/src/services/developer-sandbox-runs/index.ts`:

```ts
import type { Database } from "@db/app";
import {
  createDeveloperSandboxCommand,
  createDeveloperSandboxRun,
  getDeveloperSandboxRunByPublicId,
  listExpiredDeveloperSandboxRuns,
  markDeveloperSandboxCommandFinished,
  markDeveloperSandboxCommandRunning,
  markDeveloperSandboxRunCredentialsLoaded,
  markDeveloperSandboxRunExpired,
  markDeveloperSandboxRunStopped,
  revokeDeveloperConnectionLeasesForSandboxRun,
} from "@db/app";
import type { SandboxRuntime } from "@repo/sandbox-runtime";
import { createVercelSandboxRuntime } from "@repo/sandbox-runtime";
import { TRPCError } from "@trpc/server";
import type { AuthContext } from "../../trpc";
import { issueAllEnabledDeveloperConnectionLeases } from "../developer-connections";
import { evaluateDeveloperSandboxCommandPolicy } from "./policy";
import { redactDeveloperSandboxOutput } from "./redaction";

interface DeveloperSandboxRunContext {
  auth: AuthContext;
}

interface ServiceDeps {
  db: Database;
  now?: () => Date;
  runtime?: SandboxRuntime;
}

function activeIdentity(ctx: DeveloperSandboxRunContext) {
  if (ctx.auth.identity.type !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return ctx.auth.identity;
}

function canUseDeveloperSandboxes(ctx: DeveloperSandboxRunContext) {
  return ctx.auth.identity.type === "active";
}

function materializedFilePath(leasePublicId: string, path: string) {
  const trimmed = path.replace(/^\/+/, "");
  return `/vercel/sandbox/.lightfast/provider-auth/${leasePublicId}/${trimmed}`;
}

export function createDeveloperSandboxRunService(deps: ServiceDeps) {
  const db = deps.db;
  const runtime = deps.runtime ?? createVercelSandboxRuntime();
  const now = deps.now ?? (() => new Date());

  return {
    async createRun(
      ctx: DeveloperSandboxRunContext,
      input: { requestedTtlMs?: number; workflowRunId?: string | null } = {}
    ) {
      const identity = activeIdentity(ctx);
      if (!canUseDeveloperSandboxes(ctx)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const createdAt = now();
      const sandbox = await runtime.create({
        name: `developer-sandbox-${crypto.randomUUID()}`,
        runtime: "node24",
        timeoutMs: input.requestedTtlMs,
      });
      return await createDeveloperSandboxRun(db, {
        actorUserId: identity.userId,
        clerkOrgId: identity.orgId,
        now: createdAt,
        requestedTtlMs: input.requestedTtlMs,
        vercelSandboxId: sandbox.id,
        workflowRunId: input.workflowRunId ?? null,
      });
    },

    async runCommand(
      ctx: DeveloperSandboxRunContext,
      input: {
        args?: string[];
        cmd: string;
        cwd?: string;
        env?: Record<string, string>;
        runId: string;
        timeoutMs?: number;
      }
    ) {
      const identity = activeIdentity(ctx);
      const run = await getDeveloperSandboxRunByPublicId(db, {
        clerkOrgId: identity.orgId,
        publicId: input.runId,
      });
      if (!run || run.actorUserId !== identity.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const policy = evaluateDeveloperSandboxCommandPolicy(input);
      if (!policy.allowed) {
        await createDeveloperSandboxCommand(db, {
          actorUserId: identity.userId,
          args: input.args ?? [],
          clerkOrgId: identity.orgId,
          cmd: input.cmd,
          cwd: input.cwd ?? null,
          policyDecision: "denied",
          policyReason: policy.reason,
          policyRuleId: policy.ruleId,
          sandboxRunId: run.id,
          sandboxRunPublicId: run.publicId,
          status: "denied",
        });
        throw new TRPCError({ code: "FORBIDDEN", message: policy.reason });
      }

      const commandRow = await createDeveloperSandboxCommand(db, {
        actorUserId: identity.userId,
        args: input.args ?? [],
        clerkOrgId: identity.orgId,
        cmd: input.cmd,
        cwd: input.cwd ?? null,
        policyDecision: "allowed",
        sandboxRunId: run.id,
        sandboxRunPublicId: run.publicId,
        status: "pending",
      });

      const sandbox = await runtime.get(run.vercelSandboxId);
      const env: Record<string, string> = { ...(input.env ?? {}) };
      const secrets: string[] = [];

      if (!run.credentialsLoadedAt) {
        const issued = await issueAllEnabledDeveloperConnectionLeases(
          { auth: ctx.auth, db, headers: new Headers() },
          {
            sandboxRunId: run.publicId,
            workflowRunId: run.workflowRunId ?? run.publicId,
          }
        );
        const files = [];
        for (const entry of issued.entries) {
          Object.assign(env, entry.materialization.env);
          secrets.push(...Object.values(entry.materialization.env));
          for (const file of entry.materialization.files) {
            secrets.push(file.contents);
            files.push({
              content: file.contents,
              mode: Number.parseInt(file.mode, 8),
              path: materializedFilePath(entry.lease.publicId, file.path),
            });
          }
        }
        if (files.length > 0) {
          await sandbox.writeFiles(files);
        }
        await markDeveloperSandboxRunCredentialsLoaded(db, {
          id: run.id,
          loadedAt: now(),
        });
      }

      await markDeveloperSandboxCommandRunning(db, {
        id: commandRow.id,
        startedAt: now(),
      });

      const command = await sandbox.exec({
        args: input.args,
        cmd: input.cmd,
        cwd: input.cwd,
        env,
        timeoutMs: input.timeoutMs,
      });
      const [stdoutRaw, stderrRaw, result] = await Promise.all([
        command.stdout(),
        command.stderr(),
        command.wait(),
      ]);
      const stdout = redactDeveloperSandboxOutput(stdoutRaw, secrets);
      const stderr = redactDeveloperSandboxOutput(stderrRaw, secrets);
      const redactionCount = stdout.redactionCount + stderr.redactionCount;
      const status = result.exitCode === 0 ? "completed" : "failed";

      await markDeveloperSandboxCommandFinished(db, {
        exitCode: result.exitCode,
        finishedAt: now(),
        id: commandRow.id,
        redactionCount,
        status,
        stderrBytes: Buffer.byteLength(stderr.text),
        stdoutBytes: Buffer.byteLength(stdout.text),
      });

      return {
        commandId: commandRow.publicId,
        exitCode: result.exitCode,
        redactionCount,
        stderr: stderr.text,
        stdout: stdout.text,
      };
    },

    async stopRun(
      ctx: DeveloperSandboxRunContext,
      input: { runId: string }
    ) {
      const identity = activeIdentity(ctx);
      const run = await getDeveloperSandboxRunByPublicId(db, {
        clerkOrgId: identity.orgId,
        publicId: input.runId,
      });
      if (!run || run.actorUserId !== identity.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await revokeDeveloperConnectionLeasesForSandboxRun(db, {
        clerkOrgId: identity.orgId,
        revokedAt: now(),
        sandboxRunId: run.publicId,
      });
      const sandbox = await runtime.get(run.vercelSandboxId);
      await sandbox.stop();
      return await markDeveloperSandboxRunStopped(db, {
        id: run.id,
        stoppedAt: now(),
      });
    },

    async cleanupExpiredRuns(input: { limit: number }) {
      const expired = await listExpiredDeveloperSandboxRuns(db, {
        limit: input.limit,
        now: now(),
      });
      let cleaned = 0;
      for (const run of expired) {
        let cleanupFailureCode: string | null = null;
        try {
          await revokeDeveloperConnectionLeasesForSandboxRun(db, {
            clerkOrgId: run.clerkOrgId,
            revokedAt: now(),
            sandboxRunId: run.publicId,
          });
          await runtime.destroy(run.vercelSandboxId);
          cleaned += 1;
        } catch {
          cleanupFailureCode = "sandbox_cleanup_failed";
        }
        await markDeveloperSandboxRunExpired(db, {
          cleanupFailureCode,
          expiredAt: now(),
          id: run.id,
        });
      }
      return { cleaned, inspected: expired.length };
    },
  };
}
```

- [ ] **Step 5: Verify the service**

Run:

```bash
pnpm --filter @api/app test -- developer-sandbox-runs-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/app/package.json api/app/src/services/developer-sandbox-runs api/app/src/__tests__/developer-sandbox-runs-service.test.ts
git commit -m "feat: add developer sandbox run service"
```

---

### Task 8: Add Expired Sandbox Run Cleanup Workflow

**Files:**
- Create: `api/app/src/inngest/workflow/cleanup-developer-sandbox-runs.ts`
- Modify: `api/app/src/inngest/index.ts`
- Create: `api/app/src/__tests__/developer-sandbox-cleanup-workflow.test.ts`

- [ ] **Step 1: Write failing workflow test**

Create `api/app/src/__tests__/developer-sandbox-cleanup-workflow.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const cleanupExpiredRunsMock = vi.fn();
const createFunctionMock = vi.fn(
  (config: { id: string }, handler: (input: { step: Step }) => unknown) => {
    cleanupHandler = handler;
    return { id: config.id };
  }
);

type Step = ReturnType<typeof createStep>;
let cleanupHandler: ((input: { step: Step }) => unknown) | undefined;

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("../services/developer-sandbox-runs", () => ({
  createDeveloperSandboxRunService: () => ({
    cleanupExpiredRuns: cleanupExpiredRunsMock,
  }),
}));
vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { cleanupDeveloperSandboxRuns } = await import(
  "../inngest/workflow/cleanup-developer-sandbox-runs"
);

function createStep() {
  return {
    run: vi.fn(<T>(_name: string, fn: () => T | Promise<T>) => fn()),
  };
}

describe("cleanup developer sandbox runs workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupExpiredRunsMock.mockResolvedValue({ cleaned: 1, inspected: 1 });
  });

  it("registers a cron cleanup function", () => {
    expect(cleanupDeveloperSandboxRuns).toEqual({
      id: "cleanup-developer-sandbox-runs",
    });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "cleanup-developer-sandbox-runs",
        retries: 1,
        timeouts: { finish: "2m", start: "1m" },
        triggers: { cron: "*/5 * * * *" },
      },
      expect.any(Function)
    );
  });

  it("cleans expired runs through the service", async () => {
    const step = createStep();
    if (!cleanupHandler) {
      throw new Error("cleanup handler was not registered");
    }

    await expect(cleanupHandler({ step })).resolves.toEqual({
      cleaned: 1,
      inspected: 1,
    });
    expect(cleanupExpiredRunsMock).toHaveBeenCalledWith({ limit: 25 });
  });
});
```

- [ ] **Step 2: Run workflow test to verify it fails**

Run:

```bash
pnpm --filter @api/app test -- developer-sandbox-cleanup-workflow.test.ts
```

Expected: FAIL because the workflow does not exist.

- [ ] **Step 3: Implement workflow**

Create `api/app/src/inngest/workflow/cleanup-developer-sandbox-runs.ts`:

```ts
import { db } from "@db/app/client";
import { createDeveloperSandboxRunService } from "../../services/developer-sandbox-runs";
import { inngest } from "../client";

export const cleanupDeveloperSandboxRuns = inngest.createFunction(
  {
    id: "cleanup-developer-sandbox-runs",
    retries: 1,
    triggers: { cron: "*/5 * * * *" },
    timeouts: {
      finish: "2m",
      start: "1m",
    },
  },
  async ({ step }) =>
    step.run("cleanup expired developer sandbox runs", () =>
      createDeveloperSandboxRunService({ db }).cleanupExpiredRuns({ limit: 25 })
    )
);
```

In `api/app/src/inngest/index.ts`, import and register `cleanupDeveloperSandboxRuns` in the `functions` array.

- [ ] **Step 4: Verify workflow**

Run:

```bash
pnpm --filter @api/app test -- developer-sandbox-cleanup-workflow.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/app/src/inngest api/app/src/__tests__/developer-sandbox-cleanup-workflow.test.ts
git commit -m "feat: add developer sandbox cleanup workflow"
```

---

### Task 9: Add Vercel Sandbox Runtime Smoke Script

**Files:**
- Modify: `api/app/package.json`
- Create: `api/app/scripts/smoke-vercel-sandbox-runtime.ts`

- [ ] **Step 1: Add the smoke script**

Create `api/app/scripts/smoke-vercel-sandbox-runtime.ts`:

```ts
import { createVercelSandboxRuntime } from "@repo/sandbox-runtime";

async function main() {
  if (!process.env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      "VERCEL_OIDC_TOKEN is missing. Run `vercel link && vercel env pull` for apps/app, then run this through `pnpm with-env` from api/app."
    );
  }

  const runtime = createVercelSandboxRuntime();
  const sandbox = await runtime.create({
    name: `lightfast-smoke-${Date.now()}`,
    runtime: "node24",
    timeoutMs: 5 * 60 * 1000,
  });

  try {
    const node = await sandbox.exec({
      cmd: "node",
      args: ["--version"],
      timeoutMs: 30_000,
    });
    const env = await sandbox.exec({
      cmd: "node",
      args: [
        "-e",
        "console.log(process.env.LIGHTFAST_SANDBOX_SMOKE ?? 'missing')",
      ],
      env: { LIGHTFAST_SANDBOX_SMOKE: "ok" },
      timeoutMs: 30_000,
    });
    await sandbox.writeFiles([
      {
        path: "/vercel/sandbox/lightfast-smoke.txt",
        content: "file-ok",
        mode: 0o600,
      },
    ]);
    const file = await sandbox.readFileToBuffer(
      "/vercel/sandbox/lightfast-smoke.txt"
    );

    const result = {
      env: (await env.stdout()).trim(),
      file: file?.toString("utf8"),
      node: (await node.stdout()).trim(),
      sandboxId: sandbox.id,
    };
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await sandbox.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
```

- [ ] **Step 2: Add the package script**

In `api/app/package.json`, add:

```json
"smoke:sandbox-runtime": "pnpm with-env tsx scripts/smoke-vercel-sandbox-runtime.ts"
```

- [ ] **Step 3: Typecheck the script**

Run:

```bash
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the smoke script only when OIDC is present**

Run:

```bash
cd api/app && pnpm smoke:sandbox-runtime
```

Expected when `VERCEL_OIDC_TOKEN` is missing or expired: FAIL with the explicit `vercel link && vercel env pull` message.

Expected when `VERCEL_OIDC_TOKEN` is valid: PASS and print JSON with `env: "ok"`, `file: "file-ok"`, a Node version, and a sandbox id.

- [ ] **Step 5: Commit**

```bash
git add api/app/package.json api/app/scripts/smoke-vercel-sandbox-runtime.ts
git commit -m "feat: add vercel sandbox smoke script"
```

---

### Task 10: Generate Migration And Run Final Verification

**Files:**
- Generate: `db/app/src/migrations/*.sql`
- Generate: `db/app/src/migrations/meta/*.json`
- Modify: `db/app/src/migrations/meta/_journal.json`

- [ ] **Step 1: Generate migration**

Run:

```bash
pnpm db:generate
```

Expected: PASS and a new migration that creates:

- `lightfast_developer_sandbox_runs`
- `lightfast_developer_sandbox_commands`

The generated SQL must have zero foreign keys.

- [ ] **Step 2: Inspect generated migration**

Run:

```bash
git diff -- db/app/src/migrations
```

Expected: only generated migration/snapshot/journal changes. Do not hand-edit SQL.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm --filter @vendor/vercel-sandbox typecheck
pnpm --filter @repo/sandbox-runtime test
pnpm --filter @repo/sandbox-runtime typecheck
pnpm --filter @db/app test -- developer-sandbox-runs.test.ts developer-connections.test.ts
pnpm --filter @db/app typecheck
pnpm --filter @api/app test -- developer-sandbox-policy.test.ts developer-sandbox-runs-service.test.ts developer-sandbox-cleanup-workflow.test.ts developer-connections-service.test.ts
pnpm --filter @api/app typecheck
```

Expected: PASS.

- [ ] **Step 4: Run repo checks**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit migration and final cleanup**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml vendor/vercel-sandbox packages/sandbox-runtime db/app api/app
git commit -m "feat: add vercel sandbox runtime"
```

If previous tasks already committed all source slices, this final commit should include only migration files and any formatter cleanup from `pnpm check`.
