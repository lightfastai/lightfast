import { relations } from "drizzle-orm";
import { index, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { nanoid } from "@repo/lib";

import { Session } from "./Session";

export const DBMessage = pgTable(
  "message",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    sessionId: varchar("session_id", { length: 191 })
      .notNull()
      .references(() => Session.id, { onDelete: "cascade" }), // Link to Session
    role: varchar("role", { length: 191 }).notNull(), // @todo enforce enum for typesafety...
    // Using 'parts' to align with Vercel AI SDK v3 messages
    parts: json("parts").notNull().default([]),
    // Keeping attachments field as in the example for future use
    attachments: json("attachments").notNull().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("message_session_idx").on(table.sessionId)],
);

export const MessageRelations = relations(DBMessage, ({ one }) => ({
  session: one(Session, {
    fields: [DBMessage.sessionId],
    references: [Session.id],
  }),
}));

export type DBMessage = typeof DBMessage.$inferSelect;
