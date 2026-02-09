# Relationship Graph: Definitive Links Analysis

**Date:** 2026-02-06
**Status:** Research Complete
**Purpose:** Re-evaluate all webhook sources for explicit/definitive linking properties

---

## Executive Summary

After comprehensive analysis of all webhook transformers, I've identified the **definitive linking mechanisms** available for each source. The key insight: **GitHub commits are NOT the only source of truth** — Linear attachments and Sentry resolution details provide equally reliable explicit links.

### Confidence Tiers

| Tier | Confidence | Description |
|------|------------|-------------|
| **Explicit** | 1.0 | Direct API-provided link (attachment, statusDetails) |
| **Structural** | 1.0 | Built-in platform linking (commit SHA, PR head SHA) |
| **Inferred** | 0.7-0.9 | Pattern matching (branch names, issue mentions) |
| **Heuristic** | 0.5-0.7 | Title matching, timing correlation |

---

## Webhook Sources Deep Dive

### 1. GitHub Webhooks

**Location:** `packages/console-webhooks/src/transformers/github.ts`
**Webhook Handler:** `apps/console/src/app/(github)/api/github/webhooks/route.ts`

#### Event Types Consumed

| Event | sourceType | Description |
|-------|------------|-------------|
| `push` | `push` | Code commits to branch |
| `pull_request.*` | `pull-request.{action}` | PR lifecycle (opened, closed, merged, etc.) |
| `issues.*` | `issue.{action}` | Issue lifecycle |
| `release.*` | `release.{action}` | Release published |
| `discussion.*` | `discussion.{action}` | GitHub Discussions |

#### Definitive Linking Properties

| Field | Reference Type | Confidence | Source Location |
|-------|---------------|------------|-----------------|
| `payload.after` (push) | `commit` | 1.0 (Structural) | Line 44-48 |
| `pr.head.sha` | `commit` | 1.0 (Structural) | Line 135-141 |
| `pr.head.ref` / `pr.base.ref` | `branch` | 1.0 (Structural) | Line 143-148 |
| `extractLinkedIssues(pr.body)` | `issue` w/ label | 1.0 (Explicit) | Line 151-160 |
| `pr.requested_reviewers[].login` | `reviewer` | 1.0 (Structural) | Line 163-171 |
| `pr.assignees[].login` | `assignee` | 1.0 (Structural) | Line 174-180 |
| `pr.labels[].name` | `label` | 1.0 (Structural) | Line 183-188 |
| `release.target_commitish` | `branch` | 1.0 (Structural) | Line 348-349 |

#### Issue Linking Patterns Detected

The `extractLinkedIssues()` function parses PR body for:
```
Fixes #123
Closes #456
Resolves #789
Fix: #123
```

These are stored with explicit `label` field: `"fixes"`, `"closes"`, `"resolves"`

---

### 2. Vercel Webhooks

