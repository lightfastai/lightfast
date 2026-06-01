# Skills UI Request-Time Index Design

## Context

Lightfast now has the source-control foundation needed for `.lightfast`:

- GitHub organization setup binds an installation to a Lightfast organization.
- The `.lightfast` setup task verifies `<github-org>/.lightfast`.
- Verification stores a watched source-control repository for `skills/**`.
- The generic webhook path can receive signed GitHub push events and enqueue
  source-control sync work.

This design adds the next product layer: build and show skills from the
organization's `.lightfast` repository. In this implementation, skills are not
loaded into agents, executed, installed, or used for runtime behavior. They are
built, validated, indexed, and displayed in the UI so the team can maintain the
main-branch skill set.

The core correctness concern is that GitHub webhooks can be late, duplicated,
or missed. Therefore, webhooks must not be the authority for skill freshness.

## Decision

Use request-time GitHub reconciliation for the Skills UI.

Every `list` or `get` request for skills checks GitHub for the current
`.lightfast` `refs/heads/main` commit SHA before returning. The database stores
the latest successful materialized skill index as a cache and fallback, not as
the source of truth.

Request behavior:

1. Load the active `.lightfast` watched repository for the organization.
2. Ask GitHub for the current `main` ref.
3. If the indexed commit SHA equals the GitHub `main` SHA, return the DB index.
4. If the SHA differs or no index exists, acquire a single-flight DB lock and
   build the index inline during the request.
5. If the inline build succeeds, replace the materialized DB index and return
   fresh skills.
6. If GitHub or a build-level parser failure occurs, keep the last successful
   index visible and return it with stale/error metadata.
7. If no successful index exists and the first build fails, return a product
   error state instead of inventing an empty index.

No skill-indexing background refresh is required for v1. Webhooks remain useful
as generic source-control delivery telemetry and may be used later as hints,
but the Skills UI must remain correct when every skill-related webhook is
missed.

## Goals

- Make GitHub `main` the source of truth for displayed skills.
- Keep Skills page reads fast when `main` has not changed.
- Rebuild synchronously on page/API reads when `main` changes.
- Preserve the last successful skill index when GitHub is unavailable.
- Display stale and validation states explicitly.
- Keep skill parsing and validation isolated from GitHub and UI concerns.
- Avoid proactive background skill refresh jobs in v1.
- Avoid using skills for any runtime agent behavior in this implementation.

## Non-Goals

- No agent skill loading or execution.
- No marketplace, sharing, publishing, install flow, or registry.
- No branch picker. V1 reads only `refs/heads/main`.
- No repo picker. V1 reads only the verified `.lightfast` repository.
- No browser-to-GitHub calls. GitHub App credentials stay server-side.
- No GitHub webhook dependency for skill correctness.
- No proactive Inngest skill-indexing workflow.
- No skill editor or GitHub commit creation UI.
- No support for arbitrary skill support files beyond indexing `SKILL.md`.
- No migration of local agent skills into Lightfast.

## Agent Skills Compatibility

Lightfast should align with the public Agent Skills format while keeping v1
read-only. The relevant standard references are:

- <https://agentskills.io/specification>
- <https://agentskills.io/client-implementation/adding-skills-support>

Lightfast owns its parser and contract in v1 instead of depending on the
external `skills-ref` implementation. The local contract can model
Lightfast-specific behavior: invalid-but-visible rows, warnings, DB-safe
diagnostics, request-time indexing, and UI output types.

## Skill Repository Shape

V1 recognizes one canonical file shape:

```text
skills/<skill-slug>/SKILL.md
```

The skill slug is derived from the directory name. It must match the Agent
Skills name rules:

```text
^[a-z0-9][a-z0-9-]{0,62}$
```

The slug must not start or end with a hyphen and must not contain consecutive
hyphens. The frontmatter `name` must match the parent directory slug. URLs and
API lookups use slug, never display text.

