---
title: Source Event Model
description: Normalized event abstraction for cross-platform observation capture
status: draft
audience: engineering
last_updated: 2025-11-27
tags: [neural-memory, implementation, events]
---

# Source Event Model

## Overview

All external events (GitHub PRs, Linear issues, Slack threads, etc.) are normalized into a standard `SourceEvent` before observation capture. This abstraction allows the neural memory system to be source-agnostic while enabling source-specific enrichment.

## Core Interface

```typescript
interface SourceEvent {
  // Identity
  id: string;                           // Unique event ID (source-specific)
  source: string;                       // 'github' | 'linear' | 'slack' | etc.
  sourceType: string;                   // 'pull_request' | 'issue' | 'message'

  // Temporal
  occurredAt: Date;                     // When event happened

  // Actor (simple, source-defined)
  actor?: {
    type: 'user' | 'bot' | 'system';
    id: string;                         // Source-specific ID
    name: string;
    metadata?: Record<string, any>;     // Email, avatar, etc.
  };

  // Content
  title?: string;                       // Short description
  body?: string;                        // Full content
  metadata: Record<string, any>;        // Source-specific fields

  // Relationships (for correlation)
  references?: {
    type: 'git_sha' | 'issue_id' | 'pr_id' | 'deployment_id' | 'user_id';
    value: string;
  }[];
}
```

## Source Enricher Pattern

Each integration source implements its own enricher to add source-specific context.

```typescript
interface SourceEnricher {
  source: string;
  enrich(event: SourceEvent): Promise<EnrichedContext>;
}

interface EnrichedContext {
  // Related entities
  filesChanged?: string[];
  reviewers?: Actor[];
  linkedIssues?: string[];

  // Additional context
  labels?: string[];
  milestone?: string;

  // extras go here ....
}
```

## Example: GitHub Enricher

```typescript
class GitHubEnricher implements SourceEnricher {
  source = 'github';

  async enrich(event: SourceEvent): Promise<EnrichedContext> {
    if (event.sourceType === 'pull_request') {
      const pr = await this.github.getPullRequest(event.id);

      return {
        filesChanged: pr.files.map(f => f.filename),
        linesChanged: pr.additions + pr.deletions,
        reviewers: pr.reviews.map(r => ({
          type: 'user',
          id: r.user.id,
          name: r.user.login
        })),
        linkedIssues: this.extractIssueReferences(pr.body),
        labels: pr.labels.map(l => l.name),
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
      };
    }

    if (event.sourceType === 'issue') {
      const issue = await this.github.getIssue(event.id);

      return {
        labels: issue.labels.map(l => l.name),
        milestone: issue.milestone?.title,
        assignees: issue.assignees.map(a => ({
          type: 'user',
          id: a.id,
          name: a.login
        })),
        commentCount: issue.comments,
      };
    }

    return {};
  }

  private extractIssueReferences(text: string): string[] {
    const matches = text.match(/#(\d+)/g) || [];
    return matches.map(m => m.slice(1));
  }
}
```

## Example: Linear Enricher

```typescript
class LinearEnricher implements SourceEnricher {
  source = 'linear';

  async enrich(event: SourceEvent): Promise<EnrichedContext> {
    if (event.sourceType === 'issue') {
      const issue = await this.linear.issue(event.id);

      return {
        labels: issue.labels.nodes.map(l => l.name),
        state: issue.state.name,
        priority: issue.priority,
        project: issue.project?.name,
        cycle: issue.cycle?.name,
        assignee: issue.assignee ? {
          type: 'user',
          id: issue.assignee.id,
          name: issue.assignee.name
        } : undefined,
        estimate: issue.estimate,
      };
    }

    return {};
  }
}
```

## Enricher Registry

```typescript
class EnricherRegistry {
  private enrichers = new Map<string, SourceEnricher>();

  register(enricher: SourceEnricher) {
    this.enrichers.set(enricher.source, enricher);
  }

  async enrich(event: SourceEvent): Promise<EnrichedContext> {
    const enricher = this.enrichers.get(event.source);

    if (!enricher) {
      console.warn(`No enricher registered for source: ${event.source}`);
      return {};
    }

    return await enricher.enrich(event);
  }
}

// Global registry
export const enricherRegistry = new EnricherRegistry();

// Register enrichers at startup
enricherRegistry.register(new GitHubEnricher());
enricherRegistry.register(new LinearEnricher());
enricherRegistry.register(new SlackEnricher());
```

## Correlation Strategies

### 1. Direct Correlation (Git SHA)

