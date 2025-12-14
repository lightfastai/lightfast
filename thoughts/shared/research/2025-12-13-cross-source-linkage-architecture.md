---
date: 2025-12-13T14:30:00+08:00
researcher: Claude
git_commit: 0a9f87fb575a240135d3051212ac5352b2b905fd
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Cross-Source Linkage Architecture"
tags: [research, neural-memory, webhooks, github, vercel, sentry, linear, cross-source]
status: complete
last_updated: 2025-12-13
last_updated_by: Claude
last_updated_note: "Added strategic assessment on implementation priority"
---

# Research: Cross-Source Linkage Architecture

**Date**: 2025-12-13T14:30:00+08:00
**Researcher**: Claude
**Git Commit**: 0a9f87fb575a240135d3051212ac5352b2b905fd
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

Map all possible linkages between sources (GitHub, Vercel, Sentry, Linear) to design a unified cross-source relationship graph. Understand what identifiers are shared across sources and how events relate causally.

## Summary

This research documents the cross-source linkage architecture across GitHub, Vercel, Sentry, and Linear. The primary linkage point is the **git commit SHA**, which appears in GitHub push/PR events, Vercel deployment metadata, and Sentry releases. Secondary linkages include branch names, repository identifiers, and user identifiers.

**Key Findings:**
1. **GitHub** is the central hub - commit SHA links to all other sources
2. **Vercel** provides deployment → commit linkage via `meta.githubCommitSha`
3. **Sentry** can link errors to commits via release tracking and suspect commits
4. **Linear** links issues to PRs/branches via attachments and GitHub integration
5. Current implementation extracts core identifiers but misses several valuable fields

## Entity Relationship Diagram

```
                              ┌─────────────────────────────────────────┐
                              │              GITHUB                      │
                              │  (Central Hub - All Links Pass Through) │
                              └─────────────────────────────────────────┘
                                               │
          ┌────────────────────────────────────┼────────────────────────────────────┐
          │                                    │                                    │
          ▼                                    ▼                                    ▼
┌─────────────────────┐             ┌─────────────────────┐             ┌─────────────────────┐
│       VERCEL        │             │       SENTRY        │             │       LINEAR        │
│                     │             │                     │             │                     │
│ Links via:          │             │ Links via:          │             │ Links via:          │
│ • githubCommitSha   │             │ • release (SHA)     │             │ • Branch name       │
│ • githubCommitRef   │             │ • suspect commits   │             │ • PR attachments    │
│ • githubOrg/Repo    │             │ • stack trace paths │             │ • Issue ID in PR    │
└─────────────────────┘             └─────────────────────┘             └─────────────────────┘

                        ┌─────────────────────────────────────┐
                        │         SHARED IDENTIFIERS          │
                        ├─────────────────────────────────────┤
                        │ • Commit SHA (40-char hex)          │
                        │ • Branch name (string)              │
                        │ • Repository (org/repo format)      │
                        │ • Environment (prod/preview)        │
                        │ • User email/username               │
                        └─────────────────────────────────────┘
```

## Detailed Findings

### 1. GitHub Event Relationships (Internal)

#### Currently Extracted Identifiers

| Event Type | Extracted Fields | Location |
|------------|------------------|----------|
| **push** | `after` (commit SHA), `ref` (branch), `before` (prev SHA), `forced`, `commits[].files` | `github.ts:18-80` |
| **pull_request** | `head.sha`, `head.ref`, `base.ref`, `number`, `merged`, linked issues via regex | `github.ts:85-204` |
| **issues** | `number`, `state`, labels, assignees | `github.ts:209-280` |
| **release** | `tag_name`, `target_commitish` | `github.ts:285-339` |
| **discussion** | `number`, `category.name` | `github.ts:344-400` |

#### Available But NOT Extracted

**High-Value Missing Fields:**

| Field | Event | Purpose for Cross-Source Linking |
|-------|-------|----------------------------------|
| `merge_commit_sha` | pull_request | Links merged code to deployments |
| `base.sha` | pull_request | Enables diff computation |
| `compare` URL | push | Direct link to commit diff |
| `commits[].id` | push | Individual commit tracking |
| `parent_shas` | via API | Commit ancestry for blame |
| `pull_request` object | issues | Detects if issue is actually a PR |
| `assets[]` | release | Binary artifact tracking |

