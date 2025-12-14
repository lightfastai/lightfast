# Console Test Data Pre-Transformed Webhooks Implementation Plan

## Overview

Refactor `@repo/console-test-data` to use pre-transformed webhook payloads (raw GitHub/Vercel format) that flow through production transformers. This replaces the current post-transformed SourceEvent approach with raw webhooks, ensuring test data exercises the same transformation pipeline as production.

## Current State Analysis

### Existing Architecture
```
packages/console-test-data/
├── datasets/
│   ├── schema.json          # SourceEvent schema (to be replaced)
│   ├── security.json        # Post-transformed events (to be replaced)
│   └── performance.json     # Post-transformed events (to be replaced)
├── src/
│   ├── loader/index.ts      # Loads SourceEvents directly (to be modified)
│   ├── trigger/             # Unchanged
│   ├── verifier/            # Unchanged
│   └── cli/                 # Unchanged
└── package.json
```

### Key Discoveries
| File | Line | Description |
|------|------|-------------|
| `packages/console-webhooks/src/transformers/index.ts` | 1-2 | Exports all GitHub and Vercel transformers |
| `packages/console-webhooks/src/transformers/github.ts` | 18-430 | GitHub transformers for push, PR, issue, release, discussion |
| `packages/console-webhooks/src/transformers/vercel.ts` | 15-136 | Vercel deployment transformer |
| `packages/console-types/src/neural/source-event.ts` | 73-76 | TransformContext interface |
| `packages/console-test-data/src/loader/index.ts` | 88-111 | Current loadDataset function |

## Desired End State

```
packages/console-test-data/
├── datasets/
│   ├── webhook-schema.json  # NEW: Raw webhook payload schema
│   ├── security.json        # REPLACED: Raw webhook format
│   └── performance.json     # REPLACED: Raw webhook format
├── src/
│   ├── loader/
│   │   ├── index.ts         # MODIFIED: Re-exports
│   │   ├── dataset.ts       # NEW: Dataset loading
│   │   └── transform.ts     # NEW: Transformer integration
│   ├── trigger/             # Unchanged
│   ├── verifier/            # Unchanged
│   └── cli/                 # Unchanged
└── package.json             # MODIFIED: Add @repo/console-webhooks
```

### Verification
- `pnpm --filter @repo/console-test-data typecheck` passes
- `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index>` triggers events through transformers
- Events in database match what production transformers would produce

## What We're NOT Doing

- **NOT providing helper utilities** - Full webhook objects required in test data
- **NOT supporting backward compatibility** - Clean break from SourceEvent format
- **NOT injecting timestamps** - Complete timestamps required in raw payloads
- **NOT adding runtime validation** - Trust test data matches expected types

## Implementation Approach

Complete replacement: delete current SourceEvent schema and datasets, create new webhook schema and datasets, update loader to route through transformers.

---

## Phase 1: Add Dependency and Create Transform Module

### Overview
Add `@repo/console-webhooks` dependency and create the transform module that routes payloads to transformers.

### Changes Required

#### 1. Update package.json
**File**: `packages/console-test-data/package.json`
**Changes**: Add console-webhooks dependency

```json
{
  "dependencies": {
    "@api/console": "workspace:*",
    "@db/console": "workspace:*",
    "@repo/console-pinecone": "workspace:*",
    "@repo/console-types": "workspace:*",
    "@repo/console-validation": "workspace:*",
    "@repo/console-webhooks": "workspace:*",
    "drizzle-orm": "catalog:"
  }
}
```

#### 2. Create transform module
**File**: `packages/console-test-data/src/loader/transform.ts`

