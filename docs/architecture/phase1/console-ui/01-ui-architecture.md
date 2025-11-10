---
title: UI Architecture & Navigation
status: approved
audience: engineering, design
last_updated: 2025-11-10
---

# UI Architecture & Navigation (Phase 1)

Goals
- Keep the Console minimal: Search as landing, Settings remains in sidebar, and a single modal to view repository config.
- Avoid horizontal app-level tabs; use a local Tabs within Search for Jobs.

Navigation model
```
[Org Switcher]   Lightfast   [Settings] [User]

Search (/) — Landing
  - Prompt input (chat-style)
  - Repository selector (toolbar)
  - Tabs: Chat | Jobs
  - Results list (below prompt)

Settings (/org/[slug]/settings/*)
  - GitHub Integration (existing)
  - Repositories (existing)

View Config (modal)
  - Shows lightfast.yml for selected repository
```

Core components (Phase 1)
- apps/console/src/components/org-chat-interface.tsx — Search shell (exists)
- apps/console/src/components/search-result-card.tsx — Result card (new)
- apps/console/src/components/jobs-list.tsx — Jobs tab content (new)
- apps/console/src/components/job-card.tsx — Job entry (new)
- apps/console/src/components/repository-config-dialog.tsx — View Config modal (new)

Behaviors
- View Config button lives in the search toolbar; opens modal bound to selected repository.
- Tabs inside search switch between Chat and Jobs; Chat remains default.
- Workspace is implicit (default workspace per org) in Phase 1.

Acceptance criteria
- Search page loads with Chat tab selected and repository selector populated if repos exist.
- Switching to Jobs tab renders jobs list and polls for active jobs.
- View Config modal accurately shows lightfast.yml or a setup hint when missing.

Out of scope (Phase 1)
- Workspace switcher in header (Phase 2)
- Linear/Notion sources
- Global multi-page navigation beyond Search and Settings

