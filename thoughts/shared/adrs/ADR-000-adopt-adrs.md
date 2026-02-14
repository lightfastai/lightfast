# ADR-000: Adopt Architecture Decision Records

## Status
Accepted

## Context
Lightfast has no formal system for recording architecture decisions. Decisions are scattered across CLAUDE.md, code comments, git history, and tribal knowledge. As the monorepo grows, it becomes harder to understand why specific patterns exist.

## Decision
Adopt lightweight ADRs in `thoughts/shared/adrs/`. Each significant technical decision gets a numbered record. ADRs are append-only — deprecated decisions are marked as such, not deleted.

## Consequences
- Decisions are discoverable and searchable
- New contributors can understand architectural rationale
- The evaluation pipeline can reference ADRs when explaining why certain rules exist
- Small overhead per decision (5-10 minutes to write)
