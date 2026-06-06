# Entity Graph DB Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first database contract for org-scoped canonical People, Accounts, source identities, evidence, reversible links, and versioned resolver candidates.

**Architecture:** Keep the first slice schema-first and local-resolver-friendly. Add a shared contract package for enums and schemas, add new `db/app` table definitions that follow existing Lightfast schema conventions, generate migrations with Drizzle, and add repository utilities/tests that can persist simulated `@repo/entity-resolution` output without wiring live connectors or UI.

**Tech Stack:** pnpm workspace, Turborepo, TypeScript ESM, Zod, Drizzle ORM on PlanetScale/Vitess MySQL, Vitest, `@repo/entity-resolution`.

**Design doc:** `docs/superpowers/specs/2026-06-06-entity-graph-db-contract-design.md`

---

## Scope

In scope:

- Shared entity graph contract package.
- New DB schema tables.
- Generated migration from `pnpm db:generate`.
- Focused DB utility functions and tests.
- Adapter that maps simulated resolver output into persistence inputs.

Out of scope:

- Live X/GitHub/Gmail ingestion.
- Exa enrichment.
- Product UI.
- Background jobs.
- Replacing `lightfast_org_people`.
- Manual SQL migration authoring.

## File Structure

Create:

- `packages/entity-graph-contract/package.json`
- `packages/entity-graph-contract/tsconfig.json`
- `packages/entity-graph-contract/vitest.config.ts`
- `packages/entity-graph-contract/src/index.ts`
- `packages/entity-graph-contract/src/__tests__/entity-graph-contract.test.ts`
- `db/app/src/schema/tables/org-entity-graph.ts`
- `db/app/src/utils/entity-graph.ts`
- `db/app/src/__tests__/entity-graph.test.ts`

Modify:

- `db/app/package.json`
- `db/app/src/schema/tables/index.ts`
- `db/app/src/schema/relations.ts`
- `db/app/src/schema/index.ts`
- `db/app/src/index.ts`
- `db/app/src/__tests__/schema-conventions.test.ts`
- `pnpm-lock.yaml`

Generated:

- `db/app/src/migrations/<generated>.sql`
- `db/app/src/migrations/meta/<generated>_snapshot.json`
- `db/app/src/migrations/meta/_journal.json`

## Task 1: Add Entity Graph Contract Package

**Files:**

- Create: `packages/entity-graph-contract/package.json`
- Create: `packages/entity-graph-contract/tsconfig.json`
- Create: `packages/entity-graph-contract/vitest.config.ts`
- Create: `packages/entity-graph-contract/src/index.ts`
- Create: `packages/entity-graph-contract/src/__tests__/entity-graph-contract.test.ts`
- Modify: `db/app/package.json`

- [x] **Step 1: Write failing contract tests**

Create `packages/entity-graph-contract/src/__tests__/entity-graph-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_TYPES,
  AFFILIATION_RELATIONSHIPS,
  ENTITY_GRAPH_STATUSES,
  SOURCE_IDENTITY_PROVIDERS,
  SOURCE_IDENTITY_TYPES,
  accountTypeSchema,
  affiliationRelationshipSchema,
  entityGraphStatusSchema,
  sourceIdentityProviderSchema,
  sourceIdentityTypeSchema,
} from "../index";

describe("@repo/entity-graph-contract", () => {
  it("defines shared status vocabulary", () => {
    expect(ENTITY_GRAPH_STATUSES).toEqual([
      "possible",
      "likely",
      "confirmed",
      "conflicting",
      "rejected",
      "superseded",
    ]);
    expect(entityGraphStatusSchema.parse("confirmed")).toBe("confirmed");
    expect(entityGraphStatusSchema.safeParse("active").success).toBe(false);
  });

  it("defines account and affiliation vocabulary", () => {
    expect(ACCOUNT_TYPES).toEqual([
      "company",
      "personal_brand",
      "open_source_project",
      "community",
      "fund",
      "agency",
      "product",
      "unknown",
    ]);
    expect(AFFILIATION_RELATIONSHIPS).toEqual([
      "current",
      "historical",
      "founder",
      "employee",
      "advisor",
      "investor",
      "maintainer",
      "creator",
      "owner",
      "possible",
    ]);
    expect(accountTypeSchema.parse("company")).toBe("company");
    expect(affiliationRelationshipSchema.parse("historical")).toBe(
      "historical"
    );
  });

  it("defines durable source identity vocabulary", () => {
    expect(SOURCE_IDENTITY_PROVIDERS).toEqual([
      "x",
      "github",
      "gmail",
      "email",
      "domain",
      "website",
      "linkedin",
      "mcp",
    ]);
    expect(SOURCE_IDENTITY_TYPES).toEqual([
      "handle",
      "email",
      "profile_url",
      "domain",
      "url",
      "org_handle",
      "provider_account_id",
    ]);
    expect(sourceIdentityProviderSchema.parse("github")).toBe("github");
    expect(sourceIdentityTypeSchema.parse("domain")).toBe("domain");
  });
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
pnpm --filter @repo/entity-graph-contract test
```

