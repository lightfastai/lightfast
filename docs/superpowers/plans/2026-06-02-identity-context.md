# Identity Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organization-owned Identity Context sourced from `.lightfast/IDENTITY.md` and `.lightfast/SOUL.md`, display both files in Settings > General, and inject bounded `IDENTITY.md` context into Signal AI system prompts.

**Architecture:** Treat Identity Context as a separate indexed repository surface, parallel to Skills but simpler: one indexed state per verified `.lightfast` source-control repository and exactly two file rows per successful snapshot. Runtime consumers read durable indexed markdown only; they never fetch GitHub synchronously.

**Tech Stack:** pnpm monorepo, Next.js App Router, tRPC, Inngest, Drizzle ORM on PlanetScale/Vitess MySQL, GitHub App repository APIs, Vercel AI SDK-facing classifier package, `@repo/ui` MarkdownContent.

---

## Execution Notes

- Run commands from `/Users/jeevanpillay/.codex/worktrees/b43e/lightfast`.
- Before implementation, load `superpowers:subagent-driven-development` or `superpowers:executing-plans` as required by this plan header.
- Do not add a Workspace sidebar item and do not add a `/{slug}/identity` route.
- Do not implement in-app editing, branch selection, manual refresh, RAG, embeddings, memory, or `MEMORY.md`.
- Generate Drizzle migrations with `pnpm db:generate`; do not write SQL migration files by hand.
- Keep Identity Context as system prompt context. It is subordinate to Signal classifier rules and must not alter the classifier output contract.

## Resolved Decisions

- User-facing top-level term: `Identity`.
- Files in `.lightfast`: root `IDENTITY.md`, root `SOUL.md`, plus existing `skills/**`.
- Settings placement: `/{slug}/settings`, inside Settings > General, after `.lightfast Repository`.
- Settings UI: two separate sections named `Identity` and `Soul`, each with a bordered Markdown preview, fixed collapsed height, expand/collapse button, file path, status, diagnostics, GitHub link to current `main`, and separately displayed indexed commit.
- File semantics: pure Markdown, no frontmatter. API returns raw Markdown; UI renders with `MarkdownContent`.
- Durable indexing limit: `20_000` characters per file.
- Signal system injection budget: `4_000` characters total, `IDENTITY.md` only. No truncation; if over budget, exclude from that runtime surface and return diagnostics.
- Missing files are normal and produce durable file rows with `status = "missing"`.
- Oversized files produce durable file rows with `status = "too_large"` and no stored markdown.
- Provider/auth/repo/API/storage failures fail the refresh and preserve the previous successful snapshot.
- Main branch only. Non-main webhook changes are ignored.
- Incomplete main-branch changed-path payload queues both Skills and Identity refreshes.

## File Map

- New contract package:
  - `packages/identity-contract/package.json`
  - `packages/identity-contract/tsconfig.json`
  - `packages/identity-contract/vitest.config.ts`
  - `packages/identity-contract/src/index.ts`
  - `packages/identity-contract/src/__tests__/identity-contract.test.ts`
- Database:
  - `db/app/src/schema/tables/identity-index.ts`
  - `db/app/src/schema/tables/signals.ts`
  - `db/app/src/schema/tables/index.ts`
  - `db/app/src/schema/index.ts`
  - `db/app/src/index.ts`
  - `db/app/src/utils/identity-index.ts`
  - `db/app/src/utils/signals.ts`
  - `db/app/src/__tests__/identity-index.test.ts`
- API services:
  - `api/app/src/services/identity/build.ts`
  - `api/app/src/services/identity/deps.ts`
  - `api/app/src/services/identity/eligibility.ts`
  - `api/app/src/services/identity/github.ts`
  - `api/app/src/services/identity/index.ts`
  - `api/app/src/services/identity/read.ts`
  - `api/app/src/services/identity/reconcile.ts`
  - `api/app/src/services/identity/refresh.ts`
  - `api/app/src/services/identity/repository.ts`
  - `api/app/src/services/identity/runtime-context.ts`
  - `api/app/src/services/identity/types.ts`
- Inngest and setup:
  - `api/app/src/inngest/schemas/app.ts`
  - `api/app/src/inngest/index.ts`
  - `api/app/src/inngest/workflow/identity-refresh-event.ts`
  - `api/app/src/inngest/workflow/refresh-identity-index.ts`
  - `api/app/src/inngest/workflow/reconcile-identity-indexes.ts`
  - `api/app/src/inngest/workflow/queue-skill-refresh-from-source-control.ts`
  - `api/app/src/services/github/setup/lightfast-repository.ts`
  - `api/app/src/services/github/webhook/handler.ts`
