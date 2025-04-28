import { jsonb, pgSchema, varchar } from "drizzle-orm/pg-core";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "../constants";

// Define the schema
export const mediaServerSchema = pgSchema(DEFAULT_MEDIA_SERVER_SCHEMA);

export const $MediaServerJobStatus = z.enum([
  "init",
  "in_queue",
  "processing",
  "completed",
  "failed",
]);

export const $MediaServerProcessorEngine = z.enum([
  "fal-ai/fast-sdxl",
  "fal-ai/fast-sdxl-turbo",
  "openai/gpt-4o-mini",
]);

export type MediaServerJobStatus = z.infer<typeof $MediaServerJobStatus>;
export type MediaServerProcessorEngine = z.infer<
  typeof $MediaServerProcessorEngine
>;

export const $MediaServerResourceData = z.object({
  prompt: z.string(),
});

export const $MediaServerResourceType = z.enum([
  "image",
  "video",
  "audio",
  "text",
]);

export type MediaServerResourceData = z.infer<typeof $MediaServerResourceData>;
export type MediaServerResourceType = z.infer<typeof $MediaServerResourceType>;
// Define the table within the schema

export const MediaServerResource = mediaServerSchema.table("resource", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  engine: varchar("engine", { length: 255 })
    .notNull()
    .$type<MediaServerProcessorEngine>(),
  type: varchar("type", { length: 255 })
    .notNull()
    .$type<MediaServerResourceType>(),
  data: jsonb("data").notNull().$type<typeof $MediaServerResourceData>(),
  url: varchar("url", { length: 255 }),
  externalRequestId: varchar("external_request_id", { length: 191 }),
});
