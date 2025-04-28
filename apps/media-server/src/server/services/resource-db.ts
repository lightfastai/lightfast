import {
  integer,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const ResourceVariant = pgTable("resource_variant", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
  resourceId: varchar("resource_id", { length: 191 }).notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  url: varchar("url", { length: 512 }).notNull(),
});

// Resource table
export const Resource = pgTable("resource", {
  id: varchar("id", { length: 191 }).notNull().primaryKey(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  dimensions: jsonb("dimensions").$type<{ width: number; height: number }>(),
  storageURL: varchar("storage_url", { length: 512 }).notNull(),
  processingProfile: varchar("processing_profile", { length: 128 }).notNull(),
});
