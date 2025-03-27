DROP TABLE "account";--> statement-breakpoint
DROP TABLE "session";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;