---
title: Phase 2 Implementation Plan — Linear + Notion
description: Connectors, routing, memory enablement, and observability
status: draft
owner: engineering
audience: engineering
last_updated: 2025-11-06
tags: [implementation, linear, notion]
---

# Phase 2 Implementation Plan — Multi-Workspace + Linear + Notion

Deliver multi-workspace management UI, Linear and Notion ingestion, and enable the memory layer. Builds on Phase 1 foundation.

---

## Phase 1 Foundation (Already Delivered)

**What's Already Working:**
- ✅ Implicit workspace resolution (`ws_${githubOrgSlug}`)
- ✅ One default workspace per organization
- ✅ Per-repository `lightfast.yml` configuration
- ✅ Multi-repo support (all repos share same workspace)
- ✅ Store-level isolation within workspace
- ✅ GitHub webhook-driven ingestion
- ✅ Automatic workspace computation from organization
- ✅ Connected repository tracking in database

**Database Schema (Phase 1.7 - Planned):**
- Workspace table structure defined (see Phase 1 data-model.md)
- Migration to add workspace table
- Backfill default workspaces from organizations
- Update connected_repository with workspaceId and isEnabled fields

---

## Phase 2 Implementation Phases

### Phase 2.1: Workspace Table & Migration (Week 1)

**Tasks:**
1. Create workspace table migration
2. Backfill default workspaces from existing organizations
3. Update connected_repository table with workspace fields
4. Add workspace CRUD operations to tRPC API
5. Update webhook handler to support explicit workspace lookup

**Migration Script:**
```sql
-- Create workspace table
CREATE TABLE lightfast_workspaces (
  id VARCHAR(191) PRIMARY KEY,
  organization_id VARCHAR(191) NOT NULL,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  settings JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_org_slug (organization_id, slug),
  INDEX idx_org (organization_id)
);

-- Backfill default workspaces
INSERT INTO lightfast_workspaces (id, organization_id, name, slug, is_default, settings)
SELECT
  CONCAT('ws_', github_org_slug),
  id,
  CONCAT(github_org_name, ' Knowledge Base'),
  github_org_slug,
  true,
  JSON_OBJECT('defaults', JSON_OBJECT())
FROM lightfast_deus_organizations;

-- Add workspace fields to connected_repository
ALTER TABLE lightfast_deus_connected_repository
ADD COLUMN workspace_id VARCHAR(191),
ADD COLUMN is_enabled BOOLEAN DEFAULT true;

-- Backfill workspace_id for existing repos
UPDATE lightfast_deus_connected_repository cr
JOIN lightfast_deus_organizations o ON cr.organization_id = o.id
SET cr.workspace_id = CONCAT('ws_', o.github_org_slug);
```

**Deliverables:**
- Workspace table created and populated
- Existing repos linked to default workspaces
- Backward compatibility maintained (implicit resolution still works)

### Phase 2.2: Workspace Management UI (Week 2-3)

**Tasks:**
1. Create workspace list page (`/org/[slug]/workspaces`)
2. Create workspace creation form
3. Add workspace settings page
4. Implement repository-to-workspace assignment UI
5. Add enable/disable toggle for repos in workspace

**UI Components:**
- Workspace list with default indicator
- Create workspace modal
- Repository assignment table
- Workspace settings form (defaults, features)

**tRPC Routes:**
```typescript
workspace.list          // List org workspaces
workspace.create        // Create new workspace
workspace.update        // Update workspace settings
workspace.delete        // Delete workspace (if empty)
workspace.assignRepo    // Assign repo to workspace
workspace.updateRepoSettings  // Enable/disable repo
```

### Phase 2.3: Enhanced Workspace Resolution (Week 4)

**Tasks:**
1. Update webhook handler to support optional workspace field
2. Implement workspace lookup by slug
3. Add validation for workspace existence
4. Update Inngest workflow to handle explicit workspaceId
5. Add workspace field support in lightfast.yml parsing

**Resolution Logic:**
```typescript
async function resolveWorkspaceId(
  organizationId: string,
  workspaceSlug?: string
): Promise<string> {
  if (!workspaceSlug) {
    // Phase 1 behavior: use default workspace
    const org = await getOrganization(organizationId);
    return `ws_${org.githubOrgSlug}`;
  }

  // Phase 2 behavior: look up explicit workspace
  const workspace = await getWorkspaceBySlug(organizationId, workspaceSlug);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceSlug}`);
  }
  return workspace.id;
}
```

---

## Connectors

- Linear
  - Auth via Console-managed workspace key
  - Ingest issues, projects/epics, comments; webhooks when available, fallback poller
  - Normalize to documents (chunks) + observations (state transitions, priority, labels)

- Notion
  - Auth via Console-managed integration
  - Ingest configured databases/pages; respect included properties
  - Normalize pages to documents (frontmatter → metadata); incidents/specs as observations when enabled

Idempotency
- Use source delivery IDs + action + resource IDs; TTL dedupe keys in Redis

---

## Routing and Stores

- Resolve store by workspace + store name from `lightfast.yml`
- Tag artifacts with `store:<name>` and optional `collection:<name>`
- Multi-repo/multi-db supported via list config; same store

---

## Memory Enablement

- Observations: emit `memory.observation.created` events; schedule embeddings
- Summaries: periodic jobs per store/entity/topic windows (7/30 days defaults)
- Profiles: nightly centroids per entity
- Graph: deterministic edges (OWNED_BY, DEPENDS_ON, BLOCKED_BY, RESOLVES, ALIGNS_WITH_GOAL)

---

## API and Query

- Scope retrieval by `filters.labels: ["store:<name>"]`
- Allow optional expansion to workspace/org when recall is low (flagged)

---

## Observability

- Ingestion metrics: throughput, dedupe hits, lag
- Memory metrics: observation counts, summary coverage, drift
- Retrieval logs: latency splits, router scope/mode, citations

---

## Acceptance

- Linear + Notion ingestion writes documents/chunks with correct labels and collections
- Observations toggled on produce embeddings and appear in search with expected boosts
- Graph edges present and attached to rationale when requested
