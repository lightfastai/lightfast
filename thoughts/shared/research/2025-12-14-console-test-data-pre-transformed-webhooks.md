---
date: 2025-12-14T00:48:50Z
researcher: Claude
git_commit: 53db66ec5b2e7d7d93241fab834628bac44edc6a
branch: feat/memory-layer-foundation
repository: lightfast
topic: "Pre-transformed webhook payloads for console-test-data"
tags: [research, codebase, console-test-data, webhooks, transformers, github, vercel]
status: complete
last_updated: 2025-12-14
last_updated_by: Claude
---

# Research: Pre-transformed Webhook Payloads for Console Test Data

**Date**: 2025-12-14T00:48:50Z
**Researcher**: Claude
**Git Commit**: 53db66ec5b2e7d7d93241fab834628bac44edc6a
**Branch**: feat/memory-layer-foundation
**Repository**: lightfast

## Research Question

How can we rework the console-test-data implementation to use pre-transformed webhook payloads (raw GitHub/Vercel format) instead of post-transformed SourceEvents, allowing test data to flow through the same transformation pipeline as production data?

## Summary

The current implementation (Option A) stores post-transformed SourceEvent objects in JSON datasets. The desired approach would store **raw webhook payloads** (matching GitHub and Vercel webhook structures) and have the test system invoke the existing transformers from `@repo/console-webhooks/src/transformers/`.

This research documents:
1. The existing transformer implementations and their input types
2. The raw webhook payload structures expected by each transformer
3. The production webhook flow from route handlers through transformers
4. A new schema design for pre-transformed test datasets

## Detailed Findings

### Transformer Architecture

The transformers in `packages/console-webhooks/src/transformers/` convert raw webhook payloads to `SourceEvent` objects.

#### GitHub Transformers (`github.ts:18-430`)

| Function | Input Type | Output |
|----------|-----------|--------|
| `transformGitHubPush` | `PushEvent` | `SourceEvent` |
| `transformGitHubPullRequest` | `PullRequestEvent` | `SourceEvent` |
| `transformGitHubIssue` | `IssuesEvent` | `SourceEvent` |
| `transformGitHubRelease` | `ReleaseEvent` | `SourceEvent` |
| `transformGitHubDiscussion` | `DiscussionEvent` | `SourceEvent` |

Input types are from `@octokit/webhooks-types` package.

#### Vercel Transformer (`vercel.ts:15-136`)

| Function | Input Types | Output |
|----------|-------------|--------|
| `transformVercelDeployment` | `VercelWebhookPayload`, `VercelDeploymentEvent` | `SourceEvent` |

Input types are defined in `packages/console-webhooks/src/vercel.ts:78-200`.

### GitHub Webhook Payload Structures

From `@octokit/webhooks-types`, these are the raw payloads GitHub sends:

#### PushEvent Structure

```typescript
interface PushEvent {
  ref: string;                    // "refs/heads/main"
  before: string;                 // Previous commit SHA
  after: string;                  // New commit SHA
  created: boolean;
  deleted: boolean;
  forced: boolean;
  compare: string;                // Comparison URL
  commits: Array<{
    id: string;
    tree_id: string;
    distinct: boolean;
    message: string;
    timestamp: string;            // ISO 8601
    url: string;
    author: { name: string; email: string; username?: string };
    committer: { name: string; email: string; username?: string };
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: { ... } | null;    // Same structure as commits[0]
  pusher: { name: string; email?: string };
  repository: Repository;         // Full repository object
  sender: User;                   // User who triggered event
  installation?: { id: number };
}
```

#### PullRequestEvent Structure

```typescript
interface PullRequestEvent {
  action: "opened" | "closed" | "reopened" | "synchronize" | "ready_for_review" | ...;
  number: number;
  pull_request: {
    id: number;
    node_id: string;
    number: number;
    state: "open" | "closed";
    locked: boolean;
    title: string;
    user: User;
    body: string | null;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    merged_at: string | null;
    merged: boolean;
    draft: boolean;
    head: { label: string; ref: string; sha: string; user: User; repo: Repository };
    base: { label: string; ref: string; sha: string; user: User; repo: Repository };
    html_url: string;
    additions: number;
    deletions: number;
    changed_files: number;
    labels: Array<{ id: number; name: string; color: string }>;
    assignees: User[];
    requested_reviewers: User[];
  };
  repository: Repository;
  sender: User;
}
```

#### IssuesEvent Structure

```typescript
interface IssuesEvent {
  action: "opened" | "edited" | "closed" | "reopened" | "assigned" | "labeled" | ...;
  issue: {
    id: number;
    node_id: string;
    number: number;
    title: string;
    user: User;
    labels: Array<{ id: number; name: string; color: string }>;
    state: "open" | "closed";
    locked: boolean;
    assignee: User | null;
    assignees: User[];
    milestone: Milestone | null;
    comments: number;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    body: string | null;
    html_url: string;
  };
  repository: Repository;
  sender: User;
}
```

