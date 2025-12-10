---
date: 2025-12-10T07:15:16Z
researcher: Claude (Opus 4.5)
git_commit: 0239e1ff
branch: docs/neural-memory-analysis
repository: lightfast
topic: "GitHub Pull Request Integration Research"
tags: [research, integration, github, connector, pull-requests, webhooks]
status: complete
last_updated: 2025-12-10
last_updated_by: Claude (Opus 4.5)
---

# Research: GitHub Pull Request Integration for Lightfast Memory

**Date**: 2025-12-10T07:15:16Z
**Researcher**: Claude (Opus 4.5)
**Git Commit**: 0239e1ff
**Branch**: docs/neural-memory-analysis

## Research Question

Can GitHub provide webhook events and API access for Pull Request activity? How would this integrate into Lightfast's memory system?

## Summary

**Yes, GitHub PR integration is absolutely possible and well-supported.** GitHub provides:
- Comprehensive webhook events for all PR activity
- REST and GraphQL APIs for PR data
- GitHub Apps as the modern integration pattern
- Rich data perfect for AI memory (decisions, discussions, code changes)

GitHub Apps are the recommended approach (not OAuth Apps), offering better permissions, higher rate limits, and per-repository installation.

## Documentation Links

| Resource | URL |
|----------|-----|
| GitHub Apps Overview | https://docs.github.com/en/apps/overview |
| Creating GitHub Apps | https://docs.github.com/en/apps/creating-github-apps |
| Webhook Events | https://docs.github.com/en/webhooks/webhook-events-and-payloads |
| Pull Request Event | https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request |
| REST API - PRs | https://docs.github.com/en/rest/pulls |
| GraphQL API | https://docs.github.com/en/graphql |
| Rate Limits | https://docs.github.com/en/rest/rate-limit |

## Integration Type

**GitHub App** (recommended over OAuth App)

### GitHub Apps vs OAuth Apps

| Feature | GitHub Apps | OAuth Apps |
|---------|-------------|------------|
| Permissions | Fine-grained, per-resource | Broad scopes |
| Installation | Per-org or per-repo | Per-user |
| Rate Limits | Higher (5,000/hr per install) | Lower (5,000/hr per user) |
| Webhooks | Built-in | Requires manual setup |
| Token Type | Installation tokens | User tokens |
| Recommended | Yes (2025 standard) | Legacy |

## Authentication

### GitHub App Authentication Flow

1. **App Creation**: Create GitHub App in GitHub settings
2. **Installation**: User installs app on org/repos
3. **JWT Token**: App authenticates with signed JWT (private key)
4. **Installation Token**: Exchange JWT for installation access token
5. **API Access**: Use installation token for API calls

### Required Permissions

For PR integration, request these permissions:

| Permission | Access Level | Purpose |
|------------|--------------|---------|
| `pull_requests` | Read | Access PR data, diffs, comments |
| `contents` | Read | Access file contents in PRs |
| `metadata` | Read | Basic repo information |
| `issues` | Read | Linked issues (optional) |

### Token Management

- **JWT tokens**: Short-lived (10 min max), signed with private key
- **Installation tokens**: 1 hour expiry, auto-refresh needed
- **Refresh mechanism**: Generate new installation token before expiry

```typescript
// Example: Get installation token
import { createAppAuth } from "@octokit/auth-app";

const auth = createAppAuth({
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  installationId: installationId,
});

const { token } = await auth({ type: "installation" });
```

## Webhooks

### PR-Related Webhook Events

| Event | Description | Memory Use Case |
|-------|-------------|-----------------|
| `pull_request` | PR opened, closed, merged, edited, etc. | Track PR lifecycle, decisions |
| `pull_request_review` | Review submitted, edited, dismissed | Capture feedback, approval flow |
| `pull_request_review_comment` | Comments on diff lines | Technical discussions, decisions |
| `pull_request_review_thread` | Comment threads resolved/unresolved | Track resolution status |
| `issue_comment` | Comments on PR (not diff) | General discussion on PR |

### `pull_request` Event Actions

The `pull_request` event fires for these actions:

| Action | Description |
|--------|-------------|
| `opened` | New PR created |
| `closed` | PR closed (may or may not be merged) |
| `reopened` | Closed PR reopened |
| `edited` | Title or body edited |
| `assigned` / `unassigned` | Assignee changed |
| `labeled` / `unlabeled` | Labels changed |
| `review_requested` / `review_request_removed` | Reviewer changes |
| `synchronize` | New commits pushed |
| `converted_to_draft` / `ready_for_review` | Draft status changed |
| `merged` | PR merged (action within `closed`) |

### Webhook Verification

GitHub signs webhooks with HMAC-SHA256:

```typescript
import crypto from "crypto";

function verifyGitHubWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Header: X-Hub-Signature-256
```

### Payload Examples

#### `pull_request` Event (opened)

```json
{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "id": 123456789,
    "number": 42,
    "state": "open",
    "title": "Add user authentication",
    "body": "This PR implements OAuth login...",
    "user": {
      "login": "developer",
      "id": 12345
    },
    "head": {
      "ref": "feature/auth",
      "sha": "abc123..."
    },
    "base": {
      "ref": "main",
      "sha": "def456..."
    },
    "draft": false,
    "merged": false,
    "mergeable": true,
    "additions": 150,
    "deletions": 20,
    "changed_files": 5,
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  },
  "repository": {
    "id": 987654321,
    "name": "lightfast",
    "full_name": "lightfastai/lightfast"
  },
  "installation": {
    "id": 11111111
  }
}
```

#### `pull_request_review` Event

