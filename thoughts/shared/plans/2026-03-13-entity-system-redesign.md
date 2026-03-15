---
date: 2026-03-13T02:25:20Z
researcher: claude
git_commit: 81a096f366dafb53ec8dfee1b94315dd7b6e1d6d
branch: feat/backfill-depth-entitytypes-run-tracking
repository: lightfast
topic: "Entity System Redesign — PostTransformEvent rework + provider entity extraction"
tags: [plan, entity-system, post-transform-event, providers, github, linear, vercel, sentry]
status: complete
last_updated: 2026-03-13
verified_by: thoughts/shared/research/2026-03-13-web-analysis-webhook-payload-verification.md
---

# Entity System Redesign

## Context

Evaluation of `2026-03-13-observation-pipeline-redesign.md` focused on isolating and
reworking the entity system. Specifically: redesigning `PostTransformEvent` and the
provider transformers to produce a rich, structured entity graph instead of a flat event
with untyped metadata.

## The Core Problem With Current PostTransformEvent

```typescript
// packages/console-providers/src/post-transform-event.ts — current
{
  source: "github",                         // bad name ("source" is ambiguous)
  sourceType: "pull-request.merged",
  sourceId: "pr:org/repo#123:merged",       // encodes action — NOT stable
  title: "[PR Merged] Add auth feature",    // display-only, conflates event + entity
  body: "...",
  occurredAt: "...",
  references: [                             // flat array mixing entity refs + actors + labels
    { type: "pr", id: "#123", url: "...", label: null },
    { type: "branch", id: "feature/auth", url: "...", label: null },
    { type: "commit", id: "abc123", url: "...", label: null },
    { type: "issue", id: "#7", url: null, label: "fixes" },  // partially-qualified (#7 not org/repo#7)
    { type: "reviewer", id: "alice", url: "...", label: null },   // actor mixed in
    { type: "label", id: "auth", url: null, label: null },        // not an entity
  ],
  metadata: {                               // completely untyped blob
    deliveryId: "...",                      // buried in here
    repoFullName: "org/repo",
    additions: 150,
    // ... 15 more fields, all unknown at the type level
  }
}
```

Six concrete problems:

1. **`sourceId` is unstable.** `"pr:org/repo#123:merged"` encodes the action. Downstream
   must strip the action suffix to get the domain entity ID. Two events for the same PR
   produce two different sourceIds. This is why the Vercel idempotency bug exists.

2. **No primary entity concept.** The event's subject is implicit — you have to know that
   `sourceType: "pull-request.*"` means the first `reference.type === "pr"` is the primary
   entity. Downstream code (`event-store.ts`) re-derives this via `extractDomainEntity()`.

3. **`references` mixes entity types.** Commits, branches, PRs, issues, actors (reviewers,
   assignees), and labels are all in one flat array with a `label` string for disambiguation.
   There is no semantic distinction between "this PR FIXES Issue #7" and "this PR HAS REVIEWER
   alice" in the current type.

4. **`metadata` is `Record<string, unknown>`.** The downstream Inngest workflow receives a
   typed envelope but has no type safety on the fields it reads. Every field access is a
   `metadata.someField as string` cast.

5. **`deliveryId` is buried.** It's in `metadata.deliveryId`, not a first-class field. Same
   for `webhookId`. Hard to see in logs, hard to correlate.

6. **References use partially-qualified IDs.** The PR body extraction produces `"#7"` not
   `"org/repo#7"`. Downstream cannot correlate this with a GitHub Issue entity without knowing
   the repo context (which IS available at transform time).

## Proposed New Design

### Core Schema

```typescript
// packages/console-providers/src/post-transform-event.ts — NEW

/**
 * The primary entity this event is about.
 * `entityId` is stable (no action suffix) and scoped to uniquely identify
 * the entity within a workspace+provider combination.
 */
export interface EntityRef {
  provider: string;          // "github" | "vercel" | "linear" | "sentry"
  entityType: string;        // "pr" | "issue" | "deployment" | "release" | etc.
  entityId: string;          // stable: "org/repo#123", "ENG-42", "dpl_abc123"
  title: string;             // entity's own title (not event title)
  url: string | null;
  state: string | null;      // normalized lifecycle state; null for terminal/non-lifecycle
}

/**
 * A typed relationship from the primary entity to another entity.
 *
 * Phase 1 (this redesign): self-referential only — same provider, no actors.
 * Extension points (future phases):
 *   - Actors: add EntityRelation with entityType "actor", provider stays same
 *   - Cross-provider: EntityRelation.provider differs from primary entity's provider
 *   - AI-extracted: use provider "extracted", entityType "endpoint"|"service"|"config"
 */
export interface EntityRelation {
  provider: string;          // same as primary for self-referential; future: cross-provider
  entityType: string;
  entityId: string;
  title: string | null;      // known at extraction time, or null
  url: string | null;
  relationshipType: string;  // "fixes" | "closes" | "head_commit" | "belongs_to" | etc.
}

export interface PostTransformEvent {
  // ── Delivery context ──────────────────────────────────────────────────────
  deliveryId: string;        // moved out of metadata; first-class

  // ── Event identity ────────────────────────────────────────────────────────
  provider: string;          // renamed from "source" for clarity
  eventType: string;         // renamed from "sourceType"; e.g. "pull-request.merged"
  occurredAt: string;        // ISO 8601

  // ── Primary entity ────────────────────────────────────────────────────────
  entity: EntityRef;         // replaces: source + sourceType + sourceId implicit entity

  // ── Relations (self-referential, Phase 1) ─────────────────────────────────
  // actors omitted (Phase 2), cross-provider omitted (Phase 3)
  relations: EntityRelation[];

  // ── Semantic content ──────────────────────────────────────────────────────
  title: string;             // event display title: "[PR Merged] Add auth feature"
  body: string;              // rich text for embedding/semantic search

  // ── Typed attributes ──────────────────────────────────────────────────────
  // Primitive values only — no nested objects. String | number | boolean | null.
  // Well-known keys per provider (documented below), but schema stays open.
  // Cross-provider refs stored here as strings for future cross-provider linking.
  attributes: Record<string, string | number | boolean | null>;
}
```

