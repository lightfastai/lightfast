---
title: Scenarios — Linear + Notion
description: Cross-tool scenarios leveraging memory and stores
status: draft
owner: product
audience: engineering
last_updated: 2025-11-06
tags: [scenarios, linear, notion]
---

# Scenarios — Multi-Workspace + Linear + Notion

Key scenarios for Phase 2, covering multi-workspace management and cross-tool integrations.

---

## Multi-Workspace Scenarios

### Scenario 1: Team-Based Workspaces

**Setup:**
```
Organization: acme-corp
├── Workspace: platform (ws_platform)
│   ├── repos: api-server, core-lib, infra
│   └── stores: platform-docs, api-docs
├── Workspace: product (ws_product)
│   ├── repos: web-app, mobile-app, docs-site
│   └── stores: product-docs, user-guides
└── Workspace: default (ws_acme-corp)
    ├── repos: company-wiki
    └── stores: company-docs
```

**Use Case:**
- Platform team searches only platform-related docs
- Product team searches only product-related docs
- Company-wide search across all workspaces (when needed)

**Configuration:**
```yaml
# api-server/lightfast.yml
version: 1
workspace: platform
store: api-docs
include:
  - docs/api/**/*.md

# web-app/lightfast.yml
version: 1
workspace: product
store: product-docs
include:
  - docs/**/*.mdx
```

### Scenario 2: Project-Based Workspaces

**Setup:**
```
Organization: startup-inc
├── Workspace: mvp (ws_mvp)
│   ├── repos: mvp-frontend, mvp-backend
│   └── stores: mvp-docs
├── Workspace: v2 (ws_v2)
│   ├── repos: v2-platform, v2-services
│   └── stores: v2-docs, architecture-docs
```

**Use Case:**
- Legacy MVP docs kept separate from v2 architecture
- Clear separation for deprecation and migration
- Teams can focus on their active version

### Scenario 3: Multi-Repo, Same Store, Different Workspaces

**Setup:**
```yaml
# Workspace: engineering (ws_engineering)
# repo-1/lightfast.yml
version: 1
workspace: engineering
store: tech-docs
include:
  - docs/**/*.md

# repo-2/lightfast.yml
version: 1
workspace: engineering
store: tech-docs        # Same store name
include:
  - guides/**/*.md

# Workspace: product (ws_product)
# repo-3/lightfast.yml
version: 1
workspace: product
store: tech-docs        # Same store name, different workspace
include:
  - docs/**/*.md
```

**Result:**
- `tech-docs` in `engineering` workspace: combined from repo-1 + repo-2
- `tech-docs` in `product` workspace: separate store from repo-3
- Store names can be reused across workspaces (scoped by workspaceId)

### Scenario 4: Excluding Repos from Workspace

**Console UI Configuration:**
```typescript
// Workspace settings for ws_platform
{
  "repositories": {
    "core-lib-id": { "enabled": true },
    "api-server-id": { "enabled": true },
    "legacy-service-id": { "enabled": false }  // Excluded
  }
}
```

**Result:**
- `legacy-service` repo has `lightfast.yml` but is excluded from workspace
- No ingestion happens for excluded repos
- Can re-enable later without changing repo config

---

## Cross-Tool Integration Scenarios

### Planning and Execution

- Sprint planning: find similar issues across repos and prior sprints
  - Maps: Q011 (similar_items), Q012 (temporal_diff) in ../../architecture/memory/query_scenarios.json

- Milestone/epic rollup and status
  - Maps: Q009 (milestone_status)

- Deprecation evidence across docs and PRs
  - Maps: Q018 (deprecation_evidence)

---

## Ownership and Dependencies

- Ownership across services and teams
  - Maps: Q003 (ownership_graph)

- Dependencies and blockers
  - Maps: Q004 (dependency_graph), Q020 (blocking_graph)

---

## Customer and Incident Signals

- Incident rollups by severity/service
  - Sources: Notion incident DB, Linear incidents
  - Maps: Q005 (incident_history), Q014 (summary_rollup)

- Customer feedback clustering and summaries
  - Sources: Linear tickets/labels, Notion feedback DB
  - Maps: Q006 (summary_rollup)

---

## Search Scoping

- Scope requests by store label: `filters.labels: ["store:product-ops"]`
- Narrow by collection (e.g., `collection:specs`) or types (issue, doc, incident)
