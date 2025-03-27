import { relations, sql } from "drizzle-orm";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { Node } from "./Node";

/**
 * Represents an edge in the directed graph database structure, connecting nodes with enforced constraints.
 *
 * @remarks
 * The edge constraint system enforces maximum incoming edge limits per node type through database triggers.
 * This design was chosen for several critical reasons:
 *
 * Performance Characteristics:
 * - Time Complexity: O(log N) for edge creation/updates due to indexed lookups
 * - Space Complexity: O(E) where E is the number of edges
 * - Index Usage: Leverages B-tree indexes on source/target columns
 *
 * Key Design Decisions:
 * 1. Trigger-Based Validation
 *    - Enforces constraints at the database level using triggers
 *    - Guarantees consistency even with concurrent operations
 *    - Prevents race conditions that could occur with application-level checks
 *
 * 2. Index Strategy
 *    - Primary B-tree index on id for O(log N) lookups
 *    - Secondary index on source for efficient graph traversal
 *    - Composite index consideration for (target, source) if bidirectional queries become common
 *
 * 3. Cascade Deletion
 *    - Automatic cleanup of edges when nodes are deleted
 *    - Maintains referential integrity without orphaned edges
 *
 * Scalability Considerations:
 * - Current design efficiently handles millions of edges
 * - Edge constraint checks scale with O(log N) due to indexed lookups
 * - Potential bottlenecks at extremely high edge counts (100M+)
 *
 * @example
 * ```typescript
 * // Creating a new edge
 * const edge = await db.insert(Edge).values({
 *   source: "node1",
 *   target: "node2"
 * });
 *
 * // The database trigger will automatically:
 * // 1. Check the target node's type
 * // 2. Verify edge count constraints
 * // 3. Either allow or reject the operation
 * ```
 *
 * @future
 * Potential optimizations for extreme scale:
 *
 * 1. Edge Count Materialization
 *    - Add materialized counts to Node table
 *    - Trade write performance for faster reads
 *    - Requires careful transaction management
 *
 * 2. Partitioning Strategy
 *    - Partition edges by source node ranges
 *    - Improves parallel query performance
 *    - Reduces index size per partition
 *
 * 3. Caching Layer
 *    - Implement edge count cache
 *    - Reduce database load for repeated checks
 *    - Requires cache invalidation strategy
 *
 * Known Limitations:
 * - Single-database deployment assumed
 * - Trigger overhead on write operations
 * - Full table scans possible on complex graph queries
 */
export const Edge = pgTable(
  "edge",
  {
    // Unique identifier for each edge
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),

    // The node where the connection starts
    source: varchar("source", { length: 191 })
      .notNull()
      .references(() => Node.id, { onDelete: "cascade" }),

    // The node where the connection ends (limited by enforce_edge_limit trigger)
    target: varchar("target", { length: 191 })
      .notNull()
      .references(() => Node.id, { onDelete: "cascade" }),

    // Audit timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  },
  (table) => ({
    // Index source for efficient lookups when traversing the graph
    sourceIndex: index("idx_edge_source").on(table.source),
  }),
);

/**
 * Edge Relations
 *
 * Defines the relationships between edges and nodes:
 * - sourceNode: The node where the edge starts
 * - targetNode: The node where the edge ends (subject to edge limits)
 */
export const EdgeRelations = relations(Edge, ({ one }) => ({
  sourceNode: one(Node, {
    fields: [Edge.source],
    references: [Node.id],
    relationName: "edge_source",
  }),
  targetNode: one(Node, {
    fields: [Edge.target],
    references: [Node.id],
    relationName: "edge_target",
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
