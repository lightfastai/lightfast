---
title: Workflow Architecture for Multi-Source Support
description: Complete Inngest workflow design for GitHub, Linear, Notion, Sentry, Vercel, and Zendesk
status: draft
owner: engineering
audience: engineering
last_updated: 2025-11-12
tags: [phase2, workflows, inngest, architecture]
---

# Workflow Architecture for Multi-Source Support

Complete design of Inngest workflows needed to support multi-source document ingestion, processing, and cross-source linking.

---

## Current Workflows (GitHub Only)

```
api/console/src/inngest/workflow/
├── docs-ingestion.ts         # GitHub push webhook handler
├── ensure-store.ts            # Store creation (REUSABLE ✅)
├── process-doc.ts             # Batch document processing (NEEDS GENERALIZATION)
├── delete-doc.ts              # Document deletion (NEEDS GENERALIZATION)
└── lib/
    └── document-processing.ts # Core processing logic (NEEDS GENERALIZATION)
```

---

## Proposed Workflow Structure

```
api/console/src/inngest/workflow/
├── shared/
│   ├── ensure-store.ts                    # ✅ Keep as-is (already generic)
│   ├── process-documents.ts               # NEW: Generic document processor
│   ├── delete-documents.ts                # NEW: Generic document deleter
│   └── extract-relationships.ts           # NEW: Cross-source relationship extraction
│
├── github/
│   ├── github-ingestion.ts                # RENAME: docs-ingestion.ts
│   ├── github-backfill.ts                 # NEW: Initial/periodic sync
│   └── github-reconciliation.ts           # NEW: Catch missed webhooks
│
├── linear/
│   ├── linear-ingestion.ts                # NEW: Webhook handler
│   ├── linear-backfill.ts                 # NEW: Initial/periodic sync
│   ├── linear-issue-process.ts            # NEW: Issue-specific processing
│   └── linear-comment-process.ts          # NEW: Comment-specific processing
│
├── notion/
│   ├── notion-ingestion.ts                # NEW: Webhook handler
│   ├── notion-backfill.ts                 # NEW: Initial/periodic sync
│   └── notion-page-process.ts             # NEW: Page content fetching + processing
│
├── sentry/
│   ├── sentry-ingestion.ts                # NEW: Webhook handler
│   ├── sentry-backfill.ts                 # NEW: Initial/periodic sync
│   └── sentry-issue-aggregate.ts          # NEW: Event → Issue aggregation
│
├── vercel/
│   ├── vercel-ingestion.ts                # NEW: Webhook handler
│   ├── vercel-backfill.ts                 # NEW: Initial/periodic sync
│   └── vercel-deployment-process.ts       # NEW: Deployment + logs processing
│
├── zendesk/
│   ├── zendesk-ingestion.ts               # NEW: Webhook handler
│   ├── zendesk-backfill.ts                # NEW: Initial/periodic sync
│   └── zendesk-ticket-thread.ts           # NEW: Ticket + comments threading
│
└── lib/
    ├── document-processing.ts             # REFACTOR: Source-agnostic
    ├── github-client.ts                   # EXISTING: GitHub API client
    ├── linear-client.ts                   # NEW: Linear GraphQL client
    ├── notion-client.ts                   # NEW: Notion API client
    ├── sentry-client.ts                   # NEW: Sentry API client
    ├── vercel-client.ts                   # NEW: Vercel API client
    ├── zendesk-client.ts                  # NEW: Zendesk API client
    ├── relationship-extractor.ts          # NEW: Extract mentions/links
    ├── chunking.ts                        # EXISTING: Text chunking
    └── embedding.ts                       # EXISTING: Embedding generation
```

---

## Workflow Definitions

### 1. Shared Workflows (Source-Agnostic)

#### 1.1 `shared/ensure-store.ts` ✅ Keep Existing

**Event:** `apps-console/store.ensure`

**Purpose:** Idempotently create store + Pinecone index

**Already Generic:** Works for all sources

**No Changes Needed**

---

#### 1.2 `shared/process-documents.ts` (NEW - Generalized)

