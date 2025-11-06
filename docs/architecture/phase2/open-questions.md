---
title: Open Questions — Phase 2
description: Decisions for Linear/Notion config, permissions, and behavior
status: draft
owner: product
audience: internal
last_updated: 2025-11-06
tags: [questions, linear, notion]
---

# Open Questions — Phase 2

---

## Configuration

- Database/page selection model for Notion: by database IDs only vs path-like aliases?
- Handling Notion subpages outside configured databases?
- Linear scope precedence: teams vs projects vs labels when overlapping

## Permissions and Safety

- Redaction for sensitive Notion properties; page-level access checks
- Linear private team handling and audit logging

## Behavior

- Backfill strategy for Notion/Linear (limits, windows)
- Update cadence vs webhooks; rate limit backoffs
- Summary windows per store vs global defaults
