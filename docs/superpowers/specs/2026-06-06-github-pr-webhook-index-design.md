# GitHub PR Webhook Index Design

Date: 2026-06-06
Status: Ready for user review

## Summary

Lightfast should start indexing GitHub pull request activity as backend-only
source-control evidence. The first version should not create Lightfast Signals,
normalize comment bodies, expose UI, or infer product semantics from the data.

The existing GitHub webhook endpoint already verifies signatures and handles
`push` events for watched repositories. This design extends that endpoint to
accept opted-in PR-related webhook families, route them through the same binding
and repository authority, and persist the complete parsed GitHub webhook payload
with stable routing columns.

## Goals

- Index GitHub PR-related webhook deliveries for repositories that explicitly
  watch those webhook event families.
- Preserve the full parsed GitHub webhook JSON payload for each accepted
  delivery.
- Dedupe by GitHub delivery id.
- Add a repository-level webhook watch list that is separate from file/path
  sync settings.
- Keep the index backend-only in v1.
- Avoid creating Signals until the org/system signal attribution model is
  designed.
- Avoid normalizing PR titles, PR bodies, comment bodies, actors, review state,
  or queue state in this slice.
- Keep mutable provider labels, such as repository full names, out of durable
  routing columns.

## Non-Goals

- No Signal creation from PR webhook deliveries.
- No Inngest workflow for PR analysis or promotion.
- No UI, tRPC route, oRPC route, public API, or MCP tool for reading the PR
  index.
- No normalized PR, comment, review, actor, label, or file-change tables.
- No repository full-name column in the PR delivery index.
- No ingestion for every repository in a GitHub App installation.
- No default raw payload storage for newly imported repositories.
- No ingestion for issue comments that are not attached to a pull request.
- No change to the existing `push` webhook sync path.

## Recommended Approach

Use a raw PR delivery index.

After verifying the GitHub webhook signature, accept only PR-related event
families that the repository explicitly watches. Resolve the provider
installation to an active Lightfast source-control binding, require a
source-control repository row, require that the event family is present in the
repository's webhook watch list, then insert a PR webhook delivery row keyed by
GitHub delivery id. Store stable provider ids and the full parsed payload.
Return `202` for successful ingestion, ignored events, duplicates, missing
bindings, missing repositories, and unwatched webhook event families.

This keeps the data useful for later signal design without prematurely deciding
which PR activity is meaningful.

## Accepted Event Families

Accept all actions for these event families when the repository has opted into
the family:

```text
pull_request
pull_request_review
pull_request_review_comment
pull_request_review_thread
issue_comment
```

`issue_comment` deliveries are accepted only when the payload is attached to a
pull request. In GitHub payload terms, `issue.pull_request` must be present.

For all accepted families, `action` must be a non-empty string. Do not hard-code
the allowed action set in the database schema or webhook table. GitHub may add
new actions, and the raw index should store them without a migration.

`push` remains owned by the existing repository sync lane and is not inserted
into this PR index.

## Repository Webhook Watches

Add a webhook watch list to `lightfast_org_source_control_repositories`:

```text
watchedWebhookEvents
```

Allowed v1 values:

```text
pull_request
pull_request_review
pull_request_review_comment
pull_request_review_thread
issue_comment
```

Semantics:

- `watchedWebhookEvents` controls raw webhook indexing.
- `syncStatus` remains the file/repository sync toggle used by the existing
  push path and repository sync workflow.
- `watchedPathGlobs` remains the path filter for file/push-based sync.
- PR webhook indexing must not inspect `syncStatus`.
- PR webhook indexing must not inspect `watchedPathGlobs`.
- Existing repositories and newly imported repositories default to no watched
  webhook events.
- If Drizzle and PlanetScale support a clean non-null JSON array default, store
  this as non-null JSON with default `[]`.
- If a non-null JSON default is not clean in this stack, store it as nullable
  JSON and normalize `null` to `[]` in DB helpers and webhook routing.

This keeps raw payload collection opt-in and separates repository-level webhook
evidence from file-content sync.

## Data Model

Add a backend-only table:

```text
lightfast_org_source_control_pr_webhook_deliveries
- id
- deliveryId
- clerkOrgId
- orgSourceControlBindingId
- sourceControlRepositoryId
- providerInstallationId
- providerRepositoryId
- event
- action
- providerPullRequestId nullable
- pullRequestNumber
- rawPayload
- createdAt
- updatedAt
```

Indexes:

```text
unique(deliveryId)
index(clerkOrgId, createdAt, id)
index(sourceControlRepositoryId, pullRequestNumber, createdAt, id)
index(providerInstallationId, providerRepositoryId, createdAt, id)
```

Column notes:

- `deliveryId` is the GitHub `X-GitHub-Delivery` value.
- `clerkOrgId` is copied from the active source-control binding for stable org
  scoping.
- `orgSourceControlBindingId` references the Lightfast binding row by id.
- `sourceControlRepositoryId` references the watched repository row by id.
- `providerInstallationId` and `providerRepositoryId` are stable provider ids
  from the payload.
