---
title: Database Schema for Multi-Source Support
description: Clean schema design for Phase 2 multi-source integration (no backward compatibility needed)
status: draft
owner: engineering
audience: engineering
last_updated: 2025-11-12
tags: [phase2, database, schema, migration]
---

# Database Schema for Multi-Source Support

Clean, ideal schema design for multi-source support. Since we're not in production, we can design the perfect schema without backward compatibility concerns.

---

## Design Principles

1. **Source-Agnostic Core:** Common fields at top level, source-specific in JSONB
2. **Type Safety:** Discriminated unions via `source_type` enum + TypeScript
3. **Query Efficiency:** Indexed by source type, external IDs, relationships
4. **Extensible:** Adding new sources requires no schema changes
5. **Clean:** No legacy GitHub-specific columns cluttering the schema

---

## New Schema Design

### 1. Source Type Enum

```sql
CREATE TYPE source_type AS ENUM (
  'github',
  'linear',
  'notion',
  'sentry',
  'vercel',
  'zendesk'
);
```

---

### 2. Documents Table (REPLACED)

**Drop old table, create new:**

```typescript
// db/console/src/schema/tables/docs-documents.ts
import { pgTable, varchar, timestamp, jsonb, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { randomUUID } from "node:crypto";
import { stores } from "./stores";
import { sourceTypeEnum } from "../enums";

export const docsDocuments = pgTable(
  "lightfast_docs_documents",
  {
    // ===== UNIVERSAL FIELDS =====
    /** Unique identifier for the document */
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    /** Store this document belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),

    // ===== SOURCE IDENTIFICATION =====
    /** Source type discriminator */
    sourceType: sourceTypeEnum("source_type").notNull(),

    /** External identifier from source (LIN-123, path, issue ID, etc.) */
    sourceId: varchar("source_id", { length: 255 }).notNull(),

    /** Source-specific metadata (discriminated by sourceType) */
    sourceMetadata: jsonb("source_metadata").$type<DocumentSourceMetadata>().notNull(),

    // ===== DOCUMENT HIERARCHY =====
    /** Parent document ID (for hierarchical docs like comments) */
    parentDocId: varchar("parent_doc_id", { length: 191 }),

    // ===== CONTENT METADATA =====
    /** URL-friendly slug */
    slug: varchar("slug", { length: 256 }).notNull(),

    /** Content hash (SHA-256) for change detection */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),

    /** Configuration hash (embedding model + chunking config) */
    configHash: varchar("config_hash", { length: 64 }),

    /** Parsed frontmatter/metadata */
    frontmatter: jsonb("frontmatter"),

    /** Number of chunks in latest version */
    chunkCount: integer("chunk_count").notNull().default(0),

    // ===== RELATIONSHIPS =====
    /** Cross-source relationships and mentions */
    relationships: jsonb("relationships").$type<DocumentRelationships>(),

    // ===== TIMESTAMPS =====
    /** When the document was first created */
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    /** When the document was last updated */
    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    // Primary indexes
    byStore: index("idx_docs_store").on(table.storeId),
    bySlug: index("idx_docs_store_slug").on(table.storeId, table.slug),

    // Source indexes
    bySourceType: index("idx_docs_source_type").on(table.sourceType),
    bySourceId: index("idx_docs_source_id").on(table.sourceType, table.sourceId),

    // Hierarchy index
    byParent: index("idx_docs_parent").on(table.parentDocId),

    // Unique constraint
    uniqueSlug: uniqueIndex("uq_docs_store_slug").on(table.storeId, table.slug),
  })
);

export type DocsDocument = typeof docsDocuments.$inferSelect;
export type InsertDocsDocument = typeof docsDocuments.$inferInsert;

export const insertDocsDocumentSchema = createInsertSchema(docsDocuments);
export const selectDocsDocumentSchema = createSelectSchema(docsDocuments);
```