**Event:** `apps-console/documents.process`

**Purpose:** Generic document processor for any source

**Batch Configuration:**
```typescript
batchEvents: {
  maxSize: 20,
  timeout: "5s",
  key: 'event.data.workspaceId + "-" + event.data.storeSlug',
}
```

**Flow:**
```typescript
export const processDocuments = inngest.createFunction(
  {
    id: "apps-console/process-documents",
    idempotency: 'event.data.documentId + "-" + event.data.contentHash',
    batchEvents: { ... },
  },
  { event: "apps-console/documents.process" },
  async ({ events, step }) => {
    // 1. Group by store
    const byStore = groupByStore(events);

    // 2. For each store batch
    for (const [storeId, docs] of Object.entries(byStore)) {
      const store = await step.run("fetch-store", () =>
        db.query.stores.findFirst({ where: eq(stores.id, storeId) })
      );

      // 3. Process documents (source-agnostic)
      const results = await step.run("process-batch", async () => {
        const processed = [];

        for (const doc of docs) {
          // Chunk content (already chunked by source-specific handler)
          const chunks = await chunkText(doc.content, {
            maxTokens: store.chunkMaxTokens,
            overlap: store.chunkOverlap,
          });

          // Embed chunks
          const embeddings = await embedMultiView({
            title: doc.title,
            content: doc.content,
            chunks,
            metadata: doc.metadata,
          });

          // Upsert to Pinecone
          await upsertToPinecone(store.indexName, {
            id: doc.id,
            vectors: embeddings,
            metadata: {
              docId: doc.id,
              sourceType: doc.sourceType,
              sourceId: doc.sourceId,
              slug: doc.slug,
              ...doc.metadata,
            },
          });

          // Save to database
          await db.insert(docsDocuments).values({
            id: doc.id,
            storeId: doc.storeId,
            sourceType: doc.sourceType,
            sourceId: doc.sourceId,
            sourceMetadata: doc.sourceMetadata,
            slug: doc.slug,
            contentHash: doc.contentHash,
            chunkCount: chunks.length,
          });

          processed.push(doc.id);
        }

        return processed;
      });

      // 4. Extract relationships
      await step.sendEvent("extract-relationships", {
        name: "apps-console/relationships.extract",
        data: { documentIds: results },
      });
    }

    return { processed: events.length };
  }
);
```

**Input Schema:**
```typescript
{
  workspaceId: string;
  storeSlug: string;
  documentId: string;        // Unique doc ID
  sourceType: "github" | "linear" | ...;
  sourceId: string;          // External ID (LIN-123, path, etc.)
  sourceMetadata: object;    // Source-specific metadata

  // Content
  title: string;
  content: string;           // Full text content
  contentHash: string;       // SHA-256

  // Metadata
  metadata: object;          // Additional metadata for Pinecone
  relationships?: object;    // Pre-extracted relationships
}
```

---

#### 1.3 `shared/delete-documents.ts` (NEW - Generalized)

**Event:** `apps-console/documents.delete`

**Purpose:** Delete documents from Pinecone + DB

**Flow:**
```typescript
export const deleteDocuments = inngest.createFunction(
  {
    id: "apps-console/delete-documents",
    batchEvents: { maxSize: 50, timeout: "5s" },
  },
  { event: "apps-console/documents.delete" },
  async ({ events, step }) => {
    const byStore = groupByStore(events);

    for (const [storeId, docs] of Object.entries(byStore)) {
      const store = await step.run("fetch-store", () =>
        db.query.stores.findFirst({ where: eq(stores.id, storeId) })
      );

      // Delete from Pinecone (by doc ID filter)
      await step.run("delete-from-pinecone", async () => {
        const docIds = docs.map(d => d.documentId);
        await pinecone.deleteVectors(store.indexName, {
          filter: { docId: { $in: docIds } }
        });
      });

      // Delete from database
      await step.run("delete-from-db", async () => {
        await db.delete(docsDocuments).where(
          inArray(docsDocuments.id, docs.map(d => d.documentId))
        );
      });
    }

    return { deleted: events.length };
  }
);
```