#### ReleaseEvent Structure

```typescript
interface ReleaseEvent {
  action: "published" | "unpublished" | "created" | "edited" | "deleted" | ...;
  release: {
    url: string;
    id: number;
    node_id: string;
    tag_name: string;
    target_commitish: string;
    name: string | null;
    draft: boolean;
    prerelease: boolean;
    created_at: string;
    published_at: string | null;
    author: User;
    assets: Array<...>;
    body: string | null;
  };
  repository: Repository;
  sender: User;
}
```

#### DiscussionEvent Structure

```typescript
interface DiscussionEvent {
  action: "created" | "edited" | "deleted" | "answered" | "category_changed" | ...;
  discussion: {
    id: number;
    node_id: string;
    number: number;
    title: string;
    user: User;
    state: "open" | "closed";
    locked: boolean;
    comments: number;
    created_at: string;
    updated_at: string;
    body: string | null;
    category: { id: number; name: string; slug: string; emoji: string };
    answer_html_url: string | null;
    html_url: string;
  };
  repository: Repository;
  sender: User;
}
```

### Vercel Webhook Payload Structure

From `packages/console-webhooks/src/vercel.ts:78-200`:

```typescript
interface VercelWebhookPayload {
  id: string;                     // Webhook event ID
  type: VercelDeploymentEvent;    // "deployment.created" | "deployment.succeeded" | ...
  createdAt: number;              // Unix timestamp (milliseconds)
  region?: string;
  payload: {
    deployment?: {
      id: string;
      name: string;
      url?: string;
      readyState?: "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED";
      errorCode?: string;
      meta?: {
        githubCommitSha?: string;
        githubCommitRef?: string;
        githubCommitMessage?: string;
        githubCommitAuthorName?: string;
        githubCommitAuthorLogin?: string;
        githubOrg?: string;
        githubRepo?: string;
        githubDeployment?: string;
      };
    };
    project?: { id: string; name: string };
    team?: { id: string; slug?: string; name?: string };
    user?: { id: string };
  };
}
```

### Production Webhook Flow

#### GitHub Webhooks (`apps/console/src/app/(github)/api/github/webhooks/route.ts`)

```
POST /api/github/webhooks
    │
    ├─→ verifyGitHubWebhookFromHeaders(payload, headers, secret)
    │
    ├─→ Parse event type from x-github-event header
    │
    ├─→ Route by event type:
    │     push         → handlePushObservation() → transformGitHubPush()
    │     pull_request → handlePullRequestEvent() → transformGitHubPullRequest()
    │     issues       → handleIssuesEvent() → transformGitHubIssue()
    │     release      → handleReleaseEvent() → transformGitHubRelease()
    │     discussion   → handleDiscussionEvent() → transformGitHubDiscussion()
    │
    ├─→ storeWebhookPayload() - Raw payload storage
    │
    └─→ inngest.send("apps-console/neural/observation.capture", { sourceEvent })
```

#### Vercel Webhooks (`apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts`)

```
POST /api/vercel/webhooks
    │
    ├─→ verifyVercelWebhook(rawBody, signature, clientSecret)
    │
    ├─→ Parse event type from payload.type
    │
    ├─→ handleDeploymentEvent() → transformVercelDeployment()
    │
    ├─→ storeWebhookPayload() - Raw payload storage
    │
    └─→ inngest.send("apps-console/neural/observation.capture", { sourceEvent })
```

### TransformContext Interface

Both transformers receive a `TransformContext`:

```typescript
interface TransformContext {
  deliveryId: string;    // Unique webhook delivery ID
  receivedAt: Date;      // When webhook was received
}
```

## New Schema Design for Pre-Transformed Datasets

