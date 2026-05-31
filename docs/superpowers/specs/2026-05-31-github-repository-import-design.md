# GitHub Repository Import Design

## Context

Lightfast now has the GitHub organization binding, `.lightfast` repository
requirement, and generic source-control repository webhook substrate in place.
The existing durable model already has a source-control binding table and a
watched repository table:

- `lightfast_org_source_control_bindings` records the active GitHub App
  installation bound to a Lightfast organization.
- `lightfast_source_control_repositories` records repositories that Lightfast
  should explicitly watch under that binding.

The `.lightfast` setup flow currently verifies `<github-org>/.lightfast`,
stores proof on the binding metadata, and upserts a watched repository for
`skills/**`. The next step is to let an organization admin explicitly import
additional repositories from the connected GitHub organization.

## Decision

Build repository import as part of the existing Source Control settings surface.
The UI should follow an integration-page shape:

1. GitHub integration identity and connection summary.
2. Connected GitHub organization card.
3. Repositories section for that organization.
4. An `Import repositories` action that opens a modal checklist.

Do not show personal GitHub account state on this screen in v1.

Repository import is explicit. Lightfast lists repositories accessible to the
bound GitHub App installation, but it only creates watched repository rows for
repositories the admin selects in the modal.

## Goals

- Let an org admin import one, many, or all repositories from the connected
  GitHub organization.
- Keep the outer access boundary as the already-bound GitHub App installation.
- Keep Lightfast's durable repository set explicit and auditable.
- Reuse `lightfast_source_control_repositories` as the imported repository
  registry.
- Preserve `.lightfast` setup semantics and its `skills/**` watched path.
- Show imported and available repositories in the Source Control settings UI.
- Keep the first implementation production-shaped against real GitHub and the
  local GitHub emulator.

## Non-Goals

- No automatic import of every repository after GitHub org binding.
- No personal GitHub account UI on the org source-control integration screen.
- No per-file indexing, repository mirroring, or file content storage.
- No repository removal workflow in v1.
- No GitHub Enterprise Server endpoint matrix.
- No user token or PAT requirement for listing installation repositories.
- No new durable repository catalog table in v1.

## Source Of Truth

GitHub remains the live source of truth for repositories that are available to
import. Lightfast stores only the repositories that have been imported.

Available repositories:

- fetched live from the bound GitHub App installation using an installation
  token;
- filtered to the active binding's `providerAccountLogin`;
- merged in the API response with existing watched rows.

Imported repositories:

- stored in `lightfast_source_control_repositories`;
- unique by `(orgSourceControlBindingId, providerRepositoryId)`;
- resolved by webhook ingestion exactly as the generic source-control substrate
  already does.

## GitHub API

Add a helper to `@repo/github-app-node` for listing repositories accessible to
an installation token:

```ts
listGitHubInstallationRepositories({
  apiBaseUrl,
  apiVersion,
  installationToken,
  page,
  perPage,
});
```

It calls:

```text
GET /installation/repositories
```

The helper returns normalized repository fields needed by Lightfast:

```ts
type GitHubInstallationRepository = {
  fullName: string;
  id: string;
  name: string;
  owner: string;
  private: boolean;
};
```

The helper should support pagination and default to `perPage: 100`. For the
first UI, the API can fetch all pages for the bound installation. If real orgs
make that too expensive later, add cursor pagination at the Lightfast API
boundary without changing the durable model.

## API Design

Extend `api/app/src/router/(pending-not-allowed)/org-source-control.ts`.

### `get`

Continue returning the current source-control binding summary, but include
repository summary counts for the connected binding:

```ts
{
  binding: {
    accountLogin: string | null;
    connectedAt: Date;
    provider: string;
    providerLabel: string;
    importedRepositoryCount: number;
  } | null;
  status: "bound" | "unbound";
}
```

### `listRepositories`

Admin and member readable. Requires an active org identity. If no GitHub binding
exists, return an empty list with `status: "unbound"`.

```ts
{
  repositories: Array<{
    fullName: string;
    id: string;
    imported: boolean;
    name: string;
    owner: string;
    private: boolean;
    watchedPathGlobs: string[] | null;
  }>;
  status: "bound" | "unbound";
}
```

Behavior:

1. Load the active binding for `ctx.auth.identity.orgId`.
2. Require `binding.provider === "github"` and a provider installation id.
3. Create a GitHub App JWT.
4. Mint an installation token for `binding.providerInstallationId`.
5. List installation repositories from GitHub.
6. Filter to `repository.owner === binding.providerAccountLogin`.
7. Load watched repository rows for the binding.
8. Merge live GitHub repositories with watched rows by provider repository id.