**Location:** `packages/console-webhooks/src/transformers/vercel.ts`
**Webhook Handler:** `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

#### Event Types Consumed

| Event | sourceType | Description |
|-------|------------|-------------|
| `deployment.created` | `deployment.created` | Deployment started |
| `deployment.succeeded` | `deployment.succeeded` | Build successful |
| `deployment.ready` | `deployment.ready` | Deployment live |
| `deployment.canceled` | `deployment.canceled` | Deployment cancelled |
| `deployment.error` | `deployment.error` | Deployment failed |
| `deployment.check-rerequested` | `deployment.check-rerequested` | Check re-requested |

#### Definitive Linking Properties

| Field | Reference Type | Confidence | Source Location |
|-------|---------------|------------|-----------------|
| `deployment.meta.githubCommitSha` | `commit` | 1.0 (Structural) | Line 34-43 |
| `deployment.meta.githubCommitRef` | `branch` | 1.0 (Structural) | Line 46-55 |
| `deployment.id` | `deployment` | 1.0 (Structural) | Line 58-62 |
| `project.id` | `project` | 1.0 (Structural) | Line 65-68 |

#### Metadata Available (not currently extracted as references)

```typescript
meta.githubPrId        // PR number - NOT currently extracted!
meta.githubOrg         // GitHub org
meta.githubRepo        // GitHub repo name
meta.githubCommitMessage
meta.githubCommitAuthorName
```

**Gap Identified:** `meta.githubPrId` is available but NOT extracted as a reference. This would enable Vercel → GitHub PR linking with 1.0 confidence.

---

### 3. Linear Webhooks

**Location:** `packages/console-test-data/src/transformers/linear.ts` (mock for demo)
**Status:** Not yet production webhook handler

#### Event Types Supported

| Event | type | Description |
|-------|------|-------------|
| `Issue.create/update/remove` | `issue.{action}` | Issue lifecycle |
| `Comment.create/update/remove` | `comment.{action}` | Comment lifecycle |
| `Project.create/update/remove` | `project.{action}` | Project lifecycle |
| `Cycle.create/update/remove` | `cycle.{action}` | Sprint lifecycle |
| `ProjectUpdate.create/update/remove` | `project-update.{action}` | Status updates |

#### Definitive Linking Properties

| Field | Reference Type | Confidence | Source Location |
|-------|---------------|------------|-----------------|
| `issue.identifier` | `issue` | 1.0 (Structural) | e.g., "LIGHT-123" |
| `issue.branchName` | `branch` | 1.0 (Structural) | Line 130 |
| `issue.team.key` | `team` | 1.0 (Structural) | Line 134-138 |
| `issue.cycle.id` | `cycle` | 1.0 (Structural) | Line 157-161 |
| `issue.project.id` | `project` | 1.0 (Structural) | Line 152-156 |
| **`attachments.nodes[].sourceType === "githubPr"`** | `pr` | **1.0 (Explicit)** | Line 398-404 |
| **`attachments.nodes[].sourceType === "sentryIssue"`** | `issue` (Sentry) | **1.0 (Explicit)** | Line 406-412 |

#### Key Discovery: Attachments API

Linear's webhook payload includes **explicit external links** via `attachments.nodes[]`:

```typescript
interface LinearAttachment {
  id: string;
  title: string;
  url?: string;
  sourceType?: string;  // "githubPr" | "sentryIssue" | etc.
  metadata?: {
    state?: string;      // PR state: "open", "merged"
    number?: number;     // PR/Issue number: 478
    shortId?: string;    // Sentry issue: "CHECKOUT-123"
  };
}
```

This is **MORE reliable** than title matching because:
1. User explicitly linked the PR/Issue in Linear
2. API provides structured data (PR number, Sentry shortId)
3. No fuzzy matching required

---

### 4. Sentry Webhooks

**Location:** `packages/console-test-data/src/transformers/sentry.ts` (mock for demo)
**Status:** Not yet production webhook handler

#### Event Types Supported

| Event | action | Description |
|-------|--------|-------------|
| `issue.created` | `created` | New issue grouped |
| `issue.resolved` | `resolved` | Issue marked resolved |
| `issue.assigned` | `assigned` | Issue assigned |
| `issue.ignored` | `ignored` | Issue ignored |
| `error` | `created` | Individual error event |
| `event_alert` | `triggered` | Alert rule fired |
| `metric_alert` | `triggered/resolved` | Metric threshold |

#### Definitive Linking Properties

| Field | Reference Type | Confidence | Source Location |
|-------|---------------|------------|-----------------|
| `issue.shortId` | `issue` | 1.0 (Structural) | e.g., "CHECKOUT-123" |
| `issue.project.slug` | `project` | 1.0 (Structural) | Line 250-254 |
| `issue.assignedTo.email` | `assignee` | 1.0 (Structural) | Line 257-262 |
| **`issue.statusDetails.inCommit.commit`** | `commit` | **1.0 (Explicit)** | Line 265-274 |
| **`issue.statusDetails.inCommit.repository`** | — | **1.0 (Explicit)** | Line 269-271 |
| `issue.statusDetails.inRelease` | `release` | 1.0 (Explicit) | Line 137 |

#### Key Discovery: Resolution Details

When a Sentry issue is resolved via commit:

```typescript
statusDetails: {
  inCommit: {
    repository: "acme/platform",  // GitHub repo full name
    commit: "abc123def456..."     // Full commit SHA
  }
}
```

This provides **explicit Sentry → GitHub linking** without fuzzy matching.

---

## Relationship Graph Architecture

### Source Reference Types

```typescript
type SourceReference = {
  type: "commit" | "branch" | "pr" | "issue" | "deployment" |
        "project" | "cycle" | "assignee" | "reviewer" | "team" | "label";
  id: string;           // The linking key
  url?: string;         // Optional permalink
  label?: string;       // Relationship qualifier: "fixes", "closes", "resolved_by"
};
```

### Relationship Types

```typescript
type RelationshipType =
  | "fixes"       // PR fixes issue (explicit from body)
  | "resolves"    // Commit resolves Sentry issue (explicit from statusDetails)
  | "triggers"    // Alert triggers investigation
  | "deploys"     // Deployment deploys commit
  | "references"  // Generic mention
  | "same_commit" // Same commit SHA
  | "same_branch" // Same branch name
  | "tracked_in"; // Linear issue tracks GitHub PR (via attachment)