### Proposed Dataset Schema (`datasets/schema.json`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://lightfast.ai/schemas/webhook-test-dataset.json",
  "title": "Webhook Test Dataset",
  "type": "object",
  "required": ["name", "webhooks"],
  "properties": {
    "name": { "type": "string" },
    "description": { "type": "string" },
    "webhooks": {
      "type": "array",
      "items": { "$ref": "#/definitions/WebhookPayload" },
      "minItems": 1
    }
  },
  "definitions": {
    "WebhookPayload": {
      "type": "object",
      "required": ["source", "eventType", "payload"],
      "properties": {
        "source": {
          "type": "string",
          "enum": ["github", "vercel"]
        },
        "eventType": {
          "type": "string",
          "description": "GitHub: push, pull_request, issues, release, discussion. Vercel: deployment.created, deployment.succeeded, etc."
        },
        "payload": {
          "type": "object",
          "description": "Raw webhook payload matching the source's webhook format"
        },
        "occurredAt": {
          "type": "string",
          "description": "Relative timestamp like '-2d' or ISO string. Will be injected into payload."
        }
      }
    }
  }
}
```

### Example Dataset (`datasets/security.json`)

```json
{
  "$schema": "./schema.json",
  "name": "security",
  "description": "Security-focused webhook events",
  "webhooks": [
    {
      "source": "github",
      "eventType": "pull_request",
      "occurredAt": "-2d",
      "payload": {
        "action": "closed",
        "number": 101,
        "pull_request": {
          "id": 1234567890,
          "node_id": "PR_kwDOtest",
          "number": 101,
          "state": "closed",
          "locked": false,
          "title": "feat(auth): Implement OAuth2 PKCE flow",
          "user": {
            "login": "alice",
            "id": 12345,
            "avatar_url": "https://avatars.githubusercontent.com/u/12345",
            "type": "User"
          },
          "body": "## Summary\nImplements PKCE extension to OAuth2 flow.\n\n## Security Impact\n- Mitigates CVE-2019-XXXX class vulnerabilities\n\nFixes #45",
          "created_at": "2024-01-10T10:00:00Z",
          "updated_at": "2024-01-12T15:30:00Z",
          "closed_at": "2024-01-12T15:30:00Z",
          "merged_at": "2024-01-12T15:30:00Z",
          "merged": true,
          "draft": false,
          "head": {
            "label": "test:feature/oauth-pkce",
            "ref": "feature/oauth-pkce",
            "sha": "abc123def456",
            "user": { "login": "alice", "id": 12345 },
            "repo": { "id": 123456, "name": "repo", "full_name": "test/repo" }
          },
          "base": {
            "label": "test:main",
            "ref": "main",
            "sha": "000000000000",
            "user": { "login": "test-org", "id": 11111 },
            "repo": { "id": 123456, "name": "repo", "full_name": "test/repo" }
          },
          "html_url": "https://github.com/test/repo/pull/101",
          "additions": 50,
          "deletions": 20,
          "changed_files": 5,
          "labels": [
            { "id": 1, "name": "security", "color": "ff0000" },
            { "id": 2, "name": "auth", "color": "0000ff" }
          ],
          "assignees": [],
          "requested_reviewers": [
            { "login": "security-team", "id": 99999, "type": "User" }
          ]
        },
        "repository": {
          "id": 123456,
          "node_id": "R_test",
          "name": "repo",
          "full_name": "test/repo",
          "private": false,
          "owner": { "login": "test", "id": 11111, "type": "Organization" },
          "html_url": "https://github.com/test/repo",
          "default_branch": "main"
        },
        "sender": {
          "login": "alice",
          "id": 12345,
          "avatar_url": "https://avatars.githubusercontent.com/u/12345",
          "type": "User"
        }
      }
    },
    {
      "source": "github",
      "eventType": "issues",
      "occurredAt": "-1d",
      "payload": {
        "action": "opened",
        "issue": {
          "id": 987654321,
          "node_id": "I_kwDOtest",
          "number": 102,
          "title": "Critical: API keys exposed in client bundle",
          "user": {
            "login": "bob",
            "id": 23456,
            "avatar_url": "https://avatars.githubusercontent.com/u/23456",
            "type": "User"
          },
          "labels": [
            { "id": 3, "name": "security", "color": "ff0000" },
            { "id": 4, "name": "critical", "color": "000000" },
            { "id": 5, "name": "bug", "color": "d73a4a" }
          ],
          "state": "open",
          "locked": false,
          "assignee": null,
          "assignees": [],
          "milestone": null,
          "comments": 0,
          "created_at": "2024-01-11T09:00:00Z",
          "updated_at": "2024-01-11T09:00:00Z",
          "closed_at": null,
          "body": "## Problem\nFound API_KEY and JWT_SECRET exposed in the production bundle.\n\n## Impact\nAttackers could impersonate the server.\n\n## Suggested Fix\nMove secrets to server-side environment variables.",
          "html_url": "https://github.com/test/repo/issues/102"
        },
        "repository": {
          "id": 123456,
          "node_id": "R_test",
          "name": "repo",
          "full_name": "test/repo",
          "private": false,
          "owner": { "login": "test", "id": 11111, "type": "Organization" },
          "html_url": "https://github.com/test/repo",
          "default_branch": "main"
        },
        "sender": {
          "login": "bob",
          "id": 23456,
          "type": "User"
        }
      }
    },
    {
      "source": "vercel",
      "eventType": "deployment.succeeded",
      "occurredAt": "-0d",
      "payload": {
        "id": "hook_abc123",
        "type": "deployment.succeeded",
        "createdAt": 1704988800000,
        "region": "sfo1",
        "payload": {
          "deployment": {
            "id": "dpl_xyz789",
            "name": "lightfast-app",
            "url": "lightfast-app-abc123.vercel.app",
            "readyState": "READY",
            "meta": {
              "githubCommitSha": "def789abc012",
              "githubCommitRef": "main",
              "githubCommitMessage": "fix(security): Rotate compromised credentials",
              "githubCommitAuthorName": "charlie",
              "githubOrg": "test",
              "githubRepo": "repo"
            }
          },
          "project": {
            "id": "prj_lightfast123",
            "name": "lightfast-app"
          },
          "team": {
            "id": "team_abc",
            "slug": "lightfast",
            "name": "Lightfast"
          }
        }
      }
    }
  ]
}
```

### Loader Changes Required

The loader module needs to:
1. Load raw webhook payloads from JSON
2. Generate unique delivery IDs
3. Resolve relative timestamps and inject into payloads
4. Call appropriate transformer based on `source` and `eventType`
5. Return `SourceEvent[]` for injection

```typescript
// Pseudocode for new loader approach
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  // ...
} from "@repo/console-webhooks";

