CREATE TABLE "lightfast_api_keys" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" text NOT NULL,
	"key_preview" varchar(8) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"last_used_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_jobs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"repository_id" varchar(191),
	"inngest_run_id" varchar(191) NOT NULL,
	"inngest_function_id" varchar(191) NOT NULL,
	"name" varchar(191) NOT NULL,
	"status" varchar(50) DEFAULT 'queued' NOT NULL,
	"trigger" varchar(50) NOT NULL,
	"triggered_by" varchar(191),
	"input" jsonb,
	"output" jsonb,
	"error_message" varchar(1000),
	"started_at" timestamp,
	"completed_at" timestamp,
	"duration_ms" varchar(50),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_metrics" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"repository_id" varchar(191),
	"type" varchar(50) NOT NULL,
	"value" integer NOT NULL,
	"unit" varchar(20),
	"tags" jsonb,
	"timestamp" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX "api_key_user_id_idx" ON "lightfast_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "api_key_is_active_idx" ON "lightfast_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "api_key_hash_idx" ON "lightfast_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "job_clerk_org_id_idx" ON "lightfast_jobs" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "job_workspace_id_idx" ON "lightfast_jobs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "job_repository_id_idx" ON "lightfast_jobs" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "job_status_idx" ON "lightfast_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_inngest_run_id_idx" ON "lightfast_jobs" USING btree ("inngest_run_id");--> statement-breakpoint
CREATE INDEX "job_workspace_created_at_idx" ON "lightfast_jobs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "metric_clerk_org_id_idx" ON "lightfast_metrics" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "metric_workspace_id_idx" ON "lightfast_metrics" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "metric_repository_id_idx" ON "lightfast_metrics" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "metric_type_idx" ON "lightfast_metrics" USING btree ("type");--> statement-breakpoint
CREATE INDEX "metric_workspace_type_timestamp_idx" ON "lightfast_metrics" USING btree ("workspace_id","type","timestamp");--> statement-breakpoint
CREATE INDEX "metric_timestamp_idx" ON "lightfast_metrics" USING btree ("timestamp");