CREATE SCHEMA "media_server";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_server"."job" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"status" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "media_server"."resource" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"engine" varchar(255) NOT NULL,
	"data" jsonb NOT NULL
);