```json
{
  "action": "submitted",
  "review": {
    "id": 555555,
    "user": { "login": "reviewer" },
    "body": "LGTM! A few minor suggestions...",
    "state": "APPROVED",
    "submitted_at": "2025-01-15T12:00:00Z"
  },
  "pull_request": { "number": 42 },
  "repository": { "full_name": "lightfastai/lightfast" }
}
```

## APIs

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/repos/{owner}/{repo}/pulls` | GET | List PRs |
| `/repos/{owner}/{repo}/pulls/{pull_number}` | GET | Get single PR |
| `/repos/{owner}/{repo}/pulls/{pull_number}/files` | GET | Get changed files |
| `/repos/{owner}/{repo}/pulls/{pull_number}/commits` | GET | Get commits |
| `/repos/{owner}/{repo}/pulls/{pull_number}/reviews` | GET | Get reviews |
| `/repos/{owner}/{repo}/pulls/{pull_number}/comments` | GET | Get review comments |

### GraphQL API (Recommended for Complex Queries)

GraphQL allows fetching all PR data in a single request:

```graphql
query GetPRDetails($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      title
      body
      state
      merged
      additions
      deletions
      author { login }
      reviews(first: 10) {
        nodes {
          author { login }
          state
          body
        }
      }
      comments(first: 20) {
        nodes {
          author { login }
          body
          createdAt
        }
      }
      files(first: 100) {
        nodes {
          path
          additions
          deletions
        }
      }
      timelineItems(first: 50) {
        nodes {
          __typename
          ... on IssueComment {
            body
            author { login }
          }
        }
      }
    }
  }
}
```

### Rate Limits

| API Type | Limit | Notes |
|----------|-------|-------|
| REST (authenticated) | 5,000/hour per installation | Higher than OAuth Apps |
| GraphQL | 5,000 points/hour | Points vary by query complexity |
| Search API | 30/minute | For searching PRs |

**Recommendation**: Use GraphQL to reduce API calls and stay within limits.

## Data for Lightfast Memory

PR data is extremely valuable for AI agent context:

| Data Type | Description | Value for Memory |
|-----------|-------------|------------------|
| PR Title & Body | Description of changes | Intent, context for decisions |
| Diff/Changes | Actual code changes | What was modified and why |
| Reviews | Approval/rejection with comments | Feedback, quality concerns |
| Review Comments | Line-by-line feedback | Technical decisions, gotchas |
| Discussions | Conversation threads | Rationale, alternatives considered |
| Timeline | Sequence of events | Understanding PR evolution |
| Linked Issues | Related issues/bugs | Problem context |
| CI Status | Build/test results | Quality gates, failures |
| Merge Info | Who merged, when, to where | Deployment context |

### Memory Use Cases

1. **Code Context**: "What changes were made in the auth system recently?"
2. **Decision History**: "Why was this approach chosen over alternatives?"
3. **Expertise Mapping**: "Who reviewed the payment integration?"
4. **Pattern Recognition**: "What feedback is commonly given on PRs?"
5. **Onboarding**: "What discussions happened about the API design?"

## Recommended Implementation Approach

### Phase 1: GitHub App Setup

1. Create GitHub App in GitHub settings
2. Configure permissions (pull_requests: read, contents: read)
3. Subscribe to webhook events: `pull_request`, `pull_request_review`, `pull_request_review_comment`
4. Generate private key for authentication
5. Create installation flow UI in Lightfast console

### Phase 2: Webhook Handling

```
packages/console-webhooks/src/github.ts
├── verifyGitHubSignature()      # HMAC-SHA256 verification
├── handlePullRequest()          # Process PR events
├── handlePullRequestReview()    # Process review events
└── handlePullRequestComment()   # Process comment events
```

### Phase 3: Data Processing (Inngest)

```
api/console/src/inngest/workflow/github/
├── process-pull-request.ts      # PR opened/merged/closed
├── process-pr-review.ts         # Reviews submitted
└── process-pr-comments.ts       # Discussion processing
```

### Phase 4: Memory Storage

Transform PR data into embeddings:
- PR title + body → Document for search
- Reviews → Linked context
- Comments → Discussion threads
- File changes → Code context associations

## Platform-Specific Notes

1. **Installation vs Authorization**: GitHub Apps need both app creation AND user installation
2. **Private Key Security**: Store private key securely (not in env vars as string)
3. **Webhook Retries**: GitHub retries failed webhooks up to 3 times
4. **Large Diffs**: PRs with >300 files may need pagination
5. **Draft PRs**: Can be filtered if not needed for memory
6. **Forked PRs**: Different permissions model, consider if needed

## Comparison with Existing Connectors

Similar pattern to Vercel integration:
- OAuth/webhook hybrid approach
- Inngest for async processing
- Pinecone for vector storage

Key difference: GitHub Apps use JWT + installation tokens (vs simple OAuth)

## Related Research

- `2025-12-10-clerk-integration-research.md` - Similar webhook patterns
- `2025-12-10-planetscale-integration-research.md` - Database patterns
- `vercel-integration/multi-project-flow-audit.md` - Existing integration pattern

## Next Steps

1. **Create implementation plan**: `/create_plan github pr integration`
2. **Review Vercel connector**: Use as implementation template
3. **Design UI**: Installation flow in console settings
4. **Define data model**: How PR data maps to memory documents

## Conclusion

GitHub PR integration is not only possible but highly recommended for Lightfast's memory system. Pull requests contain rich context about:
- What code changed and why
- Who approved it and what feedback was given
- What discussions and decisions occurred

This data is invaluable for AI agents understanding a codebase's evolution and the reasoning behind technical decisions.
