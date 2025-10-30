---
title: Rationale Examples
description: Examples of graph rationales with entities, edges, and evidence IDs
status: draft
owner: platform-search
audience: engineering
last_updated: 2025-10-30
tags: [retrieval, rationale]
---

# Rationale Examples

Examples shown when `include.rationale=true` and graph bias influenced ranking.

---

## Ownership

```json
{
  "routerMode": "hybrid",
  "graph": {
    "entities": [
      { "id": "service_billing", "aliases": ["billing service"] },
      { "id": "team_billing", "aliases": ["billing team"] }
    ],
    "edges": [
      { "type": "OWNED_BY", "from": "service_billing", "to": "team_billing", "confidence": 0.96 }
    ],
    "evidenceChunks": ["chnk_001", "chnk_077"]
  }
}
```

---

## Dependency

```json
{
  "routerMode": "hybrid",
  "graph": {
    "entities": [
      { "id": "service_feed" },
      { "id": "service_user_profile" }
    ],
    "edges": [
      { "type": "DEPENDS_ON", "from": "service_feed", "to": "service_user_profile", "confidence": 0.81 }
    ],
    "evidenceChunks": ["chnk_200"]
  }
}
```

---

## Alignment

```json
{
  "routerMode": "hybrid",
  "graph": {
    "entities": [
      { "id": "goal_cost_optimization_2026" },
      { "id": "repo_infra_tools" }
    ],
    "edges": [
      { "type": "ALIGNS_WITH_GOAL", "from": "repo_infra_tools", "to": "goal_cost_optimization_2026", "confidence": 0.72 }
    ],
    "evidenceChunks": ["chnk_451"]
  }
}
```
