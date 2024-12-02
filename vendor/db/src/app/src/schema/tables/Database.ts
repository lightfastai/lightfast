import { relations, sql } from "drizzle-orm";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { nanoid } from "@repo/lib";

import { User } from "./User";

export const Database = pgTable(
  "database",
  {
    id: varchar("id", { length: 191 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: varchar("user_id", { length: 191 })
      .notNull()
      .references(() => User.id, { onDelete: "cascade" }) // @TODO check if onCascade delete is valid here...
      .unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => sql`now()`),
    dbId: varchar("db_id", { length: 191 }).notNull().unique(),
  },
  (t) => ({
    dbIdIdx: index("idx_db_db_id").on(t.dbId),
  }),
);

export const DatabaseRelations = relations(Database, ({ one }) => ({
  user: one(User, {
    fields: [Database.userId],
    references: [User.id],
  }),
}));

export const insertDatabaseSchema = createInsertSchema(Database);
export const selectDatabaseSchema = createSelectSchema(Database);