### Zod Schema

```typescript
export const entityRefSchema = z.object({
  provider: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string(),
  url: z.string().url().nullable(),
  state: z.string().nullable(),
});

export const entityRelationSchema = z.object({
  provider: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  title: z.string().nullable(),
  url: z.string().url().nullable(),
  relationshipType: z.string().min(1),
});

export const postTransformEventSchema = z.object({
  deliveryId: z.string().min(1),
  provider: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.iso.datetime(),
  entity: entityRefSchema,
  relations: z.array(entityRelationSchema),
  title: z.string().min(1).max(200),
  body: z.string().max(50_000),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type EntityRef = z.infer<typeof entityRefSchema>;
export type EntityRelation = z.infer<typeof entityRelationSchema>;
export type PostTransformEvent = z.infer<typeof postTransformEventSchema>;
```

---

## Entity ID Conventions

Stable entity IDs, unique within a workspace + provider combination:

| Provider | entityType | entityId format | Example |
|---|---|---|---|
| github | pr | `{owner}/{repo}#{number}` | `org/repo#123` |
| github | issue | `{owner}/{repo}#{number}` | `org/repo#7` |
| github | commit | `{sha}` | `abc1234567890abcd` |
| github | branch | `{owner}/{repo}:{ref}` | `org/repo:feature/auth` |
| github | release | `{owner}/{repo}:{tag}` | `org/repo:v1.2.0` |
| github | discussion | `{owner}/{repo}#{number}` | `org/repo#5` |
| vercel | deployment | `{vercel-deployment-id}` | `dpl_abc123xyz` |
| vercel | project | `{vercel-project-id}` | `prj_def456uvw` |
| linear | issue | `{identifier}` | `ENG-42` |
| linear | project | `{slugId}` | `auth-redesign-xyz` |
| linear | cycle | `{teamKey}:{number}` | `ENG:5` |
| linear | comment | `{issueIdentifier}:{commentId}` | `ENG-42:uuid-abc` |
| linear | project-update | `{projectId}:{updateId}` | `proj-id:update-id` |
| sentry | issue | `{projectSlug}:{shortId}` | `lightfast-api:PROJ-123` |
| sentry | error | `{projectId}:{eventId}` | `12345:uuid-abc` |
| sentry | alert | `{orgId}:{alertId}` | `org-id:alert-id` |
| sentry | metric-alert | `{orgId}:{alertId}` | `org-id:metric-id` |

---

## Entity Lifecycle States

Normalized states per entity type. These map directly to `workspaceSourceEntities.currentState`.

### GitHub

| entityType | states | transitions |
|---|---|---|
| pr | `draft` → `open` → `merged` / `closed` | `converted_to_draft` resets to `draft`; `reopened` → `open` |
| issue | `open` → `closed`; `reopened` → `open` | — |
| commit | `pushed` (terminal) | — |
| branch | `active` (terminal for Phase 1) | deleted branches → future |
| release | `draft` → `published` (terminal) | — |
| discussion | `open` → `answered` / `closed` | — |

### Vercel

| entityType | states | transitions |
|---|---|---|
| deployment | `building` → `succeeded` / `failed` / `canceled`; also `promoted`, `rolled_back`, `cleaned_up` | Sequential lifecycle per deployment ID |

### Linear

Use `state.type` (normalized) not `state.name` (custom per workspace):

| entityType | states |
|---|---|
| issue | `backlog` → `unstarted` → `started` → `completed` / `canceled` |
| project | `backlog` → `planned` → `started` → `paused` → `completed` / `canceled` |
| cycle | `upcoming` → `active` → `completed` (via dates) |
| comment | `created` → `updated` / `deleted` (terminal) |
| project-update | `created` → `updated` / `deleted` (terminal) |

### Sentry

| entityType | states |
|---|---|
| issue | `unresolved` → `resolved` / `archived`; `unresolved` again | Note: `action="ignored"` was renamed `"archived"` by Sentry; `status` field still uses `"ignored"` internally |
| error | `captured` (terminal) |
| alert | `triggered` (terminal per event) |
| metric-alert | `critical` / `warning` → `resolved` |

---

## Relationship Types

Self-referential (Phase 1). Same provider, entity-to-entity only (no actors, no labels).

```
fixes           — PR/commit addresses an issue (extracted from body text)
closes          — PR/commit closes an issue (extracted from body text)
resolves        — issue/commit resolves another issue
references      — generic mention extracted from body text

head_commit     — PR's head SHA
merge_commit    — PR's merge commit SHA (when merged)
from_branch     — PR originates from this branch
to_branch       — PR targets this branch (base)

belongs_to      — issue/cycle belongs to a project; deployment belongs to project
in_cycle        — Linear issue is in a sprint/cycle
parent          — Linear sub-issue parent; comment thread parent
tracked_in      — Linear attachment linking to PR/Sentry issue
linked          — generic link (Linear Sentry attachment)
```

