# Skills UI And Indexer Design

## Context

Lightfast now has the source-control foundation needed for `.lightfast`:

- GitHub organization setup binds an installation to a Lightfast organization.
- The `.lightfast` setup task verifies `<github-org>/.lightfast`.
- Verification stores a watched source-control repository for `skills/**`.
- The generic webhook path receives signed GitHub push events and emits a
  generic repository push event.

This design adds the next product layer: build and show skills from an
organization's `.lightfast` repository. In this implementation, skills are not
loaded into agents, executed, installed, or used for runtime behavior. They are
built, validated, indexed, and displayed so the team can maintain the
main-branch skill set.

The core correctness concern is that GitHub webhooks can be late, duplicated,
or missed. Webhooks are useful for low-latency refresh, but they must not be
the only freshness mechanism.

## Decision

Build a first-class org skill indexer for verified `.lightfast` repositories.

V1 has one skill source per setup-complete organization:

```text
<github-org>/.lightfast
refs/heads/main
skills/<skill-name>/SKILL.md
```

The indexer has three freshness paths:

1. Webhook-triggered refresh for `main` pushes that touch `skills/**`.
2. Hourly scheduled reconciliation for verified `.lightfast` repositories.
3. Read-time enforcement for `/:org/skills` and `/:org/skills/<skill>` so the
   UI always checks GitHub before trusting the materialized index.

All three paths use the same refresh service and the same DB mutex. The
database stores the latest successful materialized index as cache/fallback, not
as source of truth. GitHub `refs/heads/main` is the source of truth.

Lightfast-maintained default skills are explicitly deferred from v1. They will
need a separate design for first-party GitHub App identity, source precedence,
and shared/global indexing.

## Goals

- Make GitHub `main` the source of truth for displayed org skills.
- Keep Skills page reads fast when `main` has not changed.
- Rebuild when GitHub `main` changes, regardless of whether the trigger is a
  webhook, schedule, or page read.
- Preserve the last successful index when GitHub or a build fails.
- Display freshness, diagnostics, and invalid skills explicitly.
- Align skill validation with the Agent Skills standard while keeping broken
  canonical skills visible for maintenance.
- Keep parsing, indexing, rendering, GitHub access, DB writes, and UI concerns
  separately testable.

## Non-Goals

- No agent skill loading or execution.
- No Lightfast-maintained default skills.
- No marketplace, sharing, publishing, install flow, or registry.
- No branch picker. V1 reads only `refs/heads/main`.
- No repo picker. V1 reads only the verified `.lightfast` repository.
- No browser-to-GitHub calls. GitHub App credentials stay server-side.
- No skill editor or GitHub commit creation UI.
- No build-history table or audit timeline.
- No manual reindex-all UI or admin operation.
- No migration of local agent skills into Lightfast.

## Follow-Ups

Track these outside v1:

- Lightfast-maintained default skills from `lightfastai/skills`.
- Internal Lightfast GitHub App boundary for first-party service actions.
- Skill index build history/audit timeline.
- Manual reindex-all operation.
- Agent/runtime use of indexed skills for automations, signals, and other
  product workflows.

## Skill Repository Shape

V1 recognizes one canonical file shape:

```text
skills/<skill-name>/SKILL.md
```

The skill name is the directory name and must match the Agent Skills naming
rules:

```text
^[a-z0-9][a-z0-9-]{0,62}$
```

Frontmatter `name` is a machine name, not a display title. It must exactly
match the parent directory name.

Each `SKILL.md` must start with YAML frontmatter at byte 0, except for an
optional UTF-8 BOM:

```yaml
---
name: code-review
description: Use when reviewing code for correctness and maintainability.
---
```

Required validity rules:

- frontmatter is parseable;
- `name` is present, valid, and exactly equals the parent directory;
- `description` is present, non-empty, and no longer than 1024 characters;
- markdown body after frontmatter is non-empty;
- canonical `SKILL.md` is a regular Git blob, not a symlink or submodule;
- decoded file size is at most 128 KiB.

Optional standard fields:

- `license`: optional string, max 256 characters;
- `compatibility`: optional string, max 512 characters;
- `metadata`: optional shallow object whose values are JSON scalars;
- `allowed-tools`: optional string, max 2048 characters, displayed as declared
  metadata only and not enforced in v1.

