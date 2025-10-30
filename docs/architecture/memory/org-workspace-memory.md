---
title: Org vs Workspace Neural Memory — Scoping Design
description: Scoping, indexing, and routing across org and workspace boundaries
status: working
owner: platform-architecture
audience: engineering
last_updated: 2025-10-28
tags: [memory, scope]
---

# Org vs Workspace Neural Memory — Scoping Design

Last Updated: 2025-10-28

Goal: cleanly support both organization‑wide and workspace‑scoped neural memory, with predictable isolation, low latency, and explainable retrieval. This builds on spec.md (§2–§5), ../retrieval/search-design.md, and ../storage/architecture.md.

---

## Scope Model

- Organization (org): account‑level boundary that can contain many workspaces.
- Workspace: project/team‑level scope used for day‑to‑day retrieval and isolation.
- Visibility: each memory item declares a visibility scope:
  - `org` (visible across org)
  - `workspace` (visible only within one workspace)
  - `private` (e.g., DMs; excluded from org scope by default)

All rows carry both `organizationId` and `workspaceId`. For org‑wide items (e.g., policy docs), `workspaceId` may be `NULL` or a special value.

---

## Data Model (additions)

- Add `organizationId` to all memory tables: `knowledge_documents`, `knowledge_chunks`, `memory_observations`, `memory_summaries`, `memory_profiles`, `entities`, `relationships`, `relationship_evidence`.
- Add `visibility` column: enum(`org`, `workspace`, `private`) on documents, chunks, observations, and summaries.
- Indexing:
  - Composite indexes start with `(organizationId, workspaceId, …)` for fast scoped reads.
  - Unique constraints include `organizationId` and `workspaceId` as appropriate.

---

## Vector Index Strategy (Pinecone)

Families: `chunks`, `observations`, `summaries`, `profiles`.

Namespaces:
- Workspace ns: `{orgId}-{workspaceId}-{embeddingVersion}`
- Org ns (aggregator): `{orgId}-org-{embeddingVersion}`

Policy:
- Workspace ns contains all workspace‑scoped vectors.
- Org ns contains selected org‑visible vectors optimized for org‑wide queries:
  - Always include `summaries` (clustered rollups) and high‑importance `observations`.
  - Optionally include pointers to workspace items via IDs for hydration.

Metadata (selectively indexed): `{ organizationId, workspaceId, source, type, occurredAt, labels[] }`. Keep heavy fields in PlanetScale.

---

## Retrieval Routing (Scope‑aware)

Router decides scope and fusion plan:

1) Scope selection
- Default to `workspace` when a workspace context is known (UI route, MCP tool param).
- Promote to `org` when:
  - Query intent is policy/roadmap/initiative/ownership spanning teams.
  - Low recall in workspace scope (fallback to org aggregator).
- Allow explicit `scope=org|workspace` in API; log decision.

2) Candidate generation
- Workspace scope:
  - Lexical + dense over workspace ns (chunks/observations) per ../retrieval/search-design.md.
- Org scope:
  - Dense over org ns (`summaries` + important `observations`).
  - Optionally sample top K per member workspace if aggregator is thin and fuse.

3) Fusion and scoring
- Combine workspace and/or org candidates (depending on scope) using:
  `score = wv*vector + wl*lexical + wg*graph + wr*recency + wi*importance + wp*profile`
- Bias toward workspace matches when scope=`workspace` (e.g., +δ to workspace results). Calibrate per org.

4) Rerank (cross‑encoder)
- Apply on fused top‑K (50–75) with workspace‑calibrated thresholds.

5) Graph boost & rationale
- Apply bounded 1–2 hops within the same organization.
- Edges may be workspace‑specific (e.g., CODEOWNERS) or org‑level (team membership). Include evidence IDs in rationale.

Latency: keep org aggregator queries fast by using summaries and selected observations; avoid fanning out to all workspaces on the hot path.

---

## Neural Identification of Scope

Signals suggesting `org` scope:
- Keywords: policy, runbook, compliance, roadmap, milestone/initiative (org‑level), goal/OKR, ownership without a specific service/repo.
- Entities: team/organization mentions; cross‑workspace nouns.
- Distribution: query leans to docs/tickets vs code/PRs.

Signals suggesting `workspace` scope:
- Mentions of specific repos/services/issues/incidents.
- Developer workflow (PRs, build failures, specific component names).

Router can use a light classifier (zero‑shot or rules) and a recall‑based fallback to org.

---

## Summaries and Profiles Across Scopes

- Summaries
  - Workspace: cluster observations by entity/topic/time within a workspace.
  - Org: cluster org‑visible observations across workspaces; store coverage stats including per‑workspace counts.

- Profiles
  - Workspace profiles: centroids for workspace entities (services/repos/teams).
  - Org profiles: centroids for org entities (teams, cross‑cutting topics) computed over org‑visible items.
  - Fusion can use `wp*profileSim` to bias results toward the user’s team or the active workspace.

---

## Graph Across Scopes

- Entities carry `organizationId`; optionally `workspaceId` for workspace‑specific nodes.
- Relationships have `organizationId` and optional `workspaceId` (edge visible only within that workspace when set).
- Retrieval:
  - Workspace scope: traverse workspace‑specific edges + org edges.
  - Org scope: traverse org edges; include workspace edges if needed for explanations.
- Redis Adjacency Caches: key by org and workspace: `graph:out:{org}:{ws}:{kind}:{id}` (nullable `{ws}` for org edges).

---

## Security & Privacy

- Isolation: all queries must filter by `organizationId`; workspace scope additionally filters `workspaceId`.
- Visibility filtering: exclude `private` by default from org scope; allow opt‑in per user/workspace policy.
- Hydration enforces the same visibility constraints; rationale includes only permitted evidence.

---

## API Sketch

`POST /v1/search`
```jsonc
{
  "scope": "workspace" | "org",
  "organizationId": "org_123",
  "workspaceId": "ws_abc", // required when scope=workspace
  "text": "...",
  "filters": { "sources": ["github"], "types": ["pr"], "after": "2025-10-01" },
  "rerank": true
}
```
Response includes `usage.routerScope`, `contributions.{workspace,org}`, and `graph.rationale?` when applied.

---

## Evaluation

- Measure recall@k and rerank lift per scope; log contribution shares.
- Track org aggregator hit rate and latency.
- Guardrail: graph influence rate and rationale faithfulness ≥95%.

---

## Rollout Plan

1) Add `organizationId` and `visibility` fields; backfill existing data with org/workspace mapping.
2) Create org aggregator for `summaries` + high‑importance `observations`.
3) Enable scope routing (workspace default) with org fallback behind a flag.
4) Calibrate fusion and rerank thresholds per org; add dashboards.