Future relationship types (Phase 2+):
```
authored_by     — actor created this entity
assigned_to     — actor is responsible for this entity
reviewed_by     — actor reviewed this PR
deployed_from   — Vercel deployment triggered by GitHub commit/branch (cross-provider)
resolved_by     — Sentry issue fixed by GitHub commit (cross-provider)
```

---

## Provider Transformers — Revised

### GitHub: Pull Request

```typescript
export function transformGitHubPullRequest(
  payload: PreTransformGitHubPullRequestEvent,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const pr = payload.pull_request;
  const repoFullName = payload.repository.full_name;
  const repoUrl = payload.repository.html_url;

  // Derive entity state from action + merged flag
  const entityState = deriveGitHubPrState(payload.action, pr.draft, pr.merged ?? false);
  const effectiveAction = payload.action === "closed" && pr.merged ? "merged" : payload.action;

  const relations: EntityRelation[] = [];

  // Head commit
  if (pr.head.sha) {
    relations.push({
      provider: "github",
      entityType: "commit",
      entityId: pr.head.sha,
      title: null,
      url: `${repoUrl}/commit/${pr.head.sha}`,
      relationshipType: "head_commit",
    });
  }

  // Merge commit (if merged)
  if (pr.merge_commit_sha) {
    relations.push({
      provider: "github",
      entityType: "commit",
      entityId: pr.merge_commit_sha,
      title: null,
      url: `${repoUrl}/commit/${pr.merge_commit_sha}`,
      relationshipType: "merge_commit",
    });
  }

  // Source branch (fully-qualified so downstream can dedup the branch entity)
  relations.push({
    provider: "github",
    entityType: "branch",
    entityId: `${repoFullName}:${pr.head.ref}`,
    title: pr.head.ref,
    url: `${repoUrl}/tree/${pr.head.ref}`,
    relationshipType: "from_branch",
  });

  // Target branch
  relations.push({
    provider: "github",
    entityType: "branch",
    entityId: `${repoFullName}:${pr.base.ref}`,
    title: pr.base.ref,
    url: `${repoUrl}/tree/${pr.base.ref}`,
    relationshipType: "to_branch",
  });

  // Linked issues from PR body (fully-qualified with repo)
  for (const linked of extractLinkedIssues(pr.body ?? "", repoFullName, repoUrl)) {
    relations.push({
      provider: "github",
      entityType: "issue",
      entityId: linked.entityId,   // "org/repo#7"
      title: null,
      url: linked.url,
      relationshipType: linked.relationshipType, // "fixes" | "closes" | "resolves"
    });
  }

  // OMITTED: requested_reviewers (actors, Phase 2)
  // OMITTED: assignees (actors, Phase 2)
  // OMITTED: labels (metadata, stored in attributes)

  const actionTitleMap: Record<string, string> = {
    opened: "PR Opened",
    closed: pr.merged ? "PR Merged" : "PR Closed",
    reopened: "PR Reopened",
    review_requested: "Review Requested",
    ready_for_review: "Ready for Review",
    converted_to_draft: "PR Converted to Draft",
  };
  const actionTitle = actionTitleMap[payload.action] ?? `PR ${payload.action}`;

  return {
    deliveryId: context.deliveryId,
    provider: "github",
    eventType: `pull-request.${effectiveAction}`,
    occurredAt: pr.updated_at,

    entity: {
      provider: "github",
      entityType: "pr",
      entityId: `${repoFullName}#${pr.number}`,
      title: pr.title,
      url: pr.html_url,
      state: entityState,
    },

    relations,

    title: sanitizeTitle(`[${actionTitle}] ${pr.title.slice(0, 100)}`),
    body: sanitizeBody([pr.title, pr.body ?? ""].join("\n")),

    attributes: {
      repoFullName,
      prNumber: pr.number,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      isDraft: pr.draft,
      isMerged: pr.merged ?? false,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      headSha: pr.head.sha,
    },
  };
}