- `event` is the GitHub event header, for example `pull_request`.
- `action` is the payload action, for example `synchronize`.
- `providerPullRequestId` is nullable because PR-attached `issue_comment`
  payloads may provide the PR number and URL without the same PR id shape as
  `pull_request` and `pull_request_review_comment` payloads.
- When an accepted event shape includes a direct `pull_request.id`, extraction
  should require it and store it as `providerPullRequestId`.
- `pullRequestNumber` is required for all accepted deliveries.
- `rawPayload` stores the complete parsed webhook JSON payload. It is not
  reduced to body text, normalized, or interpreted by this slice.

Do not store `repositoryFullName`, owner login, repository name, branch names,
PR title, PR body, comment body, actor login, or mutable queue/review labels as
separate durable columns in v1. Those values remain available inside
`rawPayload`.

## Webhook Flow

Extend `api/app/src/services/github/webhook/handler.ts`.

The route behavior should be:

1. Read the raw request body once.
2. Parse the GitHub headers.
3. Verify `X-Hub-Signature-256` before JSON parsing.
4. Continue sending `push` events to the existing push path.
5. For unsupported events, return `202` without durable work.
6. For supported PR-related events, parse the full JSON body through GitHub
   provider schemas.
7. Reject malformed signed PR-related payloads with `400`.
8. Resolve `installation.id` to an active GitHub source-control binding.
9. Resolve `repository.id` to a source-control repository row for that
   binding.
10. If no active binding or repository row exists, return `202` without
    inserting a PR index row.
11. If the repository's normalized `watchedWebhookEvents` does not include the
    event header, return `202` without inserting a PR index row.
12. Insert the PR webhook delivery row by `deliveryId`.
13. If a duplicate delivery row already exists, return `202` without mutation.
14. Return `202` for accepted inserts.

The route must not trust Clerk session state. GitHub webhooks are authenticated
only through the GitHub webhook signature.

## Package Boundaries

`@repo/source-control-contract` should own generic webhook watch vocabulary:

- watched webhook event-family constants;
- watched webhook event list schema;
- helper for normalizing nullable stored values to an array.

`@repo/github-app-contract` should own GitHub payload parsing:

- PR-related webhook event-family constants.
- Raw header-compatible event/action schemas.
- Minimal routing extraction schemas for:
  - `pull_request`
  - `pull_request_review`
  - `pull_request_review_comment`
  - `pull_request_review_thread`
  - PR-attached `issue_comment`
- A helper that extracts stable routing fields:
  - provider installation id
  - provider repository id
  - event
  - action
  - provider pull request id when present
  - pull request number

`@db/app` should own the table schema and insert/get helpers.

`api/app` should own webhook routing policy:

- signature verification order;
- supported event decisions;
- active binding lookup;
- repository lookup;
- watched webhook event-family checks;
- duplicate handling;
- response status mapping.

Do not add a GitHub SDK dependency for this slice.

## Error Handling

- Missing webhook secret returns `500`, matching the existing webhook handler.
- Missing or malformed signature returns `401` before durable work.
- Invalid signature returns `401` before durable work.
- Malformed signed JSON returns `400`.
- Malformed signed accepted PR payload returns `400`.
- Unsupported event returns `202` without durable work.
- Non-PR `issue_comment` returns `202` without durable work.
- Missing active binding returns `202` without durable work.
- Missing source-control repository row returns `202` without durable work.
- Unwatched webhook event family returns `202` without durable work.
- Duplicate accepted delivery returns `202` without mutation.
- Database insert failure returns `500`.

## Testing

Add focused tests for:

- GitHub PR payload schemas in `@repo/github-app-contract`.
- Watched webhook event schemas in `@repo/source-control-contract`.
- `issue_comment` is accepted only when `issue.pull_request` exists.
- `providerPullRequestId` is nullable for PR-attached issue comments.
- `pullRequestNumber` is required for every inserted PR index row.
- Signature rejection happens before PR delivery persistence.
- Unsupported events return `202` without durable work.
- Accepted PR events without an active binding are ignored.
- Accepted PR events without a source-control repository row are ignored.
- Accepted PR events for repositories that do not watch the event family are
  ignored.
- Accepted PR events for repositories that watch the event family insert raw
  payloads, regardless of `syncStatus` and `watchedPathGlobs`.
- Duplicate delivery ids do not mutate the stored row.
- Existing `push` webhook behavior remains unchanged.

No browser, UI, or API read tests are required for v1 because the index is
backend-only.

## Rollout

1. Add source-control contract schemas for watched webhook events.
2. Add GitHub contract schemas and tests for accepted PR-related payloads.
3. Add `watchedWebhookEvents` to source-control repository rows.
4. Add the PR webhook delivery table and DB helpers.
5. Extend the webhook service with PR routing and persistence.
6. Add API service tests for routing, dedupe, and raw payload persistence.
7. Generate the Drizzle migration with `pnpm db:generate`.
8. Run focused package and API tests.

The first production-facing behavior change is passive and opt-in: Lightfast
can store accepted PR-related webhook payloads only for repositories whose
`watchedWebhookEvents` list includes the event family. Later work can inspect
that backend index and design the normalizer, signal promotion workflow, or
source-event abstraction with real data.
