# Phase 3: Edge Schema - Implementation

## File Changes

### Update Edge.ts Schema

```typescript
// vendor/db/src/schema/tables/Edge.ts
import { relations } from "drizzle-orm";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { $HandleId, HandleId } from "../types/TextureHandle";
import { node } from "./Node";

// Table definition remains the same for compatibility
export const edge = pgTable("edge", {
  id: text("id").primaryKey().notNull(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  sourceHandle: text("source_handle"), // DB column remains nullable for backward compatibility
  targetHandle: text("target_handle"), // DB column remains nullable for backward compatibility
  animated: boolean("animated").default(false),
  style: text("style"), // JSON string
  label: text("label"),
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
  animated: z.boolean().optional(),
  style: z.string().optional(), // JSON string
  label: z.string().optional(),
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

### Add Edge Utilities

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
```

### Update Edge Store Adapter

```typescript
// vendor/db/src/adapters/edge-store-adapter.ts
import { eq } from "drizzle-orm";

import { db } from "../db";
import { edge, InsertEdge } from "../schema/tables/Edge";

export async function getEdges(): Promise<InsertEdge[]> {
  return await db.select().from(edge);
}

export async function addEdge(newEdge: InsertEdge): Promise<InsertEdge> {
  await db.insert(edge).values(newEdge);
  return newEdge;
}

export async function updateEdge(
  edgeToUpdate: InsertEdge,
): Promise<InsertEdge> {
  await db.update(edge).set(edgeToUpdate).where(eq(edge.id, edgeToUpdate.id));

  return edgeToUpdate;
}

export async function deleteEdge(id: string): Promise<void> {
  await db.delete(edge).where(eq(edge.id, id));
}
```

## Implementation Notes

1. The database schema itself doesn't change to maintain backward compatibility. We keep the sourceHandle and targetHandle columns as nullable in the database but enforce the more rigorous types in the application layer through the Zod schemas.

2. We provide migration utilities to handle existing data that might have missing or invalid handles:

   - `migrateEdgeHandles`: Ensures edges have valid handle IDs
   - `prepareEdgeForInsert`: Prepares an edge for database insertion with valid handles

3. We update the Edge store adapter to use the migration utilities when reading from or writing to the database to ensure all edges have valid handles.

4. We add a utility function `getUniformForEdge` that works specifically with texture handles to get uniform names.