Malformed optional fields produce warnings, not invalid status. Required
field, identity, body, frontmatter, unsupported canonical path, and oversize
failures produce errors and make the skill invalid.

Invalid canonical skill files are stored and displayed as rows with diagnostics.
Non-canonical files are not displayed as skill rows.

## Parser Behavior

Create `@repo/skills-contract` for standard-aligned parsing and validation.

The parser should:

- return stable diagnostic codes and human messages;
- return both errors and warnings in one ordered diagnostics array;
- derive the canonical slug/name from the path;
- parse and normalize standard frontmatter fields;
- return full source markdown when fetched and allowed;
- return body markdown separately for rendering;
- return resource inventory metadata;
- keep invalid canonical skills visible when enough path identity exists.

Use strict YAML first. If strict YAML fails, retry one narrow compatibility
fallback for common `name: ...` and `description: ...` scalar cases, especially
unquoted colon text. If the fallback succeeds, add a warning diagnostic such as
`frontmatter_compatibility_fallback`. If both fail, the canonical row is
invalid.

Do not depend on an external `skills-ref` validator in v1. Encode the standard
rules and Lightfast maintenance behavior in local tests.

## Resource Inventory

V1 indexes resource inventory metadata, not resource contents.

For each valid-slug skill directory, recursively inventory paths under:

```text
scripts/
references/
assets/
```

Store repo-root-relative paths sorted ascending:

```text
skills/code-review/references/checklist.md
skills/code-review/assets/flow.png
```

Per skill, store up to 100 standard resource paths across the three resource
groups plus a `resourcesTruncated` flag. Non-standard files under the skill
directory are counted recursively as `nonStandardResourceCount`; they do not
consume the 100-path resource cap and are not individually listed in v1.

Invalid skill-name directories do not produce skill rows. Summarize them in
index-level diagnostics.

Submodules and non-blob entries are ignored for resource inventory. A canonical
`SKILL.md` that is not a regular blob produces an invalid skill diagnostic.

## Limits

Initial v1 limits:

- maximum 200 canonical skill files per repository;
- maximum 128 KiB per `SKILL.md`;
- maximum 100 standard resource paths per skill;
- GitHub blob fetch concurrency of 4.

If canonical skill count exceeds 200, abort the rebuild. A partial index would
not faithfully represent `main`.

If a canonical `SKILL.md` is known to exceed 128 KiB from tree metadata, do not
fetch the blob. Store an invalid row with path, slug, content SHA, size, and an
oversize diagnostic. If size is unavailable, enforce the cap after blob decode.
Oversize files do not store truncated source or body markdown.

If one canonical blob fetch fails, abort the rebuild and keep the previous
successful index.

## Package Boundaries

### New `@repo/skills-contract`

Create:

```text
packages/skills-contract/
```

It owns:

- skill name/path schemas;
- standard frontmatter schemas;
- parser and validation result types;
- diagnostic code enums;
- freshness/status/failure code types shared by API, DB helpers, and UI tests.

It must not import DB, GitHub, Clerk, Inngest, Next.js, or React.

### Existing `@repo/github-app-node`

Add narrow GitHub helpers with fetch injection:

- `getGitHubReference` for `GET /repos/{owner}/{repo}/git/ref/heads/main`;
- `getGitHubBlobText` for `GET /repos/{owner}/{repo}/git/blobs/{sha}`;
- tree entry size support in repository tree normalization;
- ETag support for the ref request.

This package must not parse skills or know about `.lightfast` product policy.

### Existing `@db/app`

Add durable skill index tables and helpers:

- create or load index state by source-control repository id;
- acquire and release refresh lock with compare-and-set;
- list eligible watched repository candidates for reconciliation;
- update ref-check observations;
- replace current entries transactionally after successful build;
- record sanitized failure metadata.

DB helpers should not call GitHub or parse skill markdown. Product eligibility
that depends on `.lightfast` setup proof remains in `api/app`.

### Existing `@api/app`

Add skill index services:

```text
api/app/src/services/skills/
```

Suggested split:

```ts
checkSkillIndexSourceRef(...)
refreshSkillIndexSource(...)
ensureFreshSkillIndexForRead(...)
```

The service handles:

- active binding and `.lightfast` proof eligibility;
- GitHub App token minting/caching;
- ref checks and ETag handling;
- mutex acquisition;
- build budgets and aborts;
- index replacement;
- scheduler/webhook/read-time orchestration.

