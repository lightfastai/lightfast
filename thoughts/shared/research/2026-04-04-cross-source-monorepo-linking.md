---
date: 2026-04-04T18:00:00+08:00
researcher: claude
git_commit: 88b8e1f661b544042b1666633fa20d0fe2f97a25
branch: refactor/drop-workspace-abstraction
repository: lightfast
topic: "Cross-source linking for Vercel projects, GitHub repos, and Sentry projects in monorepos"
tags: [research, codebase, vercel, github, sentry, monorepo, entity-graph, cross-provider, edge-rules]
status: complete
last_updated: 2026-04-04
---

# Research: Cross-Source Linking for Vercel, GitHub, and Sentry in Monorepos

**Date**: 2026-04-04
**Git Commit**: 88b8e1f661b544042b1666633fa20d0fe2f97a25
**Branch**: refactor/drop-workspace-abstraction

## Research Question

When connecting Vercel projects, GitHub repos, and Sentry projects to a Lightfast organization — especially in a monorepo context (e.g., 3 Vercel projects deploying from 1 GitHub repo) — does the existing cross-source relationship system create meaningful links between them? What data is available from each provider's API to establish stronger connections?

## Summary

Cross-source linking exists at three architectural layers in Lightfast. All three have significant gaps:

1. **Resource level** (orgIntegrations) — No cross-provider linking exists. Each connected resource is an independent row with no FK or column referencing other providers' resources.
2. **Entity/event level** (entity graph + edge rules) — Rules are declared but **cannot fire** due to extraction pipeline gaps. The `commit → vercel:deployment (deploys)` edge rule is dead code.
3. **Application level** (`@vercel/related-projects`) — Only for URL resolution between Lightfast's own apps. Unrelated to the data pipeline.

Meanwhile, all three providers' APIs expose rich cross-provider metadata that Lightfast does not currently fetch or store:
- **Vercel**: `link.repo`, `link.repoId`, `rootDirectory` per project
- **Sentry**: code-mappings endpoint linking projects to repos
- **GitHub**: deployment statuses with Vercel `log_url` containing project/team/deployment IDs

---

## Detailed Findings

### 1. Entity Graph Edge Rules: Declared but Non-Functional

#### The GitHub Edge Rule

GitHub's provider definition declares three edge rules (`packages/app-providers/src/providers/github/index.ts:323-349`):

```ts
edgeRules: [
  { refType: "commit", matchProvider: "vercel", matchRefType: "deployment",
    relationshipType: "deploys", confidence: 1.0 },
  { refType: "issue", selfLabel: "fixes", matchProvider: "*", matchRefType: "issue",
    relationshipType: "fixes", confidence: 1.0 },
  { refType: "issue", matchProvider: "*", matchRefType: "issue",
    relationshipType: "references", confidence: 0.8 },
]
```

The first rule (`commit → deployment`) is designed to link GitHub commits to Vercel deployments via entity co-occurrence. It cannot fire today.

#### Why It Cannot Fire

**Problem 1: Vercel events don't produce `commit` entities.**

The Vercel transformer (`packages/app-providers/src/providers/vercel/transformers.ts:65-98`) outputs:
- `entity.entityType = "deployment"` (the primary entity)
- `relations: []` — empty array (line 83)
- `attributes.gitCommitSha` — the commit SHA goes here (line 93), but `attributes` is never read by entity extraction

The event store (`api/platform/src/inngest/functions/memory-event-store.ts:334-335`) runs two extraction functions:
- `extractFromRelations(sourceEvent.relations)` — returns `[]` because relations is empty
- `extractEntities(title, body)` — regex on text content; any SHA match gets `category: "reference"` not `"commit"` (`api/platform/src/lib/entity-extraction-patterns.ts:62-67`)

**Problem 2: GitHub events don't produce `commit` entities either.**

