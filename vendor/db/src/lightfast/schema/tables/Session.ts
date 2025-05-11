import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";

import { nanoid } from "@repo/lib";

import { DBMessage } from "./Message";

// Renaming Chat to Session as per user preference/file structure
export const Session = pgTable(
  "session", // Keep table name as 'session' or change to 'chat' if preferred?
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
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
);

export const SessionRelations = relations(Session, ({ many }) => ({
  messages: many(DBMessage), // A session (chat) can have multiple messages
}));

export type Session = typeof Session.$inferSelect;
