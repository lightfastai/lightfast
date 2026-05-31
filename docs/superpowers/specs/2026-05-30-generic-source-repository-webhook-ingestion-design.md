# Generic Source Repository Webhook Ingestion Design

## Context

Lightfast is adding GitHub repository requirements and later repository-backed
skills. Before implementing `.lightfast` or `skills/**`, we need the generic
repository and webhook substrate working locally and in production shape.

This design deliberately treats repository name and watched paths as data. The
first implementation must work for any GitHub repository accessible to the
bound GitHub App installation. `.lightfast` is a later consumer of this
foundation, not a special case in this work.

The existing GitHub organization binding remains the authority for mapping a
GitHub App installation back to a Lightfast organization.

## Decision

Build a generic source-control repository watch and webhook ingestion layer:

1. Receive signed GitHub App webhooks at `POST /api/github/webhook`.
2. Verify the webhook signature before parsing the JSON body.
3. Parse `ping` and `push` payloads through GitHub provider schemas.
4. Deduplicate push deliveries by GitHub delivery id.
5. Resolve `installation.id` to an active org source-control binding.
6. Resolve `repository.id` to an explicitly watched repository under that
   binding.
7. Ignore unbound installations and unwatched repositories.
8. Ignore watched repository pushes whose changed paths do not match the watch
   globs.
9. Queue an Inngest repository sync event for watched repository pushes whose
   changed paths match.
10. Fetch repository state with a GitHub App installation token.
11. Persist only the repository watch registry and delivery status.

Do not persist file contents or materialized file snapshots. Repository content
is fetched on demand by whichever future consumer needs it.

## Goals

- Prove the full webhook path: emulator -> app webhook route -> durable
  delivery record -> Inngest event -> GitHub API fetch -> processed delivery.
- Keep the implementation generic across repository names.
- Require explicit repository watches instead of syncing every repository the
  GitHub App can access.
- Store only the minimum durable data needed for routing and delivery dedupe.
- Keep provider protocol in GitHub packages and generic source-control policy
  in a separate package.
- Keep local development production-shaped by using the emulator's normal
  GitHub-compatible APIs and webhook delivery.

## Non-Goals

- No `.lightfast` repository setup requirement in this implementation.
- No skills parsing, validation, indexing, or UI.
- No file content storage.
- No `source_control_repository_files` table.
- No repository mirroring.
- No repository management UI.
- No auto-registration of every repository from a GitHub installation.
- No Git remote support in the emulator.
- No GitHub Enterprise Server endpoint matrix.

## Package Boundaries

### New `@repo/source-control-contract`

Create a small isomorphic package:

```text
packages/source-control-contract/
```

Package name:

```json
"@repo/source-control-contract"
```

It owns generic source-control vocabulary only:

- repository watch schemas;
- watched path pattern schema;
- webhook delivery status constants;
- repository sync event payload schemas;
- small helper types shared by DB, API services, and tests.

Initial exports:

```ts
export const SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES = [
  "received",
  "ignored",
  "queued",
  "processed",
  "failed",
] as const;

export type SourceControlWebhookDeliveryStatus =
  (typeof SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES)[number];

export const watchedPathGlobsSchema = z.array(z.string().min(1)).min(1);
```

This package must not import GitHub packages, DB packages, Inngest, Clerk, or
provider SDKs.

### Existing `@repo/github-app-contract`

Add GitHub provider protocol schemas here:

- `GITHUB_WEBHOOK_PATH`;
- raw GitHub webhook headers schema;
- normalized `ping` payload schema;
- normalized `push` payload schema;
- normalized repository and installation fields needed by Lightfast.

This package should not own generic watch statuses or Lightfast product
requirements.

### Existing `@repo/github-app-node`

Add Node/runtime GitHub helpers here:

- `verifyGitHubWebhookSignature`;
- `createGitHubInstallationToken`;
- `getGitHubRepository`;
- `getGitHubCommit`;
- `getGitHubTree`;
- `getGitHubBlob`, only if a first implementation test or consumer needs blob
  content.

Use `fetch` directly. Do not add Octokit or a vendor wrapper for Octokit in
this implementation.

### Vendor Packages

Do not add a new vendor package by default.

If the first implementation needs full glob semantics for watched path
matching, add a narrow `@vendor/glob-match` package that wraps one dependency
such as `picomatch`. No app/package should import that third-party dependency
directly. If exact path and `prefix/**` matching is enough for this foundation,
keep the matcher inside `@repo/source-control-contract` or the API service and
avoid the new vendor package.

## Minimal Durable Data

### `lightfast_source_control_repositories`

Purpose: explicit watched repository registry.

Columns:

