import { relations } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import type { NodePosition } from "~/types";
import {
  $Geometry,
  $Material,
  $NodeType,
  $Texture,
  $Txt2Img,
  $Window,
} from "~/types";
import { Edge } from "./Edge";
import { Workspace } from "./Workspace";

export const $NodeData = $Geometry
  .or($Material)
  .or($Texture)
  .or($Txt2Img)
  .or($Window);
export type NodeData = z.infer<typeof $NodeData>;

export const Node = pgTable("node", (t) => ({
  id: t
    .varchar({ length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  workspaceId: t
    .varchar({ length: 191 })
    .notNull()
    .references(() => Workspace.id, { onDelete: "cascade" }),
  type: t.varchar({ length: 50 }).notNull(),
  position: t.json().notNull().$type<NodePosition>(),
  data: t.json().notNull().$type<NodeData>(),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t.timestamp(),
}));

export const NodeRelations = relations(Node, ({ one, many }) => ({
  workspace: one(Workspace, {
    fields: [Node.workspaceId],
    references: [Workspace.id],
  }),
  targetEdges: many(Edge, { relationName: "edge_target" }),
  sourceEdges: many(Edge, { relationName: "edge_source" }),
}));

export const SelectNodeSchema = createSelectSchema(Node);
export const InsertNodeSchema = z.object({
  id: z.string().nanoid().min(1).max(191),
  workspaceId: z.string().nanoid().min(1).max(191),
  data: $NodeData,
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  type: $NodeType,
});

export type SelectNode = z.infer<typeof SelectNodeSchema>;
export type InsertNode = z.infer<typeof InsertNodeSchema>;