**SQL:**
```sql
CREATE TABLE lightfast_docs_documents (
  id VARCHAR(191) PRIMARY KEY,
  store_id VARCHAR(191) NOT NULL REFERENCES lightfast_stores(id) ON DELETE CASCADE,

  -- Source identification
  source_type source_type NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  source_metadata JSONB NOT NULL,

  -- Document hierarchy
  parent_doc_id VARCHAR(191),

  -- Content metadata
  slug VARCHAR(256) NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  config_hash VARCHAR(64),
  frontmatter JSONB,
  chunk_count INTEGER DEFAULT 0 NOT NULL,

  -- Relationships
  relationships JSONB,

  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_docs_store ON lightfast_docs_documents(store_id);
CREATE INDEX idx_docs_store_slug ON lightfast_docs_documents(store_id, slug);
CREATE INDEX idx_docs_source_type ON lightfast_docs_documents(source_type);
CREATE INDEX idx_docs_source_id ON lightfast_docs_documents(source_type, source_id);
CREATE INDEX idx_docs_parent ON lightfast_docs_documents(parent_doc_id);
CREATE UNIQUE INDEX uq_docs_store_slug ON lightfast_docs_documents(store_id, slug);

-- Optional: GIN index for JSONB queries
CREATE INDEX idx_docs_metadata_gin ON lightfast_docs_documents USING GIN (source_metadata);
CREATE INDEX idx_docs_relationships_gin ON lightfast_docs_documents USING GIN (relationships);
```

---

### 3. Connected Sources Table (NEW)

**Replaces `DeusConnectedRepository`:**

```typescript
// db/console/src/schema/tables/connected-sources.ts
export const connectedSources = pgTable(
  "lightfast_connected_sources",
  {
    /** Unique identifier */
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    /** Organization that owns this connection */
    organizationId: varchar("organization_id", { length: 191 })
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    /** Workspace this source feeds into */
    workspaceId: varchar("workspace_id", { length: 191 })
      .references(() => workspaces.id, { onDelete: "set null" }),

    // ===== SOURCE IDENTIFICATION =====
    /** Source type discriminator */
    sourceType: sourceTypeEnum("source_type").notNull(),

    /** Display name for UI */
    displayName: varchar("display_name", { length: 255 }).notNull(),

    /** Source-specific connection metadata */
    sourceMetadata: jsonb("source_metadata").$type<SourceConnectionMetadata>().notNull(),

    // ===== STATUS =====
    /** Whether this connection is active */
    isActive: boolean("is_active").notNull().default(true),

    /** Configuration status */
    configStatus: varchar("config_status", { length: 16 }).default("pending"),

    // ===== METRICS =====
    /** Total indexed documents */
    documentCount: integer("document_count").notNull().default(0),

    /** Last successful sync */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: false }),

    /** Last successful ingestion */
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: false }),

    /** When connection was established */
    connectedAt: timestamp("connected_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    // ===== TIMESTAMPS =====
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    updatedAt: timestamp("updated_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    byOrg: index("idx_sources_org").on(table.organizationId),
    byWorkspace: index("idx_sources_workspace").on(table.workspaceId),
    byType: index("idx_sources_type").on(table.sourceType),
    byOrgType: index("idx_sources_org_type").on(table.organizationId, table.sourceType),
    byOrgActive: index("idx_sources_org_active").on(table.organizationId, table.isActive),
  })
);

export type ConnectedSource = typeof connectedSources.$inferSelect;
export type InsertConnectedSource = typeof connectedSources.$inferInsert;
```

---

### 4. Store Sources Table (NEW)

**Links sources to stores (many-to-many):**

```typescript
// db/console/src/schema/tables/store-sources.ts
export const storeSources = pgTable(
  "lightfast_store_sources",
  {
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    /** Store this source feeds */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),

    /** Connected source */
    sourceId: varchar("source_id", { length: 191 })
      .notNull()
      .references(() => connectedSources.id, { onDelete: "cascade" }),

    /** When the link was created */
    linkedAt: timestamp("linked_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    byStore: index("idx_store_sources_store").on(table.storeId),
    bySource: index("idx_store_sources_source").on(table.sourceId),
    uniqueLink: uniqueIndex("uq_store_sources_link").on(table.storeId, table.sourceId),
  })
);
```

---

### 5. Ingestion Events Table (NEW)

**Replaces `ingestionCommits`:**

