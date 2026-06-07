# GitHub PR Webhook Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-only raw GitHub PR webhook index for explicitly opted-in source-control repositories.

**Architecture:** Extend the existing signed GitHub webhook endpoint. `@repo/source-control-contract` owns generic watched webhook event vocabulary, `@repo/github-app-contract` owns GitHub payload parsing and stable routing extraction, `@db/app` owns durable repository watch and PR delivery persistence, and `api/app` owns webhook routing policy. The push webhook path remains unchanged.

**Tech Stack:** TypeScript, pnpm, Turborepo, Zod, Drizzle ORM on PlanetScale MySQL, Vitest, Next.js route handlers.

---

## File Structure

- Modify `packages/source-control-contract/src/index.ts` to add generic PR webhook watch event constants, schemas, and normalization helpers.
- Modify `packages/source-control-contract/src/__tests__/source-control-contract.test.ts` to test empty/default watch lists, accepted families, and invalid event names.
- Modify `packages/github-app-contract/src/github-app.ts` to add GitHub PR-family payload schemas and a normalizer that extracts stable routing fields.
- Modify `packages/github-app-contract/src/index.ts` to export the new schemas, constants, types, and normalizer.
- Modify `packages/github-app-contract/src/__tests__/github-app.test.ts` to test all accepted event families, PR-attached issue comments, non-PR issue comments, and PR number requirements.
- Modify `db/app/src/schema/tables/org-source-control-repositories.ts` to add `watchedWebhookEvents` and the PR webhook delivery table.
- Modify `db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, and `db/app/src/index.ts` to export new table/types/helpers.
- Modify `db/app/src/utils/source-control-repositories.ts` to default repository webhook watches to `[]` and add PR delivery dedupe helpers.
- Modify `db/app/src/__tests__/source-control-repositories.test.ts` to cover repository watch defaults and PR delivery persistence.
- Modify `api/app/src/services/github/webhook/handler.ts` to route PR-family webhooks after signature verification.
- Modify `api/app/src/__tests__/github-webhook.test.ts` to cover accepted, ignored, duplicate, and malformed PR-family deliveries.
- Modify `emulators/github/src/fixtures.ts` so the local GitHub App subscribes to PR review/comment/thread families.
- Modify `emulators/github/src/__tests__/server.test.ts` to assert the seeded app includes the PR webhook families.
- Generate Drizzle migration files under `db/app/src/migrations/` with `pnpm db:generate`.

## Task 1: Source-Control Webhook Watch Contract

**Files:**
- Modify: `packages/source-control-contract/src/__tests__/source-control-contract.test.ts`
- Modify: `packages/source-control-contract/src/index.ts`

- [ ] **Step 1: Add failing contract tests**

In `packages/source-control-contract/src/__tests__/source-control-contract.test.ts`, add these imports to the existing import block:

```ts
  SOURCE_CONTROL_PR_WEBHOOK_EVENTS,
  normalizeWatchedWebhookEvents,
  sourceControlPrWebhookEventSchema,
  watchedWebhookEventsSchema,
  watchesWebhookEvent,
```

Add these tests after the existing `"defines repository sync statuses"` test:

```ts
  it("defines PR webhook event families", () => {
    expect(SOURCE_CONTROL_PR_WEBHOOK_EVENTS).toEqual([
      "pull_request",
      "pull_request_review",
      "pull_request_review_comment",
      "pull_request_review_thread",
      "issue_comment",
    ]);
    expect(sourceControlPrWebhookEventSchema.parse("pull_request")).toBe(
      "pull_request"
    );
    expect(
      sourceControlPrWebhookEventSchema.parse("pull_request_review_thread")
    ).toBe("pull_request_review_thread");
    expect(sourceControlPrWebhookEventSchema.safeParse("push").success).toBe(
      false
    );
  });

  it("validates watched webhook event lists with empty default support", () => {
    expect(watchedWebhookEventsSchema.parse([])).toEqual([]);
    expect(
      watchedWebhookEventsSchema.parse([
        "pull_request",
        "pull_request_review_comment",
      ])
    ).toEqual(["pull_request", "pull_request_review_comment"]);
    expect(watchedWebhookEventsSchema.safeParse(["push"]).success).toBe(false);
  });

  it("normalizes nullable watched webhook events", () => {
    expect(normalizeWatchedWebhookEvents(null)).toEqual([]);
    expect(normalizeWatchedWebhookEvents(undefined)).toEqual([]);
    expect(
      normalizeWatchedWebhookEvents(["pull_request", "issue_comment"])
    ).toEqual(["pull_request", "issue_comment"]);
  });

  it("checks whether a repository watches a webhook event family", () => {
    expect(watchesWebhookEvent(["pull_request"], "pull_request")).toBe(true);
    expect(watchesWebhookEvent(["pull_request"], "issue_comment")).toBe(false);
    expect(watchesWebhookEvent(null, "pull_request")).toBe(false);
    expect(watchesWebhookEvent([], "push")).toBe(false);
  });
```

- [ ] **Step 2: Run the source-control contract test and verify it fails**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
```

Expected: FAIL with missing exports for `SOURCE_CONTROL_PR_WEBHOOK_EVENTS`, `sourceControlPrWebhookEventSchema`, `watchedWebhookEventsSchema`, `normalizeWatchedWebhookEvents`, and `watchesWebhookEvent`.

- [ ] **Step 3: Implement webhook watch vocabulary**

In `packages/source-control-contract/src/index.ts`, add this block after `SOURCE_CONTROL_REPOSITORY_SYNC_STATUSES`:

```ts
export const SOURCE_CONTROL_PR_WEBHOOK_EVENTS = [
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "issue_comment",
] as const;
```

