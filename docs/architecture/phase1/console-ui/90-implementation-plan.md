---
title: Implementation Plan (Sequential)
status: approved
audience: engineering
last_updated: 2025-11-10
---

# Implementation Plan (Phase 1)

Milestone A — Search UI and Results
1) Create `SearchResultCard` component
   - Path: apps/console/src/components/search-result-card.tsx
   - AC: Renders title, snippet, score badge (subtle), source badge (GitHub), link, and optional recency
2) Add pagination (10 per page) with “Load more”
   - AC: Additional pages fetch via `trpc.search.query`
3) Add basic highlighting + snippeting on the server
   - Path: api/console/src/router/search.ts: add optional highlight/snippet generation
   - Types: packages/console-types/src/api/search.ts — consider `highlights?: { attribute; value }[]`

Milestone B — Jobs Tab
4) Add `jobs` router and wire it up
   - New file: api/console/src/router/jobs.ts
   - Wire-in: api/console/src/root.ts
   - Procedures: `list`, `get`
5) Add UI components and polling
   - New files: apps/console/src/components/jobs-list.tsx, job-card.tsx
   - AC: Poll every 3s when Jobs tab is active; renders running/queued then completed
6) Add Jobs tab into `OrgChatInterface`
   - Path: apps/console/src/components/org-chat-interface.tsx: add Tabs, fetch/poll logic in Jobs tab

Milestone C — View Config Dialog
7) Add `RepositoryConfigDialog` — Implemented
   - UI: apps/console/src/components/repository-config-dialog.tsx:1
   - API: apps/console/src/app/(github)/api/github/repository-config/route.ts:1
   - AC: Shows repo, config path, and file content; refresh and GitHub links
8) Add actions in Settings — Implemented
   - Check Config: `repository.detectConfig` wired in apps/console/src/components/repositories-settings.tsx:1
   - Start Indexing: `repository.reindex` wired in apps/console/src/components/repositories-settings.tsx:1

Milestone D — Types, Services, and Packages
9) Inngest event schema update — Implemented
   - Remove `storeName` from docs.push, add `workspaceKey`; ingestion resolves store from lightfast.yml
   - File: api/console/src/inngest/client/client.ts:18
10) Pinecone + Store provisioning — Implemented
   - Sanitized index names, idempotent create; race-safe store insert (onConflict)
   - Files: vendor/pinecone/src/client.ts:1, api/console/src/lib/stores.ts:1

Milestone E — Acceptance pass
11) Verify end-to-end — Implemented (except Jobs UI)
   - AC: Connect repo → add lightfast.yml → push or Start Indexing → ingestion runs → search returns results
   - Webhook: apps/console/src/app/(github)/api/github/webhooks/route.ts:1
   - Ingestion: api/console/src/inngest/workflow/docs-ingestion.ts:1
   - Search: api/console/src/router/search.ts:1

Notes
- Keep Phase 1 minimal; do not introduce DB migrations for Jobs.
- Ensure `@repo/console-trpc` exposes new jobs procedures (react + server proxies).

Status summary
- Implemented: View Config modal, Check Config, Start Indexing, webhook + ingestion event schema, Pinecone/store idempotency.
- Pending: Jobs router and UI (Milestone B), Search result cards and pagination/highlighting (Milestone A).