---

#### 1.4 `shared/extract-relationships.ts` (NEW)

**Event:** `apps-console/relationships.extract`

**Purpose:** Extract cross-source mentions and relationships

**Flow:**
```typescript
export const extractRelationships = inngest.createFunction(
  {
    id: "apps-console/extract-relationships",
    batchEvents: { maxSize: 100, timeout: "10s" },
  },
  { event: "apps-console/relationships.extract" },
  async ({ events, step }) => {
    const documentIds = events.flatMap(e => e.data.documentIds);

    // Fetch documents
    const docs = await step.run("fetch-documents", () =>
      db.query.docsDocuments.findMany({
        where: inArray(docsDocuments.id, documentIds),
      })
    );

    // Extract relationships from content
    const updates = await step.run("extract-relationships", async () => {
      const results = [];

      for (const doc of docs) {
        const content = doc.sourceMetadata.description ||
                       doc.sourceMetadata.body ||
                       "";

        // Extract mentions using regex patterns
        const relationships = {
          mentions: {
            github: extractGitHubMentions(content),
            linear: extractLinearMentions(content),
            sentry: extractSentryMentions(content),
            zendesk: extractZendeskMentions(content),
          }
        };

        // Update document with relationships
        await db.update(docsDocuments)
          .set({ relationships })
          .where(eq(docsDocuments.id, doc.id));

        results.push({ documentId: doc.id, relationships });
      }

      return results;
    });

    return { processed: updates.length };
  }
);
```

---

### 2. Linear Workflows

#### 2.1 `linear/linear-ingestion.ts` (NEW)

**Event:** `apps-console/linear.webhook`

**Triggered By:** Linear webhook (issue.created, issue.updated, comment.created, etc.)

**Flow:**
```typescript
export const linearIngestion = inngest.createFunction(
  {
    id: "apps-console/linear-ingestion",
    idempotency: 'event.data.webhookId + "-" + event.data.action + "-" + event.data.resourceId',
  },
  { event: "apps-console/linear.webhook" },
  async ({ event, step }) => {
    const { action, type, data, webhookId, organizationId } = event.data;

    // 1. Determine resource type
    if (type === "Issue") {
      if (action === "create" || action === "update") {
        await step.sendEvent("process-issue", {
          name: "apps-console/linear.issue.process",
          data: { issue: data, organizationId },
        });
      } else if (action === "remove") {
        await step.sendEvent("delete-issue", {
          name: "apps-console/documents.delete",
          data: {
            documentId: `linear_issue_${data.id}`,
            storeSlug: "product-memory", // From config
          },
        });
      }
    } else if (type === "Comment") {
      if (action === "create") {
        await step.sendEvent("process-comment", {
          name: "apps-console/linear.comment.process",
          data: { comment: data, organizationId },
        });
      }
    }

    // 2. Record event for idempotency
    await step.run("record-event", () =>
      db.insert(ingestionEvents).values({
        id: `${organizationId}_${webhookId}`,
        storeId: "product-memory", // Resolve from config
        sourceType: "linear",
        eventKey: `${webhookId}_${action}_${data.id}`,
        eventMetadata: { type: "linear", action, webhookId, ...data },
      })
    );

    return { processed: true };
  }
);
```

---

#### 2.2 `linear/linear-issue-process.ts` (NEW)

**Event:** `apps-console/linear.issue.process`

**Purpose:** Process Linear issue → document

