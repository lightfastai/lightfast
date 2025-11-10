# Console UI Architecture (Phase 1)

Last Updated: 2025-11-10

Overview
- Phase 1 delivers a minimal, fast Console focused on: Search, Settings, and a "View Config" dialog. Jobs tracking appears as a tab within the search page. Workspaces are transparent (single default workspace per org) in Phase 1.

What changed in this restructure
- Consolidated overlapping docs into a small, ordered set.
- Trimmed long code blocks; kept actionable specs, file paths, and contracts.
- Added a sequential implementation plan, feature mapping, DB and package guidance.

File index (ordered)
- 01-ui-architecture.md — Navigation, pages, core components
- 02-search-ui.md — Result card UX, highlighting/snippeting, performance
- 03-jobs-ui.md — Jobs tab, data flow, API surface, polling
- 04-repositories.md — Onboarding flow + repository states (combined)
- 90-implementation-plan.md — End-to-end, sequential plan with acceptance criteria
- 91-feature-map.md — Feature → surface → components → API → data
- 92-db-and-packages.md — DB overview and suggested package updates

Scope (Phase 1)
- Included: Search interface, basic result cards, Jobs tab, View Config dialog, existing Settings pages
- Deferred (Phase 2): Workspace switcher, multi-source (Linear/Notion), inline citations, advanced filters, saved searches

Navigation (high level)
```
Console App
├── Search (/)                      # Landing page
│   ├── Prompt input + repo selector
│   ├── Tabs: Chat | Jobs
│   └── Results list
│
├── Settings (/settings/*)          # Existing sidebar
│   ├── GitHub Integration
│   └── Repositories
│
└── View Config (modal)
    └── Shows repository lightfast.yml
```

Key references in code
- Search page: apps/console/src/app/(app)/org/[slug]/page.tsx:4
- Search shell: apps/console/src/components/org-chat-interface.tsx:1
- Settings: apps/console/src/app/(app)/org/[slug]/settings/repositories/page.tsx:5
- Search API: api/console/src/router/search.ts:1

Implementation status
- View Config modal: Implemented
  - UI: apps/console/src/components/repository-config-dialog.tsx:1
  - API: apps/console/src/app/(github)/api/github/repository-config/route.ts:1
- Repository Settings actions: Implemented
  - Check Config (detect): apps/console/src/components/repositories-settings.tsx:1 calls `repository.detectConfig`
  - Start Indexing (manual reindex): apps/console/src/components/repositories-settings.tsx:1 calls `repository.reindex`
  - Reindex mutation: api/console/src/router/repository.ts:520
- Webhook + ingestion integration: Implemented
  - Webhook: apps/console/src/app/(github)/api/github/webhooks/route.ts:1
  - Ingestion event schema (no storeName; uses workspaceId + workspaceKey): api/console/src/inngest/client/client.ts:18
  - Docs ingestion honors lightfast.yml `store` and includes README fallback: api/console/src/inngest/workflow/docs-ingestion.ts:1
- Jobs tab: Not implemented (spec only in 03-jobs-ui.md)
- Search result cards: Not implemented (spec only in 02-search-ui.md)

Recent changes (Phase 1 hardening)
- Manual reindex button added in Repository Settings to start ingestion without a code push.
- Config View modal fetches and displays lightfast.yml from GitHub.
- Workspace identity stabilized (UUID for DB, hyphenated key for naming) to prevent duplicate stores and vector churn.
- Ingestion event no longer carries `storeName`; the backend resolves store from lightfast.yml with a safe fallback.

Related architecture docs
- package-structure.md — Monorepo organization
- data-model.md — Database schemas and entities
- user-flow-architecture.md — Onboarding flow
- inngest-pipeline.md — Background jobs