- `id`
- `orgSourceControlBindingId`
- `providerRepositoryId`
- `fullName`
- `watchedPathGlobs`
- `createdAt`
- `updatedAt`

Indexes:

- unique `(orgSourceControlBindingId, providerRepositoryId)`;
- index `(providerRepositoryId)`.

Do not add these fields in the first implementation:

- `clerkOrgId` - derive it from the binding row;
- `provider` - derive it from the binding row;
- `ownerLogin` and `name` - derive them from `fullName` when calling GitHub;
- `defaultBranch` - fetch it when needed;
- `status` - row existence means watched in v1;
- `lastSeenSha`, `lastProcessedSha`, `lastWebhookAt`, `lastSyncAt`, and error
  columns - webhook delivery status is enough for v1;
- file content or file snapshots.

### `lightfast_source_control_webhook_deliveries`

Purpose: delivery dedupe and lightweight processing state.

Columns:

- `id`
- `deliveryId`
- `event`
- `providerInstallationId`
- `providerRepositoryId`
- `status`
- `createdAt`
- `updatedAt`

Indexes:

- unique `(deliveryId)`;
- index `(providerInstallationId, providerRepositoryId)`;
- index `(status, updatedAt)`.

Do not add these fields in the first implementation:

- `repositoryFullName` - useful for debugging, but not needed for routing;
- `ref`, `beforeSha`, `afterSha`, and changed paths - carried in the Inngest
  event where needed;
- `action` - push does not need it;
- `queuedAt`, `processedAt`, `receivedAt` - `createdAt` and `updatedAt` are
  enough;
- error columns - add later if failed delivery diagnostics become a real
  workflow requirement.

## Webhook Route

Add a Next route:

```text
apps/app/src/app/(app)/(github)/api/github/webhook/route.ts
```

The route delegates to an API service, for example:

```text
api/app/src/services/github/webhook/
```

Responsibilities:

1. Read the raw request body exactly once.
2. Verify `X-Hub-Signature-256` with `GITHUB_APP_WEBHOOK_SECRET`.
3. Parse `X-GitHub-Event` and `X-GitHub-Delivery`.
4. Accept `ping` and `push`.
5. Return `401` for missing or invalid signatures.
6. Return a 2xx response for valid but unsupported events so GitHub does not
   retry events Lightfast intentionally ignores.
7. For `ping`, validate the payload and return success without durable work.
8. For `push`, insert or load a delivery row by `deliveryId`.
9. If the delivery row already reached `queued` or `processed`, return success
   without enqueueing again.
10. Resolve the active binding by provider installation id.
11. Resolve the watched repository by binding id and provider repository id.
12. Mark the delivery `ignored` if no binding or watch exists.
13. Mark the delivery `ignored` if the push did not touch any watched path.
14. Mark the delivery `queued` and send the Inngest event if the repo is
    watched and the changed path set matches.

The route must not trust Clerk session state. GitHub webhooks are authenticated
only by their HMAC signature.

## Inngest Event And Workflow

Add a GitHub-backed repository push event:

```ts
"app/github.repository.push.received"
```

Payload:

```ts
{
  deliveryId: string;
  repositoryWatchId: number;
  orgSourceControlBindingId: number;
  providerInstallationId: string;
  providerRepositoryId: string;
  repositoryFullName: string;
  ref: string;
  beforeSha: string;
  afterSha: string;
  changedPaths: string[];
}
```

The workflow should:

1. Load the repository watch and binding.
2. Skip if either row no longer exists.
3. Create a GitHub App JWT.
4. Mint an installation token for `providerInstallationId`.
5. Fetch the repository or commit/tree for `afterSha`.
6. Reject truncated trees for now.
7. Mark the delivery `processed` or `failed`.

The workflow should not persist file contents. For this foundation, it is enough
to prove that matching repository state can be fetched after the webhook path
filter. Future consumers can receive the matched paths or fetch content on
demand.

Workflow idempotency:

```ts
idempotency: "event.data.deliveryId"
```

## GitHub API Helpers

Add `@repo/github-app-node` helpers with testable fetch injection:

```ts
createGitHubInstallationToken({
  apiBaseUrl,
  apiVersion,
  appJwt,
  installationId,
});

getGitHubRepository({
  apiBaseUrl,
  apiVersion,
  installationToken,
  owner,
  repo,
});

getGitHubCommit({
  apiBaseUrl,
  apiVersion,
  installationToken,
  owner,
  repo,
  ref,
});

getGitHubTree({
  apiBaseUrl,
  apiVersion,
  installationToken,
  owner,
  repo,
  treeSha,
  recursive: true,
});
```