```typescript
// db/console/src/schema/tables/ingestion-events.ts
export const ingestionEvents = pgTable(
  "lightfast_ingestion_events",
  {
    /** Unique event identifier */
    id: varchar("id", { length: 191 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    /** Store this event belongs to */
    storeId: varchar("store_id", { length: 191 })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),

    /** Source type that generated this event */
    sourceType: sourceTypeEnum("source_type").notNull(),

    /** Idempotency key (unique per store + source) */
    eventKey: varchar("event_key", { length: 255 }).notNull(),

    /** Source-specific event metadata */
    eventMetadata: jsonb("event_metadata").$type<EventMetadata>().notNull(),

    /** Processing status */
    status: varchar("status", { length: 16 }).notNull().default("processed"),

    /** When the event was processed */
    processedAt: timestamp("processed_at", { withTimezone: false })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    byStore: index("idx_events_store").on(table.storeId),
    byType: index("idx_events_type").on(table.sourceType),
    byStatus: index("idx_events_status").on(table.status),
    uniqueEvent: uniqueIndex("uq_event_key").on(table.storeId, table.sourceType, table.eventKey),
  })
);
```

---

## TypeScript Types

### Document Source Metadata

```typescript
// packages/console-source-types/src/documents.ts

export interface GitHubDocMetadata {
  type: "github";
  path: string;           // File path in repo
  commitSha: string;      // Git commit
  committedAt: string;    // Commit timestamp
  repoFullName: string;   // owner/repo
  branch?: string;        // Branch name
}

export interface LinearDocMetadata {
  type: "linear";
  kind: "issue" | "comment" | "project";

  // Common fields
  id: string;             // Linear UUID
  url: string;            // Direct link
  createdAt: string;
  updatedAt: string;

  // Issue-specific
  identifier?: string;    // LIN-123
  teamId?: string;
  teamKey?: string;       // ENG
  projectId?: string;
  state?: string;         // todo, in-progress, done, canceled
  priority?: number;      // 0-4
  labels?: string[];
  assigneeId?: string;

  // Comment-specific
  issueId?: string;       // Parent issue UUID
  issueIdentifier?: string; // LIN-123
  userId?: string;
  userName?: string;
}

export interface NotionDocMetadata {
  type: "notion";
  kind: "database-page" | "doc-page";

  pageId: string;
  databaseId?: string;
  title: string;
  url: string;

  // Database page properties
  properties?: Record<string, unknown>;

  lastEditedTime: string;
  lastEditedBy?: string;
}

export interface SentryDocMetadata {
  type: "sentry";
  kind: "issue";

  issueId: string;
  shortId: string;        // PROJ-ABC
  project: string;
  platform?: string;

  // Error details
  level: string;          // error, warning, fatal
  status: string;         // unresolved, resolved, ignored
  culprit?: string;       // Function/module that threw

  // Aggregated metadata
  count: number;          // Event count
  userCount?: number;
  environments: string[];
  releases: string[];
  tags: Record<string, string[]>;

  // Timestamps
  firstSeen: string;
  lastSeen: string;

  url: string;
}

export interface VercelDocMetadata {
  type: "vercel";
  kind: "deployment";

  deploymentId: string;
  deploymentUrl: string;
  project: string;

  // Deployment info
  environment: string;    // production, preview
  status: string;         // READY, ERROR, BUILDING
  target?: string;        // production, staging

  // Build info
  commitSha?: string;
  commitMessage?: string;
  branch?: string;

  // Errors (if failed)
  errorCount?: number;
  errorSummary?: string;

  // Timestamps
  createdAt: string;
  readyAt?: string;

  url: string;
}

export interface ZendeskDocMetadata {
  type: "zendesk";
  kind: "ticket" | "article";

  // Common
  url: string;
  updatedAt: string;

  // Ticket-specific
  ticketId?: number;
  status?: string;        // new, open, pending, solved
  priority?: string;      // low, normal, high, urgent
  ticketType?: string;    // problem, incident, question, task
  assigneeId?: number;
  submitterId?: number;
  tags?: string[];
  commentCount?: number;

  // Article-specific
  articleId?: number;
  sectionId?: number;
  locale?: string;        // en-us
  promoted?: boolean;
  voteSum?: number;       // Helpfulness
}

export type DocumentSourceMetadata =
  | GitHubDocMetadata
  | LinearDocMetadata
  | NotionDocMetadata
  | SentryDocMetadata
  | VercelDocMetadata
  | ZendeskDocMetadata;
```

