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
4. An `Add repository` action that opens a searchable single-repository picker.

Do not show personal GitHub account state on this screen in v1.

Treat `.lightfast` as setup infrastructure, not as a normal imported
repository. It should not appear in the normal repositories list, the
add-repository picker, or imported repository counts. Its existing watch row
continues to power setup/webhook behavior, but UI exposure belongs in setup or
connection status only.

Repository import is explicit. Lightfast lists repositories accessible to the
bound GitHub App installation, but it only creates one watched repository row
when the admin explicitly adds one repository.

Repository identity is ID-first. Durable Lightfast state should record the
import decision and watch policy, not GitHub display metadata that can drift.
Repository names, full names, owner logins, visibility, and installation account
labels are fetched from GitHub wherever the UI or API needs to render them.

## Goals

- Let an org admin add repositories from the connected GitHub organization one
  at a time.
- Keep the outer access boundary as the already-bound GitHub App installation.
- Keep Lightfast's durable repository set explicit and auditable.
- Reuse `lightfast_source_control_repositories` as the imported repository
  registry.
- Preserve `.lightfast` setup semantics and its `skills/**` watched path while
  excluding it from the normal repository add/list surface.
- Show imported and available repositories in the Source Control settings UI
  using live GitHub repository data.
- Keep the first implementation production-shaped against real GitHub and the
  local GitHub emulator.

## Non-Goals

- No automatic import of every repository after GitHub org binding.
- No bulk import or import-all workflow in v1.
- No personal GitHub account UI on the org source-control integration screen.
- No per-file indexing, repository mirroring, or file content storage.
- No initial repository scan or sync job when a repository is added.
- No repository removal workflow in v1.
- No GitHub Enterprise Server endpoint matrix.
- No user token or PAT requirement for listing installation repositories.
- No new durable repository catalog table in v1.
- No normal repository add/list affordance for `.lightfast`.

## Source Of Truth

GitHub remains the live source of truth for all repository and account metadata
that can change outside Lightfast. Lightfast stores only the durable facts it
owns: the binding, the imported repository ids, and the watch policy.

Persisted Lightfast state:

- active binding: provider, provider account id, provider installation id,
  status, connected user, connected timestamp, and provider setup metadata
  needed for auth and setup gates;
- imported repository watch: provider repository id, watched path globs,
  internal id, and timestamps.

The `.lightfast` setup repository remains represented by its existing setup
proof in binding metadata and its watched row. That row is not part of the
normal imported-repository surface.

Live GitHub state:

- organization login and display labels;
- repository full name, name, owner login, owner id, and visibility;
- repository availability under the installation.

The API may return GitHub repository metadata only when it has just fetched that
metadata from GitHub. The client must not round-trip names, full names, owner
logins, or visibility back to import mutations. Import mutations accept a
single provider repository id only and re-fetch GitHub data server-side before
writing.

