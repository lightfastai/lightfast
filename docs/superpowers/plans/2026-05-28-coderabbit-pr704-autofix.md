# CodeRabbit PR 704 Autofix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the actionable CodeRabbit PR #704 feedback, excluding the CLI dependency/import packaging change.

**Architecture:** Keep fixes scoped to the reviewed surfaces: tRPC auth-boundary tests, origin/env safety, Inngest workflow configuration, automation scheduling correctness, DB search semantics, app-validation schemas, and route-level UX boundaries. Use focused unit tests for each behavior before implementation, then run package-level validation before repo-wide checks.

**Tech Stack:** TypeScript, pnpm, Vitest, tRPC, Drizzle ORM, Inngest v4, Next.js App Router, Zod, `@vercel/related-projects`.

---

## Out Of Scope

- Do not change `core/cli/package.json` or move CLI imports between `dependencies` and `devDependencies`.
- Do not resolve CodeRabbit threads or post PR comments from this plan. That belongs to the autofix execution flow after implementation and validation.

## File Map

- Modify `api/app/src/__tests__/automations-router.test.ts`: add route-level auth-boundary coverage for list/create/runNow and non-call assertions.
- Modify `api/app/src/__tests__/workspace-people-router.test.ts`: add auth-boundary coverage for list and identity-org scoping.
- Modify `api/app/src/__tests__/workspace-signals-router.test.ts`: add auth-boundary coverage for list and identity-org scoping.
- Modify `api/app/src/origins.ts`: fail fast in local/dev when required local origin env vars are missing.
- Create `api/app/src/__tests__/origins.test.ts`: verify local fail-fast and production fallback behavior.
- Modify `api/platform/src/origins.ts`: fail fast in local/dev when required local origin env vars are missing.
- Create `api/platform/src/__tests__/origins.test.ts`: verify local fail-fast and production fallback behavior.
- Modify `api/app/src/inngest/workflow/automation-scheduler.ts`: add retries and cron idempotency.
- Create or modify `api/app/src/__tests__/automation-scheduler-workflow.test.ts`: lock function config and queued-event behavior.
- Modify `api/platform/src/inngest/client.ts`: restore a typed platform event surface compatible with current Inngest v4 APIs or document why the empty platform event map has no runtime schema registration.
- Modify `api/platform/src/inngest/workflow/system-health.ts`: add retries, idempotency, and explicit heartbeat semantics.
- Modify `api/platform/src/__tests__/system-health-workflow.test.ts`: update expected function config.
- Modify `db/app/README.md`: clarify `db:migrate` is staging-only with explicit migration credentials.
- Modify `db/app/src/env.ts`: remove redundant `DATABASE_*` runtime mapping and rely on `vendorDbEnv`.
- Modify `db/app/src/utils/automations.ts`: add timezone-aware daily scheduling and prevent failed-state regression for terminal runs.
- Modify `db/app/src/__tests__/automations.test.ts`: cover timezone scheduling, DST, and terminal failure guards.
- Modify `db/app/src/utils/people.ts`: escape user LIKE wildcards.
- Modify `db/app/src/__tests__/people.test.ts`: cover literal `%`, `_`, and `\` search input.
- Modify `packages/app-validation/src/schemas/automations.ts`: validate IANA time zones and format deleted automations explicitly.
- Modify `packages/app-validation/src/__tests__/automations.test.ts`: cover timezone validation and deleted schedule labels.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/loading.tsx`: route-level loading boundary.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/error.tsx`: route-level error boundary.

---

### Task 1: Add tRPC Auth-Boundary Tests

**Files:**
- Modify: `api/app/src/__tests__/automations-router.test.ts`
- Modify: `api/app/src/__tests__/workspace-people-router.test.ts`
- Modify: `api/app/src/__tests__/workspace-signals-router.test.ts`

- [ ] **Step 1: Add negative caller helpers to automations router tests**

Add these helpers near the existing `caller()` helper in `api/app/src/__tests__/automations-router.test.ts`:

```ts
const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_current",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function activeIdentityWithOrgGate(
  bindingStatus: "bound" | "unbound" | "revoked"
): AuthIdentity {
  return {
    ...activeIdentity,
    orgGate: { bindingStatus },
  };
}

function adminAccessForOrg(orgId: string) {
  return {
    ...adminAccess(),
    orgId,
  };
}

