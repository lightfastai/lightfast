---
title: Scenarios — Linear + Notion
description: Cross-tool scenarios leveraging memory and stores
status: draft
owner: product
audience: engineering
last_updated: 2025-11-06
tags: [scenarios, linear, notion]
---

# Scenarios — Linear + Notion

Key scenarios targeted after Phase 0, mapping to existing query patterns.

---

## Planning and Execution

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