Each `SKILL.md` must contain YAML frontmatter at the top of the file, allowing
only an optional UTF-8 BOM before the opening marker:

```yaml
---
name: skill-name
description: One sentence describing when to use the skill.
license: MIT
compatibility: Requires git and network access.
allowed-tools: Bash Read
metadata:
  owner: platform
---
```

Validation rules:

- `name` is required and non-empty.
- `name` must match the parent directory slug.
- `description` is required and non-empty.
- `description` must be at most 1024 characters.
- The markdown body after frontmatter must be non-empty.
- Skill files above the configured size limit are marked invalid.
- Files outside `skills/<skill-slug>/SKILL.md` are ignored by the skill index.
- Invalid skill files are stored and displayed with validation diagnostics; they do
  not fail the whole index.

Optional standard fields:

- `license`: optional string, max 256 characters; malformed values produce
  warnings, not invalid skills.
- `compatibility`: optional string, max 512 characters; malformed values
  produce warnings, not invalid skills.
- `allowed-tools`: optional string, max 2048 characters; display as declared
  metadata only. It has no permission effect in v1.
- `metadata`: optional shallow object whose values are JSON scalars
  (`string | number | boolean | null`). Nested values produce warnings, not
  invalid skills.

Malformed or unparseable frontmatter is invalid. The parser should first use
normal YAML parsing. If that fails, it may use one narrow compatibility fallback
for common unquoted scalar lines such as `description: Uses foo:bar`; fallback
success adds a warning diagnostic.

Diagnostics must be structured with stable machine codes and human messages:

```ts
type SkillDiagnostic = {
  code: string;
  message: string;
  severity: "error" | "warning";
};
```

Recommended first limits:

- Maximum 200 skill files per repository.
- Maximum 128 KiB per `SKILL.md`.
- Fetch skill blobs with bounded concurrency, for example 4 at a time.
- Maximum 100 resource inventory paths per skill across `scripts/`,
  `references/`, and `assets`.

These limits are product safeguards, not GitHub constraints. They can be raised
after the UI and parser behavior are proven.

Zero canonical skill files is a successful fresh empty index. More than 200
canonical skill files fails the rebuild so Lightfast never presents a partial
current index.

## Skill Resources

V1 indexes resource inventory metadata, not resource contents.

For each valid slug directory, recursively inventory files under:

- `scripts/`
- `references/`
- `assets/`

Store sorted relative paths capped at 100 per skill and a truncation flag. Files
outside those standard directories are counted recursively as
`nonStandardResourceCount` but are not listed in v1. Invalid slug directories do
not produce skill rows; summarize them as index-level diagnostics.

Submodules and other non-blob Git tree entries are ignored. A canonical
`SKILL.md` must be a regular blob. Symlinks and submodules at canonical paths
produce invalid visible rows or index diagnostics, but Lightfast does not follow
them.

## Package Boundaries

### New `@repo/skills-contract`

Create a small isomorphic package:

```text
packages/skills-contract/
```

It owns Lightfast skill-index vocabulary and validation:

- skill slug schema;
- skill file path matcher;
- skill frontmatter schema;
- skill validation issue schema;
- skill index freshness/status schemas;
- parser result types shared by DB, API, and tests.

It should not import DB, GitHub, Clerk, Inngest, or Next.js code.

The package may add a catalog dependency on a YAML parser if implementation
needs complete YAML frontmatter handling. If the implementation uses a limited
frontmatter parser instead, the supported frontmatter subset must be explicit
and covered by tests.

### Existing `@repo/github-app-node`

Add narrow GitHub helpers with fetch injection:

- `getGitHubReference` for `GET /repos/{owner}/{repo}/git/ref/heads/main`;
- `getGitHubBlobText` for `GET /repos/{owner}/{repo}/git/blobs/{sha}`;
- optional ETag support for the ref request.

This package must not parse skills or know about `.lightfast` product policy.

### Existing `@db/app`