Filtering to the bound account prevents a stale or unusual installation response
from surfacing repositories outside the connected GitHub organization.

### `importRepositories`

Admin-only mutation. It imports selected repositories by provider repository id.

```ts
{
  repositories: Array<{
    fullName: string;
    id: string;
    name: string;
    owner: string;
    watchedPathGlobs?: string[];
  }>;
}
```

Validation:

- at least one repository;
- every repository owner must match the bound GitHub account login;
- every repository full name must be `owner/name`;
- optional watched paths must pass `watchedPathGlobsSchema`.

Behavior:

1. Load the active GitHub binding.
2. Fetch live installation repositories from GitHub.
3. Build an allowlist of repository ids accessible to the installation and
   owned by the bound account.
4. Reject any selected repository id that is not in that allowlist.
5. Upsert watched rows for selected repositories.
6. Return the same merged repository list as `listRepositories`.

Default watches:

- `.lightfast` remains `skills/**` when imported through setup.
- Additional repositories default to `["**"]`.
- `@repo/source-control-contract` must add an exported all-paths watch constant:

```ts
export const SOURCE_CONTROL_ALL_PATHS_GLOB = "**" as const;
```

`watchedPathGlobsSchema` must accept `"**"`, and `matchesWatchedPath` must treat
it as matching any non-empty changed path. This keeps normal repository import
simple while preserving `.lightfast` as a narrower `skills/**` watch.

## Database Helpers

Add focused helpers in `db/app/src/utils/source-control-repositories.ts`:

- `listWatchedSourceControlRepositories(db, { orgSourceControlBindingId })`
- `upsertManyWatchedSourceControlRepositories(db, input)`

Do not add columns for `owner`, `name`, `private`, `defaultBranch`, or sync
state. `fullName`, `providerRepositoryId`, and watched paths are enough for the
first import workflow.

## UI Design

Update the existing settings source-control component rather than creating a
new top-level route in v1.

The page should contain:

- GitHub heading and short description.
- Integration metadata card with enabled-by, support, docs, and about affordance
  using local product copy and links.
- Connected organizations card showing the bound GitHub org and connected
  status.
- Repositories card showing imported and available repositories.
- `Refresh GitHub` action that invalidates/refetches the repository list.
- `Import repositories` button that opens a modal checklist.

The import modal should include:

- repository search/filter by name;
- selectable rows with repository name and private/public indicator;
- a select-all-visible control;
- imported repositories shown as disabled because v1 does not edit existing
  watch scopes from the import modal;
- a submit button with selected count.

For v1, keep watch-scope editing out of the modal. Imported normal repositories
use the default `["**"]` all-paths watch.

## Local Emulator

Extend the GitHub emulator's compatible API surface with:

```text
GET /installation/repositories
```

The route should authenticate an installation token, list repositories
accessible to that installation, and return GitHub-shaped `total_count` and
`repositories` fields. This keeps local development and tests production-shaped.

The emulator seed should include at least two repositories under the connected
organization so the import UI can exercise imported and available states.

## Error Handling

- Missing binding: show the existing unbound source-control state and link back
  to GitHub setup.
- GitHub listing failure: show the connected organization and an inline
  repository-list error with retry.
- Selected repository no longer accessible: reject the mutation with
  `PRECONDITION_FAILED` and refetch the list.
- Non-admin import attempt: reject with `FORBIDDEN`.

The UI should preserve already imported rows when a live GitHub refresh fails,
so admins can still see current Lightfast state.

## Testing

Add tests at each boundary:

- `@repo/github-app-node`: pagination, normalization, request headers, invalid
  response handling for installation repository listing.
- `db/app`: listing watched repositories by binding and bulk upsert behavior.
- `api/app`: source-control router read/import behavior, admin guard, owner
  filtering, inaccessible repository rejection, and merged imported/available
  output.
- `@repo/source-control-contract`: `SOURCE_CONTROL_ALL_PATHS_GLOB`,
  validation, and matching semantics for `["**"]`.
- `emulators/github`: `GET /installation/repositories` with installation-token
  authentication.
- `apps/app`: source-control integration UI renders connected orgs, omits
  personal GitHub account state, opens import modal, filters repositories, and
  submits selected repositories.

## Rollout

The feature can ship without migrating existing rows. Existing `.lightfast`
watch rows remain valid. After deployment, organizations with a connected
GitHub org will see their current imported repositories and can explicitly add
more from the integration UI.