function deriveGitHubPrState(action: string, draft: boolean, merged: boolean): string {
  if (action === "opened" || action === "reopened") return draft ? "draft" : "open";
  if (action === "converted_to_draft") return "draft";
  if (action === "ready_for_review") return "open";
  if (action === "closed") return merged ? "merged" : "closed";
  // edited, synchronize, review_requested, etc. — state doesn't change, return current
  if (draft) return "draft";
  return "open";
}
```

### GitHub: Push

```typescript
export function transformGitHubPush(
  payload: PreTransformGitHubPushEvent,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const branch = payload.ref.replace("refs/heads/", "");
  const repoFullName = payload.repository.full_name;
  const repoUrl = payload.repository.html_url;
  const commitMsg = payload.head_commit?.message.split("\n")[0]?.slice(0, 100) ?? `Push to ${branch}`;
  const fileCount = payload.commits.reduce(
    (sum, c) => sum + c.added.length + c.modified.length + c.removed.length, 0
  );

  const relations: EntityRelation[] = [
    {
      provider: "github",
      entityType: "branch",
      entityId: `${repoFullName}:${branch}`,
      title: branch,
      url: `${repoUrl}/tree/${branch}`,
      relationshipType: "pushed_to",
    },
  ];

  return {
    deliveryId: context.deliveryId,
    provider: "github",
    eventType: "push",
    occurredAt: payload.head_commit?.timestamp ?? new Date().toISOString(),

    entity: {
      provider: "github",
      entityType: "commit",
      entityId: payload.after,
      title: commitMsg,
      url: `${repoUrl}/commit/${payload.after}`,
      state: "pushed",  // terminal; commits don't transition after being pushed
    },

    relations,

    title: sanitizeTitle(`[Push] ${commitMsg}`),
    body: sanitizeBody(payload.head_commit?.message ?? ""),

    attributes: {
      repoFullName,
      branch,
      beforeSha: payload.before,
      afterSha: payload.after,
      commitCount: payload.commits.length,
      fileCount,
      isForced: payload.forced,
    },
  };
}
```

### GitHub: Issue

```typescript
export function transformGitHubIssue(
  payload: PreTransformGitHubIssuesEvent,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const issue = payload.issue;
  const repoFullName = payload.repository.full_name;

  // Derive normalized state: GitHub issue.state is "open" | "closed" directly
  const entityState = issue.state === "closed" ? "closed" : "open";

  const actionTitleMap: Record<string, string> = {
    opened: "Issue Opened",
    closed: "Issue Closed",
    reopened: "Issue Reopened",
    assigned: "Issue Assigned",
    labeled: "Issue Labeled",
    edited: "Issue Edited",
  };
  const actionTitle = actionTitleMap[payload.action] ?? `Issue ${payload.action}`;

  return {
    deliveryId: context.deliveryId,
    provider: "github",
    eventType: `issue.${payload.action}`,
    occurredAt: issue.updated_at,

    entity: {
      provider: "github",
      entityType: "issue",
      entityId: `${repoFullName}#${issue.number}`,
      title: issue.title,
      url: issue.html_url,
      state: entityState,
    },

    relations: [],  // GitHub issues don't self-reference other GitHub entities in the payload
    // OMITTED: assignees (actors, Phase 2)
    // OMITTED: labels (metadata)

    title: sanitizeTitle(`[${actionTitle}] ${issue.title.slice(0, 100)}`),
    body: sanitizeBody([issue.title, issue.body ?? ""].join("\n")),

    attributes: {
      repoFullName,
      issueNumber: issue.number,
      state: issue.state,
      stateReason: issue.state_reason ?? null,
    },
  };
}
```

### GitHub: Release

```typescript
export function transformGitHubRelease(
  payload: PreTransformGitHubReleaseEvent,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const release = payload.release;
  const repoFullName = payload.repository.full_name;
  const repoUrl = payload.repository.html_url;

  const entityState = release.draft ? "draft" : "published";

  const relations: EntityRelation[] = [
    {
      provider: "github",
      entityType: "branch",
      entityId: `${repoFullName}:${release.target_commitish}`,
      title: release.target_commitish,
      url: `${repoUrl}/tree/${release.target_commitish}`,
      relationshipType: "from_branch",
    },
  ];

  const actionTitleMap: Record<string, string> = {
    published: "Release Published",
    created: "Release Created",
    released: "Release Released",
    edited: "Release Edited",
  };
  const actionTitle = actionTitleMap[payload.action] ?? `Release ${payload.action}`;
  const releaseTitle = release.name ?? release.tag_name;

  return {
    deliveryId: context.deliveryId,
    provider: "github",
    eventType: `release.${payload.action}`,
    occurredAt: release.published_at ?? release.created_at,

    entity: {
      provider: "github",
      entityType: "release",
      entityId: `${repoFullName}:${release.tag_name}`,
      title: releaseTitle,
      url: release.html_url,
      state: entityState,
    },

    relations,

    title: sanitizeTitle(`[${actionTitle}] ${releaseTitle}`),
    body: sanitizeBody(release.body ?? ""),

    attributes: {
      repoFullName,
      tagName: release.tag_name,
      targetCommitish: release.target_commitish,
      isPrerelease: release.prerelease,
      isDraft: release.draft,
    },
  };
}
```

### GitHub: Discussion

```typescript
export function transformGitHubDiscussion(
  payload: PreTransformGitHubDiscussionEvent,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const discussion = payload.discussion;
  const repoFullName = payload.repository.full_name;

  const entityState = discussion.answer_html_url
    ? "answered"
    : discussion.state === "closed"
    ? "closed"
    : "open";

  const actionTitleMap: Record<string, string> = {
    created: "Discussion Created",
    answered: "Discussion Answered",
    closed: "Discussion Closed",
    edited: "Discussion Edited",
  };
  const actionTitle = actionTitleMap[payload.action] ?? `Discussion ${payload.action}`;

  return {
    deliveryId: context.deliveryId,
    provider: "github",
    eventType: `discussion.${payload.action}`,
    occurredAt: discussion.updated_at,

    entity: {
      provider: "github",
      entityType: "discussion",
      entityId: `${repoFullName}#${discussion.number}`,
      title: discussion.title,
      url: discussion.html_url,
      state: entityState,
    },

    relations: [],  // category is metadata, not an entity
    // OMITTED: category label (stored in attributes)

    title: sanitizeTitle(`[${actionTitle}] ${discussion.title.slice(0, 100)}`),
    body: sanitizeBody([discussion.title, discussion.body ?? ""].join("\n")),

    attributes: {
      repoFullName,
      discussionNumber: discussion.number,
      category: discussion.category.name,
      isAnswered: discussion.answer_html_url !== null,
      state: discussion.state,
    },
  };
}
```

---

### Vercel: Deployment

Note: GitHub cross-provider refs (commit, branch, PR) are stored as `attributes` strings.
When Phase 3 (cross-provider) is implemented, these become `EntityRelation` entries.

```typescript
export function transformVercelDeployment(
  payload: PreTransformVercelWebhookPayload,
  context: TransformContext,
  eventType: string
): PostTransformEvent {
  const deployment = payload.payload.deployment;
  const project = payload.payload.project;
  const team = payload.payload.team;
  const gitMeta = deployment.meta;
  const target = payload.payload.target;

  // Note: "deployment.ready" is NOT a real Vercel event type (not in official docs).
  // The success event is "deployment.succeeded".
  const stateMap: Record<string, string> = {
    "deployment.created": "building",
    "deployment.succeeded": "succeeded",
    "deployment.error": "failed",
    "deployment.canceled": "canceled",
    "deployment.promoted": "promoted",
    "deployment.rollback": "rolled_back",
    "deployment.cleanup": "cleaned_up",
    "deployment.check-rerequested": "building",
  };

  const eventTitleMap: Record<string, string> = {
    "deployment.created": "Deployment Started",
    "deployment.succeeded": "Deployment Succeeded",
    "deployment.error": "Deployment Failed",
    "deployment.canceled": "Deployment Canceled",
    "deployment.promoted": "Deployment Promoted",
    "deployment.rollback": "Deployment Rollback",
    "deployment.cleanup": "Deployment Cleanup",
    "deployment.check-rerequested": "Deployment Check Re-requested",
  };

  const entityState = stateMap[eventType] ?? "building";
  const actionTitle = eventTitleMap[eventType] ?? eventType;
  const branch = gitMeta?.githubCommitRef ?? "unknown";
  const isProduction = target === "production";
  // Note: `payload.project.name` is NOT in the Vercel webhook schema.
  // The project name lives in `payload.deployment.name` (the name used in the deployment URL).
  const projectName = deployment.name ?? project.id;

  const relations: EntityRelation[] = [
    // Vercel project (self-referential)
    {
      provider: "vercel",
      entityType: "project",
      entityId: project.id,
      title: projectName,
      url: null,
      relationshipType: "belongs_to",
    },
  ];
  // GitHub refs (cross-provider) — OMITTED in Phase 1, stored as attributes for Phase 3

  const rawBody = [
    `${actionTitle}`,
    gitMeta?.githubCommitMessage ?? "",
  ].filter(Boolean).join("\n");

  return {
    deliveryId: context.deliveryId,
    provider: "vercel",
    eventType,
    occurredAt: new Date(payload.createdAt).toISOString(),

    entity: {
      provider: "vercel",
      entityType: "deployment",
      entityId: deployment.id,
      title: projectName,
      url: deployment.url ? `https://${deployment.url}` : null,
      state: entityState,
    },

    relations,

    title: sanitizeTitle(`[${actionTitle}] ${projectName} from ${branch}`),
    body: sanitizeBody(rawBody),

    attributes: {
      projectId: project.id,
      projectName,
      teamId: team?.id ?? null,
      // Note: payload.target values are "production" | "staging" | null (NOT "preview")
      environment: isProduction ? "production" : "staging",
      branch,
      region: payload.region ?? null,
      // GitHub cross-provider refs stored as strings for Phase 3 linking:
      gitCommitSha: gitMeta?.githubCommitSha ?? null,
      gitBranch: gitMeta?.githubCommitRef ?? null,
      gitCommitMessage: gitMeta?.githubCommitMessage ?? null,
      gitPrId: gitMeta?.githubPrId ? String(gitMeta.githubPrId) : null,
      gitOrg: gitMeta?.githubOrg ?? null,
      gitRepo: gitMeta?.githubRepo ?? null,
    },
  };
}
```

---

### Linear: Issue

Key change: `entity.state` comes from `issue.state.type` (Linear's normalized category),
not from `payload.action` (the webhook operation).

```typescript
export function transformLinearIssue(
  payload: PreTransformLinearIssueWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const issue = payload.data;

  const relations: EntityRelation[] = [];

  // Belongs to project (self-referential)
  if (issue.project) {
    relations.push({
      provider: "linear",
      entityType: "project",
      entityId: issue.project.id,   // use stable ID, not mutable name
      title: issue.project.name,
      url: issue.project.url,
      relationshipType: "belongs_to",
    });
  }

  // In a cycle (self-referential)
  if (issue.cycle) {
    relations.push({
      provider: "linear",
      entityType: "cycle",
      entityId: `${issue.team.key}:${issue.cycle.number}`,
      title: issue.cycle.name,
      url: null,
      relationshipType: "in_cycle",
    });
  }

  // Parent issue (sub-issue relationship)
  if (issue.parent) {
    relations.push({
      provider: "linear",
      entityType: "issue",
      entityId: issue.parent.identifier,
      title: issue.parent.title,
      url: null,
      relationshipType: "parent",
    });
  }

  // Cross-provider attachments — OMITTED in Phase 1, stored as attributes
  // (GitHub PR: attributes.githubPrNumber; Sentry: attributes.sentryIssueShortId)
  const githubPrAttachment = issue.attachments?.nodes?.find(a => a.sourceType === "githubPr");
  const sentryAttachment = issue.attachments?.nodes?.find(a => a.sourceType === "sentryIssue");

  // OMITTED: assignee (actors, Phase 2)
  // OMITTED: labels (metadata)

  const actionTitleMap: Record<string, string> = {
    create: "Issue Created",
    update: "Issue Updated",
    remove: "Issue Deleted",
  };
  const actionTitle = actionTitleMap[payload.action] ?? `Issue ${payload.action}`;

  const bodyParts = [
    issue.title,
    issue.description ?? "",
    `Team: ${issue.team.name}`,
    `State: ${issue.state.name}`,
    `Priority: ${issue.priorityLabel}`,
    issue.project ? `Project: ${issue.project.name}` : "",
    issue.cycle ? `Cycle: ${issue.cycle.name}` : "",
  ].filter(Boolean);

  return {
    deliveryId: context.deliveryId,
    provider: "linear",
    eventType: `issue.${mapLinearAction(payload.action)}`,
    occurredAt: payload.createdAt,

    entity: {
      provider: "linear",
      entityType: "issue",
      entityId: issue.identifier,   // "ENG-42" — stable, no action suffix
      title: issue.title,
      url: issue.url,
      state: issue.state.type,     // "backlog"|"unstarted"|"started"|"completed"|"canceled"
      // NOT payload.action — that's the webhook op, not the domain state
    },

    relations,

    title: sanitizeTitle(`[${actionTitle}] ${issue.identifier}: ${issue.title.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),

    attributes: {
      teamKey: issue.team.key,
      teamName: issue.team.name,
      priority: issue.priority,
      priorityLabel: issue.priorityLabel,
      stateName: issue.state.name,
      stateType: issue.state.type,
      estimate: issue.estimate ?? null,
      dueDate: issue.dueDate ?? null,
      branchName: issue.branchName ?? null,
      // Cross-provider refs stored for Phase 3:
      githubPrNumber: githubPrAttachment?.metadata?.number ?? null,
      sentryIssueShortId: sentryAttachment?.metadata?.shortId ?? null,
    },
  };
}

function mapLinearAction(action: string): string {
  return { create: "created", update: "updated", remove: "deleted" }[action] ?? action;
}
```

### Linear: Comment

```typescript
export function transformLinearComment(
  payload: PreTransformLinearCommentWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const comment = payload.data;

  return {
    deliveryId: context.deliveryId,
    provider: "linear",
    eventType: `comment.${mapLinearAction(payload.action)}`,
    occurredAt: payload.createdAt,

    entity: {
      provider: "linear",
      entityType: "comment",
      entityId: `${comment.issue.identifier}:${comment.id}`,
      title: comment.body.slice(0, 80),
      url: comment.url,
      state: payload.action === "remove" ? "deleted" : "active",
    },

    relations: [
      {
        provider: "linear",
        entityType: "issue",
        entityId: comment.issue.identifier,
        title: comment.issue.title,
        url: comment.issue.url,
        relationshipType: "belongs_to",
      },
      // Thread parent
      ...(comment.parent
        ? [{
            provider: "linear",
            entityType: "comment",
            entityId: `${comment.issue.identifier}:${comment.parent.id}`,
            title: null,
            url: null,
            relationshipType: "parent",
          }]
        : []),
    ],

    title: sanitizeTitle(`[Comment ${payload.action === "create" ? "Added" : payload.action === "update" ? "Edited" : "Deleted"}] ${comment.issue.identifier}`),
    body: sanitizeBody(comment.body),

    attributes: {
      issueIdentifier: comment.issue.identifier,
      issueTitle: comment.issue.title,
    },
  };
}
```

### Linear: Project

```typescript
export function transformLinearProject(
  payload: PreTransformLinearProjectWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const project = payload.data;

  const bodyParts = [
    project.name,
    project.description ?? "",
    `State: ${project.state}`,
    `Progress: ${Math.round(project.progress * 100)}%`,
    project.targetDate ? `Target: ${project.targetDate}` : "",
    `Teams: ${project.teams.map(t => t.name).join(", ")}`,
  ].filter(Boolean);

  return {
    deliveryId: context.deliveryId,
    provider: "linear",
    eventType: `project.${mapLinearAction(payload.action)}`,
    occurredAt: payload.createdAt,

    entity: {
      provider: "linear",
      entityType: "project",
      entityId: project.slugId,   // stable slug ID, not mutable name
      title: project.name,
      url: project.url,
      state: project.state,  // "backlog"|"planned"|"started"|"paused"|"completed"|"canceled"
    },

    relations: [],  // OMITTED: lead/members (actors, Phase 2); teams (non-entity metadata)

    title: sanitizeTitle(`[Project ${payload.action === "create" ? "Created" : payload.action === "update" ? "Updated" : "Deleted"}] ${project.name}`),
    body: sanitizeBody(bodyParts.join("\n")),

    attributes: {
      projectName: project.name,
      state: project.state,
      progress: project.progress,
      scope: project.scope,
      targetDate: project.targetDate ?? null,
      startDate: project.startDate ?? null,
    },
  };
}
```

### Linear: Cycle

```typescript
export function transformLinearCycle(
  payload: PreTransformLinearCycleWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const cycle = payload.data;
  const cycleName = cycle.name ?? `Cycle ${cycle.number}`;

  // Derive cycle state from dates + completedAt
  const now = new Date();
  const starts = new Date(cycle.startsAt);
  const ends = new Date(cycle.endsAt);
  const cycleState = cycle.completedAt
    ? "completed"
    : now < starts
    ? "upcoming"
    : now > ends
    ? "completed"
    : "active";

  const bodyParts = [
    cycleName,
    cycle.description ?? "",
    `Team: ${cycle.team.name}`,
    `Starts: ${cycle.startsAt}`,
    `Ends: ${cycle.endsAt}`,
    `Progress: ${Math.round(cycle.progress * 100)}%`,
  ].filter(Boolean);

  return {
    deliveryId: context.deliveryId,
    provider: "linear",
    eventType: `cycle.${mapLinearAction(payload.action)}`,
    occurredAt: payload.createdAt,

    entity: {
      provider: "linear",
      entityType: "cycle",
      entityId: `${cycle.team.key}:${cycle.number}`,
      title: cycleName,
      url: cycle.url,
      state: cycleState,
    },

    relations: [],  // cycles don't self-reference other Linear entities

    title: sanitizeTitle(`[Cycle ${payload.action === "create" ? "Created" : "Updated"}] ${cycleName} (${cycle.team.name})`),
    body: sanitizeBody(bodyParts.join("\n")),

    attributes: {
      teamKey: cycle.team.key,
      teamName: cycle.team.name,
      cycleNumber: cycle.number,
      startsAt: cycle.startsAt,
      endsAt: cycle.endsAt,
      progress: cycle.progress,
      scope: cycle.scope,
    },
  };
}
```

### Linear: Project Update

```typescript
export function transformLinearProjectUpdate(
  payload: PreTransformLinearProjectUpdateWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const update = payload.data;

  return {
    deliveryId: context.deliveryId,
    provider: "linear",
    eventType: `project-update.${mapLinearAction(payload.action)}`,
    occurredAt: payload.createdAt,

    entity: {
      provider: "linear",
      entityType: "project-update",
      entityId: `${update.project.id}:${update.id}`,
      title: update.body.slice(0, 80),
      url: update.url,
      state: payload.action === "remove" ? "deleted" : update.health,
      // health: "onTrack" | "atRisk" | "offTrack"
    },

    relations: [
      {
        provider: "linear",
        entityType: "project",
        entityId: update.project.id,
        title: update.project.name,
        url: update.project.url,
        relationshipType: "belongs_to",
      },
    ],

    title: sanitizeTitle(`[Project Update] ${update.project.name}: ${update.body.slice(0, 60)}`),
    body: sanitizeBody([update.body, `Health: ${update.health}`, `Project: ${update.project.name}`].join("\n")),

    attributes: {
      projectId: update.project.id,
      projectName: update.project.name,
      health: update.health,
    },
  };
}
```

---

### Sentry: Issue

```typescript
export function transformSentryIssue(
  payload: PreTransformSentryIssueWebhook,
  context: TransformContext,
  _eventType: string
): PostTransformEvent {
  const { issue } = payload.data;

  // Note: Sentry renamed the "ignored" action to "archived". The action value
  // "ignored" no longer fires; "archived" is the correct action value.
  // (The `status` field on the issue still uses "ignored" internally — that's Sentry's inconsistency.)
  const stateMap: Record<string, string> = {
    created: "unresolved",
    resolved: "resolved",
    unresolved: "unresolved",
    assigned: "unresolved",
    archived: "archived",
  };

  const relations: EntityRelation[] = [];

  // Cross-provider: resolved_by commit — OMITTED Phase 1, stored as attributes
  const resolvedByCommit = issue.statusDetails?.inCommit?.commit ?? null;
  const resolvedByRepo = issue.statusDetails?.inCommit?.repository ?? null;

  // OMITTED: assignedTo (actor, Phase 2)

  const actionTitleMap: Record<string, string> = {
    created: "Issue Created",
    resolved: "Issue Resolved",
    assigned: "Issue Assigned",
    archived: "Issue Archived",   // "ignored" action was renamed "archived" by Sentry
    unresolved: "Issue Unresolved",
  };

  const errorType = issue.metadata.type ?? "Error";
  const errorValue = issue.metadata.value ?? issue.title;

  const bodyParts = [
    issue.title,
    issue.metadata.value,
    issue.metadata.filename ? `Location: ${issue.metadata.filename}` : "",
    issue.metadata.function ? `Function: ${issue.metadata.function}` : "",
    `Level: ${issue.level}`,
    `Platform: ${issue.platform}`,
    `Occurrences: ${issue.count}`,
    `Users affected: ${issue.userCount}`,
  ].filter(Boolean);

  return {
    deliveryId: context.deliveryId,
    provider: "sentry",
    eventType: `issue.${payload.action}`,
    occurredAt: issue.lastSeen,

    entity: {
      provider: "sentry",
      entityType: "issue",
      entityId: `${issue.project.slug}:${issue.shortId}`,
      title: `${errorType}: ${errorValue.slice(0, 100)}`,
      url: issue.permalink ?? null,
      state: stateMap[payload.action] ?? "unresolved",
    },

    relations,

    title: sanitizeTitle(`[${actionTitleMap[payload.action]}] ${errorType}: ${errorValue.slice(0, 80)}`),
    body: sanitizeBody(bodyParts.join("\n")),

    attributes: {
      projectSlug: issue.project.slug,
      projectName: issue.project.name,
      shortId: issue.shortId,
      level: issue.level,
      platform: issue.platform,
      errorType: issue.metadata.type ?? null,
      culprit: issue.culprit ?? null,
      occurrenceCount: issue.count,
      affectedUserCount: issue.userCount,
      firstSeen: issue.firstSeen,
      // Cross-provider refs for Phase 3:
      resolvedByCommit,
      resolvedByRepo,
    },
  };
}
```

### Sentry: Error, EventAlert, MetricAlert

Similar pattern — `entity.entityId` stable, no action suffix, cross-provider refs in attributes.
(Full implementations follow same pattern as above — omitting for brevity here.)

**Important correction for error transformer**: The error webhook uses `data.error.datetime`
(ISO 8601 string), NOT `data.error.timestamp`. The current transformer incorrectly uses
`String(errorEvent.timestamp)` — this must be `String(errorEvent.datetime)`.
Also available: `data.error.received` (Unix epoch float) if a numeric timestamp is needed.

---

## Updated Helper: `extractLinkedIssues`

The key change: returns fully-qualified entity IDs using the repo context.

```typescript
function extractLinkedIssues(
  body: string,
  repoFullName: string,    // now required — "org/repo"
  repoUrl: string
): { entityId: string; url: string | null; relationshipType: string }[] {
  const matches: { entityId: string; url: string | null; relationshipType: string }[] = [];

  const githubPattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
  let match;
  while ((match = githubPattern.exec(body)) !== null) {
    const keyword = match[1]!.toLowerCase();
    const relationshipType = keyword.startsWith("fix") ? "fixes"
      : keyword.startsWith("close") ? "closes"
      : "resolves";
    matches.push({
      entityId: `${repoFullName}#${match[2]}`,       // fully-qualified: "org/repo#7"
      url: `${repoUrl}/issues/${match[2]}`,
      relationshipType,
    });
  }

  // External issue refs (Linear, Jira) stored as attributes in Phase 1
  // In Phase 3, these become cross-provider EntityRelation entries
  return matches;
}
```

---

## What About `sanitizePostTransformEvent`?

The ingress route calls `sanitizePostTransformEvent(rawEvent)` after transform. This sanitizes
URLs in references. With the new schema, it needs to sanitize:
- `entity.url`
- `relations[*].url`

The function signature stays the same (`PostTransformEvent → PostTransformEvent`) but its
internal implementation traverses the new structure.

---

## Extension Points

### Phase 2: Actors

When actors are added, `EntityRelation` entries with `entityType: "actor"` are appended to
`relations`. No schema change needed:

```typescript
// GitHub PR — actors added in Phase 2:
relations.push({
  provider: "github",
  entityType: "actor",
  entityId: `github:${pr.user.login}`,   // "github:alice"
  title: pr.user.login,
  url: `https://github.com/${pr.user.login}`,
  relationshipType: "authored_by",
});
for (const reviewer of pr.requested_reviewers ?? []) {
  relations.push({
    provider: "github",
    entityType: "actor",
    entityId: `github:${reviewer.login}`,
    title: reviewer.login,
    url: `https://github.com/${reviewer.login}`,
    relationshipType: "reviewed_by",
  });
}
```

### Phase 3: Cross-Provider Relations

When cross-provider is enabled, the cross-provider refs currently stored in `attributes`
(e.g., `gitCommitSha`, `githubPrNumber`) are promoted to `EntityRelation` entries:

```typescript
// Vercel Deployment — cross-provider added in Phase 3:
if (gitMeta.githubCommitSha) {
  relations.push({
    provider: "github",
    entityType: "commit",
    entityId: gitMeta.githubCommitSha,
    title: null,
    url: `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/commit/${gitMeta.githubCommitSha}`,
    relationshipType: "deployed_from",
  });
}