The refresh service must not import the Inngest client. Inngest functions and
tRPC procedures import the service.

### Existing `@repo/ui`

Add a server-capable inert markdown renderer for skill previews/details. Reuse
the existing `SSRCodeBlock` for fenced code blocks where possible.

The existing client `Markdown` component can remain for chat/client use. Skills
should use the server-capable renderer unless implementation constraints make a
client boundary necessary.

### Existing `apps/app`

Add:

```text
/:slug/skills
/:slug/skills/<skill-name>
```

Add `Skills` to the Workspace sidebar group after `People`.

The app consumes tRPC output only. It must not call GitHub or reimplement skill
parsing.

## Durable Data

Add current-state tables. Do not add build history in v1.

### `lightfast_skill_index_states`

Purpose: one current index state per verified `.lightfast` source-control
repository.

Columns:

- `id`
- `sourceControlRepositoryId`
- `indexedCommitSha`
- `indexedTreeSha`
- `indexedAt`
- `skillCount`
- `invalidSkillCount`
- `lastCheckedCommitSha`
- `lastCheckedAt`
- `githubRefEtag`
- `lastRefreshStatus`
- `lastRefreshErrorCode`
- `lastRefreshErrorMessage`
- `lastRefreshFailedAt`
- `indexDiagnostics`
- `refreshLockToken`
- `refreshLockedUntil`
- `createdAt`
- `updatedAt`

Indexes:

- unique `(sourceControlRepositoryId)`;
- index `(refreshLockedUntil)`;
- index `(lastCheckedAt)`.

Status vocabulary:

```ts
type SkillIndexRefreshStatus =
  | "never"
  | "fresh"
  | "stale"
  | "refreshing"
  | "failed";
```

`indexedCommitSha` and `indexedAt` describe the last successful materialized
index. `lastCheckedCommitSha` and `lastCheckedAt` describe the latest observed
GitHub `main` ref. Failure fields describe only the most recent failed refresh
attempt. Failure must never erase the last successful entries.

### `lightfast_skill_index_entries`

Purpose: current materialized skill rows for the last successful index.

Columns:

- `id`
- `skillIndexStateId`
- `indexedCommitSha`
- `slug`
- `path`
- `name`
- `description`
- `license`
- `compatibility`
- `allowedTools`
- `metadata`
- `sourceMarkdown`
- `bodyMarkdown`
- `contentSha`
- `contentSize`
- `validationStatus`
- `diagnostics`
- `resources`
- `resourcesTruncated`
- `nonStandardResourceCount`
- `createdAt`
- `updatedAt`

Indexes:

- unique `(skillIndexStateId, slug)`;
- index `(skillIndexStateId, validationStatus)`.

`sourceMarkdown` and `bodyMarkdown` are nullable. Valid and normal invalid
fetched skills store full source and parsed body. Empty-body invalid skills
store source and null body. Unparseable frontmatter stores source and null body
unless compatibility parsing can safely separate the body. Oversize/unfetched
invalid entries store neither source nor body.

Diagnostics are a JSON array with stable codes:

```ts
{
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}
```

`validationStatus` is stored as `invalid` when any diagnostic has severity
`error`; otherwise `valid`.

## Mutex And Budgets

Use a single-row compare-and-set lock on `lightfast_skill_index_states`.
Do not use `SELECT FOR UPDATE`.

Acquire:

```sql
UPDATE lightfast_skill_index_states
SET refresh_lock_token = ?, refresh_locked_until = ?, last_refresh_status = 'refreshing'
WHERE id = ?
  AND (refresh_locked_until IS NULL OR refresh_locked_until < NOW(3))
```

If rows affected is 1, the caller owns the lock. Release only when the token
matches.

Lock TTL: 15 seconds.

Build budgets:

- Read-time with previous successful index: 3 seconds.
- Read-time first index: 10 seconds.
- Inngest refresh worker: may use the same service without the UI budget, but
  must still respect the 15 second lock TTL and should abort rather than
  continue invisibly after timeout.

If a read-time request hits its budget, abort GitHub/build work, record
`refresh_timeout`, release the lock, and return stale/unavailable according to
whether a previous successful index exists.

If another caller owns the lock, wait up to 500 ms for the index to catch up.
If it catches up, return fresh. If not, return stale/refreshing when a previous
index exists, otherwise unavailable. Do not enqueue another refresh from failed
lock acquisition.