```typescript
/**
 * Webhook Transformer Integration
 *
 * Routes raw webhook payloads through production transformers.
 */

import type { SourceEvent, TransformContext } from "@repo/console-types";
import {
  transformGitHubPush,
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformGitHubDiscussion,
  transformVercelDeployment,
} from "@repo/console-webhooks/transformers";
import type {
  PushEvent,
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "@octokit/webhooks-types";
import type {
  VercelWebhookPayload,
  VercelDeploymentEvent,
} from "@repo/console-webhooks";

export type GitHubEventType =
  | "push"
  | "pull_request"
  | "issues"
  | "release"
  | "discussion";

export type VercelEventType =
  | "deployment.created"
  | "deployment.succeeded"
  | "deployment.ready"
  | "deployment.canceled"
  | "deployment.error"
  | "deployment.check-rerequested";

export interface WebhookPayload {
  source: "github" | "vercel";
  eventType: string;
  payload: unknown;
}

export interface GitHubWebhookPayload extends WebhookPayload {
  source: "github";
  eventType: GitHubEventType;
  payload: PushEvent | PullRequestEvent | IssuesEvent | ReleaseEvent | DiscussionEvent;
}

export interface VercelWebhookPayloadWrapper extends WebhookPayload {
  source: "vercel";
  eventType: VercelEventType;
  payload: VercelWebhookPayload;
}

/**
 * Generate a unique delivery ID for test webhooks
 */
const generateDeliveryId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Transform a raw webhook payload to SourceEvent using production transformers
 */
export function transformWebhook(
  webhook: WebhookPayload,
  index: number
): SourceEvent {
  const context: TransformContext = {
    deliveryId: generateDeliveryId(),
    receivedAt: new Date(),
  };

  if (webhook.source === "github") {
    return transformGitHubWebhook(
      webhook as GitHubWebhookPayload,
      context,
      index
    );
  }

  if (webhook.source === "vercel") {
    return transformVercelWebhook(
      webhook as VercelWebhookPayloadWrapper,
      context,
      index
    );
  }

  throw new Error(`Unsupported source: ${webhook.source}`);
}

function transformGitHubWebhook(
  webhook: GitHubWebhookPayload,
  context: TransformContext,
  index: number
): SourceEvent {
  let event: SourceEvent;

  switch (webhook.eventType) {
    case "push":
      event = transformGitHubPush(webhook.payload as PushEvent, context);
      break;
    case "pull_request":
      event = transformGitHubPullRequest(
        webhook.payload as PullRequestEvent,
        context
      );
      break;
    case "issues":
      event = transformGitHubIssue(webhook.payload as IssuesEvent, context);
      break;
    case "release":
      event = transformGitHubRelease(webhook.payload as ReleaseEvent, context);
      break;
    case "discussion":
      event = transformGitHubDiscussion(
        webhook.payload as DiscussionEvent,
        context
      );
      break;
    default:
      throw new Error(`Unsupported GitHub event type: ${webhook.eventType}`);
  }

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}

function transformVercelWebhook(
  webhook: VercelWebhookPayloadWrapper,
  context: TransformContext,
  index: number
): SourceEvent {
  const event = transformVercelDeployment(
    webhook.payload,
    webhook.eventType as VercelDeploymentEvent,
    context
  );

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm install` completes successfully
- [x] `pnpm --filter @repo/console-test-data typecheck` passes

**Implementation Note**: Pause here for confirmation before proceeding.

---

## Phase 2: Create Webhook Dataset Schema

### Overview
Create JSON schema for raw webhook payloads with source/eventType discriminators.

### Changes Required

#### 1. Create webhook schema
**File**: `packages/console-test-data/datasets/webhook-schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://lightfast.ai/schemas/webhook-test-dataset.json",
  "title": "Webhook Test Dataset",
  "description": "Test dataset containing raw webhook payloads that flow through production transformers",
  "type": "object",
  "required": ["name", "webhooks"],
  "properties": {
    "name": {
      "type": "string",
      "description": "Dataset identifier"
    },
    "description": {
      "type": "string",
      "description": "Dataset purpose"
    },
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
          "enum": ["github", "vercel"],
          "description": "Webhook source platform"
        },
        "eventType": {
          "type": "string",
          "description": "Event type. GitHub: push, pull_request, issues, release, discussion. Vercel: deployment.created, deployment.succeeded, etc."
        },
        "payload": {
          "type": "object",
          "description": "Raw webhook payload matching the source platform's webhook format"
        }
      }
    }
  }
}
```

#### 2. Delete old schema
```bash
rm packages/console-test-data/datasets/schema.json
```

### Success Criteria

#### Automated Verification:
- [x] `cat datasets/webhook-schema.json | jq .` validates

---

## Phase 3: Convert Security Dataset to Raw Webhooks

### Overview
Replace security.json with raw webhook payloads matching GitHub/Vercel formats.

### Changes Required

#### 1. Replace security.json
**File**: `packages/console-test-data/datasets/security.json`