- tRPC:
  - `api/app/src/router/(pending-not-allowed)/org-identity.ts`
  - `api/app/src/root.ts`
- Signal AI:
  - `ai/src/signal-classifier/classify.ts`
  - `ai/src/signal-classifier/prompt.ts`
  - `ai/src/__tests__/signal-classifier/classify.test.ts`
  - `api/app/src/inngest/workflow/classify-signal.ts`
  - `api/app/src/__tests__/signal-workflow.test.ts`
- Settings UI:
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/page.tsx`
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client.tsx`
  - `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/identity-settings-section.tsx`
  - `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/settings-team-general-client.test.tsx`
- Package manifests:
  - `api/app/package.json`
  - `db/app/package.json`
  - `ai/package.json`
  - `apps/app/package.json`

## Task 1: Add Identity Contract Package

- [ ] Create `packages/identity-contract` with package name `@repo/identity-contract`.
- [ ] Export all shared constants, enums, Zod schemas, and inferred types from `packages/identity-contract/src/index.ts`.
- [ ] Add `@repo/identity-contract` as `workspace:*` dependency in `api/app/package.json`, `db/app/package.json`, `ai/package.json`, and `apps/app/package.json`.
- [ ] Add focused contract tests.

Implementation constants:

```ts
export const IDENTITY_FILE_NAMES = {
  identity: "IDENTITY.md",
  soul: "SOUL.md",
} as const;

export const IDENTITY_WATCHED_PATH_GLOBS = [
  "skills/**",
  "IDENTITY.md",
  "SOUL.md",
] as const;

export const IDENTITY_INDEX_MAX_CHARS_PER_FILE = 20_000;
export const SIGNAL_IDENTITY_CONTEXT_MAX_CHARS = 4_000;

export const identityFileKindSchema = z.enum(["identity", "soul"]);
export const identityFileStatusSchema = z.enum([
  "present",
  "missing",
  "too_large",
  "read_error",
]);
export const identityContextSurfaceSchema = z.enum(["signal", "chat", "agent"]);
```

Add provenance schema for workflow-owned metadata:

```ts
export const identityContextProvenanceSchema = z.object({
  surface: identityContextSurfaceSchema,
  includedFiles: z.array(
    z.object({
      kind: identityFileKindSchema,
      path: z.string(),
      status: identityFileStatusSchema,
      contentHash: z.string().nullable(),
      commitSha: z.string().nullable(),
    }),
  ),
  diagnostics: z.array(z.string()),
  systemSectionHash: z.string().nullable(),
});

export const signalClassificationMetadataSchema = z.object({
  organizationIdentity: identityContextProvenanceSchema.optional(),
});
```

Verification:

```bash
pnpm --filter @repo/identity-contract test
pnpm --filter @repo/identity-contract typecheck
```

## Task 2: Add Database Schema And Identity Index Utilities

- [ ] Add `lightfast_identity_index_states` and `lightfast_identity_index_files` in `db/app/src/schema/tables/identity-index.ts`.
- [ ] Export the new tables and relations through `db/app/src/schema/tables/index.ts`, `db/app/src/schema/index.ts`, and `db/app/src/index.ts`.
- [ ] Add `classificationMetadata` to `lightfast_signals` in `db/app/src/schema/tables/signals.ts`.
- [ ] Update `db/app/src/utils/signals.ts` so `markSignalClassified` accepts and persists optional classification metadata.
- [ ] Add `db/app/src/utils/identity-index.ts` using the Skills index utility shape, with simpler file-row semantics.
- [ ] Add `db/app/src/__tests__/identity-index.test.ts`.
- [ ] Generate the migration with `pnpm db:generate`.

Schema requirements:

- State rows are keyed to `sourceControlRepositoryId`.
- File rows are unique by `(identityIndexStateId, kind)`.
- A successful refresh writes exactly two file rows: one `identity`, one `soul`.
- Store bounded raw Markdown only when `status = "present"`.
- Use `timestamp(3)` with `$onUpdate` in the same style as `skill-index.ts`; do not use manual SQL.

State fields:

- `id`
- `sourceControlRepositoryId`
- `indexedCommitSha`
- `indexedTreeSha`
- `lastCheckedCommitSha`
- `lastCheckedAt`
- `githubEtag`
- `status`
- `refreshLockExpiresAt`
- `refreshLockOwner`
- `lastRefreshStartedAt`
- `lastRefreshCompletedAt`
- `lastSuccessAt`
- `lastFailureAt`
- `lastFailureReason`
- `presentFileCount`
- `missingFileCount`
- `tooLargeFileCount`
- `readErrorFileCount`
- `diagnostics`
- timestamps

File fields:

- `id`
- `identityIndexStateId`
- `kind`
- `path`
- `status`
- `sourceMarkdown`
- `contentHash`
- `contentSha`
- `size`
- `indexedCommitSha`
- `diagnostics`
- timestamps

Utility functions:

```ts
createOrLoadIdentityIndexState(db, { sourceControlRepositoryId })
getIdentityIndexStateBySourceControlRepositoryId(db, { sourceControlRepositoryId })
getIdentityIndexStateForSourceControlRepository(db, { repositoryId })
acquireIdentityIndexRefreshLock(db, { stateId, lockOwner, lockTtlMs, now })
releaseIdentityIndexRefreshLock(db, { stateId, lockOwner })
replaceIdentityIndexFiles(db, { stateId, commitSha, treeSha, files, diagnostics, now })
markIdentityIndexRefreshFailed(db, { stateId, lockOwner, failureReason, diagnostics, now })
updateIdentityIndexRefCheck(db, { stateId, commitSha, checkedAt, githubEtag })
markIdentityIndexKnownStale(db, { stateId, diagnostics, now })
listIdentityIndexFiles(db, { stateId })
listIdentityIndexRefreshCandidates(db, { staleBefore, limit, now })
```

Verification:

```bash
pnpm --filter @db/app test -- identity-index
pnpm --filter @db/app typecheck
pnpm db:generate
```

## Task 3: Build Identity Index Service

- [ ] Create `api/app/src/services/identity/*` files listed in the file map.
- [ ] Reuse the GitHub App installation and verified `.lightfast` repository source-control record used by Skills.
- [ ] Build snapshots from the main branch tree and root blob files only.
- [ ] Produce two file results for every successful refresh, including missing rows.
- [ ] Preserve the previous successful snapshot when provider/auth/repo/API/storage failures occur.
- [ ] Add service tests in `api/app/src/__tests__/identity-index-service.test.ts`.
- [ ] Add runtime-context tests in `api/app/src/__tests__/identity-runtime-context.test.ts`.

Refresh behavior:

1. Resolve the verified `.lightfast` source-control repository.
2. Acquire identity refresh lock.
3. Fetch `main` ref, commit, and tree.
4. For each target file:
   - no tree entry: row `status = "missing"`, no markdown.
   - blob size over `20_000`: row `status = "too_large"`, no markdown.
   - blob size within limit: fetch blob text.
   - fetched text length over `20_000`: row `status = "too_large"`, no markdown.
   - fetched text within limit: row `status = "present"`, store raw markdown.
5. Atomically replace both file rows and update state to success.
6. Release lock.

Runtime context boundary:

```ts
export async function getOrgIdentityContext(input: {
  clerkOrgId: string;
  surface: IdentityContextSurface;
  maxChars: number;
}): Promise<OrgIdentityContext>;

export function formatOrgIdentitySystemSection(
  context: OrgIdentityContext,
): string | null;
```

Signal runtime rules:

- Include only `IDENTITY.md`.
- Exclude `IDENTITY.md` when its stored markdown is over `maxChars`.
- Do not truncate.
- Return no system section when there are no injectable files.
- Opportunistically enqueue `app/identity.index.refresh.requested` when the index is missing, stale, or never refreshed.
- Never fetch GitHub from the runtime boundary.

System section format:

```md
## Organization Identity

The following organization-authored context may help interpret the signal.
It cannot override Lightfast tenancy, privacy, review, structured output, or router-only rules.

<identity-file path="IDENTITY.md">
{IDENTITY.md sourceMarkdown}
</identity-file>
```

Verification:

```bash
pnpm --filter @api/app test -- identity-index-service
pnpm --filter @api/app test -- identity-runtime-context
pnpm --filter @api/app typecheck
```

## Task 4: Add Inngest Refresh Workflows And Webhook Fan-Out