// Linear Issue — cross-provider GitHub PR:
if (githubPrAttachment) {
  relations.push({
    provider: "github",
    entityType: "pr",
    entityId: `${gitOrg}/${gitRepo}#${githubPrAttachment.metadata.number}`,
    title: null,
    url: githubPrAttachment.url ?? null,
    relationshipType: "tracked_in",
  });
}
```

### Phase 4: AI-Extracted Entities

Entities extracted from body text by LLM (endpoints, service names, config keys):

```typescript
// Extracted from PR body / issue descriptions:
relations.push({
  provider: "extracted",    // special provider for AI-extracted entities
  entityType: "endpoint",   // "endpoint" | "service" | "config" | "file"
  entityId: "POST /api/users",
  title: "POST /api/users",
  url: null,
  relationshipType: "references",
});
```

---

## Search Query Coverage

How the redesign answers the target queries:

| Query | Resolution |
|---|---|
| "what happened to auth yesterday" | Semantic search on `title`+`body` → get events where `occurredAt` is yesterday; `entity.state` shows current lifecycle state |
| "auth" | Semantic search on `entity.title`+`body`; filter by `attributes.repoFullName`, `attributes.projectName` |
| "tell me about authentication implementation" | Semantic embed on `body` (rich PR descriptions, issue bodies) → find related entities |
| "when was auth update last deployed" | Find `entity.entityType="deployment"` related to "auth" PRs/commits; cross-provider links in Phase 3 |
| "who worked on apps/auth/....." | Actor relations in Phase 2; for now: `entity.title` + `body` pattern matching |
| "show all open PRs" | Postgres `WHERE entityType='pr' AND currentState='open'` on `workspaceSourceEntities` |
| "what's the history of ENG-42" | `workspaceEntityTransitions WHERE entityId=X ORDER BY occurredAt` |

---

## Migration Impact

Files to change:

1. `packages/console-providers/src/post-transform-event.ts` — replace schema
2. `packages/console-providers/src/providers/github/transformers.ts` — full rewrite
3. `packages/console-providers/src/providers/linear/transformers.ts` — full rewrite
4. `packages/console-providers/src/providers/vercel/transformers.ts` — full rewrite
5. `packages/console-providers/src/providers/sentry/transformers.ts` — full rewrite
6. `packages/console-providers/src/sanitize.ts` — update URL sanitization traversal
7. `packages/console-providers/src/validation.ts` — update to new schema
8. `packages/console-providers/src/index.ts` — update exports
9. `packages/console-providers/src/display.ts` — update display helpers if they reference old fields
10. All tests in `packages/console-providers/src/providers/*/index.test.ts`

Downstream (Inngest workflow):
- `api/console/src/inngest/workflow/neural/event-store.ts` — reads `PostTransformEvent`; update field access
- Any search code that reads `sourceEvent` from `workspaceIngestLog`

No database migration needed — `workspaceIngestLog.sourceEvent` is JSONB and the old rows
are the raw event log (immutable). New rows will have the new structure. The new
`workspaceSourceEntities` table is new anyway.