Expected: FAIL because the package is not implemented.

- [x] **Step 3: Implement package**

Create package files following the pattern in `packages/identity-contract`.

`packages/entity-graph-contract/src/index.ts` should export:

```ts
import { z } from "zod";

export const ENTITY_GRAPH_STATUSES = [
  "possible",
  "likely",
  "confirmed",
  "conflicting",
  "rejected",
  "superseded",
] as const;
export const entityGraphStatusSchema = z.enum(ENTITY_GRAPH_STATUSES);
export type EntityGraphStatus = z.infer<typeof entityGraphStatusSchema>;

export const CONFIRMED_BY_TYPES = [
  "system",
  "user",
  "trusted_workflow",
] as const;
export const confirmedByTypeSchema = z.enum(CONFIRMED_BY_TYPES);
export type ConfirmedByType = z.infer<typeof confirmedByTypeSchema>;

export const ACCOUNT_TYPES = [
  "company",
  "personal_brand",
  "open_source_project",
  "community",
  "fund",
  "agency",
  "product",
  "unknown",
] as const;
export const accountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof accountTypeSchema>;

export const AFFILIATION_RELATIONSHIPS = [
  "current",
  "historical",
  "founder",
  "employee",
  "advisor",
  "investor",
  "maintainer",
  "creator",
  "owner",
  "possible",
] as const;
export const affiliationRelationshipSchema = z.enum(
  AFFILIATION_RELATIONSHIPS
);
export type AffiliationRelationship = z.infer<
  typeof affiliationRelationshipSchema
>;

export const SOURCE_IDENTITY_PROVIDERS = [
  "x",
  "github",
  "gmail",
  "email",
  "domain",
  "website",
  "linkedin",
  "mcp",
] as const;
export const sourceIdentityProviderSchema = z.enum(
  SOURCE_IDENTITY_PROVIDERS
);
export type SourceIdentityProvider = z.infer<
  typeof sourceIdentityProviderSchema
>;

export const SOURCE_IDENTITY_TYPES = [
  "handle",
  "email",
  "profile_url",
  "domain",
  "url",
  "org_handle",
  "provider_account_id",
] as const;
export const sourceIdentityTypeSchema = z.enum(SOURCE_IDENTITY_TYPES);
export type SourceIdentityType = z.infer<typeof sourceIdentityTypeSchema>;
```

- [x] **Step 4: Add DB dependency**

Add to `db/app/package.json`:

```json
"@repo/entity-graph-contract": "workspace:*"
```

- [x] **Step 5: Verify package**

Run:

```bash
pnpm --filter @repo/entity-graph-contract test
pnpm --filter @repo/entity-graph-contract typecheck
```

Expected: PASS.

## Task 2: Add Entity Graph Schema Tables

**Files:**

- Create: `db/app/src/schema/tables/org-entity-graph.ts`
- Modify: `db/app/src/schema/tables/index.ts`
- Modify: `db/app/src/schema/relations.ts`
- Modify: `db/app/src/schema/index.ts`
- Modify: `db/app/src/index.ts`
- Modify: `db/app/src/__tests__/schema-conventions.test.ts`

- [x] **Step 1: Write failing schema convention test updates**

Update the allowed table file list in
`db/app/src/__tests__/schema-conventions.test.ts` to include:

```ts
"org-entity-graph.ts",
```

Run:

```bash
pnpm --filter @db/app test -- --run src/__tests__/schema-conventions.test.ts
```

Expected: FAIL because the file does not exist and/or snapshots do not include the tables.

- [x] **Step 2: Create table definitions**

Create `db/app/src/schema/tables/org-entity-graph.ts`.

Use current repo conventions:

- table names start with `lightfast_org_`
- unsigned bigint `id` primary key
- public id fields use prefixed UUIDs
- `clerk_org_id` is `varchar(64)`
- `created_at` and `updated_at` are `datetime(3)`
- no SQL foreign keys
- index names are scoped and shorter than 64 chars

Define these tables:

```text
lightfast_org_entity_people
lightfast_org_entity_accounts
lightfast_org_entity_person_account_affiliations
lightfast_org_entity_source_identities
lightfast_org_entity_observations
lightfast_org_entity_evidence_items
lightfast_org_entity_links
lightfast_org_entity_resolution_candidate_groups
lightfast_org_entity_resolution_candidate_versions
```

Use public id prefixes:

```text
person_
acct_
aff_
sid_
obs_
evi_
link_
candgrp_
candver_
```

Important columns:

```ts
status: varchar("status", { length: 32 }).$type<EntityGraphStatus>().notNull()
confidence: decimal("confidence", { precision: 5, scale: 4 }).$type<string>()
metadata: json("metadata").$type<Record<string, unknown>>().notNull()
```

Use `decimal` as string-typed storage for confidence to avoid float drift.

- [x] **Step 3: Export schema**

Export all tables, insert/select types, id creators, and constants from:

```text
db/app/src/schema/tables/index.ts
db/app/src/schema/index.ts
db/app/src/index.ts
```

