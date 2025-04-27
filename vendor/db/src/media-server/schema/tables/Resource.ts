import { pgTable, varchar } from "drizzle-orm/pg-core";

export const MediaServerResource = pgTable("resource", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
});
