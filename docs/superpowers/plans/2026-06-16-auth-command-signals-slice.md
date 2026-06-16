# Auth Command Signals Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first auth architecture vertical slice by introducing domain command primitives and migrating the app signals list/detail/create path from tRPC to TanStack server functions.

**Architecture:** `api/app` keeps backend ownership while adding a framework-neutral `domain` layer and an explicit TanStack adapter surface. The signals UI consumes typed TanStack server functions through local query helpers, while signal views remain on tRPC for this slice because they are a separate product domain. Once parity tests pass, the migrated signal row/create/detail tRPC procedures are removed.

**Tech Stack:** TypeScript, Zod, TanStack Start server functions, TanStack Query, Vitest, tRPC during migration.

---

## Scope

This plan implements the first vertical slice from
`docs/superpowers/specs/2026-06-16-auth-architecture-redesign-design.md`.

In scope:

- core domain primitives in `api/app/src/domain`,
- signal list, working set, get, and create domain commands,
- TanStack server-function adapter for signals,
- app signal query helpers,
- app UI migration for signals row/detail/create data,
- route prefetch migration for signal rows,
- removal of migrated signal tRPC procedures after parity.

Out of scope:

- signal views migration,
- desktop native RPC,
- CLI RPC,
- `/api/v1` replacement,
- hosted MCP adapter changes,
- connector workspace moves.

## File Structure

- `api/app/src/domain/actor.ts`: resolved `Actor`, `Caller`, and `ExecutionContext` types plus `actorFromAuthIdentity`.
- `api/app/src/domain/errors.ts`: transport-neutral domain error classes and codes.
- `api/app/src/domain/command.ts`: `defineCommand`, `defineCommandSurface`, and `dispatchCommand`.
- `api/app/src/domain/gates.ts`: `requireBoundClerkOrgActor` gate that mirrors current `boundOrgProcedure` semantics.
- `api/app/src/domain/index.ts`: domain barrel for explicit package exports.
- `api/app/src/domain/signals/commands.ts`: signal command schemas and implementations.
- `api/app/src/domain/signals/index.ts`: signal domain exports.
- `api/app/src/adapters/tanstack/signals.ts`: TanStack server functions for signal rows/detail/create.
- `api/app/src/adapters/tanstack/index.ts`: TanStack adapter exports.
- `apps/app/src/signals/signals-queries.ts`: TanStack Query keys/options/mutation helpers for migrated signal operations.
- `apps/app/src/signals/use-classified-signals-query.ts`: consume signal query helpers instead of tRPC.
- `apps/app/src/signals/signal-create-dialog.tsx`: create via server function helper and invalidate signal query keys.
- `apps/app/src/signals/signal-detail-sheet.tsx`: load detail via server function helper.
- `apps/app/src/signals/signals-route-prefetch.ts`: prefetch signal rows via server function helpers and keep signal views tRPC prefetch.
- `apps/app/src/signals/signals-model.ts`: replace migrated tRPC output types with exported signal adapter/domain types.
- `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`: keep `views`; remove migrated row/detail/create procedures after UI migration.
- `api/app/package.json`: add explicit domain and TanStack adapter exports, add TanStack dependency if the adapter can live in `api/app`.
- Tests under `api/app/src/__tests__` and `apps/app/src/__tests__`.

---

### Task 1: Add Domain Core Primitives

**Files:**
- Create: `api/app/src/domain/errors.ts`
- Create: `api/app/src/domain/actor.ts`
- Create: `api/app/src/domain/gates.ts`
- Create: `api/app/src/domain/command.ts`
- Create: `api/app/src/domain/index.ts`
- Create: `api/app/src/__tests__/domain-core.test.ts`
- Modify: `api/app/package.json`

- [ ] **Step 1: Write the failing domain core tests**

Create `api/app/src/__tests__/domain-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import {
  actorFromAuthIdentity,
  defineCommand,
  defineCommandSurface,
  dispatchCommand,
  DomainError,
  requireBoundClerkOrgActor,
} from "../domain";
import { z } from "zod";

const boundIdentity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

describe("actorFromAuthIdentity", () => {
  it("creates a Clerk user actor from an active bound identity", () => {
    expect(actorFromAuthIdentity(boundIdentity, "web")).toEqual({
      kind: "clerkUser",
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_test",
      source: "web",
      userId: "user_test",
    });
  });

  it("rejects pending identities with a domain authz error", () => {
    expect(() =>
      actorFromAuthIdentity({ type: "pending", userId: "user_test" }, "web")
    ).toThrowError(
      expect.objectContaining({
        code: "ORG_REQUIRED",
        kind: "authz",
      })
    );
  });
});

describe("requireBoundClerkOrgActor", () => {
  it("returns the actor when the organization is bound", () => {
    const actor = actorFromAuthIdentity(boundIdentity, "web");
    expect(requireBoundClerkOrgActor({ actor })).toEqual(actor);
  });

  it("rejects unbound organizations", () => {
    const actor = actorFromAuthIdentity(
      {
        ...boundIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      },
      "web"
    );

    expect(() => requireBoundClerkOrgActor({ actor })).toThrowError(
      expect.objectContaining({
        code: "ORG_SETUP_REQUIRED",
        kind: "authz",
      })
    );
  });
});

describe("dispatchCommand", () => {
  it("validates input and output around a command run", async () => {
    const command = defineCommand({
      name: "test.echo",
      input: z.object({ value: z.string() }),
      output: z.object({ value: z.string() }),
      run: async ({ input }) => ({ value: input.value.toUpperCase() }),
    });
    const surface = defineCommandSurface({ "test.echo": command });

    await expect(
      dispatchCommand(surface, {
        command: "test.echo",
        ctx: { actor: actorFromAuthIdentity(boundIdentity, "web") },
        input: { value: "hello" },
      })
    ).resolves.toEqual({ value: "HELLO" });
  });

  it("throws a validation domain error for unknown commands", async () => {
    const surface = defineCommandSurface({});

    await expect(
      dispatchCommand(surface, {
        command: "missing.command",
        ctx: { actor: actorFromAuthIdentity(boundIdentity, "web") },
        input: {},
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "COMMAND_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("uses DomainError as the common error base", () => {
    const error = new DomainError("validation", "INVALID_INPUT", "Invalid input");
    expect(error.kind).toBe("validation");
    expect(error.code).toBe("INVALID_INPUT");
  });
});
```

