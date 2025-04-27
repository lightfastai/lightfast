import { pgSchema, varchar } from "drizzle-orm/pg-core";

// Define the schema
export const mediaServerSchema = pgSchema("media_server");

// Define the table within the schema
export const MediaServerResource = mediaServerSchema.table("resource", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
});