**Flow:**
```typescript
export const linearIssueProcess = inngest.createFunction(
  {
    id: "apps-console/linear-issue-process",
    idempotency: 'event.data.issue.id + "-" + event.data.issue.updatedAt',
  },
  { event: "apps-console/linear.issue.process" },
  async ({ event, step }) => {
    const { issue, organizationId } = event.data;

    // 1. Ensure store exists
    const { store } = await step.invoke("ensure-store", {
      function: ensureStore,
      data: {
        workspaceId: resolveWorkspaceId(organizationId),
        storeSlug: "product-memory", // From lightfast.yml
      },
    });

    // 2. Fetch full issue details (if needed)
    const fullIssue = await step.run("fetch-issue-details", () =>
      linearClient.fetchIssue(issue.id)
    );

    // 3. Extract relationships
    const relationships = await step.run("extract-relationships", () =>
      extractRelationships(fullIssue.description)
    );

    // 4. Send to generic processor
    await step.sendEvent("process-document", {
      name: "apps-console/documents.process",
      data: {
        workspaceId: store.workspaceId,
        storeSlug: store.slug,
        documentId: `${store.id}_linear_issue_${issue.id}`,
        sourceType: "linear",
        sourceId: issue.identifier, // LIN-123
        sourceMetadata: {
          type: "linear",
          kind: "issue",
          id: issue.id,
          identifier: issue.identifier,
          teamId: issue.team.id,
          teamKey: issue.team.key,
          state: issue.state.name,
          priority: issue.priority,
          labels: issue.labels.nodes.map(l => l.name),
          url: issue.url,
          createdAt: issue.createdAt,
          updatedAt: issue.updatedAt,
        },

        title: issue.title,
        content: issue.description || "",
        contentHash: computeHash(issue.description),

        metadata: {
          state: issue.state.name,
          priority: issue.priority,
          labels: issue.labels.nodes.map(l => l.name),
        },

        relationships,
      },
    });

    return { processed: true };
  }
);
```

---

#### 2.3 `linear/linear-backfill.ts` (NEW)

**Event:** `apps-console/linear.backfill`

**Triggered By:** Manual trigger or source connection

**Purpose:** Backfill historical Linear issues

**Flow:**
```typescript
export const linearBackfill = inngest.createFunction(
  {
    id: "apps-console/linear-backfill",
    concurrency: [{ key: "event.data.teamId", limit: 1 }],
  },
  { event: "apps-console/linear.backfill" },
  async ({ event, step }) => {
    const { teamId, since, organizationId } = event.data;

    let cursor = null;
    let totalIssues = 0;

    do {
      // Paginate through issues
      const { issues, pageInfo } = await step.run(`fetch-page-${cursor || "first"}`, () =>
        linearClient.listIssues({
          teamId,
          first: 50,
          after: cursor,
          filter: {
            createdAt: { gte: since },
          },
        })
      );

      // Send each issue for processing
      await step.sendEvent(`process-issues-${cursor || "first"}`,
        issues.map(issue => ({
          name: "apps-console/linear.issue.process",
          data: { issue, organizationId },
        }))
      );

      totalIssues += issues.length;
      cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;

    } while (cursor);

    return { totalIssues };
  }
);
```

---

### 3. Notion Workflows

#### 3.1 `notion/notion-ingestion.ts` (NEW)

**Event:** `apps-console/notion.webhook`

**Flow:**
```typescript
export const notionIngestion = inngest.createFunction(
  {
    id: "apps-console/notion-ingestion",
    idempotency: 'event.data.eventId + "-" + event.data.pageId',
  },
  { event: "apps-console/notion.webhook" },
  async ({ event, step }) => {
    const { event: eventType, data, eventId } = event.data;

    if (eventType === "page.updated" || eventType === "page.created") {
      await step.sendEvent("process-page", {
        name: "apps-console/notion.page.process",
        data: { page: data, organizationId: event.data.organizationId },
      });
    } else if (eventType === "page.deleted") {
      await step.sendEvent("delete-page", {
        name: "apps-console/documents.delete",
        data: {
          documentId: `notion_page_${data.id}`,
          storeSlug: "knowledge-base",
        },
      });
    }

    return { processed: true };
  }
);
```

---

#### 3.2 `notion/notion-page-process.ts` (NEW)

**Event:** `apps-console/notion.page.process`

**Purpose:** Fetch full page content + process