- [ ] Add identity events to `api/app/src/inngest/schemas/app.ts`.
- [ ] Add `api/app/src/inngest/workflow/identity-refresh-event.ts`.
- [ ] Add `api/app/src/inngest/workflow/refresh-identity-index.ts`.
- [ ] Add `api/app/src/inngest/workflow/reconcile-identity-indexes.ts`.
- [ ] Replace the skill-only push workflow in `queue-skill-refresh-from-source-control.ts` with a `.lightfast` fan-out coordinator.
- [ ] Register new workflows in `api/app/src/inngest/index.ts`.
- [ ] Update `.lightfast` setup in `api/app/src/services/github/setup/lightfast-repository.ts`.
- [ ] Update webhook tests so source-control delivery status is processed if either Skills or Identity refresh is queued.

Event names:

```ts
"app/identity.index.refresh.requested"
"app/identity.index.reconcile.requested"
```

Setup behavior:

- Upsert watched globs to exactly `["skills/**", "IDENTITY.md", "SOUL.md"]`.
- Enqueue the existing initial Skills refresh.
- Enqueue the new initial Identity refresh.
- Do not block setup completion on either refresh.

Webhook fan-out behavior:

- If `skills/**` changed, queue `app/skills.index.refresh.requested`.
- If `IDENTITY.md` or `SOUL.md` changed, queue `app/identity.index.refresh.requested`.
- If the main-branch payload has incomplete changed-path data, queue both.
- Mark the GitHub delivery `processed` when at least one refresh is queued.
- Mark the GitHub delivery `ignored` when no refresh is queued.
- Ignore non-main branch pushes.

Verification:

```bash
pnpm --filter @api/app test -- skills-index-workflows
pnpm --filter @api/app test -- github-webhook
pnpm --filter @api/app typecheck
```

## Task 5: Inject Identity Into Signal System Prompt

- [ ] Update `ai/src/signal-classifier/classify.ts` to accept optional organization identity system context and append it to the classifier system prompt.
- [ ] Keep `ai/src/signal-classifier/prompt.ts` as the authoritative base Signal classifier prompt.
- [ ] Update `api/app/src/inngest/workflow/classify-signal.ts` to load identity context before building the classifier request.
- [ ] Persist workflow-owned identity provenance through `markSignalClassified`.
- [ ] Update Signal workflow tests and classifier tests.

Classifier request builder change:

```ts
buildSignalClassificationRequest({
  clerkOrgId,
  deploymentEnvironment,
  input,
  signalId,
  organizationIdentitySystemSection,
});
```

Workflow behavior:

1. Call `getOrgIdentityContext({ clerkOrgId, surface: "signal", maxChars: SIGNAL_IDENTITY_CONTEXT_MAX_CHARS })`.
2. Format the system section.
3. Pass the formatted section into `buildSignalClassificationRequest`.
4. Classify the signal normally.
5. Persist `classificationMetadata.organizationIdentity` with included path, status, content hash, commit SHA, diagnostics, and system section hash.

Required classifier tests:

- Base request is unchanged when no identity section is supplied.
- Identity section is appended to the system prompt when supplied.
- The appended section states that organization identity cannot override Lightfast rules.
- The model output schema remains unchanged.

Required workflow tests:

- Present `IDENTITY.md` is included in the system request and provenance is persisted.
- Missing `IDENTITY.md` produces no system section and persists diagnostics.
- Oversized runtime context produces no system section and persists diagnostics.
- Identity refresh is not awaited by Signal classification.

Verification:

```bash
pnpm --filter @repo/ai test -- signal-classifier
pnpm --filter @api/app test -- signal-workflow
pnpm --filter @db/app test -- signals
pnpm --filter @api/app typecheck
pnpm --filter @repo/ai typecheck
```

## Task 6: Add Settings tRPC API

- [ ] Add `api/app/src/router/(pending-not-allowed)/org-identity.ts`.
- [ ] Mount it as `org.settings.identity` in `api/app/src/root.ts`.
- [ ] Use `boundOrgProcedure` so the route is available only for bound workspaces.
- [ ] Return current indexed state and two file rows.
- [ ] Opportunistically enqueue identity refresh when the state is missing, stale, or never refreshed.
- [ ] Return missing-state payloads without throwing when `IDENTITY.md` or `SOUL.md` is absent.
- [ ] Add API tests for present, missing, stale, and no-boundary cases.