Add this schema block after `sourceControlRepositorySyncStatusSchema`:

```ts
export const sourceControlPrWebhookEventSchema = z.enum(
  SOURCE_CONTROL_PR_WEBHOOK_EVENTS
);

export const watchedWebhookEventsSchema = z.array(
  sourceControlPrWebhookEventSchema
);
```

Add these types after `SourceControlRepositorySyncStatus`:

```ts
export type SourceControlPrWebhookEvent = z.infer<
  typeof sourceControlPrWebhookEventSchema
>;

export type WatchedWebhookEvents = z.infer<typeof watchedWebhookEventsSchema>;
```

Add these helpers after `watchedPathGlobsSchema`:

```ts
export function normalizeWatchedWebhookEvents(
  value: WatchedWebhookEvents | null | undefined
): WatchedWebhookEvents {
  return watchedWebhookEventsSchema.parse(value ?? []);
}

export function watchesWebhookEvent(
  watchedEvents: WatchedWebhookEvents | null | undefined,
  event: string
): boolean {
  const parsedEvent = sourceControlPrWebhookEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    return false;
  }
  return normalizeWatchedWebhookEvents(watchedEvents).includes(
    parsedEvent.data
  );
}
```

- [ ] **Step 4: Run the source-control contract test and verify it passes**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/source-control-contract/src/index.ts packages/source-control-contract/src/__tests__/source-control-contract.test.ts
git commit -m "feat(source-control): add webhook watch contract"
```

## Task 2: GitHub PR Webhook Payload Contract

**Files:**
- Modify: `packages/github-app-contract/src/__tests__/github-app.test.ts`
- Modify: `packages/github-app-contract/src/github-app.ts`
- Modify: `packages/github-app-contract/src/index.ts`

- [ ] **Step 1: Add failing GitHub payload tests**

In `packages/github-app-contract/src/__tests__/github-app.test.ts`, add these imports to the existing contract import block:

```ts
  GITHUB_PR_WEBHOOK_EVENTS,
  githubPrWebhookEventSchema,
  githubPrWebhookPayloadSchema,
  normalizeGitHubPrWebhookPayload,
```

Add these test helpers above `describe("GitHub webhook schemas", () => {`:

```ts
const prInstallation = { id: 1001 };
const prRepository = {
  full_name: "lightfast-emulated/workspace",
  id: 2002,
  name: "workspace",
  owner: { login: "lightfast-emulated" },
};
const prObject = {
  id: 3003,
  number: 42,
  html_url: "https://github.example.test/lightfast-emulated/workspace/pull/42",
};
```

Add these tests inside `describe("GitHub webhook schemas", () => {` after the webhook header tests:

```ts
  it("defines GitHub PR webhook event families", () => {
    expect(GITHUB_PR_WEBHOOK_EVENTS).toEqual([
      "pull_request",
      "pull_request_review",
      "pull_request_review_comment",
      "pull_request_review_thread",
      "issue_comment",
    ]);
    expect(githubPrWebhookEventSchema.parse("pull_request_review")).toBe(
      "pull_request_review"
    );
    expect(githubPrWebhookEventSchema.safeParse("push").success).toBe(false);
  });

  it("normalizes pull_request webhook routing fields", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "synchronize",
      installation: prInstallation,
      pull_request: prObject,
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request",
        payload,
      })
    ).toEqual({
      action: "synchronize",
      event: "pull_request",
      providerInstallationId: "1001",
      providerPullRequestId: "3003",
      providerRepositoryId: "2002",
      pullRequestNumber: 42,
    });
  });

  it("normalizes pull_request_review webhook routing fields", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "submitted",
      installation: prInstallation,
      pull_request: prObject,
      repository: prRepository,
      review: { id: 4004, state: "approved" },
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request_review",
        payload,
      })
    ).toMatchObject({
      action: "submitted",
      event: "pull_request_review",
      providerPullRequestId: "3003",
      pullRequestNumber: 42,
    });
  });

  it("normalizes review comment payloads without requiring a PR id", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "created",
      comment: {
        id: 5005,
        pull_request_url:
          "https://api.github.example.test/repos/lightfast-emulated/workspace/pulls/42",
      },
      installation: prInstallation,
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request_review_comment",
        payload,
      })
    ).toEqual({
      action: "created",
      event: "pull_request_review_comment",
      providerInstallationId: "1001",
      providerPullRequestId: null,
      providerRepositoryId: "2002",
      pullRequestNumber: 42,
    });
  });

  it("normalizes review thread payloads from the pull_request object", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "resolved",
      installation: prInstallation,
      pull_request: prObject,
      repository: prRepository,
      thread: { id: 6006 },
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request_review_thread",
        payload,
      })
    ).toMatchObject({
      action: "resolved",
      event: "pull_request_review_thread",
      providerPullRequestId: "3003",
      pullRequestNumber: 42,
    });
  });

  it("normalizes PR-attached issue comments and leaves PR id nullable", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "edited",
      comment: { id: 7007, body: "Updated" },
      installation: prInstallation,
      issue: {
        number: 42,
        pull_request: {
          url: "https://api.github.example.test/repos/lightfast-emulated/workspace/pulls/42",
        },
      },
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "issue_comment",
        payload,
      })
    ).toEqual({
      action: "edited",
      event: "issue_comment",
      providerInstallationId: "1001",
      providerPullRequestId: null,
      providerRepositoryId: "2002",
      pullRequestNumber: 42,
    });
  });

  it("returns null for issue comments that are not attached to PRs", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "created",
      comment: { id: 7007, body: "Issue comment" },
      installation: prInstallation,
      issue: { number: 42 },
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "issue_comment",
        payload,
      })
    ).toBeNull();
  });

  it("rejects PR-family payloads without a pull request number", () => {
    expect(() =>
      normalizeGitHubPrWebhookPayload({
        event: "pull_request",
        payload: githubPrWebhookPayloadSchema.parse({
          action: "opened",
          installation: prInstallation,
          pull_request: { id: 3003 },
          repository: prRepository,
        }),
      })
    ).toThrow(/pull request number/i);
  });
