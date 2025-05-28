ALTER TABLE "session" ADD COLUMN "title" varchar(191) DEFAULT 'New Chat' NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "messages" json DEFAULT '[]'::json;