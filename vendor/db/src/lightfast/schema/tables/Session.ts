import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";

import { Message } from "./Message";
import { Workspace } from "./Workspace";

// Renaming Chat to Session as per user preference/file structure
export const Session = pgTable(
  "session", // Keep table name as 'session' or change to 'chat' if preferred?
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    workspaceId: varchar("workspace_id", { length: 191 })
      .notNull()
      .references(() => Workspace.id, { onDelete: "cascade" }), // Keep link to Workspace
    title: text("title").notNull().default("New Chat"),
    // Add visibility if needed, like in the example
    // visibility: varchar("visibility", { enum: ["public", "private"] })
    //   .notNull()
    //   .default("private"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .notNull()
      .$onUpdateFn(() => sql`now()`),
  },
  (table) => ({
    workspaceIdx: index("session_workspace_idx").on(table.workspaceId), // Updated index name
  }),
);

// Renaming ChatRelations to SessionRelations
export const SessionRelations = relations(Session, ({ one, many }) => ({
  workspace: one(Workspace, {
    fields: [Session.workspaceId],
    references: [Workspace.id],
  }),
  messages: many(Message), // A session (chat) can have multiple messages
}));