- [ ] **Step 2: Run the failing domain core tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/domain-core.test.ts
```

Expected: fail because `../domain` does not exist.

- [ ] **Step 3: Add the domain error classes**

Create `api/app/src/domain/errors.ts`:

```ts
export type DomainErrorKind =
  | "authz"
  | "conflict"
  | "internal"
  | "not_found"
  | "validation";

export class DomainError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly kind: DomainErrorKind;

  constructor(
    kind: DomainErrorKind,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "DomainError";
    this.kind = kind;
    this.code = code;
    this.details = details;
  }
}

export class AuthzError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("authz", code, message, details, options);
    this.name = "AuthzError";
  }
}

export class ValidationError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("validation", code, message, details, options);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("not_found", code, message, details, options);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("conflict", code, message, details, options);
    this.name = "ConflictError";
  }
}

export class InternalDomainError extends DomainError {
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    options?: ErrorOptions
  ) {
    super("internal", code, message, details, options);
    this.name = "InternalDomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
```

- [ ] **Step 4: Add actor and execution context types**

Create `api/app/src/domain/actor.ts`:

```ts
import type { AuthIdentity, OrgGate } from "../auth/identity";
import { AuthzError } from "./errors";

export type Actor =
  | {
      kind: "clerkUser";
      orgGate: OrgGate;
      orgId: string;
      orgRole?: string;
      source: "desktop-web" | "web";
      userId: string;
    }
  | {
      client: "cli" | "desktop";
      kind: "nativeClient";
      orgId: string;
      source: "cli" | "desktop-main";
      userId: string;
    }
  | {
      keyId: string;
      kind: "apiKey";
      orgId: string;
      scopes: string[];
    }
  | {
      clientId: string;
      connectionId: string;
      kind: "mcpClient";
      orgId: string;
      scopes: string[];
    }
  | {
      kind: "service";
      service: "apps-mcp" | "inngest" | "qstash" | "system";
    };

export type Caller =
  | { kind: "firstPartyClient"; client: "cli" | "desktop" }
  | { kind: "service"; service: "apps-mcp" | "inngest" | "qstash" };

export interface ExecutionContext {
  actor: Actor;
  caller?: Caller;
  request?: {
    id: string;
    source:
      | "cli-rpc"
      | "desktop-rpc"
      | "job"
      | "mcp"
      | "public-api"
      | "tanstack";
  };
}

export function actorFromAuthIdentity(
  identity: AuthIdentity,
  source: "desktop-web" | "web"
): Actor {
  if (identity.type === "unauthenticated") {
    throw new AuthzError(
      "AUTH_REQUIRED",
      "Authentication required. Please sign in."
    );
  }

  if (identity.type === "pending") {
    throw new AuthzError(
      "ORG_REQUIRED",
      "Organization required. Please create or join an organization first."
    );
  }

  return {
    kind: "clerkUser",
    orgGate: identity.orgGate,
    orgId: identity.orgId,
    source,
    userId: identity.userId,
  };
}
```

- [ ] **Step 5: Add the bound org gate**

Create `api/app/src/domain/gates.ts`:

```ts
import type { Actor, ExecutionContext } from "./actor";
import { AuthzError } from "./errors";

export type BoundClerkOrgActor = Extract<Actor, { kind: "clerkUser" }> & {
  orgId: string;
};

export function requireBoundClerkOrgActor(
  ctx: ExecutionContext
): BoundClerkOrgActor {
  if (ctx.actor.kind !== "clerkUser") {
    throw new AuthzError(
      "CLERK_USER_REQUIRED",
      "A signed-in Lightfast user is required."
    );
  }

  if (ctx.actor.orgGate.bindingStatus !== "bound") {
    throw new AuthzError(
      "ORG_SETUP_REQUIRED",
      "Organization setup required. Complete setup before using Lightfast features.",
      {
        nextSetupRequirement: ctx.actor.orgGate.nextSetupRequirement,
      }
    );
  }

  return ctx.actor;
}
```

- [ ] **Step 6: Add command helpers**

Create `api/app/src/domain/command.ts`:

```ts
import type { z } from "zod";
import type { ExecutionContext } from "./actor";
import { NotFoundError, ValidationError } from "./errors";

export interface CommandRunArgs<
  TInput,
  TOutput,
  TDeps extends Record<string, unknown>,
> {
  ctx: ExecutionContext;
  deps: TDeps;
  input: TInput;
}

export interface CommandDefinition<
  TName extends string,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TDeps extends Record<string, unknown> = Record<string, never>,
> {
  input: TInputSchema;
  name: TName;
  output: TOutputSchema;
  run: (
    args: CommandRunArgs<z.infer<TInputSchema>, z.infer<TOutputSchema>, TDeps>
  ) => Promise<z.infer<TOutputSchema>>;
}

export function defineCommand<
  TName extends string,
  TInputSchema extends z.ZodTypeAny,
  TOutputSchema extends z.ZodTypeAny,
  TDeps extends Record<string, unknown> = Record<string, never>,
>(
  definition: CommandDefinition<TName, TInputSchema, TOutputSchema, TDeps>
): CommandDefinition<TName, TInputSchema, TOutputSchema, TDeps> {
  return definition;
}

export function defineCommandSurface<
  TSurface extends Record<string, CommandDefinition<string, z.ZodTypeAny, z.ZodTypeAny, Record<string, unknown>>>,
>(surface: TSurface): TSurface {
  return surface;
}

export async function dispatchCommand<
  TSurface extends Record<string, CommandDefinition<string, z.ZodTypeAny, z.ZodTypeAny, Record<string, unknown>>>,
  TCommand extends keyof TSurface & string,
>(
  surface: TSurface,
  args: {
    command: TCommand;
    ctx: ExecutionContext;
    deps?: Record<string, unknown>;
    input: unknown;
  }
): Promise<z.infer<TSurface[TCommand]["output"]>> {
  const command = surface[args.command];
  if (!command) {
    throw new NotFoundError(
      "COMMAND_NOT_FOUND",
      `Command ${args.command} was not found.`
    );
  }

  const parsedInput = command.input.safeParse(args.input);
  if (!parsedInput.success) {
    throw new ValidationError("INVALID_COMMAND_INPUT", "Invalid command input.", {
      issues: parsedInput.error.issues,
    });
  }

  const result = await command.run({
    ctx: args.ctx,
    deps: (args.deps ?? {}) as Record<string, unknown>,
    input: parsedInput.data,
  });

  const parsedOutput = command.output.safeParse(result);
  if (!parsedOutput.success) {
    throw new ValidationError(
      "INVALID_COMMAND_OUTPUT",
      "Invalid command output.",
      { issues: parsedOutput.error.issues }
    );
  }

  return parsedOutput.data;
}
```

- [ ] **Step 7: Add the domain barrel and package export**

Create `api/app/src/domain/index.ts`:

```ts
export * from "./actor";
export * from "./command";
export * from "./errors";
export * from "./gates";
```

Modify `api/app/package.json` exports:

```json
"./domain": {
  "types": "./src/domain/index.ts",
  "default": "./src/domain/index.ts"
}
```

- [ ] **Step 8: Run the domain core tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/domain-core.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit domain core primitives**

Run:

```bash
git add api/app/package.json api/app/src/domain api/app/src/__tests__/domain-core.test.ts
git commit -m "feat: add backend domain command primitives"
```

---

### Task 2: Add Signals Domain Commands

**Files:**
- Create: `api/app/src/domain/signals/commands.ts`
- Create: `api/app/src/domain/signals/index.ts`
- Create: `api/app/src/__tests__/signals-domain-commands.test.ts`
- Modify: `api/app/src/domain/index.ts`

- [ ] **Step 1: Write the failing signals command tests**

Create `api/app/src/__tests__/signals-domain-commands.test.ts`:

```ts
import type { Database, Signal } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultSignalCommandDeps,
  createSignalCommand,
  getSignalCommand,
  listProcessingSignalsCommand,
  listWorkingSetSignalsCommand,
} from "../domain/signals";