The existing `lightfast_source_control_repositories.full_name` column is a
compatibility/detail field, not a source of truth for this feature. New API and
UI behavior must not read it to render current repository state. If the column
is still required by the current schema, populate it only from the fresh GitHub
response during import/setup. Prefer removing that dependency during
implementation if it can be done without widening the feature.

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
  ownerId: string;
  ownerLogin: string;
  private: boolean;
};
```

The helper should support pagination and default to `perPage: 100`. For the
first UI, the API can fetch all pages for the bound installation. If real orgs
make that too expensive later, add cursor pagination at the Lightfast API
boundary without changing the durable model.

Add a helper for fetching the current installation/account metadata by
installation id with GitHub App JWT authentication:

```ts
getGitHubAppInstallation({
  apiBaseUrl,
  apiVersion,
  appJwt,
  installationId,
});
```

It calls:

```text
GET /app/installations/{installation_id}
```

The helper returns the current installation id, target type, account id, account
login, and GitHub installation `html_url`. Use this to render the connected
organization card, expose a `Manage GitHub access` link, and avoid treating the
binding's stored login or a locally constructed settings URL as current display
state.

## API Design

Extend `api/app/src/router/(pending-not-allowed)/org-source-control.ts`.

### `get`

Continue returning the current source-control binding summary, but include
repository summary counts for the connected binding:

```ts
{
  binding: {
    connectedAt: Date;
    provider: string;
    providerLabel: string;
    importedRepositoryCount: number; // excludes .lightfast setup repository
  } | null;
  status: "bound" | "unbound";
}
```

### `listRepositories`

Admin and member readable. Requires an active org identity. If no GitHub binding
exists, return an empty list with `status: "unbound"`. If live GitHub
installation metadata cannot be fetched, return no organization metadata. If
installation metadata succeeds but repository listing fails, return the live
organization metadata and `installationManageUrl`, mark the repository list as
errored, and return no repository rows.

```ts
{
  organization: {
    id: string;
    installationManageUrl: string;
    login: string;
  } | null;
  repositories: Array<{
    fullName: string;
    id: string;
    imported: boolean;
    name: string;
    owner: {
      id: string;
      login: string;
    };
    private: boolean;
    watchedPathGlobs: string[] | null;
  }>;
  repositoriesError: {
    code: "github_repository_listing_failed";
    message: string;
  } | null;
  status: "bound" | "unbound";
}
```

Behavior:

1. Load the active binding for `ctx.auth.identity.orgId`.
2. Require `binding.provider === "github"` and a provider installation id.
3. Create a GitHub App JWT.
4. Fetch current installation/account metadata from GitHub.
5. Require the installation account id to match the binding's
   `providerAccountId`.
6. Mint an installation token for `binding.providerInstallationId`.
7. List installation repositories from GitHub.
8. Filter to `repository.ownerId === binding.providerAccountId`.
9. Load watched repository rows for the binding.
10. Identify the `.lightfast` setup repository id from binding metadata when
    present.
11. Exclude `.lightfast` from the normal available/imported repository list.
12. Merge remaining live GitHub repositories with watched rows by provider
    repository id.
13. Omit watched rows that are no longer present in the live GitHub response.

Filtering by provider account id prevents stale logins, renamed organizations,
or unusual installation responses from surfacing repositories outside the
connected GitHub organization.

If a previously added repository is no longer returned by GitHub, the API should
not synthesize a placeholder from Lightfast state. The durable watch row remains
in place for future recovery if access returns, but the normal list only renders
repositories backed by fresh GitHub metadata.

The `organization.installationManageUrl` value must come from the live GitHub
installation response `html_url`. Do not persist this URL and do not construct
it from stored binding fields.

### `importRepository`

Admin-only mutation. It imports one repository by provider repository id. Use
the existing org-admin procedure/gate so non-admin callers fail closed with
`FORBIDDEN`.

```ts
{
  repositoryId: string;
}
```

Validation:

- the repository id must be non-empty;
- the repository id must exist in the live GitHub installation repository
  allowlist;
- the repository owner id must match the bound provider account id.

Behavior:

1. Load the active GitHub binding.
2. Fetch current installation/account metadata from GitHub.
3. Require the installation account id to match the binding's
   `providerAccountId`.
4. Fetch live installation repositories from GitHub.
5. Build an allowlist of repository ids accessible to the installation and
   owned by the bound account id.
6. Reject the repository id if it is the `.lightfast` setup repository id.
7. Reject the repository id if it is not in that allowlist.
8. If a watched row already exists for the repository id, treat the request as
   idempotent success and do not change its watched path globs.
9. Otherwise insert one watched row for the selected repository id.
10. Return the same live, merged repository list as `listRepositories`.

Adding a repository only registers it for future webhook-driven source-control
events. It must not enqueue an initial repository sync or fetch repository
contents.

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

If the setup proof is unavailable for an older local row, fall back to excluding
repositories whose live GitHub `name` is `.lightfast`. Do not rely on the stored
`fullName` column for this filter.

## Database Helpers

Add focused helpers in `db/app/src/utils/source-control-repositories.ts`:

- `listWatchedSourceControlRepositories(db, { orgSourceControlBindingId })`

The helper surface should be provider-id and watch-policy oriented. Do not add
columns or helper contracts for `owner`, `name`, `private`, `defaultBranch`,
sync state, or any other provider metadata that can go stale. If existing schema
constraints still require `fullName`, keep it inside the helper as a freshly
observed compatibility write and do not expose it as durable repository state.
Use the existing single-repository upsert path for imports; v1 does not need a
bulk database helper. The API should check for an existing watched row before
writing so duplicate add requests do not overwrite watched path globs.

## UI Design

Update the existing settings source-control component rather than creating a
new top-level route in v1.

The page should contain:

- GitHub heading and short description.
- Integration metadata card with enabled-by, support, docs, and about affordance
  using local product copy and links.
- Connected organizations card showing the currently fetched GitHub org login
  and connected status.
- Repositories card showing imported and available normal repositories, with
  `.lightfast` omitted.
- `Refresh GitHub` action that invalidates/refetches the repository list.
- `Add repository` button that opens a searchable repository picker for admins;
  render it disabled for non-admin org members.
- `Manage GitHub access` link that opens the live GitHub installation settings
  URL when GitHub installation metadata is available to an admin.

The add-repository modal should include:

- repository search/filter by name;
- single-select rows with repository name and private/public indicator;
- imported repositories shown as disabled because v1 does not edit existing
  watch scopes from the import modal;
- `.lightfast` omitted because setup infrastructure is not added from this
  modal;
- `Manage GitHub access` link for cases where the admin expects a repository
  that is not accessible to the current GitHub App installation;
- a submit button for the selected repository.

Non-admin org members can view the connected organization and repository list,
and can refresh the live GitHub-backed list. They cannot open the add-repository
modal, submit `importRepository`, or open the `Manage GitHub access` affordance
from Lightfast. If the client cannot determine the active org role, treat the
viewer as non-admin for mutation affordances.

For v1, keep watch-scope editing out of the modal. Imported normal repositories
use the default `["**"]` all-paths watch.

Repository-list failures must not block the whole integration settings screen.
If live installation metadata is available, keep rendering the GitHub heading,
integration metadata card, connected organization card, and admin-only
`Manage GitHub access` link. Only the repositories card should switch to an
inline error/retry state, and `Add repository` should be disabled until the list
refresh succeeds.

When live GitHub data is unavailable, the UI should show the connected status,
the imported repository count from Lightfast, and a retry affordance. It should
not render repository names, org logins, visibility, or other provider metadata
from stale Lightfast fields. It should also omit `Manage GitHub access` until a
fresh installation `html_url` is available.

When GitHub is reachable but an imported repository is no longer included in the
installation repository response, omit that repository from the normal list
rather than rendering a stale placeholder row.

## Local Emulator

Extend the GitHub emulator's compatible API surface with:

```text
GET /app/installations/{installation_id}
GET /installation/repositories
```

The installation route should authenticate a GitHub App JWT and return
GitHub-shaped installation/account fields including `html_url`. The repository
route should
authenticate an installation token, list repositories accessible to that
installation, and return GitHub-shaped `total_count` and `repositories` fields.
This keeps local development and tests production-shaped.

The emulator seed should include at least two repositories under the connected
organization so the import UI can exercise imported and available states.

## Error Handling

- Missing binding: show the existing unbound source-control state and link back
  to GitHub setup.
- GitHub installation metadata failure: show the connected status and an inline
  refresh error with retry, without rendering stale provider account labels.
- GitHub listing failure after installation metadata succeeds: keep the
  integration header and connected organization rendered from live installation
  metadata, show imported repository count plus an inline repository-list error
  with retry in the repositories card, and avoid rendering stale repository
  labels.
- Selected repository no longer accessible: reject the mutation with
  `PRECONDITION_FAILED` and refetch the list.
- Selected repository already added: return success with the refreshed list and
  preserve the existing watch policy.
- Existing imported repository no longer accessible: omit it from the normal
  list while preserving its Lightfast watch row.
- Non-admin import attempt: reject with `FORBIDDEN`.

## Testing

Add tests at each boundary:

- `@repo/github-app-node`: pagination, normalization, request headers, invalid
  response handling for installation repository listing, and current
  installation/account metadata fetching including `html_url`.
- `db/app`: listing watched repositories by binding and single-repository
  upsert behavior.
- `api/app`: source-control router member-readable list behavior, admin-only
  import behavior, owner id filtering, inaccessible repository rejection,
  idempotent already-added imports, merged imported/available output,
  nonblocking repository-list errors when installation metadata is available,
  `.lightfast` exclusion, omission of unavailable watched repositories, and no
  client-supplied repository metadata in import mutations.
- `@repo/source-control-contract`: `SOURCE_CONTROL_ALL_PATHS_GLOB`,
  validation, and matching semantics for `["**"]`.
- `emulators/github`: `GET /app/installations/{installation_id}` with app JWT
  authentication returning `html_url`, and `GET /installation/repositories`
  with installation-token authentication.
- `apps/app`: source-control integration UI renders connected orgs for members,
  omits personal GitHub account state, disables add-repository controls for
  non-admins, opens add-repository modal for admins, filters repositories, shows
  `Manage GitHub access` only to admins from live installation metadata, omits
  `.lightfast` from normal repo UI, keeps repository-list failures scoped to the
  repositories card, and submits one selected repository.

## Rollout

The feature can ship without migrating existing rows. Existing `.lightfast`
watch rows remain valid but are excluded from the normal repository list. After
deployment, organizations with a connected GitHub org will fetch current
repository state from GitHub and can explicitly add more repositories from the
integration UI. Added repositories become active for future GitHub webhook
deliveries only.
