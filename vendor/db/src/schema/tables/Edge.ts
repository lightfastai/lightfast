import { relations } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import type { HandleId } from "../types/TextureHandle";
import {
  $HandleId,
  createOutputHandleId,
  createTextureHandleId,
  getUniformNameFromTextureHandleId,
  isOutputHandleId,
  isTextureHandleId,
} from "../types/TextureHandle";
import { Node } from "./Node";

export const Edge = pgTable("edge", (t) => ({
  id: t
    .varchar({ length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  source: t
    .varchar({ length: 191 })
    .notNull()
    .references(() => Node.id, { onDelete: "cascade" }),
  target: t
    .varchar({ length: 191 })
    .notNull()
    .references(() => Node.id, { onDelete: "cascade" }),
  sourceHandle: t.varchar({ length: 191 }).notNull(),
  targetHandle: t.varchar({ length: 191 }).notNull(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp().defaultNow().notNull(),
}));

export const EdgeRelations = relations(Edge, ({ one }) => ({
  sourceNode: one(Node, {
    fields: [Edge.source],
    references: [Node.id],
  }),
  targetNode: one(Node, {
    fields: [Edge.target],
    references: [Node.id],
  }),
}));

// Base schema with handle validation
export const BaseEdgeSchema = z.object({
  id: z.string(),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: $HandleId,
  targetHandle: $HandleId,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Zod schemas for type-safe operations
export const SelectEdgeSchema = createSelectSchema(Edge).extend({
  sourceHandle: $HandleId,
  targetHandle: $HandleId,
});

export const InsertEdgeSchema = z
  .object({
    source: z.string().min(1).max(191),
    target: z.string().min(1).max(191),
    sourceHandle: $HandleId,
    targetHandle: $HandleId,
  })
  .refine(
    (data) => {
      // Source must be output handle, target must be texture handle
      return (
        isOutputHandleId(data.sourceHandle) &&
        isTextureHandleId(data.targetHandle)
      );
    },
    {
      message:
        "Invalid connection: source must be an output handle and target must be a texture handle",
    },
  );

export type SelectEdge = z.infer<typeof SelectEdgeSchema>;
export type InsertEdge = z.infer<typeof InsertEdgeSchema>;

/**
 * Helper function to get the corresponding uniform name for a handle
 */
export function getUniformForEdge(edge: {
  targetHandle: HandleId;
}): string | null {
  if (!isTextureHandleId(edge.targetHandle)) return null;
  return getUniformNameFromTextureHandleId(edge.targetHandle);
}

/**
 * Validate that an edge's handles are compatible
 */
export function validateEdgeHandles(edge: {
  sourceHandle: HandleId;
  targetHandle: HandleId;
}): boolean {
  return (
    isOutputHandleId(edge.sourceHandle) && isTextureHandleId(edge.targetHandle)
  );
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
