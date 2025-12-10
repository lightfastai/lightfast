---
title: "Implementation Plan: Neural Memory for Engineering Teams"
description: Phased implementation plan for engineering team memory with multi-source ingestion
status: draft
audience: engineering
date: 2025-12-09
source_architecture: "docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md"
tags: [implementation, plan, neural-memory, observations, retrieval, ingestion]
---

# Implementation Plan: Neural Memory for Engineering Teams

## Overview

This plan breaks down the Neural Memory architecture into 10 incremental phases, prioritizing the **ingestion pipeline** first with multi-source support (GitHub, Vercel, Sentry), followed by basic retrieval for testing, and finally advanced features like clusters, profiles, and 2-key retrieval.

The key insight: engineering teams need to answer questions like "what changed?", "who worked on X?", and "how did this system evolve?" - which requires temporal, actor-aware, and relationship-rich memory beyond static document search.

**Source Architecture**: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
**Total Phases**: 10
**Estimated Complexity**: High

## Phase Index

| Phase | Name | Status | Description |
|-------|------|--------|-------------|
| [Phase 1](./phase-01-foundation.md) | Foundation | Not Started | Database schema, Pinecone namespaces, Inngest events, webhook infrastructure |
| [Phase 2](./phase-02-observation-pipeline.md) | Observation Pipeline | Not Started | Core capture workflow, significance scoring, actor resolution, classification |
| [Phase 3](./phase-03-github-ingestion.md) | GitHub Ingestion | Not Started | PR and Issue webhook handlers, GitHub → observation transformers |
| [Phase 4](./phase-04-vercel-ingestion.md) | Vercel Ingestion | Not Started | Deployment webhook handlers, Vercel → observation transformers |
| [Phase 5](./phase-05-sentry-ingestion.md) | Sentry Ingestion | Not Started | Issue webhook handlers, Sentry → observation transformers with release linking |
| [Phase 6](./phase-06-embedding-storage.md) | Embedding & Storage | Not Started | Multi-view embeddings, Pinecone upsert, entity extraction |
| [Phase 7](./phase-07-basic-retrieval.md) | Basic Retrieval | Not Started | Vector search, entity lookup, simple retrieval endpoint |
| [Phase 8](./phase-08-clusters-profiles.md) | Clusters & Profiles | Not Started | Observation clusters, actor profiles, cluster summaries |
| [Phase 9](./phase-09-retrieval-governor.md) | Retrieval Governor | Not Started | 2-key retrieval, LLM gating, parallel retrieval, fusion scoring |
| [Phase 10](./phase-10-temporal-polish.md) | Temporal & Polish | Not Started | Temporal state tracking, point-in-time queries, optimization |

## Dependencies Between Phases

```
Phase 1 (Foundation)
    ↓
Phase 2 (Observation Pipeline) ─── depends on ──→ Phase 1 schema + events
    ↓
┌───┴───┬───────────┐
↓       ↓           ↓
Phase 3 Phase 4   Phase 5    (GitHub, Vercel, Sentry - can parallelize)
(GitHub)(Vercel)  (Sentry)
└───┬───┴───────────┘
    ↓
Phase 6 (Embedding & Storage) ─── depends on ──→ Phase 2 pipeline + any source
    ↓
Phase 7 (Basic Retrieval) ─── depends on ──→ Phase 6 embeddings
    ↓
Phase 8 (Clusters & Profiles) ─── depends on ──→ Phase 6 embeddings
    ↓
Phase 9 (Retrieval Governor) ─── depends on ──→ Phase 7 + Phase 8
    ↓
Phase 10 (Temporal & Polish) ─── depends on ──→ Phase 9
```

**Note**: Phases 3, 4, 5 can be implemented in parallel by different engineers.

## Current State

This builds upon the existing document processing infrastructure:

### Existing Code to Modify:
- `api/console/src/inngest/client/client.ts` - Add neural event schemas
- `api/console/src/inngest/index.ts` - Register neural workflows
- `packages/console-webhooks/src/index.ts` - Export new webhook handlers
- `packages/console-validation/src/schemas/sources.ts` - Add `vercel` provider
- `apps/console/src/app/(github)/api/github/webhooks/route.ts` - Add PR/Issue handlers

