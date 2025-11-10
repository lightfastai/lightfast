---
title: Repositories — Onboarding & States
status: approved
audience: engineering, design
last_updated: 2025-11-10
---

# Repositories — Onboarding & States (Phase 1)

Goals
- Make “connect repo → add config → push → indexed → searchable” fast and predictable.
- Reflect repository state in Settings with clear CTAs; minimize dead-ends.

State Machine
```
NOT_CONNECTED
  ↓ Connect
CONNECTED_NO_CONFIG
  ↓ (user adds lightfast.yml and pushes)
SETUP_IN_PROGRESS (optional UI label)
  ↓ Webhook push → docs.ingestion
CONFIGURED → INDEXING → READY

Edge cases
READY → user deletes config → CONFIG_DELETED
CONFIGURED → bad yaml → CONFIG_INVALID
INDEXING → failure → INGESTION_FAILED
```

UI by State (Settings → Repositories)
- CONNECTED_NO_CONFIG
  - Show status chip: “Setup required”
  - CTA: “Add configuration” → copy boilerplate YAML
  - Secondary CTA: “Check configuration” → calls `trpc.repository.detectConfig`
- CONFIGURED
  - Status chip: “Configured” (path shown)
  - Actions: “View Config” (modal), “Re-check config”
- READY
  - Status chip: “Ready” with last ingested time
  - Actions: “View Config”, “Re-check config”
- CONFIG_DELETED / CONFIG_INVALID
  - Status chip: “Config missing/invalid”
  - CTA: “Fix configuration” → copy YAML; “Re-check config”
- INGESTION_FAILED
  - Status chip: “Ingestion failed”
  - CTA: “Open Jobs” tab on Search for details

Happy Path Flow (Phase 1)
1) Connect GitHub and select a repository in Settings → Repositories
2) If missing config, user adds `lightfast.yml` and pushes to default branch
3) GitHub webhook (`/api/github/webhooks`) sends `apps-console/docs.push` to Inngest
4) docs-ingestion loads config, filters changes, triggers file processing
5) process-doc fetches content, parses, chunks, embeds, upserts vectors, writes DB
6) Search returns results for `filters.labels: ["store:<store>"]`

Boilerplate lightfast.yml
```
version: 1
store: docs
include:
  - README.md
```

APIs and Code
- UI
  - Connect dialog: `apps/console/src/components/connect-repository-dialog.tsx`
    - Calls `trpc.repository.connect` then `trpc.repository.detectConfig`
  - Settings list: `apps/console/src/app/(app)/org/[slug]/settings/repositories/page.tsx`
  - View Config (modal): `apps/console/src/components/repository-config-dialog.tsx` (new)
- tRPC
  - `repository.list`, `repository.get`, `repository.connect`, `repository.detectConfig`
  - File: `api/console/src/router/repository.ts`
- Webhook
  - GitHub: `apps/console/src/app/(github)/api/github/webhooks/route.ts`
  - Validates signature; filters non-default branch; triggers Inngest
- Inngest
  - Entry: `apps/console/src/app/(inngest)/api/inngest/route.ts`
  - Workflows: `api/console/src/inngest/workflow/{docs-ingestion,process-doc,delete-doc}.ts`
  - docs-ingestion supports config files: `lightfast.yml`, `.lightfast.yml`, `lightfast.yaml`, `.lightfast.yaml`
  - If no config, defaults include `README.md` as well as `docs/**/*.md{,x}`

Workspace & Store Binding
- Phase 1: workspace is implicit per org (computed as `ws_<orgSlug>`)
- Store name comes from `lightfast.yml` if present; otherwise request-provided default is used
- Store auto-provisioning creates Pinecone index and DB row if missing
  - File: `api/console/src/lib/stores.ts` → `getOrCreateStore`

CTAs and UX Details
- “Add configuration”
  - Shows copyable YAML (above) with short explanation
  - Link to “Create new file” on GitHub (opens repo’s default branch new file UI)
- “Check configuration”
  - Calls `trpc.repository.detectConfig({ repositoryId, organizationId })`
  - Updates `configStatus`, `configPath`, and `workspaceId`
- “View Config”
  - Modal shows repo name, status, and `lightfast.yml` content (fetched via GitHub API)
- “Open Jobs”
  - Navigates to Search and selects Jobs tab for live progress (Phase 1 UI)

Acceptance Tests
- Connect → Detect
  - After connecting, `detectConfig` runs and sets `configured/unconfigured` correctly
- Config present → Push → Ingestion
  - Push to default branch triggers webhook → Inngest → processed vectors and DB rows
- Config missing → Defaults
  - README.md ingested by default with no config (first-time success path)
- Store override
  - `store: my-docs` in config results in vectors and docs bound to that store
- State reflection
  - Settings status chips and CTAs reflect transitions; “Re-check config” updates status
- Searchability
  - `trpc.search.query` with `filters.labels: ["store:<store>"]` returns results

Edge Cases & Recovery
- Config deleted after READY → show “Config missing” and guidance
- Invalid YAML → fallback defaults for ingestion, surface “invalid” state in Settings
- Non-default branch push → webhook ignores, document in UX help
- Re-delivery idempotency → `lightfast_ingestion_commits` prevents double-processing

Notes & Phase 1.1 (optional)
- Automatic PR creation is not implemented; use copy + GitHub “new file” link for now
- If we add PR creation later, surface “Create PR” alongside “Copy config”, and show PR link + merge status

