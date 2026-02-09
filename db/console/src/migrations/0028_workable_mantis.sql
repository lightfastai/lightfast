-- Add new columns as nullable first
ALTER TABLE "lightfast_user_api_keys" ADD COLUMN "key_prefix" varchar(20);--> statement-breakpoint
ALTER TABLE "lightfast_user_api_keys" ADD COLUMN "key_suffix" varchar(4);--> statement-breakpoint

-- Backfill existing keys (extract last 4 chars from key_preview)
UPDATE "lightfast_user_api_keys"
SET
  "key_prefix" = 'sk-lf-',
  "key_suffix" = RIGHT("key_preview", 4)
WHERE "key_prefix" IS NULL;--> statement-breakpoint

-- Make columns NOT NULL after backfill
ALTER TABLE "lightfast_user_api_keys" ALTER COLUMN "key_prefix" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_user_api_keys" ALTER COLUMN "key_suffix" SET NOT NULL;--> statement-breakpoint

-- Drop old column
ALTER TABLE "lightfast_user_api_keys" DROP COLUMN "key_preview";