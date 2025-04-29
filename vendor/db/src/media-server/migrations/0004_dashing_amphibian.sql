ALTER TABLE "media_server"."resource" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "media_server"."resource" ADD COLUMN "updated_at" timestamp;