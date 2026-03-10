# Document Processing Zod Migration Plan

## Overview

Convert the 5 plain TypeScript interfaces in `process-documents.ts` (lines 41–84) to Zod schemas, eliminating the redundant `ProcessDocumentEvent` interface that duplicates the Inngest event schema.

## Current State Analysis

**File**: `api/console/src/inngest/workflow/processing/process-documents.ts`

5 plain interfaces exist, all file-local (no external consumers):
- `ProcessDocumentEvent` (line 41) — mirrors the Inngest inline Zod schema at `client.ts:82-105` exactly
- `BasePrepared` (line 63) — base with `docId?` + `event`
- `ReadyDocument` (line 68) — extends `BasePrepared`, discriminated on `status: "ready"`
- `SkippedDocument` (line 81) — extends `BasePrepared`, discriminated on `status: "skipped"`
- `PreparedDocument` (line 61) — union type `ReadyDocument | SkippedDocument`

### Key Discoveries:
- `ProcessDocumentEvent` and the Inngest event schema at `client.ts:82-105` are identical — the interface is pure duplication
- `ReadyDocument` carries heavy framework types: `Chunk` (from `@repo/console-chunking`), `OrgWorkspace` + `WorkspaceKnowledgeDocument` (from `@db/console/schema`)
- `console-validation` already imports `sourceTypeSchema` from `@repo/console-providers` at runtime (`gateway.ts:8`, `workflow-io.ts:1`)
- `neural.ts` establishes the `z.custom<ExternalType>()` precedent for cross-package types (line 17)
- `neural.ts` is missing from `schemas/index.ts` barrel (only in top-level `src/index.ts:114`) — side fix

## Desired End State

- `processDocumentEventSchema` lives in `@repo/console-validation` as the single source of truth
- Both the Inngest client (`client.ts`) and the processor (`process-documents.ts`) reference this schema
- In-flight types (`ReadyDocument`, `SkippedDocument`, `PreparedDocument`) are Zod schemas in-place in `process-documents.ts`
- `BasePrepared` is eliminated (absorbed into each variant)
- Zero external interface changes — all consumers see identical types

### Verification:
- `pnpm typecheck` passes
- `pnpm check` passes
- All existing behavior unchanged (schemas are structurally identical to current interfaces)

## What We're NOT Doing

- Moving in-flight types (`ReadyDocument`, `SkippedDocument`, `PreparedDocument`) to `console-validation` — they carry heavy framework deps (`OrgWorkspace`, `Chunk`, `WorkspaceKnowledgeDocument`) and have zero external consumers
- Adding runtime validation calls — these schemas establish type contracts, matching the `neural.ts` pattern
- Modifying any business logic or control flow in the processor

## Implementation Approach

Extract the shared data contract (`ProcessDocumentEvent`) to `console-validation`, then convert in-flight types in-place. Three phases, each independently verifiable.

---

## Phase 1: Create `processDocumentEventSchema` in `@repo/console-validation`

### Overview
Create the shared schema, add barrel exports, and fix the `neural.ts` barrel gap.

### Changes Required:

#### 1. New schema file
**File**: `packages/console-validation/src/schemas/documents.ts` (new)

```typescript
import { sourceTypeSchema } from "@repo/console-providers";
import { z } from "zod";

// ── Process Document Event ───────────────────────────────────────────────────

export const processDocumentEventSchema = z.object({
  /** Document content */
  content: z.string(),
  /** Content hash for idempotency */
  contentHash: z.string(),
  /** Deterministic document ID */
  documentId: z.string(),
  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Optional parent document ID */
  parentDocId: z.string().optional(),
  /** Relationships to extract */
  relationships: z.record(z.string(), z.unknown()).optional(),
  /** Source-specific identifier */
  sourceId: z.string(),
  /** Source-specific metadata */
  sourceMetadata: z.record(z.string(), z.unknown()),
  /** Source type (discriminated union) */
  sourceType: sourceTypeSchema,
  /** Document title */
  title: z.string(),
  /** Workspace DB UUID (also store ID, 1:1 relationship) */
  workspaceId: z.string(),
});

export type ProcessDocumentEvent = z.infer<typeof processDocumentEventSchema>;
```

#### 2. Add to schemas barrel
**File**: `packages/console-validation/src/schemas/index.ts`
**Changes**: Add `documents` export, fix missing `neural` export

```diff
 export * from "./classification";
+export * from "./documents";
 export * from "./entities";
 ...
 export * from "./metrics";
+export * from "./neural";
 export * from "./org-api-key";
```

#### 3. Add to top-level barrel
**File**: `packages/console-validation/src/index.ts`
**Changes**: Add `documents` export (after line 108)

```diff
 export * from "./schemas/classification";
+export * from "./schemas/documents";
 export * from "./schemas/entities";
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes — new schema compiles cleanly
- [x] `pnpm check` passes — imports and exports are valid

---

## Phase 2: Wire Inngest Client to Shared Schema

### Overview
Replace the inline `z.object({...})` for `apps-console/documents.process` with the imported schema.

### Changes Required:

#### 1. Update Inngest client
**File**: `api/console/src/inngest/client/client.ts`
**Changes**: Import `processDocumentEventSchema` and use it in the events map

```diff
 import { sourceTypeSchema } from "@repo/console-providers";