#### Linked Issue Extraction Pattern

```typescript
// Current implementation (github.ts:406-421)
const pattern = /(fix(?:es)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi;
// Extracts: "fixes #123" → { type: "issue", id: "#123", label: "fix" }
```

### 2. Vercel → GitHub Linkages

#### Deployment Meta Fields

The `deployment.meta` object contains GitHub metadata when deployments are triggered from Git:

```typescript
interface VercelGitMeta {
  githubCommitSha?: string;        // HEAD commit SHA (not merge commit)
  githubCommitRef?: string;        // Branch reference (e.g., "main")
  githubCommitMessage?: string;    // Commit message
  githubCommitAuthorName?: string; // Author display name
  githubCommitAuthorLogin?: string;// Author GitHub username
  githubOrg?: string;              // GitHub organization
  githubRepo?: string;             // Repository name
  githubDeployment?: string;       // Boolean flag ("1")
  githubCommitOrg?: string;        // For forks
  githubCommitRepo?: string;       // For forks
  githubCommitRepoId?: string;     // Repository ID
}
```

**Current Extraction** (`vercel.ts:28-54`):
- Extracts: `githubCommitSha`, `githubCommitRef`, `githubCommitMessage`, `githubCommitAuthorName`, `githubOrg`, `githubRepo`

**Missing but Available:**
- `githubCommitAuthorLogin` - Username (more reliable than display name)
- `githubCommitRepoId` - Numeric ID for cross-reference
- No `githubPullRequestId` field exists - must derive from branch name

#### Environment Detection

```typescript
// Current implementation (vercel.ts:80-81)
const isProduction = deployment.url?.includes(project.name) && !deployment.url?.includes("-");
```

**Available Fields:**
- `target`: `"production"` | `"preview"` | `null`
- `VERCEL_ENV` environment variable during build

#### Timing Fields

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | number | Unix timestamp (ms) - webhook send time |
| `buildingAt` | number | Build start time |
| `ready` | number | Deployment ready time |
| `canceledAt` | number | Cancellation time (if applicable) |

### 3. Sentry → GitHub/Vercel Linkages

#### Current State

**No Sentry webhook integration exists** in the main codebase. Sentry is only used for error tracking/monitoring of the applications themselves.

**Existing Code:**
- Error capture: `@sentry/nextjs` in all apps
- No webhook receiver at `/api/sentry/webhooks`
- No `packages/console-webhooks/src/transformers/sentry.ts`

#### How Sentry Links to GitHub (When Implemented)

**Primary Link: Release Field**
```json
{
  "release": "da39a3ee5e6b4b0d3255bfef95601890afd80709"  // OR
  "release": "my-app@1.0.0"  // Semantic version
}
```

**Commit Association:**
```json
{
  "statusDetails": {
    "inCommit": {
      "repository": "owner/repo",
      "commit": "abc123..."
    }
  }
}
```

**Stack Trace File Paths:**
```json
{
  "frames": [{
    "filename": "src/auth/login.ts",
    "abs_path": "/home/runner/work/repo/src/auth/login.ts",
    "lineno": 42,
    "in_app": true
  }]
}
```

#### Sentry Webhook Event Types

| Event | Trigger | Key Fields |
|-------|---------|------------|
| `issue.created` | New error | `issue.id`, `issue.shortId`, `release` |
| `issue.resolved` | Issue closed | `statusDetails.inCommit` |
| `error.created` | Each error event | `event_id`, `release`, stack frames |
| `issue_alert.triggered` | Alert rule fires | `event.release` |

#### Sentry → Vercel Linkage

**Via Environment:**
- Sentry `environment` field matches Vercel deployment target
- `release` can encode deployment ID or commit SHA

### 4. Linear → GitHub Linkages

#### Current State

**No Linear webhook integration exists** in main codebase. Only stub code in a git worktree.

**Existing Code:**
- Stub at `worktrees/console-db-deploy/packages/console-webhooks/src/linear.ts`
- Research at `thoughts/shared/research/2025-12-10-linear-integration-research.md`
- UI icon ready at `packages/ui/src/components/integration-icons.tsx:112`

#### How Linear Links to GitHub

**Branch Name Convention:**
- User creates branch from Linear: `ENG-123-feature-name`
- Linear issue ID embedded in branch name