**Flow:**
```typescript
export const notionPageProcess = inngest.createFunction(
  {
    id: "apps-console/notion-page-process",
    idempotency: 'event.data.page.id + "-" + event.data.page.last_edited_time',
  },
  { event: "apps-console/notion.page.process" },
  async ({ event, step }) => {
    const { page, organizationId } = event.data;

    // 1. Fetch full page content (webhook only sends properties)
    const fullPage = await step.run("fetch-page-content", async () => {
      const pageDetails = await notionClient.getPage(page.id);
      const blocks = await notionClient.getBlockChildren(page.id);

      // Convert blocks to markdown
      const markdown = blocksToMarkdown(blocks);

      return { ...pageDetails, content: markdown };
    });

    // 2. Send to generic processor
    await step.sendEvent("process-document", {
      name: "apps-console/documents.process",
      data: {
        documentId: `notion_page_${page.id}`,
        sourceType: "notion",
        sourceId: page.id,
        sourceMetadata: {
          type: "notion",
          kind: "database-page",
          pageId: page.id,
          databaseId: page.parent.database_id,
          properties: page.properties,
          lastEditedTime: page.last_edited_time,
        },

        title: extractTitle(page.properties),
        content: fullPage.content,
        contentHash: computeHash(fullPage.content),
      },
    });

    return { processed: true };
  }
);
```

---

### 4. Sentry Workflows

#### 4.1 `sentry/sentry-ingestion.ts` (NEW)

**Event:** `apps-console/sentry.webhook`

**Flow:**
```typescript
export const sentryIngestion = inngest.createFunction(
  {
    id: "apps-console/sentry-ingestion",
    idempotency: 'event.data.requestId',
  },
  { event: "apps-console/sentry.webhook" },
  async ({ event, step }) => {
    const { action, data, requestId } = event.data;

    if (action === "created" && data.issue) {
      // New issue created
      await step.sendEvent("aggregate-issue", {
        name: "apps-console/sentry.issue.aggregate",
        data: { issue: data.issue, organizationId: event.data.organizationId },
      });
    } else if (action === "event.created" && data.event) {
      // New event for existing issue
      await step.sendEvent("update-issue", {
        name: "apps-console/sentry.issue.aggregate",
        data: {
          issueId: data.event.issue_id,
          event: data.event,
          organizationId: event.data.organizationId,
        },
      });
    }

    return { processed: true };
  }
);
```

---

#### 4.2 `sentry/sentry-issue-aggregate.ts` (NEW)

**Event:** `apps-console/sentry.issue.aggregate`

**Purpose:** Aggregate Sentry events into issue document

**Flow:**
```typescript
export const sentryIssueAggregate = inngest.createFunction(
  {
    id: "apps-console/sentry-issue-aggregate",
    idempotency: 'event.data.issueId + "-" + event.data.issue?.lastSeen',
  },
  { event: "apps-console/sentry.issue.aggregate" },
  async ({ event, step }) => {
    const { issue, issueId, organizationId } = event.data;

    // Fetch full issue details
    const fullIssue = await step.run("fetch-issue", () =>
      issue || sentryClient.getIssue(issueId)
    );

    // Check if we should re-embed (count doubled, new environment, etc.)
    const shouldReEmbed = await step.run("check-re-embed", async () => {
      const existing = await db.query.docsDocuments.findFirst({
        where: eq(docsDocuments.sourceId, fullIssue.id),
      });

      if (!existing) return true;

      const existingMeta = existing.sourceMetadata as SentryDocMetadata;
      return (
        fullIssue.count > existingMeta.count * 2 || // Doubled
        !existingMeta.environments.includes(fullIssue.environment) // New env
      );
    });

    if (shouldReEmbed) {
      // Format stack trace + breadcrumbs
      const content = await step.run("format-issue", () =>
        formatSentryIssue(fullIssue)
      );

      await step.sendEvent("process-document", {
        name: "apps-console/documents.process",
        data: {
          documentId: `sentry_issue_${fullIssue.id}`,
          sourceType: "sentry",
          sourceId: fullIssue.shortId,
          sourceMetadata: {
            type: "sentry",
            issueId: fullIssue.id,
            shortId: fullIssue.shortId,
            project: fullIssue.project,
            level: fullIssue.level,
            count: fullIssue.count,
            environments: [fullIssue.environment],
            firstSeen: fullIssue.firstSeen,
            lastSeen: fullIssue.lastSeen,
          },

          title: fullIssue.title,
          content,
          contentHash: computeHash(content),
        },
      });
    } else {
      // Just update metadata (no re-embed)
      await step.run("update-metadata", () =>
        db.update(docsDocuments)
          .set({
            sourceMetadata: {
              ...fullIssue,
              count: fullIssue.count,
              lastSeen: fullIssue.lastSeen,
            },
          })
          .where(eq(docsDocuments.sourceId, fullIssue.id))
      );
    }

    return { processed: true };
  }
);
```