const listSignalsMock = vi.fn();
const listWorkspaceSignalsMock = vi.fn();
const getVisibleSignalByPublicIdMock = vi.fn();
const listSignalEntityLinksForSignalMock = vi.fn();
const createSignalForActorMock = vi.fn();

vi.mock("@db/app", () => ({
  getVisibleSignalByPublicId: getVisibleSignalByPublicIdMock,
  listSignalEntityLinksForSignal: listSignalEntityLinksForSignalMock,
  listSignals: listSignalsMock,
  listWorkspaceSignals: listWorkspaceSignalsMock,
}));
vi.mock("../signals/service", () => ({
  createSignalForActor: createSignalForActorMock,
}));
vi.mock("../signals/create-signal", () => ({
  isSignalCreateQueueError: (error: unknown) =>
    error instanceof Error && error.name === "SignalCreateQueueError",
}));

const identity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const signalRow: Signal = {
  classification: null,
  classificationMetadata: null,
  clerkOrgId: "org_test",
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  createdByApiKeyId: null,
  createdByMcpClientId: null,
  createdByMcpGrantId: null,
  createdByUserId: "user_test",
  errorCode: null,
  errorMessage: null,
  id: 7,
  input: "Customer asked for migration help",
  publicId: "signal_123e4567-e89b-12d3-a456-426614174000",
  status: "queued",
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
  visibilityScope: "team",
};

