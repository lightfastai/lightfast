---
date: 2026-02-05T07:38:09Z
researcher: Claude
git_commit: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
branch: main
repository: lightfast
topic: "Accelerator Demo: Multi-Source Search Scenarios with Sentry + Linear + GitHub + Vercel"
tags: [research, demo, accelerator, search, sentry, linear, github, vercel, test-data]
status: complete
last_updated: 2026-02-05
last_updated_by: Claude
---

# Research: Accelerator Demo - Multi-Source Search Scenarios

**Date**: 2026-02-05T07:38:09Z
**Researcher**: Claude
**Git Commit**: d2ee86b28fd4b2ff54719b241aa4d64b7ad25128
**Branch**: main
**Repository**: lightfast

## Research Question

How can we design engaging product demo scenarios for the accelerator pitch that showcase Lightfast's multi-source search capabilities, including Sentry + Linear + GitHub + Vercel integrations?

## Summary

This document provides comprehensive demo scenarios for showcasing Lightfast's semantic search API during your accelerator pitch. The scenarios demonstrate cross-source intelligence - showing how Lightfast connects the dots between errors (Sentry), issues (Linear), code changes (GitHub), and deployments (Vercel) to answer questions that would normally require searching multiple tools.

**Current State:**
- GitHub and Vercel webhooks are **fully implemented** in production
- Sentry and Linear are **researched but not yet implemented** in production
- Test data infrastructure now supports **all four sources** via official mock transformers

**Demo Approach (Decided):**
We're implementing **official mock transformers** for Sentry and Linear based on their actual webhook specifications. This allows the demo to show realistic four-source search results while the production integrations are built separately.

**Implementation Components (Completed):**
1. ✅ Extended `webhook-schema.json` to support `sentry` and `linear` sources with event types
2. ✅ Mock transformers in `packages/console-test-data/src/transformers/` using official webhook structures:
   - `sentry.ts` - Transforms SentryIssue, SentryError, SentryEventAlert, SentryMetricAlert webhooks
   - `linear.ts` - Transforms LinearIssue, LinearComment, LinearProject, LinearCycle, LinearProjectUpdate webhooks
3. ✅ Updated `packages/console-validation/src/schemas/sources.ts` - Added "sentry" and "linear" to SourceType
4. ✅ Demo dataset `demo-incident.json` with 17 cross-linked events from all four sources
5. ✅ Updated transform.ts to route sentry/linear to mock transformers

## Demo Philosophy: "The 10x Developer Tool"

The core pitch: **Lightfast gives every developer a photographic memory of their entire engineering stack.**

Instead of:
- Searching Sentry for errors → finding issue number → searching Linear → finding PR → searching GitHub → checking Vercel deployment

With Lightfast:
- Ask one question → Get connected context from all sources

---

## Part 1: Compelling Demo Prompts (The "Wow" Moments)

### Tier 1: Cross-Source Intelligence (Most Impressive)

These queries demonstrate Lightfast's unique value - connecting information across sources.

#### 1.1 "Incident Postmortem" Query
```
"What happened with the authentication errors last week?"
```

**Expected Result (with full integrations):**
- Sentry alert: `ReferenceError: session.token undefined` (Jan 8)
- GitHub commit: `hotfix: Fix critical authentication bypass vulnerability` (Jan 8)
- Linear issue: `Critical: Session validation failing in production` (Linked)
- Vercel deployment: Successful deployment after fix (Jan 8, 15:00)

**Why it's impressive:** One question surfaces the entire incident timeline from detection → root cause → fix → deployment.

#### 1.2 "Performance Regression" Query
```
"Why is the dashboard loading slowly?"
```

**Expected Result:**
- Vercel deployment: `v2.5.0` introduced new analytics queries
- GitHub PR #402: `fix(perf): Optimize database queries in analytics` (merged)
- GitHub PR body: "Reduced query time from 8s to 200ms"
- Sentry performance alert: Response times spiked Jan 9

