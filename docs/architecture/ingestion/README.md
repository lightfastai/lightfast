# Ingestion Architecture

**Status:** ✅ GitHub Complete | ⏸️ Other Sources Pending
**Last Updated:** 2025-11-27

---

## What's Implemented

### GitHub Integration (Complete)
- **Webhook Handler** - HMAC signature verification, event routing
  - File: `apps/console/src/app/(github)/api/github/webhooks/route.ts`

- **Sync Orchestrator** - Central coordination for all sources
  - File: `api/console/src/inngest/workflow/orchestration/sync-orchestrator.ts`
  - 7-step workflow: metadata → job → store → route → wait → complete

- **GitHub Sync** - Git Trees API, config-based file filtering
  - File: `api/console/src/inngest/workflow/sources/github-sync-orchestrator.ts`

- **Document Processing** - Chunking, embedding, Pinecone indexing
  - File: `api/console/src/inngest/workflow/processing/process-documents.ts`

---

## Architecture Principles

### Multi-Source Design
- Generic workflows work with any `sourceType` (github, linear, notion, etc.)
- Source-specific adapters handle provider differences
- Adding a new source = 1-2 weeks (just adapter work)

### Event-Driven
- Webhooks → Inngest → Processing → Completion event
- No fire-and-forget (accurate tracking)
- `waitForEvent` pattern for completion

### Security
- HMAC signature verification for all webhooks
- Timing-safe comparisons
- Request ID tracking

---

## How to Add a New Source

**Example: Linear (1-2 weeks)**

1. **Webhook Verification** (`packages/console-webhooks/src/linear.ts`)
   - Implement HMAC signature check

2. **Webhook Route** (`apps/console/src/app/api/linear/webhooks/route.ts`)
   - Verify signature → Send to Inngest

3. **Sync Orchestrator** (`api/console/src/inngest/workflow/sources/linear-sync-orchestrator.ts`)
   - Fetch Linear data via API
   - Transform to generic document format
   - Send to process-documents workflow
   - Emit completion event

4. **Register** in `api/console/src/inngest/index.ts`

**That's it!** The generic processing pipeline handles the rest.

---

## Design Documents

- **[Sync Design](./sync-design.md)** - Overall architecture
- **[Observations Heuristics](./observations-heuristics.md)** - Event capture patterns

---

**See:** `docs/architecture/implementation-status/README.md` for overall status.
