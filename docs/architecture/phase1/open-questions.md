---
title: Open Questions — Phase 1 (Docs Sync)
description: Decisions to finalize for docs store config, secrets, and sync behavior
status: working
owner: product
audience: internal
last_updated: 2025-11-06
tags: [questions, dx, ops]
---

# Open Questions (Docs Sync)

Unresolved items to confirm for Phase 1 docs sync.

---

## Resolved Questions

### Workspace Architecture (RESOLVED - 2025-11-07)

**Decision:** Organization-scoped with implicit workspace resolution

- **Workspace model:** 1 organization = 1 default workspace (Phase 1 simplification)
- **Workspace ID format:** `ws_${githubOrgSlug}` (computed at runtime)
- **Configuration scope:** Per-repository `lightfast.yml` (not per-workspace)
- **Multi-repo behavior:** All repos in org share same workspace, different configs allowed
- **Phase 2 path:** Explicit workspace table added in Phase 1.7 for Phase 2 multi-workspace support

**Benefits:**
- Simple mental model (org = workspace)
- Fast time to value (< 5 min setup)
- No user configuration overhead
- Easy migration to Phase 2 multi-workspace

**Implementation:**
- No workspace field in `lightfast.yml` (removed)
- Workspace computed in webhook handler from organization
- Per-repo config controls only that repo's files
- No conflicts between different repo configs

---

## Open Questions

### Configuration

- Default location: root `lightfast.yml` vs `.lightfast/config.yml`?
  - **Current:** Root `lightfast.yml` (simpler for users)
- Secret management: env var refs vs console-managed secrets?
  - **Current:** Environment variables (LIGHTFAST_API_KEY)

## Sync Behavior

- Default chunking parameters (tokens/overlap) for MDX pages?
- Frontmatter to metadata mapping (title, description, tags)?
 - URL construction: derive from site routing and file paths (relative URLs)?
- Strict mode default for CI (fail build on sync errors) vs warn-only?

## DX

- Config location: root `lightfast.yml` vs `.lightfast/config.yml`?
  - **Current:** Root `lightfast.yml` (decided)
- Secret management: env var refs vs console-managed secrets?
  - **Current:** Environment variables (decided)
- Per-store vs global defaults for retrieval (topK, highlights)?

## Phase 2 Migration (New Questions)

- **Workspace table creation:** When to add explicit workspace table?
  - **Proposal:** Phase 1.7 (for Phase 2 compatibility)
  - Add table but keep using computed workspaceId in Phase 1
- **Data migration:** How to migrate existing stores to explicit workspaces?
  - Auto-create workspace records from organizations
  - Link existing stores to default workspace
- **Backward compatibility:** How to handle existing lightfast.yml without workspace field?
  - Continue auto-resolution (no breaking changes)
  - Optional explicit workspace field in Phase 2