function ctx(authIdentity: AuthIdentity = identity) {
  return {
    actor: actorFromAuthIdentity(authIdentity, "web"),
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultSignalCommandDeps({ db: {} as Database });
}

beforeEach(() => {
  listSignalsMock.mockReset();
  listWorkspaceSignalsMock.mockReset();
  getVisibleSignalByPublicIdMock.mockReset();
  listSignalEntityLinksForSignalMock.mockReset();
  createSignalForActorMock.mockReset();
  listSignalsMock.mockResolvedValue({ items: [signalRow], nextCursor: null });
  listWorkspaceSignalsMock.mockResolvedValue({
    items: [],
    limit: 2000,
    totalCount: 0,
    truncated: false,
    windowDays: 30,
  });
  getVisibleSignalByPublicIdMock.mockResolvedValue(signalRow);
  listSignalEntityLinksForSignalMock.mockResolvedValue([]);
  createSignalForActorMock.mockResolvedValue({
    id: signalRow.publicId,
    status: "queued",
    visibilityScope: "user",
  });
});

describe("signal domain commands", () => {
  it("lists processing signals scoped to the bound actor", async () => {
    await expect(
      listProcessingSignalsCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { limit: 10, statuses: ["queued", "processing"] },
      })
    ).resolves.toEqual({ items: [signalRow], nextCursor: null });

    expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      cursor: undefined,
      limit: 10,
      statuses: ["queued", "processing"],
    });
  });

  it("loads the classified working set scoped to the bound actor", async () => {
    await listWorkingSetSignalsCommand.run({
      ctx: ctx(),
      deps: deps(),
      input: {},
    });

    expect(listWorkspaceSignalsMock).toHaveBeenCalledWith(expect.anything(), {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
    });
  });

  it("returns signal detail with entity links", async () => {
    await expect(
      getSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { publicId: signalRow.publicId },
      })
    ).resolves.toEqual({ ...signalRow, entityLinks: [] });

    expect(getVisibleSignalByPublicIdMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_test",
        createdByUserId: "user_test",
        publicId: signalRow.publicId,
      }
    );
  });

  it("throws a domain not found error when detail is invisible", async () => {
    getVisibleSignalByPublicIdMock.mockResolvedValueOnce(null);

    await expect(
      getSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { publicId: signalRow.publicId },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "SIGNAL_NOT_FOUND",
        kind: "not_found",
      })
    );
  });

  it("creates a signal as a web actor", async () => {
    await expect(
      createSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { input: "new signal" },
      })
    ).resolves.toEqual({
      id: signalRow.publicId,
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalForActorMock).toHaveBeenCalledWith(expect.anything(), {
      actor: { kind: "web", orgId: "org_test", userId: "user_test" },
      input: "new signal",
    });
  });

  it("maps queue failures to an internal domain error", async () => {
    const error = new Error("queue failed");
    error.name = "SignalCreateQueueError";
    createSignalForActorMock.mockRejectedValueOnce(error);

    await expect(
      createSignalCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { input: "new signal" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "SIGNAL_QUEUE_FAILED",
        kind: "internal",
      })
    );
  });
});
```

- [ ] **Step 2: Run the failing signals command tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signals-domain-commands.test.ts
```

Expected: fail because `../domain/signals` does not exist.

- [ ] **Step 3: Add signal domain commands**

Create `api/app/src/domain/signals/commands.ts`:

```ts
import {
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
  listSignals,
  listWorkspaceSignals,
  type Database,
} from "@db/app";
import {
  createSignalInput,
  signalIdSchema,
  signalStatusSchema,
} from "@repo/api-contract";
import { z } from "zod";
import { isSignalCreateQueueError } from "../../signals/create-signal";
import { createSignalForActor } from "../../signals/service";
import { defineCommand } from "../command";
import { InternalDomainError, NotFoundError } from "../errors";
import { requireBoundClerkOrgActor } from "../gates";

export type ListProcessingSignalsResult = Awaited<
  ReturnType<typeof listSignals>
>;
export type ListWorkingSetSignalsResult = Awaited<
  ReturnType<typeof listWorkspaceSignals>
>;
export type SignalDetailResult = NonNullable<
  Awaited<ReturnType<typeof getVisibleSignalByPublicId>>
> & {
  entityLinks: Awaited<ReturnType<typeof listSignalEntityLinksForSignal>>;
};

const workspaceListCursorInput = z
  .object({
    createdAt: z.date(),
    id: z.number().int().positive(),
  })
  .optional();

const workspaceListLimitInput = z.number().int().min(1).max(100).default(50);

export const listProcessingSignalsInput = z
  .object({
    cursor: workspaceListCursorInput,
    limit: workspaceListLimitInput,
    statuses: z.array(signalStatusSchema).max(2).optional(),
  })
  .strict();

export const listWorkingSetSignalsInput = z.object({}).strict();

export const getSignalInput = z
  .object({
    publicId: signalIdSchema,
  })
  .strict();

export interface SignalCommandDeps {
  db: Database;
  createSignalForActor: typeof createSignalForActor;
  getVisibleSignalByPublicId: typeof getVisibleSignalByPublicId;
  listSignalEntityLinksForSignal: typeof listSignalEntityLinksForSignal;
  listSignals: typeof listSignals;
  listWorkspaceSignals: typeof listWorkspaceSignals;
}

export function createDefaultSignalCommandDeps(input: {
  db: Database;
}): SignalCommandDeps {
  return {
    db: input.db,
    createSignalForActor,
    getVisibleSignalByPublicId,
    listSignalEntityLinksForSignal,
    listSignals,
    listWorkspaceSignals,
  };
}

export const listProcessingSignalsCommand = defineCommand({
  name: "signals.listProcessing",
  input: listProcessingSignalsInput,
  output: z.custom<ListProcessingSignalsResult>(
    (value) => typeof value === "object" && value !== null
  ),
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listSignals(deps.db, {
      clerkOrgId: actor.orgId,
      createdByUserId: actor.userId,
      cursor: input.cursor,
      limit: input.limit,
      statuses: input.statuses?.length ? input.statuses : undefined,
    });
  },
});

export const listWorkingSetSignalsCommand = defineCommand({
  name: "signals.workingSet",
  input: listWorkingSetSignalsInput,
  output: z.custom<ListWorkingSetSignalsResult>(
    (value) => typeof value === "object" && value !== null
  ),
  run: async ({ ctx, deps }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    return deps.listWorkspaceSignals(deps.db, {
      clerkOrgId: actor.orgId,
      createdByUserId: actor.userId,
    });
  },
});

export const getSignalCommand = defineCommand({
  name: "signals.get",
  input: getSignalInput,
  output: z.custom<SignalDetailResult>(
    (value) => typeof value === "object" && value !== null
  ),
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    const signal = await deps.getVisibleSignalByPublicId(deps.db, {
      clerkOrgId: actor.orgId,
      createdByUserId: actor.userId,
      publicId: input.publicId,
    });

    if (!signal) {
      throw new NotFoundError("SIGNAL_NOT_FOUND", "Signal not found.");
    }

    const entityLinks = await deps.listSignalEntityLinksForSignal(deps.db, {
      clerkOrgId: actor.orgId,
      signalId: signal.publicId,
    });

    return { ...signal, entityLinks };
  },
});

export const createSignalCommand = defineCommand({
  name: "signals.create",
  input: createSignalInput,
  output: z.object({
    id: signalIdSchema,
    status: z.literal("queued"),
    visibilityScope: z.literal("user"),
  }),
  run: async ({ ctx, deps, input }) => {
    const actor = requireBoundClerkOrgActor(ctx);
    try {
      return await deps.createSignalForActor(deps.db, {
        actor: { kind: "web", orgId: actor.orgId, userId: actor.userId },
        input: input.input,
      });
    } catch (error) {
      if (isSignalCreateQueueError(error)) {
        throw new InternalDomainError(
          "SIGNAL_QUEUE_FAILED",
          error.message,
          {},
          { cause: error }
        );
      }
      throw error;
    }
  },
});
```

