---
title: Config — Linear + Notion
description: lightfast.yml fields for Linear and Notion under the store model
status: draft
owner: product
audience: engineering
last_updated: 2025-11-06
tags: [config, linear, notion]
---

# Config — Workspace Management + Linear + Notion

Phase 2 introduces explicit workspace management and extends `lightfast.yml` to support Linear and Notion integrations. This builds on Phase 1's per-repository configuration model.

---

## Workspace Configuration (Phase 2)

### Console-Managed Workspace Settings

Workspace settings are stored in the database (not in repository config):

```typescript
// Stored in workspaces.settings (jsonb)
interface WorkspaceSettings {
  // Repository management
  repositories: {
    [repoId: string]: {
      enabled: boolean;          // Include/exclude from workspace
      storeDefaults?: {
        include?: string[];
        exclude?: string[];
        chunking?: ChunkingConfig;
      };
    };
  };

  // Workspace-level defaults
  defaults: {
    patterns: string[];          // Default include patterns
    ignore: string[];            // Default ignore patterns
    chunking: ChunkingConfig;
  };

  // Feature flags
  features: {
    codeIndexing: boolean;
    multiLanguage: boolean;
    memoryLayer: boolean;
  };
}
```

**Example Console Settings:**
```json
{
  "repositories": {
    "repo-1-id": {
      "enabled": true
    },
    "repo-2-id": {
      "enabled": false  // Excluded from this workspace
    }
  },
  "defaults": {
    "patterns": ["**/*.md", "**/*.mdx"],
    "ignore": ["**/node_modules/**", "**/dist/**"]
  },
  "features": {
    "codeIndexing": false,
    "multiLanguage": true,
    "memoryLayer": true
  }
}
```

### Configuration Precedence

```
1. Repository lightfast.yml (highest priority)
   ↓ overrides
2. Workspace repository settings (Console UI)
   ↓ overrides
3. Workspace defaults (Console UI)
   ↓ fallback to
4. System defaults (lowest priority)
```

---

## Repository Configuration (lightfast.yml)

### Phase 2 Enhancements

```yaml
version: 1

# Optional: Explicit workspace assignment
# If omitted, uses default workspace (ws_${orgSlug})
workspace: engineering  # Human-readable workspace name

store: docs-site
include:
  - apps/docs/src/content/docs/**/*.mdx
  - apps/docs/src/content/api/**/*.mdx
```

**Backward Compatibility:**
- `workspace` field is optional (Phase 1 configs work unchanged)
- If omitted, resolves to default workspace: `ws_${orgSlug}`
- If specified, looks up workspace by slug within organization

### Multi-Workspace Example

```yaml
# repo-1/lightfast.yml
version: 1
workspace: platform     # Assigned to "platform" workspace
store: platform-docs
include:
  - docs/**/*.md

# repo-2/lightfast.yml
version: 1
workspace: product      # Assigned to "product" workspace
store: product-docs
include:
  - guides/**/*.mdx

# repo-3/lightfast.yml
version: 1
# No workspace field → uses default workspace
store: api-docs
include:
  - api/**/*.md
```

---

## Linear + Notion Integration Example

```yaml
version: 1
workspace: ws_123

stores:
  - name: product-ops
    kind: mixed
    labels: [domain:product, surface:ops]

    linear:
      workspaceKey: LIN-WS-ABC              # resolved from Console/secret
      teams: [PLAT, GROWTH]
      projects: ["Q4 Growth", "Onboarding Simplification"]
      includeLabels: ["incident", "customer", "perf"]
      observations:
        enabled: true
        importanceRules:
          - when: issue.priority in ["urgent","high"]
            importance: 0.8
          - when: issue.state in ["In Progress","Done"] and label anyOf ["incident","customer"]
            importance: 0.7

    notion:
      workspaceKey: NOTION-WS-123           # resolved from Console/secret
      databases:
        - id: abc123                        # human alias allowed; server resolves real id
          name: "Product Specs"
          includeProperties: ["title","tags","owner","status"]
          collections:
            - name: specs
              include: ["*:"]              # all pages in this database
        - id: def456
          name: "Incidents"
          includeProperties: ["title","severity","service","occurredAt"]
          collections:
            - name: incidents
              include: ["*:"]
      observations:
        enabled: true
        importanceRules:
          - when: page.property.severity in ["SEV1","SEV2"]
            importance: 0.8

    memory:
      observations: { enabled: true }
      summaries:
        enabled: true
        windows:
          entityActiveDays: 7
          entityStableDays: 30
      profiles: { enabled: true }
      graph:
        enabled: true
        edges:
          ownership: [OWNED_BY, MEMBER_OF]
          dependency: [DEPENDS_ON, BLOCKED_BY, RESOLVES]
          alignment: [ALIGNS_WITH_GOAL]
```

Notes
- Linear fields gate which issues/projects are ingested; Notion fields gate databases and properties.
- Observations toggle enables memory-first signals; disable if only chunked docs are desired.

---

## Secrets and IDs

- `workspaceKey` and database/page IDs are resolved server-side from Console-managed secrets and resource registry.
- Users should not paste raw tokens or opaque IDs in `lightfast.yml`; aliases are allowed.

---

## Labels and Collections

- All items tagged with `store:<name>`; database-level collections allow filtering (e.g., `collection:specs`).
- Cross-tool joins rely on labels, entity extraction, and graph edges (e.g., PR RESOLVES Linear issue).
