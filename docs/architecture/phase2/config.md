---
title: Config — Linear + Notion
description: lightfast.yml fields for Linear and Notion under the store model
status: draft
owner: product
audience: engineering
last_updated: 2025-11-06
tags: [config, linear, notion]
---

# Config — Linear + Notion (Store Model)

Extend `lightfast.yml` to add Linear and Notion under a named store. All artifacts are labeled with `store:<name>` and optional `collection:<name>`.

---

## Example

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