- [ ] **Step 4: Export signal commands**

Create `api/app/src/domain/signals/index.ts`:

```ts
export * from "./commands";
```

Modify `api/app/src/domain/index.ts`:

```ts
export * from "./actor";
export * from "./command";
export * from "./errors";
export * from "./gates";
export * from "./signals";
```

- [ ] **Step 5: Run the signals command tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/signals-domain-commands.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit signal commands**

Run:

```bash
git add api/app/src/domain api/app/src/__tests__/signals-domain-commands.test.ts
git commit -m "feat: add signal domain commands"
```

---

### Task 3: Prove TanStack Server Functions Can Live In `api/app`

**Files:**
- Create: `api/app/src/adapters/tanstack/signals.ts`
- Create: `api/app/src/adapters/tanstack/index.ts`
- Create: `apps/app/src/__tests__/signals-tanstack-adapter-source.test.ts`
- Modify: `api/app/package.json`

- [ ] **Step 1: Write a source test for the intended import boundary**

Create `apps/app/src/__tests__/signals-tanstack-adapter-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../../../..");

describe("signals TanStack adapter boundary", () => {
  it("exports signal server functions from @api/app", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(repoRoot, "api/app/package.json"), "utf8")
    ) as { exports?: Record<string, unknown> };

    expect(packageJson.exports).toHaveProperty("./tanstack/signals");
  });

  it("defines signal server functions in the api/app adapter layer", () => {
    const source = readFileSync(
      resolve(repoRoot, "api/app/src/adapters/tanstack/signals.ts"),
      "utf8"
    );

    expect(source).toContain('from "@tanstack/react-start"');
    expect(source).toContain("createServerFn");
    expect(source).toContain("createSignalCommand");
    expect(source).not.toContain("TRPCError");
    expect(source).not.toContain("ORPCError");
  });
});
```

- [ ] **Step 2: Run the failing source test**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-tanstack-adapter-source.test.ts
```

Expected: fail because the adapter and export do not exist.

- [ ] **Step 3: Add the TanStack dependency and package exports**

Modify `api/app/package.json` dependencies:

```json
"@tanstack/react-start": "catalog:"
```

Modify `api/app/package.json` exports:

```json
"./tanstack": {
  "types": "./src/adapters/tanstack/index.ts",
  "default": "./src/adapters/tanstack/index.ts"
},
"./tanstack/signals": {
  "types": "./src/adapters/tanstack/signals.ts",
  "default": "./src/adapters/tanstack/signals.ts"
}
```

- [ ] **Step 4: Add the TanStack signal adapter**

Create `api/app/src/adapters/tanstack/signals.ts`:

```ts
import { db } from "@db/app/client";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { resolveAuthContextFromClerk } from "../../auth/identity";
import { actorFromAuthIdentity, isDomainError } from "../../domain";
import {
  createDefaultSignalCommandDeps,
  createSignalCommand,
  getSignalCommand,
  listProcessingSignalsCommand,
  listProcessingSignalsInput,
  listWorkingSetSignalsCommand,
} from "../../domain/signals";

function requestId() {
  return crypto.randomUUID();
}

async function createTanStackSignalContext() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  return {
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" as const },
  };
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    throw new Error(error.message, { cause: error });
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
}

export const listProcessingSignals = createServerFn({ method: "GET" })
  .inputValidator(listProcessingSignalsInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await listProcessingSignalsCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: createDefaultSignalCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const listWorkingSetSignals = createServerFn({ method: "GET" }).handler(
  async () => {
    noStore();
    try {
      return await listWorkingSetSignalsCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: createDefaultSignalCommandDeps({ db }),
        input: {},
      });
    } catch (error) {
      mapTanStackError(error);
    }
  }
);

