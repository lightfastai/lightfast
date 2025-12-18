---
title: 'Observation Pipeline, Semantic Classification, Webhook Architecture'
slug: 0-1-lightfast-neural-memory-foundation
publishedAt: '2025-12-11'
excerpt: >-
  Neural Memory foundation layer: real-time observation capture from GitHub and
  Vercel webhooks, AI-powered semantic classification with 14 engineering
  categories, and production-ready webhook architecture with signature
  verification and replay protection.
tldr: >-
  Neural Memory's foundation layer is now live. The observation pipeline
  captures engineering events from GitHub and Vercel in real-time, processes
  them through significance scoring, AI classification, and multi-view embedding
  generation. Events are automatically categorized into 14 engineering
  categories using Claude Haiku with regex fallback. The webhook architecture
  includes cryptographic signature verification, timestamp validation, and raw
  payload storage for audit trails.
infrastructure:
  - >-
    Inngest-powered observation capture workflow with 3 retries, idempotency by
    sourceId, and 10-concurrent-per-workspace limits
  - >-
    Multi-view embedding generation (title, content, summary) stored in Pinecone
    for optimized retrieval
  - >-
    Raw webhook payload storage in PlanetScale for audit trail and replay
    capability
  - >-
    Cross-source actor resolution linking Vercel deployments to GitHub user IDs
    via commit SHA
seo:
  metaDescription: >-
    Neural Memory foundation: observation pipeline captures GitHub/Vercel events
    with AI classification into 14 categories. Production webhook architecture
    with signature verification.
  focusKeyword: observation pipeline
  secondaryKeyword: webhook architecture
  faq:
    - question: What is the observation pipeline in Lightfast?
      answer: >-
        The observation pipeline captures engineering events from GitHub and
        Vercel webhooks, processes them through significance scoring and AI
        classification, generates multi-view embeddings, and stores observations
        for semantic search. Events scoring below 40/100 significance are
        filtered out.
    - question: How does semantic classification work?
      answer: >-
        Semantic classification uses Claude Haiku to categorize events into 14
        engineering categories (bug_fix, feature, refactor, security, etc.) with
        0.2 temperature for consistency. If the LLM fails, regex-based fallback
        patterns ensure reliable classification.
    - question: Which webhook sources are supported?
      answer: >-
        Currently GitHub (push, pull_request, issues, release, discussion
        events) and Vercel (deployment lifecycle events). All webhooks are
        verified via HMAC signatures and protected against replay attacks with
        5-minute timestamp validation.
_internal:
  status: published
  source_prs:
    - >-
      manual: Observation Pipeline, Semantic Classification, Webhook
      Architecture
  generated: '2025-12-17T15:28:45Z'
  fact_checked_files:
    - 'api/console/src/inngest/workflow/neural/observation-capture.ts:335-1165'
    - 'api/console/src/inngest/workflow/neural/classification.ts:1-176'
    - 'api/console/src/inngest/workflow/neural/scoring.ts:78-118'
    - 'apps/console/src/app/(github)/api/github/webhooks/route.ts:462-608'
    - 'apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts:139-214'
    - 'packages/console-webhooks/src/github.ts:77-145'
    - 'packages/console-webhooks/src/vercel.ts:281-347'
    - 'packages/console-validation/src/schemas/classification.ts:1-58'
    - 'db/console/src/schema/tables/workspace-neural-observations.ts:48-247'
  publishedAt: '2025-12-18T06:09:48.829Z'
---

**Real-time event capture, AI classification, and production-ready webhook infrastructure**

---

### Observation Pipeline

The neural observation pipeline captures engineering activity from your connected sources and transforms it into searchable memory. Events flow through significance scoring, AI classification, entity extraction, and multi-view embedding generation before storage.

**What's included:**

- **Significance scoring** filters low-value events (threshold: 40/100). High-value events like releases (75), deployment failures (70), and PR merges (60) pass through automatically. Routine commits (30) and trivial changes are filtered.
- **Multi-view embeddings** generate three vectors per observation: title-only for headline searches, full content for detailed queries, and a balanced summary view. All three are stored in Pinecone with pre-computed observation IDs for direct lookup.
- **Entity extraction** identifies API endpoints, file paths, issue references, @mentions, and environment variables from event content. Entities are deduplicated and tracked with occurrence counts.
- **Cluster assignment** groups related observations using embedding similarity (40 points), entity overlap (30 points), actor overlap (20 points), and temporal proximity (10 points). Threshold: 60/100 to join an existing cluster.

**Example: Significance Scoring**

```typescript
// Event weights (base scores)
const weights = {
  'release.published': 75,
  'deployment.error': 70,
  'pull-request.merged': 60,
  'pull-request.opened': 50,
  'issue.opened': 45,
  'deployment.succeeded': 40,
  push: 30
};

// Content signals (added to base score)
if (title.match(/breaking|security|CVE/i)) score += 20;
if (title.match(/hotfix|emergency/i)) score += 15;
if (title.match(/chore|deps|bump/i)) score -= 10;
```

