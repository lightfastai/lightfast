CREATE TYPE "public"."resource_job_status" AS ENUM('init', 'in_queue', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."resource_processor_engine" AS ENUM('fal-ai/fast-sdxl', 'fal-ai/fast-sdxl-turbo', 'fal-ai/kling-video/v2/master/text-to-video', 'openai/gpt-4o-mini');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('image', 'video', 'audio', 'text');--> statement-breakpoint
CREATE TABLE "resource" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"engine" "resource_processor_engine" NOT NULL,
	"type" "resource_type" NOT NULL,
	"status" "resource_job_status" NOT NULL,
	"data" jsonb NOT NULL,
	"url" varchar(255),
	"external_request_id" varchar(191),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
