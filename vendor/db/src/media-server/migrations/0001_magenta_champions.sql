DROP TABLE "media_server"."job" CASCADE;--> statement-breakpoint
ALTER TABLE "media_server"."resource" ADD COLUMN "type" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "media_server"."resource" ADD COLUMN "url" varchar(255);--> statement-breakpoint
ALTER TABLE "media_server"."resource" ADD COLUMN "external_request_id" varchar(191);