Add durable skill index tables and helpers. DB helpers should expose generic
operations such as:

- load index state by source-control repository id;
- acquire and release a refresh lock;
- replace current skills for a successful build;
- record refresh failure metadata.

DB helpers should not call GitHub or parse skill markdown.

### Existing `@api/app`

Add the orchestration service. It owns request-time refresh policy because it
can see auth, source-control binding, GitHub config, DB, and tRPC needs.

Suggested service location:

```text
api/app/src/services/skills/
```

Suggested router:

```text
api/app/src/router/(pending-not-allowed)/workspace-skills.ts
```

Expose it under:

```ts
org.workspace.skills
```

### Existing `apps/app`

Add the workspace UI route:

```text
/:slug/skills
```

The app should consume only the tRPC router output. It must not call GitHub or
reimplement skill parsing.

## Durable Data

Add two current-state tables. Do not add a run-history table in v1 unless it
becomes necessary during implementation.

### `lightfast_skill_index_states`

Purpose: one current index state per watched `.lightfast` repository.

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
- `refreshLockToken`
- `refreshLockedUntil`
- `createdAt`
- `updatedAt`

Indexes:

- unique `(sourceControlRepositoryId)`;
- index `(refreshLockedUntil)`.

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
index. Failure fields describe only the most recent failed refresh attempt.
Failure must never erase the last successful skills.
`refreshing` means another request currently owns the lock; it does not imply a
detached background worker.

### `lightfast_skills`

Purpose: current materialized skill rows for the last successful index.

Columns:

- `id`
- `skillIndexStateId`
- `slug`
- `path`
- `name`
- `description`
- `markdown`
- `bodyMarkdown`
- `frontmatter`
- `resources`
- `nonStandardResourceCount`
- `contentSha`
- `contentSize`
- `validationStatus`
- `validationDiagnostics`
- `createdAt`
- `updatedAt`

Indexes:

- unique `(skillIndexStateId, slug)`;
- index `(skillIndexStateId, validationStatus)`.

`markdown` is nullable. It stores the full `SKILL.md` content for normal valid
and invalid rows so the UI can render the last successful index while GitHub is
unavailable. Oversized or otherwise intentionally unfetched files store
`markdown: null` and do not render truncated content.

`bodyMarkdown` stores the parsed body when it can be safely separated from
frontmatter. Invalid skills may still render their body preview when available.
This is acceptable because the table is a cache of GitHub `main`, not a runtime
execution source. If storage pressure becomes real, a later version can store
metadata only and fetch markdown on detail reads.

Index-level diagnostics are separate from skill-level diagnostics. Repository
issues such as ignored invalid slug directories, resource inventory truncation,
and non-standard file counts should not require fake skill rows.

## Request-Time Refresh Flow

Both `list` and `get` should call one shared service:

```ts
ensureFreshLightfastSkillIndex({ clerkOrgId })
```

The service returns:

```ts
type SkillIndexResult = {
  freshness: {
    status: "fresh" | "stale" | "refreshing" | "unavailable";
    indexedCommitSha: string | null;
    githubCommitSha: string | null;
    indexedAt: Date | null;
    checkedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
  };
  skills: IndexedSkill[];
};
```

Detailed flow:

1. Load the active GitHub binding for the org.
2. Load the verified `.lightfast` proof and watched repository row.
3. Load or create the skill index state row.
4. Mint or reuse a process-local GitHub installation token.
5. Call GitHub for `refs/heads/main`.
   - If an ETag is stored, send `If-None-Match`.
   - A `304` response means the previously observed ref is still current.
6. If the ref is unchanged and `indexedCommitSha` matches it, return skills
   from DB with `fresh`.
7. If the ref changed or no successful index exists, try to acquire the
   refresh lock:
   - update the state row only if `refreshLockedUntil` is null or expired;
   - write a random `refreshLockToken`;
   - use a short lock TTL so abandoned requests self-heal.