export const getSignal = createServerFn({ method: "GET" })
  .inputValidator(getSignalCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await getSignalCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: createDefaultSignalCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const createSignal = createServerFn({ method: "POST" })
  .inputValidator(createSignalCommand.input)
  .handler(async ({ data }) => {
    noStore();
    try {
      return await createSignalCommand.run({
        ctx: await createTanStackSignalContext(),
        deps: createDefaultSignalCommandDeps({ db }),
        input: data,
      });
    } catch (error) {
      mapTanStackError(error);
    }
  });

export type ListProcessingSignalsResult = Awaited<
  ReturnType<typeof listProcessingSignals>
>;
export type ListWorkingSetSignalsResult = Awaited<
  ReturnType<typeof listWorkingSetSignals>
>;
export type SignalDetailResult = Awaited<ReturnType<typeof getSignal>>;
export type CreateSignalResult = Awaited<ReturnType<typeof createSignal>>;
```

Create `api/app/src/adapters/tanstack/index.ts`:

```ts
export * from "./signals";
```

- [ ] **Step 5: Run the adapter source test**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-tanstack-adapter-source.test.ts
```

Expected: pass.

- [ ] **Step 6: Run typecheck to prove the adapter can be imported**

Run:

```bash
pnpm --filter @api/app typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: both pass. If either command fails because TanStack Start cannot transform `createServerFn` from `api/app`, keep this task's tests and exports, then move only the physical `createServerFn` wrappers into `apps/app/src/signals/signals.functions.ts` while preserving all command execution in `api/app`. The wrapper must import commands from `@api/app/domain/signals` and must stay under 120 lines.

- [ ] **Step 7: Commit TanStack adapter spike**

Run:

```bash
git add api/app/package.json api/app/src/adapters/tanstack apps/app/src/__tests__/signals-tanstack-adapter-source.test.ts
git commit -m "feat: expose signal tanstack adapter"
```

---

### Task 4: Add App Signal Query Helpers

**Files:**
- Create: `apps/app/src/signals/signals-queries.ts`
- Create: `apps/app/src/__tests__/signals-queries-source.test.ts`

- [ ] **Step 1: Write the failing query helper source test**

Create `apps/app/src/__tests__/signals-queries-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

describe("signals query helpers", () => {
  it("centralizes migrated signal query keys and server function calls", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/signals-queries.ts"),
      "utf8"
    );

    expect(source).toContain('@api/app/tanstack/signals"');
    expect(source).toContain("signalQueryKeys");
    expect(source).toContain("workingSetSignalsQueryOptions");
    expect(source).toContain("processingSignalsQueryOptions");
    expect(source).toContain("signalDetailQueryOptions");
    expect(source).toContain("createSignalMutationOptions");
    expect(source).not.toContain("useTRPC");
  });
});
```

- [ ] **Step 2: Run the failing query helper source test**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-queries-source.test.ts
```

Expected: fail because `signals-queries.ts` does not exist.

- [ ] **Step 3: Add query helpers**

Create `apps/app/src/signals/signals-queries.ts`:

```ts
import {
  createSignal,
  getSignal,
  listProcessingSignals,
  listWorkingSetSignals,
  type SignalDetailResult,
  type ListProcessingSignalsResult,
  type ListWorkingSetSignalsResult,
} from "@api/app/tanstack/signals";
import {
  keepPreviousData,
  queryOptions,
  type QueryClient,
} from "@tanstack/react-query";
import {
  PROCESSING_SIGNALS_LIMIT,
  signalProcessingStatuses,
} from "./signals-model";

const WORKING_SET_REFETCH_MS = 30_000;
const PROCESSING_REFETCH_MS = 5000;

export type ProcessingSignalsResult = ListProcessingSignalsResult;
export type WorkingSetSignalsResult = ListWorkingSetSignalsResult;
export type SignalDetailQueryResult = SignalDetailResult;

export const signalQueryKeys = {
  all: ["signals"] as const,
  detail: (publicId: string) => ["signals", "detail", publicId] as const,
  processing: () =>
    [
      "signals",
      "processing",
      { limit: PROCESSING_SIGNALS_LIMIT, statuses: signalProcessingStatuses },
    ] as const,
  workingSet: () => ["signals", "working-set"] as const,
};

export function workingSetSignalsQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    placeholderData: keepPreviousData,
    queryFn: () => listWorkingSetSignals(),
    queryKey: signalQueryKeys.workingSet(),
    refetchInterval: WORKING_SET_REFETCH_MS,
    staleTime: WORKING_SET_REFETCH_MS,
  });
}

export function processingSignalsQueryOptions() {
  return queryOptions({
    enabled: typeof window !== "undefined",
    placeholderData: keepPreviousData,
    queryFn: () =>
      listProcessingSignals({
        data: {
          limit: PROCESSING_SIGNALS_LIMIT,
          statuses: [...signalProcessingStatuses],
        },
      }),
    queryKey: signalQueryKeys.processing(),
    refetchInterval: PROCESSING_REFETCH_MS,
    staleTime: PROCESSING_REFETCH_MS,
  });
}

export function signalDetailQueryOptions(input: {
  enabled: boolean;
  publicId: string;
}) {
  return queryOptions({
    enabled: typeof window !== "undefined" && input.enabled,
    queryFn: () => getSignal({ data: { publicId: input.publicId } }),
    queryKey: signalQueryKeys.detail(input.publicId),
  });
}

export function createSignalMutationOptions(input: {
  draftStorageKey: string;
  onClose: () => void;
  onCreateMore: () => void;
  queryClient: QueryClient;
  removeDraft: (storageKey: string) => void;
  resetInput: () => void;
  shouldCreateMore: () => boolean;
  toastSuccess: () => void;
}) {
  return {
    meta: { errorTitle: "Failed to create signal" },
    mutationFn: (data: { input: string }) => createSignal({ data }),
    onSuccess: () => {
      input.removeDraft(input.draftStorageKey);
      void input.queryClient.invalidateQueries({
        queryKey: signalQueryKeys.workingSet(),
      });
      void input.queryClient.invalidateQueries({
        queryKey: signalQueryKeys.processing(),
      });
      input.toastSuccess();
      input.resetInput();
      if (input.shouldCreateMore()) {
        input.onCreateMore();
        return;
      }
      input.onClose();
    },
  };
}
```