```

- [ ] **Step 2: Run the GitHub contract tests and verify they fail**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
```

Expected: FAIL with missing exports for the PR webhook contract names.

- [ ] **Step 3: Implement PR payload schemas and normalization**

In `packages/github-app-contract/src/github-app.ts`, add this block after `normalizedGitHubPushWebhookSchema`:

```ts
export const GITHUB_PR_WEBHOOK_EVENTS = [
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "issue_comment",
] as const;

export const githubPrWebhookEventSchema = z.enum(GITHUB_PR_WEBHOOK_EVENTS);
export type GitHubPrWebhookEvent = z.infer<typeof githubPrWebhookEventSchema>;

const githubWebhookActionSchema = z.string().min(1);

const githubWebhookPullRequestRefSchema = z
  .object({
    id: githubWebhookProviderIdSchema.optional(),
    number: z.number().int().positive().optional(),
  })
  .passthrough();

const githubWebhookIssueSchema = z
  .object({
    number: z.number().int().positive().optional(),
    pull_request: z.object({}).passthrough().optional(),
  })
  .passthrough();

const githubWebhookCommentSchema = z
  .object({
    pull_request_url: z.string().url().optional(),
  })
  .passthrough();

export const githubPrWebhookPayloadSchema = z
  .object({
    action: githubWebhookActionSchema,
    comment: githubWebhookCommentSchema.optional(),
    installation: githubWebhookInstallationSchema,
    issue: githubWebhookIssueSchema.optional(),
    pull_request: githubWebhookPullRequestRefSchema.optional(),
    repository: githubWebhookRepositorySchema,
  })
  .passthrough();
export type GitHubPrWebhookPayload = z.infer<
  typeof githubPrWebhookPayloadSchema
>;

export const normalizedGitHubPrWebhookSchema = z.object({
  action: githubWebhookActionSchema,
  event: githubPrWebhookEventSchema,
  providerInstallationId: z.string().min(1),
  providerPullRequestId: z.string().min(1).nullable(),
  providerRepositoryId: z.string().min(1),
  pullRequestNumber: z.number().int().positive(),
});
export type NormalizedGitHubPrWebhook = z.infer<
  typeof normalizedGitHubPrWebhookSchema
>;

function parsePullRequestNumberFromUrl(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const match = /\/pulls?\/([1-9][0-9]*)(?:$|[/?#])/.exec(value);
  return match ? Number(match[1]) : null;
}

function requirePullRequestNumber(
  event: GitHubPrWebhookEvent,
  payload: GitHubPrWebhookPayload
): number {
  const number =
    payload.pull_request?.number ??
    payload.issue?.number ??
    parsePullRequestNumberFromUrl(payload.comment?.pull_request_url);

  if (!number) {
    throw new Error(
      `GitHub ${event} webhook payload is missing a pull request number.`
    );
  }
  return number;
}

function getProviderPullRequestId(
  payload: GitHubPrWebhookPayload
): string | null {
  return payload.pull_request?.id === undefined
    ? null
    : String(payload.pull_request.id);
}

export function normalizeGitHubPrWebhookPayload(input: {
  event: GitHubPrWebhookEvent;
  payload: GitHubPrWebhookPayload;
}): NormalizedGitHubPrWebhook | null {
  if (input.event === "issue_comment" && !input.payload.issue?.pull_request) {
    return null;
  }

  return normalizedGitHubPrWebhookSchema.parse({
    action: input.payload.action,
    event: input.event,
    providerInstallationId: String(input.payload.installation.id),
    providerPullRequestId: getProviderPullRequestId(input.payload),
    providerRepositoryId: String(input.payload.repository.id),
    pullRequestNumber: requirePullRequestNumber(input.event, input.payload),
  });
}
```

- [ ] **Step 4: Export the new GitHub contract**

In `packages/github-app-contract/src/index.ts`, add these exports to the existing export block:

```ts
  GITHUB_PR_WEBHOOK_EVENTS,
  type GitHubPrWebhookEvent,
  type GitHubPrWebhookPayload,
  githubPrWebhookEventSchema,
  githubPrWebhookPayloadSchema,
  type NormalizedGitHubPrWebhook,
  normalizedGitHubPrWebhookSchema,
  normalizeGitHubPrWebhookPayload,
```

- [ ] **Step 5: Run the GitHub contract tests and verify they pass**

Run:

```bash
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add packages/github-app-contract/src/github-app.ts packages/github-app-contract/src/index.ts packages/github-app-contract/src/__tests__/github-app.test.ts
git commit -m "feat(github): add pr webhook payload contract"
```

## Task 3: Source-Control Repository Schema And PR Delivery Helpers

**Files:**
- Modify: `db/app/src/__tests__/source-control-repositories.test.ts`
- Modify: `db/app/src/schema/tables/org-source-control-repositories.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/utils/source-control-repositories.ts`

- [ ] **Step 1: Add failing DB helper tests**

In `db/app/src/__tests__/source-control-repositories.test.ts`, update the type import from `../schema` to include `SourceControlPrWebhookDelivery`:

```ts
import type {
  SourceControlPrWebhookDelivery,
  SourceControlRepository,
  SourceControlWebhookDelivery,
} from "../schema";
```

Update the utility import from `../utils/source-control-repositories` to include:

```ts
  getSourceControlPrWebhookDeliveryByDeliveryId,
  recordSourceControlPrWebhookDelivery,
```