---

### 5. Vercel Workflows

#### 5.1 `vercel/vercel-ingestion.ts` (NEW)

**Event:** `apps-console/vercel.webhook`

**Flow:**
```typescript
export const vercelIngestion = inngest.createFunction(
  {
    id: "apps-console/vercel-ingestion",
    idempotency: 'event.data.deployment.id',
  },
  { event: "apps-console/vercel.webhook" },
  async ({ event, step }) => {
    const { type, payload } = event.data;

    if (type === "deployment.succeeded" || type === "deployment.error") {
      await step.sendEvent("process-deployment", {
        name: "apps-console/vercel.deployment.process",
        data: {
          deployment: payload.deployment,
          type,
          organizationId: event.data.organizationId,
        },
      });
    }

    return { processed: true };
  }
);
```

---

#### 5.2 `vercel/vercel-deployment-process.ts` (NEW)

**Event:** `apps-console/vercel.deployment.process`

**Purpose:** Process deployment (fetch logs if failed)

**Flow:**
```typescript
export const vercelDeploymentProcess = inngest.createFunction(
  {
    id: "apps-console/vercel-deployment-process",
    idempotency: 'event.data.deployment.id',
  },
  { event: "apps-console/vercel.deployment.process" },
  async ({ event, step }) => {
    const { deployment, type, organizationId } = event.data;

    let content = `Deployment ${deployment.name} - ${deployment.target}`;

    // Fetch error logs if deployment failed
    if (type === "deployment.error") {
      const logs = await step.run("fetch-error-logs", () =>
        vercelClient.getDeploymentLogs(deployment.id, { filter: "error" })
      );
      content = `${content}\n\nErrors:\n${logs.join("\n")}`;
    }

    // Extract commit SHA for linking
    const commitSha = deployment.meta?.githubCommitSha;

    await step.sendEvent("process-document", {
      name: "apps-console/documents.process",
      data: {
        documentId: `vercel_deployment_${deployment.id}`,
        sourceType: "vercel",
        sourceId: deployment.id,
        sourceMetadata: {
          type: "vercel",
          deploymentId: deployment.id,
          deploymentUrl: deployment.url,
          environment: deployment.target,
          status: type === "deployment.error" ? "ERROR" : "READY",
          commitSha,
          createdAt: deployment.createdAt,
        },

        title: `Deployment: ${deployment.name}`,
        content,
        contentHash: computeHash(content),

        relationships: commitSha ? {
          temporal: { commitSha }
        } : undefined,
      },
    });

    return { processed: true };
  }
);
```

---

### 6. Zendesk Workflows

#### 6.1 `zendesk/zendesk-ingestion.ts` (NEW)

**Event:** `apps-console/zendesk.webhook`

**Flow:**
```typescript
export const zendeskIngestion = inngest.createFunction(
  {
    id: "apps-console/zendesk-ingestion",
    idempotency: 'event.data.eventId',
  },
  { event: "apps-console/zendesk.webhook" },
  async ({ event, step }) => {
    const { event: eventType, ticket_event, organizationId } = event.data;

    if (eventType.includes("ticket")) {
      await step.sendEvent("process-ticket", {
        name: "apps-console/zendesk.ticket.thread",
        data: {
          ticketId: ticket_event.ticket.id,
          organizationId,
        },
      });
    } else if (eventType.includes("article")) {
      // Handle article events
    }

    return { processed: true };
  }
);
```

---

#### 6.2 `zendesk/zendesk-ticket-thread.ts` (NEW)

