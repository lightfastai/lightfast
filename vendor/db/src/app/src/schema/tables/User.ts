import { sql } from "drizzle-orm";
import { pgTable } from "drizzle-orm/pg-core";

import { nanoid } from "@repo/lib";

/**
 * User table
 * @todo 1. Ensure that clerkId & email is unique. There is a situation where if a user is manually deleted from Clerk,
 *        a new user is created with the different clerkId but the same email...
 * @todo 2. Implement Cascade Delete for User with Tenant Database delete...
 */
export const User = pgTable("user", (t) => ({
  id: t
    .varchar({ length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  createdAt: t
    .timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: t
    .timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => sql`now()`),
  clerkId: t.varchar({ length: 255 }).notNull().unique(),
}));
