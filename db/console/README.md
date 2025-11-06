# @db/console

Database schemas and client for Lightfast console application.

## Purpose

Provides Drizzle ORM schemas for the Lightfast data model, including:
- Store identity and configuration
- Document state and metadata
- Vector entry mappings for idempotent operations
- Ingestion commit audit trail

## Installation

This is an internal workspace package. Install dependencies from the monorepo root:

```bash
pnpm install
```

## Usage

```typescript
import { db } from "@db/console/client";
import { stores, docsDocuments, vectorEntries, ingestionCommits } from "@db/console/schema";

// Query documents
const docs = await db.select().from(docsDocuments).limit(10);
```

## Database Commands

```bash
# Generate migration
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open database studio
pnpm db:studio
```

## Schema Structure

- `lf_stores` - Store identity and config per `(workspaceId, store)`
- `lf_docs_documents` - Document state per repo-relative file path
- `lf_vector_entries` - Chunk → vector ID mapping for idempotent upsert/delete
- `lf_ingestion_commits` - Idempotency and audit trail for push deliveries

## Documentation

For detailed schema definitions, see [docs/architecture/phase1/data-model.md](../../docs/architecture/phase1/data-model.md).