- [ ] **Step 4: Run the query helper source test**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-queries-source.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit signal query helpers**

Run:

```bash
git add apps/app/src/signals/signals-queries.ts apps/app/src/__tests__/signals-queries-source.test.ts
git commit -m "feat: add signal server function query helpers"
```

---

### Task 5: Migrate Signal UI Reads And Create Mutation

**Files:**
- Modify: `apps/app/src/signals/signals-model.ts`
- Modify: `apps/app/src/signals/use-classified-signals-query.ts`
- Modify: `apps/app/src/signals/signal-detail-sheet.tsx`
- Modify: `apps/app/src/signals/signal-create-dialog.tsx`
- Modify: `apps/app/src/signals/signals-route-prefetch.ts`
- Create: `apps/app/src/__tests__/signals-no-trpc-source.test.ts`

- [ ] **Step 1: Write a source test that blocks tRPC in migrated signal files**

Create `apps/app/src/__tests__/signals-no-trpc-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

const migratedFiles = [
  "src/signals/use-classified-signals-query.ts",
  "src/signals/signal-detail-sheet.tsx",
  "src/signals/signal-create-dialog.tsx",
] as const;

describe("migrated signal UI data access", () => {
  it("does not use tRPC for migrated signal rows, detail, or create", () => {
    for (const file of migratedFiles) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toContain("useTRPC");
      expect(source, file).not.toContain("trpc.org.workspace.signals");
    }
  });

  it("allows signal views to stay on tRPC in this slice", () => {
    const source = readFileSync(
      resolve(appRoot, "src/signals/use-signal-views-query.ts"),
      "utf8"
    );
    expect(source).toContain("useTRPC");
    expect(source).toContain("trpc.org.workspace.signals.views");
  });
});
```

- [ ] **Step 2: Run the failing source test**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-no-trpc-source.test.ts
```

Expected: fail because the migrated files still import and use tRPC.

- [ ] **Step 3: Update signal model result types**

Modify the top of `apps/app/src/signals/signals-model.ts`:

```ts
import type {
  ProcessingSignalsResult,
  SignalDetailQueryResult,
  WorkingSetSignalsResult,
} from "./signals-queries";

/** Full row from the cursor `list` query (processing path) — carries body fields. */
export type SignalList = ProcessingSignalsResult;
export type SignalRow = SignalList["items"][number];

/** Projected working-set row (classified, no body). */
export type WorkspaceSignals = WorkingSetSignalsResult;
export type WorkspaceSignalRow = WorkspaceSignals["items"][number];

/** Full row from `get` — used for the detail body. */
export type SignalDetailRow = SignalDetailQueryResult;
```

Keep the rest of `signals-model.ts` unchanged.

- [ ] **Step 4: Update working set and processing queries**

Modify `apps/app/src/signals/use-classified-signals-query.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import {
  processingSignalsQueryOptions,
  workingSetSignalsQueryOptions,
} from "./signals-queries";

/**
 * Bounded, projected classified working set — fetched once, unfiltered. Filters
 * never enter the query key, so toggling a filter triggers no network request.
 * A fixed 30s interval surfaces newly-classified signals.
 */
export function useWorkingSetQuery() {
  const options = workingSetSignalsQueryOptions();
  return { query: useQuery(options), queryKey: options.queryKey };
}

/**
 * Small `queued`/`processing` query, single page, polled every 5s. No
 * classification filters (those rows are not classified yet).
 */
export function useProcessingSignalsQuery() {
  const options = processingSignalsQueryOptions();
  return { query: useQuery(options), queryKey: options.queryKey };
}
```

- [ ] **Step 5: Update signal detail loading**

Modify the data-loading part of `apps/app/src/signals/signal-detail-sheet.tsx`:

```ts
import { signalDetailQueryOptions } from "./signals-queries";
```

Remove:

```ts
import { useTRPC } from "~/trpc/react";
```

Inside `SignalDetailSheet`, remove:

```ts
const trpc = useTRPC();
```

Replace the `useQuery(...)` call with:

```ts
const query = useQuery(
  signalDetailQueryOptions({
    enabled: open && !hasBody && Boolean(publicId),
    publicId: publicId ?? "",
  })
);
```

- [ ] **Step 6: Update create signal mutation**

Modify imports in `apps/app/src/signals/signal-create-dialog.tsx`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { createSignalMutationOptions } from "./signals-queries";
```

Keep `useTRPC` only for `viewer.organization.listUserOrganizations` in this
slice. Replace the `createMutation` block with:

```ts
const createMutation = useMutation(
  createSignalMutationOptions({
    draftStorageKey,
    onClose: () => onOpenChange(false),
    onCreateMore: () =>
      requestAnimationFrame(() => textareaRef.current?.focus()),
    queryClient,
    removeDraft: removeSignalDraft,
    resetInput: () => setInput(""),
    shouldCreateMore: () => createMore,
    toastSuccess: () =>
      toast.success("Signal queued", {
        description: "Classification will start shortly.",
      }),
  })
);
```

Leave the organization query on tRPC:

```ts
const { data: organizations = [] } = useQuery({
  ...trpc.viewer.organization.listUserOrganizations.queryOptions(),
  enabled: open && typeof window !== "undefined",
  staleTime: 5 * 60 * 1000,
});
```

- [ ] **Step 7: Update route prefetch for migrated signal rows**

Modify `apps/app/src/signals/signals-route-prefetch.ts`:

