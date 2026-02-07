# ADR-001: Use dependency-cruiser for boundary enforcement

## Status
Accepted

## Context
Lightfast's monorepo has a strict layered architecture (apps → api → packages → vendor → db) and 17 vendor abstraction packages. These boundaries are enforced by convention only — no tooling prevents violations. Research identified ~74 vendor abstraction bypasses across the codebase.

## Decision
Use dependency-cruiser as the primary boundary enforcement tool. It provides:
- Regex-based path rules for layer enforcement
- Circular dependency detection
- Vendor abstraction enforcement (one rule per vendor package)
- JSON and error output formats for CI integration

turbo boundaries is used as a supplementary fast check for undeclared dependencies and cross-package file imports. It's experimental (introduced Turborepo 2.4, Jan 2025) but zero-config and runs in milliseconds.

knip is used for unused code detection (dead files, unused dependencies/exports/types).

## Consequences
- Layer violations are caught before merge (once added to CI)
- Vendor abstraction bypasses are detected automatically
- New team members get immediate feedback when violating boundaries
- dependency-cruiser config requires maintenance when new vendor packages are added
- ~74 existing violations need to be addressed or explicitly exempted