### Document Relationships

```typescript
export interface DocumentRelationships {
  /** Explicit mentions extracted from content */
  mentions?: {
    github?: string[];    // ["owner/repo#123", "owner/repo#456"]
    linear?: string[];    // ["LIN-123", "ENG-456"]
    notion?: string[];    // [pageId1, pageId2]
    sentry?: string[];    // ["PROJ-ABC", "PROJ-XYZ"]
    vercel?: string[];    // [deploymentId1, deploymentId2]
    zendesk?: string[];   // ["#7890", "#7891"]
  };

  /** Temporal relationships (inferred) */
  temporal?: {
    deploymentId?: string;      // Vercel deployment
    commitSha?: string;         // Git commit
    beforeEventId?: string;     // Previous event
    afterEventId?: string;      // Next event
  };

  /** Graph relationships (explicit) */
  graph?: {
    resolves?: string[];        // This PR resolves these issues
    blockedBy?: string[];       // Blocked by these items
    dependsOn?: string[];       // Depends on these items
    relatedTo?: string[];       // Related items
  };
}
```

### Source Connection Metadata

```typescript
// packages/console-source-types/src/connections.ts

export interface GitHubSourceMetadata {
  type: "github";
  githubRepoId: string;
  githubInstallationId: string;
  repoFullName: string;
  owner: string;
  defaultBranch: string;
  language?: string;
  private: boolean;
  permissions: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
  configPath?: string;      // Path to lightfast.yml
}

export interface LinearSourceMetadata {
  type: "linear";
  linearTeamId: string;
  linearTeamKey: string;    // ENG
  linearOrganizationId: string;
  teamName: string;
  webhookId?: string;
  accessTokenHash?: string; // Encrypted/hashed token
}

export interface NotionSourceMetadata {
  type: "notion";
  notionWorkspaceId: string;
  notionWorkspaceName: string;
  databaseIds: string[];
  webhookId?: string;
  accessTokenHash?: string;
}

export interface SentrySourceMetadata {
  type: "sentry";
  sentryOrganizationSlug: string;
  sentryProjectSlug: string;
  sentryProjectId: string;
  webhookId?: string;
  accessTokenHash?: string;
}

export interface VercelSourceMetadata {
  type: "vercel";
  vercelProjectId: string;
  vercelTeamId?: string;
  projectName: string;
  webhookId?: string;
  accessTokenHash?: string;
}

export interface ZendeskSourceMetadata {
  type: "zendesk";
  zendeskSubdomain: string;
  zendeskAccountId: string;
  webhookId?: string;
  accessTokenHash?: string;
}

export type SourceConnectionMetadata =
  | GitHubSourceMetadata
  | LinearSourceMetadata
  | NotionSourceMetadata
  | SentrySourceMetadata
  | VercelSourceMetadata
  | ZendeskSourceMetadata;
```

### Event Metadata

```typescript
// packages/console-source-types/src/events.ts

export interface GitHubEventMetadata {
  type: "github";
  action: "push";
  beforeSha: string;
  afterSha: string;
  deliveryId: string;
  pusher: string;
  ref: string;            // refs/heads/main
  repository: string;     // owner/repo
}

export interface LinearEventMetadata {
  type: "linear";
  action: "create" | "update" | "remove";
  webhookId: string;

  issueId?: string;
  commentId?: string;
  projectId?: string;

  updatedAt: string;
}

export interface NotionEventMetadata {
  type: "notion";
  action: "created" | "updated" | "deleted";
  webhookId: string;

  pageId: string;
  databaseId?: string;

  lastEditedTime: string;
}

export interface SentryEventMetadata {
  type: "sentry";
  action: "created" | "assigned" | "resolved" | "event.created";
  webhookId: string;

  issueId: string;
  eventId?: string;
  level?: string;

  triggeredAt: string;
}

export interface VercelEventMetadata {
  type: "vercel";
  action: "deployment.created" | "deployment.ready" | "deployment.error";
  webhookId: string;

  deploymentId: string;
  deploymentUrl: string;
  state: string;
  environment: string;

  triggeredAt: string;
}

export interface ZendeskEventMetadata {
  type: "zendesk";
  action: "ticket.created" | "ticket.updated" | "article.published" | "article.updated";
  webhookId: string;

  ticketId?: number;
  articleId?: number;

  triggeredAt: string;
}

export type EventMetadata =
  | GitHubEventMetadata
  | LinearEventMetadata
  | NotionEventMetadata
  | SentryEventMetadata
  | VercelEventMetadata
  | ZendeskEventMetadata;
```

