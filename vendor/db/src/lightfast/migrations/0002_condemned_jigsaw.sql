CREATE TABLE "session" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "edge" CASCADE;--> statement-breakpoint
DROP TABLE "node" CASCADE;--> statement-breakpoint
DROP TABLE "user" CASCADE;--> statement-breakpoint
DROP TABLE "resource" CASCADE;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."resource_job_status";--> statement-breakpoint
DROP TYPE "public"."resource_processor_engine";--> statement-breakpoint
DROP TYPE "public"."resource_type";