**PR/Commit References:**
- Linear uses "magic words" in PR titles/descriptions: `fixes ENG-123`
- Creates attachments linking to GitHub PRs

**Webhook Payload Structure:**
```json
{
  "action": "create" | "update" | "remove",
  "type": "Issue",
  "data": {
    "id": "uuid",
    "number": 123,
    "teamId": "uuid",
    "projectId": "uuid",
    "cycleId": "uuid"
  }
}
```

**Note:** GitHub branch/PR info is NOT directly in Linear webhook payloads. Must query Linear's GraphQL API for attachments or parse branch names.

### 5. SourceReference Type System

#### Current Definition (`source-event.ts:52-68`)

```typescript
export interface SourceReference {
  type: "commit" | "branch" | "pr" | "issue" | "deployment" |
        "project" | "cycle" | "assignee" | "reviewer" | "team" | "label";
  id: string;
  url?: string;
  label?: string;  // Relationship qualifier: "fixes", "closes", "blocks"
}
```

#### Reference Type Usage

| Type | Source | ID Format | URL Pattern |
|------|--------|-----------|-------------|
| `commit` | GitHub, Vercel | 40-char SHA | `github.com/{org}/{repo}/commit/{sha}` |
| `branch` | GitHub, Vercel | Branch name | `github.com/{org}/{repo}/tree/{branch}` |
| `pr` | GitHub | `#123` | PR's html_url |
| `issue` | GitHub | `#42` | Issue's html_url |
| `deployment` | Vercel | Deployment ID | `https://{url}` |
| `project` | Vercel | Project ID | - |
| `cycle` | Linear (future) | Cycle UUID | - |
| `assignee` | GitHub | Username | `github.com/{username}` |
| `reviewer` | GitHub | Username | `github.com/{username}` |
| `label` | GitHub | Label name | - |
| `team` | (unused) | - | - |

## Shared Identifier Matrix

| Identifier | GitHub | Vercel | Sentry | Linear | Format |
|------------|--------|--------|--------|--------|--------|
| Commit SHA | `after`, `head.sha` | `meta.githubCommitSha` | `release` | Via branch parsing | 40-char hex |
| Branch | `ref`, `head.ref` | `meta.githubCommitRef` | - | Issue ID in branch | String |
| Repository | `repository.full_name` | `meta.githubOrg/Repo` | Stack trace paths | Via GitHub integration | `org/repo` |
| PR Number | `pull_request.number` | - | Via commit message | Issue ID | Integer |
| Issue Number | `issue.number` | - | Issue shortId | `issue.number` | Integer |
| Environment | - | `target` | `environment` | - | String |
| User Email | `pusher.email` | - | Author email | - | Email |
| Username | `*.login` | `meta.githubCommitAuthorLogin` | Via commits API | `actor.name` | String |

## Causal Event Chains

### Chain 1: Developer Pushes Commit

```
┌──────────────────────┐
│ git push origin main │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ GitHub push event                                                        │
│ • commit SHA: abc123                                                     │
│ • branch: main                                                           │
│ • author: developer@example.com                                          │
│ • timestamp: T₀                                                          │
└──────────────────────────────────────────────────────────────────────────┘
           │
           ├───────────────────────────────────────┐
           ▼                                       ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ Vercel deployment.created       │   │ Sentry release (if configured) │
│ • meta.githubCommitSha: abc123  │   │ • release: abc123               │
│ • target: production            │   │ • environment: prod             │
│ • timestamp: T₀ + ~30s          │   │ • timestamp: T₀ + ~1s           │
└─────────────────────────────────┘   └─────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Vercel deployment.succeeded     │
│ • deploymentId: dpl_xyz         │
│ • url: my-app-abc123.vercel.app │
│ • timestamp: T₀ + ~90s          │
└─────────────────────────────────┘
```

**Link Resolution:**
- Match events by `commit SHA` across GitHub/Vercel/Sentry
- Use timestamp ordering to establish causality
- Typical latency: GitHub → Vercel ≈ 30-90s

### Chain 2: PR Merged to Production