```json
{
  "$schema": "./webhook-schema.json",
  "name": "security",
  "description": "Security-focused webhook events for testing significance scoring and entity extraction",
  "webhooks": [
    {
      "source": "github",
      "eventType": "pull_request",
      "payload": {
        "action": "closed",
        "number": 101,
        "pull_request": {
          "id": 1234567890,
          "node_id": "PR_kwDOtest101",
          "number": 101,
          "state": "closed",
          "locked": false,
          "title": "feat(auth): Implement OAuth2 PKCE flow for secure authentication",
          "user": {
            "login": "alice",
            "id": 12345,
            "node_id": "U_alice",
            "avatar_url": "https://avatars.githubusercontent.com/u/12345",
            "type": "User",
            "site_admin": false
          },
          "body": "## Summary\nImplements PKCE (Proof Key for Code Exchange) extension to OAuth2 flow.\nThis prevents authorization code interception attacks.\n\n## Changes\n- Added PKCE challenge generation in `src/lib/auth/pkce.ts`\n- Updated OAuth callback to verify code_verifier\n- Added @security-team as reviewer for audit\n\n## Security Impact\n- Mitigates CVE-2019-XXXX class vulnerabilities\n- Required for mobile clients per IETF RFC 7636\n\nFixes #45",
          "created_at": "2024-01-10T10:00:00Z",
          "updated_at": "2024-01-12T15:30:00Z",
          "closed_at": "2024-01-12T15:30:00Z",
          "merged_at": "2024-01-12T15:30:00Z",
          "merge_commit_sha": "abc123def456789",
          "assignee": null,
          "assignees": [],
          "requested_reviewers": [
            {
              "login": "security-team",
              "id": 99999,
              "node_id": "U_security",
              "avatar_url": "https://avatars.githubusercontent.com/u/99999",
              "type": "User",
              "site_admin": false
            }
          ],
          "requested_teams": [],
          "labels": [
            { "id": 1, "node_id": "L_1", "name": "security", "color": "ff0000", "default": false },
            { "id": 2, "node_id": "L_2", "name": "auth", "color": "0000ff", "default": false }
          ],
          "milestone": null,
          "draft": false,
          "commits": 3,
          "additions": 150,
          "deletions": 20,
          "changed_files": 5,
          "head": {
            "label": "test:feature/oauth-pkce",
            "ref": "feature/oauth-pkce",
            "sha": "abc123def456",
            "user": {
              "login": "alice",
              "id": 12345,
              "node_id": "U_alice",
              "avatar_url": "https://avatars.githubusercontent.com/u/12345",
              "type": "User",
              "site_admin": false
            },
            "repo": {
              "id": 123456,
              "node_id": "R_test",
              "name": "repo",
              "full_name": "test/repo",
              "private": false,
              "owner": {
                "login": "test",
                "id": 11111,
                "node_id": "O_test",
                "avatar_url": "https://avatars.githubusercontent.com/u/11111",
                "type": "Organization",
                "site_admin": false
              },
              "html_url": "https://github.com/test/repo",
              "description": "Test repository",
              "fork": false,
              "url": "https://api.github.com/repos/test/repo",
              "created_at": "2023-01-01T00:00:00Z",
              "updated_at": "2024-01-12T15:30:00Z",
              "pushed_at": "2024-01-12T15:30:00Z",
              "homepage": null,
              "size": 1000,
              "stargazers_count": 50,
              "watchers_count": 50,
              "language": "TypeScript",
              "forks_count": 10,
              "open_issues_count": 5,
              "default_branch": "main",
              "topics": [],
              "visibility": "public"
            }
          },
          "base": {
            "label": "test:main",
            "ref": "main",
            "sha": "000000000000",
            "user": {
              "login": "test",
              "id": 11111,
              "node_id": "O_test",
              "avatar_url": "https://avatars.githubusercontent.com/u/11111",
              "type": "Organization",
              "site_admin": false
            },
            "repo": {
              "id": 123456,
              "node_id": "R_test",
              "name": "repo",
              "full_name": "test/repo",
              "private": false,
              "owner": {
                "login": "test",
                "id": 11111,
                "node_id": "O_test",
                "avatar_url": "https://avatars.githubusercontent.com/u/11111",
                "type": "Organization",
                "site_admin": false
              },
              "html_url": "https://github.com/test/repo",
              "description": "Test repository",
              "fork": false,
              "url": "https://api.github.com/repos/test/repo",
              "created_at": "2023-01-01T00:00:00Z",
              "updated_at": "2024-01-12T15:30:00Z",
              "pushed_at": "2024-01-12T15:30:00Z",
              "homepage": null,
              "size": 1000,
              "stargazers_count": 50,
              "watchers_count": 50,
              "language": "TypeScript",
              "forks_count": 10,
              "open_issues_count": 5,
              "default_branch": "main",
              "topics": [],
              "visibility": "public"
            }
          },
          "html_url": "https://github.com/test/repo/pull/101",
          "diff_url": "https://github.com/test/repo/pull/101.diff",
          "patch_url": "https://github.com/test/repo/pull/101.patch",
          "merged": true,
          "mergeable": null,
          "rebaseable": null,
          "mergeable_state": "unknown",
          "merged_by": {
            "login": "alice",
            "id": 12345,
            "node_id": "U_alice",
            "avatar_url": "https://avatars.githubusercontent.com/u/12345",
            "type": "User",
            "site_admin": false
          },
          "comments": 2,
          "review_comments": 1,
          "maintainer_can_modify": false,
          "author_association": "MEMBER",
          "auto_merge": null,
          "active_lock_reason": null
        },
        "repository": {
          "id": 123456,
          "node_id": "R_test",
          "name": "repo",
          "full_name": "test/repo",
          "private": false,
          "owner": {
            "login": "test",
            "id": 11111,
            "node_id": "O_test",
            "avatar_url": "https://avatars.githubusercontent.com/u/11111",
            "type": "Organization",
            "site_admin": false
          },
          "html_url": "https://github.com/test/repo",
          "description": "Test repository",
          "fork": false,
          "url": "https://api.github.com/repos/test/repo",
          "created_at": "2023-01-01T00:00:00Z",
          "updated_at": "2024-01-12T15:30:00Z",
          "pushed_at": "2024-01-12T15:30:00Z",
          "homepage": null,
          "size": 1000,
          "stargazers_count": 50,
          "watchers_count": 50,
          "language": "TypeScript",
          "forks_count": 10,
          "open_issues_count": 5,
          "default_branch": "main",
          "topics": [],
          "visibility": "public"
        },
        "sender": {
          "login": "alice",
          "id": 12345,
          "node_id": "U_alice",
          "avatar_url": "https://avatars.githubusercontent.com/u/12345",
          "type": "User",
          "site_admin": false
        }
      }
    },
    {
      "source": "github",
      "eventType": "issues",
      "payload": {
        "action": "opened",
        "issue": {
          "id": 987654321,
          "node_id": "I_kwDOtest102",
          "number": 102,
          "title": "Critical: API keys exposed in client bundle",
          "user": {
            "login": "bob",
            "id": 23456,
            "node_id": "U_bob",
            "avatar_url": "https://avatars.githubusercontent.com/u/23456",
            "type": "User",
            "site_admin": false
          },
          "labels": [
            { "id": 3, "node_id": "L_3", "name": "security", "color": "ff0000", "default": false },
            { "id": 4, "node_id": "L_4", "name": "critical", "color": "000000", "default": false },
            { "id": 5, "node_id": "L_5", "name": "bug", "color": "d73a4a", "default": false }
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
          "author_association": "MEMBER",
          "active_lock_reason": null,
          "body": "## Problem\nFound API_KEY and JWT_SECRET exposed in the production bundle.\n\n## Steps to Reproduce\n1. Open browser DevTools\n2. Search for \"API_KEY\" in Sources\n\n## Impact\nAttackers could impersonate the server or forge JWTs.\n\n## Suggested Fix\nMove secrets to server-side environment variables.\nReference: src/config/keys.ts:15",
          "reactions": {
            "url": "https://api.github.com/repos/test/repo/issues/102/reactions",
            "total_count": 0,
            "+1": 0,
            "-1": 0,
            "laugh": 0,
            "hooray": 0,
            "confused": 0,
            "heart": 0,
            "rocket": 0,
            "eyes": 0
          },
          "html_url": "https://github.com/test/repo/issues/102",
          "timeline_url": "https://api.github.com/repos/test/repo/issues/102/timeline",
          "state_reason": null
        },
        "repository": {
          "id": 123456,
          "node_id": "R_test",
          "name": "repo",
          "full_name": "test/repo",
          "private": false,
          "owner": {
            "login": "test",
            "id": 11111,
            "node_id": "O_test",
            "avatar_url": "https://avatars.githubusercontent.com/u/11111",
            "type": "Organization",
            "site_admin": false
          },
          "html_url": "https://github.com/test/repo",
          "description": "Test repository",
          "fork": false,
          "url": "https://api.github.com/repos/test/repo",
          "created_at": "2023-01-01T00:00:00Z",
          "updated_at": "2024-01-11T09:00:00Z",
          "pushed_at": "2024-01-11T09:00:00Z",
          "homepage": null,
          "size": 1000,
          "stargazers_count": 50,
          "watchers_count": 50,
          "language": "TypeScript",
          "forks_count": 10,
          "open_issues_count": 6,
          "default_branch": "main",
          "topics": [],
          "visibility": "public"
        },
        "sender": {
          "login": "bob",
          "id": 23456,
          "node_id": "U_bob",
          "avatar_url": "https://avatars.githubusercontent.com/u/23456",
          "type": "User",
          "site_admin": false
        }
      }
    },
    {
      "source": "github",
      "eventType": "push",
      "payload": {
        "ref": "refs/heads/main",
        "before": "aaa111bbb222",
        "after": "def789abc012",
        "created": false,
        "deleted": false,
        "forced": false,
        "base_ref": null,
        "compare": "https://github.com/test/repo/compare/aaa111bbb222...def789abc012",
        "commits": [
          {
            "id": "def789abc012",
            "tree_id": "tree123",
            "distinct": true,
            "message": "fix(security): Rotate compromised credentials\n\n- Regenerated DATABASE_URL with new password\n- Updated Redis connection string\n- Invalidated all existing JWT tokens\n\nBREAKING: All users will need to re-authenticate",
            "timestamp": "2024-01-12T16:00:00Z",
            "url": "https://github.com/test/repo/commit/def789abc012",
            "author": {
              "name": "charlie",
              "email": "charlie@example.com",
              "username": "charlie"
            },
            "committer": {
              "name": "charlie",
              "email": "charlie@example.com",
              "username": "charlie"
            },
            "added": ["src/config/new-secrets.ts"],
            "removed": [],
            "modified": ["src/config/database.ts", "src/config/redis.ts"]
          }
        ],
        "head_commit": {
          "id": "def789abc012",
          "tree_id": "tree123",
          "distinct": true,
          "message": "fix(security): Rotate compromised credentials\n\n- Regenerated DATABASE_URL with new password\n- Updated Redis connection string\n- Invalidated all existing JWT tokens\n\nBREAKING: All users will need to re-authenticate",
          "timestamp": "2024-01-12T16:00:00Z",
          "url": "https://github.com/test/repo/commit/def789abc012",
          "author": {
            "name": "charlie",
            "email": "charlie@example.com",
            "username": "charlie"
          },
          "committer": {
            "name": "charlie",
            "email": "charlie@example.com",
            "username": "charlie"
          },
          "added": ["src/config/new-secrets.ts"],
          "removed": [],
          "modified": ["src/config/database.ts", "src/config/redis.ts"]
        },
        "repository": {
          "id": 123456,
          "node_id": "R_test",
          "name": "repo",
          "full_name": "test/repo",
          "private": false,
          "owner": {
            "login": "test",
            "id": 11111,
            "node_id": "O_test",
            "avatar_url": "https://avatars.githubusercontent.com/u/11111",
            "type": "Organization",
            "site_admin": false
          },
          "html_url": "https://github.com/test/repo",
          "description": "Test repository",
          "fork": false,
          "url": "https://api.github.com/repos/test/repo",
          "created_at": "2023-01-01T00:00:00Z",
          "updated_at": "2024-01-12T16:00:00Z",
          "pushed_at": "2024-01-12T16:00:00Z",
          "homepage": null,
          "size": 1000,
          "stargazers_count": 50,
          "watchers_count": 50,
          "language": "TypeScript",
          "forks_count": 10,
          "open_issues_count": 5,
          "default_branch": "main",
          "topics": [],
          "visibility": "public",
          "master_branch": "main"
        },
        "pusher": {
          "name": "charlie",
          "email": "charlie@example.com"
        },
        "sender": {
          "login": "charlie",
          "id": 34567,
          "node_id": "U_charlie",
          "avatar_url": "https://avatars.githubusercontent.com/u/34567",
          "type": "User",
          "site_admin": false
        }
      }
    }
  ]
}
```

