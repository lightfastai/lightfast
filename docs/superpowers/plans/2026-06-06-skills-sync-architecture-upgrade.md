# Skills Sync Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move workspace skills reads off render-time GitHub refresh work and onto fast database snapshots, explicit refresh commands, and browser-visible refresh completion events.

**Architecture:** Keep GitHub `refs/heads/main` as source of truth and keep the existing DB refresh lock plus transactional entry replacement. Split the current side-effecting read path into `getSkillIndexSnapshot` for database-only reads and `requestSkillIndexRefresh` for enqueueing refresh work. Add a small Redis/SSE change-notification adapter so the browser can invalidate React Query when background refresh completes; defer TanStack DB until the stable snapshot/event interface exists.

**Tech Stack:** TypeScript, pnpm workspaces, Drizzle MySQL/Vitess, tRPC v11, TanStack Query, Next.js App Router route handlers, Inngest, Upstash Redis pub/sub, Vitest + Testing Library.

**Source spec:** `docs/superpowers/specs/2026-06-06-skills-sync-architecture-upgrade-design.md`

---

## Pre-flight Context

- Current side-effecting service: `api/app/src/services/skills/read.ts` exports `ensureFreshSkillIndexForRead`, which can check GitHub and refresh inline.
- Current router: `api/app/src/router/(pending-not-allowed)/workspace-skills.ts` calls `ensureFreshSkillIndexForRead` for both `list` and `get`.
- Current page accessor: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skills-list.ts` uses `useSuspenseQuery` against `org.workspace.skills.list`.
- Current assistant prompt path: `apps/app/src/app/(chat)/api/chat/route.ts` calls `ensureFreshSkillIndexForRead` while building the system prompt.
- Current Redis pub/sub precedent: `apps/app/src/app/(chat)/api/chat/resumable-stream.ts`.
- Keep the existing Skills page visual structure. This plan changes sync behavior, not page design.
- TanStack DB is not part of this implementation plan. It remains a later adapter after the server snapshot/event interface is stable.
- Commit discipline: stage explicit pathspecs only. Before every commit, run `git diff --cached --name-only` and verify only that task's files are staged.

## File Structure

Create:

- `api/app/src/services/skills/refresh-request.ts` - explicit command for enqueueing refresh jobs.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts` - route-local React Query refresh controller.
- `apps/app/src/app/(api)/api/skills/index/events/route.ts` - authenticated SSE endpoint for skill-index change events.
- `apps/app/src/app/(api)/api/skills/index/events/skill-index-event-stream.ts` - Redis subscribe/unsubscribe adapter for the route.
- `apps/app/src/__tests__/app/api/skills/index-events-route.test.ts` - SSE auth and event-route behavior.
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx` - client controller tests.

Modify:

- `api/app/src/services/skills/read.ts` - add database-only `getSkillIndexSnapshot`.
- `api/app/src/services/skills/types.ts` - widen refresh enqueue reason and add publish dependency hooks.
- `api/app/src/services/skills/deps.ts` - wire default refresh enqueue and change publisher adapters.
- `api/app/src/services/skills/refresh.ts` - publish terminal change events after successful replacement or failure.
- `api/app/src/services/skills/index.ts` - export new services/types.
- `api/app/src/services/skills/reconcile.ts` - use the refreshed enqueue command/dependency shape.
- `api/app/src/inngest/workflow/reconcile-skill-indexes.ts` - use the shared `createSkillRefreshDedupeKey` event payload helper introduced in Task 2.
- `api/app/src/inngest/workflow/queue-skill-refresh-from-source-control.ts` - keep webhook queue semantics but align event construction.
- `api/app/src/router/(pending-not-allowed)/workspace-skills.ts` - read snapshots and add `requestRefresh`.
- `api/app/src/__tests__/skills-index-service.test.ts` - add snapshot/refresh-command/event tests; rewrite read-time freshness assertions.
- `api/app/src/__tests__/workspace-skills-router.test.ts` - switch mocks and add mutation tests.
- `api/app/src/__tests__/skills-index-workflows.test.ts` - update expected enqueue payload helpers when shared helper changes.
- `apps/app/src/app/(chat)/api/chat/route.ts` - build skill context from database snapshot, not read-time freshness.
- `apps/app/src/__tests__/app/api/chat/route.test.ts` - update mocks/expectations for snapshot reads.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skills-list.ts` - keep query accessor but support `snapshotVersion` type.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx` - install the refresh controller.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-actions.tsx` - controller is not needed here; it continues to read the shared query result.
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts` - add `snapshotVersion`.
- `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx` - assert controller integration without changing visual behavior.

Do not modify:

- `db/app/src/schema/tables/org-skill-index.ts` - no schema migration required in this plan.
- `packages/skills-contract/src/index.ts` - parser semantics stay unchanged.
- `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/page.tsx` - prefetch/hydration shape stays.
- `apps/app/package.json` - no TanStack DB dependency in this plan.

---

## Task 1: Add Database-Only Skill Index Snapshots

**Files:**
- Modify: `api/app/src/services/skills/read.ts`
- Modify: `api/app/src/services/skills/index.ts`
- Modify: `api/app/src/__tests__/skills-index-service.test.ts`

- [ ] **Step 1: Write failing snapshot service tests**

In `api/app/src/__tests__/skills-index-service.test.ts`, add `getSkillIndexSnapshot` to the import from `../services/skills`:

```ts
import {
  checkSkillIndexSourceRef,
  ensureFreshSkillIndexForRead,
  findChangedSkillIndexSources,
  getSkillIndexSnapshot,
  reconcileSkillIndexSources,
  refreshSkillIndexSource,
} from "../services/skills";
```

Inside `describe("skills index refresh/read service", () => { ... })`, add these tests before the existing read-time freshness tests:

```ts
  it("returns a database snapshot without checking GitHub", async () => {
    const skill = entry({ indexedCommitSha: "current-main", slug: "snapshot" });
    const deps = createDeps({
      targetEntries: [skill],
      targetState: staleState({
        id: 100,
        indexedCommitSha: "current-main",
        lastCheckedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
        updatedAt: now,
      }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result).toMatchObject({
      repositoryUrl: "https://github.com/acme/lightfast-skills",
      skills: [skill],
      snapshotVersion: `100:${now.getTime()}:current-main:fresh`,
      freshness: {
        indexedCommitSha: "current-main",
        status: "fresh",
      },
    });
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
    expect(deps.acquireSkillIndexRefreshLock).not.toHaveBeenCalled();
    expect(deps.sleep).not.toHaveBeenCalled();
  });

  it("returns unavailable immediately when no verified candidate exists", async () => {
    const deps = createDeps({
      candidate: null,
      targetState: staleState({ indexedCommitSha: "private-index" }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      sourceControlRepositoryId: 1,
    });

    expect(result).toMatchObject({
      repositoryUrl: "",
      skills: [],
      snapshotVersion: null,
      freshness: {
        indexedCommitSha: null,
        status: "unavailable",
      },
    });
    expect(
      deps.getSkillIndexStateBySourceControlRepositoryId
    ).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
  });

  it("uses exact slug lookup for snapshot detail reads", async () => {
    const skill = entry({ indexedCommitSha: "current-main", slug: "selected" });
    const deps = createDeps({
      targetEntries: [skill],
      targetState: staleState({
        indexedCommitSha: "current-main",
        lastRefreshStatus: "fresh",
      }),
    });

    const result = await getSkillIndexSnapshot({
      clerkOrgId: "org_123",
      deps,
      slug: "selected",
      sourceControlRepositoryId: 1,
    });

    expect(result.skills).toEqual([skill]);
    expect(deps.getSkillIndexEntryBySlug).toHaveBeenCalledWith(deps.db, {
      slug: "selected",
      stateId: 100,
    });
    expect(deps.listSkillIndexEntries).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
pnpm --filter @api/app test -- skills-index-service
```

Expected: fails because `getSkillIndexSnapshot` is not exported.

- [ ] **Step 3: Implement `getSkillIndexSnapshot`**

In `api/app/src/services/skills/read.ts`, add the new exported function above `ensureFreshSkillIndexForRead`:

```ts
export async function getSkillIndexSnapshot(input: {
  clerkOrgId: string;
  deps?: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
  slug?: string;
}): Promise<{
  freshness: SkillIndexFreshness;
  indexDiagnostics: SkillDiagnostic[];
  repositoryUrl: string;
  skills: SkillIndexEntry[];
  snapshotVersion: string | null;
}> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    clerkOrgId: input.clerkOrgId,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
  if (!candidate) {
    return {
      freshness: toFreshness(null, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl: "",
      skills: [],
      snapshotVersion: null,
    };
  }

  const repositoryUrl = getRepositoryUrl(candidate.repository.fullName);
  const state =
    candidate.state ??
    (await deps.getSkillIndexStateBySourceControlRepositoryId(deps.db, {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }));

  if (!state) {
    return {
      freshness: toFreshness(null, "unavailable"),
      indexDiagnostics: [],
      repositoryUrl,
      skills: [],
      snapshotVersion: null,
    };
  }

  const entries = await readEntries(deps, {
    slug: input.slug,
    stateId: state.id,
  });

  return {
    freshness: toFreshness(
      state,
      deriveSnapshotStatus({
        entries,
        state,
      })
    ),
    indexDiagnostics: state.indexDiagnostics,
    repositoryUrl,
    skills: entries,
    snapshotVersion: toSkillIndexSnapshotVersion(state),
  };
}
```

Still in `read.ts`, add these helpers below `deriveReadStatus`:

```ts
function deriveSnapshotStatus(input: {
  entries: SkillIndexEntry[];
  state: {
    indexedCommitSha: string | null;
    lastCheckedCommitSha: string | null;
    lastRefreshStatus: string;
  };
}): SkillIndexFreshness["status"] {
  if (
    input.state.indexedCommitSha &&
    input.state.lastCheckedCommitSha &&
    input.state.indexedCommitSha === input.state.lastCheckedCommitSha
  ) {
    return "fresh";
  }
  if (input.state.lastRefreshStatus === "refreshing") {
    return "refreshing";
  }
  return input.entries.length > 0 ? "stale" : "unavailable";
}

function toSkillIndexSnapshotVersion(state: {
  id: number;
  indexedCommitSha: string | null;
  lastRefreshStatus: string;
  updatedAt: Date;
}): string {
  return [
    state.id,
    state.updatedAt.getTime(),
    state.indexedCommitSha ?? "",
    state.lastRefreshStatus,
  ].join(":");
}
```

- [ ] **Step 4: Export the snapshot service**

In `api/app/src/services/skills/index.ts`, add `getSkillIndexSnapshot` to the read exports:

```ts
export {
  ensureFreshSkillIndexForRead,
  getSkillIndexSnapshot,
} from "./read";
```

- [ ] **Step 5: Run the focused service tests**

Run:

```bash
pnpm --filter @api/app test -- skills-index-service
```

Expected: the new snapshot tests pass. Existing read-time freshness tests still pass because `ensureFreshSkillIndexForRead` remains untouched.

- [ ] **Step 6: Commit**

```bash
git add -- \
  api/app/src/services/skills/read.ts \
  api/app/src/services/skills/index.ts \
  api/app/src/__tests__/skills-index-service.test.ts
git diff --cached --name-only
git commit -m "feat(skills): add database snapshot read service" -- \
  api/app/src/services/skills/read.ts \
  api/app/src/services/skills/index.ts \
  api/app/src/__tests__/skills-index-service.test.ts
```

---

## Task 2: Add Explicit Refresh Requests And Move tRPC Reads To Snapshots

**Files:**
- Create: `api/app/src/services/skills/refresh-request.ts`
- Modify: `api/app/src/services/skills/types.ts`
- Modify: `api/app/src/services/skills/deps.ts`
- Modify: `api/app/src/services/skills/index.ts`
- Modify: `api/app/src/router/(pending-not-allowed)/workspace-skills.ts`
- Modify: `api/app/src/__tests__/skills-index-service.test.ts`
- Modify: `api/app/src/__tests__/workspace-skills-router.test.ts`

- [ ] **Step 1: Write failing refresh-request service tests**

In `api/app/src/__tests__/skills-index-service.test.ts`, add `requestSkillIndexRefresh` to the services import:

```ts
import {
  checkSkillIndexSourceRef,
  ensureFreshSkillIndexForRead,
  findChangedSkillIndexSources,
  getSkillIndexSnapshot,
  reconcileSkillIndexSources,
  refreshSkillIndexSource,
  requestSkillIndexRefresh,
} from "../services/skills";
```

Add these tests near the reconcile tests:

```ts
  it("requests a refresh for a verified repository without running GitHub refresh inline", async () => {
    const deps = createDeps({
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      requestSkillIndexRefresh({
        clerkOrgId: "org_123",
        deps,
        reason: "read",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({
      enqueued: true,
      sourceControlRepositoryId: 1,
    });

    expect(deps.enqueueRefresh).toHaveBeenCalledWith({
      reason: "read",
      sourceControlRepositoryId: 1,
      targetCommitSha: undefined,
    });
    expect(deps.readSkillRepositoryMainRef).not.toHaveBeenCalled();
    expect(deps.readSkillRepositoryTree).not.toHaveBeenCalled();
  });

  it("does not enqueue a refresh when repository access is not verified", async () => {
    const deps = createDeps({ candidate: null });
    deps.enqueueRefresh = vi.fn(async () => undefined);

    await expect(
      requestSkillIndexRefresh({
        clerkOrgId: "org_123",
        deps,
        reason: "read",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({
      enqueued: false,
      sourceControlRepositoryId: 1,
    });

    expect(deps.enqueueRefresh).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Update router tests to expect snapshots and request mutation**

In `api/app/src/__tests__/workspace-skills-router.test.ts`, replace the hoisted mocks:

```ts
const {
  getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryIdMock,
  requestSkillIndexRefreshMock,
} = vi.hoisted(() => ({
  getSkillIndexSnapshotMock: vi.fn(),
  getVerifiedLightfastSkillSourceRepositoryIdMock: vi.fn(),
  requestSkillIndexRefreshMock: vi.fn(),
}));
```

Replace the `vi.mock("../services/skills", ...)` body with:

```ts
vi.mock("../services/skills", () => ({
  getSkillIndexSnapshot: getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryId:
    getVerifiedLightfastSkillSourceRepositoryIdMock,
  requestSkillIndexRefresh: requestSkillIndexRefreshMock,
}));
```

In `beforeEach`, replace `ensureFreshSkillIndexForReadMock` setup with:

```ts
  getSkillIndexSnapshotMock.mockReset();
  getSkillIndexSnapshotMock.mockResolvedValue({
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "b".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "b".repeat(40),
      status: "fresh",
    },
    indexDiagnostics: [],
    repositoryUrl: "https://github.com/acme/.lightfast",
    skills: [brokenSkill, codeReviewSkill],
    snapshotVersion: "100:1780272000000:bbbb:fresh",
  });
  requestSkillIndexRefreshMock.mockReset();
  requestSkillIndexRefreshMock.mockResolvedValue({
    enqueued: true,
    sourceControlRepositoryId: 42,
  });
```

Rename the first list test to "lists skills through the snapshot service" and update its expectation:

```ts
    expect(getSkillIndexSnapshotMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      sourceControlRepositoryId: 42,
    });
```

Update all `ensureFreshSkillIndexForReadMock` references in the file to `getSkillIndexSnapshotMock`, except for new request mutation assertions.

Add a request mutation test:

```ts
describe("workspaceSkillsRouter.requestRefresh", () => {
  it("queues a refresh for the active org skill source", async () => {
    await expect(caller().skills.requestRefresh(undefined)).resolves.toEqual({
      enqueued: true,
    });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).toHaveBeenCalledWith(expect.anything(), { clerkOrgId: "org_test" });
    expect(requestSkillIndexRefreshMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      reason: "read",
      sourceControlRepositoryId: 42,
    });
  });

  it("rejects supplied input fields", async () => {
    await expect(
      caller().skills.requestRefresh({ sourceControlRepositoryId: 42 } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(requestSkillIndexRefreshMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run focused tests to verify failures**

Run:

```bash
pnpm --filter @api/app test -- skills-index-service workspace-skills-router
```

Expected: failures for missing `requestSkillIndexRefresh`, old router implementation, and missing `requestRefresh` procedure.

- [ ] **Step 4: Widen enqueue types**

In `api/app/src/services/skills/types.ts`, change `enqueueRefresh` to accept all refresh reasons:

```ts
  enqueueRefresh?: (input: {
    reason: "read" | "schedule" | "setup" | "webhook";
    sourceControlRepositoryId: number;
    targetCommitSha?: string;
  }) => Promise<void>;
```

- [ ] **Step 5: Create `refresh-request.ts`**

Create `api/app/src/services/skills/refresh-request.ts`:

```ts
import { createSkillRefreshDedupeKey } from "../../inngest/workflow/skill-refresh-event";
import { resolveSkillIndexServiceDeps } from "./deps";
import { getVerifiedCandidateByRepositoryId } from "./repository";
import type { SkillIndexServiceDeps } from "./types";

export async function enqueueSkillIndexRefresh(input: {
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}): Promise<void> {
  const { inngest } = await import("../../inngest/client");
  await inngest.send({
    name: "app/skills.index.refresh.requested",
    data: {
      dedupeKey: createSkillRefreshDedupeKey(input),
      reason: input.reason,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
      targetCommitSha: input.targetCommitSha,
    },
  });
}

export async function requestSkillIndexRefresh(input: {
  clerkOrgId?: string;
  deps?: Partial<SkillIndexServiceDeps>;
  reason: "read" | "schedule" | "setup" | "webhook";
  sourceControlRepositoryId: number;
  targetCommitSha?: string;
}): Promise<{
  enqueued: boolean;
  sourceControlRepositoryId: number;
}> {
  const deps = resolveSkillIndexServiceDeps(input.deps);
  const candidate = await getVerifiedCandidateByRepositoryId(deps, {
    clerkOrgId: input.clerkOrgId,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });

  if (!candidate) {
    return {
      enqueued: false,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    };
  }

  const enqueue = deps.enqueueRefresh ?? enqueueSkillIndexRefresh;
  await enqueue({
    reason: input.reason,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
    targetCommitSha: input.targetCommitSha,
  });

  return {
    enqueued: true,
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  };
}
```

- [ ] **Step 6: Export refresh request helpers**

In `api/app/src/services/skills/index.ts`, add:

```ts
export {
  enqueueSkillIndexRefresh,
  requestSkillIndexRefresh,
} from "./refresh-request";
```

- [ ] **Step 7: Add default enqueue dependency**

In `api/app/src/services/skills/deps.ts`, import `enqueueSkillIndexRefresh`:

```ts
import { enqueueSkillIndexRefresh } from "./refresh-request";
```

Add it to `defaultSkillIndexServiceDeps`:

```ts
  enqueueRefresh: enqueueSkillIndexRefresh,
```

- [ ] **Step 8: Update the skills router**

In `api/app/src/router/(pending-not-allowed)/workspace-skills.ts`, change the import:

```ts
import {
  getSkillIndexSnapshot,
  getVerifiedLightfastSkillSourceRepositoryId,
  requestSkillIndexRefresh,
} from "../../services/skills";
```

Change `list` to call `getSkillIndexSnapshot`:

```ts
      const result = await getSkillIndexSnapshot({
        clerkOrgId: ctx.auth.identity.orgId,
        sourceControlRepositoryId,
      });
```

Change `get` to call `getSkillIndexSnapshot`:

```ts
      const result = await getSkillIndexSnapshot({
        clerkOrgId: ctx.auth.identity.orgId,
        slug: input.slug,
        sourceControlRepositoryId,
      });
```

Add the mutation after `get`:

```ts
  requestRefresh: boundOrgProcedure
    .input(z.object({}).strict().optional())
    .mutation(async ({ ctx }) => {
      const sourceControlRepositoryId =
        await getVerifiedLightfastSkillSourceRepositoryId(ctx.db, {
          clerkOrgId: ctx.auth.identity.orgId,
        });
      const result = await requestSkillIndexRefresh({
        clerkOrgId: ctx.auth.identity.orgId,
        reason: "read",
        sourceControlRepositoryId,
      });

      return { enqueued: result.enqueued };
    }),
```

Ensure the object syntax has commas between router members.

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm --filter @api/app test -- skills-index-service workspace-skills-router
```

Expected: service and router tests pass.

- [ ] **Step 10: Commit**

```bash
git add -- \
  api/app/src/services/skills/refresh-request.ts \
  api/app/src/services/skills/types.ts \
  api/app/src/services/skills/deps.ts \
  api/app/src/services/skills/index.ts \
  "api/app/src/router/(pending-not-allowed)/workspace-skills.ts" \
  api/app/src/__tests__/skills-index-service.test.ts \
  api/app/src/__tests__/workspace-skills-router.test.ts
git diff --cached --name-only
git commit -m "feat(skills): split snapshot reads from refresh requests" -- \
  api/app/src/services/skills/refresh-request.ts \
  api/app/src/services/skills/types.ts \
  api/app/src/services/skills/deps.ts \
  api/app/src/services/skills/index.ts \
  "api/app/src/router/(pending-not-allowed)/workspace-skills.ts" \
  api/app/src/__tests__/skills-index-service.test.ts \
  api/app/src/__tests__/workspace-skills-router.test.ts
```

---

## Task 3: Move Assistant Skill Context To Snapshot Reads

**Files:**
- Modify: `apps/app/src/app/(chat)/api/chat/route.ts`
- Modify: `apps/app/src/__tests__/app/api/chat/route.test.ts`

- [ ] **Step 1: Update chat route mocks in the test**

In `apps/app/src/__tests__/app/api/chat/route.test.ts`, rename the hoisted skills mock from `ensureFreshSkillIndexForReadMock` to `getSkillIndexSnapshotMock`.

Replace the `@api/app/services/skills` mock with:

```ts
vi.mock("@api/app/services/skills", () => ({
  getSkillIndexSnapshot: getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryId:
    getVerifiedLightfastSkillSourceRepositoryIdMock,
}));
```

In `beforeEach`, replace all resets/setup for `ensureFreshSkillIndexForReadMock` with:

```ts
  getSkillIndexSnapshotMock.mockReset();
  getSkillIndexSnapshotMock.mockResolvedValue({
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "a".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "a".repeat(40),
      status: "fresh",
    },
    indexDiagnostics: [],
    repositoryUrl: "https://github.com/acme/.lightfast",
    snapshotVersion: "100:1780272000000:aaaaaaaa:fresh",
    skills: [
      {
        description: "Create new skills, modify existing skills.",
        name: "Create skill",
        slug: "create-skill",
        validationStatus: "valid",
      },
    ],
  });
```

Update assertions that referenced `ensureFreshSkillIndexForReadMock` to:

```ts
expect(getSkillIndexSnapshotMock).toHaveBeenCalledWith({
  clerkOrgId: "org_123",
  sourceControlRepositoryId: 42,
});
```

- [ ] **Step 2: Run chat route test to verify failure**

Run:

```bash
pnpm --filter @lightfast/app test -- "app/api/chat/route.test"
```

Expected: fails because `route.ts` still imports `ensureFreshSkillIndexForRead`.

- [ ] **Step 3: Update `route.ts` to use snapshots**

In `apps/app/src/app/(chat)/api/chat/route.ts`, change the skills import from:

```ts
import {
  ensureFreshSkillIndexForRead,
  getVerifiedLightfastSkillSourceRepositoryId,
} from "@api/app/services/skills";
```

to:

```ts
import {
  getSkillIndexSnapshot,
  getVerifiedLightfastSkillSourceRepositoryId,
} from "@api/app/services/skills";
```

In `getSkillContext`, replace:

```ts
    const result = await ensureFreshSkillIndexForRead({
      clerkOrgId,
      sourceControlRepositoryId,
    });
```

with:

```ts
    const result = await getSkillIndexSnapshot({
      clerkOrgId,
      sourceControlRepositoryId,
    });
```

- [ ] **Step 4: Run chat route test**

Run:

```bash
pnpm --filter @lightfast/app test -- "app/api/chat/route.test"
```

Expected: chat route tests pass.

- [ ] **Step 5: Commit**

```bash
git add -- \
  "apps/app/src/app/(chat)/api/chat/route.ts" \
  apps/app/src/__tests__/app/api/chat/route.test.ts
git diff --cached --name-only
git commit -m "feat(skills): use snapshots for assistant skill context" -- \
  "apps/app/src/app/(chat)/api/chat/route.ts" \
  apps/app/src/__tests__/app/api/chat/route.test.ts
```

---

## Task 4: Add The Client Refresh Controller

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts`
- Create: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx`
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx`

- [ ] **Step 1: Add `snapshotVersion` to test fixtures**

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts`, add `snapshotVersion` to `createListData`:

```ts
    snapshotVersion:
      input.snapshotVersion ?? "100:1780272000000:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:fresh",
```

Update the `createListData` input type:

```ts
    snapshotVersion?: SkillsListResult["snapshotVersion"];
```

- [ ] **Step 2: Write failing controller tests**

Create `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createListData } from "./fixtures";

const invalidateQueriesMock = vi.fn();
const requestMutationOptionsMock = vi.fn((options: unknown) => options);
const mutateMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => ({
    mutate: mutateMock,
    options,
  }),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        skills: {
          list: {
            queryFilter: () => ({
              queryKey: ["org", "workspace", "skills", "list"],
            }),
          },
          requestRefresh: {
            mutationOptions: requestMutationOptionsMock,
          },
        },
      },
    },
  }),
}));

const { useSkillIndexRefreshController } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller"
);

beforeEach(() => {
  invalidateQueriesMock.mockReset();
  requestMutationOptionsMock.mockClear();
  mutateMock.mockReset();
});

describe("useSkillIndexRefreshController", () => {
  it("does not request refresh for fresh snapshots", () => {
    renderHook(() =>
      useSkillIndexRefreshController(
        createListData({
          snapshotVersion: "v1",
        })
      )
    );

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("requests one refresh for a stale snapshot version", async () => {
    const stale = createListData({
      snapshotVersion: "v-stale",
    });
    stale.freshness.status = "stale";

    const { rerender } = renderHook(
      ({ snapshot }) => useSkillIndexRefreshController(snapshot),
      { initialProps: { snapshot: stale } }
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    rerender({ snapshot: stale });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it("requests refresh again when the stale snapshot version changes", async () => {
    const staleA = createListData({ snapshotVersion: "v-stale-a" });
    staleA.freshness.status = "stale";
    const staleB = createListData({ snapshotVersion: "v-stale-b" });
    staleB.freshness.status = "stale";

    const { rerender } = renderHook(
      ({ snapshot }) => useSkillIndexRefreshController(snapshot),
      { initialProps: { snapshot: staleA } }
    );

    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(1));
    rerender({ snapshot: staleB });
    await waitFor(() => expect(mutateMock).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 3: Run controller test to verify failure**

Run:

```bash
pnpm --filter @lightfast/app test -- "skills/use-skill-index-refresh-controller"
```

Expected: fails because the hook does not exist.

- [ ] **Step 4: Implement the controller**

Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts`:

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTRPC } from "~/trpc/react";
import type { SkillsListResult } from "./skills-types";

const REFRESHABLE_STATUSES = new Set(["stale", "unavailable"]);

export function useSkillIndexRefreshController(snapshot: SkillsListResult) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const requestedVersions = useRef(new Set<string>());
  const refresh = useMutation(
    trpc.org.workspace.skills.requestRefresh.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(
          trpc.org.workspace.skills.list.queryFilter()
        );
      },
    })
  );

  useEffect(() => {
    const version = snapshot.snapshotVersion ?? "missing";
    if (!REFRESHABLE_STATUSES.has(snapshot.freshness.status)) {
      return;
    }
    if (requestedVersions.current.has(version)) {
      return;
    }
    requestedVersions.current.add(version);
    refresh.mutate({});
  }, [refresh, snapshot.freshness.status, snapshot.snapshotVersion]);
}
```

- [ ] **Step 5: Install the controller in `SkillsClient`**

In `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx`, import:

```ts
import { useSkillIndexRefreshController } from "./use-skill-index-refresh-controller";
```

Call it immediately after `const data = useSkillsList();`:

```ts
  useSkillIndexRefreshController(data);
```

- [ ] **Step 6: Mock the controller in client tests**

In `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx`, add:

```ts
const refreshControllerMock = vi.fn();

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller",
  () => ({
    useSkillIndexRefreshController: refreshControllerMock,
  })
);
```

In `beforeEach`, add:

```ts
  refreshControllerMock.mockClear();
```

Add this test:

```tsx
  it("passes the shared skills snapshot to the refresh controller", () => {
    render(<SkillsClient />);

    expect(refreshControllerMock).toHaveBeenCalledWith(listData);
  });
```

- [ ] **Step 7: Run focused app tests**

Run:

```bash
pnpm --filter @lightfast/app test -- "skills"
```

Expected: skills tests pass.

- [ ] **Step 8: Commit**

```bash
git add -- \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx"
git diff --cached --name-only
git commit -m "feat(skills): request refresh for stale snapshots" -- \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts" \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/fixtures.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/skills-client.test.tsx"
```

---

## Task 5: Publish Skill Index Change Events And Add The SSE Route

**Files:**
- Modify: `api/app/src/services/skills/types.ts`
- Modify: `api/app/src/services/skills/deps.ts`
- Modify: `api/app/src/services/skills/refresh.ts`
- Modify: `api/app/src/__tests__/skills-index-service.test.ts`
- Create: `apps/app/src/app/(api)/api/skills/index/events/skill-index-event-stream.ts`
- Create: `apps/app/src/app/(api)/api/skills/index/events/route.ts`
- Create: `apps/app/src/__tests__/app/api/skills/index-events-route.test.ts`

- [ ] **Step 1: Add event publisher tests to the refresh service suite**

In `api/app/src/__tests__/skills-index-service.test.ts`, add this test near the refresh success tests:

```ts
  it("publishes a skill index change after a successful refresh", async () => {
    const deps = createDeps({
      refSha: "current-main",
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "webhook",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "fresh" });

    expect(deps.publishSkillIndexChanged).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      indexedCommitSha: "current-main",
      lastRefreshStatus: "fresh",
      snapshotVersion: expect.any(String),
      sourceControlRepositoryId: 1,
    });
  });

  it("does not fail refresh when publishing a skill index change fails", async () => {
    const deps = createDeps({
      refSha: "current-main",
      targetState: staleState({ indexedCommitSha: "old-index" }),
    });
    deps.publishSkillIndexChanged.mockRejectedValueOnce(
      new Error("publish failed")
    );

    await expect(
      refreshSkillIndexSource({
        deps,
        reason: "webhook",
        sourceControlRepositoryId: 1,
      })
    ).resolves.toEqual({ status: "fresh" });

    expect(deps.replaceSkillIndexEntries).toHaveBeenCalled();
  });
```

Update `createDeps` to include a mock publisher:

```ts
    publishSkillIndexChanged: vi.fn(async () => undefined),
```

- [ ] **Step 2: Add event dependency types**

In `api/app/src/services/skills/types.ts`, add:

```ts
export interface SkillIndexChangedEvent {
  clerkOrgId: string;
  indexedCommitSha: string | null;
  lastRefreshStatus: SkillIndexRefreshStatus;
  snapshotVersion: string | null;
  sourceControlRepositoryId: number;
}
```

Add this dependency to `SkillIndexServiceDeps`:

```ts
  publishSkillIndexChanged: (event: SkillIndexChangedEvent) => Promise<void>;
```

- [ ] **Step 3: Add default publisher in `deps.ts`**

In `api/app/src/services/skills/deps.ts`, add:

```ts
import { redis } from "@vendor/upstash";
import type { SkillIndexChangedEvent } from "./types";
```

Add a local publisher:

```ts
async function publishSkillIndexChanged(event: SkillIndexChangedEvent) {
  await redis.publish(
    `lightfast:org:${event.clerkOrgId}:skills:index`,
    JSON.stringify({
      type: "skill_index.changed",
      ...event,
      occurredAt: new Date().toISOString(),
    })
  );
}
```

Add to `defaultSkillIndexServiceDeps`:

```ts
  publishSkillIndexChanged,
```

- [ ] **Step 4: Publish after terminal refresh states**

In `api/app/src/services/skills/refresh.ts`, add a helper at the bottom:

```ts
async function publishCurrentSkillIndexState(input: {
  candidate: SkillIndexableSourceControlRepositoryCandidate;
  deps: SkillIndexServiceDeps;
  sourceControlRepositoryId: number;
}) {
  const state = await input.deps.getSkillIndexStateBySourceControlRepositoryId(
    input.deps.db,
    {
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }
  );
  if (!state) {
    return;
  }
  await input.deps.publishSkillIndexChanged({
    clerkOrgId: input.candidate.binding.clerkOrgId,
    indexedCommitSha: state.indexedCommitSha,
    lastRefreshStatus: state.lastRefreshStatus,
    snapshotVersion: [
      state.id,
      state.updatedAt.getTime(),
      state.indexedCommitSha ?? "",
      state.lastRefreshStatus,
    ].join(":"),
    sourceControlRepositoryId: input.sourceControlRepositoryId,
  });
}
```

After `replaceSkillIndexEntries(...)`, before returning `{ status: "fresh" }`, add:

```ts
    await publishCurrentSkillIndexState({
      candidate,
      deps,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }).catch(() => undefined);
```

After `markSkillIndexRefreshFailed(...)` in the catch block, add:

```ts
    await publishCurrentSkillIndexState({
      candidate,
      deps,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    }).catch(() => undefined);
```

Do not publish on lock acquisition.

- [ ] **Step 5: Create the Redis event stream adapter**

Create `apps/app/src/app/(api)/api/skills/index/events/skill-index-event-stream.ts`:

```ts
import "server-only";

import { redis } from "@vendor/upstash";

type UpstashSubscription = ReturnType<typeof redis.subscribe<string>>;

export function createSkillIndexEventStream(input: {
  clerkOrgId: string;
  signal?: AbortSignal;
}) {
  const channel = `lightfast:org:${input.clerkOrgId}:skills:index`;
  const encoder = new TextEncoder();
  const subscription = redis.subscribe<string>(channel);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        controller.enqueue(encoder.encode(chunk));
      };
      const onMessage = ({ message }: { message: string }) => {
        send(`event: skill-index\ndata: ${message}\n\n`);
      };
      const keepalive = setInterval(() => {
        send(": keepalive\n\n");
      }, 25_000);

      subscription.on(`message:${channel}`, onMessage);

      input.signal?.addEventListener(
        "abort",
        () => {
          clearInterval(keepalive);
          void cleanupSubscription(subscription, channel);
          controller.close();
        },
        { once: true }
      );
    },
    async cancel() {
      await cleanupSubscription(subscription, channel);
    },
  });
}

async function cleanupSubscription(
  subscription: UpstashSubscription,
  channel: string
) {
  await subscription.unsubscribe([channel]);
  subscription.removeAllListeners();
}
```

- [ ] **Step 6: Create route tests**

Create `apps/app/src/__tests__/app/api/skills/index-events-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const createSkillIndexEventStreamMock = vi.fn();
const resolveAuthContextFromClerkMock = vi.fn();

vi.mock("@api/app/auth/identity", () => ({
  resolveAuthContextFromClerk: resolveAuthContextFromClerkMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock(
  "~/app/(api)/api/skills/index/events/skill-index-event-stream",
  () => ({
    createSkillIndexEventStream: createSkillIndexEventStreamMock,
  })
);

const { GET } = await import("~/app/(api)/api/skills/index/events/route");

beforeEach(() => {
  createSkillIndexEventStreamMock.mockReset();
  resolveAuthContextFromClerkMock.mockReset();
  resolveAuthContextFromClerkMock.mockResolvedValue({
    identity: {
      orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
      orgId: "org_123",
      type: "active",
      userId: "user_123",
    },
  });
});

describe("skill index events route", () => {
  it("opens an event stream for an active bound organization", async () => {
    const stream = new ReadableStream<Uint8Array>();
    createSkillIndexEventStreamMock.mockReturnValueOnce(stream);

    const response = await GET(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(createSkillIndexEventStreamMock).toHaveBeenCalledWith({
      clerkOrgId: "org_123",
      signal: expect.any(AbortSignal),
    });
  });

  it("rejects unauthenticated callers", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "unauthenticated" },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(createSkillIndexEventStreamMock).not.toHaveBeenCalled();
  });

  it("rejects pending callers", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: { type: "pending", userId: "user_123" },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(403);
    expect(createSkillIndexEventStreamMock).not.toHaveBeenCalled();
  });

  it("rejects active callers without a bound organization", async () => {
    resolveAuthContextFromClerkMock.mockResolvedValueOnce({
      identity: {
        orgGate: { bindingStatus: "unbound", nextSetupRequirement: "bind" },
        orgId: "org_123",
        type: "active",
        userId: "user_123",
      },
    });

    const response = await GET(createRequest());

    expect(response.status).toBe(403);
    expect(createSkillIndexEventStreamMock).not.toHaveBeenCalled();
  });
});

function createRequest() {
  return new Request("https://app.lightfast.localhost/api/skills/index/events");
}
```

- [ ] **Step 7: Create the route**

Create `apps/app/src/app/(api)/api/skills/index/events/route.ts`:

```ts
import { resolveAuthContextFromClerk } from "@api/app/auth/identity";
import { db } from "@db/app/client";
import { createSkillIndexEventStream } from "./skill-index-event-stream";

export const maxDuration = 30;

export async function GET(req: Request) {
  const authContext = await resolveAuthContextFromClerk({
    db,
    headers: req.headers,
  });
  const identity = authContext.identity;

  if (identity.type === "unauthenticated") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (identity.type !== "active") {
    return Response.json({ error: "Organization required" }, { status: 403 });
  }
  if (identity.orgGate.bindingStatus !== "bound") {
    return Response.json(
      { error: "Organization setup required" },
      { status: 403 }
    );
  }

  return new Response(
    createSkillIndexEventStream({
      clerkOrgId: identity.orgId,
      signal: req.signal,
    }),
    {
      headers: {
        "cache-control": "no-store",
        "content-type": "text/event-stream",
      },
    }
  );
}
```

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm --filter @api/app test -- skills-index-service
pnpm --filter @lightfast/app test -- "app/api/skills/index-events-route"
```

Expected: both suites pass.

- [ ] **Step 9: Commit**

```bash
git add -- \
  api/app/src/services/skills/types.ts \
  api/app/src/services/skills/deps.ts \
  api/app/src/services/skills/refresh.ts \
  api/app/src/__tests__/skills-index-service.test.ts \
  "apps/app/src/app/(api)/api/skills/index/events/skill-index-event-stream.ts" \
  "apps/app/src/app/(api)/api/skills/index/events/route.ts" \
  apps/app/src/__tests__/app/api/skills/index-events-route.test.ts
git diff --cached --name-only
git commit -m "feat(skills): publish skill index change events" -- \
  api/app/src/services/skills/types.ts \
  api/app/src/services/skills/deps.ts \
  api/app/src/services/skills/refresh.ts \
  api/app/src/__tests__/skills-index-service.test.ts \
  "apps/app/src/app/(api)/api/skills/index/events/skill-index-event-stream.ts" \
  "apps/app/src/app/(api)/api/skills/index/events/route.ts" \
  apps/app/src/__tests__/app/api/skills/index-events-route.test.ts
```

---

## Task 6: Invalidate Skills Queries From Change Events

**Files:**
- Modify: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts`
- Modify: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx`

- [ ] **Step 1: Extend controller tests with EventSource behavior**

At the top of `use-skill-index-refresh-controller.test.tsx`, add an EventSource mock:

```ts
class MockEventSource {
  static instances: MockEventSource[] = [];
  listeners = new Map<string, (event: MessageEvent) => void>();
  closed = false;
  url: string;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, listener);
  }

  close() {
    this.closed = true;
  }

  emit(type: string, data: unknown) {
    this.listeners.get(type)?.(
      new MessageEvent(type, { data: JSON.stringify(data) })
    );
  }
}

Object.defineProperty(globalThis, "EventSource", {
  configurable: true,
  value: MockEventSource,
});
```

In `beforeEach`, reset instances:

```ts
  MockEventSource.instances = [];
```

Add this test:

```tsx
  it("invalidates the skills list when a skill-index event arrives", async () => {
    const { unmount } = renderHook(() =>
      useSkillIndexRefreshController(createListData({ snapshotVersion: "v1" }))
    );

    expect(MockEventSource.instances[0]?.url).toBe(
      "/api/skills/index/events"
    );

    MockEventSource.instances[0]?.emit("skill-index", {
      snapshotVersion: "v2",
      type: "skill_index.changed",
    });

    await waitFor(() =>
      expect(invalidateQueriesMock).toHaveBeenCalledWith({
        queryKey: ["org", "workspace", "skills", "list"],
      })
    );

    unmount();
    expect(MockEventSource.instances[0]?.closed).toBe(true);
  });
```

- [ ] **Step 2: Run controller tests to verify failure**

Run:

```bash
pnpm --filter @lightfast/app test -- "skills/use-skill-index-refresh-controller"
```

Expected: fails because the hook does not create an EventSource yet.

- [ ] **Step 3: Implement EventSource invalidation**

In `use-skill-index-refresh-controller.ts`, add a second effect:

```ts
  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    const source = new EventSource("/api/skills/index/events");
    const onSkillIndex = () => {
      void queryClient.invalidateQueries(
        trpc.org.workspace.skills.list.queryFilter()
      );
    };

    source.addEventListener("skill-index", onSkillIndex);

    return () => {
      source.close();
    };
  }, [queryClient, trpc]);
```

- [ ] **Step 4: Run controller tests**

Run:

```bash
pnpm --filter @lightfast/app test -- "skills/use-skill-index-refresh-controller"
```

Expected: controller tests pass.

- [ ] **Step 5: Commit**

```bash
git add -- \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx"
git diff --cached --name-only
git commit -m "feat(skills): invalidate snapshots from index events" -- \
  "apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/use-skill-index-refresh-controller.ts" \
  "apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/use-skill-index-refresh-controller.test.tsx"
```

---

## Task 7: Final Verification And Cleanup

**Files:**
- Modify only if previous tasks leave stale imports, type errors, or obsolete assertions.

- [ ] **Step 1: Search for lingering read-time freshness callers**

Run:

```bash
rg -n "ensureFreshSkillIndexForRead" api/app/src apps/app/src
```

Expected: either only tests covering legacy behavior remain, or no production callers remain. Production callers should not include `workspace-skills.ts` or `apps/app/src/app/(chat)/api/chat/route.ts`.

- [ ] **Step 2: Search for TanStack DB additions**

Run:

```bash
rg -n "@tanstack/db|@tanstack/react-db" package.json apps/app/package.json pnpm-lock.yaml apps/app/src
```

Expected: no matches. TanStack DB is deferred.

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm --filter @api/app test -- skills-index-service workspace-skills-router skills-index-workflows
pnpm --filter @lightfast/app test -- "skills" "app/api/chat/route.test" "app/api/skills/index-events-route"
```

Expected: all focused tests pass.

- [ ] **Step 4: Run type/build checks**

Run:

```bash
pnpm --filter @api/app build
pnpm build:app
pnpm check
pnpm typecheck
```

Expected: all commands pass.

- [ ] **Step 5: Confirm no cleanup commit is needed**

Run:

```bash
git status --short
```

Expected: no uncommitted files. If this command lists files, do not create a generic cleanup commit from this step; add a new task to this plan with the exact files, tests, and commit command for the cleanup.

---

## Execution Recommendation

Use subagent-driven execution for Tasks 1-3 and 5-6, with the main thread reviewing after each task. Task 4 is also safe for a subagent, but it touches the visible Skills page client, so review the patch before continuing to events.

Suggested batches:

1. Task 1 - snapshot service.
2. Task 2 - refresh command and tRPC router.
3. Task 3 - assistant snapshot read.
4. Task 4 - client refresh controller.
5. Task 5 - event publishing and SSE route.
6. Task 6 - EventSource invalidation.
7. Task 7 - final verification.

Stop after Task 3 if product wants to ship the latency fix before live browser updates. Tasks 4-6 improve responsiveness after background refresh completion, but Tasks 1-3 remove the main render-time GitHub coupling.