**Event:** `apps-console/zendesk.ticket.thread`

**Purpose:** Fetch ticket + comments, format as conversation thread

**Flow:**
```typescript
export const zendeskTicketThread = inngest.createFunction(
  {
    id: "apps-console/zendesk-ticket-thread",
    idempotency: 'event.data.ticketId + "-" + Date.now()',
  },
  { event: "apps-console/zendesk.ticket.thread" },
  async ({ event, step }) => {
    const { ticketId, organizationId } = event.data;

    // 1. Fetch ticket + comments
    const { ticket, comments } = await step.run("fetch-ticket", async () => {
      const ticket = await zendeskClient.getTicket(ticketId);
      const comments = await zendeskClient.getTicketComments(ticketId);
      return { ticket, comments };
    });

    // 2. Format as conversation thread
    const content = await step.run("format-thread", () => {
      let thread = `${ticket.subject}\n\n${ticket.description}\n\n---\n\n`;

      for (const comment of comments) {
        thread += `Comment by ${comment.author.name} (${comment.created_at}):\n`;
        thread += `${comment.body}\n\n---\n\n`;
      }

      return thread;
    });

    // 3. Extract relationships
    const relationships = await step.run("extract-relationships", () =>
      extractRelationships(content)
    );

    await step.sendEvent("process-document", {
      name: "apps-console/documents.process",
      data: {
        documentId: `zendesk_ticket_${ticketId}`,
        sourceType: "zendesk",
        sourceId: ticketId.toString(),
        sourceMetadata: {
          type: "zendesk",
          kind: "ticket",
          ticketId,
          status: ticket.status,
          priority: ticket.priority,
          tags: ticket.tags,
          commentCount: comments.length,
        },

        title: ticket.subject,
        content,
        contentHash: computeHash(content),

        relationships,
      },
    });

    return { processed: true };
  }
);
```

---

## Workflow Dependency Graph

```
GitHub Push Webhook
  └→ github-ingestion.ts
      ├→ ensure-store.ts (shared)
      └→ process-documents.ts (shared)
          └→ extract-relationships.ts (shared)

Linear Webhook
  └→ linear-ingestion.ts
      ├→ linear-issue-process.ts
      │   └→ process-documents.ts (shared)
      └→ linear-comment-process.ts
          └→ process-documents.ts (shared)

Notion Webhook
  └→ notion-ingestion.ts
      └→ notion-page-process.ts
          └→ process-documents.ts (shared)

Sentry Webhook
  └→ sentry-ingestion.ts
      └→ sentry-issue-aggregate.ts
          └→ process-documents.ts (shared)

Vercel Webhook
  └→ vercel-ingestion.ts
      └→ vercel-deployment-process.ts
          └→ process-documents.ts (shared)

Zendesk Webhook
  └→ zendesk-ingestion.ts
      └→ zendesk-ticket-thread.ts
          └→ process-documents.ts (shared)

Backfill (Manual Trigger)
  ├→ linear-backfill.ts
  ├→ notion-backfill.ts
  ├→ sentry-backfill.ts
  ├→ vercel-backfill.ts
  └→ zendesk-backfill.ts
```

---

## Event Schema

### Generic Document Process Event

```typescript
{
  name: "apps-console/documents.process",
  data: {
    workspaceId: string;
    storeSlug: string;
    documentId: string;

    sourceType: "github" | "linear" | "notion" | "sentry" | "vercel" | "zendesk";
    sourceId: string;
    sourceMetadata: object;

    title: string;
    content: string;
    contentHash: string;

    metadata?: object;
    relationships?: object;
  }
}
```

### Source-Specific Events

**Linear:**
```typescript
{
  name: "apps-console/linear.webhook",
  data: {
    action: "create" | "update" | "remove";
    type: "Issue" | "Comment" | "Project";
    data: LinearIssue | LinearComment;
    webhookId: string;
    organizationId: string;
  }
}
```

**Notion:**
```typescript
{
  name: "apps-console/notion.webhook",
  data: {
    event: "page.created" | "page.updated" | "page.deleted";
    data: NotionPage;
    eventId: string;
    organizationId: string;
  }
}
```