### Success Criteria

#### Automated Verification:
- [x] `cat datasets/security.json | jq .` validates

---

## Phase 4: Convert Performance Dataset to Raw Webhooks

### Overview
Replace performance.json with raw webhook payloads.

### Changes Required

#### 1. Replace performance.json
**File**: `packages/console-test-data/datasets/performance.json`

```json
{
  "$schema": "./webhook-schema.json",
  "name": "performance",
  "description": "Performance-focused webhook events for testing optimization-related content",
  "webhooks": [
    {
      "source": "github",
      "eventType": "pull_request",
      "payload": {
        "action": "closed",
        "number": 201,
        "pull_request": {
          "id": 2234567890,
          "node_id": "PR_kwDOtest201",
          "number": 201,
          "state": "closed",
          "locked": false,
          "title": "perf: Implement Redis caching for API responses",
          "user": {
            "login": "david",
            "id": 45678,
            "node_id": "U_david",
            "avatar_url": "https://avatars.githubusercontent.com/u/45678",
            "type": "User",
            "site_admin": false
          },
          "body": "## Summary\nAdded Redis caching layer to reduce database load.\n\n## Changes\n- New cache module at `src/lib/cache.ts`\n- Configured CACHE_TTL via environment variable\n- Added cache invalidation on writes\n\n## Performance Impact\n- GET /api/dashboard: 450ms → 45ms (90% reduction)\n- Database queries reduced by 75%\n\nTested with @david-perf",
          "created_at": "2024-01-08T10:00:00Z",
          "updated_at": "2024-01-10T14:00:00Z",
          "closed_at": "2024-01-10T14:00:00Z",
          "merged_at": "2024-01-10T14:00:00Z",
          "merge_commit_sha": "perf123hash789",
          "assignee": null,
          "assignees": [],
          "requested_reviewers": [],
          "requested_teams": [],
          "labels": [
            { "id": 10, "node_id": "L_10", "name": "performance", "color": "00ff00", "default": false },
            { "id": 11, "node_id": "L_11", "name": "enhancement", "color": "a2eeef", "default": false }
          ],
          "milestone": null,
          "draft": false,
          "commits": 5,
          "additions": 200,
          "deletions": 50,
          "changed_files": 8,
          "head": {
            "label": "test:feature/redis-cache",
            "ref": "feature/redis-cache",
            "sha": "perf123hash",
            "user": {
              "login": "david",
              "id": 45678,
              "node_id": "U_david",
              "avatar_url": "https://avatars.githubusercontent.com/u/45678",
              "type": "User",
              "site_admin": false
            },
            "repo": {
              "id": 234567,
              "node_id": "R_test2",
              "name": "api-service",
              "full_name": "test/api-service",
              "private": false,
              "owner": {
                "login": "test",
                "id": 11111,
                "node_id": "O_test",
                "avatar_url": "https://avatars.githubusercontent.com/u/11111",
                "type": "Organization",
                "site_admin": false
              },
              "html_url": "https://github.com/test/api-service",
              "description": "API Service",
              "fork": false,
              "url": "https://api.github.com/repos/test/api-service",
              "created_at": "2023-01-01T00:00:00Z",
              "updated_at": "2024-01-10T14:00:00Z",
              "pushed_at": "2024-01-10T14:00:00Z",
              "homepage": null,
              "size": 2000,
              "stargazers_count": 100,
              "watchers_count": 100,
              "language": "TypeScript",
              "forks_count": 20,
              "open_issues_count": 10,
              "default_branch": "main",
              "topics": [],
              "visibility": "public"
            }
          },
          "base": {
            "label": "test:main",
            "ref": "main",
            "sha": "base000000",
            "user": {
              "login": "test",
              "id": 11111,
              "node_id": "O_test",
              "avatar_url": "https://avatars.githubusercontent.com/u/11111",
              "type": "Organization",
              "site_admin": false
            },
            "repo": {
              "id": 234567,
              "node_id": "R_test2",
              "name": "api-service",
              "full_name": "test/api-service",
              "private": false,
              "owner": {
                "login": "test",
                "id": 11111,
                "node_id": "O_test",
                "avatar_url": "https://avatars.githubusercontent.com/u/11111",
                "type": "Organization",
                "site_admin": false
              },
              "html_url": "https://github.com/test/api-service",
              "description": "API Service",
              "fork": false,
              "url": "https://api.github.com/repos/test/api-service",
              "created_at": "2023-01-01T00:00:00Z",
              "updated_at": "2024-01-10T14:00:00Z",
              "pushed_at": "2024-01-10T14:00:00Z",
              "homepage": null,
              "size": 2000,
              "stargazers_count": 100,
              "watchers_count": 100,
              "language": "TypeScript",
              "forks_count": 20,
              "open_issues_count": 10,
              "default_branch": "main",
              "topics": [],
              "visibility": "public"
            }
          },
          "html_url": "https://github.com/test/api-service/pull/201",
          "diff_url": "https://github.com/test/api-service/pull/201.diff",
          "patch_url": "https://github.com/test/api-service/pull/201.patch",
          "merged": true,
          "mergeable": null,
          "rebaseable": null,
          "mergeable_state": "unknown",
          "merged_by": {
            "login": "david",
            "id": 45678,
            "node_id": "U_david",
            "avatar_url": "https://avatars.githubusercontent.com/u/45678",
            "type": "User",
            "site_admin": false
          },
          "comments": 3,
          "review_comments": 2,
          "maintainer_can_modify": false,
          "author_association": "MEMBER",
          "auto_merge": null,
          "active_lock_reason": null
        },
        "repository": {
          "id": 234567,
          "node_id": "R_test2",
          "name": "api-service",
          "full_name": "test/api-service",
          "private": false,
          "owner": {
            "login": "test",
            "id": 11111,
            "node_id": "O_test",
            "avatar_url": "https://avatars.githubusercontent.com/u/11111",
            "type": "Organization",
            "site_admin": false
          },
          "html_url": "https://github.com/test/api-service",
          "description": "API Service",
          "fork": false,
          "url": "https://api.github.com/repos/test/api-service",
          "created_at": "2023-01-01T00:00:00Z",
          "updated_at": "2024-01-10T14:00:00Z",
          "pushed_at": "2024-01-10T14:00:00Z",
          "homepage": null,
          "size": 2000,
          "stargazers_count": 100,
          "watchers_count": 100,
          "language": "TypeScript",
          "forks_count": 20,
          "open_issues_count": 10,
          "default_branch": "main",
          "topics": [],
          "visibility": "public"
        },
        "sender": {
          "login": "david",
          "id": 45678,
          "node_id": "U_david",
          "avatar_url": "https://avatars.githubusercontent.com/u/45678",
          "type": "User",
          "site_admin": false
        }
      }
    },
    {
      "source": "github",
      "eventType": "issues",
      "payload": {
        "action": "opened",
        "issue": {
          "id": 887654321,
          "node_id": "I_kwDOtest202",
          "number": 202,
          "title": "Dashboard loading time exceeds 5s on production",
          "user": {
            "login": "eve",
            "id": 56789,
            "node_id": "U_eve",
            "avatar_url": "https://avatars.githubusercontent.com/u/56789",
            "type": "User",
            "site_admin": false
          },
          "labels": [
            { "id": 10, "node_id": "L_10", "name": "performance", "color": "00ff00", "default": false },
            { "id": 5, "node_id": "L_5", "name": "bug", "color": "d73a4a", "default": false }
          ],
          "state": "open",
          "locked": false,
          "assignee": null,
          "assignees": [],
          "milestone": null,
          "comments": 0,
          "created_at": "2024-01-06T09:00:00Z",
          "updated_at": "2024-01-06T09:00:00Z",
          "closed_at": null,
          "author_association": "MEMBER",
          "active_lock_reason": null,
          "body": "## Problem\nThe GET /api/dashboard endpoint is taking >5 seconds on production.\n\n## Investigation\n- N+1 query detected in user list\n- No database indexes on frequently queried columns\n\n## Environment\n- Production cluster with 1000+ concurrent users\n- Redis not currently deployed",
          "reactions": {
            "url": "https://api.github.com/repos/test/api-service/issues/202/reactions",
            "total_count": 0,
            "+1": 0,
            "-1": 0,
            "laugh": 0,
            "hooray": 0,
            "confused": 0,
            "heart": 0,
            "rocket": 0,
            "eyes": 0
          },
          "html_url": "https://github.com/test/api-service/issues/202",
          "timeline_url": "https://api.github.com/repos/test/api-service/issues/202/timeline",
          "state_reason": null
        },
        "repository": {
          "id": 234567,
          "node_id": "R_test2",
          "name": "api-service",
          "full_name": "test/api-service",
          "private": false,
          "owner": {
            "login": "test",
            "id": 11111,
            "node_id": "O_test",
            "avatar_url": "https://avatars.githubusercontent.com/u/11111",
            "type": "Organization",
            "site_admin": false
          },
          "html_url": "https://github.com/test/api-service",
          "description": "API Service",
          "fork": false,
          "url": "https://api.github.com/repos/test/api-service",
          "created_at": "2023-01-01T00:00:00Z",
          "updated_at": "2024-01-06T09:00:00Z",
          "pushed_at": "2024-01-06T09:00:00Z",
          "homepage": null,
          "size": 2000,
          "stargazers_count": 100,
          "watchers_count": 100,
          "language": "TypeScript",
          "forks_count": 20,
          "open_issues_count": 11,
          "default_branch": "main",
          "topics": [],
          "visibility": "public"
        },
        "sender": {
          "login": "eve",
          "id": 56789,
          "node_id": "U_eve",
          "avatar_url": "https://avatars.githubusercontent.com/u/56789",
          "type": "User",
          "site_admin": false
        }
      }
    },
    {
      "source": "vercel",
      "eventType": "deployment.succeeded",
      "payload": {
        "id": "hook_perf123",
        "type": "deployment.succeeded",
        "createdAt": 1704988800000,
        "region": "sfo1",
        "payload": {
          "deployment": {
            "id": "dpl_perf789",
            "name": "api-service",
            "url": "api-service-abc123.vercel.app",
            "readyState": "READY",
            "meta": {
              "githubCommitSha": "perf123hash",
              "githubCommitRef": "main",
              "githubCommitMessage": "perf: enable edge runtime for API routes",
              "githubCommitAuthorName": "frank",
              "githubCommitAuthorLogin": "frank",
              "githubOrg": "test",
              "githubRepo": "api-service"
            }
          },
          "project": {
            "id": "prj_apiservice123",
            "name": "api-service"
          },
          "team": {
            "id": "team_test",
            "slug": "test-team",
            "name": "Test Team"
          }
        }
      }
    }
  ]
}
```