8. If another request owns the lock:
   - wait briefly for the index to catch up;
   - if it catches up, return `fresh`;
   - if an older index exists, return it with `refreshing`;
   - if no older index exists, return `unavailable`.
9. If this request owns the lock, build inline:
   - fetch the commit for the GitHub `main` SHA;
   - fetch the recursive tree for the commit tree SHA;
   - reject truncated trees for v1;
   - select paths matching `skills/<slug>/SKILL.md`;
   - enforce file count and size limits;
   - fetch selected blobs with bounded concurrency;
   - parse and validate each skill;
   - transactionally replace current skill rows and index state.
10. Release the lock.
11. Return the fresh materialized skills.

Request-time builds are bounded so the page never hangs indefinitely:

- when a previous successful index exists, spend up to 3 seconds attempting the
  inline rebuild before aborting and returning the last index as stale;
- when no successful index exists, spend up to 10 seconds before aborting and
  returning unavailable;
- timeout aborts the request-time build and releases the lock. It must not
  continue as an implicit background refresh.

If inline build fails:

1. Record failure metadata on the index state.
2. Release the lock.
3. Return the last successful index as `stale` when one exists.
4. Return `unavailable` when no successful index exists.

Stored refresh status and UI freshness are separate. A timeout with previous
data stores `lastRefreshStatus: "failed"` and returns
`freshness.status: "stale"`.

The service must not enqueue an Inngest skill refresh in v1. The next page
open, query invalidation, or manual refresh button should retry the same
request-time path.

## GitHub Efficiency

Every skills read depends on GitHub, but only the cheap ref check happens on
every read.

Use this hierarchy:

1. Ref check every request.
2. Commit/tree fetch only when the ref SHA changed or no index exists.
3. Blob fetch only for matching `SKILL.md` files during a rebuild.

Use conditional requests for the ref when possible. A `304` response from
GitHub is enough to prove the cached observed ref has not changed only when the
state also stores the previously observed `lastCheckedCommitSha`. If the ETag
exists but the observed SHA is missing, do not send a conditional request.
Store the latest ref ETag on the index state row.

Installation tokens should not be stored durably. A small process-local cache
keyed by installation id is acceptable because it only reduces token creation
requests; correctness still comes from GitHub ref checks.

Rebuilds are all-or-nothing per GitHub `main` commit. Build the candidate index
in memory, then replace the current skill rows and state in one transaction.
One canonical blob fetch failure aborts the rebuild and preserves the previous
successful index. Oversized canonical files are invalid rows, not build
failures, when their path and blob SHA are known.

## UI Design

Add `Skills` to the Workspace sidebar group after `People`.

The page should be operational and compact:

- header with `Skills`, repository full name, and branch `main`;
- freshness badge: `Fresh`, `Refreshing`, `Stale`, or `Unavailable`;
- last indexed time and short indexed commit SHA;
- refresh button that invalidates the tRPC query;
- client-side search over slug, name, description, diagnostics, and resource
  paths;
- segmented validity filter: `All`, `Invalid`, `Valid`;
- stacked full-width bordered rows, not nested cards.

List rows should show:

- skill name;
- description;
- slug;
- path;
- validation status;
- short blob SHA or commit SHA;
- resource indicators;
- expandable rendered markdown preview.

Sort invalid skills first, then valid skills, then slug ascending within each
group. Expanded row state is client-local and not encoded in the URL.

Rendered markdown previews:

- are available inline through row expansion, not open for every row by
  default;
- render the parsed body markdown, not raw frontmatter;
- use inert markdown only: headings, paragraphs, lists, code fences,
  blockquotes, and safe external links;
- do not render raw HTML, MDX, scripts, or embedded components;
- should use a readable max width around 72 characters inside each row.

The detail route should be a focused full workspace page:

```text
/:slug/skills/<skill-slug>
```

It means "the current indexed view of `skills/<skill-slug>/SKILL.md` on
`.lightfast` `main`." It should show:

- metadata;
- path and content SHA;
- validation diagnostics, if any;
- resource inventory and non-standard file count;
- rendered read-only markdown content;
- link back to the skills list.

Do not include commit SHA in v1 URLs. If a successful refresh proves the
requested skill no longer exists, return not found. If GitHub cannot be checked
and the last good index contains the skill, show stale detail content.

Empty states:

- No `skills/<slug>/SKILL.md` files on `main`: show an empty list with the
  repository and branch context.
- GitHub unavailable with a last successful index: show the stale index and an
  error banner.
- GitHub unavailable with no successful index: show an unavailable state with a
  retry action.

The page should use `WorkspaceSurface` with `variant="flush"`. Do not virtualize
the list in v1; the skill count cap and collapsed-by-default markdown previews
keep the first implementation simple.

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

`list` returns the shared freshness metadata and the indexed rows without
needing a second status endpoint. `get` also runs freshness reconciliation
before loading the requested skill so a direct detail URL is as current as the
list page.

Do not add a refresh mutation in v1. The refresh button should invalidate the
`list` or `get` query so the same request-time reconciliation path runs again.

`get` returns `NOT_FOUND` with a stable app-level code such as
`skill_not_found` only after a successful refresh or confirmed current index
does not contain the slug. It may return stale skill content if GitHub cannot
be checked and the previous successful index contains the slug.

## Webhooks

The existing GitHub webhook foundation remains useful, but it is not part of
the skill correctness contract.

For this v1:

- do not add a skill-indexing Inngest workflow;
- do not rely on webhook delivery to mark skills stale;
- do not show webhook delivery state as skill freshness;
- continue to let generic source-control delivery handling work independently.

A later version can use webhooks to prewarm the index after pushes, but the
Skills page must still perform the GitHub ref check before trusting the DB
index.

## Error Handling

Branch missing:

- `main` is required for v1.
- If a previous index exists, return it as stale with `main_branch_missing`.
- If no previous index exists, return unavailable.
- Setup should not require `main`; setup verifies repository existence and
  installation access only.

Repository inaccessible:

- Return the previous index as stale when possible.
- Surface a repair-oriented error.
- Do not silently clear the `.lightfast` setup proof in this implementation.

GitHub rate limited or unavailable:

- Return the previous index as stale when possible.
- Record failure metadata.
- Allow the next read or manual refresh to retry.
- Do not clear the `.lightfast` setup proof from the read path.

Tree truncated:

- Fail the rebuild with `github_tree_truncated`.
- Return the previous index as stale when possible.
- Do not attempt partial indexing in v1.

Invalid skill file:

- Store the skill row with `validationStatus: "invalid"`.
- Include structured validation diagnostics.
- Do not fail the whole index.
- Render body preview when the body can be safely separated from frontmatter.

Duplicate or invalid slugs:

- The path-derived slug is authoritative.
- Paths that do not match `skills/<skill-slug>/SKILL.md` are ignored and not
  displayed.
- Invalid slug directories are summarized in index-level diagnostics.
- The implementation must avoid unstable ordering for duplicate or invalid
  inputs.

Oversized skill file:

- If GitHub tree reports blob size over 128 KiB, do not fetch the blob.
- Store an invalid visible row with `markdown: null`, `contentSha`,
  `contentSize`, and an oversize diagnostic.
- If size is missing, fetch and enforce the limit after decode.
- Do not store or render truncated content.

Resource inventory limits:

- Resource path cap truncates inventory and sets a truncation flag; it does not
  fail the rebuild.
- Non-standard files are counted separately and do not consume the standard
  resource path cap.

## Security

- GitHub App JWTs and installation tokens remain server-side.
- Do not expose raw GitHub response bodies, tokens, signatures, or private keys
  in API responses or logs.
- Skill markdown is displayed as read-only content. Do not execute scripts,
  import code, or treat skill content as trusted runtime instructions.
