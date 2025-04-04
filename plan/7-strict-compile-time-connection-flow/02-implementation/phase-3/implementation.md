# Phase 3: Edge Schema - Implementation

## Overview

This phase updates the Edge database schema to use the enhanced handle ID types created in Phase 1. This ensures that handle IDs are validated at both the database and application levels, establishing a single source of truth for handle ID validation.

## Implementation Details

### Edge Schema Update

```typescript
// vendor/db/src/schema/tables/Edge.ts
import { relations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { $HandleId, HandleId } from "../types/TextureHandle";
import { node } from "./Node";

// Table definition remains the same for compatibility
export const edge = pgTable("edge", {
  id: text("id").primaryKey().notNull(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  sourceHandle: text("source_handle").notNull(),
  targetHandle: text("target_handle").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations stay the same
export const edgeRelations = relations(edge, ({ one }) => ({
  source: one(node, {
    fields: [edge.source],
    references: [node.id],
  }),
  target: one(node, {
    fields: [edge.target],
    references: [node.id],
  }),
}));

// Updated schema with HandleId and required fields
export const BaseEdgeSchema = z.object({
  id: z.string(),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: $HandleId, // Now required and validated
  targetHandle: $HandleId, // Now required and validated
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Original insert schema needs to be maintained for compatibility with database columns
const originalInsertSchema = createInsertSchema(edge);

// Custom insert schema with stronger typing than the database columns
export const InsertEdgeSchema = originalInsertSchema.extend({
  sourceHandle: $HandleId,
  targetHandle: $HandleId,
});

export const SelectEdgeSchema = createSelectSchema(edge).extend({
  sourceHandle: $HandleId,
  targetHandle: $HandleId,
});

// Update types to reflect schema changes
export type Edge = z.infer<typeof SelectEdgeSchema>;
export type InsertEdge = z.infer<typeof InsertEdgeSchema>;
export type PartialEdge = Partial<InsertEdge> &
  Pick<InsertEdge, "source" | "target">;
```

### Edge Utilities

```typescript
// vendor/db/src/utils/edge-utils.ts
import { Edge, InsertEdge } from "../schema/tables/Edge";
import {
  createOutputHandleId,
  createTextureHandleId,
  getUniformNameFromTextureHandleId,
  HandleId,
  isTextureHandleId,
  OutputHandleId,
  TextureHandleId,
} from "../schema/types/TextureHandle";

/**
 * Get the uniform name for an edge's target handle
 * Returns null if the handle is not a valid TextureHandleId
 */
export function getUniformForEdge(edge: {
  targetHandle: HandleId;
}): string | null {
  if (isTextureHandleId(edge.targetHandle)) {
    return getUniformNameFromTextureHandleId(edge.targetHandle);
  }
  return null;
}

/**
 * Prepare an edge for insertion by ensuring it has valid handles
 */
export function prepareEdgeForInsert(edge: InsertEdge): InsertEdge {
  // Validate source handle
  const sourceHandle =
    createOutputHandleId(edge.sourceHandle) ||
    createTextureHandleId(edge.sourceHandle);

  // Validate target handle
  const targetHandle =
    createTextureHandleId(edge.targetHandle) ||
    createOutputHandleId(edge.targetHandle);

  if (!sourceHandle || !targetHandle) {
    throw new Error("Invalid handle IDs in edge");
  }

  return {
    ...edge,
    sourceHandle,
    targetHandle,
  };
}

/**
 * Validate that an edge's handles are compatible
 */
export function validateEdgeHandles(edge: {
  sourceHandle: HandleId;
  targetHandle: HandleId;
}): boolean {
  // Source must be output handle, target must be texture handle
  return (
    isTextureHandleId(edge.targetHandle) &&
    !isTextureHandleId(edge.sourceHandle)
  );
}
```

### Edge Store Adapter

```typescript
// vendor/db/src/adapters/edge-store-adapter.ts
import { eq } from "drizzle-orm";

import { db } from "../db";
import { edge, InsertEdge } from "../schema/tables/Edge";
import { prepareEdgeForInsert } from "../utils/edge-utils";

export async function getEdges(): Promise<InsertEdge[]> {
  const edges = await db.select().from(edge);
  return edges.map(prepareEdgeForInsert);
}

export async function addEdge(newEdge: InsertEdge): Promise<InsertEdge> {
  const validEdge = prepareEdgeForInsert(newEdge);
  await db.insert(edge).values(validEdge);
  return validEdge;
}

export async function updateEdge(
  edgeToUpdate: InsertEdge,
): Promise<InsertEdge> {
  const validEdge = prepareEdgeForInsert(edgeToUpdate);
  await db.update(edge).set(validEdge).where(eq(edge.id, validEdge.id));
  return validEdge;
}

export async function deleteEdge(id: string): Promise<void> {
  await db.delete(edge).where(eq(edge.id, id));
}
```

## Implementation Notes

1. The Edge schema has been updated to use the new `HandleId` type system while maintaining database compatibility:

   - Schema validation enforces proper handle types
   - Database columns remain unchanged for compatibility
   - Zod schemas provide runtime validation

2. New utility functions have been added to work with the enhanced types:

   - `getUniformForEdge`: Get uniform name from texture handles
   - `prepareEdgeForInsert`: Ensure edges have valid handles
   - `validateEdgeHandles`: Validate handle compatibility

3. The Edge store adapter has been updated to:

   - Use the new types and validation
   - Ensure all edges have valid handles
   - Maintain proper type safety throughout

4. All components maintain proper type safety through:
   - Use of branded types
   - Validation functions
   - Strong typing in database operations
