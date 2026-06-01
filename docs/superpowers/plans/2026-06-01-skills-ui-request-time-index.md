# Skills UI Request-Time Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Skills UI backed by request-time GitHub `main` reconciliation for `.lightfast`.

**Architecture:** Add an isomorphic skills contract/parser, durable current-index tables, narrow GitHub ref/blob helpers, an `api/app` request-time indexing service, tRPC `org.workspace.skills` procedures, and workspace list/detail pages. Webhooks remain telemetry only; every `list` and `get` request checks GitHub before trusting the DB cache.

**Tech Stack:** TypeScript, Zod, Drizzle MySQL/Vitess, tRPC v11, TanStack Query, Next.js App Router, pnpm workspaces, Vitest.

---

## File Structure

- Create `packages/skills-contract/`: schemas, parser, path/resource inventory helpers, diagnostics, and tests.
- Modify `packages/github-app-node/src/repositories.ts`: add ref and blob helpers with fetch injection, ETag, tree size support.
- Modify `db/app/src/schema/tables/`: add skill index state and current skill row tables.
- Modify `db/app/src/utils/`: add skill index state/row helpers with lock and atomic replace operations.
- Create `api/app/src/services/skills/`: request-time reconciliation and inline build service.
- Create `api/app/src/router/(pending-not-allowed)/workspace-skills.ts` and modify `api/app/src/root.ts`.
- Create `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/`: list and detail routes with rendered markdown previews.
- Modify `apps/app/src/components/app-sidebar.tsx`: add `Skills` after `People`.
- Add focused tests alongside each layer.

## Task 1: Skills Contract Package

**Files:**
- Create: `packages/skills-contract/package.json`
- Create: `packages/skills-contract/tsconfig.json`
- Create: `packages/skills-contract/vitest.config.ts`
- Create: `packages/skills-contract/src/index.ts`
- Test: `packages/skills-contract/src/__tests__/skills-contract.test.ts`
- Modify: `pnpm-workspace.yaml` if a YAML parser catalog dependency is needed.

- [ ] **Step 1: Write failing contract tests**

Cover:

- canonical path detection for `skills/foo/SKILL.md`;
- invalid slug directories are index diagnostics, not skill rows;
- frontmatter `name` must match slug;
- `description` max 1024 is an error;
- optional fields produce warnings, not invalid skills;
- lenient fallback handles a simple colon-containing description;
- body required;
- resource inventory is recursive, sorted, capped, and separate from
  non-standard file count.

Run:

```bash
pnpm --filter @repo/skills-contract test
```

Expected: package does not exist or tests fail.

- [ ] **Step 2: Implement the package**

Implement exported constants and functions:

- `SKILL_FILE_MAX_BYTES = 128 * 1024`
- `SKILL_COUNT_MAX = 200`
- `SKILL_RESOURCE_PATH_MAX = 100`
- `skillSlugSchema`
- `skillValidationStatusSchema`
- `skillDiagnosticSchema`
- `parseSkillFile(input)`
- `collectSkillTreeEntries(entries)`

Use stable diagnostic codes such as:

- `frontmatter_missing`
- `frontmatter_invalid`
- `frontmatter_compatibility_fallback`
- `name_missing`
- `name_invalid`
- `name_slug_mismatch`
- `description_missing`
- `description_too_long`
- `body_missing`
- `file_too_large`
- `optional_field_invalid`

- [ ] **Step 3: Run contract tests and typecheck**

```bash
pnpm --filter @repo/skills-contract test
pnpm --filter @repo/skills-contract typecheck
```

Expected: pass.

## Task 2: GitHub Repository Helpers

**Files:**
- Modify: `packages/github-app-node/src/repositories.ts`
- Modify: `packages/github-app-node/src/index.ts`
- Test: `packages/github-app-node/src/__tests__/repository-api.test.ts`

- [ ] **Step 1: Write failing GitHub helper tests**

Cover:

- `getGitHubReference` returns commit SHA and ETag on `200`.
- `getGitHubReference` returns not-modified result on `304`.
- missing branch maps to a typed GitHub error.
- tree entries include optional `size`.
- `getGitHubBlobText` decodes base64 content.
- invalid blob encoding throws a typed GitHub error.