**Why it's impressive:** Connects performance symptoms to code changes automatically.

#### 1.3 "Security Audit" Query
```
"Show me all security-related changes this month"
```

**Expected Result:**
- GitHub PR #401: `Implement rate limiting middleware` (merged)
- GitHub PR #404: `Patch SQL injection vulnerability` (CVE-2024-0002)
- GitHub commit: `Move secrets to environment variables`
- GitHub commit: `Fix critical authentication bypass vulnerability`
- Linear issues tagged `security`

**Why it's impressive:** Instant security posture review across all code changes.

#### 1.4 "Who Knows About X?" Query
```
"Who has been working on the OAuth system?"
```

**Expected Result:**
- alice: OAuth2 refresh token rotation, API key rotation mechanism
- bob: Authentication bypass hotfix, session validation
- PR reviewers tagged on auth-related PRs
- Linear issue assignees for auth tickets

**Why it's impressive:** Surfaces institutional knowledge and expertise mapping.

### Tier 2: Source-Specific Deep Dives

#### 2.1 "Production Error Investigation"
```
"What's causing the TypeError in the checkout flow?"
```

**Expected Result (with Sentry):**
- Sentry issue PROJ-456: `TypeError: Cannot read property 'price' of undefined`
- Stack trace pointing to `checkout.ts:142`
- First seen timestamp, occurrence count
- Related GitHub commits touching `checkout.ts`

#### 2.2 "Sprint Progress" Query
```
"What got shipped in the last sprint?"
```

**Expected Result (with Linear):**
- 12 issues marked Done
- 4 PRs merged to main
- 3 Vercel production deployments
- Breakdown by engineer

#### 2.3 "Deployment History" Query
```
"Show me all deployments to production this week"
```

**Expected Result:**
- Vercel deployments with commit messages
- Success/failure status
- Which PRs triggered each deployment
- Rollbacks if any

### Tier 3: Natural Language Variations

Show the same intent works with different phrasings:

```
"authentication bugs"
"auth issues"
"login problems"
"What's breaking login?"
"Why can't users sign in?"
```

All should return similar results, demonstrating semantic understanding.

---

## Part 2: Enhanced Test Data Design

### 2.1 Proposed Schema Extension

To support Sentry and Linear in test data, extend `webhook-schema.json`:

```json
{
  "definitions": {
    "WebhookPayload": {
      "properties": {
        "source": {
          "enum": ["github", "vercel", "sentry", "linear"]
        },
        "eventType": {
          "oneOf": [
            {
              "enum": ["push", "pull_request", "issues", "release", "discussion"],
              "description": "GitHub event types"
            },
            {
              "enum": ["deployment.created", "deployment.succeeded", "deployment.ready", "deployment.canceled", "deployment.error"],
              "description": "Vercel event types"
            },
            {
              "enum": ["issue.created", "issue.resolved", "issue.assigned", "issue.ignored", "error", "event_alert", "metric_alert"],
              "description": "Sentry event types"
            },
            {
              "enum": ["Issue", "Comment", "IssueLabel", "Project", "Cycle", "ProjectUpdate"],
              "description": "Linear event types"
            }
          ]
        }
      }
    }
  }
}
```

### 2.2 Cross-Source Storyline: "The Production Incident"

A complete storyline demonstrating cross-source correlation:

#### Timeline of Events

| Time | Source | Event | Details |
|------|--------|-------|---------|
| Jan 15, 09:00 | Linear | Issue created | "Users reporting checkout failures" LIN-892 |
| Jan 15, 09:05 | Sentry | Error captured | `TypeError: price.toFixed is not a function` |
| Jan 15, 09:15 | Sentry | Issue created | CHECKOUT-123 (grouped errors) |
| Jan 15, 09:30 | Linear | Comment | "Sentry shows TypeError in PriceCalculator" |
| Jan 15, 10:00 | GitHub | Branch created | `fix/checkout-price-calculation` |
| Jan 15, 11:30 | GitHub | PR opened | #478 "fix: Handle null prices in checkout" |
| Jan 15, 12:00 | GitHub | PR merged | #478 merged to main |
| Jan 15, 12:05 | Vercel | Deployment started | dpl_abc123 |
| Jan 15, 12:10 | Vercel | Deployment succeeded | Production updated |
| Jan 15, 12:30 | Sentry | Issue resolved | CHECKOUT-123 marked resolved |
| Jan 15, 12:45 | Linear | Issue closed | LIN-892 closed, linked to PR #478 |