### Success Criteria

#### Automated Verification:
- [x] `cat datasets/performance.json | jq .` validates

---

## Phase 5: Update Loader Module

### Overview
Update the loader to use the transform module and load webhook datasets.

### Changes Required

#### 1. Replace loader/index.ts
**File**: `packages/console-test-data/src/loader/index.ts`

```typescript
/**
 * Webhook Dataset Loader
 *
 * Loads raw webhook datasets and transforms them to SourceEvents
 * using production transformers.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import type { SourceEvent } from "@repo/console-types";
import { transformWebhook, type WebhookPayload } from "./transform.js";

export interface Dataset {
  name: string;
  description?: string;
  events: SourceEvent[];
}

interface RawDataset {
  name: string;
  description?: string;
  webhooks: WebhookPayload[];
}

const getDatasetsDir = (): string => {
  return resolve(import.meta.dirname, "..", "..", "datasets");
};

/**
 * Load a dataset by name or file path
 * Transforms raw webhooks to SourceEvents using production transformers
 */
export const loadDataset = (nameOrPath: string): Dataset => {
  const datasetsDir = getDatasetsDir();

  const filePath = nameOrPath.endsWith(".json")
    ? resolve(nameOrPath)
    : join(datasetsDir, `${nameOrPath}.json`);

  if (!existsSync(filePath)) {
    throw new Error(`Dataset not found: ${filePath}`);
  }

  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as RawDataset;

  if (!raw.name) throw new Error(`Dataset missing: name`);
  if (!Array.isArray(raw.webhooks) || raw.webhooks.length === 0) {
    throw new Error(`Dataset must have at least one webhook`);
  }

  // Transform webhooks to SourceEvents using production transformers
  const events = raw.webhooks.map((webhook, index) =>
    transformWebhook(webhook, index)
  );

  return {
    name: raw.name,
    description: raw.description,
    events,
  };
};

/**
 * List available dataset names
 */
export const listDatasets = (): string[] => {
  const datasetsDir = getDatasetsDir();
  if (!existsSync(datasetsDir)) return [];

  return readdirSync(datasetsDir)
    .filter((f) => f.endsWith(".json") && !f.includes("schema"))
    .map((f) => f.replace(".json", ""));
};

/**
 * Load all datasets and return combined events
 */
export const loadAllDatasets = (): SourceEvent[] => {
  const names = listDatasets();
  const events: SourceEvent[] = [];
  for (const name of names) {
    events.push(...loadDataset(name).events);
  }
  return events;
};

/**
 * Generate balanced scenario: shuffle all events, slice to count
 */
export const balancedScenario = (count: number): SourceEvent[] => {
  const all = loadAllDatasets();
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

/**
 * Generate stress scenario: repeat events to reach count
 */
export const stressScenario = (count: number): SourceEvent[] => {
  const base = loadAllDatasets();
  const events: SourceEvent[] = [];
  let stressIndex = 0;

  while (events.length < count) {
    for (const event of base) {
      if (events.length >= count) break;
      events.push({
        ...event,
        sourceId: `${event.sourceId}:stress:${stressIndex++}`,
      });
    }
  }

  return events;
};

// Re-export transform types
export type { WebhookPayload, GitHubEventType, VercelEventType } from "./transform.js";
```

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/console-test-data typecheck` passes
- [x] `pnpm --filter @repo/console-test-data lint` passes

---

## Phase 6: Final Cleanup and Testing

### Overview
Delete old schema, verify all commands work.

### Changes Required

#### 1. Delete old schema file
```bash
rm -f packages/console-test-data/datasets/schema.json
```

#### 2. Verify exports work
**File**: `packages/console-test-data/src/index.ts` - should already export from loader

### Success Criteria

#### Automated Verification:
- [x] `pnpm --filter @repo/console-test-data typecheck` passes
- [x] `pnpm --filter @repo/console-test-data lint` passes
- [x] `pnpm --filter @repo/console-test-data inject -- --help` shows help

#### Manual Verification:
- [ ] `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index>` triggers events
- [ ] Events appear in database with correct transformed structure
- [ ] Verification report shows expected counts

**Implementation Note**: Pause here for manual confirmation.

---

## Testing Strategy

### Unit Tests (Future)
- Test each transformer produces expected SourceEvent structure
- Test transform module routing logic

### Integration Tests
- Run inject with each dataset
- Verify transformed events match production transformer output

### Manual Testing Steps
1. Run: `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index> -s security`
2. Run: `pnpm --filter @repo/console-test-data inject -- -w <id> -o <org> -i <index> -s performance`
3. Verify events appear in console UI with correct formatting
4. Check that entity extraction and embeddings work as expected

## Migration Notes

- **Breaking change**: Old SourceEvent format no longer supported
- **New datasets**: Must use raw webhook payload format
- **Custom datasets**: Follow webhook-schema.json structure with full payload objects

## References

- Research: `thoughts/shared/research/2025-12-14-console-test-data-pre-transformed-webhooks.md`
- Previous plan (Option A): `thoughts/shared/plans/2025-12-14-console-test-data-option-a-refactor.md`
- GitHub transformers: `packages/console-webhooks/src/transformers/github.ts:18-430`
- Vercel transformer: `packages/console-webhooks/src/transformers/vercel.ts:15-136`
- TransformContext: `packages/console-types/src/neural/source-event.ts:73-76`
