import { jsonb, pgSchema, varchar } from "drizzle-orm/pg-core";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "../constants";

// Define the schema
export const mediaServerSchema = pgSchema(DEFAULT_MEDIA_SERVER_SCHEMA);

export const $MediaServerJobStatus = z.enum([
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

export const $MediaServerProcessorEngine = z.enum(["fal-ai/fast-sdxl"]);

export type MediaServerJobStatus = z.infer<typeof $MediaServerJobStatus>;
export type MediaServerProcessorEngine = z.infer<
  typeof $MediaServerProcessorEngine
>;

export const $MediaServerResourceData = z.object({
  prompt: z.string(),
});

export type MediaServerResourceData = z.infer<typeof $MediaServerResourceData>;

// Define the table within the schema
export const MediaServerResource = mediaServerSchema.table("resource", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  engine: varchar("engine", { length: 255 })
    .notNull()
    .$type<MediaServerProcessorEngine>(),
  data: jsonb("data").notNull().$type<typeof $MediaServerResourceData>(),
});

export const MediaServerJob = mediaServerSchema.table("job", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  status: varchar("status", { length: 255 })
    .notNull()
    .$type<MediaServerJobStatus>(),
});