---

## Migration from Current Schema

### Step 1: Export Existing Data

```typescript
// scripts/export-existing-data.ts
import { db } from "@db/console/client";
import { docsDocuments as oldDocs, ingestionCommits } from "@db/console/schema";

// Export documents
const existingDocs = await db.select().from(oldDocs);
await fs.writeFile(
  "migration-data/docs.json",
  JSON.stringify(existingDocs, null, 2)
);

// Export ingestion commits
const existingCommits = await db.select().from(ingestionCommits);
await fs.writeFile(
  "migration-data/commits.json",
  JSON.stringify(existingCommits, null, 2)
);
```

### Step 2: Drop Old Tables, Create New

```sql
-- Drop old tables (backup first!)
DROP TABLE IF EXISTS lightfast_ingestion_commits;
DROP TABLE IF EXISTS lightfast_store_repositories;
DROP TABLE IF EXISTS lightfast_docs_documents;
DROP TABLE IF EXISTS lightfast_deus_connected_repository;

-- Create enum
CREATE TYPE source_type AS ENUM ('github', 'linear', 'notion', 'sentry', 'vercel', 'zendesk');

-- Create new tables (see full SQL above)
CREATE TABLE lightfast_docs_documents (...);
CREATE TABLE lightfast_connected_sources (...);
CREATE TABLE lightfast_store_sources (...);
CREATE TABLE lightfast_ingestion_events (...);
```

### Step 3: Import Transformed Data

```typescript
// scripts/import-transformed-data.ts
import { db } from "@db/console/client";
import { docsDocuments, connectedSources, ingestionEvents } from "@db/console/schema";

const oldDocs = JSON.parse(await fs.readFile("migration-data/docs.json", "utf-8"));

// Transform and insert documents
for (const oldDoc of oldDocs) {
  await db.insert(docsDocuments).values({
    id: oldDoc.id,
    storeId: oldDoc.storeId,

    // Source metadata
    sourceType: "github",
    sourceId: oldDoc.path,
    sourceMetadata: {
      type: "github",
      path: oldDoc.path,
      commitSha: oldDoc.commitSha,
      committedAt: oldDoc.committedAt,
      repoFullName: extractRepoFromId(oldDoc.id),
    },

    // Content metadata
    slug: oldDoc.slug,
    contentHash: oldDoc.contentHash,
    configHash: oldDoc.configHash,
    frontmatter: oldDoc.frontmatter,
    chunkCount: oldDoc.chunkCount,

    // Timestamps
    createdAt: oldDoc.createdAt,
    updatedAt: oldDoc.updatedAt,
  });
}

// Transform and insert connected sources
const oldRepos = await db.select().from(oldConnectedRepos);
for (const oldRepo of oldRepos) {
  await db.insert(connectedSources).values({
    id: oldRepo.id,
    organizationId: oldRepo.organizationId,
    workspaceId: oldRepo.workspaceId,

    sourceType: "github",
    displayName: oldRepo.metadata.fullName,
    sourceMetadata: {
      type: "github",
      githubRepoId: oldRepo.githubRepoId,
      githubInstallationId: oldRepo.githubInstallationId,
      repoFullName: oldRepo.metadata.fullName,
      owner: oldRepo.metadata.owner?.login,
      defaultBranch: oldRepo.metadata.defaultBranch,
      language: oldRepo.metadata.language,
      private: oldRepo.metadata.private,
      permissions: oldRepo.permissions,
      configPath: oldRepo.configPath,
    },

    isActive: oldRepo.isActive,
    configStatus: oldRepo.configStatus,
    documentCount: oldRepo.documentCount,
    lastSyncedAt: oldRepo.lastSyncedAt,
    lastIngestedAt: oldRepo.lastIngestedAt,
    connectedAt: oldRepo.connectedAt,
  });
}

// Transform ingestion commits to events
const oldCommits = JSON.parse(await fs.readFile("migration-data/commits.json", "utf-8"));
for (const oldCommit of oldCommits) {
  await db.insert(ingestionEvents).values({
    id: oldCommit.id,
    storeId: oldCommit.storeId,

    sourceType: "github",
    eventKey: oldCommit.deliveryId,
    eventMetadata: {
      type: "github",
      action: "push",
      beforeSha: oldCommit.beforeSha,
      afterSha: oldCommit.afterSha,
      deliveryId: oldCommit.deliveryId,
    },

    status: oldCommit.status,
    processedAt: oldCommit.processedAt,
  });
}
```