GitHub only has transformers for `pull_request` and `issues` events (`packages/app-providers/src/providers/github/index.ts:95-120`). There is no `push` event transformer. Neither PR nor issue transformers produce `commit`-category entities in their `relations`.

**Problem 3: Edge resolver filters on structural types only.**

`resolveEdges()` at `api/platform/src/lib/edge-resolver.ts:14,33-38` filters entity refs to `STRUCTURAL_TYPES = ["commit", "branch", "pr", "issue", "deployment"]`. Entities extracted as `category: "reference"` are invisible to the edge resolver.

**Result**: The `commit → deployment` edge rule requires both a `commit` entity and a `deployment` entity to co-occur via the junction table. Since no transformer in any provider produces `commit`-category entities, the rule never fires.

#### Issue/Issue Rules

The `issue → issue` rules (references, fixes) can potentially fire when GitHub and Linear issues both mention the same issue key. This depends on text extraction matching issue references across both providers' event bodies.

---

### 2. Monorepo Awareness: Completely Absent

#### Current Data Model

`orgIntegrations` (`db/app/src/schema/tables/org-integrations.ts:29-103`) stores each connected resource as an independent row:

| Column | Purpose |
|--------|---------|
| `clerkOrgId` | Org scope |
| `installationId` | FK to `gatewayInstallations` (the OAuth connection) |
| `provider` | Denormalized provider slug |
| `providerConfig` | JSONB: `{ provider, type, sync }` — no cross-provider refs |
| `providerResourceId` | The provider's resource ID (GitHub repo numeric ID, Vercel project ID, Sentry project slug) |

For a monorepo scenario (1 GitHub repo + 3 Vercel projects + 1 Sentry project), this creates 5 fully independent rows:

| provider | providerResourceId | installationId |
|----------|-------------------|----------------|
| github | `"567890123"` (numeric repo ID) | `<github-install>` |
| vercel | `"prj_app_id"` | `<vercel-install>` |
| vercel | `"prj_www_id"` | `<vercel-install>` |
| vercel | `"prj_platform_id"` | `<vercel-install>` |
| sentry | `"org-slug/project-slug"` | `<sentry-install>` |

No column links any row to any other. The three Vercel rows share `installationId` (same Vercel team OAuth), but that's the only grouping.

#### No Metadata Stored

- `providerConfig` stores only `provider`, `type` (repository/project), and `sync` settings
- No `repoId`, `rootDirectory`, `linkedRepo`, or similar cross-provider field
- GitHub's `providerConfig` has a `status.configPath` for `lightfast.yml` detection but no Vercel/Sentry references
- The `bulkLink` mutation (`api/app/src/router/org/connections.ts:549-628`) accepts `resourceId` and `resourceName` but only stores `resourceId` as `providerResourceId`. `resourceName` is accepted in input but discarded.

#### Git Metadata in Events: Stored but Unused

Vercel deployment events carry `attributes.gitRepo` and `attributes.gitOrg` (`packages/app-providers/src/providers/vercel/transformers.ts:96-97`). These are stored as JSONB in the events table but no code queries them for correlation. There is no index on these fields and no lookup path from "Vercel event with gitRepo=X" to "GitHub orgIntegration with providerResourceId matching repo X."

---

### 3. Sentry Cross-Provider Linking: No Data Extracted

#### Current State

All four Sentry transformers produce `relations: []`:
- `transformSentryIssue` (`packages/app-providers/src/providers/sentry/transformers.ts:68`)
- `transformSentryError` (line 144)
- `transformSentryEventAlert` (line 203)
- `transformSentryMetricAlert` (line 268)

`edgeRules: []` on the Sentry provider (`packages/app-providers/src/providers/sentry/index.ts:252`).

#### Data Present in Schema but Not Extracted

`sentryIssueSchema` (`packages/app-providers/src/providers/sentry/schemas.ts:51-67`) includes:
- `statusDetails.inCommit.repository` — repo identifier when issue resolved via commit
- `statusDetails.inCommit.commit` — the commit reference