---

## Implementation Priority

### Phase 1: Core Refactoring (Week 1)
- ✅ Refactor `process-doc.ts` → `shared/process-documents.ts`
- ✅ Refactor `delete-doc.ts` → `shared/delete-documents.ts`
- ✅ Create `shared/extract-relationships.ts`
- ✅ Update `github-ingestion.ts` to use new shared workflows

### Phase 2: Linear (Weeks 2-3)
- ✅ Implement `linear-ingestion.ts`
- ✅ Implement `linear-issue-process.ts`
- ✅ Implement `linear-comment-process.ts`
- ✅ Implement `linear-backfill.ts`
- ✅ Test end-to-end with real Linear webhooks

### Phase 3: Notion (Weeks 4-5)
- ✅ Implement `notion-ingestion.ts`
- ✅ Implement `notion-page-process.ts`
- ✅ Implement `notion-backfill.ts`
- ✅ Test end-to-end

### Phase 4: Sentry + Vercel (Weeks 6-7)
- ✅ Implement Sentry workflows
- ✅ Implement Vercel workflows
- ✅ Test cross-source linking (deployment → error)

### Phase 5: Zendesk (Weeks 8-9)
- ✅ Implement Zendesk workflows
- ✅ Test conversation threading

---

## Testing Strategy

### Unit Tests
- Test each workflow in isolation
- Mock external API calls
- Test idempotency logic

### Integration Tests
- Test webhook → document flow
- Test backfill pagination
- Test cross-source relationship extraction

### E2E Tests
```typescript
describe("Linear Integration", () => {
  it("should ingest Linear issue and extract GitHub PR mentions", async () => {
    // 1. Send Linear webhook
    await sendWebhook("/api/webhooks/linear", {
      action: "create",
      type: "Issue",
      data: {
        id: "issue-123",
        identifier: "LIN-456",
        description: "Fixes https://github.com/owner/repo/pull/789",
      },
    });

    // 2. Wait for processing
    await waitFor(() =>
      db.query.docsDocuments.findFirst({
        where: eq(docsDocuments.sourceId, "LIN-456"),
      })
    );

    // 3. Verify relationships extracted
    const doc = await db.query.docsDocuments.findFirst({
      where: eq(docsDocuments.sourceId, "LIN-456"),
    });

    expect(doc.relationships.mentions.github).toContain("owner/repo#789");
  });
});
```

---

## Monitoring

### Metrics to Track

```
workflow_executions_total{workflow="linear-ingestion",status="success"}
workflow_duration_seconds{workflow="linear-ingestion"}
workflow_retries_total{workflow="linear-ingestion"}

document_processing_total{source="linear",action="created"}
document_processing_duration_seconds{source="linear"}

relationship_extraction_total{source_from="linear",source_to="github"}
```

### Alerts

```
- Workflow failure rate > 5%
- Processing latency > 2 minutes (p95)
- Backfill stuck (no progress in 30min)
- Relationship extraction failures > 10%
```

---

## Summary

**Total New Workflows:** 24

**Shared (Reusable):** 4
- `ensure-store.ts` (existing, no changes)
- `process-documents.ts` (generalized from `process-doc.ts`)
- `delete-documents.ts` (generalized from `delete-doc.ts`)
- `extract-relationships.ts` (new)

**Source-Specific:** 20
- GitHub: 3 (1 existing + 2 new)
- Linear: 4
- Notion: 3
- Sentry: 3
- Vercel: 3
- Zendesk: 3

**Key Benefits:**
- ✅ Source-agnostic core workflows
- ✅ Consistent idempotency patterns
- ✅ Batching for efficiency
- ✅ Cross-source relationship extraction
- ✅ Easy to add new sources (follow pattern)

---

## References

- [Multi-Source Integration Strategy](./multi-source-integration.md)
- [Database Schema](./database-schema.md)
- [Sync Strategies](./sync-strategies.md)
- [Phase 2 Implementation Plan](./implementation-plan.md)