No lock heartbeat/extension in v1.

## Ref Checks And ETags

Every freshness path begins with a GitHub ref check.

Use conditional requests when both are present:

- `githubRefEtag`
- `lastCheckedCommitSha`

If GitHub returns `304`, treat `lastCheckedCommitSha` as the current GitHub
SHA and update `lastCheckedAt`.

If GitHub returns `200`, update:

- `lastCheckedCommitSha`
- `lastCheckedAt`
- `githubRefEtag` when provided.

`lastCheckedCommitSha` may advance before a refresh succeeds. This is
intentional: it lets the UI show known-behind stale state separately from the
last successful index.

Do not store installation tokens durably. Add a small process-local cached
installation-token helper in the GitHub service boundary, keyed by installation
id and used only while the token has comfortable expiry headroom.

## Refresh Flow

`refreshSkillIndexSource` always re-checks current GitHub `main` at execution
time. Event `targetCommitSha` is used for idempotency and observability, not as
the build target.

Flow:

1. Load watched repository and active GitHub binding.
2. Validate the repository is the verified `.lightfast` proof for the binding.
3. Create or load the skill index state.
4. Check `refs/heads/main`.
5. If `indexedCommitSha` matches current main, mark fresh and return no-op.
6. Acquire the refresh lock.
7. Re-check current main after acquiring the lock.
8. Fetch commit and recursive tree for current main.
9. Reject truncated trees.
10. Select canonical `skills/<name>/SKILL.md` blob entries.
11. Enforce skill count cap.
12. Build resource inventory and index-level diagnostics.
13. Fetch canonical blobs with concurrency 4, skipping known-oversize blobs.
14. Parse and validate each canonical skill.
15. In one DB transaction, delete current entries, insert new entries, and
    update index state to fresh.
16. Release lock.

If refresh fails, store sanitized bounded failure code/message and release the
lock. If a previous index exists, consumers can show it as stale. If not,
consumers show unavailable.

No ancestry or monotonic commit checks in v1. Force-pushes are just SHA changes.
The index follows whatever GitHub says `main` is now.

## Webhook Refresh

Keep generic source-control webhook delivery status separate from skill index
status.

Add a separate downstream Inngest function triggered by the existing generic
event:

```text
app/github.repository.push.received
```

The skill function should:

- ignore events whose `ref` is not `refs/heads/main`;
- require `changedPaths` intersects `skills/**`;
- validate the watched repository is the verified `.lightfast` source;
- request skill index refresh for the repository watch.

It does not wait for the generic source-control workflow to complete. Both
functions can consume the same generic event independently.

No generic event schema change is needed. The existing event contains:

```ts
repositoryWatchId
orgSourceControlBindingId
providerInstallationId
providerRepositoryId
repositoryFullName
ref
afterSha
changedPaths
```

Use the same per-source refresh function as schedule/read-time.

## Scheduled Reconciliation

Use an Inngest scheduled function in `api/app`.

Event names:

```text
app/skills.index.reconcile.requested
app/skills.index.refresh.requested
```

Hourly reconciliation:

1. Page through candidate watched repositories.
2. API service validates candidates against active GitHub binding and stored
   `.lightfast` proof.
3. Create/load index state for eligible sources.
4. Check GitHub refs without acquiring the refresh lock.
5. If indexed SHA equals current SHA, update checked fields and mark fresh.
6. If current SHA differs and a previous index exists, mark stale and enqueue a
   per-source refresh event.
7. If no previous index exists, enqueue a per-source refresh event.

Scheduler scans only verified `.lightfast` watched repositories. It should not
scan every installation or every repository.

Ordering:

- oldest `lastCheckedAt` first;
- null `lastCheckedAt` first.

Bounds:

- page size 100;
- continue paging up to a total run cap, for example 1000 sources.

Scheduler does not require recent UI activity. If the repo already has a
suspended/disabled org concept, exclude those orgs; otherwise defer that policy
until such a concept exists.

Refresh event idempotency:

```text
source:<sourceControlRepositoryId>:sha:<targetCommitSha>
```

The worker still builds current `main` at execution time.

## Read-Time Enforcement

Both `list` and `get` call:

```ts
ensureFreshSkillIndexForRead({ clerkOrgId, sourceControlRepositoryId })
```

The service returns:

```ts
type SkillIndexReadResult = {
  freshness: {
    status: "fresh" | "stale" | "refreshing" | "unavailable";
    indexedCommitSha: string | null;
    githubCommitSha: string | null;
    indexedAt: Date | null;
    checkedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
  indexDiagnostics: SkillIndexDiagnostic[];
  skills: IndexedSkill[];
};
```

Read-time behavior:

1. Check GitHub `main`.
2. If unchanged and indexed, return DB entries.
3. If changed or no index exists, try to acquire the lock.
4. If lock acquired, refresh inline within the appropriate read budget.
5. If lock not acquired, wait briefly and return fresh/stale/refreshing/
   unavailable based on state.

RSC prefetch for the Skills page should run the same query and may spend the
read-time budget. Skills list/detail queries should use `staleTime: 0` and no
polling. Manual refresh invalidates the query; it does not force rebuild when
GitHub SHA is unchanged.

`get` also performs read-time enforcement. Direct detail URLs have the same
freshness contract as the list page.

If a requested skill no longer exists after a successful refresh, return
`NOT_FOUND` with an app-level code such as `skill_not_found`. If GitHub cannot
be checked and the last good index contains the skill, show stale detail
content.

## Setup Integration

After successful `.lightfast` setup verification, enqueue an initial
`app/skills.index.refresh.requested` event for the watched repository.

Do not block setup completion on indexing. If event send fails, log it and
continue. Scheduler/read-time enforcement will recover.

Setup verification should not require `main` to exist. Skills page/indexer
reports missing `main`.

Read-time skill refresh must not clear `.lightfast` setup proof if GitHub loses
access. Show stale/unavailable and a repair-oriented message. Setup/settings
flows own repair.

## API Shape

Suggested tRPC procedures:

```ts
org.workspace.skills.list
org.workspace.skills.get
```

`list` input:

```ts
{
  validationStatus?: "valid" | "invalid";
}
```

`get` input:

```ts
{
  slug: string;
}
```

Both procedures run through `boundOrgProcedure`.

All bound workspace members can view Skills and read indexed skill markdown.
Pending members follow existing workspace restrictions and cannot view Skills.

The API returns normalized fields and diagnostics, not raw frontmatter as a
separate object. It may return body markdown for rendering. Full source
markdown can remain server-only unless a later raw-source UI is added.

## UI Design

Add `Skills` to the Workspace sidebar group after `People`.

Routes:

```text
/:org/skills
/:org/skills/<skill-name>
```

Use `WorkspaceSurface` with `variant="flush"`.

The list page should be a dense maintenance surface:

- header with `Skills`;
- repository full name and branch `main`;
- status badge: `Fresh`, `Refreshing`, `Stale`, or `Unavailable`;
- short indexed SHA and current GitHub SHA when known;
- commit SHA links to GitHub;
- `Open in GitHub` action;
- refresh button disabled while pending;
- index-level diagnostics;
- local client-side search;
- segmented filter: `All`, `Invalid`, `Valid`;
- invalid-first, slug-ascending rows.

Rows are full-width bordered sections, not nested cards. Collapsed rows show:

- exact skill name;
- description;
- validation status and diagnostic counts;
- resource counts;
- source path;
- commit-pinned `View source` link.

Rows are expandable. Expanded rows show:

- rendered body markdown preview;
- optional standard fields;
- sorted metadata;
- validation diagnostics;
- standard resource paths with commit-pinned GitHub links;
- non-standard resource count.

The rendered markdown preview should have readable measure, around 72ch.

The detail route is a focused full workspace page with a back link. It reuses
the same metadata, diagnostics, rendered preview, and resource display. It is
for deep links and focused inspection, not a split-pane replacement for the
list.

Empty states:

- zero canonical skills on `main`: successful fresh empty index;
- show expected path `skills/<name>/SKILL.md`;
- action label: `Open in GitHub`;
- no in-app generated example template in v1.

## Markdown Rendering

Add a server-capable inert markdown renderer in `@repo/ui` for skill previews.
Use existing `SSRCodeBlock` for fenced code blocks where possible.

Support:

- paragraphs;
- headings with deterministic ids;
- same-document `#anchor` links;
- ordered and unordered lists;
- blockquotes;
- inline code;
- fenced code blocks;
- horizontal rules;
- GFM tables;
- GFM task lists;
- external links.

Do not support:

- raw HTML rendering;
- MDX/components;
- executing scripts;
- loading images;
- authenticated asset proxying in v1.

Link policy:

- External absolute `http`/`https` links open safely in a new tab.
- Same-document `#anchor` links are allowed.
- Relative links that stay inside the skill directory are rewritten to
  commit-pinned GitHub blob URLs.
- Relative links that escape the skill directory with `..` are rendered inert.
- Root-relative links such as `/docs/foo` are rendered inert in v1.

Image policy:

- Markdown images are rendered as inert image references, not loaded images.
- Relative image targets inside the skill directory link to commit-pinned
  GitHub blob URLs.
- External image URLs are not loaded automatically.

App search excludes markdown body by default. Expanded rendered content remains
searchable with browser find.

## GitHub Links

Build links from configured GitHub web base URL and repository metadata:

- repo link: `/<owner>/.lightfast`;
- commit link: `/<owner>/.lightfast/commit/<sha>`;
- source file link:
  `/<owner>/.lightfast/blob/<indexedCommitSha>/skills/<name>/SKILL.md`;
- resource links:
  `/<owner>/.lightfast/blob/<indexedCommitSha>/<resourcePath>`.

Source/resource links are commit-pinned because UI content is indexed from a
specific commit. The header `Open in GitHub` action can open the repository.

No repo visibility badge in v1.

## Error Handling

Branch missing:

- `main` is required for v1.
- If a previous index exists, return it as stale with `main_branch_missing`.
- If no previous index exists, return unavailable.

Repository inaccessible:

- Return the previous index as stale when possible.
- Surface a repair-oriented error.
- Do not silently clear `.lightfast` setup proof in the read path.

GitHub rate limited or unavailable:

- Return the previous index as stale when possible.
- Record sanitized failure metadata.
- Allow schedule, webhook, read, or manual refresh to retry.

Tree truncated:

- Fail the rebuild with `github_tree_truncated`.
- Return the previous index as stale when possible.
- Do not attempt partial indexing in v1.

Too many canonical skills:

- Fail the rebuild with `too_many_skills`.
- Do not index the first 200 as a partial result.

Invalid skill file:

- Store visible invalid row when the path is canonical and slug-valid.
- Include structured diagnostics.
- Do not fail valid sibling skills.

Invalid skill-name directories:

- Do not produce rows.
- Summarize in index-level diagnostics.

Expired `refreshing` state:

- Treat as stale if previous index exists, otherwise unavailable.
- Next request/job may acquire the lock.

Failure messages:

- Store stable error code plus sanitized bounded message, max 512 characters.
- Do not store raw GitHub response bodies.

## Security

- GitHub App JWTs and installation tokens remain server-side.
- Do not expose raw GitHub response bodies, tokens, signatures, or private keys
  in API responses or logs.
- Skill markdown is read-only repository content. Do not execute it or treat it
  as trusted runtime instructions in v1.
- Render markdown inertly: no raw HTML, no MDX, no automatic image loads.
- Keep org access behind existing bound workspace procedures.

## Reserved Routes

Adding `/:org/skills` may require updating central reserved-name route coverage
if this repo protects workspace route names. Implementation should check and
update the existing route coverage tests/data if applicable.

Skill slugs do not need workspace reserved-name validation because detail URLs
are nested under `/skills/<skill-name>`.

## Observability

Scheduler and refresh workers should log structured events without secrets:

- source-control repository id;
- repository full name;
- trigger reason;
- target/current/indexed commit SHAs;
- result status;
- skill counts;
- invalid counts;
- duration;
- stable error code.

Skill index status is independent from generic source-control webhook delivery
status. Webhook transport failures do not directly alter skill index status;
scheduled/read-time reconciliation repairs missed webhooks.

## Testing

Focused tests should cover:

- `@repo/skills-contract` parser fixtures:
  - valid minimal skill;
  - name/slug mismatch;
  - missing description;
  - description over 1024 characters;
  - malformed YAML repaired by compatibility fallback;
  - malformed YAML unrecoverable;
  - optional field warnings;
  - resource inventory;
  - invalid skill-name directory diagnostics;
  - too many skills;
  - oversize skill.
- `@repo/github-app-node` ref helper:
  - `200`;
  - `304`;
  - missing branch;
  - ETag handling;
  - invalid response.
- `@repo/github-app-node` blob helper:
  - base64 decode;
  - invalid response;
  - fetch failure.