In the `"upserts watched repository and returns the stored row"` test, update the `valuesMock` assertion to include `watchedWebhookEvents: []`:

```ts
    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/project",
      orgSourceControlBindingId: 10,
      providerRepositoryId: "repo-1",
      syncStatus: "enabled",
      watchedPathGlobs: ["src/**"],
      watchedWebhookEvents: [],
    });
```

Update the `onDuplicateKeyUpdateMock` assertion in that same test to include `watchedWebhookEvents: []`:

```ts
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/project",
        syncStatus: "enabled",
        watchedPathGlobs: ["src/**"],
        watchedWebhookEvents: [],
      },
    });
```

In the `"inserts registered repository without watch globs"` test, update the `valuesMock` assertion:

```ts
    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/workspace",
      orgSourceControlBindingId: 7,
      providerRepositoryId: "repo-2",
      syncStatus: "disabled",
      watchedPathGlobs: null,
      watchedWebhookEvents: [],
    });
```

Add this test after `"inserts registered repository without watch globs"`:

```ts
  it("stores explicit watched webhook events on repository upsert", async () => {
    const repository = createWatchedRepository({
      id: 32,
      providerRepositoryId: "repo-3",
      watchedWebhookEvents: ["pull_request", "issue_comment"],
    });
    const limitMock = vi.fn(() => [repository]);
    const selectWhereMock = vi.fn(() => ({ limit: limitMock }));
    const fromMock = vi.fn(() => ({ where: selectWhereMock }));
    const onDuplicateKeyUpdateMock = vi.fn(() => Promise.resolve());
    const valuesMock = vi.fn(() => ({
      onDuplicateKeyUpdate: onDuplicateKeyUpdateMock,
    }));
    const db = {
      insert: vi.fn(() => ({ values: valuesMock })),
      select: vi.fn(() => ({ from: fromMock })),
    } as unknown as Database;

    await expect(
      upsertWatchedSourceControlRepository(db, {
        fullName: "acme/project",
        orgSourceControlBindingId: 10,
        providerRepositoryId: "repo-3",
        watchedPathGlobs: null,
        watchedWebhookEvents: ["pull_request", "issue_comment"],
      })
    ).resolves.toBe(repository);

    expect(valuesMock).toHaveBeenCalledWith({
      fullName: "acme/project",
      orgSourceControlBindingId: 10,
      providerRepositoryId: "repo-3",
      syncStatus: "enabled",
      watchedPathGlobs: null,
      watchedWebhookEvents: ["pull_request", "issue_comment"],
    });
    expect(onDuplicateKeyUpdateMock).toHaveBeenCalledWith({
      set: {
        fullName: "acme/project",
        syncStatus: "enabled",
        watchedPathGlobs: null,
        watchedWebhookEvents: ["pull_request", "issue_comment"],
      },
    });
  });
```

Add these tests after the existing webhook delivery tests:

```ts
  it("returns inserted PR webhook delivery with created true", async () => {
    const delivery = createPrWebhookDelivery({
      id: 101,
      deliveryId: "delivery-pr-1",
    });
    const db = createSelectInsertDb({
      selectResults: [[], [delivery]],
    });

    await expect(
      recordSourceControlPrWebhookDelivery(db, {
        action: "opened",
        clerkOrgId: "org_123",
        deliveryId: "delivery-pr-1",
        event: "pull_request",
        orgSourceControlBindingId: 7,
        providerInstallationId: "1001",
        providerPullRequestId: "3003",
        providerRepositoryId: "2002",
        pullRequestNumber: 42,
        rawPayload: { action: "opened" },
        sourceControlRepositoryId: 9,
      })
    ).resolves.toEqual({ delivery, created: true });
  });

  it("returns existing PR webhook delivery with created false after duplicate-key recovery", async () => {
    const delivery = createPrWebhookDelivery({
      id: 102,
      deliveryId: "delivery-pr-2",
    });
    const db = createSelectInsertDb({
      insertError: { code: "ER_DUP_ENTRY" },
      selectResults: [[], [delivery]],
    });

    await expect(
      recordSourceControlPrWebhookDelivery(db, {
        action: "edited",
        clerkOrgId: "org_123",
        deliveryId: "delivery-pr-2",
        event: "issue_comment",
        orgSourceControlBindingId: 7,
        providerInstallationId: "1001",
        providerPullRequestId: null,
        providerRepositoryId: "2002",
        pullRequestNumber: 42,
        rawPayload: { action: "edited" },
        sourceControlRepositoryId: 9,
      })
    ).resolves.toEqual({ delivery, created: false });
  });
```

Add this helper near `createWebhookDelivery`:

```ts
function createPrWebhookDelivery(
  overrides: Partial<SourceControlPrWebhookDelivery> = {}
): SourceControlPrWebhookDelivery {
  const now = new Date("2026-06-06T00:00:00.000Z");
  return {
    id: 1,
    action: "opened",
    clerkOrgId: "org_123",
    deliveryId: "delivery-pr-1",
    event: "pull_request",
    orgSourceControlBindingId: 7,
    providerInstallationId: "1001",
    providerPullRequestId: "3003",
    providerRepositoryId: "2002",
    pullRequestNumber: 42,
    rawPayload: { action: "opened" },
    sourceControlRepositoryId: 9,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
```

Update `createWatchedRepository` to include the new property:

```ts
    watchedWebhookEvents: [],
```

