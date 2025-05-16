CREATE TABLE "user" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"email" varchar(191) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "message" DROP COLUMN "content";