---
title: DB Model & Package Updates (Phase 1)
status: approved
audience: engineering
last_updated: 2025-11-10
---

# DB Model & Package Updates

Summary
- Phase 1 requires no new DB tables for Jobs. Use Inngest API for active/queued runs and `lf_ingestion_commits` for history.
- Minor type additions may be needed for Search highlights and Jobs.

Current DB (db/console)
- Tables in use (selection):
  - `lightfast_connected_repository` (aka `DeusConnectedRepository`) — includes `configStatus`, `configPath`, `workspaceId`
  - `lf_ingestion_commits` — idempotency + audit for completed ingestions
  - `lightfast_workspaces` — default workspace per org (Phase 1)
  - `lf_stores` — store identity, workspace binding, index name
  - `lf_docs_documents`, `lf_vector_entries` — document/chunk storage

Optional DB improvements (not required for Phase 1)
- Add `last_error` (text) to `lightfast_connected_repository` to surface recent ingestion failure summary in Settings.
- Add a materialized view or cache table for recent Inngest runs if API latency ever becomes an issue.

Indexes & constraints (review)
- `DeusConnectedRepository` has org, active, workspace indexes and unique `github_repo_id` (already present).
- Ensure `lf_ingestion_commits` has indexes covering `store_id`, `workspace_id`, and timestamps for history queries.

Packages to update
- api/console
  - Add `router/jobs.ts` and wire in `src/root.ts`
  - Optional: small Inngest client wrapper (or reuse vendor if present)
- packages/console-trpc
  - Expose `jobs` procedures in both `react` and `server` proxies
- packages/console-types
  - Search: Optional `highlights` on results for `<mark>` rendering
  - Jobs: Add `Job` and `JobListResponse` types aligned with the TRPC router
- packages/console-api-services
  - Add a lightweight `JobsService` wrapper if shared server-side access is desired
- apps/console
  - Components: `search-result-card.tsx`, `jobs-list.tsx`, `job-card.tsx`, `repository-config-dialog.tsx`
  - Wire tabs and toolbar button in `org-chat-interface.tsx`

Out of scope (Phase 1)
- Workspace CRUD UI and multi-workspace routing
- Linear/Notion ingestion and cross-source filtering

