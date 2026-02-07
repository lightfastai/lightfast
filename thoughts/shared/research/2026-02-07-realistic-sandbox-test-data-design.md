---
date: 2026-02-07T16:00:00+11:00
researcher: Claude
git_commit: 3db488f9da81be6fba94a3bc29e6536edc5c091f
branch: feat/memory-connector-backfill
repository: lightfast
topic: "Realistic Sandbox Test Data Design: Lightfast-Based Webhook Datasets"
tags: [research, test-data, sandbox, demo, accelerator, webhooks, datasets]
status: complete
last_updated: 2026-02-07
last_updated_by: Claude
---

# Research: Realistic Sandbox Test Data Design

**Date**: 2026-02-07T16:00:00+11:00
**Researcher**: Claude
**Git Commit**: 3db488f9da81be6fba94a3bc29e6536edc5c091f
**Branch**: feat/memory-connector-backfill
**Repository**: lightfast

## Research Question

How should we redesign the test data datasets to use realistic Lightfast-based scenarios instead of fake "acme/platform" data, adopting a `sandbox-N.json` naming convention and reflecting real commit history, real error patterns, and real incident flows?

## Summary

This document provides the complete design specification for replacing the existing test datasets (`comprehensive.json`, `performance.json`, `security.json`, `demo-incident.json`) with a new `sandbox-N.json` convention. The new datasets use `lightfastai/lightfast` as the repo, real developer names (jeevanpillay, Claude), real commit patterns from the actual git history (Dec 2025 - Feb 2026), and realistic failure modes derived from the actual Lightfast architecture.

**Key Changes:**
- Delete: `comprehensive.json`, `performance.json`, `security.json`
- Rename: `demo-incident.json` → replaced by `sandbox-1.json`
- New files: `sandbox-1.json` (incident storyline), `sandbox-2.json` (feature development), `sandbox-3.json` (infrastructure + security)
- All data reflects `lightfastai/lightfast` repo with real PR numbers, real branch naming, real dates

## Detailed Findings

### Current State

The existing datasets at `packages/console-test-data/datasets/`:
- `comprehensive.json` - 13 GitHub webhooks (pushes, PRs) using fake repos: `acme/platform`, `test/repo`, `myorg/api`
- `performance.json` - 3 webhooks (1 PR, 1 issue, 1 Vercel deployment) using `test/api-service`
- `security.json` - 3 webhooks (1 PR, 1 issue, 1 push) using `test/repo`
- `demo-incident.json` - 15 cross-source webhooks using `acme/platform` with Sentry + Linear + GitHub + Vercel

**Problems with current data:**
1. Uses fake org/repo names that don't correspond to Lightfast
2. Uses generic developer names (alice, bob, charlie, dave, eve, frank)
3. Uses dates from January 2024 (not reflecting real timeline)
4. Error scenarios are generic (checkout TypeError) rather than reflecting real Lightfast failure modes
5. Multiple small files with overlapping concerns

### Proposed Dataset Design

#### Naming Convention
- `sandbox-1.json` - Production incident: Pinecone embedding failure cascade
- `sandbox-2.json` - Feature development lifecycle: Answer API + workspace rework
- `sandbox-3.json` - Infrastructure, security, and observability work

All use:
- **Repo**: `lightfastai/lightfast` (repo ID: 901234567)
- **Org**: `lightfastai` (org ID: 88881234)
- **Developers**: `jeevanpillay` (ID: 7654321), `claude-code[bot]` (ID: 1234567890)
- **Dates**: December 2025 - February 2026 (reflecting actual commit history)
- **PR numbers**: 340-358 (reflecting actual PRs)
- **Vercel project**: `lightfast-console`

### sandbox-1.json: Production Incident - Pinecone Embedding Dimension Mismatch

