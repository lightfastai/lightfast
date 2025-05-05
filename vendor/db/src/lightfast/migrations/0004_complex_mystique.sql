CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'data');--> statement-breakpoint
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
CREATE TABLE "message" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"session_id" varchar(191) NOT NULL,
	"role" "message_role" NOT NULL,
	"parts" json DEFAULT '[]'::json NOT NULL,
	"attachments" json DEFAULT '[]'::json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Stream" (
	"id" varchar(191) NOT NULL,
	"sessionId" varchar(191) NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Stream_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "title" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "title" SET DEFAULT 'New Chat';--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_sessionId_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_session_idx" ON "message" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_workspace_idx" ON "session" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "messages";