-import { ingestionSourceSchema } from "@repo/console-validation";
+import {
+  ingestionSourceSchema,
+  processDocumentEventSchema,
+} from "@repo/console-validation";
```

Replace lines 82–105:
```diff
-  "apps-console/documents.process": z.object({
-    /** Workspace DB UUID (also store ID, 1:1 relationship) */
-    workspaceId: z.string(),
-    /** Deterministic document ID */
-    documentId: z.string(),
-    /** Source type (discriminated union) */
-    sourceType: sourceTypeSchema,
-    /** Source-specific identifier */
-    sourceId: z.string(),
-    /** Source-specific metadata */
-    sourceMetadata: z.record(z.string(), z.unknown()),
-    /** Document title */
-    title: z.string(),
-    /** Document content */
-    content: z.string(),
-    /** Content hash for idempotency */
-    contentHash: z.string(),
-    /** Optional parent document ID */
-    parentDocId: z.string().optional(),
-    /** Additional metadata */
-    metadata: z.record(z.string(), z.unknown()).optional(),
-    /** Relationships to extract */
-    relationships: z.record(z.string(), z.unknown()).optional(),
-  }),
+  "apps-console/documents.process": processDocumentEventSchema,
```

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes — Inngest event types remain identical
- [x] `pnpm check` passes

---

## Phase 3: Convert In-Flight Types In-Place

### Overview
Convert `BasePrepared`, `ReadyDocument`, `SkippedDocument`, and `PreparedDocument` from plain interfaces to Zod schemas in `process-documents.ts`. Eliminate `BasePrepared` by absorbing its fields into each variant.

### Changes Required:

#### 1. Convert interfaces to Zod schemas
**File**: `api/console/src/inngest/workflow/processing/process-documents.ts`

**Add imports**:
```diff
+import { processDocumentEventSchema } from "@repo/console-validation";
+import type { ProcessDocumentEvent } from "@repo/console-validation";
 import type { SourceType } from "@repo/console-providers";
 import { log } from "@vendor/observability/log";
 import { and, eq } from "drizzle-orm";
 import { inngest } from "../../client/client";
+import { z } from "zod";
```

**Replace interfaces** (lines 41–84) with:
```typescript
/**
 * In-flight processing types (file-local)
 * ProcessDocumentEvent schema lives in @repo/console-validation
 */

const skippedDocumentSchema = z.object({
  docId: z.string().optional(),
  event: processDocumentEventSchema,
  reason: z.string(),
  status: z.literal("skipped"),
});

type SkippedDocument = z.infer<typeof skippedDocumentSchema>;

const readyDocumentSchema = z.object({
  chunks: z.custom<Chunk[]>(),
  configHash: z.string(),
  contentHash: z.string(),
  docId: z.string(),
  embeddings: z.array(z.array(z.number())).optional(),
  event: processDocumentEventSchema,
  existingDoc: z.custom<WorkspaceKnowledgeDocument>().nullable().optional(),
  indexName: z.string(),
  slug: z.string(),
  status: z.literal("ready"),
  workspace: z.custom<OrgWorkspace>(),
});

type ReadyDocument = z.infer<typeof readyDocumentSchema>;

const preparedDocumentSchema = z.discriminatedUnion("status", [
  readyDocumentSchema,
  skippedDocumentSchema,
]);

type PreparedDocument = z.infer<typeof preparedDocumentSchema>;
```

**Update type guard** (line 602):

The existing `isReadyDocument` type guard continues to work as-is — the `z.infer<>` types produce the same structural types that the interfaces did. No changes needed.

```typescript
// No change — still works with z.infer<> types
function isReadyDocument(doc: PreparedDocument): doc is ReadyDocument {
  return doc.status === "ready";
}
```

**Remove `SourceType` import** if no longer used elsewhere in the file:

`SourceType` is used at `process-documents.ts:397` in `findExistingDocument(workspaceId: string, sourceType: SourceType, sourceId: string)`. Keep the import.

### Success Criteria:

#### Automated Verification:
- [x] `pnpm typecheck` passes — all `z.infer<>` types are structurally identical to the old interfaces
- [x] `pnpm check` passes — no lint errors

**Implementation Note**: After completing this phase and all automated verification passes, the migration is complete. No manual verification needed — this is a pure type-level refactor with zero behavioral changes.

---

## Testing Strategy

### Automated:
- `pnpm typecheck` — the only test that matters; confirms structural type equivalence
- `pnpm check` — lint/formatting
- Existing workflow tests (if any) continue to pass unchanged

### No Manual Testing Required:
This is a pure interface → Zod schema migration. No runtime behavior changes. The `z.infer<>` types produce identical TypeScript types to the original interfaces. The Inngest event schema was already identical to the interface.

## Migration Notes

- The `BasePrepared` interface is eliminated — its two fields (`docId?`, `event`) are absorbed into `skippedDocumentSchema` and `readyDocumentSchema` directly
- `z.custom<T>()` is used for framework types (`Chunk[]`, `OrgWorkspace`, `WorkspaceKnowledgeDocument`) that can't be expressed as Zod schemas — matches the `neural.ts` precedent at line 17
- Field order in schemas follows alphabetical convention established in `neural.ts`

## References

- Research: `thoughts/shared/research/2026-03-10-zod-migration-inventory.md` (Phase 4, lines 92–99)
- Pattern reference: `packages/console-validation/src/schemas/neural.ts` (full file)
- Inngest event schema: `api/console/src/inngest/client/client.ts:82-105`
- Source file: `api/console/src/inngest/workflow/processing/process-documents.ts:41-84`