```ts
import type { RoutePrefetchContext } from "~/trpc/route-prefetch-types";
import {
  processingSignalsQueryOptions,
  workingSetSignalsQueryOptions,
} from "./signals-queries";

export async function prefetchSignalsRoute({
  queryClient,
  trpc,
}: RoutePrefetchContext) {
  await Promise.all([
    queryClient.fetchQuery({
      ...workingSetSignalsQueryOptions(),
      staleTime: 30_000,
    }),
    queryClient.fetchQuery({
      ...processingSignalsQueryOptions(),
      staleTime: 5000,
    }),
    queryClient.fetchQuery({
      ...trpc.org.workspace.signals.views.list.queryOptions(),
      staleTime: 60_000,
    }),
  ]);
}
```

- [ ] **Step 8: Run app signal tests**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-no-trpc-source.test.ts src/__tests__/signals-queries-source.test.ts src/__tests__/signals-signals-model.test.ts src/__tests__/signals-signals-views-model.test.ts
```

Expected: pass.

- [ ] **Step 9: Run app typecheck**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: pass.

- [ ] **Step 10: Commit UI migration**

Run:

```bash
git add apps/app/src/signals apps/app/src/__tests__/signals-no-trpc-source.test.ts
git commit -m "feat: migrate signals ui to server functions"
```

---

### Task 6: Remove Migrated Signal tRPC Procedures

**Files:**
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-signals.ts`
- Modify: `api/app/src/__tests__/workspace-signals-router.test.ts`
- Create: `api/app/src/__tests__/workspace-signals-router-source.test.ts`

- [ ] **Step 1: Write a source test that keeps only signal views on tRPC**

Create `api/app/src/__tests__/workspace-signals-router-source.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(import.meta.dirname, "..");

describe("workspace signals tRPC router", () => {
  it("keeps only signal views after the signal row migration", () => {
    const source = readFileSync(
      resolve(apiRoot, "router/(pending-not-allowed)/workspace-signals.ts"),
      "utf8"
    );

    expect(source).toContain("views: workspaceSignalViewsRouter");
    expect(source).not.toContain("listSignals(");
    expect(source).not.toContain("listWorkspaceSignals(");
    expect(source).not.toContain("getVisibleSignalByPublicId(");
    expect(source).not.toContain("createSignalForActor(");
  });
});
```

- [ ] **Step 2: Run the failing source test**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router-source.test.ts
```

Expected: fail because the router still has migrated procedures.

- [ ] **Step 3: Collapse `workspace-signals.ts` to the views subrouter**

Replace `api/app/src/router/(pending-not-allowed)/workspace-signals.ts` with:

```ts
import type { TRPCRouterRecord } from "@trpc/server";

import { workspaceSignalViewsRouter } from "./workspace-signal-views";

export const workspaceSignalsRouter = {
  views: workspaceSignalViewsRouter,
} satisfies TRPCRouterRecord;
```

- [ ] **Step 4: Replace router tests with source coverage**

Delete signal row/create/detail assertions from
`api/app/src/__tests__/workspace-signals-router.test.ts`. Leave no empty test
file behind. The migrated behavior is now covered by:

- `api/app/src/__tests__/signals-domain-commands.test.ts`
- `apps/app/src/__tests__/signals-no-trpc-source.test.ts`
- `apps/app/src/__tests__/signals-signals-model.test.ts`

If the file contains only migrated procedure tests, delete
`api/app/src/__tests__/workspace-signals-router.test.ts`.

- [ ] **Step 5: Run API tests**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/workspace-signals-router-source.test.ts src/__tests__/signals-domain-commands.test.ts src/__tests__/workspace-signal-views-router.test.ts
```

Expected: pass.

- [ ] **Step 6: Run API typecheck**

Run:

```bash
pnpm --filter @api/app typecheck
```

Expected: pass.

- [ ] **Step 7: Commit tRPC signal procedure removal**

Run:

```bash
git add api/app/src/router/'(pending-not-allowed)'/workspace-signals.ts api/app/src/__tests__
git commit -m "refactor: remove migrated signal trpc procedures"
```

---

### Task 7: Verify The First Slice End To End

**Files:**
- No source edits expected.

- [ ] **Step 1: Run focused API verification**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/domain-core.test.ts src/__tests__/signals-domain-commands.test.ts src/__tests__/workspace-signals-router-source.test.ts src/__tests__/workspace-signal-views-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: all pass.

- [ ] **Step 2: Run focused app verification**

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/signals-tanstack-adapter-source.test.ts src/__tests__/signals-queries-source.test.ts src/__tests__/signals-no-trpc-source.test.ts src/__tests__/signals-signals-model.test.ts src/__tests__/signals-signals-views-model.test.ts
pnpm --filter @lightfast/app typecheck
```

Expected: all pass.

- [ ] **Step 3: Run Knip if configured in the repo**

Run:

```bash
pnpm exec knip
```

Expected: either pass or report existing unrelated drift. If Knip reports stale
exports introduced by this slice, remove those exports in the same task before
committing.

- [ ] **Step 4: Inspect git status**

Run:

```bash
git status --short
```

Expected: clean after the task commits, or only intentional uncommitted notes.

---

## Follow-Up Plans

Write these as separate plans after this slice lands:

1. Signal views TanStack migration.
2. Desktop credential-blind IPC plus `/api/desktop/rpc`.
3. CLI `/api/cli/rpc`.
4. `/api/v1` explicit public API route and contract replacement for signals.
5. Hosted MCP internal command surface cleanup.
6. Connector workspace extraction.

## Self-Review Notes

- This plan implements the design spec's first vertical slice only.
- It proves `Actor`, `ExecutionContext`, domain errors, command definitions,
  explicit command surfaces, and TanStack server functions.
- It leaves public API, desktop RPC, CLI RPC, MCP, and connector workspace work
  for later plans because each can ship independently after the command spine is
  proven.
- Signal views remain on tRPC in this plan by design, and source tests document
  that boundary.