### New Code to Create:
- `db/console/src/schema/tables/workspace-neural-*.ts` - 6 new tables
- `api/console/src/inngest/workflow/neural/*.ts` - Neural workflows
- `packages/console-webhooks/src/vercel.ts` - Vercel webhook verification
- `packages/console-webhooks/src/sentry.ts` - Sentry webhook verification
- `apps/console/src/app/(vercel)/api/vercel/webhooks/route.ts` - Vercel webhook route
- `apps/console/src/app/(sentry)/api/sentry/webhooks/route.ts` - Sentry webhook route

## What We're NOT Doing

- **OAuth flows for Vercel/Sentry**: This plan covers webhooks only, not full OAuth integration
- **Linear/Notion integration**: Focus on GitHub, Vercel, Sentry for MVP
- **Real-time streaming**: All retrieval is request/response, no WebSocket subscriptions
- **Multi-workspace clusters**: Clusters are workspace-scoped, no cross-workspace sharing
- **Advanced graph relationships**: Basic entity extraction only, no full knowledge graph
- **Custom embedding models**: Use existing Cohere/OpenAI embeddings from document processing

## Testing Strategy

### Unit Tests
- `api/console/src/inngest/workflow/neural/__tests__/` - Workflow unit tests
- Key scenarios:
  - [ ] Significance scoring with various event types
  - [ ] Actor resolution with email matching
  - [ ] Classification for different source types
  - [ ] Entity extraction patterns

### Integration Tests
- `api/console/src/inngest/workflow/neural/__tests__/integration/` - E2E flows
- Scenarios:
  - [ ] GitHub PR → Observation → Embedding → Retrieval
  - [ ] Vercel Deployment → Observation with git metadata
  - [ ] Sentry Issue → Observation with release linking
  - [ ] Multi-source query retrieval

### Manual Testing Checklist
1. [ ] Create PR in connected GitHub repo → verify observation appears
2. [ ] Deploy to Vercel → verify deployment observation captured
3. [ ] Trigger Sentry error → verify issue observation with deployment link
4. [ ] Query "what changed this week?" → verify multi-source results
5. [ ] Query "who worked on authentication?" → verify actor-aware results

## Performance Considerations

| Operation | Target (p95) | Notes |
|-----------|--------------|-------|
| Observation capture | <500ms | End-to-end including embedding |
| Entity extraction | <200ms | Rule-based + LLM batched |
| Profile update | <1000ms | Fire-and-forget, debounced |
| Cluster assignment | <100ms | Embedding similarity + metrics |
| Retrieval (Key 1) | <50ms | Pinecone vector search |
| Retrieval (Key 2) | <300ms | LLM relevance filtering |
| Entity lookup | <20ms | PostgreSQL exact match |
| Total search (hybrid) | <500ms | Including hydration |

## Migration Notes

### Data Migration Steps:
1. Deploy Phase 1 schema - no existing data affected
2. New observations accumulate alongside existing documents
3. No migration of existing documents to observations (different purpose)

### Backwards Compatibility:
- Existing document search continues to work unchanged
- Neural memory is additive, not a replacement
- Both systems can query the same workspace

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Webhook verification fails | Low | High | Test with ngrok locally, comprehensive logging |
| Embedding costs spike | Medium | Medium | Significance threshold filters low-value events |
| LLM gating latency | Medium | Medium | Use Haiku for fast filtering, cache common patterns |
| Actor resolution mismatches | Medium | Low | Start with email-only (Tier 2), add heuristics later |
| Cluster explosion | Low | Medium | Close clusters after 7 days, limit to 10 recent |
| Vercel Pro plan required | High | Medium | Document requirement, provide fallback polling option |

## References

- Source Architecture: `docs/architecture/analysis/2025-12-09-neural-memory-e2e-design.md`
- Existing Patterns: `api/console/src/inngest/workflow/processing/process-documents.ts`
- GitHub Integration: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
- Webhook Research: Vercel uses HMAC-SHA1, Sentry uses HMAC-SHA256

---

_Created: 2025-12-09_
_Last Updated: 2025-12-09_
