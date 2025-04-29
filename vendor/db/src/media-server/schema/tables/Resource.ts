import {
  jsonb,
  pgEnum,
  pgSchema,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";
import { z } from "zod";

import { nanoid } from "@repo/lib";

import { DEFAULT_MEDIA_SERVER_SCHEMA } from "../constants";

// Define the schema
export const mediaServerSchema = pgSchema(DEFAULT_MEDIA_SERVER_SCHEMA);

export const MediaServerJobStatus = [
  "init",
  "in_queue",
  "processing",
  "completed",
  "failed",
] as const;

export const $MediaServerJobStatus = z.enum(MediaServerJobStatus);

export const MediaServerProcessorEngine = [
  "fal-ai/fast-sdxl",
  "fal-ai/fast-sdxl-turbo",
  "fal-ai/kling-video/v2/master/text-to-video",
  "openai/gpt-4o-mini",
] as const;

export const $MediaServerProcessorEngine = z.enum(MediaServerProcessorEngine);

export type MediaServerJobStatus = z.infer<typeof $MediaServerJobStatus>;
export type MediaServerProcessorEngine = z.infer<
  typeof $MediaServerProcessorEngine
>;

export const $MediaServerResourceData = z.object({
  prompt: z.string(),
});

export const MediaServerResourceType = [
  "image",
  "video",
  "audio",
  "text",
] as const;

export const $MediaServerResourceType = z.enum(MediaServerResourceType);

export type MediaServerResourceData = z.infer<typeof $MediaServerResourceData>;
export type MediaServerResourceType = z.infer<typeof $MediaServerResourceType>;
// Define the table within the schema

export const pgMediaServerJobStatusEnum = pgEnum(
  "media_server_job_status",
  MediaServerJobStatus,
);

export const pgMediaServerProcessorEngineEnum = pgEnum(
  "media_server_processor_engine",
  MediaServerProcessorEngine,
);

export const pgMediaServerResourceTypeEnum = pgEnum(
  "media_server_resource_type",
  MediaServerResourceType,
);

export const MediaServerResource = mediaServerSchema.table("resource", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  engine: pgMediaServerProcessorEngineEnum("engine").notNull(),
  type: pgMediaServerResourceTypeEnum("type").notNull(),
  status: pgMediaServerJobStatusEnum("status").notNull(),
  data: jsonb("data").notNull().$type<typeof $MediaServerResourceData>(),
  url: varchar("url", { length: 255 }),
  externalRequestId: varchar("external_request_id", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdateFn(() => sql`now()`),
});
