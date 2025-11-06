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

## Configuration

- Default location: root `lightfast.yml` vs `.lightfast/config.yml`?
- Secret management: env var refs vs console-managed secrets?

## Sync Behavior

- Default chunking parameters (tokens/overlap) for MDX pages?
- Frontmatter to metadata mapping (title, description, tags)?
 - URL construction: derive from site routing and file paths (relative URLs)?
- Strict mode default for CI (fail build on sync errors) vs warn-only?

## DX

- Config location: root `lightfast.yml` vs `.lightfast/config.yml`?
- Secret management: env var refs vs console-managed secrets?
- Per-store vs global defaults for retrieval (topK, highlights)?
