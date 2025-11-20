/**
 * Script to manually apply jobs and metrics tables
 * Run this if the migration failed due to existing enum types
 */

import { sql } from "drizzle-orm";
import { db } from "../src/client";

async function applyJobsMigration() {
	console.log("Applying jobs and metrics tables migration...");

	try {
		// Create lightfast_api_keys table
		await db.execute(sql`
			CREATE TABLE IF NOT EXISTS "lightfast_api_keys" (
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
		`);
		console.log("✓ Created lightfast_api_keys table");

		// Create lightfast_jobs table
		await db.execute(sql`
			CREATE TABLE IF NOT EXISTS "lightfast_jobs" (
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
		`);
		console.log("✓ Created lightfast_jobs table");

		// Create lightfast_metrics table
		await db.execute(sql`
			CREATE TABLE IF NOT EXISTS "lightfast_metrics" (
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
		`);
		console.log("✓ Created lightfast_metrics table");

		// Create indexes for api_keys
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "api_key_user_id_idx" ON "lightfast_api_keys" USING btree ("user_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "api_key_is_active_idx" ON "lightfast_api_keys" USING btree ("is_active");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "api_key_hash_idx" ON "lightfast_api_keys" USING btree ("key_hash");
		`);
		console.log("✓ Created api_keys indexes");

		// Create indexes for jobs
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "job_clerk_org_id_idx" ON "lightfast_jobs" USING btree ("clerk_org_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "job_workspace_id_idx" ON "lightfast_jobs" USING btree ("workspace_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "job_repository_id_idx" ON "lightfast_jobs" USING btree ("repository_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "job_status_idx" ON "lightfast_jobs" USING btree ("status");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "job_inngest_run_id_idx" ON "lightfast_jobs" USING btree ("inngest_run_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "job_workspace_created_at_idx" ON "lightfast_jobs" USING btree ("workspace_id","created_at");
		`);
		console.log("✓ Created jobs indexes");

		// Create indexes for metrics
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "metric_clerk_org_id_idx" ON "lightfast_metrics" USING btree ("clerk_org_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "metric_workspace_id_idx" ON "lightfast_metrics" USING btree ("workspace_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "metric_repository_id_idx" ON "lightfast_metrics" USING btree ("repository_id");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "metric_type_idx" ON "lightfast_metrics" USING btree ("type");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "metric_workspace_type_timestamp_idx" ON "lightfast_metrics" USING btree ("workspace_id","type","timestamp");
		`);
		await db.execute(sql`
			CREATE INDEX IF NOT EXISTS "metric_timestamp_idx" ON "lightfast_metrics" USING btree ("timestamp");
		`);
		console.log("✓ Created metrics indexes");

		console.log("\n✅ Migration applied successfully!");
		console.log("Tables created: lightfast_api_keys, lightfast_jobs, lightfast_metrics");
	} catch (error) {
		console.error("\n❌ Migration failed:", error);
		throw error;
	}
}

// Run the migration
applyJobsMigration()
	.then(() => {
		console.log("\nDone!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\nFailed to apply migration:", error);
		process.exit(1);
	});
