---
title: Phase 2 Scope — Linear + Notion
description: Add Linear and Notion connectors, enable memory per store, and cross-tool scenarios
status: draft
owner: product
audience: internal
last_updated: 2025-11-06
tags: [phase2, linear, notion]
---

# Phase 2 — Multi-Workspace + Linear + Notion

Expand beyond single-workspace GitHub + Docs by adding multi-workspace management, Linear integration, and Notion integration. Enable the memory layer (observations, summaries, profiles, graph) for selected stores.

---

## Overview

**Phase 2 builds on Phase 1 foundation:**
- **Phase 1:** Shipped single default workspace per organization (implicit resolution)
- **Phase 2:** Add multi-workspace management UI and explicit workspace assignment
- **Progressive complexity:** Simple by default (Phase 1), powerful when needed (Phase 2)

---

## Goals

### 1. Multi-Workspace Support
- Organizations can create multiple workspaces for different teams/products
- Explicit workspace assignment in Console UI
- Repository-to-workspace mapping with enable/disable controls
- Workspace-level configuration defaults

### 2. Integration Expansion
- Integrate Linear (issues, projects, teams) as additional source
- Integrate Notion (databases/pages) as additional source
- Keep DX: configure via `lightfast.yml` store entries; no IDs exposed

### 3. Memory Layer Enablement
- Enable memory incrementally per store to power cross-tool retrieval and reasoning
- Observations, summaries, profiles, and graph relationships
- Cross-tool entity linking (PR RESOLVES Linear issue)

---

## What Phase 1 Delivered

**Workspace Foundation:**
- Implicit workspace resolution: `ws_${githubOrgSlug}`
- One default workspace per organization
- Per-repository `lightfast.yml` configuration
- Multi-repo support (all repos share same workspace)
- Store-level isolation within workspace

**Already Working:**
- GitHub webhook-driven ingestion
- Automatic workspace computation from organization
- Multiple repos contributing to same or different stores
- No user configuration for workspace (automatic)

**Database Schema (Phase 1.7):**
- Workspace table structure defined (to be implemented)
- Connected repository tracking with organizationId
- Store workspace scoping already in place

---

## What Phase 2 Adds

**Multi-Workspace Management:**
- Explicit workspace table in database
- UI for creating/managing multiple workspaces
- Repository-to-workspace assignment controls
- Workspace-level settings and defaults

**Enhanced Configuration:**
- Optional workspace field in `lightfast.yml` (backward compatible)
- Workspace defaults that repos can override
- Per-workspace enable/disable for repositories
- Workspace-level chunking and indexing settings

**New Integrations:**
- Linear issues, projects, and teams
- Notion databases and pages
- Cross-tool entity relationships
- Memory layer (observations, summaries, profiles, graph)

---

## Migration Strategy

**Backward Compatibility:**
- Phase 1 configs continue to work without changes
- Implicit workspace resolution still available
- Explicit workspace field is optional (defaults to computed value)

**Data Migration:**
```sql
-- Auto-create workspace records from existing organizations
INSERT INTO lightfast_workspaces (id, organization_id, name, slug, is_default)
SELECT
  CONCAT('ws_', github_org_slug),
  id,
  CONCAT(github_org_name, ' Knowledge Base'),
  github_org_slug,
  true
FROM lightfast_deus_organizations;

-- Link existing connected repositories to default workspace
UPDATE lightfast_deus_connected_repository cr
JOIN lightfast_deus_organizations o ON cr.organization_id = o.id
SET cr.workspace_id = CONCAT('ws_', o.github_org_slug),
    cr.is_enabled = true;
```

**Progressive Adoption:**
1. Phase 1 users: Continue using default workspace (no action needed)
2. Phase 2 early adopters: Create additional workspaces as needed
3. Advanced users: Fine-tune workspace assignments and settings

---

## Navigation

- Config: ./config.md
- Scenarios: ./scenarios.md
- Implementation Plan: ./implementation-plan.md
- Open Questions: ./open-questions.md
