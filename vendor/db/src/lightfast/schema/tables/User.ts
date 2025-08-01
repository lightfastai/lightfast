import { sql } from "drizzle-orm";
import { mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";

import { nanoid } from "@repo/lib";

export const User = mysqlTable("user", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  clerkId: varchar("clerk_id", { length: 191 }).notNull().unique(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  firstName: varchar("first_name", { length: 191 }),
  lastName: varchar("last_name", { length: 191 }),
  imageUrl: varchar("image_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdateFn(() => sql`now()`),
});

export type User = typeof User.$inferSelect;
export type InsertUser = typeof User.$inferInsert;
