CREATE TYPE "public"."document_kind" AS ENUM('code', '3d');--> statement-breakpoint
CREATE TABLE "document" (
	"id" varchar(191) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"title" text NOT NULL,
	"content" text,
	"kind" "document_kind" NOT NULL,
	"sessionId" varchar(191) NOT NULL,
	CONSTRAINT "document_id_createdAt_pk" PRIMARY KEY("id","createdAt")
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_sessionId_session_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;