CREATE TYPE "public"."media_server_job_status" AS ENUM('init', 'in_queue', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_server_processor_engine" AS ENUM('fal-ai/fast-sdxl', 'fal-ai/fast-sdxl-turbo', 'openai/gpt-4o-mini');--> statement-breakpoint
CREATE TYPE "public"."media_server_resource_type" AS ENUM('image', 'video', 'audio', 'text');--> statement-breakpoint
ALTER TABLE "media_server"."resource" ALTER COLUMN "engine" SET DATA TYPE "public"."media_server_processor_engine" USING "engine"::"public"."media_server_processor_engine";--> statement-breakpoint
ALTER TABLE "media_server"."resource" ALTER COLUMN "type" SET DATA TYPE "public"."media_server_resource_type" USING "type"::"public"."media_server_resource_type";--> statement-breakpoint
ALTER TABLE "media_server"."resource" ADD COLUMN "status" "media_server_job_status" NOT NULL;
GRANT USAGE ON SCHEMA media_server TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA media_server TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA media_server TO anon, authenticated;