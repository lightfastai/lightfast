---
title: Feature Map — Surfaces, Components, API, Data
status: approved
audience: engineering
last_updated: 2025-11-10
---

# Feature Map (Phase 1)

Search (Landing)
- Surface: /org/[slug]
- Components: OrgChatInterface, SearchResultCard
- API: trpc.search.query → api/console/src/router/search.ts
- Data: Pinecone results; stores lookup (db/console)
 - Status: Pending UI (cards, pagination, highlighting)

Jobs (Tab in Search)
- Surface: /org/[slug] → Tabs: Jobs
- Components: JobsList, JobCard
- API: trpc.jobs.list, trpc.jobs.get → api/console/src/router/jobs.ts
- Data: Inngest API (active/queued), lf_ingestion_commits (completed)
 - Status: Pending (spec only)

View Config (Modal)
- Surface: Search toolbar button → modal
- Components: RepositoryConfigDialog
- API: repository.get/find (existing), contents fetch if needed
- Data: DeusConnectedRepository (config status, path) + GitHub content
 - Status: Implemented
   - UI: apps/console/src/components/repository-config-dialog.tsx:1
   - API: apps/console/src/app/(github)/api/github/repository-config/route.ts:1

Settings (Existing)
- Surface: /org/[slug]/settings/*
- Components: existing pages
- API: organization, repository routers (existing)
- Data: db/console entities
 - Status: Implemented with actions
   - Check Config: apps/console/src/components/repositories-settings.tsx:1 → `repository.detectConfig`
   - Start Indexing: apps/console/src/components/repositories-settings.tsx:1 → `repository.reindex`

Ingestion Pipeline (supporting)
- Event schema: api/console/src/inngest/client/client.ts:18 (no storeName; includes workspaceId, workspaceKey)
- Webhook sender: apps/console/src/app/(github)/api/github/webhooks/route.ts:1
- Reindex sender: api/console/src/router/repository.ts:520
- Ingestion function: api/console/src/inngest/workflow/docs-ingestion.ts:1 (resolves store from lightfast.yml)

Index & Store Provisioning (supporting)
- Pinecone index naming + idempotent create: vendor/pinecone/src/client.ts:1
- Store creation race-safety: api/console/src/lib/stores.ts:1

Cross-cutting utilities
- Types: packages/console-types
- TRPC client: packages/console-trpc (react + server)
- Services: packages/console-api-services (shared wrappers)