**Limitations:**

- Significance threshold (40) is global; per-workspace configuration planned
- Entity extraction limited to 50 entities per observation
- Cluster lookback window is 7 days

---

### Semantic Classification

Every observation is classified into one of 14 engineering categories using Claude Haiku. Classification drives cluster organization, topic extraction, and future retrieval filtering.

**Categories:**

| Category | Description |
|----------|-------------|
| `bug_fix` | Bug fixes, patches, error corrections |
| `feature` | New features, additions, implementations |
| `refactor` | Code restructuring, cleanup |
| `documentation` | Docs, README, comments |
| `testing` | Tests, specs, coverage |
| `infrastructure` | CI/CD, pipelines, Docker |
| `security` | Security fixes, auth changes |
| `performance` | Optimizations, speed improvements |
| `incident` | Outages, emergencies, hotfixes |
| `decision` | ADRs, architecture decisions |
| `discussion` | RFCs, proposals, design discussions |
| `release` | Version releases, changelogs |
| `deployment` | Deployments, shipping to production |
| `other` | Doesn't fit other categories |

**How it works:**

1. Claude Haiku receives event details (source, type, title, body truncated to 1000 chars)
2. Returns primary category, up to 3 secondary categories, up to 5 topics, and confidence score
3. Temperature 0.2 ensures deterministic classification across runs

**Fallback:**

If the LLM fails (timeout, rate limit), regex patterns classify events by matching keywords:

```typescript
// Fallback patterns (first match wins)
const patterns = {
  bug_fix: /\bfix(es|ed|ing)?\b/i,
  feature: /\bfeat(ure)?[:\s]/i,
  security: /\bsecurity\b|CVE-\d+/i,
  // ... 10 more patterns
};
```

**Limitations:**

- Classification results (category, confidence) are not stored in database; only topics array persists
- No accuracy metrics tracked in production
- Confidence threshold (0.6) defined but not enforced

---

### Webhook Architecture

Production-ready webhook infrastructure receives events from GitHub and Vercel with cryptographic verification, replay protection, and complete audit trails.

**Supported Events:**

| Source | Events |
|--------|--------|
| GitHub | `push` (default branch), `pull_request` (opened/closed/reopened/ready_for_review), `issues` (opened/closed/reopened), `release` (published), `discussion` (created/answered) |
| Vercel | `deployment.created`, `deployment.succeeded`, `deployment.ready`, `deployment.error`, `deployment.canceled` |

**Security measures:**

- **Signature verification**: HMAC SHA-256 (GitHub) and SHA-1 (Vercel) with timing-safe comparison
- **Replay protection**: 5-minute timestamp validation window with 60-second clock skew tolerance
- **Audit trail**: Raw JSON payloads stored permanently in `workspace_webhook_payloads` table

**Processing architecture:**

```
Webhook → Signature Verify → Timestamp Validate → Store Raw Payload
    ↓
Transform to SourceEvent → Emit Inngest Event
    ↓
Observation Capture Workflow (async)
    ├── Duplicate check
    ├── Event filter (source config)
    ├── Significance gate
    ├── Classification (parallel)
    ├── Embedding generation (parallel)
    ├── Entity extraction (parallel)
    ├── Cluster assignment
    ├── Pinecone upsert
    └── Database insert
```

**Example: SourceEvent structure**

```typescript
interface SourceEvent {
  source: 'github' | 'vercel';
  sourceType: 'pull-request.opened' | 'deployment.succeeded' | ...;
  sourceId: 'pr:lightfastai/lightfast#123';
  title: 'feat: add semantic search';
  body: 'Full PR description...';
  actor: { id: '12345678', name: 'username', email, avatarUrl };
  occurredAt: '2025-12-17T10:30:00Z';
  references: [{ type: 'commit', id: 'abc123' }];
  metadata: { /* source-specific */ };
}
```

**Cross-source correlation:**

Vercel deployments are linked to GitHub users via commit SHA. When a GitHub push arrives with the same commit, the Vercel observation's actor is updated with the numeric GitHub user ID.

**Limitations:**

- Only GitHub and Vercel sources implemented (Linear, Sentry, PagerDuty planned)
- No circuit breaker for failing transformers
- No rate limiting at webhook endpoint level
- No manual reprocessing UI

---

### Why We Built It This Way

The observation pipeline uses a significance scoring gate before AI classification to minimize LLM costs. Only events scoring 40+ undergo classification and embedding generation. This keeps costs predictable while ensuring high-value events like security patches and releases are always captured.

Multi-view embeddings (title, content, summary) optimize retrieval for different query types. When searching for "authentication bug", the title embedding finds headline matches, while the content embedding surfaces detailed discussions. The summary view balances both for general queries.

Raw webhook payload storage enables replay and debugging. When something goes wrong, you can inspect the exact JSON received, re-trigger processing, or audit what happened.

---

### Resources

- [Memory Features](/docs/features/memory)
- [Search Features](/docs/features/search)
- [Getting Started](/docs/get-started/overview)
