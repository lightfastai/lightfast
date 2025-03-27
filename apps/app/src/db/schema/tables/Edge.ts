import { relations } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@repo/lib";

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

// Zod schemas for type-safe operations
export const SelectEdgeSchema = createSelectSchema(Edge);
export const InsertEdgeSchema = z.object({
  source: z.string().min(1).max(191),
  target: z.string().min(1).max(191),
});

export type SelectEdge = z.infer<typeof SelectEdgeSchema>;
export type InsertEdge = z.infer<typeof InsertEdgeSchema>;