#### Demo Queries Against This Storyline

1. **"What happened with checkout today?"**
   - Returns: All 11 events in chronological context

2. **"Who fixed the checkout bug?"**
   - Returns: alice (PR author), with commit details

3. **"Is the price calculation issue resolved?"**
   - Returns: Yes - Sentry issue resolved, Linear closed, PR merged, deployed

4. **"Show me the fix for CHECKOUT-123"**
   - Returns: PR #478 with diff summary, linked Linear issue

### 2.3 Sample Webhook Payloads

#### Sentry Issue Created

```json
{
  "source": "sentry",
  "eventType": "issue.created",
  "payload": {
    "action": "created",
    "data": {
      "issue": {
        "id": "4815162342",
        "shortId": "CHECKOUT-123",
        "title": "TypeError: price.toFixed is not a function",
        "status": "unresolved",
        "level": "error",
        "platform": "javascript",
        "metadata": {
          "type": "TypeError",
          "value": "price.toFixed is not a function",
          "filename": "src/checkout/PriceCalculator.ts"
        },
        "project": {
          "id": "6789",
          "name": "frontend",
          "slug": "frontend"
        },
        "firstSeen": "2024-01-15T09:15:00Z",
        "lastSeen": "2024-01-15T09:15:00Z",
        "count": 47,
        "userCount": 23
      }
    },
    "installation": {
      "uuid": "inst-abc-123"
    },
    "actor": {
      "id": "system",
      "name": "Sentry",
      "type": "application"
    }
  }
}
```

#### Linear Issue Created

```json
{
  "source": "linear",
  "eventType": "Issue",
  "payload": {
    "action": "create",
    "type": "Issue",
    "data": {
      "id": "issue-uuid-892",
      "identifier": "LIN-892",
      "title": "Users reporting checkout failures - payments not processing",
      "description": "Multiple user reports of checkout failing at the payment step.\n\nSteps to reproduce:\n1. Add item to cart\n2. Proceed to checkout\n3. Error appears when calculating total\n\nSuspected: Price calculation issue",
      "priority": 1,
      "priorityLabel": "Urgent",
      "state": {
        "id": "state-todo",
        "name": "Todo",
        "type": "unstarted"
      },
      "team": {
        "id": "team-frontend",
        "key": "FE",
        "name": "Frontend"
      },
      "labels": [
        { "id": "label-bug", "name": "bug" },
        { "id": "label-critical", "name": "critical" }
      ],
      "assignee": {
        "id": "user-alice",
        "name": "Alice Chen",
        "email": "alice@example.com"
      },
      "creator": {
        "id": "user-bob",
        "name": "Bob Smith",
        "email": "bob@example.com"
      },
      "url": "https://linear.app/acme/issue/LIN-892",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "updatedAt": "2024-01-15T09:00:00.000Z"
    },
    "url": "https://linear.app/acme/issue/LIN-892",
    "createdAt": "2024-01-15T09:00:00.000Z"
  }
}
```

### 2.4 Cross-Source Linking Patterns

The test data should include explicit linking patterns:

#### GitHub PR Referencing Linear Issue
```json
{
  "source": "github",
  "eventType": "pull_request",
  "payload": {
    "pull_request": {
      "title": "fix: Handle null prices in checkout",
      "body": "## Summary\nFixes price calculation when discount is null.\n\n## Related\n- Fixes LIN-892\n- Resolves Sentry CHECKOUT-123\n\n## Test Plan\n- [ ] Unit tests for PriceCalculator\n- [ ] E2E checkout flow"
    }
  }
}
```