```typescript
async function findRelatedByGitSha(sha: string): Promise<Observation[]> {
  return await db.select()
    .from(workspaceNeuralObservations)
    .where(sql`
      source_references @> ${JSON.stringify([{ type: 'git_sha', value: sha }])}
    `);
}
```

**Use case:** Link deployment events to PRs

### 2. Temporal Correlation (Time Window)

```typescript
async function findRelatedByTime(
  timestamp: Date,
  windowMinutes: number = 30
): Promise<Observation[]> {
  const start = subMinutes(timestamp, windowMinutes);
  const end = addMinutes(timestamp, windowMinutes);

  return await db.select()
    .from(workspaceNeuralObservations)
    .where(
      and(
        gte(workspaceNeuralObservations.occurredAt, start),
        lte(workspaceNeuralObservations.occurredAt, end)
      )
    );
}
```

**Use case:** Find events that happened around the same time

### 3. Entity Correlation (User/Issue ID)

```typescript
async function findRelatedByReference(
  refType: string,
  refValue: string
): Promise<Observation[]> {
  return await db.select()
    .from(workspaceNeuralObservations)
    .where(sql`
      source_references @> ${JSON.stringify([{ type: refType, value: refValue }])}
    `);
}
```

**Use case:** Find all observations related to a specific issue or user

## Integration Sources

### Supported Sources

| Source | Event Types | References |
|--------|-------------|------------|
| **GitHub** | pull_request, issue, review, commit | git_sha, pr_id, issue_id, user_id |
| **Linear** | issue, comment | issue_id, user_id, project_id |
| **Slack** | message, thread_reply | thread_id, channel_id, user_id |
| **Sentry** | error, transaction | release_id, git_sha, user_id |
| **Vercel** | deployment | git_sha, deployment_id |

### Adding New Sources

To add a new integration source:

1. **Define source-specific event types:**
   ```typescript
   type AsanaEventType = 'task_created' | 'task_completed' | 'task_comment';
   ```

2. **Create enricher:**
   ```typescript
   class AsanaEnricher implements SourceEnricher {
     source = 'asana';
     async enrich(event: SourceEvent): Promise<EnrichedContext> {
       // Implement source-specific enrichment
     }
   }
   ```

3. **Register enricher:**
   ```typescript
   enricherRegistry.register(new AsanaEnricher());
   ```

4. **Map webhook events to SourceEvent:**
   ```typescript
   async function handleAsanaWebhook(payload: AsanaWebhookPayload) {
     const sourceEvent: SourceEvent = {
       id: payload.task.gid,
       source: 'asana',
       sourceType: payload.action,
       occurredAt: new Date(payload.created_at),
       actor: {
         type: 'user',
         id: payload.user.gid,
         name: payload.user.name,
       },
       title: payload.task.name,
       body: payload.task.notes,
       metadata: payload,
     };

     await captureObservation(sourceEvent);
   }
   ```

## Best Practices

### 1. Keep SourceEvent Minimal

Only include essential fields in `SourceEvent`. Put source-specific data in `metadata`.

```typescript
// ✅ Good
{
  id: 'pr_123',
  source: 'github',
  title: 'Add authentication',
  metadata: { labels: ['feature', 'security'], draft: false }
}

// ❌ Bad - don't add GitHub-specific fields to interface
{
  id: 'pr_123',
  source: 'github',
  title: 'Add authentication',
  labels: ['feature'],  // GitHub-specific, should be in metadata
  draft: false          // GitHub-specific
}
```

### 2. Use References for Correlation

Always populate `references` array for events that relate to other entities.

```typescript
// PR merged event should reference commit SHA and linked issues
{
  references: [
    { type: 'git_sha', value: 'abc123' },
    { type: 'issue_id', value: '456' },
    { type: 'issue_id', value: '789' }
  ]
}
```

### 3. Normalize Actor IDs

For actor IDs, prefer stable workspace-scoped identifiers when possible.

```typescript
// ✅ Good - stable workspace actor ID
actor: {
  type: 'user',
  id: 'workspace_user_123',  // Mapped from GitHub user
  name: 'John Doe',
  metadata: { githubId: 12345678, githubLogin: 'johndoe' }
}

// 🟡 OK - source-specific ID if no workspace mapping
actor: {
  type: 'user',
  id: 'github_12345678',
  name: 'John Doe'
}
```

### 4. Handle Missing Data Gracefully

Not all sources provide all fields. Make everything optional except core identity.

```typescript
// Minimal valid SourceEvent
{
  id: 'evt_123',
  source: 'custom_integration',
  sourceType: 'event',
  occurredAt: new Date(),
  metadata: {}
}
```

---

_Last updated: 2025-11-27_
