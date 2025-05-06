ALTER TABLE "message" ALTER COLUMN "role" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "message" ADD COLUMN "content" json;--> statement-breakpoint
DROP TYPE "public"."message_role";