- [ ] **Step 2: Run DB helper tests and verify they fail**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts
```

Expected: FAIL with missing `SourceControlPrWebhookDelivery`, missing helper exports, and mismatched insert values because `watchedWebhookEvents` is not implemented.

- [ ] **Step 3: Extend source-control repository schema**

In `db/app/src/schema/tables/org-source-control-repositories.ts`, update the type import from `@repo/source-control-contract`:

```ts
import type {
  SourceControlPrWebhookEvent,
  SourceControlRepositorySyncStatus,
  SourceControlWebhookDeliveryStatus,
  WatchedPathGlobs,
} from "@repo/source-control-contract";
```

Add this field after `watchedPathGlobs` in `orgSourceControlRepositories`:

```ts
    watchedWebhookEvents: json(
      "watched_webhook_events"
    ).$type<SourceControlPrWebhookEvent[] | null>(),
```

Add this table after `orgSourceControlWebhookDeliveries`:

```ts
export const orgSourceControlPrWebhookDeliveries = mysqlTable(
  "lightfast_org_source_control_pr_webhook_deliveries",
  {
    id: bigint("id", { mode: "number", unsigned: true })
      .primaryKey()
      .autoincrement(),

    deliveryId: varchar("delivery_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    clerkOrgId: varchar("clerk_org_id", { length: 64 }).notNull(),

    orgSourceControlBindingId: bigint("org_source_control_binding_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    sourceControlRepositoryId: bigint("source_control_repository_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    providerInstallationId: varchar("provider_installation_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    providerRepositoryId: varchar("provider_repository_id", {
      length: PROVIDER_REF_LENGTH,
    }).notNull(),

    event: varchar("event", { length: CODE_LENGTH }).notNull(),

    action: varchar("action", { length: CODE_LENGTH }).notNull(),

    providerPullRequestId: varchar("provider_pull_request_id", {
      length: PROVIDER_REF_LENGTH,
    }),

    pullRequestNumber: bigint("pull_request_number", {
      mode: "number",
      unsigned: true,
    }).notNull(),

    rawPayload: json("raw_payload")
      .$type<Record<string, unknown>>()
      .notNull(),

    createdAt: datetime("created_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .notNull(),

    updatedAt: datetime("updated_at", { mode: "date", fsp: 3 })
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => ({
    deliveryUq: uniqueIndex(
      "org_source_control_pr_webhook_deliveries_delivery_uq"
    ).on(table.deliveryId),
    orgCreatedIdx: index(
      "org_source_control_pr_webhook_deliveries_org_created_idx"
    ).on(table.clerkOrgId, table.createdAt, table.id),
    repoPrIdx: index("org_source_control_pr_webhook_deliveries_repo_pr_idx").on(
      table.sourceControlRepositoryId,
      table.pullRequestNumber,
      table.createdAt,
      table.id
    ),
    providerRepoIdx: index(
      "org_source_control_pr_webhook_deliveries_provider_repo_idx"
    ).on(
      table.providerInstallationId,
      table.providerRepositoryId,
      table.createdAt,
      table.id
    ),
  })
);
```

Add these types after the existing delivery types:

```ts
export type SourceControlPrWebhookDelivery =
  typeof orgSourceControlPrWebhookDeliveries.$inferSelect;
export type InsertSourceControlPrWebhookDelivery =
  typeof orgSourceControlPrWebhookDeliveries.$inferInsert;
```

- [ ] **Step 4: Export new schema types and table**

In `db/app/src/schema/tables/index.ts` and `db/app/src/schema/index.ts`, add these exports alongside the existing source-control repository exports:

```ts
  type InsertSourceControlPrWebhookDelivery,
  orgSourceControlPrWebhookDeliveries,
  type SourceControlPrWebhookDelivery,
```

- [ ] **Step 5: Implement DB helpers**

In `db/app/src/utils/source-control-repositories.ts`, update imports:

```ts
import type {
  SourceControlPrWebhookEvent,
  SourceControlRepositorySyncStatus,
  SourceControlWebhookDeliveryStatus,
  WatchedPathGlobs,
} from "@repo/source-control-contract";
```

Update the schema type import to include:

```ts
  SourceControlPrWebhookDelivery,
```

Update the schema import to include:

```ts
  orgSourceControlPrWebhookDeliveries as sourceControlPrWebhookDeliveries,
```

Add a selection constant after `deliverySelection`:

```ts
const prDeliverySelection = getTableColumns(sourceControlPrWebhookDeliveries);
```

Update `UpsertWatchedSourceControlRepositoryInput`:

```ts
  watchedWebhookEvents?: SourceControlPrWebhookEvent[] | null;
```

In the repository insert values inside `insertWatchedSourceControlRepository` and `upsertWatchedSourceControlRepository`, add this property:

```ts
      watchedWebhookEvents: input.watchedWebhookEvents ?? [],
```

In the `onDuplicateKeyUpdate` set for repository upserts, add:

```ts
        watchedWebhookEvents: input.watchedWebhookEvents ?? [],
```

Add these interfaces and helpers after `RecordSourceControlWebhookDeliveryReceivedResult`:

```ts
export interface RecordSourceControlPrWebhookDeliveryInput {
  action: string;
  clerkOrgId: string;
  deliveryId: string;
  event: SourceControlPrWebhookEvent;
  orgSourceControlBindingId: number;
  providerInstallationId: string;
  providerPullRequestId: string | null;
  providerRepositoryId: string;
  pullRequestNumber: number;
  rawPayload: Record<string, unknown>;
  sourceControlRepositoryId: number;
}

export interface RecordSourceControlPrWebhookDeliveryResult {
  created: boolean;
  delivery: SourceControlPrWebhookDelivery;
}
```

Add these functions after `recordSourceControlWebhookDeliveryReceived`:

```ts
export async function getSourceControlPrWebhookDeliveryByDeliveryId(
  db: Database,
  input: { deliveryId: string }
): Promise<SourceControlPrWebhookDelivery | undefined> {
  const [row] = await db
    .select(prDeliverySelection)
    .from(sourceControlPrWebhookDeliveries)
    .where(eq(sourceControlPrWebhookDeliveries.deliveryId, input.deliveryId))
    .limit(1);
  return row;
}

export async function recordSourceControlPrWebhookDelivery(
  db: Database,
  input: RecordSourceControlPrWebhookDeliveryInput
): Promise<RecordSourceControlPrWebhookDeliveryResult> {
  const existing = await getSourceControlPrWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  if (existing) {
    return { delivery: existing, created: false };
  }

  let duplicateError: unknown;
  await db
    .insert(sourceControlPrWebhookDeliveries)
    .values({
      action: input.action,
      clerkOrgId: input.clerkOrgId,
      deliveryId: input.deliveryId,
      event: input.event,
      orgSourceControlBindingId: input.orgSourceControlBindingId,
      providerInstallationId: input.providerInstallationId,
      providerPullRequestId: input.providerPullRequestId,
      providerRepositoryId: input.providerRepositoryId,
      pullRequestNumber: input.pullRequestNumber,
      rawPayload: input.rawPayload,
      sourceControlRepositoryId: input.sourceControlRepositoryId,
    })
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      duplicateError = error;
    });

  const inserted = await getSourceControlPrWebhookDeliveryByDeliveryId(db, {
    deliveryId: input.deliveryId,
  });
  if (!inserted) {
    if (duplicateError) {
      throw duplicateError;
    }
    throw new Error(`Failed to create PR webhook delivery ${input.deliveryId}`);
  }
  return { delivery: inserted, created: duplicateError === undefined };
}
```

- [ ] **Step 6: Export DB helpers**

In `db/app/src/index.ts`, add these exports to the existing `./utils/source-control-repositories` export block:

```ts
  getSourceControlPrWebhookDeliveryByDeliveryId,
  type RecordSourceControlPrWebhookDeliveryInput,
  type RecordSourceControlPrWebhookDeliveryResult,
  recordSourceControlPrWebhookDelivery,
```

- [ ] **Step 7: Run DB helper tests and verify they pass**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add db/app/src/__tests__/source-control-repositories.test.ts db/app/src/schema/tables/org-source-control-repositories.ts db/app/src/schema/tables/index.ts db/app/src/schema/index.ts db/app/src/index.ts db/app/src/utils/source-control-repositories.ts
git commit -m "feat(db): add source control pr webhook deliveries"
```

## Task 4: GitHub Webhook Handler PR Routing

**Files:**
- Modify: `api/app/src/__tests__/github-webhook.test.ts`
- Modify: `api/app/src/services/github/webhook/handler.ts`

- [ ] **Step 1: Add failing webhook service tests**

In `api/app/src/__tests__/github-webhook.test.ts`, add a mock:

```ts
const recordPrDeliveryMock = vi.fn();
```

Update the existing `vi.mock("@db/app", () => ({ ... }))` factory block by adding this property to the returned object:

```ts
  recordSourceControlPrWebhookDelivery: recordPrDeliveryMock,
```

Reset the mock in `beforeEach`:

```ts
    recordPrDeliveryMock.mockReset();
```

Add this payload after `pushPayload`:

```ts
const pullRequestPayload = {
  action: "opened",
  installation: { id: 1001 },
  pull_request: {
    id: 3003,
    number: 42,
    html_url: "https://github.lightfast.test/lightfast-emulated/workspace/pull/42",
  },
  repository: {
    full_name: "lightfast-emulated/workspace",
    id: 2002,
    name: "workspace",
    owner: { login: "lightfast-emulated" },
  },
};

const issueCommentPayload = {
  action: "created",
  comment: { id: 7007, body: "Looks good" },
  installation: { id: 1001 },
  issue: {
    number: 42,
    pull_request: {
      url: "https://api.github.test/repos/lightfast-emulated/workspace/pulls/42",
    },
  },
  repository: {
    full_name: "lightfast-emulated/workspace",
    id: 2002,
    name: "workspace",
    owner: { login: "lightfast-emulated" },
  },
};
```

Add these tests before `"does not mark queued when enqueue fails"`:

```ts
  it("ignores PR events when the repository does not watch the event family", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    getBindingMock.mockResolvedValue({
      clerkOrgId: "org_123",
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      syncStatus: "enabled",
      watchedPathGlobs: ["skills/**"],
      watchedWebhookEvents: [],
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(
        pullRequestPayload,
        "delivery-pr-unwatched",
        "pull_request"
      ),
    });

    expect(res.status).toBe(202);
    expect(recordPrDeliveryMock).not.toHaveBeenCalled();
    expect(recordDeliveryMock).not.toHaveBeenCalled();
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("stores watched PR event raw payloads without checking sync status or path globs", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    getBindingMock.mockResolvedValue({
      clerkOrgId: "org_123",
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      fullName: "lightfast-emulated/workspace",
      id: 9,
      providerRepositoryId: "2002",
      syncStatus: "disabled",
      watchedPathGlobs: null,
      watchedWebhookEvents: ["pull_request"],
    });
    recordPrDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { deliveryId: "delivery-pr-1" },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(pullRequestPayload, "delivery-pr-1", "pull_request"),
    });

    expect(res.status).toBe(202);
    expect(recordPrDeliveryMock).toHaveBeenCalledWith(
      {},
      {
        action: "opened",
        clerkOrgId: "org_123",
        deliveryId: "delivery-pr-1",
        event: "pull_request",
        orgSourceControlBindingId: 7,
        providerInstallationId: "1001",
        providerPullRequestId: "3003",
        providerRepositoryId: "2002",
        pullRequestNumber: 42,
        rawPayload: pullRequestPayload,
        sourceControlRepositoryId: 9,
      }
    );
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("stores watched PR-attached issue comments with nullable PR id", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    getBindingMock.mockResolvedValue({
      clerkOrgId: "org_123",
      id: 7,
      providerInstallationId: "1001",
      status: "active",
    });
    getWatchMock.mockResolvedValue({
      id: 9,
      providerRepositoryId: "2002",
      syncStatus: "enabled",
      watchedPathGlobs: ["**"],
      watchedWebhookEvents: ["issue_comment"],
    });
    recordPrDeliveryMock.mockResolvedValue({
      created: true,
      delivery: { deliveryId: "delivery-issue-comment-1" },
    });

    const res = await handleGitHubWebhook({
      request: signedRequest(
        issueCommentPayload,
        "delivery-issue-comment-1",
        "issue_comment"
      ),
    });

    expect(res.status).toBe(202);
    expect(recordPrDeliveryMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        event: "issue_comment",
        providerPullRequestId: null,
        pullRequestNumber: 42,
        rawPayload: issueCommentPayload,
      })
    );
  });

  it("ignores issue comments that are not attached to PRs", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    const res = await handleGitHubWebhook({
      request: signedRequest(
        {
          ...issueCommentPayload,
          issue: { number: 42 },
        },
        "delivery-issue-comment-non-pr",
        "issue_comment"
      ),
    });

    expect(res.status).toBe(202);
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(recordPrDeliveryMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed signed PR payloads before persistence", async () => {
    const { handleGitHubWebhook } = await import("../services/github/webhook");
    const res = await handleGitHubWebhook({
      request: signedRequest(
        {
          ...pullRequestPayload,
          pull_request: { id: 3003 },
        },
        "delivery-pr-malformed",
        "pull_request"
      ),
    });

    expect(res.status).toBe(400);
    expect(getBindingMock).not.toHaveBeenCalled();
    expect(recordPrDeliveryMock).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run webhook tests and verify they fail**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-webhook.test.ts
```

Expected: FAIL because `recordSourceControlPrWebhookDelivery` is not called and PR events are still treated as unsupported.

- [ ] **Step 3: Extend the webhook handler imports**

In `api/app/src/services/github/webhook/handler.ts`, update the `@db/app` import to include:

```ts
  recordSourceControlPrWebhookDelivery,
```

Update the `@repo/github-app-contract` import to include:

```ts
  githubPrWebhookEventSchema,
  githubPrWebhookPayloadSchema,
  normalizeGitHubPrWebhookPayload,
```

Update the `@repo/source-control-contract` import to include:

```ts
  watchesWebhookEvent,
```

- [ ] **Step 4: Add PR webhook handling code**

In `api/app/src/services/github/webhook/handler.ts`, add this helper after `readHeaders`:

```ts
async function handleGitHubPrWebhook(input: {
  deliveryId: string;
  event: string;
  json: unknown;
}): Promise<Response> {
  const parsedEvent = githubPrWebhookEventSchema.safeParse(input.event);
  if (!parsedEvent.success) {
    return response(202, { ok: true, ignored: true });
  }

  const parsedPayload = githubPrWebhookPayloadSchema.safeParse(input.json);
  if (!parsedPayload.success) {
    return response(400, { ok: false });
  }

  let normalized;
  try {
    normalized = normalizeGitHubPrWebhookPayload({
      event: parsedEvent.data,
      payload: parsedPayload.data,
    });
  } catch {
    return response(400, { ok: false });
  }

  if (!normalized) {
    return response(202, { ok: true, ignored: true });
  }

  const binding = await getOrgBindingByProviderInstallation(db, {
    provider: "github",
    providerInstallationId: normalized.providerInstallationId,
  });
  if (!binding || binding.status !== "active") {
    return response(202, { ok: true, ignored: true });
  }

  const watch = await getWatchedSourceControlRepository(db, {
    orgSourceControlBindingId: binding.id,
    providerRepositoryId: normalized.providerRepositoryId,
  });
  if (!watch) {
    return response(202, { ok: true, ignored: true });
  }

  if (!watchesWebhookEvent(watch.watchedWebhookEvents, normalized.event)) {
    return response(202, { ok: true, ignored: true });
  }

  await recordSourceControlPrWebhookDelivery(db, {
    action: normalized.action,
    clerkOrgId: binding.clerkOrgId,
    deliveryId: input.deliveryId,
    event: normalized.event,
    orgSourceControlBindingId: binding.id,
    providerInstallationId: normalized.providerInstallationId,
    providerPullRequestId: normalized.providerPullRequestId,
    providerRepositoryId: normalized.providerRepositoryId,
    pullRequestNumber: normalized.pullRequestNumber,
    rawPayload: parsedPayload.data,
    sourceControlRepositoryId: watch.id,
  });

  return response(202, { ok: true });
}
```

In `handleGitHubWebhook`, replace this block:

```ts
  if (headers.event !== "ping" && headers.event !== "push") {
    return response(202, { ok: true, ignored: true });
  }
```

with this block:

```ts
  const isPrWebhookEvent = githubPrWebhookEventSchema.safeParse(
    headers.event
  ).success;
  if (headers.event !== "ping" && headers.event !== "push" && !isPrWebhookEvent) {
    return response(202, { ok: true, ignored: true });
  }
```

After the existing `ping` branch, add:

```ts
  if (isPrWebhookEvent) {
    return await handleGitHubPrWebhook({
      deliveryId: headers.deliveryId,
      event: headers.event,
      json,
    });
  }
```

The existing push handling code remains after this new branch.

- [ ] **Step 5: Run webhook tests and verify they pass**

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/github-webhook.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add api/app/src/services/github/webhook/handler.ts api/app/src/__tests__/github-webhook.test.ts
git commit -m "feat(api): index watched github pr webhooks"
```

## Task 5: Emulator GitHub App Event Subscriptions

**Files:**
- Modify: `emulators/github/src/fixtures.ts`
- Modify: `emulators/github/src/__tests__/server.test.ts`

- [ ] **Step 1: Add failing emulator seed assertion**

In `emulators/github/src/__tests__/server.test.ts`, inside `"does not require an app-owned webhook URL in the default seed"`, add this assertion after the `webhook_secret` assertion:

```ts
    expect(app?.events).toEqual(
      expect.arrayContaining([
        "issue_comment",
        "pull_request",
        "pull_request_review",
        "pull_request_review_comment",
        "pull_request_review_thread",
        "push",
      ])
    );
```

- [ ] **Step 2: Run emulator test and verify it fails**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: FAIL because the seeded app does not include the new PR review/comment/thread event families.

- [ ] **Step 3: Update emulator fixtures**

In `emulators/github/src/fixtures.ts`, replace:

```ts
        events: ["issues", "pull_request", "push"],
```

with:

```ts
        events: [
          "issue_comment",
          "pull_request",
          "pull_request_review",
          "pull_request_review_comment",
          "pull_request_review_thread",
          "push",
        ],
```

- [ ] **Step 4: Run emulator test and verify it passes**

Run:

```bash
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add emulators/github/src/fixtures.ts emulators/github/src/__tests__/server.test.ts
git commit -m "chore(github-emulator): subscribe to pr webhook families"
```

## Task 6: Migration, Audits, And Focused Verification

**Files:**
- Modify: `db/app/src/migrations/*`
- Modify: `db/app/src/migrations/meta/*`

- [ ] **Step 1: Generate the Drizzle migration**

Run from the workspace root:

```bash
pnpm db:generate
```

Expected: Drizzle creates a new SQL migration and updates the latest migration snapshot. Confirm the generated SQL contains these concrete fragments:

```sql
ALTER TABLE `lightfast_org_source_control_repositories` ADD `watched_webhook_events` json;
CREATE TABLE `lightfast_org_source_control_pr_webhook_deliveries`
`delivery_id` varchar(128) NOT NULL
`raw_payload` json NOT NULL
CREATE UNIQUE INDEX `org_source_control_pr_webhook_deliveries_delivery_uq`
CREATE INDEX `org_source_control_pr_webhook_deliveries_org_created_idx`
CREATE INDEX `org_source_control_pr_webhook_deliveries_repo_pr_idx`
CREATE INDEX `org_source_control_pr_webhook_deliveries_provider_repo_idx`
```

The exact generated SQL may include statement-breakpoint comments and index statements. Keep the generated files as-is unless a generated index name violates `schema-conventions.test.ts`.

- [ ] **Step 2: Run schema convention tests**

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/schema-conventions.test.ts
```

Expected: PASS. If it fails because the table file allowlist changed, do not add a new schema file; this plan keeps the new table inside `org-source-control-repositories.ts`.

- [ ] **Step 3: Run DB audit**

Run:

```bash
pnpm --filter @db/app db:audit
```

Expected: PASS.

- [ ] **Step 4: Run focused package tests**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts
pnpm --filter @api/app test -- src/__tests__/github-webhook.test.ts
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: all commands PASS.

- [ ] **Step 5: Run typechecks for touched packages**

Run:

```bash
pnpm --filter @repo/source-control-contract typecheck
pnpm --filter @repo/github-app-contract typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @repo/github-emulator typecheck
```

Expected: all commands PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add db/app/src/migrations db/app/src/migrations/meta
git commit -m "db: add pr webhook index migration"
```

## Task 7: Final Cross-Check

**Files:**
- Read: `docs/superpowers/specs/2026-06-06-github-pr-webhook-index-design.md`
- Read: all files changed by Tasks 1-6

- [ ] **Step 1: Confirm spec coverage**

Run:

```bash
rg -n "watchedWebhookEvents|pull_request_review_thread|rawPayload|repositoryFullName|syncStatus|watchedPathGlobs" packages/source-control-contract packages/github-app-contract db/app api/app emulators/github docs/superpowers/specs/2026-06-06-github-pr-webhook-index-design.md
```

Expected:
- `watchedWebhookEvents` appears in contract, DB schema/helpers, and API routing.
- `pull_request_review_thread` appears in contract, GitHub schema tests, API tests, and emulator fixtures.
- `rawPayload` appears only in the PR delivery table/helper/test path.
- `repositoryFullName` does not appear as a PR delivery table column.
- PR API tests prove `syncStatus` and `watchedPathGlobs` are ignored for PR indexing.

- [ ] **Step 2: Run final focused verification**

Run:

```bash
pnpm --filter @repo/source-control-contract test -- src/__tests__/source-control-contract.test.ts
pnpm --filter @repo/github-app-contract test -- src/__tests__/github-app.test.ts
pnpm --filter @db/app test -- src/__tests__/source-control-repositories.test.ts src/__tests__/schema-conventions.test.ts
pnpm --filter @api/app test -- src/__tests__/github-webhook.test.ts
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
```

Expected: all commands PASS.

- [ ] **Step 3: Review git status**

Run:

```bash
git status --short
```

Expected: clean worktree after all task commits.

- [ ] **Step 4: Note production GitHub App configuration**

Add this deployment note to the pull request description:

```md
Production GitHub App settings must subscribe to these webhook events before raw PR indexing can receive them in production:
- issue_comment
- pull_request
- pull_request_review
- pull_request_review_comment
- pull_request_review_thread
```

Do not add this note to a code file; it belongs in the PR description because production GitHub App event subscriptions are external configuration.
