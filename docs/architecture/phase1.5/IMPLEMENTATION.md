# Phase 1.5 Implementation Summary

**Status:** Infrastructure Complete, Testing Pending
**Date:** 2025-11-12
**Goal:** Multi-source infrastructure with GitHub-only implementation

---

## What is Phase 1.5?

Phase 1.5 sets up the **multi-source infrastructure** (database schema, generic workflows) while maintaining **GitHub-only implementation**. This allows us to support Linear, Notion, Sentry, Vercel, and Zendesk in Phase 2 without major refactoring.

**Key Principle:** Build the abstraction now, implement sources later.

---

## Changes Made

### 1. Database Schema Updates

#### New Tables

**`lightfast_connected_sources`** - Multi-source connection tracking
```typescript
{
  id: string;
  organizationId: string;
  workspaceId: string | null;
  sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
  displayName: string;
  sourceMetadata: JSONB; // Source-specific data
  isActive: boolean;
  documentCount: number;
  lastIngestedAt: timestamp;
  lastSyncedAt: timestamp;
  connectedAt: timestamp;
}
```

**`lightfast_ingestion_events`** - Multi-source event tracking
```typescript
{
  id: string;
  storeId: string;
  sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
  eventKey: string; // Source-specific idempotency key
  eventMetadata: JSONB; // Source-specific event data
  source: "webhook" | "backfill" | "manual" | "api";
  status: "processed" | "skipped" | "failed";
  processedAt: timestamp;
}
```

#### Updated Tables

**`lightfast_docs_documents`** - Now source-agnostic
```typescript
{
  id: string;
  storeId: string;

  // NEW: Multi-source fields (discriminated union)
  sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
  sourceId: string; // Source-specific identifier (e.g., file path, issue ID)
  sourceMetadata: JSONB; // Source-specific data

  // NEW: Document hierarchy
  parentDocId: string | null; // For nested documents (e.g., comments)

  slug: string;
  contentHash: string;
  configHash: string;
  chunkCount: number;

  // NEW: Cross-source relationships
  relationships: JSONB;

  createdAt: timestamp;
  updatedAt: timestamp;
}
```

**Removed GitHub-specific columns:**
- `path` → Moved to `sourceId`
- `commitSha` → Moved to `sourceMetadata.commitSha`
- `committedAt` → Moved to `sourceMetadata.committedAt`
- `frontmatter` → Moved to `sourceMetadata.frontmatter`

### 2. Workflow Architecture

#### New Workflow Organization

```
api/console/src/inngest/workflow/
├── shared/                          # Generic multi-source workflows
│   ├── process-documents.ts        # Generic document processor
│   ├── delete-documents.ts         # Generic document deleter
│   └── extract-relationships.ts    # Generic relationship extractor
├── sources/                         # Source-specific adapters
│   └── github-adapter.ts           # GitHub adapter (Phase 1.5)
├── docs-ingestion.ts               # GitHub webhook orchestrator (unchanged)
└── ensure-store.ts                 # Store provisioning (unchanged)
```

#### Workflow Flow (Phase 1.5)

```
GitHub Webhook
    ↓
docsIngestion (docs-ingestion.ts)
  - Loads lightfast.yml
  - Filters files by globs
  - Emits: docs.file.process / docs.file.delete
    ↓
GitHub Adapters (github-adapter.ts)
  - githubProcessAdapter: Fetches file content, transforms to generic format
  - githubDeleteAdapter: Transforms delete event to generic format
  - Emits: documents.process / documents.delete
    ↓
Generic Workflows (shared/)
  - processDocuments: Chunks, embeds, upserts to Pinecone, saves to DB
  - deleteDocuments: Deletes from Pinecone and DB
  - extractRelationships: Extracts cross-source relationships
```

#### Event Schema (Generic)

**Process Event:**
```typescript
{
  name: "apps-console/documents.process",
  data: {
    workspaceId: string;
    storeSlug: string;
    documentId: string;

    // Multi-source fields
    sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
    sourceId: string;
    sourceMetadata: object;

    // Document content
    title: string;
    content: string;
    contentHash: string;

    // Optional
    parentDocId?: string;
    metadata?: object;
    relationships?: object;
  }
}
```

**Delete Event:**
```typescript
{
  name: "apps-console/documents.delete",
  data: {
    workspaceId: string;
    storeSlug: string;
    documentId: string;
    sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
    sourceId: string;
  }
}
```

### 3. GitHub Adapter Implementation

**`github-adapter.ts`** bridges GitHub-specific events to generic workflows:

1. **githubProcessAdapter**
   - Receives: `apps-console/docs.file.process` (GitHub-specific)
   - Fetches file content from GitHub
   - Transforms to generic format with `sourceType="github"`
   - Emits: `apps-console/documents.process` (generic)

2. **githubDeleteAdapter**
   - Receives: `apps-console/docs.file.delete` (GitHub-specific)
   - Transforms to generic format
   - Emits: `apps-console/documents.delete` (generic)