These fields are modeled in the Zod schema but the transformer never reads them. The backfill adapter explicitly zeros them out: `statusDetails: {}` (`packages/app-providers/src/providers/sentry/backfill.ts:83`).

Error events have a `tags` array that commonly carries `release` and `environment` tags, but these are not extracted into attributes or relations.

#### Missing API Endpoints

The Sentry provider registers 4 API endpoints (`packages/app-providers/src/providers/sentry/api.ts:149-179`): `list-projects`, `list-organizations`, `list-org-issues`, `list-events`. Not registered:
- `/api/0/organizations/{org}/repos/` — linked repositories
- `/api/0/organizations/{org}/code-mappings/` — project-to-repo bridge
- `/api/0/organizations/{org}/releases/` — releases with commits
- `/api/0/organizations/{org}/releases/{version}/commits/` — commit SHAs + repo data
- `/api/0/organizations/{org}/releases/{version}/deploys/` — deploy records

---

### 4. What Each Provider's API Exposes (Not Currently Consumed)

#### Vercel API

**`GET /v9/projects/{idOrName}`** returns:

```json
{
  "id": "prj_abc123",
  "name": "my-frontend",
  "rootDirectory": "apps/web",
  "sourceFilesOutsideRootDirectory": true,
  "framework": "nextjs",
  "link": {
    "type": "github",
    "repo": "owner/repo-name",
    "repoId": 123456789,
    "org": "my-github-org",
    "productionBranch": "main"
  }
}
```