function callerWithIdentity(
  identity: AuthIdentity,
  access = adminAccess()
) {
  return createCaller({
    auth: { identity, access },
    db: {} as Database,
    headers: new Headers(),
  });
}
```

- [ ] **Step 2: Write failing automations auth-boundary tests**

Add these tests under `describe("automationsRouter", ...)`:

```ts
it("rejects list when no active org is selected", async () => {
  await expect(
    callerWithIdentity(pendingIdentity).automations.list()
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  expect(listAutomationsMock).not.toHaveBeenCalled();
});

it("rejects list for unbound and revoked organizations", async () => {
  await expect(
    callerWithIdentity(activeIdentityWithOrgGate("unbound")).automations.list()
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    callerWithIdentity(activeIdentityWithOrgGate("revoked")).automations.list()
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  expect(listAutomationsMock).not.toHaveBeenCalled();
});

it("rejects create when the auth identity is unauthenticated", async () => {
  await expect(
    callerWithIdentity(unauthenticatedIdentity).automations.create({
      name: "Morning check",
      prompt: "Check the workspace",
      schedule: { kind: "hourly", config: { intervalHours: 1 } },
    })
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

  expect(createAutomationMock).not.toHaveBeenCalled();
});

it("rejects create when Clerk session access belongs to another org", async () => {
  await expect(
    caller(adminAccessForOrg("org_other")).automations.create({
      name: "Morning check",
      prompt: "Check the workspace",
      schedule: { kind: "hourly", config: { intervalHours: 1 } },
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  expect(createAutomationMock).not.toHaveBeenCalled();
});

it("rejects manual runs before hitting DB when no active org is selected", async () => {
  await expect(
    callerWithIdentity(pendingIdentity).automations.runNow({
      id: automation.publicId,
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });

  expect(getAutomationByPublicIdMock).not.toHaveBeenCalled();
  expect(createAutomationRunMock).not.toHaveBeenCalled();
  expect(sendMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the failing automations tests**

Run:

```bash
pnpm --filter @api/app test -- automations-router.test.ts
```

Expected: any missing helper or assertion mismatch fails before implementation adjustments.

- [ ] **Step 4: Add people router auth-boundary tests**

Add these helpers and tests in `api/app/src/__tests__/workspace-people-router.test.ts`:

```ts
const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function activeIdentityForOrg(orgId: string): AuthIdentity {
  return {
    ...activeIdentity,
    orgId,
  };
}

it("rejects when no active org is selected", async () => {
  await expect(caller(pendingIdentity).people.list({})).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(listPeopleMock).not.toHaveBeenCalled();
});

it("rejects unauthenticated callers", async () => {
  await expect(
    caller(unauthenticatedIdentity).people.list({})
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(listPeopleMock).not.toHaveBeenCalled();
});

it("rejects revoked organizations", async () => {
  await expect(
    caller({
      ...activeIdentity,
      orgGate: { bindingStatus: "revoked" },
    }).people.list({})
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(listPeopleMock).not.toHaveBeenCalled();
});

it("scopes list queries to the authenticated organization", async () => {
  await expect(caller(activeIdentityForOrg("org_other")).people.list({}))
    .resolves.toMatchObject({ items: [personRow] });

  expect(listPeopleMock).toHaveBeenCalledWith(expect.anything(), {
    clerkOrgId: "org_other",
    cursor: undefined,
    limit: undefined,
    search: undefined,
  });
});
```

- [ ] **Step 5: Add signals router auth-boundary tests**

Add the same helper shape and these tests in `api/app/src/__tests__/workspace-signals-router.test.ts`:

```ts
const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function activeIdentityForOrg(orgId: string): AuthIdentity {
  return {
    ...activeIdentity,
    orgId,
  };
}

it("rejects when no active org is selected", async () => {
  await expect(caller(pendingIdentity).signals.list({})).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(listSignalsMock).not.toHaveBeenCalled();
});

it("rejects unauthenticated callers", async () => {
  await expect(
    caller(unauthenticatedIdentity).signals.list({})
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(listSignalsMock).not.toHaveBeenCalled();
});

it("rejects revoked organizations", async () => {
  await expect(
    caller({
      ...activeIdentity,
      orgGate: { bindingStatus: "revoked" },
    }).signals.list({})
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(listSignalsMock).not.toHaveBeenCalled();
});

it("scopes list queries to the authenticated organization", async () => {
  await expect(caller(activeIdentityForOrg("org_other")).signals.list({}))
    .resolves.toMatchObject({ items: [signalRow] });

  expect(listSignalsMock).toHaveBeenCalledWith(expect.anything(), {
    clerkOrgId: "org_other",
    cursor: undefined,
    limit: undefined,
    search: undefined,
    status: undefined,
  });
});
```

- [ ] **Step 6: Run focused API app router tests**

Run:

```bash
pnpm --filter @api/app test -- automations-router.test.ts workspace-people-router.test.ts workspace-signals-router.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit auth-boundary tests**

```bash
git add api/app/src/__tests__/automations-router.test.ts api/app/src/__tests__/workspace-people-router.test.ts api/app/src/__tests__/workspace-signals-router.test.ts
git commit -m "test: cover workspace auth boundaries"
```

---

### Task 2: Fail Fast For Local API Origins

**Files:**
- Modify: `api/app/src/origins.ts`
- Create: `api/app/src/__tests__/origins.test.ts`
- Modify: `api/platform/src/origins.ts`
- Create: `api/platform/src/__tests__/origins.test.ts`

- [ ] **Step 1: Write API app origin tests**

Create `api/app/src/__tests__/origins.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

async function importOrigins() {
  vi.resetModules();
  return import("../origins");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api app origins", () => {
  it("throws in local mode when local origin env vars are missing", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WWW_URL", "");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", "");

    await expect(importOrigins()).rejects.toThrow("NEXT_PUBLIC_APP_URL");
  });

  it("uses local origin env vars in local mode", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.lightfast.localhost");
    vi.stubEnv("NEXT_PUBLIC_WWW_URL", "https://www.lightfast.localhost");
    vi.stubEnv(
      "NEXT_PUBLIC_PLATFORM_URL",
      "https://platform.lightfast.localhost"
    );

    const origins = await importOrigins();

    expect(origins.appUrl).toBe("https://app.lightfast.localhost");
    expect(origins.wwwUrl).toBe("https://www.lightfast.localhost");
    expect(origins.platformUrl).toBe("https://platform.lightfast.localhost");
  });
});
```

- [ ] **Step 2: Write API platform origin tests**

Create `api/platform/src/__tests__/origins.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

async function importOrigins() {
  vi.resetModules();
  return import("../origins");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api platform origins", () => {
  it("throws in local mode when NEXT_PUBLIC_APP_URL is missing", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    await expect(importOrigins()).rejects.toThrow("NEXT_PUBLIC_APP_URL");
  });

  it("uses the local app origin in local mode", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.lightfast.localhost");

    const origins = await importOrigins();

    expect(origins.appUrl).toBe("https://app.lightfast.localhost");
  });
});
```

- [ ] **Step 3: Run origin tests and verify failure**

Run:

```bash
pnpm --filter @api/app test -- origins.test.ts
pnpm --filter @api/platform test -- origins.test.ts
```

Expected: FAIL because local origin resolution currently falls back to production.

- [ ] **Step 4: Implement local fail-fast helper in `api/app/src/origins.ts`**

Replace the local default-host logic with:

```ts
const APP_PRODUCTION_URL = "https://lightfast.ai";
const PLATFORM_PRODUCTION_URL = "https://lightfast-platform.vercel.app";

function localDefaultHost(envName: string): string {
  const value = process.env[envName];
  if (value) {
    return value;
  }
  throw new Error(
    `${envName} is required for local origin resolution. Run pnpm dev through the app package so portless injects local origins.`
  );
}

function defaultHost(envName: string, productionUrl: string): string {
  return isLocal ? localDefaultHost(envName) : productionUrl;
}
```

Use it in the three `withRelatedProject` calls:

```ts
defaultHost: defaultHost("NEXT_PUBLIC_APP_URL", APP_PRODUCTION_URL)
defaultHost: defaultHost("NEXT_PUBLIC_WWW_URL", APP_PRODUCTION_URL)
defaultHost: defaultHost("NEXT_PUBLIC_PLATFORM_URL", PLATFORM_PRODUCTION_URL)
```

- [ ] **Step 5: Implement local fail-fast helper in `api/platform/src/origins.ts`**

Use the same helper shape and replace the app default host with:

```ts
defaultHost: defaultHost("NEXT_PUBLIC_APP_URL", APP_PRODUCTION_URL)
```

- [ ] **Step 6: Run origin tests**

Run:

```bash
pnpm --filter @api/app test -- origins.test.ts
pnpm --filter @api/platform test -- origins.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit origin safety**

```bash
git add api/app/src/origins.ts api/app/src/__tests__/origins.test.ts api/platform/src/origins.ts api/platform/src/__tests__/origins.test.ts
git commit -m "fix: fail fast for local api origins"
```

---

### Task 3: Tighten Inngest Workflow Configuration

**Files:**
- Modify: `api/app/src/inngest/workflow/automation-scheduler.ts`
- Create: `api/app/src/__tests__/automation-scheduler-workflow.test.ts`
- Modify: `api/platform/src/inngest/client.ts`
- Modify: `api/platform/src/inngest/workflow/system-health.ts`
- Modify: `api/platform/src/__tests__/system-health-workflow.test.ts`

- [ ] **Step 1: Add automation scheduler workflow tests**

Create `api/app/src/__tests__/automation-scheduler-workflow.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const claimDueAutomationRunsMock = vi.fn();
let schedulerCallback:
  | ((input: { step: ReturnType<typeof createStep> }) => Promise<unknown>)
  | undefined;

const createFunctionMock = vi.fn((config, handler) => {
  schedulerCallback = handler;
  return { id: config.id };
});

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  claimDueAutomationRuns: claimDueAutomationRunsMock,
}));
vi.mock("../inngest/client", () => ({
  inngest: {
    createFunction: createFunctionMock,
  },
}));

const { automationScheduler } = await import(
  "../inngest/workflow/automation-scheduler"
);

function createStep() {
  return {
    run: vi.fn((_name: string, fn: () => unknown) => fn()),
    sendEvent: vi.fn(),
  };
}

describe("automationScheduler", () => {
  it("registers retries, idempotency, cron trigger, and timeouts", () => {
    expect(automationScheduler).toEqual({ id: "automation-scheduler" });
    expect(createFunctionMock).toHaveBeenCalledWith(
      {
        id: "automation-scheduler",
        idempotency: "event.id",
        retries: 2,
        timeouts: { finish: "2m", start: "1m" },
        triggers: { cron: "* * * * *" },
      },
      expect.any(Function)
    );
  });

  it("claims due automation runs and queues each run", async () => {
    claimDueAutomationRunsMock.mockResolvedValueOnce([
      {
        automation: {
          clerkOrgId: "org_test",
          publicId: "automation_123e4567-e89b-12d3-a456-426614174000",
          scheduleVersion: 1,
        },
        run: {
          publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
        },
      },
    ]);
    const step = createStep();
    if (!schedulerCallback) {
      throw new Error("scheduler callback was not registered");
    }

    await expect(schedulerCallback({ step })).resolves.toEqual({ queued: 1 });

    expect(step.sendEvent).toHaveBeenCalledWith("queue automation run", {
      name: "app/automation.run.requested",
      data: {
        automationId: "automation_123e4567-e89b-12d3-a456-426614174000",
        clerkOrgId: "org_test",
        runId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
        scheduleVersion: 1,
      },
    });
  });
});
```

- [ ] **Step 2: Run scheduler test and verify failure**

Run:

```bash
pnpm --filter @api/app test -- automation-scheduler-workflow.test.ts
```

Expected: FAIL because `retries` is `0` and `idempotency` is missing.

- [ ] **Step 3: Update automation scheduler config**

Modify `api/app/src/inngest/workflow/automation-scheduler.ts`:

```ts
export const automationScheduler = inngest.createFunction(
  {
    id: "automation-scheduler",
    idempotency: "event.id",
    retries: 2,
    triggers: { cron: "* * * * *" },
    timeouts: {
      finish: "2m",
      start: "1m",
    },
  },
  async ({ step }) => {
    // existing handler stays unchanged
  }
);
```

- [ ] **Step 4: Update platform system health config and test**

Modify `api/platform/src/inngest/workflow/system-health.ts`:

```ts
export const systemHealth = inngest.createFunction(
  {
    id: "system-health",
    idempotency: "event.id",
    retries: 2,
    triggers: { cron: "* * * * *" },
    timeouts: {
      finish: "30s",
      start: "30s",
    },
  },
  async ({ step }) =>
    step.run("collect platform health", () => ({
      app: "lightfast-platform",
      environment: env.VERCEL_ENV,
      status: "ok" as const,
      timestamp: new Date().toISOString(),
    }))
);
```

Update `api/platform/src/__tests__/system-health-workflow.test.ts` expected config to include:

```ts
idempotency: "event.id",
retries: 2,
```

- [ ] **Step 5: Restore a typed platform event surface**

Modify `api/platform/src/inngest/client.ts` to export the platform event map type while keeping Inngest v4-compatible runtime setup:

```ts
import { Inngest } from "@vendor/inngest";
import { createInngestObservabilityMiddleware } from "@vendor/observability/inngest";

import { env } from "../env";
import type { platformEvents } from "./schemas/platform";

export type PlatformEvents = typeof platformEvents;

const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  middleware: [createInngestObservabilityMiddleware()],
});

export { inngest };
```

- [ ] **Step 6: Run workflow tests**

Run:

```bash
pnpm --filter @api/app test -- automation-scheduler-workflow.test.ts
pnpm --filter @api/platform test -- system-health-workflow.test.ts
pnpm --filter @api/platform typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Inngest workflow configuration**

```bash
git add api/app/src/inngest/workflow/automation-scheduler.ts api/app/src/__tests__/automation-scheduler-workflow.test.ts api/platform/src/inngest/client.ts api/platform/src/inngest/workflow/system-health.ts api/platform/src/__tests__/system-health-workflow.test.ts
git commit -m "fix: harden scheduled inngest workflows"
```

---

### Task 4: Clarify DB Env And Migration Runbook

**Files:**
- Modify: `db/app/src/env.ts`
- Modify: `db/app/README.md`

- [ ] **Step 1: Write the intended env shape**

Modify `db/app/src/env.ts` so it relies on `vendorDbEnv` for `DATABASE_*` validation and runtime mapping:

```ts
import { createEnv } from "@t3-oss/env-core";
import { dbEnv as vendorDbEnv } from "@vendor/db/env";

export const env = createEnv({
  extends: [vendorDbEnv],
  clientPrefix: "" as const,
  client: {},
  server: {},
  runtimeEnv: {},
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION ||
    process.env.npm_lifecycle_event === "lint",
});
```

- [ ] **Step 2: Update the migration command documentation**

Modify the `db/app/README.md` commands section:

```md
pnpm db:generate  # Generate migration SQL from src/schema
pnpm db:migrate   # Apply migrations to the persistent staging branch only
pnpm db:push      # Apply schema diff
pnpm db:studio    # Open Drizzle Studio
```

Add this paragraph immediately below the commands:

```md
`pnpm db:migrate` is only for the persistent `staging` PlanetScale branch with
explicit `DATABASE_*` migration credentials. Never run it against the `main`
production branch.
```

- [ ] **Step 3: Run DB typecheck**

Run:

```bash
pnpm --filter @db/app typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit DB env/docs cleanup**

```bash
git add db/app/src/env.ts db/app/README.md
git commit -m "fix: clarify db env and migrations"
```

---

### Task 5: Make Automation Scheduling Timezone-Aware

**Files:**
- Modify: `db/app/src/utils/automations.ts`
- Modify: `db/app/src/__tests__/automations.test.ts`

- [ ] **Step 1: Add failing timezone tests**

Append to `db/app/src/__tests__/automations.test.ts`:

```ts
it("returns the next daily time in the requested timezone", () => {
  const next = calculateNextRunAt({
    after: new Date("2026-05-27T22:15:00.000Z"),
    schedule: {
      kind: "daily",
      config: { time: "09:30" },
    },
    timezone: "Australia/Melbourne",
  });

  expect(next.toISOString()).toBe("2026-05-28T23:30:00.000Z");
});

it("handles daylight saving transitions for daily schedules", () => {
  const next = calculateNextRunAt({
    after: new Date("2026-10-03T20:00:00.000Z"),
    schedule: {
      kind: "daily",
      config: { time: "09:30" },
    },
    timezone: "Australia/Melbourne",
  });

  expect(next.toISOString()).toBe("2026-10-03T22:30:00.000Z");
});
```

- [ ] **Step 2: Run scheduling tests and verify failure**

Run:

```bash
pnpm --filter @db/app test -- automations.test.ts
```

Expected: FAIL because daily schedules are currently interpreted as UTC.

- [ ] **Step 3: Add timezone helpers**

Add these helpers above `calculateNextRunAt` in `db/app/src/utils/automations.ts`:

```ts
interface LocalDateParts {
  day: number;
  hour?: number;
  minute?: number;
  month: number;
  second?: number;
  year: number;
}

function getZonedParts(date: Date, timezone: string): Required<LocalDateParts> {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    day: value("day"),
    hour: value("hour") % 24,
    minute: value("minute"),
    month: value("month"),
    second: value("second"),
    year: value("year"),
  };
}

function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );
  return asUtc - date.getTime();
}

function zonedTimeToUtc(parts: Required<Pick<LocalDateParts, "day" | "month" | "year">> & {
  hour: number;
  minute: number;
}, timezone: string): Date {
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute)
  );
  const firstOffset = getTimezoneOffsetMs(utcGuess, timezone);
  const firstResult = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimezoneOffsetMs(firstResult, timezone);
  return new Date(utcGuess.getTime() - secondOffset);
}

function addLocalDays(
  parts: Required<Pick<LocalDateParts, "day" | "month" | "year">>,
  days: number
) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}
```

- [ ] **Step 4: Update `calculateNextRunAt` signature and daily logic**

Change the function input type and daily branch:

```ts
export function calculateNextRunAt(input: {
  after: Date;
  from?: Date;
  schedule: NormalizedSchedule;
  timezone?: string;
}): Date {
  if (input.schedule.kind === "hourly") {
    const intervalMs = input.schedule.config.intervalHours * 60 * 60 * 1000;
    let next = new Date((input.from ?? input.after).getTime() + intervalMs);
    while (next <= input.after) {
      next = new Date(next.getTime() + intervalMs);
    }
    return next;
  }

  const timezone = input.timezone ?? "UTC";
  const [hours = 0, minutes = 0] = input.schedule.config.time
    .split(":")
    .map(Number);
  const afterParts = getZonedParts(input.after, timezone);
  let dateParts = {
    day: afterParts.day,
    month: afterParts.month,
    year: afterParts.year,
  };
  let next = zonedTimeToUtc(
    { ...dateParts, hour: hours, minute: minutes },
    timezone
  );
  if (next <= input.after) {
    dateParts = addLocalDays(dateParts, 1);
    next = zonedTimeToUtc(
      { ...dateParts, hour: hours, minute: minutes },
      timezone
    );
  }
  return next;
}
```

- [ ] **Step 5: Pass timezone through create/update/claim paths**

Update calls in `createAutomation`, `updateAutomation`, and `claimDueAutomationRuns`:

```ts
nextRunAt: calculateNextRunAt({
  after: now,
  schedule,
  timezone: input.timezone ?? "UTC",
})
```

For `updateAutomation`, recalculate when either `input.schedule` or `input.timezone` is present:

```ts
if (input.schedule || input.timezone !== undefined) {
  const schedule = input.schedule
    ? normalizeAutomationSchedule(input.schedule)
    : normalizeAutomationSchedule({
        kind: existing.scheduleKind,
        config: existing.scheduleConfig,
      });
  const timezone = input.timezone ?? existing.timezone;
  nextValues.scheduleKind = schedule.kind;
  nextValues.scheduleConfig = schedule.config;
  nextValues.timezone = timezone;
  nextValues.nextRunAt = calculateNextRunAt({
    after: options.now ?? new Date(),
    schedule,
    timezone,
  });
  nextValues.scheduleVersion =
    sql`${automations.scheduleVersion} + 1` as unknown as number | undefined;
}
```

For `claimDueAutomationRuns`:

```ts
const nextRunAt = calculateNextRunAt({
  after: now,
  from: dueAt,
  schedule,
  timezone: automation.timezone,
});
```

- [ ] **Step 6: Run scheduling tests**

Run:

```bash
pnpm --filter @db/app test -- automations.test.ts
```

Expected: PASS.

---

### Task 6: Prevent Terminal Automation Run Regression

**Files:**
- Modify: `db/app/src/utils/automations.ts`
- Modify: `db/app/src/__tests__/automations.test.ts`

- [ ] **Step 1: Add a unit test for failed-state guard**

Add a small mock DB test in `db/app/src/__tests__/automations.test.ts`:

```ts
import type { Database } from "../client";
import { markAutomationRunFailed } from "../utils/automations";

it("only marks pending or running automation runs as failed", async () => {
  const whereMock = vi.fn(() => ({ affectedRows: 0 }));
  const setMock = vi.fn(() => ({ where: whereMock }));
  const db = {
    update: vi.fn(() => ({ set: setMock })),
  } as unknown as Database;

  await markAutomationRunFailed(db, {
    clerkOrgId: "org_test",
    errorCode: "TEST_ERROR",
    errorMessage: "Test failure",
    publicId: "automation_run_123e4567-e89b-12d3-a456-426614174000",
  });

  expect(whereMock).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Update the failure transition predicate**

Import `inArray` from Drizzle:

```ts
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
```

Update `markAutomationRunFailed`:

```ts
.where(
  and(
    eq(automationRuns.clerkOrgId, input.clerkOrgId),
    eq(automationRuns.publicId, input.publicId),
    inArray(automationRuns.status, ["pending", "running"])
  )
);
```

- [ ] **Step 3: Run automation DB tests**

Run:

```bash
pnpm --filter @db/app test -- automations.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit automation scheduling and run-state fixes**

```bash
git add db/app/src/utils/automations.ts db/app/src/__tests__/automations.test.ts
git commit -m "fix: respect automation timezones"
```

---

### Task 7: Escape People Search LIKE Wildcards

**Files:**
- Modify: `db/app/src/utils/people.ts`
- Modify: `db/app/src/__tests__/people.test.ts`

- [ ] **Step 1: Add LIKE escaping tests**

Add a direct helper export test in `db/app/src/__tests__/people.test.ts`:

```ts
import { escapeLikePattern } from "../utils/people";

describe("escapeLikePattern", () => {
  it("escapes MySQL LIKE wildcard characters and escape characters", () => {
    expect(escapeLikePattern(String.raw`50%_done\test`)).toBe(
      String.raw`50\%\_done\\test`
    );
  });
});
```

- [ ] **Step 2: Export and use `escapeLikePattern`**

Modify `db/app/src/utils/people.ts`:

```ts
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
```

Update the search branch:

```ts
const likePattern = search ? `%${escapeLikePattern(search)}%` : undefined;
```

Replace the `like(...)` calls with escaped SQL fragments:

```ts
likePattern
  ? or(
      sql`${people.displayName} LIKE ${likePattern} ESCAPE '\\'`,
      sql`${people.identityProvider} LIKE ${likePattern} ESCAPE '\\'`,
      sql`${people.identityValue} LIKE ${likePattern} ESCAPE '\\'`,
      sql`${people.normalizedIdentityValue} LIKE ${likePattern} ESCAPE '\\'`
    )
  : undefined,
```

Remove the unused `like` import.

- [ ] **Step 3: Run people tests**

Run:

```bash
pnpm --filter @db/app test -- people.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit people search fix**

```bash
git add db/app/src/utils/people.ts db/app/src/__tests__/people.test.ts
git commit -m "fix: escape people search wildcards"
```

---

### Task 8: Validate Automation Timezones And Deleted Labels

**Files:**
- Modify: `packages/app-validation/src/schemas/automations.ts`
- Modify: `packages/app-validation/src/__tests__/automations.test.ts`

- [ ] **Step 1: Add validation tests**

Add tests to `packages/app-validation/src/__tests__/automations.test.ts`:

```ts
import {
  createAutomationSchema,
  updateAutomationSchema,
} from "../schemas/automations";

it("accepts valid IANA timezone values", () => {
  expect(
    createAutomationSchema.parse({
      name: "Morning check",
      prompt: "Check the workspace",
      schedule: { kind: "daily", config: { time: "09:00" } },
      timezone: "Australia/Melbourne",
    }).timezone
  ).toBe("Australia/Melbourne");
});

it("rejects invalid timezone values", () => {
  expect(() =>
    updateAutomationSchema.parse({
      id: "automation_123e4567-e89b-12d3-a456-426614174000",
      timezone: "not-a-zone",
    })
  ).toThrow();
});

it("returns 'Deleted' for deleted automations", () => {
  expect(
    formatAutomationSchedule({
      status: "deleted",
      scheduleKind: "daily",
      scheduleConfig: { time: "09:00" },
    })
  ).toBe("Deleted");
});
```

- [ ] **Step 2: Implement timezone schema helper**

Add to `packages/app-validation/src/schemas/automations.ts`:

```ts
function isIanaTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(isIanaTimezone, "Use a valid IANA timezone");
```

Use it in create/update schemas:

```ts
timezone: timezoneSchema.default("UTC"),
timezone: timezoneSchema.optional(),
```

- [ ] **Step 3: Handle deleted status in formatter**

Update `formatAutomationSchedule`:

```ts
if (automation.status === "deleted") {
  return "Deleted";
}
if (automation.status === "paused") {
  return "Paused";
}
```

- [ ] **Step 4: Run app-validation tests**

Run:

```bash
pnpm --filter @repo/app-validation test -- automations.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit validation fixes**

```bash
git add packages/app-validation/src/schemas/automations.ts packages/app-validation/src/__tests__/automations.test.ts
git commit -m "fix: validate automation timezone inputs"
```

---

### Task 9: Add Automations New Route Boundaries

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/loading.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/error.tsx`

- [ ] **Step 1: Add loading boundary**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/loading.tsx`:

```tsx
export default function NewAutomationLoading() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="mb-8 h-9 w-20 rounded-md bg-muted" />
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-10 rounded-md bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-48 rounded-md bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-9 w-36 rounded-md bg-muted" />
            <div className="h-10 w-40 rounded-md bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add error boundary**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/error.tsx`:

```tsx
"use client";

import { Button } from "@repo/ui/components/ui/button";
import { captureException } from "@sentry/nextjs";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

interface NewAutomationErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function NewAutomationError({
  error,
  reset,
}: NewAutomationErrorProps) {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0] ?? "workspace";

  useEffect(() => {
    captureException(error, {
      tags: { route: "automations/new" },
    });
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="space-y-4 rounded-lg border border-border/60 px-4 py-6">
        <div>
          <h2 className="font-medium text-foreground text-lg">
            Couldn&apos;t load automation setup
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            There was a transient error preparing the create form.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            href={`/${slug}/automations` as Route}
          >
            Back to automations
          </Link>
          <Button onClick={reset} size="sm" variant="secondary">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck app route boundary code**

Run:

```bash
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit route boundaries**

```bash
git add 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/loading.tsx' 'apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/new/error.tsx'
git commit -m "fix: add new automation route boundaries"
```

---

### Task 10: Final Validation

**Files:**
- No source files changed in this task.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @api/app test -- automations-router.test.ts workspace-people-router.test.ts workspace-signals-router.test.ts origins.test.ts automation-scheduler-workflow.test.ts
pnpm --filter @api/platform test -- origins.test.ts system-health-workflow.test.ts
pnpm --filter @db/app test -- automations.test.ts people.test.ts
pnpm --filter @repo/app-validation test -- automations.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package typechecks**

Run:

```bash
pnpm --filter @api/app typecheck
pnpm --filter @api/platform typecheck
pnpm --filter @db/app typecheck
pnpm --filter @repo/app-validation typecheck
pnpm --filter @lightfast/app typecheck
```

Expected: PASS.

- [ ] **Step 3: Run repo checks**

Run:

```bash
pnpm typecheck
pnpm check
```

Expected: PASS.

- [ ] **Step 4: Review changed files**

Run:

```bash
git diff --stat HEAD
git diff --check
```

Expected: the stat excludes `core/cli/package.json`; `git diff --check` prints no whitespace errors.

- [ ] **Step 5: Confirm there are no uncommitted validation adjustments**

Run:

```bash
git status --short
```

Expected: no uncommitted changes beyond files already committed in earlier tasks. If this command shows source changes, return to the owning task, add the missing focused test for that behavior, rerun the package test, and commit that task's exact files.

---

## Self-Review Notes

- Spec coverage: all CodeRabbit items from PR #704 are represented except the explicitly omitted CLI dependency/import packaging item.
- Scope risk: timezone scheduling is the highest-risk change; it has isolated helper tests for non-UTC and DST behavior before call sites are updated.
- Validation risk: Inngest v4 does not expose the old `EventSchemas().fromSchema(...)` API from the package currently installed in the workspace, so the plan restores a typed platform event surface without inventing an unavailable runtime registration API.
