---
title: DX Configuration (Phase 1 — Docs Sync)
description: lightfast.yml for docs stores, globs, chunking, and push-to-main ingestion
status: working
owner: product
audience: engineering
last_updated: 2025-11-06
tags: [dx, config, docs]
---

# DX Configuration

Phase 1 is docs-only. We fully commit to a single root config `lightfast.yml` that defines a docs “store” (single dataset in v1). Ingestion is automatic on push to main via GitHub App webhooks, using your defined globs and chunking. No GitHub/Discord bot commands in this phase.

---

## Root Config (docs-only)

File: `lightfast.yml` (repo root or docs repo)

```yaml
version: 1
workspace: ws_123               # optional; resolve from env/Console if omitted
store: docs-site                # human name; unique per workspace
include:
  - apps/docs/src/content/docs/**/*.mdx
  - apps/docs/src/content/api/**/*.mdx
```

Notes
- Maps to API parameters in ../../reference/api/api-spec.md
- Secrets referenced via environment (e.g., `LIGHTFAST_API_KEY`).

---

## Store (Docs)

- Identity: the store has a human name (e.g., `docs-site`). Lightfast auto-provisions an internal ID/namespace and tags all artifacts with `store:<name>`.
- Scope: search and answer APIs filter by `labels: ["store:<name>"]` for precision (automatically set by the system; no custom labels needed).
- Globs: let teams isolate file groups to RAG‑ify; no `collections` in v1. Globs are repo‑relative (no separate `root`).

Example config (single store)

```yaml
version: 1
workspace: ws_123
store: docs-site
include:
  - apps/docs/src/content/docs/**/*.mdx
  - apps/docs/src/content/api/**/*.mdx
```

---

## Ingestion & Search Integration (apps/docs)

- Ingestion: triggered by GitHub push to main. The server fetches changed files matching globs, parses frontmatter, derives slugs/URLs from paths (relative to the detected common prefix of matched files), chunks, and indexes.
- Search: implement `/api/search` in `apps/docs` to call Lightfast `/v1/search` with `filters.labels: ["store:<storeName>"]` and map results to Fumadocs’ search shape.

Security
- Require `LIGHTFAST_API_KEY` in server env; never store secrets in `lightfast.yml`.

---

## Query Scoping

- Docs: `filters.labels: ["store:docs-site"]`.

---

## Scaling (Single → Multi‑Repo)

- Single repo: workspace can equal the repo; run sync locally or in CI.
- Multi‑repo: attach multiple repos in Console to one workspace; keep per‑repo path globs in `lightfast.yml`.
- Multi‑workspace: create additional workspaces in Console; reuse store entries with updated workspace.

---

## Config Precedence and Resolution

- Precedence
  - Console workspace defaults → `lightfast.yml` per-repo overrides
- Workspace resolution
  - Single‑repo: default workspace can equal the repo slug; override with `workspace:` in `lightfast.yml` if needed
  - Multi‑repo: Console defines the workspace; repos attach to it; `lightfast.yml` provides per‑repo path globs
- Store routing
  - Ingestion assigns `store:<name>` from the `store` field; retrieval scopes via `filters.labels`
- Secrets
  - Always via environment/Console; config only references env keys (no raw secrets in repo)

Note: Workflows are deferred. We may revisit a minimal DSL later, but Phase 0/1 ships solely with `lightfast.yml`.

---

## Registry & Resolution (simple v1)

- Identity: `(workspaceId, store)` is the canonical identity. The `store` value acts as the store key.
- Auto‑provisioning: on first ingestion, the server creates the store (using the key) and indexes into it.
- Renames: changing `store` in config creates a new store. In v1 we do not reconcile renames automatically.
  - If you need a rename without reindex, use an admin/Console action to rename at the registry (future), then update config.
- Search resolution: clients pass `store` (name); the API scopes by that key and the automatic `store:<name>` label.
- Repo independence: no `root` or pattern fingerprint is used for identity; include globs are for ingestion only.