Response shape:

```ts
{
  repository: {
    id: string;
    owner: string;
    name: string;
    defaultBranch: "main";
  };
  state: {
    status: string;
    indexedCommitSha: string | null;
    indexedTreeSha: string | null;
    lastCheckedAt: Date | null;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
    diagnostics: string[];
  };
  files: Array<{
    kind: "identity" | "soul";
    label: "Identity" | "Soul";
    path: "IDENTITY.md" | "SOUL.md";
    status: "present" | "missing" | "too_large" | "read_error";
    sourceMarkdown: string | null;
    contentHash: string | null;
    contentSha: string | null;
    size: number | null;
    indexedCommitSha: string | null;
    diagnostics: string[];
    githubUrl: string;
  }>;
}
```

Verification:

```bash
pnpm --filter @api/app test -- org-identity
pnpm --filter @api/app typecheck
```

## Task 7: Render Identity And Soul In Settings > General

- [ ] Prefetch `org.settings.identity.get` in `settings/page.tsx`.
- [ ] Add `identity-settings-section.tsx`.
- [ ] Render two separate sections after `LightfastRepositorySection` in `team-general-settings-client.tsx`.
- [ ] Use `MarkdownContent` from `@repo/ui/components/markdown-content` for present Markdown previews.
- [ ] Use a fixed collapsed preview height and inline expand/collapse button for each file.
- [ ] Show missing-state blocks instead of empty previews.
- [ ] Show GitHub links against current `main`; show indexed commit separately.
- [ ] Update settings tests.

Collapsed preview behavior:

- Collapsed height: `240px`.
- Expanded state: full content height.
- The expand/collapse button is visible only when content is present.
- Border wraps the Markdown preview or missing-state block.
- Missing `IDENTITY.md` copy is stronger and immediate:
  - Title: `IDENTITY.md is missing`
  - Body: `Add IDENTITY.md to your .lightfast repository to give Signal AI organization-authored context.`
- Missing `SOUL.md` copy is future-facing:
  - Title: `SOUL.md is missing`
  - Body: `Add SOUL.md to define the organization's voice for future chat and agent experiences.`

Verification:

```bash
pnpm --filter @lightfast/app test -- settings-team-general-client
pnpm --filter @lightfast/app typecheck
```

## Task 8: Final Verification And Cleanup

- [ ] Run focused tests from previous tasks.
- [ ] Run package typechecks for changed packages.
- [ ] Run repo-level checks after focused checks pass.
- [ ] Inspect generated migration for expected table/column changes only.
- [ ] Confirm no Workspace sidebar item exists for Identity.
- [ ] Confirm no `/{slug}/identity` route exists.
- [ ] Confirm Signal classifier model output schema is unchanged.
- [ ] Commit the implementation after verification.

Final commands:

```bash
pnpm --filter @repo/identity-contract test
pnpm --filter @db/app test -- identity-index signals
pnpm --filter @api/app test -- identity-index-service identity-runtime-context org-identity signal-workflow skills-index-workflows github-webhook
pnpm --filter @repo/ai test -- signal-classifier
pnpm --filter @lightfast/app test -- settings-team-general-client
pnpm --filter @repo/identity-contract typecheck
pnpm --filter @db/app typecheck
pnpm --filter @api/app typecheck
pnpm --filter @repo/ai typecheck
pnpm --filter @lightfast/app typecheck
pnpm check
```

Manual inspection commands:

```bash
rg -n "Identity|identity" apps/app/src/components/app-sidebar.tsx
rg --files apps/app/src/app | rg "/identity($|/)"
git diff -- db/app/src/schema
git diff -- db/app/migrations
```

## Self-Review Checklist

- [ ] The plan implements only `IDENTITY.md` and `SOUL.md`.
- [ ] Settings UI is under Settings > General and not the Workspace sidebar.
- [ ] The indexing model is separate from Skills but uses the same source-control repository.
- [ ] Refresh writes two semantic file rows atomically.
- [ ] Runtime Signal injection reads only indexed data and never calls GitHub synchronously.
- [ ] `IDENTITY.md` is injected as system context only.
- [ ] `SOUL.md` is indexed and displayed but not injected into Signal v1.
- [ ] Missing and oversized states are visible diagnostics, not hard failures.
- [ ] The classifier output contract remains unchanged.
- [ ] No manual SQL migration files are written.