```

### Detection Methods

| Method | Confidence | Example |
|--------|------------|---------|
| `explicit` | 1.0 | Linear attachment, Sentry statusDetails, PR body "Fixes #123" |
| `commit_match` | 1.0 | Same commit SHA between sources |
| `branch_match` | 0.9 | Same branch name (Linear branchName = GitHub head.ref) |
| `pr_match` | 1.0 | Linear attachment links to GitHub PR number |
| `issue_cooccurrence` | 0.8 | Same issue ID mentioned (LIN-123, CHECKOUT-123) |
| `entity_cooccurrence` | 0.7 | Same entity in title/body |

---

## Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           CROSS-SOURCE RELATIONSHIP GRAPH                               │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   GitHub    │
                                    │   Commits   │
                                    │  (SHA)      │
                                    └──────┬──────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │  GitHub Push    │          │   GitHub PR     │          │ Vercel Deploy   │
    │                 │          │                 │          │                 │
    │ • payload.after │◀────────▶│ • head.sha      │◀────────▶│ • meta.commit   │
    │   (commit SHA)  │          │ • head.ref      │          │   Sha           │
    │ • branch name   │          │ • base.ref      │          │ • meta.branch   │
    │                 │          │ • body (Fixes)  │          │ • meta.prId     │
    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘
             │                            │                            │
             │ same_commit (1.0)          │ fixes (1.0)                │ deploys (1.0)
             │ same_branch (0.9)          │ via extractLinkedIssues    │ via commit SHA
             │                            │                            │
             ▼                            ▼                            │
    ┌─────────────────┐          ┌─────────────────┐                   │
    │  GitHub Issue   │          │  Linear Issue   │                   │
    │                 │◀─────────│                 │                   │
    │ • #123 format   │  refs    │ • identifier    │                   │
    │                 │  (0.8)   │   (LIGHT-123)   │                   │
    └─────────────────┘          │ • branchName    │                   │
                                 │ • attachments[] │───────────────────┘
                                 └────────┬────────┘
                                          │
             ┌────────────────────────────┼────────────────────────────┐
             │                            │                            │
             │ tracked_in (1.0)           │ referenced (1.0)           │
             │ via attachment.sourceType  │ via attachment.sourceType  │
             │ === "githubPr"             │ === "sentryIssue"          │
             │                            │                            │
             ▼                            ▼                            │
    ┌─────────────────┐          ┌─────────────────┐                   │
    │   GitHub PR     │          │  Sentry Issue   │◀──────────────────┘
    │   (linked)      │          │                 │    resolves (1.0)
    │                 │          │ • shortId       │    via statusDetails
    │ • PR #478       │          │   (CHECKOUT-123)│    .inCommit.commit
    └─────────────────┘          │ • statusDetails │
                                 │   .inCommit     │
                                 └─────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              LINKING KEY SUMMARY                                        │
├─────────────────┬───────────────────────────────────────────────────────────────────────┤
│ Linking Key     │ Sources That Provide It                                              │
├─────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Commit SHA      │ GitHub push.after, GitHub pr.head.sha, Vercel meta.githubCommitSha,  │
│                 │ Sentry statusDetails.inCommit.commit                                  │
├─────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Branch Name     │ GitHub push.ref, GitHub pr.head.ref/base.ref,                        │
│                 │ Vercel meta.githubCommitRef, Linear issue.branchName                 │
├─────────────────┼───────────────────────────────────────────────────────────────────────┤
│ PR Number       │ GitHub pr.number, Vercel meta.githubPrId (GAP!),                     │
│                 │ Linear attachment.metadata.number                                    │
├─────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Issue ID        │ GitHub issue.number (#123), Linear identifier (LIGHT-123),           │
│                 │ Sentry shortId (CHECKOUT-123), Linear attachment.metadata.shortId    │
├─────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Repository      │ GitHub repository.full_name, Vercel meta.githubOrg + meta.githubRepo,│
│                 │ Sentry statusDetails.inCommit.repository                             │
└─────────────────┴───────────────────────────────────────────────────────────────────────┘
```