**Scenario**: A workspace embedding config is upgraded to 1536-dim Cohere model, but the Pinecone index still uses 1024-dim vectors. Observation capture starts failing, search goes stale, the team detects it via Sentry, creates a Linear issue, ships a hotfix, and deploys.

**Timeline (based on real Lightfast architecture):**

| Time | Source | Event | Details |
|------|--------|-------|---------|
| Feb 4, 09:15 | Sentry | error | `PineconeError: Dimension mismatch - expected 1024, got 1536` |
| Feb 4, 09:20 | Sentry | issue.created | NEURAL-847: Grouped embedding dimension errors |
| Feb 4, 09:25 | Sentry | event_alert | "High Error Volume - Neural Pipeline" triggered |
| Feb 4, 09:30 | Sentry | metric_alert | "Observation Capture Success Rate" dropped below 50% |
| Feb 4, 09:45 | Linear | Issue create | LF-412: "Critical: Observation pipeline failing - dimension mismatch" |
| Feb 4, 10:00 | Linear | Comment create | Root cause identified: settings migration didn't include Pinecone re-index |
| Feb 4, 10:15 | GitHub | issues opened | #361: "Embedding dimension mismatch after workspace settings migration" |
| Feb 4, 10:30 | Linear | Issue update | LF-412 moved to "In Progress" |
| Feb 4, 11:00 | GitHub | pull_request opened | #362: "fix(neural): validate embedding dimensions before Pinecone upsert" |
| Feb 4, 12:00 | GitHub | pull_request closed (merged) | #362 merged by jeevanpillay |
| Feb 4, 12:05 | GitHub | push | Merge commit to main |
| Feb 4, 12:10 | Vercel | deployment.created | Building lightfast-console |
| Feb 4, 12:15 | Vercel | deployment.succeeded | Production deployment ready |
| Feb 4, 12:30 | Sentry | issue.resolved | NEURAL-847 resolved via commit |
| Feb 4, 12:45 | Linear | Issue update | LF-412 marked Done, linked to PR #362 and Sentry NEURAL-847 |
| Feb 4, 12:50 | GitHub | issues closed | #361 closed |
| Feb 4, 13:00 | Linear | Comment create | Post-incident summary with timeline |

**Why this is realistic**: The `feat(db): migrate embedding config to versioned settings JSONB column` commit (Dec 16, 2025) actually changed workspace settings. A real incident could occur if embedding dimensions change but Pinecone index isn't recreated.

### sandbox-2.json: Feature Development - Answer API + Workspace Rework

