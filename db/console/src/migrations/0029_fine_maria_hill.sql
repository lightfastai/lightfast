ALTER TABLE "lightfast_workspace_api_keys" ALTER COLUMN "key_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_api_keys" ADD COLUMN "unkey_key_id" varchar(191);