#### Vercel Deployment Referencing Commit
```json
{
  "source": "vercel",
  "eventType": "deployment.succeeded",
  "payload": {
    "payload": {
      "deployment": {
        "meta": {
          "githubCommitSha": "fix478sha",
          "githubCommitMessage": "fix: Handle null prices in checkout (#478)\n\nFixes LIN-892",
          "githubCommitAuthorLogin": "alice",
          "githubPrId": "478"
        }
      }
    }
  }
}
```

---

## Part 3: Demo Engagement Strategies

### 3.1 The "Before/After" Demo

**Before Lightfast (show the pain):**
1. Open Sentry → search for errors
2. Find error, note issue number
3. Open Linear → search for related ticket
4. Find ticket, note PR link
5. Open GitHub → find PR
6. Check commit, note deployment
7. Open Vercel → verify deployment status

**With Lightfast (the magic moment):**
1. Type: "What's the status of the checkout bug?"
2. See everything connected in one response

**Time comparison:** 5-10 minutes → 5 seconds

### 3.2 Live Demo Script

**Opener (30 seconds):**
> "Imagine you're on-call at 2 AM. Alerts are firing. Users can't checkout. You need to understand what's happening across Sentry, Linear, GitHub, and Vercel. With Lightfast, you ask one question."

**Demo (2 minutes):**
1. Type the query in the search bar
2. Show results appearing
3. Highlight cross-source connections
4. Click through to show linking

**Closer (30 seconds):**
> "Every developer interaction with your stack becomes searchable context. The more your team uses their tools, the smarter Lightfast gets."

### 3.3 Backup Demos (If Full Integration Not Ready)

#### GitHub + Vercel Only Demo Queries

These work with current implementation:

1. **"What commits triggered today's deployments?"**
   - Shows GitHub push → Vercel deployment correlation

2. **"Who has been most active this week?"**
   - Aggregates pushes, PRs, issues by author

3. **"Show me all merged PRs related to authentication"**
   - Semantic search across PR titles and bodies

4. **"What's happening with the API refactor?"**
   - Finds all commits, PRs, issues mentioning "API"

### 3.4 Audience-Specific Angles

#### For Technical Investors
- Emphasize: Vector search, Pinecone architecture, Inngest workflows
- Demo: Real-time webhook → embedding → query flow

#### For Business-Focused Investors
- Emphasize: Time savings, team productivity, reduced context switching
- Demo: Side-by-side "before/after" time comparison

#### For Platform/Developer Tool Investors
- Emphasize: Multi-source architecture, integration marketplace potential
- Demo: How easy it is to add new sources (show connector pattern)

---

## Part 4: Technical Demo Setup

### 4.1 Test Data Injection Command

```bash
# Inject the comprehensive scenario
cd packages/console-test-data
pnpm with-env pnpm inject --workspace ws_demo123 --scenario comprehensive

# Or stress test with many events
pnpm with-env pnpm inject --workspace ws_demo123 --scenario stress --count 100
```

### 4.2 Recommended Demo Environment

1. **Clean workspace**: Create fresh workspace for demo
2. **Pre-loaded data**: Inject comprehensive dataset beforehand
3. **Indexed**: Wait for Inngest workflows to complete (check job status)
4. **Warm cache**: Run a few queries to warm embedding cache

### 4.3 Demo Checklist

- [ ] Fresh workspace created
- [ ] Comprehensive test data injected
- [ ] All Inngest jobs completed (check `/jobs` page)
- [ ] Search queries tested and working
- [ ] Backup queries prepared
- [ ] Network stable (or local demo mode)

---

## Part 5: Future Roadmap Context

### Current Implementation Status