**Scenario**: The major feature branch `feat/search-answer-workspace-rework` (PR #353) being developed and merged. Includes multiple commits, Vercel preview deployments, Linear sprint tracking, and the full merge + production deploy.

**Timeline (based on actual PR #353 history):**

| Time | Source | Event | Details |
|------|--------|-------|---------|
| Feb 5, 22:34 | GitHub | push | `feat(console): add relationship graph for cross-source intelligence` |
| Feb 6, 12:28 | GitHub | push | `feat(console): add strict relationship detection with Linear/Sentry transformers` |
| Feb 6, 12:34 | GitHub | pull_request opened | #352: "feat(console): add strict relationship detection" |
| Feb 6, 12:34 | GitHub | pull_request closed (merged) | #352 merged |
| Feb 6, 14:02 | GitHub | push | `feat(console): complete useToast to Sonner migration` |
| Feb 6, 15:37 | GitHub | push | `refactor(api): extract dual auth logic into reusable middleware` |
| Feb 6, 15:46 | GitHub | push | `feat(console): add answer API with AI runtime and tools` |
| Feb 6, 15:46 | Vercel | deployment.created | Preview: feat/search-answer-workspace-rework |
| Feb 6, 15:50 | Vercel | deployment.succeeded | Preview ready |
| Feb 6, 17:31 | GitHub | push | `feat(console): enhance answer interface with new components and tools` |
| Feb 6, 21:07 | GitHub | push | `refactor(console): decompose workspace search into modular components` |
| Feb 6, 22:24 | GitHub | push | `fix(console): resolve lint and type errors for successful build` |
| Feb 6, 22:49 | GitHub | pull_request opened | #353: "feat(console): search-answer-workspace-rework" |
| Feb 6, 22:49 | GitHub | pull_request closed (merged) | #353 merged |
| Feb 6, 22:55 | Vercel | deployment.created | Production: main branch |
| Feb 6, 23:00 | Vercel | deployment.succeeded | Production deployed |
| Linear | Cycle update | Sprint 3 progress: 75% → 90% |
| Linear | Issue update | LF-398: "Implement answer interface" - Done |
| Linear | Issue update | LF-399: "Workspace search refactor" - Done |
| Linear | ProjectUpdate create | "Search & Answer milestone: all 5 tickets shipped" |

**Why this is realistic**: This directly mirrors the actual git history from Feb 5-6, 2026. The commit messages, branch names, and PR numbers are all real.

### sandbox-3.json: Infrastructure, Security & Observability

**Scenario**: Mix of infrastructure work, security fixes, and observability improvements from Dec 2025 - Jan 2026. Shows the breadth of engineering activity.

**Timeline (based on actual commits):**

| Time | Source | Event | Details |
|------|--------|-------|---------|
| Dec 6, 16:40 | GitHub | push | `fix(security): update Next.js and React to patch CVE-2025-55182` |
| Dec 11, 23:45 | GitHub | push | `feat: implement raw webhook payload storage for permanent retention` |
| Dec 12, 16:39 | GitHub | push | `feat(neural): Day 2 search with metadata filters and LLM gating` |
| Dec 13, 12:46 | GitHub | push | `feat(neural): implement Day 5 multi-view embeddings and 4-path retrieval` |
| Dec 14, 12:14 | GitHub | push | `refactor(console-test-data): use raw webhooks with production transformers` |
| Dec 14, 12:13 | GitHub | push | `feat(webhooks): implement security hardening with validation and sanitization` |
| Dec 15, 19:34 | GitHub | push | `feat(db): migrate high-volume tables to BIGINT primary keys` |
| Dec 15, 22:13 | GitHub | push | `feat(auth): add Clerk API caching for organization membership lookups` |
| Dec 16, 22:16 | GitHub | push | `feat(api-keys): unify API key format to sk-lf- with 256-bit entropy` |
| Dec 16, 20:00 | GitHub | push | `feat(neural): implement cross-source actor resolution and identity linking` |
| Dec 17, 11:12 | GitHub | push | `feat(neural): integrate Braintrust + step.ai.wrap() for AI observability` |
| Dec 17, 13:10 | GitHub | push | `feat(neural): add actor_resolution and cluster_affinity analytics metrics` |
| Dec 24, 11:17 | GitHub | pull_request closed (merged) | #343: `perf(early-access): optimize Redis and rate limiting` |
| Jan 22, 12:39 | GitHub | push | `feat(ci): add GitHub Action for PlanetScale database migrations` |
| Jan 22, 13:57 | GitHub | push | `feat(docs): migrate search to Mixedbread native integration` |
| Jan 29, 13:34 | GitHub | pull_request closed (merged) | #350: `feat(www): upgrade to Next.js 16 with pnpm named catalogs` |
| Feb 7, 14:33 | GitHub | pull_request closed (merged) | #358: `fix: enable env validation on Vercel production builds` |
| Various | Vercel | deployment.succeeded | Production deployments for each merge to main |
| Various | Linear | Issue/Cycle | Sprint tracking for neural memory phases, infrastructure work |
| Various | Sentry | metric_alert | Performance alerts for search latency improvements |

**Why this is realistic**: Every commit message, date, and author is taken directly from the actual git log. Shows 3 months of infrastructure evolution.

### Shared Repository & Organization Template

All datasets should use this consistent template for the `repository` object:

```json
{
  "id": 901234567,
  "node_id": "R_lightfastai_lightfast",
  "name": "lightfast",
  "full_name": "lightfastai/lightfast",
  "private": true,
  "owner": {
    "login": "lightfastai",
    "id": 88881234,
    "node_id": "O_lightfastai",
    "avatar_url": "https://avatars.githubusercontent.com/u/88881234",
    "type": "Organization",
    "site_admin": false
  },
  "html_url": "https://github.com/lightfastai/lightfast",
  "description": "AI agent orchestration platform - neural memory for engineering teams",
  "fork": false,
  "url": "https://api.github.com/repos/lightfastai/lightfast",
  "created_at": "2025-06-01T00:00:00Z",
  "updated_at": "2026-02-07T00:00:00Z",
  "pushed_at": "2026-02-07T15:13:28Z",
  "homepage": "https://lightfast.ai",
  "size": 15000,
  "stargazers_count": 42,
  "watchers_count": 42,
  "language": "TypeScript",
  "forks_count": 3,
  "open_issues_count": 8,
  "default_branch": "main",
  "topics": ["ai", "agents", "mcp", "neural-memory", "typescript"],
  "visibility": "private"
}
```

### Developer Identity Template

```json
// jeevanpillay (founder, human)
{
  "login": "jeevanpillay",
  "id": 7654321,
  "node_id": "U_jeevanpillay",
  "avatar_url": "https://avatars.githubusercontent.com/u/7654321",
  "type": "User",
  "site_admin": false
}

// Claude Code (AI pair programmer)
{
  "login": "claude-code[bot]",
  "id": 1234567890,
  "node_id": "U_claude_code_bot",
  "avatar_url": "https://avatars.githubusercontent.com/u/1234567890",
  "type": "Bot",
  "site_admin": false
}
```

### Vercel Project Template

```json
{
  "project": { "id": "prj_lightfast_console", "name": "lightfast-console" },
  "team": {
    "id": "team_lightfastai",
    "slug": "lightfastai",
    "name": "Lightfast AI"
  }
}
```

### Linear Organization Template

```json
{
  "organizationId": "org_lightfastai",
  "team": {
    "id": "team_console",
    "key": "LF",
    "name": "Console"
  },
  "project": {
    "id": "proj_neural_memory",
    "name": "Neural Memory v1",
    "url": "https://linear.app/lightfastai/project/neural-memory-v1"
  }
}
```

### Sentry Project Template

```json
{
  "project": {
    "id": "proj_lightfast_console",
    "name": "lightfast-console",
    "slug": "lightfast-console"
  },
  "installation": {
    "uuid": "sentry-install-lightfastai"
  }
}
```

### Realistic Error Messages for Lightfast

Based on actual architecture analysis, these are realistic errors:

1. **Pinecone dimension mismatch**: `PineconeError: Vector dimension 1536 does not match index dimension 1024`
2. **Cohere rate limit**: `CohereApiError: Too many requests - rate limit exceeded (429)`
3. **tRPC auth failure**: `TRPCError: UNAUTHORIZED - Clerk JWT verification failed`
4. **Inngest step timeout**: `NonRetriableError: Step 'generate-embeddings' exceeded 60s timeout`
5. **PlanetScale connection**: `Error: Connection pool exhausted - max connections reached (100/100)`
6. **Redis cache miss storm**: `UpstashError: Rate limit exceeded for workspace config cache`
7. **Claude classification failure**: `AnthropicError: overloaded_error - Claude Haiku temporarily unavailable`
8. **Drizzle schema mismatch**: `DrizzleError: Column 'settings' has invalid version: expected v2, got v1`

## Code References

### Test Data Infrastructure
- `packages/console-test-data/datasets/` - JSON dataset files
- `packages/console-test-data/datasets/webhook-schema.json` - Schema (supports github, vercel; sentry/linear via mock)
- `packages/console-test-data/src/loader/transform.ts:71-94` - Main transform router
- `packages/console-test-data/src/loader/index.ts:34-62` - Dataset loader
- `packages/console-test-data/src/transformers/sentry.ts` - Sentry mock transformer (529-544: exported map)
- `packages/console-test-data/src/transformers/linear.ts` - Linear mock transformer (786-797: exported map)

### Production Transformers (reference for webhook structure)
- `packages/console-webhooks/src/transformers/github.ts` - GitHub transformer (501 lines)
- `packages/console-webhooks/src/transformers/vercel.ts` - Vercel transformer (161 lines)
- `packages/console-webhooks/src/event-mapping.ts` - Event type mappings

### Types
- `packages/console-types/src/neural/source-event.ts:7-37` - SourceEvent interface
- `packages/console-validation/src/schemas/sources.ts:23-28` - SourceType enum (github, vercel, linear, sentry)
- `packages/console-validation/src/schemas/source-event.ts:52-62` - Validation schema

### Architecture (for realistic failure modes)
- `api/console/src/inngest/workflow/neural/observation-capture.ts` - Main ingestion pipeline
- `apps/console/src/lib/neural/four-path-search.ts:362-524` - Search infrastructure
- `api/console/src/trpc.ts` - Auth middleware
- `apps/console/src/app/(api)/v1/answer/[...v]/route.ts` - Answer API route

### Actual Git History (source of truth for dates/commits/authors)
- 198 commits from Dec 2025 - Feb 2026
- Key PRs: #334-#358
- Authors: jeevanpillay, Claude
- Major milestones: Neural Memory pipeline (Dec 11-17), Search rework (Feb 5-6), Backfill system (Feb 7)

## Architecture Documentation

### Transform Routing Flow
1. `loadDataset("sandbox-1")` → reads JSON file
2. Each webhook routed by `source` field in `transformWebhook()`
3. GitHub/Vercel → production transformers from `@repo/console-webhooks`
4. Sentry/Linear → mock transformers from local `./transformers/`
5. All events get `:test:${index}` suffix on `sourceId` and `testData: true` metadata

### Supported Event Types by Source
- **GitHub**: push, pull_request (opened/closed/merged/reopened), issues (opened/closed), release, discussion
- **Vercel**: deployment.created, deployment.succeeded, deployment.ready, deployment.error, deployment.canceled
- **Sentry** (mock): issue.created, issue.resolved, issue.assigned, issue.ignored, error, event_alert, metric_alert
- **Linear** (mock): Issue (create/update/remove), Comment, Project, Cycle, ProjectUpdate

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-02-05-accelerator-demo-search-scenarios.md` - Original demo scenario design with "acme/platform" placeholder data
- `thoughts/shared/plans/2026-02-05-accelerator-demo-script.md` - Demo script with timing and flow
- `thoughts/shared/research/2026-02-05-accelerator-demo-relationship-graph-analysis.md` - Relationship graph design
- `thoughts/shared/plans/2026-02-06-definitive-links-implementation.md` - Cross-source linking implementation
- `thoughts/shared/prompts/debug-generate-test-data.md` - Debug prompt for test data generation

## Related Research

- `thoughts/shared/research/2025-12-14-neural-memory-eval-environment-architecture.md` - Eval environment architecture
- `thoughts/shared/research/2025-12-14-neural-memory-scientific-evaluation-framework.md` - Scientific evaluation framework

## Open Questions

1. **Should we keep `demo-incident.json` as an alias/symlink to `sandbox-1.json`?** The inject CLI may reference it.
2. **Should sandbox datasets auto-detect Lightfast org ID?** Or hardcode test workspace ID.
3. **How many sandbox files total?** Starting with 3 is good but could grow to 5-6 for different demo scenarios.
4. **Should we add a `sandbox-all.json`** that combines all scenarios for maximum data density?
