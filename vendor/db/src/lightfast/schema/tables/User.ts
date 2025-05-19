import { relations, sql } from "drizzle-orm";
import { pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

import { nanoid } from "@repo/lib";

import { Session } from "./Session";

export const User = pgTable("user", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  email: varchar("email", { length: 191 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`now()`),
});

export const UserRelations = relations(User, ({ many }) => ({
  sessions: many(Session),
}));

export type User = typeof User.$inferSelect;
