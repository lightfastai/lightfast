# Local Entity Enrichment Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local TypeScript resolver package that turns X and GitHub profile snapshots into evidence-backed Person and Business candidates.

**Architecture:** Add `@repo/entity-resolution` as a leaf package under `packages/`. The package exports Zod schemas, source identity normalization helpers, deterministic evidence extraction, candidate scoring, and `resolveEntityCandidates()`.

**Tech Stack:** pnpm workspace, TypeScript ESM, Zod, Vitest, shared repo TypeScript/Vitest configs.

**Design doc:** `docs/superpowers/specs/2026-06-06-local-entity-enrichment-core-design.md`

---

## File Structure

- Create `packages/entity-resolution/package.json` for workspace metadata and scripts.
- Create `packages/entity-resolution/tsconfig.json` and `packages/entity-resolution/vitest.config.ts`.
- Create `packages/entity-resolution/src/index.ts` for public exports and implementation.
- Create `packages/entity-resolution/src/__tests__/entity-resolution.test.ts` for behavior tests.

## Task 1: Package Scaffold And Failing Resolver Tests

**Files:**

- Create: `packages/entity-resolution/package.json`
- Create: `packages/entity-resolution/tsconfig.json`
- Create: `packages/entity-resolution/vitest.config.ts`
- Create: `packages/entity-resolution/src/__tests__/entity-resolution.test.ts`

- [x] **Step 1: Add package config and failing tests.**

The test imports `resolveEntityCandidates`, status schemas, and identity helpers
from `../index`. At this point `src/index.ts` does not exist, so the package
test must fail before implementation.

- [x] **Step 2: Run the focused test and verify red.**

Run:

```bash
pnpm --filter @repo/entity-resolution test
```

Expected: FAIL because `../index` is missing.

## Task 2: Minimal Resolver Implementation

**Files:**

- Create: `packages/entity-resolution/src/index.ts`

- [x] **Step 1: Implement exported schemas and helpers.**

Add:

- `entityResolutionStatusSchema`
- `sourceProviderSchema`
- `sourceIdentityKey()`
- `normalizeHandle()`
- `normalizeProfileUrl()`
- `resolveEntityStatus()`

- [x] **Step 2: Implement `resolveEntityCandidates()`.**

Support X profile and GitHub profile observations. Emit person candidates,
business candidates, evidence entries, and deterministic statuses.

- [x] **Step 3: Run the focused test and verify green.**

Run:

```bash
pnpm --filter @repo/entity-resolution test
```

Expected: PASS.

## Task 3: Verification

**Files:**

- Verify: `packages/entity-resolution/src/index.ts`
- Verify: `packages/entity-resolution/src/__tests__/entity-resolution.test.ts`

- [x] **Step 1: Run package typecheck.**

Run:

```bash
pnpm --filter @repo/entity-resolution typecheck
```

Expected: PASS.

- [x] **Step 2: Run package tests again after typecheck.**

Run:

```bash
pnpm --filter @repo/entity-resolution test
```

Expected: PASS.