---

## Query Patterns

### Find Documents by Source

```typescript
// Get all Linear issues
const linearIssues = await db.query.docsDocuments.findMany({
  where: eq(docsDocuments.sourceType, "linear"),
});

// Get Linear issues in specific state
const inProgressIssues = await db.query.docsDocuments.findMany({
  where: and(
    eq(docsDocuments.sourceType, "linear"),
    sql`${docsDocuments.sourceMetadata}->>'state' = 'in-progress'`
  ),
});
```

### Find by External ID

```typescript
// Find Linear issue LIN-123
const issue = await db.query.docsDocuments.findFirst({
  where: and(
    eq(docsDocuments.sourceType, "linear"),
    eq(docsDocuments.sourceId, "LIN-123")
  ),
});

// Find GitHub file by path
const file = await db.query.docsDocuments.findFirst({
  where: and(
    eq(docsDocuments.sourceType, "github"),
    eq(docsDocuments.sourceId, "docs/api/search.md")
  ),
});
```

### Find Related Documents

```typescript
// Get document with relationships
const doc = await db.query.docsDocuments.findFirst({
  where: eq(docsDocuments.id, docId),
});

if (doc?.relationships?.mentions?.github) {
  // Find mentioned GitHub PRs
  const relatedDocs = await db.query.docsDocuments.findMany({
    where: and(
      eq(docsDocuments.sourceType, "github"),
      sql`${docsDocuments.sourceId} = ANY(${doc.relationships.mentions.github})`
    ),
  });
}
```

### Find Child Documents

```typescript
// Find all comments on a Linear issue
const comments = await db.query.docsDocuments.findMany({
  where: and(
    eq(docsDocuments.parentDocId, issueDocId),
    eq(docsDocuments.sourceType, "linear")
  ),
  orderBy: [asc(docsDocuments.createdAt)],
});
```

---

## Drizzle Schema Files

### Create Enum File

```typescript
// db/console/src/schema/enums.ts
import { pgEnum } from "drizzle-orm/pg-core";

export const sourceTypeEnum = pgEnum("source_type", [
  "github",
  "linear",
  "notion",
  "sentry",
  "vercel",
  "zendesk",
]);

export type SourceType = typeof sourceTypeEnum.enumValues[number];
```

### Update Index File

```typescript
// db/console/src/schema/index.ts
export * from "./enums";
export * from "./tables/docs-documents";
export * from "./tables/connected-sources";
export * from "./tables/store-sources";
export * from "./tables/ingestion-events";
// ... other tables
```

---

## Benefits of Clean Schema

✅ **No Legacy Baggage:** Every column has a purpose
✅ **Type Safe:** Discriminated unions work perfectly
✅ **Query Efficient:** Indexes designed for multi-source queries
✅ **Extensible:** Add new source = no schema changes
✅ **Maintainable:** Simple, clear structure

---

## Next Steps

1. **Backup current database** (just in case)
2. **Run export script** to save existing data
3. **Drop old tables and create new** (one-time migration)
4. **Import transformed data** back into new schema
5. **Update application code** to use new schema
6. **Test thoroughly** with existing GitHub data
7. **Start implementing Linear integration** using clean schema

---

## References

- [Multi-Source Integration Strategy](./multi-source-integration.md)
- [Phase 2 README](./README.md)
