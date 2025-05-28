CREATE TYPE "public"."resource_job_status" AS ENUM('init', 'in_queue', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."resource_processor_engine" AS ENUM('fal-ai/fast-sdxl', 'fal-ai/fast-sdxl-turbo', 'fal-ai/kling-video/v2/master/text-to-video', 'openai/gpt-4o-mini');--> statement-breakpoint
CREATE TYPE "public"."resource_type" AS ENUM('image', 'video', 'audio', 'text');--> statement-breakpoint
CREATE TABLE "edge" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"source" varchar(191) NOT NULL,
	"target" varchar(191) NOT NULL,
	"source_handle" varchar(191) NOT NULL,
	"target_handle" varchar(191) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "node" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"type" varchar(50) NOT NULL,
	"position" json NOT NULL,
	"data" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email_address" varchar(255) NOT NULL,
	CONSTRAINT "user_clerkId_unique" UNIQUE("clerk_id"),
	CONSTRAINT "user_emailAddress_unique" UNIQUE("email_address")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar(191) NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "edge" ADD CONSTRAINT "edge_source_node_id_fk" FOREIGN KEY ("source") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edge" ADD CONSTRAINT "edge_target_node_id_fk" FOREIGN KEY ("target") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node" ADD CONSTRAINT "node_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;