Key fields for cross-provider linking:
- `link.type` — provider discriminant (`"github"`, `"gitlab"`, `"bitbucket"`)
- `link.repo` — full `"owner/repo"` slug
- `link.repoId` — GitHub numeric repo ID (directly matches GitHub's `providerResourceId`)
- `rootDirectory` — monorepo subdirectory (e.g., `"apps/web"`, `null` for repo root)
- `sourceFilesOutsideRootDirectory` — monorepo shared packages flag

**This endpoint is not registered** in the Vercel API catalog (`packages/app-providers/src/providers/vercel/api.ts`). Only `get-team`, `get-user`, `list-projects`, `list-deployments` are registered.

Note: `list-projects` does return project objects, but `vercelProjectsListSchema` (`vercel/api.ts:45-61`) uses `.loose()` — any `link` or `rootDirectory` fields in the response are silently dropped.

**Per-deployment**: `meta.githubCommitSha`, `meta.githubRepoId`, and newer `gitSource` object with `{ type, repoId, ref, sha }`.

#### Sentry API

**`GET /api/0/organizations/{org}/repos/`** — Linked repositories:

```json
{
  "id": "4",
  "name": "my-org/my-repo",
  "url": "https://github.com/my-org/my-repo",
  "provider": { "id": "integrations:github", "name": "GitHub" },
  "status": "active",
  "integrationId": "32",
  "externalSlug": "my-org/my-repo",
  "defaultBranch": "main"
}
```

- `externalSlug` = `"owner/repo"` — directly matches GitHub repo full name
- `integrationId` links to the org's GitHub App integration

**`GET /api/0/organizations/{org}/code-mappings/`** — The canonical project-to-repo bridge:

```json
{
  "projectId": "2",
  "projectSlug": "javascript-nextjs",
  "repoId": "4",
  "repoName": "my-org/my-repo",
  "integrationId": "32",
  "stackRoot": "",
  "sourceRoot": "apps/web",
  "defaultBranch": "main"
}
```

- Maps a Sentry project to a GitHub repo with `sourceRoot` (analogous to Vercel's `rootDirectory`)
- Only exists if stack trace linking is configured for that project

**`GET /api/0/organizations/{org}/releases/{version}/commits/`** — Commit-level linking:

```json
{
  "id": "abc123def456...40chars",
  "repository": {
    "externalSlug": "my-org/my-repo",
    "provider": { "id": "integrations:github" }
  }
}
```

**`GET /api/0/organizations/{org}/integrations/?provider_key=github`** — Integration identity:

```json
{
  "id": "32",
  "name": "my-github-org",
  "domainName": "github.com/my-github-org",
  "configData": { "installation_id": "12345678" }
}
```

- `configData.installation_id` is the GitHub App installation ID

#### GitHub API (Vercel Artifacts)

**`GET /repos/{owner}/{repo}/deployments`** — Vercel-created deployments:
- `performed_via_github_app.slug == "vercel"` identifies Vercel deployments
- `sha` — the commit being deployed

**`GET /repos/{owner}/{repo}/deployments/{id}/statuses`** — The richest cross-provider surface:
- `log_url` — pattern `https://vercel.com/{team}/{project}/deployments/{dpl_ID}`, parseable to extract Vercel team slug, project slug, and deployment ID
- `target_url` — Vercel preview/production URL
- `environment_url` — canonical domain

This means from GitHub's API alone, you can discover which Vercel projects deploy from a repo by parsing `log_url` from deployment statuses.

#### GitHub API (Sentry Artifacts)

Sentry's standard GitHub integration creates zero GitHub API artifacts (no deployments, no check runs, no commit statuses). The only footprint is deployment protection rules if Sentry Deployment Gates are configured.

---

### 5. The Monorepo Linking Graph

Combining all API data, the full cross-provider linking graph for a monorepo looks like:

```
                    ┌─────────────────────┐
                    │  GitHub Repo        │
                    │  owner/repo         │
                    │  id: 567890123      │
                    └──────┬──────────────┘
                           │
              ┌────────────┼────────────────────┐
              │            │                    │
    ┌─────────▼────┐ ┌─────▼────────┐  ┌───────▼──────────┐
    │ Vercel Proj  │ │ Vercel Proj  │  │ Sentry Project   │
    │ lightfast-app│ │ lightfast-www│  │ javascript-nextjs│
    │ root: apps/  │ │ root: apps/  │  │ sourceRoot:      │
    │   app        │ │   www        │  │   apps/app       │
    │ link.repoId: │ │ link.repoId: │  │ repoName:        │
    │  567890123   │ │  567890123   │  │  owner/repo      │
    └──────────────┘ └──────────────┘  └──────────────────┘
```

**Join keys available**:
- Vercel `link.repoId` (number) ↔ GitHub repo numeric ID (providerResourceId on GitHub orgIntegration)
- Sentry `code-mapping.repoName` ↔ GitHub `owner/repo` (derivable from GitHub API)
- Vercel `rootDirectory` ↔ Sentry `sourceRoot` (identifies which monorepo app)
- GitHub deployment status `log_url` → parse Vercel project slug (reverse discovery)

**None of these joins are implemented in Lightfast today.**

---

## Code References

### Entity Graph Pipeline
- `packages/app-providers/src/provider/primitives.ts:57-70` — EdgeRule interface
- `packages/app-providers/src/providers/github/index.ts:323-349` — GitHub edge rules (commit→deployment, issue→issue)
- `api/platform/src/lib/edge-resolver.ts:14,26-274` — Co-occurrence algorithm, STRUCTURAL_TYPES filter
- `api/platform/src/inngest/functions/memory-event-store.ts:334-369` — Entity extraction (extractEntities + extractFromRelations)
- `api/platform/src/lib/entity-extraction-patterns.ts:62-67` — SHA regex → category "reference" (not "commit")

### Provider Transformers
- `packages/app-providers/src/providers/vercel/transformers.ts:83,93-97` — relations: [], git data in attributes only
- `packages/app-providers/src/providers/sentry/transformers.ts:68,144,203,268` — all four produce relations: []
- `packages/app-providers/src/providers/github/transformers.ts` — PR and issue transformers, no commit entity

### Database Schema
- `db/app/src/schema/tables/org-integrations.ts:29-103` — No cross-provider columns
- `db/app/src/schema/tables/org-entities.ts:24-163` — Entity dedup by (orgId, category, key)
- `db/app/src/schema/tables/org-entity-edges.ts:23-88` — Directed entity edges with provenance

### Provider Configs
- `packages/app-providers/src/providers/github/auth.ts:70-83` — githubProviderConfigSchema (no cross-provider refs)
- `packages/app-providers/src/providers/vercel/auth.ts:57-61` — vercelProviderConfigSchema (no cross-provider refs)
- `packages/app-providers/src/providers/sentry/auth.ts:79-83` — sentryProviderConfigSchema (no cross-provider refs)

### API Catalogs
- `packages/app-providers/src/providers/vercel/api.ts` — 4 endpoints, no get-project-by-id
- `packages/app-providers/src/providers/sentry/api.ts:149-179` — 4 endpoints, no repos/releases/code-mappings
- `packages/app-providers/src/providers/github/api.ts` — 6 endpoints, no deployments/statuses

### Connections Router
- `api/app/src/router/org/connections.ts:549-628` — bulkLink: stores resourceId only, discards resourceName
- `api/app/src/router/org/connections.ts:266-427` — detectConfig: checks lightfast.yml existence, no cross-provider parsing

---

## Architecture Documentation

### Current Cross-Provider State

| Layer | Status | Notes |
|-------|--------|-------|
| Resource-level (orgIntegrations) | No linking | Each resource is an independent row |
| Entity-level (edge rules) | Rules declared, cannot fire | Pipeline gaps prevent entity co-occurrence |
| Event-level (attributes) | Data present, unused | `gitRepo`, `gitOrg` stored but never queried |
| Application-level | Unrelated | `@vercel/related-projects` is for service discovery only |

### API Data Available but Not Consumed

| Provider | Endpoint | Key Data | Current Status |
|----------|----------|----------|----------------|
| Vercel | `GET /v9/projects/{id}` | `link.repoId`, `rootDirectory` | Not registered |
| Sentry | `GET /repos/` | `externalSlug` (owner/repo) | Not registered |
| Sentry | `GET /code-mappings/` | `projectId → repoName + sourceRoot` | Not registered |
| Sentry | `GET /releases/{v}/commits/` | Full SHA + repo object | Not registered |
| Sentry | `GET /integrations/` | `configData.installation_id` (GitHub App ID) | Not registered |
| GitHub | `GET /deployments/{id}/statuses` | `log_url` with Vercel project slug | Not registered |

---

## Open Questions

1. **Entity pipeline fix**: Should Vercel/GitHub transformers produce structured `commit` and `branch` relations to make the existing edge rules work? Or is a resource-level linking approach more valuable?

2. **Resource-level linking schema**: Should `orgIntegrations` gain a `linkedRepoId` or `parentResourceId` column? Or should cross-provider metadata live in `providerConfig` JSONB (e.g., `vercelProviderConfig.link.repoId`)?

3. **Discovery timing**: Should cross-provider metadata be fetched at connection time (when user links a Vercel project, immediately fetch `link.repoId` and `rootDirectory`)? Or lazily on first webhook?

4. **lightfast.yml as declaration layer**: Should the config file in a GitHub repo declare its Vercel and Sentry project associations? This would make the repo the source of truth for cross-provider linking.

5. **Sentry code-mappings dependency**: Code mappings only exist if users configure stack trace linking. Should Lightfast rely on this, or should it use the repos endpoint + release commits for a more reliable link?

6. **GitHub deployment status parsing**: Is parsing `log_url` from Vercel deployment statuses a reliable way to discover which Vercel projects deploy from a repo? The URL format `vercel.com/{team}/{project}/deployments/{dpl_id}` is stable but undocumented.