Add empty relation exports or relation definitions in
`db/app/src/schema/relations.ts` without SQL foreign keys.

- [x] **Step 4: Run typecheck**

Run:

```bash
pnpm --filter @db/app typecheck
```

Expected: PASS before migration generation.

## Task 3: Generate Migration

**Files:**

- Generated: `db/app/src/migrations/*.sql`
- Generated: `db/app/src/migrations/meta/*.json`
- Modify: `db/app/src/migrations/meta/_journal.json`

- [x] **Step 1: Generate migration**

Run from repo root:

```bash
pnpm db:generate
```

Expected: Drizzle creates SQL and metadata snapshots. Do not hand-write SQL.

- [x] **Step 2: Run DB schema tests**

Run:

```bash
pnpm --filter @db/app test -- --run src/__tests__/schema-conventions.test.ts
pnpm --filter @db/app test -- --run src/__tests__/migrations.test.ts
```

Expected: PASS.

## Task 4: Add Entity Graph DB Utilities

**Files:**

- Create: `db/app/src/utils/entity-graph.ts`
- Create: `db/app/src/__tests__/entity-graph.test.ts`
- Modify: `db/app/src/index.ts`

- [x] **Step 1: Write failing utility tests**

Create tests for:

- upserting source identities by `clerk_org_id + identity_key`
- appending observations by `source_identity_id + content_hash`
- creating candidate group by deterministic key
- appending candidate version when `output_hash` changes
- not appending duplicate candidate version when `output_hash` is unchanged

Test names:

```ts
it("upserts source identities by deterministic key", async () => {});
it("appends observations for changed normalized snapshots", async () => {});
it("creates stable candidate groups by candidate key", async () => {});
it("appends candidate versions only for changed output", async () => {});
```

- [x] **Step 2: Implement minimal utilities**

Export functions:

```ts
upsertSourceIdentity(db, input)
appendEntityObservation(db, input)
upsertResolutionCandidateGroup(db, input)
appendResolutionCandidateVersionIfChanged(db, input)
```

Keep functions narrow. Do not implement canonical auto-create workflow in this task.

- [x] **Step 3: Export utilities**

Export from `db/app/src/index.ts`:

```ts
export {
  appendEntityObservation,
  appendResolutionCandidateVersionIfChanged,
  upsertResolutionCandidateGroup,
  upsertSourceIdentity,
} from "./utils/entity-graph";
```

- [x] **Step 4: Verify utilities**

Run:

```bash
pnpm --filter @db/app test -- --run src/__tests__/entity-graph.test.ts
pnpm --filter @db/app typecheck
```

Expected: PASS.

## Task 5: Add Resolver Fixture Persistence Adapter

**Files:**

- Modify: `packages/entity-resolution/package.json`
- Create: `packages/entity-resolution/src/persistence.ts`
- Create: `packages/entity-resolution/src/__tests__/persistence.test.ts`

- [x] **Step 1: Write failing adapter tests**

The adapter should convert `resolveSimulatedEntityFixture()` output into stable
persistence inputs without importing `@db/app`.

Test expected outputs:

- source identity records include `x:handle:ava_ai`
- person candidate key for Ava includes `github:handle:avachen` and
  `x:handle:ava_ai`
- account candidate key for Acme is `account:domain:acme.com`
- Tomas Reed includes historical affiliation metadata for OldCRM

- [x] **Step 2: Implement adapter**

Export:

```ts
export function entityResolutionResultToPersistenceBatch(
  result: EntityResolutionResult
): EntityResolutionPersistenceBatch
```

Keep the output JSON-serializable and DB-package-agnostic.

- [x] **Step 3: Verify adapter**

Run:

```bash
pnpm --filter @repo/entity-resolution test
pnpm --filter @repo/entity-resolution typecheck
```

Expected: PASS.

## Task 6: Full Verification

- [x] **Step 1: Run focused package checks**

Run:

```bash
pnpm --filter @repo/entity-graph-contract test
pnpm --filter @repo/entity-graph-contract typecheck
pnpm --filter @repo/entity-resolution test
pnpm --filter @repo/entity-resolution typecheck
pnpm --filter @db/app test -- --run src/__tests__/entity-graph.test.ts
pnpm --filter @db/app test -- --run src/__tests__/schema-conventions.test.ts
pnpm --filter @db/app test -- --run src/__tests__/migrations.test.ts
pnpm --filter @db/app typecheck
```

Expected: all PASS.

- [x] **Step 2: Run workspace-level checks if focused checks pass**

Run:

```bash
pnpm check
pnpm typecheck
```

Expected: PASS or documented unrelated failures.

## Self-Review Checklist

- The plan does not modify or remove `lightfast_org_people`.
- The plan uses `accounts`, not `organizations` or `companies`.
- Every table is org-scoped with `clerk_org_id`.
- SQL foreign keys are not introduced.
- Migrations are generated with `pnpm db:generate`.
- Resolver candidates are versioned and separate from canonical entities.
- Raw snapshots are nullable and retention-controlled.
- Source identity links are reversible through explicit link rows.