These helpers should normalize only the fields Lightfast needs. Avoid broad
GitHub response schemas.

## Emulator

The emulator can support the foundation.

The upstream emulator already has:

- GitHub App webhooks with `webhook_url` and `webhook_secret`;
- signed HTTP delivery with `X-Hub-Signature-256`;
- `push` dispatch when refs are updated;
- Git data APIs for blobs, trees, commits, and refs;
- installation access tokens.

Update the Lightfast emulator seed so the local GitHub App includes:

```ts
webhook_url: `${appOrigin}/api/github/webhook`
```

Keep `webhook_secret` as the existing deterministic local secret.

Add a local dev/test helper that simulates a push through normal
GitHub-compatible API calls:

1. Create blobs for requested files.
2. Create a tree from the current branch tree plus new blobs.
3. Create a commit.
4. Update `refs/heads/<branch>`.
5. Let the emulator emit the real `push` webhook.

This helper may live under `emulators/github` because it is local
infrastructure. It should not be imported by production packages.

## Error Handling

- Invalid signature: `401`.
- Malformed payload: `400` when the event is one Lightfast claims to support.
- Unsupported event: `202` with no durable work.
- Duplicate delivery: `202` with no new Inngest event.
- No active binding for installation: mark delivery `ignored`.
- No watched repository for binding/repo: mark delivery `ignored`.
- Watched repository push with no watched-path changes: mark delivery
  `ignored`.
- GitHub fetch failure in workflow: mark delivery `failed` and let Inngest
  retry according to workflow configuration.

Do not expose webhook secrets, installation tokens, app JWTs, raw signatures, or
provider response bodies in logs or API responses.

## Testing

Focused tests should cover:

- `@repo/source-control-contract` statuses and watched path schema.
- GitHub webhook signature verification with valid and invalid signatures.
- GitHub `ping` and `push` payload parsing.
- Webhook route rejects invalid signatures before parsing JSON.
- Duplicate delivery id does not enqueue twice.
- Unbound installation is marked `ignored`.
- Bound installation plus unwatched repo is marked `ignored`.
- Bound installation plus watched repo but unmatched changed paths is marked
  `ignored`.
- Bound installation plus watched repo and matching changed paths marks delivery
  `queued` and sends the Inngest event.
- Workflow mints an installation token, fetches repository state, and marks the
  delivery `processed`.
- Workflow marks delivery `failed` when GitHub fetch fails.
- Emulator seed sends GitHub App webhooks to `/api/github/webhook`.
- Emulator push helper causes a real signed `push` webhook after ref update.
- End-to-end local test path: emulator push -> app webhook service -> delivery
  row -> Inngest event/workflow -> processed delivery.

Expected focused commands:

```bash
pnpm --filter @repo/source-control-contract test
pnpm --filter @repo/github-app-contract test
pnpm --filter @repo/github-app-node test
pnpm --filter @db/app test
pnpm --filter @api/app test -- src/__tests__/github-webhook.test.ts src/__tests__/source-control-repository-workflow.test.ts
pnpm --filter @lightfast/app test -- src/__tests__/app/api/github/github-routes.test.ts
pnpm --filter @repo/github-emulator test -- src/__tests__/server.test.ts
pnpm typecheck
```

## Migration Plan

1. Create `@repo/source-control-contract` with delivery statuses and watched
   path schemas.
2. Add minimal DB tables and repository helpers in `@db/app`.
3. Add GitHub webhook payload schemas to `@repo/github-app-contract`.
4. Add webhook signature and GitHub installation/repository API helpers to
   `@repo/github-app-node`.
5. Add webhook service and route handler.
6. Add Inngest event schema and repository push workflow.
7. Wire the workflow into `api/app/src/inngest/index.ts`.
8. Update app proxy public route allowlisting for `/api/github/webhook`.
9. Update emulator seed with the GitHub App webhook URL.
10. Add the emulator push simulation helper.
11. Add focused unit and integration tests.
12. Run focused tests and `pnpm typecheck`.

## Success Criteria

- The foundation handles any explicitly watched GitHub repository, regardless
  of repository name.
- No `.lightfast` or `skills/**` behavior is hard-coded.
- GitHub App webhooks are verified using the raw request body.
- Duplicate GitHub deliveries do not enqueue duplicate work.
- Unbound installations and unwatched repositories are ignored without failing
  GitHub delivery.
- Watched repository pushes enqueue exactly one sync workflow only when changed
  paths match the watch globs.
- The sync workflow fetches repository state using a GitHub installation token.
- Only the repository watch registry and delivery status are persisted.
- No file content or repository file snapshot table exists.
- The emulator can simulate a push and send the signed webhook to local
  Lightfast.