| Source | OAuth | Webhooks | Transformer | Inngest | Search | Test Data |
|--------|-------|----------|-------------|---------|--------|-----------|
| GitHub | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Vercel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sentry | ❌ | ❌ | ✅ (mock) | ❌ | ❌ | ✅ |
| Linear | ❌ | ❌ | ✅ (mock) | ❌ | ❌ | ✅ |

**Note:** Sentry and Linear have mock transformers for test data that use official webhook structures. Production integrations (OAuth, Webhooks, Inngest) are planned but not yet implemented.

### Why Sentry + Linear are Next

1. **Sentry**: Error context is critical for incident response
2. **Linear**: Issue tracking connects product → engineering workflow
3. **Both**: Have excellent webhook APIs (already researched)

### Implementation Estimate

Per-source implementation follows established patterns:
- OAuth flow: ~1-2 days (copy Vercel pattern)
- Webhook handler: ~1 day (copy GitHub pattern)
- Transformers: ~2-3 days (event-specific logic)
- Testing: ~1 day

Total: ~5-7 days per new source

---

## Code References

### Test Data Infrastructure (Updated)
- `packages/console-test-data/datasets/demo-incident.json` - Cross-source incident storyline (Sentry + Linear + GitHub + Vercel)
- `packages/console-test-data/datasets/comprehensive.json` - Existing test data (GitHub + Vercel)
- `packages/console-test-data/datasets/webhook-schema.json` - Extended to support all 4 sources
- `packages/console-test-data/src/loader/transform.ts` - Routes webhooks to transformers (all 4 sources)

### Mock Transformers (New)
- `packages/console-test-data/src/transformers/sentry.ts` - Official Sentry webhook payloads → SourceEvent
- `packages/console-test-data/src/transformers/linear.ts` - Official Linear webhook payloads → SourceEvent
- `packages/console-test-data/src/transformers/index.ts` - Transformer exports

### Schema Updates
- `packages/console-validation/src/schemas/sources.ts:23-28` - SourceType now includes "sentry" and "linear"

### Search Implementation
- `api/console/src/router/org/search.ts:42-186` - tRPC search procedure
- `apps/console/src/lib/neural/four-path-search.ts:362-524` - Four-path parallel search

### Integration Research
- `thoughts/shared/research/2026-01-22-sentry-ingestion-retrieval-pipeline.md` - Sentry pipeline design
- `thoughts/shared/research/2026-01-22-linear-integration-ingestion-retrieval-pipeline.md` - Linear pipeline design

### Production Webhook Patterns (Reference)
- `packages/console-webhooks/src/transformers/github.ts` - GitHub transformer (501 lines)
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel transformer (156 lines)

---

## Recommendations for Demo

### Option A: Extend Test Data (Recommended for Maximum Impact)

1. Update `webhook-schema.json` to support `sentry` and `linear` sources
2. Create `demo-incident.json` dataset with the "Production Incident" storyline
3. Add mock transformers for Sentry/Linear events (simulated, not production)
4. Demo shows the vision of full integration

**Pros:** Shows full product vision, most impressive
**Cons:** Requires ~2-3 hours of implementation work

### Option B: Focus on GitHub + Vercel (Safer)

1. Use existing `comprehensive.json` dataset
2. Focus queries on GitHub ↔ Vercel correlation
3. Mention Sentry/Linear as "coming soon"

**Pros:** Already works, no implementation needed
**Cons:** Less impressive cross-source story

### My Recommendation

**Go with Option A** for the accelerator demo. The investment of 2-3 hours to create mock Sentry/Linear test data will significantly strengthen your pitch by showing the full vision. Investors understand that some integrations are "coming soon" - what matters is demonstrating the architecture can support them.

---

## Open Questions

1. **Demo Environment**: Will you use a staging environment or production with test workspace?

2. **Mock vs Real Data**: Do you want purely synthetic data or data based on real scenarios from Lightfast's development?

3. **Interactive or Scripted**: Should the demo allow audience questions (riskier but engaging) or follow a strict script (safer)?

4. **Fallback Plan**: What's the backup if search returns unexpected results during live demo?
