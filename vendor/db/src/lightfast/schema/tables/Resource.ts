import {
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql";
import { z } from "zod";

import { nanoid } from "@repo/lib";

// Define the schema

export const ResourceJobStatus = [
  "init",
  "in_queue",
  "processing",
  "completed",
  "failed",
] as const;

export const $ResourceJobStatus = z.enum(ResourceJobStatus);

export const ResourceProcessorEngine = [
  "fal-ai/fast-sdxl",
  "fal-ai/fast-sdxl-turbo",
  "fal-ai/kling-video/v2/master/text-to-video",
  "openai/gpt-4o-mini",
] as const;

export const $ResourceProcessorEngine = z.enum(ResourceProcessorEngine);

export type ResourceJobStatus = z.infer<typeof $ResourceJobStatus>;
export type ResourceProcessorEngine = z.infer<typeof $ResourceProcessorEngine>;

export const $ResourceData = z.object({
  prompt: z.string(),
});

export const ResourceType = ["image", "video", "audio", "text"] as const;

export const $ResourceType = z.enum(ResourceType);

export type ResourceData = z.infer<typeof $ResourceData>;
export type ResourceType = z.infer<typeof $ResourceType>;
// Define the table within the schema

export const pgResourceJobStatusEnum = pgEnum(
  "resource_job_status",
  ResourceJobStatus,
);

export const pgResourceProcessorEngineEnum = pgEnum(
  "resource_processor_engine",
  ResourceProcessorEngine,
);

export const pgResourceTypeEnum = pgEnum("resource_type", ResourceType);

export const Resource = pgTable("resource", {
  id: varchar("id", { length: 191 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  engine: pgResourceProcessorEngineEnum("engine").notNull(),
  type: pgResourceTypeEnum("type").notNull(),
  status: pgResourceJobStatusEnum("status").notNull(),
  data: jsonb("data").notNull().$type<typeof $ResourceData>(),
  url: varchar("url", { length: 255 }),
  externalRequestId: varchar("external_request_id", { length: 191 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdateFn(() => sql`now()`),
});
