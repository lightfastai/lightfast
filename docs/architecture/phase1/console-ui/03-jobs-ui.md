---
title: Jobs Tab & Tracking
status: approved
audience: engineering, design
last_updated: 2025-11-10
---

# Jobs Tab & Tracking (Phase 1)

Objectives
- Provide visibility into current and recent ingestion jobs without adding DB complexity.
- Use Inngest as the source of truth for active/queued runs; use DB for history.

Data sources
- Active/queued: Inngest API (no DB changes)
- Completed history: `lf_ingestion_commits` (db/console)

API surface (to add)
- TRPC router: `jobs`
  - `list({ organizationId, status? })` — running, queued, completed
  - `get({ runId })` — detail view (steps, timings, errors)
- Location: api/console/src/router/jobs.ts (new) and wire in api/console/src/root.ts

UI surface
- Search page tabs: Chat | Jobs
- Components (new):
  - apps/console/src/components/jobs-list.tsx — fetch, poll, render sections
  - apps/console/src/components/job-card.tsx — single job entry with icon, progress, timing, error

Behavior
- Poll every 3s while the Jobs tab is active (active/queued only).
- Merge results: show “Running/Queued” first, then “Completed”.
- Show progress when available, otherwise show spinner and status text.

Empty and error states
- No running jobs → empty copy with subtle help text.
- Error calling Inngest API → user-friendly error banner with retry.

Acceptance criteria
- Jobs tab appears below the prompt as a tab and switches without reloading the page.
- Polling updates running jobs; completed jobs rendered without polling.
- Errors are handled gracefully and don’t crash the search page.

Phase 2 preview
- Persisted run details for long-term analytics (optional)
- Retry button calling a dedicated mutation