```
┌─────────────────────────────────────┐
│ GitHub pull_request.closed          │
│ • merged: true                      │
│ • head.sha: feature-abc123          │
│ • merge_commit_sha: merged-def456   │ ← NOT CURRENTLY EXTRACTED
│ • base.ref: main                    │
│ • linked issues: fixes #42          │
│ • timestamp: T₀                     │
└─────────────────────────────────────┘
           │
           ├─────────────────────────────────────────────────┐
           ▼                                                 ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│ GitHub push event (main)        │         │ Linear issue status change      │
│ • after: merged-def456          │         │ • via GitHub sync               │
│ • timestamp: T₀ + ~1s           │         │ • issue moved to "Done"         │
└─────────────────────────────────┘         │ • timestamp: T₀ + ~5s           │
           │                                └─────────────────────────────────┘
           ▼
┌─────────────────────────────────┐
│ Vercel deployment.created       │
│ • meta.githubCommitSha: def456  │
│ • target: production            │
└─────────────────────────────────┘
```

**Link Resolution:**
- PR `merge_commit_sha` → Push `after` → Vercel `githubCommitSha`
- PR linked issues → Linear issue (via Linear's GitHub sync)
- Gap: `merge_commit_sha` not currently extracted

### Chain 3: Sentry Error → Root Cause

```
┌─────────────────────────────────────┐
│ Sentry issue.created                │
│ • release: def456                   │
│ • file: src/auth/login.ts:42        │
│ • environment: production           │
│ • timestamp: T₀                     │
└─────────────────────────────────────┘
           │
           │ Query: Which commit introduced the bug?
           ▼
┌─────────────────────────────────────┐
│ Match: Vercel deployment            │
│ • githubCommitSha: def456           │
│ • deploymentUrl: my-app.vercel.app  │
└─────────────────────────────────────┘
           │
           │ Query: Which PR?
           ▼
┌─────────────────────────────────────┐
│ Match: GitHub PR (via commit)       │
│ • merge_commit_sha: def456          │
│ • prNumber: #123                    │
│ • author: developer                 │
│ • changed_files: src/auth/login.ts  │
└─────────────────────────────────────┘
           │
           │ Suspect commits analysis
           ▼
┌─────────────────────────────────────┐
│ Sentry suspect commits              │
│ • Uses patch_set from releases API  │
│ • Matches stack trace file paths    │
│ • Suggests: commit abc123 by dev    │
└─────────────────────────────────────┘
```

**Link Resolution:**
- Sentry `release` → GitHub commit SHA
- Sentry stack trace `filename` → GitHub file in commit
- Requires: Release API integration with `patch_set` data

## Gap Analysis

### Currently Extracted vs Available

#### GitHub Transformer Gaps

| Field | Currently Extracted | Available | Impact |
|-------|---------------------|-----------|--------|
| `merge_commit_sha` | No | Yes | **HIGH** - Links merged code to deployments |
| `base.sha` | No | Yes | Medium - Diff computation |
| `compare` URL | No | Yes | Low - Direct diff link |
| `commits[].id` | No | Yes | Medium - Individual commit tracking |
| `mergeable_state` | No | Yes | Low - PR status |
| `review_comments` | No | Yes | Low - Activity metrics |

#### Vercel Transformer Gaps

| Field | Currently Extracted | Available | Impact |
|-------|---------------------|-----------|--------|
| `githubCommitAuthorLogin` | No | Yes | Medium - Reliable user ID |
| `githubCommitRepoId` | No | Yes | Low - Numeric reference |
| `target` (direct) | Inferred | Yes | Low - Already inferred |
| Build timing fields | No | Yes | Medium - Performance tracking |

### Missing Integrations

| Integration | Status | Required For | Priority |
|-------------|--------|--------------|----------|
| **Sentry webhooks** | Not implemented | Error → commit linkage | HIGH |
| **Linear webhooks** | Stub only | Issue → PR linkage | MEDIUM |
| **GitHub deployment_status** | Not handled | CI/CD tracking | LOW |
| **GitHub check_run/suite** | Not handled | Test status | LOW |

## Link Resolution Algorithm

### Proposed Algorithm for Out-of-Order Events

```typescript
interface LinkableEvent {
  source: "github" | "vercel" | "sentry" | "linear";
  timestamp: Date;
  identifiers: {
    commitSha?: string;
    branchName?: string;
    prNumber?: number;
    issueNumber?: number;
    deploymentId?: string;
    releaseVersion?: string;
    repoFullName?: string;
  };
}

function resolveLinks(event: LinkableEvent): LinkedEvent[] {
  const links: LinkedEvent[] = [];

  // 1. Primary link: Commit SHA (strongest)
  if (event.identifiers.commitSha) {
    // Find all events with same SHA
    const sameCommit = findByCommitSha(event.identifiers.commitSha);
    links.push(...sameCommit);
  }

  // 2. Secondary link: Branch + Repo (for preview deployments)
  if (event.identifiers.branchName && event.identifiers.repoFullName) {
    const sameBranch = findByBranchAndRepo(
      event.identifiers.branchName,
      event.identifiers.repoFullName
    );
    // Only link if timestamps are within reasonable window (e.g., 1 hour)
    links.push(...sameBranch.filter(e =>
      Math.abs(e.timestamp - event.timestamp) < 3600000
    ));
  }

  // 3. Tertiary link: Parse identifiers from text
  // - Linear issue ID in branch name: ENG-123-feature
  // - GitHub issue in commit message: fixes #42
  const parsed = parseEmbeddedIdentifiers(event);
  if (parsed.linearIssueId) {
    links.push(...findByLinearIssue(parsed.linearIssueId));
  }

  return deduplicateAndRank(links);
}
```

### Minimum Identifier Set

For complete cross-source linking, each event should extract:

1. **Commit SHA** (when available) - Primary link
2. **Branch name** - Secondary link for preview deployments
3. **Repository full name** - Namespace for all identifiers
4. **Timestamp** - For ordering and windowed matching
5. **Actor identifier** - Email or username for people linking

## API Enrichment Options

### Fields Requiring API Calls

| Field | API Required | Endpoint |
|-------|--------------|----------|
| Commit parents | GitHub API | `GET /repos/{owner}/{repo}/commits/{sha}` |
| PR from commit | GitHub API | `GET /repos/{owner}/{repo}/commits/{sha}/pulls` |
| Release commits | Sentry API | `GET /api/0/projects/{org}/{project}/releases/{version}/commits/` |
| Linear attachments | Linear GraphQL | `query { issue(id: "...") { attachments { ... } } }` |

### Enrichment Strategy

1. **Webhook-time enrichment**: Avoid - adds latency, may fail
2. **Async enrichment**: Preferred - Inngest workflow after capture
3. **On-demand enrichment**: For queries requiring extra data

## Code References

### Key Implementation Files

- `packages/console-webhooks/src/transformers/github.ts` - GitHub event transformation
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel event transformation
- `packages/console-webhooks/src/vercel.ts` - Vercel payload types and verification
- `packages/console-types/src/neural/source-event.ts` - SourceEvent and SourceReference types
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` - GitHub webhook handler
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Vercel webhook handler
- `api/console/src/inngest/workflow/neural/entity-extraction-patterns.ts:170-210` - Reference to entity conversion

### Related Research Documents

- `thoughts/shared/research/2025-12-13-neural-memory-cross-source-architectural-gaps.md` - Architectural gaps and proposed solutions
- `thoughts/shared/research/2025-12-13-neural-memory-v1-gap-analysis.md` - V1 implementation status
- `thoughts/shared/research/2025-12-10-linear-integration-research.md` - Linear API/webhook research
- `thoughts/shared/research/2025-12-10-sentry-integration-research.md` - Sentry integration research
- `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md` - Transformer patterns
- `thoughts/shared/research/2025-12-12-source-integration-schema-unification.md` - Schema unification

## Success Criteria Answers

### 1. Given a Vercel deployment, how do we find the GitHub PR that triggered it?

**Current:** Not directly possible
**Path:**
1. Get `meta.githubCommitSha` from Vercel deployment
2. Query GitHub: `GET /repos/{owner}/{repo}/commits/{sha}/pulls`
3. Returns associated PR(s)

**Alternative:** For preview deployments, parse branch name from `meta.githubCommitRef` and match to PR head ref.

### 2. Given a Sentry error, how do we find the commit and deployment that introduced it?

**Current:** Not implemented (no Sentry webhooks)
**Path (when implemented):**
1. Get `release` from Sentry event (should be commit SHA)
2. Match to GitHub push event by SHA
3. Match to Vercel deployment by `meta.githubCommitSha`

### 3. Given a GitHub commit, how do we find all deployments and errors related to it?

**Current:** Partially possible
**Path:**
1. Query observations by `sourceReferences[].type = 'commit' AND id = {sha}`
2. Returns: Vercel deployments, future Sentry errors

### 4. What's the minimum set of identifiers needed to link all sources?

1. **Commit SHA** (40-char) - Links GitHub ↔ Vercel ↔ Sentry
2. **Repository full name** (org/repo) - Namespace for all identifiers
3. **Branch name** - Links GitHub PRs ↔ Vercel preview deployments
4. **Issue/PR number** - Links GitHub ↔ Linear (via naming conventions)

### 5. What's the algorithm to resolve links when events arrive out of order?

See "Link Resolution Algorithm" section above. Key strategies:
1. Commit SHA matching (strongest link)
2. Branch + repo + time window matching
3. Embedded identifier parsing (Linear ID in branch, issue # in commit)
4. Deduplication and confidence ranking

## Strategic Assessment: Is Cross-Source Linkage Worth Implementing?

### What You Already Have (Without Explicit Linking)

**Semantic search gets you 80% of the way:**
- Ask "what happened with the auth system" → finds GitHub commits, PRs, Vercel deployments mentioning auth
- Ask "what did @developer work on" → actor resolution already groups their activity
- Commit SHA appears in both GitHub and Vercel observations → vector similarity naturally clusters them

**The neural memory system already works** because:
1. Same commit SHA appears in GitHub push + Vercel deployment → embedding similarity
2. Same branch name mentioned across events → semantic clustering
3. Same file paths in changes → topical relevance

### What Explicit Cross-Linking Adds

| Capability | Without Links | With Links |
|------------|---------------|------------|
| "Show related events" | Semantic similarity (fuzzy) | Direct graph traversal (precise) |
| "What caused this error?" | LLM inference from context | Deterministic: error → commit → PR |
| "Impact of this PR" | Search + guess | Exact: PR → deployments → errors |

**The honest answer:** Cross-source linking is primarily useful for **causal reasoning** - "this caused that" rather than "these are related".

### When Cross-Source Linking Matters

**High value scenarios:**
- Incident response: "Why did prod break?" → need Sentry → deployment → PR chain
- Blame/attribution: "Who introduced this bug?" → need error → commit mapping
- Release tracking: "What's in this release?" → need deployment → commits → PRs

**Low value scenarios:**
- General context gathering ("what's happening on the project")
- Developer activity summaries
- Documentation/knowledge queries

### Recommendation: Don't Prioritize Now

**Reasons to defer:**

1. **Missing integrations:** No Sentry/Linear webhooks yet - the linking system would be incomplete anyway
2. **Semantic search + LLM inference** can handle most queries without explicit links
3. **Commit SHA already appears in both GitHub and Vercel** - a simple query can find related events
4. **Implementation cost is non-trivial** - link resolution algorithm, out-of-order handling, deduplication

**Low-effort improvements worth doing:**
- Extract `merge_commit_sha` from PRs (1 line change in transformer)
- Ensure consistent SHA format (full 40-char vs 7-char)
- Let the LLM do relationship inference at query time

**When to revisit this decision:**
- When Sentry webhooks are implemented (error attribution becomes critical)
- When users explicitly ask "what deployment caused this error"
- When semantic search gives too many false positives for cross-source queries

### Value Assessment Summary

| Feature | Implementation Effort | Value Without Sentry/Linear | Value With All Sources |
|---------|----------------------|-----------------------------|-----------------------|
| Explicit link graph | HIGH | LOW | HIGH |
| Link resolution algorithm | MEDIUM | LOW | MEDIUM |
| `merge_commit_sha` extraction | LOW | MEDIUM | HIGH |
| Semantic search (current) | DONE | HIGH | HIGH |

**Bottom line:** The research documents what's *possible* and *how* to do it when needed. The current semantic search + LLM inference approach is sufficient for V1. Explicit cross-source linking becomes valuable when:
1. Sentry integration exists (error → code attribution)
2. Users need deterministic causal queries (not just "related" but "caused by")

## Open Questions

1. **Merge commit tracking:** Should we add `merge_commit_sha` extraction to PR transformer?
2. **Sentry integration priority:** When should Sentry webhooks be implemented?
3. **Linear branch parsing:** Should we extract Linear issue IDs from branch names automatically?
4. **API enrichment limits:** What rate limits apply to GitHub/Linear/Sentry APIs for enrichment?
5. **Identifier normalization:** Should commit SHAs be stored full (40-char) or abbreviated (7-char)?
