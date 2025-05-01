import { relations } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";

import { nanoid } from "@repo/lib";

import { Workspace } from "./Workspace";

export const Session = pgTable("session", (t) => ({
  id: t
    .varchar({ length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  workspaceId: t
    .varchar({ length: 191 })
    .notNull()
    .references(() => Workspace.id, { onDelete: "cascade" }),
  createdAt: t.timestamp().defaultNow().notNull(),
  updatedAt: t
    .timestamp()
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
}));

export const SessionRelations = relations(Session, ({ one }) => ({
  workspace: one(Workspace, {
    fields: [Session.workspaceId],
    references: [Workspace.id],
  }),
}));