- Sanitize or safely render markdown in the UI using existing content-rendering
  patterns.
- Keep org access behind `boundOrgProcedure`.

## Testing

Focused tests should cover:

- `@repo/skills-contract` path matching, slug validation, frontmatter parsing,
  required field validation, optional field warnings, lenient YAML fallback,
  resource inventory modeling, and structured diagnostics.
- `@repo/github-app-node` ref helper with `200`, `304`, missing branch, and
  invalid response cases.
- `@repo/github-app-node` blob text helper with base64 decoding and invalid
  response cases.
- `@db/app` index state creation, lock acquisition, lock expiry, successful
  row replacement, nullable markdown, resource metadata, index diagnostics, and
  failure metadata.
- API service returns DB immediately when GitHub ref is unchanged.
- API service rebuilds inline when GitHub `main` changes.
- API service returns stale rows when a rebuild fails and a previous index
  exists.
- API service returns unavailable when the first build fails.
- API service handles concurrent refresh attempts with one lock owner.
- API service stores invalid skills without failing valid siblings.
- API service aborts timed-out request-time rebuilds and releases the lock.
- API service fails rebuilds over the skill count cap.
- API service truncates resource inventory without failing rebuilds.
- tRPC `list` and `get` both run freshness reconciliation.
- App route renders fresh, stale, invalid, empty, unavailable, detail, not
  found, resource, diagnostic, and expanded markdown preview states.
- Emulator-backed integration: create or update `skills/foo/SKILL.md`, open
  the Skills page/API, and observe request-time refresh without depending on a
  skill webhook.

Expected focused commands:

```bash
pnpm --filter @repo/skills-contract test
pnpm --filter @repo/github-app-node test
pnpm --filter @db/app test
pnpm --filter @api/app test -- src/__tests__/skills-index-service.test.ts src/__tests__/workspace-skills-router.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/(app)/(pending-not-allowed)/[slug]/skills/page.test.tsx src/__tests__/components/app-sidebar.test.tsx
pnpm typecheck
```

## Migration Plan

1. Create `@repo/skills-contract`.
2. Add DB schema and helpers for skill index state and current skill rows.
3. Generate Drizzle migrations with `pnpm db:generate`; do not write manual SQL.
4. Add GitHub ref and blob text helpers to `@repo/github-app-node`.
5. Add the `api/app` skill index service with request-time reconciliation.
6. Add `org.workspace.skills` tRPC procedures.
7. Add the `/:slug/skills` and `/:slug/skills/<skill-slug>` workspace pages and
   sidebar item.
8. Add focused tests across contract, GitHub helpers, DB helpers, API service,
   router, and UI.
9. Run focused tests and `pnpm typecheck`.

## Success Criteria

- Opening `/:slug/skills` always checks GitHub for `.lightfast` `main`.
- If `main` is unchanged, the page returns the DB index without fetching tree
  or blob content.
- If `main` changed, the page rebuilds the skill index inline during the
  request.
- Missed GitHub webhooks cannot make the Skills page permanently stale.
- GitHub failures preserve and visibly mark the last successful index.
- Invalid skill files are visible with validation diagnostics.
- Agent Skills standard fields are parsed, stored, and displayed according to
  the v1 validation rules.
- Resource inventory metadata is displayed without loading resource contents.
- Skill rows can expand to show rendered inert markdown previews.
- Skill detail URLs show current-state slug details and become not found after
  a successful refresh proves deletion.
- No skill content is used for agent runtime behavior.
- No skill-indexing background refresh workflow is required for v1.

## External API Notes

The design relies on GitHub REST APIs that support installation-token access:

- Git refs: <https://docs.github.com/v3/git/refs>
- Git trees: <https://docs.github.com/en/rest/git/trees>
- Conditional requests: <https://docs.github.com/rest/guides/best-practices-for-using-the-rest-api>
- GitHub App rate limits: <https://docs.github.com/developers/apps/rate-limits-for-github-apps>