---

## Gaps & Recommendations

### Gap 1: Vercel → GitHub PR Link Missing

**Current State:** `meta.githubPrId` is available in Vercel payloads but NOT extracted.

**Impact:** Cannot directly link Vercel deployments to GitHub PRs (only to commits).

**Fix:** Add to `transformVercelDeployment()`:
```typescript
if (gitMeta?.githubPrId) {
  refs.push({
    type: "pr",
    id: `#${gitMeta.githubPrId}`,
    url: `https://github.com/${gitMeta.githubOrg}/${gitMeta.githubRepo}/pull/${gitMeta.githubPrId}`,
  });
}
```

### Gap 2: Linear/Sentry Webhook Handlers Not Production

**Current State:** `linear.ts` and `sentry.ts` are in `console-test-data` (mock transformers).

**Impact:** Cannot receive real Linear/Sentry webhooks.

**Fix:** Create production webhook handlers in `apps/console/src/app/(linear)` and `apps/console/src/app/(sentry)`.

### Gap 3: No Reverse Relationship Detection

**Current State:** Relationships are only detected when new observations arrive.

**Impact:** If a Sentry issue is resolved AFTER the PR was ingested, no relationship is created.

**Fix:** Add periodic relationship reconciliation job or webhook-triggered re-evaluation.

### Gap 4: Branch Name Normalization

**Current State:** Linear's `branchName` may differ from GitHub's `head.ref` (prefixes, casing).

**Impact:** Branch matching may fail for legitimately related issues.

**Fix:** Normalize branch names before comparison (strip prefixes like `feat/`, lowercase).

---

## Implementation Priority

1. **Extract `githubPrId` from Vercel** — Easy win, high impact
2. **Production Linear webhook handler** — Enables explicit GitHub/Sentry links
3. **Production Sentry webhook handler** — Enables commit-based resolution links
4. **Relationship reconciliation job** — Handles out-of-order webhook delivery

---

## Appendix: All Webhook Files

### Production Handlers
- `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`

### Transformers
- `packages/console-webhooks/src/transformers/github.ts`
- `packages/console-webhooks/src/transformers/vercel.ts`

### Mock Transformers (Demo Data)
- `packages/console-test-data/src/transformers/linear.ts`
- `packages/console-test-data/src/transformers/sentry.ts`

### Relationship Detection
- `api/console/src/inngest/workflow/neural/relationship-detection.ts`

### Schema
- `db/console/src/schema/tables/workspace-observation-relationships.ts`

---

## Expanded Integration Analysis

### 5. PlanetScale (Database)

**Integration Type:** Webhooks via Deploy Requests API
**Documentation:** https://api.planetscale.com/v1 (OpenAPI)

#### Event Types Available

| Event | Description |
|-------|-------------|
| `deploy_request.opened` | Deploy request created |
| `deploy_request.queued` | Deploy request queued |
| `deploy_request.in_progress` | Schema deployment running |
| `deploy_request.complete_pending_revert` | Deployed, revert window open |
| `deploy_request.complete` | Successfully deployed |
| `deploy_request.cancelled` | Cancelled by user |
| `deploy_request.errored` | Deployment failed |
| `branch.created` | Database branch created |
| `branch.deleted` | Database branch deleted |
| `branch.ready` | Branch ready for connections |

#### Linking Properties

| Field | Reference Type | Confidence | Notes |
|-------|---------------|------------|-------|
| `deploy_request.branch` | `branch` | 0.7 (Heuristic) | DB branch name may match git branch |
| `deploy_request.number` | — | 1.0 (Structural) | Internal DR number |
| `deploy_request.created_at` | — | 0.5 (Temporal) | Timing correlation only |

#### Integration Value

**Low-Medium.** PlanetScale doesn't provide direct git integration. Linking would require:
- Convention: DB branch names match git branch names
- Timing correlation: DR created near PR merge

**Recommendation:** Defer unless team uses strict branch naming conventions.

---

### 6. Axiom (Observability)

**Integration Type:** Webhooks + OpenTelemetry correlation
**Documentation:** https://axiom.co/docs/restapi/endpoints/notifiers

#### Event Types Available

| Event | Description |
|-------|-------------|
| `monitor.triggered` | Alert threshold crossed |
| `monitor.resolved` | Alert condition cleared |
| Arbitrary notifier webhooks | Custom alert payloads |

#### Linking Properties

| Field | Reference Type | Confidence | Notes |
|-------|---------------|------------|-------|
| `resource.service.version` | `commit` | 1.0 (Explicit) | If set to git SHA |
| `resource.git.commit.sha` | `commit` | 1.0 (Explicit) | OpenTelemetry semantic convention |
| `trace_id` / `span_id` | `trace` | 1.0 (Structural) | Cross-service correlation |
| `resource.deployment.environment` | `deployment` | 0.9 (Structural) | Environment context |

#### Integration Value

**High.** Axiom with OpenTelemetry provides explicit correlation via:
1. `git.commit.sha` resource attribute (link logs to commits)
2. `trace_id` for distributed request tracing
3. Custom resource attributes for any metadata

**Implementation:**
```typescript
// In your telemetry setup
resource: {
  'git.commit.sha': process.env.VERCEL_GIT_COMMIT_SHA,
  'git.branch': process.env.VERCEL_GIT_COMMIT_REF,
  'deployment.id': process.env.VERCEL_DEPLOYMENT_ID,
}
```

**Recommendation:** High priority if already using OpenTelemetry. Enables: Error → Trace → Commit → PR flow.

---

### 7. Clerk (Authentication)

**Integration Type:** Webhooks via Svix
**Documentation:** https://clerk.com/docs/integrations/webhooks

#### Event Types Available (30+)

| Event | Description |
|-------|-------------|
| `user.created` | New user signup |
| `user.updated` | User profile changed |
| `user.deleted` | User removed |
| `session.created` | Login |
| `session.ended` | Logout |
| `organization.created` | New org |
| `organization.membership.created` | User joined org |

#### Linking Properties

| Field | Reference Type | Confidence | Notes |
|-------|---------------|------------|-------|
| `data.id` | `user` | 1.0 (Structural) | Clerk user ID |
| `data.external_accounts[].provider` | — | — | OAuth provider name |
| `data.external_accounts[].provider_user_id` | `actor` | **1.0 (Explicit)** | GitHub/Linear user ID! |
| `data.email_addresses[].email_address` | `actor` | 0.9 (Structural) | Email-based matching |

#### Key Discovery: Cross-Source Identity

Clerk's `external_accounts` array contains OAuth provider user IDs:

```typescript
external_accounts: [
  {
    provider: "oauth_github",
    provider_user_id: "12345678"  // GitHub user ID
  },
  {
    provider: "oauth_linear",
    provider_user_id: "abc-def-123"  // Linear user ID
  }
]
```

This enables **identity resolution**: Link GitHub commits (author ID) → Linear issues (assignee ID) → Clerk user → Organization.

**Recommendation:** High priority. Enables actor-based relationship linking across all sources.

---

### 8. HubSpot (CRM)

**Integration Type:** Webhooks via Subscriptions API
**Documentation:** https://developers.hubspot.com/docs/api/webhooks

#### Event Types Available

| Event | Description |
|-------|-------------|
| `contact.creation` | New contact |
| `contact.propertyChange` | Contact updated |
| `company.creation` | New company |
| `deal.creation` | New deal |
| `deal.propertyChange` | Deal stage change |
| `ticket.creation` | Support ticket |

#### Linking Properties

| Field | Reference Type | Confidence | Notes |
|-------|---------------|------------|-------|
| `objectId` | `contact/company/deal` | 1.0 (Structural) | HubSpot internal ID |
| Custom properties | Any | 1.0 (Explicit) | User-defined fields |

#### Integration Value

**Medium-High.** HubSpot doesn't have native dev tool integration, but custom properties enable:

```
// Custom properties on HubSpot Contact/Deal
linear_issue_id: "LIGHT-123"
github_pr_number: "#478"
sentry_issue_id: "CHECKOUT-123"
```

This enables the **customer intelligence flow**:
- Customer reports bug (HubSpot ticket) → Sentry issue → GitHub PR → Resolution
- Deal stage → Related Linear project progress

**Recommendation:** Medium priority. Valuable for customer-facing teams but requires custom property setup.

---

### 9. Notion (Documentation)

**Integration Type:** Real Webhooks (not polling)
**Documentation:** https://developers.notion.com/docs/working-with-webhooks

#### Event Types Available

| Event | Description |
|-------|-------------|
| `page.created` | New page |
| `page.content_updated` | Page content changed |
| `page.properties_updated` | Properties changed |
| `database.created` | New database |
| `database.content_updated` | Database entries changed |
| `comment.created` | New comment |
| `comment.deleted` | Comment removed |

#### Linking Properties

| Field | Reference Type | Confidence | Notes |
|-------|---------------|------------|-------|
| `page.properties[].url` | Any | 1.0 (Explicit) | URL properties can link to GitHub/Linear |
| `page.properties[].relation` | Any | 1.0 (Explicit) | Cross-database relations |
| GitHub connected property | `pr`/`issue` | 1.0 (Explicit) | Native GitHub integration |

#### Integration Value

**Medium.** Notion's value for relationship graph:
1. **Specs → Implementation tracking**: RFC page links to Linear epic
2. **Runbook → Incident linking**: Runbook mentions Sentry issue IDs
3. **ADR → PR linking**: Decision records link to implementing PRs

**Note:** Webhook payloads are minimal - require follow-up API calls to get full content.

**Recommendation:** Medium priority. Best for documentation-driven workflows.

---

## Updated Integration Priority Matrix

| Integration | Linking Quality | Implementation Effort | Value | Priority |
|-------------|-----------------|----------------------|-------|----------|
| **Axiom** | Explicit (trace_id, commit SHA) | Low (OpenTelemetry) | High | **P1** |
| **Clerk** | Explicit (provider_user_id) | Low (webhooks exist) | High | **P1** |
| **Vercel PR fix** | Explicit (meta.githubPrId) | Trivial | High | **P0** |
| **Linear production** | Explicit (attachments) | Medium | High | **P1** |
| **Sentry production** | Explicit (statusDetails) | Medium | High | **P1** |
| **HubSpot** | Custom properties | Medium | Medium | **P2** |
| **Notion** | URL properties | Medium | Medium | **P2** |
| **PlanetScale** | Heuristic only | Medium | Low | **P3** |

---

## Comprehensive Relationship Diagram (Expanded)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                        FULL CROSS-SOURCE RELATIONSHIP GRAPH                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                         ┌──────────────┐
                                         │    Clerk     │
                                         │   Identity   │
                                         │   Layer      │
                                         └──────┬───────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                           │                           │
                    ▼                           ▼                           ▼
         external_accounts[]           external_accounts[]        email_addresses[]
         .provider_user_id             .provider_user_id
         (GitHub user ID)              (Linear user ID)
                    │                           │                           │
                    │                           │                           │
    ┌───────────────┼───────────────────────────┼───────────────────────────┼───────────────────┐
    │               ▼                           ▼                           ▼                   │
    │    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐         │
    │    │     GitHub      │          │     Linear      │          │    HubSpot      │         │
    │    │                 │          │                 │          │                 │         │
    │    │ • pr.user.id    │          │ • issue.assignee│          │ • contact.email │         │
    │    │ • commit.author │◀────────▶│ • attachments[] │          │ • custom props  │         │
    │    │ • issue.user    │ tracked_in   (explicit PR)│          │   (issue_id)    │         │
    │    └────────┬────────┘          └────────┬────────┘          └────────┬────────┘         │
    │             │                            │                            │                   │
    │             │                            │                            │                   │
    │             ▼                            │                            │                   │
    │    ┌─────────────────┐                   │                            │                   │
    │    │  GitHub Commit  │◀──────────────────┼────────────────────────────┘                   │
    │    │     (SHA)       │                   │    customer_issue_id                          │
    │    └────────┬────────┘                   │                                               │
    │             │                            │                                               │
    │   ┌─────────┼─────────┬──────────────────┼───────────────────┐                           │
    │   │         │         │                  │                   │                           │
    │   ▼         ▼         ▼                  ▼                   ▼                           │
    │ Vercel   Sentry   Axiom             Notion              PlanetScale                      │
    │ Deploy   Issue    Logs              Docs                  (weak)                         │
    │   │        │        │                 │                     │                            │
    │   │        │        │                 │                     │                            │
    │   └────────┴────────┴─────────────────┴─────────────────────┘                            │
    │                     │                                                                    │
    │              All linked via:                                                             │
    │              • git.commit.sha (Axiom OTEL)                                               │
    │              • meta.githubCommitSha (Vercel)                                             │
    │              • statusDetails.inCommit (Sentry)                                           │
    │              • URL properties (Notion)                                                   │
    │              • branch name convention (PlanetScale)                                      │
    │                                                                                          │
    └──────────────────────────────────────────────────────────────────────────────────────────┘
```
