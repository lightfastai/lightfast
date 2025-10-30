---
title: Architecture Index
description: System design areas and reading order
status: working
owner: platform-architecture
audience: engineering
last_updated: 2025-10-30
tags: [architecture]
---

# Architecture

This section covers the system’s deep technical design across data model, ingestion, retrieval, storage, memory, and operations.

- Data Model: ./data-model.md
- Knowledge Store: ./knowledge-store.md
- Identity: ./identity.md

Ingestion
- Sync Design: ./ingestion/sync-design.md
- Observations Heuristics: ./ingestion/observations-heuristics.md

Retrieval
- Search Design: ./retrieval/search-design.md
- Router Diagram: ./retrieval/router-diagram.md

Storage
- Architecture: ./storage/architecture.md
- Diagrams: ./storage/diagrams.md
- Implementation Guide: ./storage/implementation-guide.md

Memory
- Overview: ./memory/README.md
- Spec: ./memory/spec.md
- Graph: ./memory/graph.md
- Org vs Workspace: ./memory/org-workspace-memory.md

Operations
- Evaluation Playbook: ../operations/evaluation-playbook.md
- SLOs: ../operations/slo.md
- Observability: ../operations/observability.md