function processWebhook(webhook: WebhookPayload): SourceEvent {
  const deliveryId = generateDeliveryId();
  const receivedAt = resolveTimestamp(webhook.occurredAt);
  const context = { deliveryId, receivedAt };

  // Inject resolved timestamp into payload where needed
  const payload = injectTimestamp(webhook.payload, receivedAt);

  switch (webhook.source) {
    case "github":
      switch (webhook.eventType) {
        case "push": return transformGitHubPush(payload, context);
        case "pull_request": return transformGitHubPullRequest(payload, context);
        case "issues": return transformGitHubIssue(payload, context);
        case "release": return transformGitHubRelease(payload, context);
        case "discussion": return transformGitHubDiscussion(payload, context);
      }
    case "vercel":
      return transformVercelDeployment(payload, webhook.eventType, context);
  }
}
```

## Code References

- Transformer index: `packages/console-webhooks/src/transformers/index.ts:1-3`
- GitHub transformers: `packages/console-webhooks/src/transformers/github.ts:18-430`
- Vercel transformer: `packages/console-webhooks/src/transformers/vercel.ts:15-136`
- Vercel types: `packages/console-webhooks/src/vercel.ts:78-200`
- GitHub webhook types: `packages/console-octokit-github/src/webhook-types.ts:1-33`
- GitHub webhook route: `apps/console/src/app/(github)/api/github/webhooks/route.ts:452-573`
- Vercel webhook route: `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:128-192`

## Architecture Documentation

### Current Flow (Option A - Post-transformed)

```
JSON Dataset (SourceEvent format)
    │
    └─→ Loader reads JSON → Returns SourceEvent[]
              │
              └─→ Inject CLI → inngest.send("observation.capture", { sourceEvent })
```

### Proposed Flow (Pre-transformed webhooks)

```
JSON Dataset (Raw webhook format)
    │
    └─→ Loader reads JSON
              │
              ├─→ Parse source + eventType
              │
              ├─→ Call appropriate transformer:
              │     transformGitHubPush()
              │     transformGitHubPullRequest()
              │     transformVercelDeployment()
              │     etc.
              │
              └─→ Returns SourceEvent[]
                        │
                        └─→ Inject CLI → inngest.send("observation.capture", { sourceEvent })
```

### Benefits of Pre-transformed Approach

1. **Production parity**: Test data flows through exact same transformation code as production
2. **Transformer testing**: Automatically validates transformer implementations
3. **Realistic payloads**: Test datasets match actual webhook structures from GitHub/Vercel
4. **Schema validation**: Can validate test payloads against `@octokit/webhooks-types`
5. **Future-proof**: New transformer fields automatically included without schema updates

## Historical Context (from thoughts/)

- Plan: `thoughts/shared/plans/2025-12-14-console-test-data-option-a-refactor.md` - Original Option A implementation (post-transformed)
- Research: `thoughts/shared/research/2025-12-14-console-test-data-json-refactor.md` - Initial JSON refactor research
- Architecture: `thoughts/shared/research/2025-12-11-webhook-transformer-architecture.md` - Transformer architecture decisions

## Related Research

- `thoughts/shared/research/2025-12-11-github-events-neural-memory-correctness.md`
- `thoughts/shared/research/2025-12-11-neural-memory-implementation-map.md`

## Open Questions

1. **Timestamp injection**: Where in each payload type should the resolved timestamp be injected? GitHub uses different timestamp fields (`head_commit.timestamp`, `pull_request.updated_at`, etc.)

2. **Repository object generation**: Should we provide helper utilities to generate valid `repository` objects, or require full objects in test data?

3. **Type validation**: Should we add runtime validation of webhook payloads against `@octokit/webhooks-types` schemas before passing to transformers?

4. **Error handling**: How should the loader handle transformer failures (invalid payloads)?
