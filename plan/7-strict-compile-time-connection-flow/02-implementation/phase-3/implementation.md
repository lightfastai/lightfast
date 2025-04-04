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

/**
 * Migrates existing edge data to ensure valid handles
 * This is used when loading data from the database that might
 * have missing or invalid handles
 */
export function migrateEdgeHandles(edge: {
  sourceHandle?: string | null;
  targetHandle?: string | null;
}): {
  sourceHandle: HandleId;
  targetHandle: HandleId;
} {
  let sourceHandle: HandleId;
  let targetHandle: HandleId;

  // Try to convert existing handles, or use defaults
  if (edge.sourceHandle) {
    const parsedSource =
      createOutputHandleId(edge.sourceHandle) ||
      createTextureHandleId(edge.sourceHandle);
    sourceHandle = parsedSource || createOutputHandleId("output-main")!;
  } else {
    sourceHandle = createOutputHandleId("output-main")!;
  }

  if (edge.targetHandle) {
    const parsedTarget =
      createTextureHandleId(edge.targetHandle) ||
      createOutputHandleId(edge.targetHandle);
    targetHandle = parsedTarget || createTextureHandleId("input-1")!;
  } else {
    targetHandle = createTextureHandleId("input-1")!;
  }

  return {
    sourceHandle,
    targetHandle,
  };
}

/**
 * Apply migrations to an edge object or create a new one with valid handles
 */
export function prepareEdgeForInsert(edge: {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  [key: string]: any;
}): InsertEdge {
  const { sourceHandle, targetHandle } = migrateEdgeHandles(edge);

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle,
    targetHandle,
    animated: edge.animated,
    style: edge.style,
    label: edge.label,
  };
}
```

### Update Edge Store Adapter

```typescript
// vendor/db/src/adapters/edge-store-adapter.ts
import { eq } from "drizzle-orm";

import { db } from "../db";
import { edge, InsertEdge } from "../schema/tables/Edge";
import { prepareEdgeForInsert } from "../utils/edge-utils";

export async function getEdges(): Promise<InsertEdge[]> {
  const edges = await db.select().from(edge);

  // Apply migration to ensure all edges have valid handles
  return edges.map((e) => prepareEdgeForInsert(e));
}

export async function addEdge(newEdge: InsertEdge): Promise<InsertEdge> {
  // Ensure edge has valid handles before inserting
  const edgeToInsert = prepareEdgeForInsert(newEdge);

  await db.insert(edge).values(edgeToInsert);
  return edgeToInsert;
}

export async function updateEdge(
  edgeToUpdate: InsertEdge,
): Promise<InsertEdge> {
  // Ensure edge has valid handles before updating
  const edgeWithValidHandles = prepareEdgeForInsert(edgeToUpdate);

  await db
    .update(edge)
    .set(edgeWithValidHandles)
    .where(eq(edge.id, edgeWithValidHandles.id));

  return edgeWithValidHandles;
}

export async function deleteEdge(id: string): Promise<void> {
  await db.delete(edge).where(eq(edge.id, id));
}
```

## Unit Tests

Create tests to ensure the migration utility works correctly:

```typescript
// vendor/db/src/__tests__/edge-utils.test.ts
import {
  createOutputHandleId,
  createTextureHandleId,
  HandleId,
  OutputHandleId,
  TextureHandleId,
} from "../schema/types/TextureHandle";
import {
  getUniformForEdge,
  migrateEdgeHandles,
  prepareEdgeForInsert,
} from "../utils/edge-utils";

describe("Edge Utilities", () => {
  test("getUniformForEdge returns correct uniform for texture handle", () => {
    const textureHandle = createTextureHandleId("input-1")!;

    expect(getUniformForEdge({ targetHandle: textureHandle })).toBe(
      "u_texture1",
    );
  });

  test("getUniformForEdge returns null for output handle", () => {
    const outputHandle = createOutputHandleId("output-main")!;

    expect(getUniformForEdge({ targetHandle: outputHandle })).toBeNull();
  });

  test("migrateEdgeHandles handles missing source handle", () => {
    const result = migrateEdgeHandles({
      sourceHandle: null,
      targetHandle: "input-1",
    });

    expect(result.sourceHandle).toBe("output-main");
    expect(result.targetHandle).toBe("input-1");
  });

  test("migrateEdgeHandles handles missing target handle", () => {
    const result = migrateEdgeHandles({
      sourceHandle: "output-main",
      targetHandle: null,
    });

    expect(result.sourceHandle).toBe("output-main");
    expect(result.targetHandle).toBe("input-1");
  });

  test("migrateEdgeHandles handles invalid handles", () => {
    const result = migrateEdgeHandles({
      sourceHandle: "invalid-source",
      targetHandle: "invalid-target",
    });

    expect(result.sourceHandle).toBe("output-main");
    expect(result.targetHandle).toBe("input-1");
  });

  test("prepareEdgeForInsert creates a valid edge object", () => {
    const edge = {
      id: "edge-1",
      source: "node-1",
      target: "node-2",
      sourceHandle: null,
      targetHandle: null,
      animated: true,
    };

    const result = prepareEdgeForInsert(edge);

    expect(result.id).toBe("edge-1");
    expect(result.source).toBe("node-1");
    expect(result.target).toBe("node-2");
    expect(result.sourceHandle).toBe("output-main");
    expect(result.targetHandle).toBe("input-1");
    expect(result.animated).toBe(true);
  });
});
```

## Implementation Notes

1. The database schema itself doesn't change to maintain backward compatibility. We keep the sourceHandle and targetHandle columns as nullable in the database but enforce the more rigorous types in the application layer through the Zod schemas.

2. We provide migration utilities to handle existing data that might have missing or invalid handles:

   - `migrateEdgeHandles`: Ensures edges have valid handle IDs
   - `prepareEdgeForInsert`: Prepares an edge for database insertion with valid handles

3. We update the Edge store adapter to use the migration utilities when reading from or writing to the database to ensure all edges have valid handles.

4. We add a utility function `getUniformForEdge` that works specifically with texture handles to get uniform names.

## Migration Impact

1. **Database Impact**: No changes to the database schema are required, which means no migrations need to be run.

2. **Application Impact**: The application now enforces stricter validation on edge handles through the Zod schemas.

3. **Backward Compatibility**: The migration utilities ensure that existing data with missing or invalid handles is handled gracefully.

This approach allows us to improve type safety without requiring database migrations, which makes the rollout simpler and less risky.