### 4. Updated Inngest Registration

**`api/console/src/inngest/index.ts`** now registers:
- ✅ `docsIngestion` - GitHub webhook orchestrator
- ✅ `ensureStore` - Store provisioning
- ✅ `githubProcessAdapter` - GitHub → Generic (process)
- ✅ `githubDeleteAdapter` - GitHub → Generic (delete)
- ✅ `processDocuments` - Generic document processor
- ✅ `deleteDocuments` - Generic document deleter
- ✅ `extractRelationships` - Generic relationship extractor

**Deprecated:**
- ❌ `processDoc` - Replaced by `githubProcessAdapter` + `processDocuments`
- ❌ `deleteDoc` - Replaced by `githubDeleteAdapter` + `deleteDocuments`

---

## Files Created

| File | Purpose |
|------|---------|
| `db/console/src/schema/tables/connected-sources.ts` | Multi-source connections table |
| `db/console/src/schema/tables/ingestion-events.ts` | Multi-source event tracking table |
| `api/console/src/inngest/workflow/shared/process-documents.ts` | Generic document processor |
| `api/console/src/inngest/workflow/shared/delete-documents.ts` | Generic document deleter |
| `api/console/src/inngest/workflow/shared/extract-relationships.ts` | Generic relationship extractor |
| `api/console/src/inngest/workflow/sources/github-adapter.ts` | GitHub adapter workflows |

## Files Modified

| File | Changes |
|------|---------|
| `db/console/src/schema/tables/docs-documents.ts` | Added `sourceType`, `sourceId`, `sourceMetadata`, `parentDocId`, `relationships` |
| `db/console/src/schema/tables/index.ts` | Export new tables |
| `api/console/src/inngest/index.ts` | Register new workflows, deprecate old ones |

## Files Unchanged (Work As-Is)

| File | Status |
|------|--------|
| `api/console/src/inngest/workflow/docs-ingestion.ts` | ✅ No changes needed |
| `api/console/src/inngest/workflow/ensure-store.ts` | ✅ Already source-agnostic |

---

## Testing Checklist

### Database Schema (No Migration Needed)

**Note:** Since we're not in production, no migration is needed. The schema changes will be applied on next deployment.

- [ ] Verify schema compiles: `cd db/console && pnpm typecheck`
- [ ] Review schema in `db/console/src/schema/tables/`
- [ ] Verify schema: `pnpm db:studio` (after deployment)

### GitHub Integration Testing

- [ ] Start dev server: `pnpm dev:console`
- [ ] Verify Inngest dashboard shows new workflows
- [ ] Trigger GitHub push webhook (manual or actual push)
- [ ] Verify workflow execution:
  1. `docsIngestion` processes webhook
  2. `githubProcessAdapter` transforms event
  3. `processDocuments` chunks and embeds
  4. Document saved with `sourceType="github"`
- [ ] Verify file deletion workflow
- [ ] Check Pinecone for correct metadata
- [ ] Check database for correct `sourceType`, `sourceId`, `sourceMetadata`

### Data Verification

- [ ] Query documents: `SELECT sourceType, sourceId FROM lightfast_docs_documents LIMIT 10`
- [ ] Verify all GitHub documents have `sourceType='github'`
- [ ] Verify `sourceMetadata` contains GitHub-specific fields (commitSha, repoFullName, etc.)
- [ ] Verify vector entries match document count

---

## Phase 2 Readiness

Phase 1.5 infrastructure is ready for Phase 2 sources:

### Adding Linear (Phase 2)

1. Create `api/console/src/inngest/workflow/sources/linear-ingestion.ts`
2. Implement Linear webhook handler
3. Transform Linear events to generic format
4. Register in `api/console/src/inngest/index.ts`
5. Add Linear connection management in Console UI

**No database changes needed!**

### Adding Other Sources

Same pattern for Notion, Sentry, Vercel, Zendesk:
1. Create source-specific adapter in `sources/`
2. Transform to generic format
3. Register workflow
4. Add connection management UI

---

## Architecture Benefits

✅ **Single source of truth** - Documents table works for all sources
✅ **No table explosion** - JSONB sourceMetadata handles source-specific data
✅ **Gradual migration** - GitHub works while infra is ready for more sources
✅ **Type-safe** - sourceType discriminates union at compile time
✅ **Future-proof** - Adding sources = new adapter, no schema changes
✅ **Cross-source relationships** - Unified relationships JSONB field

---

## Next Steps

1. **Test GitHub integration end-to-end**
2. **Monitor Inngest dashboard for errors**
3. **Deploy to staging**
4. **Verify production readiness**
5. **(Phase 2)** Implement Linear, Notion, Sentry, Vercel, Zendesk adapters

---

## Questions?

See:
- **Database Schema:** `docs/architecture/phase2/database-schema.md`
- **Workflow Architecture:** `docs/architecture/phase2/workflow-architecture.md`
- **Multi-Source Strategy:** `docs/architecture/phase2/multi-source-integration.md`