Run:

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/repository-api.test.ts
```

Expected: fail because helpers/schema fields do not exist.

- [ ] **Step 2: Implement helpers**

Add:

- `getGitHubReference({ owner, repo, ref: "heads/main", etag? })`
- `getGitHubBlobText({ owner, repo, sha })`

Keep fetch injection and GitHub API version headers consistent with existing
helpers.

- [ ] **Step 3: Run GitHub helper tests**

```bash
pnpm --filter @repo/github-app-node test -- src/__tests__/repository-api.test.ts
pnpm --filter @repo/github-app-node typecheck
```

Expected: pass.

## Task 3: Database Schema And Helpers

**Files:**
- Create: `db/app/src/schema/tables/skills.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/index.ts`
- Create: `db/app/src/utils/skills.ts`
- Test: `db/app/src/__tests__/skills-index.test.ts`
- Generate: Drizzle migration via `pnpm db:generate`

- [ ] **Step 1: Write failing DB helper tests**

Cover:

- create/load state by source-control repository id;
- acquire lock only when absent/expired;
- release lock only with matching token;
- atomic replace deletes old skill rows and inserts new rows;
- nullable markdown is accepted;
- failure metadata does not delete old rows.

Run:

```bash
pnpm --filter @db/app test -- src/__tests__/skills-index.test.ts
```

Expected: fail because helpers do not exist.

- [ ] **Step 2: Add tables and helpers**

Tables:

- `lightfast_skill_index_states`
- `lightfast_skills`

Follow repo schema conventions: `mysqlTable`, `lightfast_` prefix, no foreign
keys, JSON columns for diagnostics/frontmatter/resources.

- [ ] **Step 3: Generate migration**

```bash
pnpm db:generate
```

Expected: new Drizzle-generated SQL and snapshot. Do not hand-edit SQL.

- [ ] **Step 4: Run DB tests/typecheck**

```bash
pnpm --filter @db/app test -- src/__tests__/skills-index.test.ts
pnpm --filter @db/app typecheck
```

Expected: pass.

## Task 4: API Request-Time Index Service

**Files:**
- Create: `api/app/src/services/skills/index.ts`
- Create: `api/app/src/services/skills/github.ts`
- Create: `api/app/src/router/(pending-not-allowed)/workspace-skills.ts`
- Modify: `api/app/src/root.ts`
- Test: `api/app/src/__tests__/skills-index-service.test.ts`
- Test: `api/app/src/__tests__/workspace-skills-router.test.ts`

- [ ] **Step 1: Write failing service/router tests**

Cover:

- unchanged GitHub ref returns DB rows without tree/blob fetch;
- changed ref rebuilds inline and persists fresh rows;
- invalid canonical skill is stored and returned;
- first empty skills tree is fresh empty index;
- over skill cap fails rebuild;
- failed rebuild returns stale previous index;
- first build failure returns unavailable;
- concurrent lock returns refreshing/stale previous data;
- `get` returns stale skill on GitHub failure but not found after successful
  refresh proves deletion.

Run:

```bash
pnpm --filter @api/app test -- src/__tests__/skills-index-service.test.ts src/__tests__/workspace-skills-router.test.ts
```

Expected: fail because service/router do not exist.

- [ ] **Step 2: Implement service**

Implement `ensureFreshLightfastSkillIndex({ clerkOrgId, slug? })` around the
existing active binding, `.lightfast` proof, source-control repository watch,
GitHub helpers, skills contract parser, DB lock helpers, and atomic replace.

- [ ] **Step 3: Implement router**

Add:

- `org.workspace.skills.list`
- `org.workspace.skills.get`

Both use `boundOrgProcedure`; `get` validates `slug` with the contract schema
and throws `TRPCError({ code: "NOT_FOUND", message: "Skill not found" })` when
current data proves absence.

- [ ] **Step 4: Run API tests/typecheck**

```bash
pnpm --filter @api/app test -- src/__tests__/skills-index-service.test.ts src/__tests__/workspace-skills-router.test.ts
pnpm --filter @api/app typecheck
```

Expected: pass.

## Task 5: Workspace Skills UI

**Files:**
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/[skillSlug]/page.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-client.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skill-markdown.tsx`
- Create: `apps/app/src/app/(app)/(pending-not-allowed)/[slug]/(workspace)/skills/_components/skills-loading.tsx`
- Modify: `apps/app/src/components/app-sidebar.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/page.test.tsx`
- Test: `apps/app/src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/detail-page.test.tsx`
- Test: `apps/app/src/__tests__/components/app-sidebar.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Cover:

- sidebar shows `Skills` after `People`;
- list page prefetches `org.workspace.skills.list`;
- client renders freshness, diagnostics, validity filter, search, and invalid
  first ordering;
- expansion renders inert markdown body;
- refresh button invalidates the list query;
- detail page prefetches `get` and renders focused content/back link.

Run:

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/page.test.tsx src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/detail-page.test.tsx src/__tests__/components/app-sidebar.test.tsx
```

Expected: fail because routes/components/sidebar item do not exist.

- [ ] **Step 2: Implement UI**

Use `WorkspaceSurface variant="flush"`, stacked bordered rows, client-side
search/filter, expanded rendered markdown, and full detail route. Do not use raw
HTML or MDX execution for markdown.

- [ ] **Step 3: Run UI tests/typecheck**

```bash
pnpm --filter @lightfast/app test -- src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/page.test.tsx src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/detail-page.test.tsx src/__tests__/components/app-sidebar.test.tsx
pnpm --filter @lightfast/app typecheck
```

Expected: pass.

## Task 6: Final Verification

**Files:**
- All files changed above.

- [ ] **Step 1: Run focused verification**

```bash
pnpm --filter @repo/skills-contract test
pnpm --filter @repo/github-app-node test -- src/__tests__/repository-api.test.ts
pnpm --filter @db/app test -- src/__tests__/skills-index.test.ts
pnpm --filter @api/app test -- src/__tests__/skills-index-service.test.ts src/__tests__/workspace-skills-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/page.test.tsx src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/detail-page.test.tsx src/__tests__/components/app-sidebar.test.tsx
pnpm typecheck
```

Expected: pass.

- [ ] **Step 2: Manual dev check**

Run:

```bash
pnpm dev --ui=stream --log-order=stream --log-prefix=task --no-color
```

Open the workspace Skills route and verify the page renders without overlap,
shows stale/fresh states, and expands rendered markdown previews.

---

## Self-Review

- Spec coverage: covers contract, GitHub helpers, DB, API, UI, tests, and final
  verification. Build-history is intentionally deferred.
- Placeholder scan: no placeholder markers.
- Type consistency: router path is `org.workspace.skills`; DB/current-index
  terminology matches the design.
