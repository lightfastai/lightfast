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

File: `lightfast.yml` (repo root)

```yaml
version: 1
store: docs-site                # human name; unique per workspace
include:
  - apps/docs/src/content/docs/**/*.mdx
  - apps/docs/src/content/api/**/*.mdx
```

**Configuration Scope:**
- **Per-repository:** Each `lightfast.yml` applies **only to files in that repository**
- **Workspace resolution:** Automatically computed as `ws_${githubOrgSlug}` from the organization
- **No workspace field needed:** Phase 1 uses implicit workspace resolution (optional field removed)

**Multi-Repository Behavior:**
```yaml
# repo-1/lightfast.yml
version: 1
store: api-docs
include:
  - docs/api/**/*.md

# repo-2/lightfast.yml
version: 1
store: user-guides
include:
  - guides/**/*.mdx
```

**Result:**
- Both repos index to the **same workspace** (e.g., `ws_acme-corp`)
- Each repo's config controls **only that repo's files**
- Two separate stores in the same workspace
- No config conflicts between repositories

**Notes:**
- Maps to API parameters in ../../reference/api/api-spec.md
- Secrets referenced via environment (e.g., `LIGHTFAST_API_KEY`)
- File patterns are **repo-relative** (no separate `root` field)

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

## Scaling (Single → Multi-Repo)

**Phase 1 Approach:**
- **Single repo:** Workspace automatically set to `ws_${githubOrgSlug}`; configure files in `lightfast.yml`
- **Multi-repo (same org):**
  - All repos automatically share the same workspace
  - Each repo has its own `lightfast.yml` with per-repo file patterns
  - Repos can contribute to same store or different stores
  - No manual workspace management needed

**Example Multi-Repo Setup:**
```yaml
# Organization: acme-corp
# Workspace (auto): ws_acme-corp

# repo-1/lightfast.yml
version: 1
store: api-docs
include:
  - docs/**/*.md

# repo-2/lightfast.yml
version: 1
store: api-docs        # Same store name = combined into one store
include:
  - api/**/*.json

# repo-3/lightfast.yml
version: 1
store: guides          # Different store = separate dataset
include:
  - guides/**/*.mdx
```

**Phase 2 Extensions:**
- Multi-workspace: Organizations can create multiple workspaces
- Workspace assignment: Explicitly assign repos to specific workspaces
- Workspace defaults: Set organization-level defaults that repos inherit

---

## Config Precedence and Resolution

**Phase 1 (Current):**
- **Workspace resolution:** Automatically computed as `ws_${githubOrgSlug}` (no config needed)
- **Repository config:** Each `lightfast.yml` applies only to that repository's files
- **Store routing:** Ingestion assigns `store:<name>` from the `store` field; retrieval scopes via `filters.labels`
- **Secrets:** Always via environment/Console; config only references env keys (no raw secrets in repo)

**Per-Repository Independence:**
```
Organization: acme-corp (ws_acme-corp)
├── repo-1/lightfast.yml → controls repo-1 files only
├── repo-2/lightfast.yml → controls repo-2 files only
└── repo-3/lightfast.yml → controls repo-3 files only
```

**Phase 2 (Future):**
- **Precedence:** Workspace defaults → per-repo `lightfast.yml` overrides
- **Workspace assignment:** Explicit workspace selection in Console UI
- **Multi-workspace:** Organizations can manage multiple isolated workspaces
- **Repository exclusion:** Disable specific repos from workspace via Console

**Key Principles:**
1. Configuration is **per-repository**, not per-workspace
2. Multiple repos can have different configs without conflicts
3. Workspace is derived from organization (automatic in Phase 1)
4. Store names are unique per workspace (enforced at database level)

Note: Workflows are deferred. We may revisit a minimal DSL later, but Phase 1 ships solely with `lightfast.yml`.

---

## Registry & Resolution (simple v1)

- Identity: `(workspaceId, store)` is the canonical identity. The `store` value acts as the store key.
- Auto‑provisioning: on first ingestion, the server creates the store (using the key) and indexes into it.
- Renames: changing `store` in config creates a new store. In v1 we do not reconcile renames automatically.
  - If you need a rename without reindex, use an admin/Console action to rename at the registry (future), then update config.
- Search resolution: clients pass `store` (name); the API scopes by that key and the automatic `store:<name>` label.
- Repo independence: no `root` or pattern fingerprint is used for identity; include globs are for ingestion only.