- `@db/app`:
  - index state create-or-load;
  - CAS lock acquisition;
  - token-matched release;
  - lock expiry;
  - checked-state updates;
  - delete-and-insert replacement transaction;
  - failure metadata.
- `@api/app`:
  - scheduler candidate eligibility and `.lightfast` proof validation;
  - unchanged ref no-op;
  - changed ref enqueue;
  - webhook event filters for main and `skills/**`;
  - read-time inline refresh;
  - lock contention fallback;
  - timeout abort/failure metadata;
  - stale fallback on GitHub failure;
  - unavailable when first build fails;
  - deleted skill detail 404 after successful refresh;
  - stale skill detail when GitHub cannot be checked.
- `@repo/ui` markdown renderer:
  - inert raw HTML;
  - fenced code via SSR code block;
  - GFM table/task list rendering;
  - relative link rewriting;
  - escape/root-relative links inert;
  - image references not loaded.
- `apps/app`:
  - sidebar route;
  - list fresh/stale/refreshing/unavailable states;
  - invalid-first sorting;
  - local filters/search;
  - expandable rendered preview;
  - detail route;
  - empty state.
- Emulator-backed integration:
  - create/update `skills/foo/SKILL.md`;
  - webhook-triggered refresh path;
  - read-time refresh path independent of webhook;
  - scheduled reconciliation ref-check path.

Expected focused commands:

```bash
pnpm --filter @repo/skills-contract test
pnpm --filter @repo/github-app-node test
pnpm --filter @db/app test
pnpm --filter @api/app test -- src/__tests__/skills-index-service.test.ts src/__tests__/workspace-skills-router.test.ts
pnpm --filter @repo/ui typecheck
pnpm --filter @lightfast/app test -- src/__tests__/app/\\(app\\)/\\(pending-not-allowed\\)/\\[slug\\]/skills/page.test.tsx src/__tests__/components/app-sidebar.test.tsx
pnpm typecheck
```

Do not require the official Agent Skills conformance suite in v1 unless it is
lightweight and stable enough to add without blocking implementation.

## Migration Plan

1. Create `@repo/skills-contract`.
2. Add DB schema/helpers for skill index state and current entries.
3. Generate Drizzle migrations with `pnpm db:generate`; do not write manual SQL.
4. Add GitHub ref/blob helpers and tree size support to `@repo/github-app-node`.
5. Add cached installation-token helper in the local GitHub service boundary.
6. Add skill index services in `api/app`.
7. Add Inngest events/functions for webhook refresh and hourly reconciliation.
8. Enqueue best-effort initial refresh after `.lightfast` setup verification.
9. Add `org.workspace.skills` tRPC procedures.
10. Add server-capable inert markdown renderer in `@repo/ui`.
11. Add `/:org/skills` and `/:org/skills/<skill-name>` routes.
12. Add sidebar item and route-reserved-name coverage if applicable.
13. Add focused tests across contract, GitHub helpers, DB helpers, API service,
    Inngest functions, UI renderer, router, and app UI.
14. Run focused tests and `pnpm typecheck`.

## Success Criteria

- Verified org `.lightfast` repositories are indexed from `refs/heads/main`.
- Webhook, hourly schedule, and read-time page access all converge on one
  refresh service.
- Missed GitHub webhooks cannot make skills permanently stale.
- Opening `/:org/skills` always checks GitHub before trusting the index.
- If `main` is unchanged, the page returns DB entries without fetching tree or
  blob content.
- If `main` changed, refresh uses the mutex and either returns fresh data or a
  visible stale/unavailable fallback within budget.
- Invalid canonical skills are visible with structured diagnostics.
- Resource inventory is shown without fetching resource contents.
- Rendered markdown previews are inert and safe.
- No skill content is used for agent runtime behavior in v1.

## External API Notes

Agent Skills standard references:

- Specification: <https://agentskills.io/specification>
- Client implementation guidance:
  <https://agentskills.io/client-implementation/adding-skills-support>

The design relies on GitHub REST APIs that support installation-token access:

- Git refs: <https://docs.github.com/v3/git/refs>
- Git trees: <https://docs.github.com/en/rest/git/trees>
- Conditional requests:
  <https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api>
- GitHub App rate limits:
  <https://docs.github.com/developers/apps/rate-limits-for-github-apps>
