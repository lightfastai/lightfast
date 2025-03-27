CREATE TABLE IF NOT EXISTS "database" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"user_id" varchar(191) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"db_id" varchar(191) NOT NULL,
	CONSTRAINT "database_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "database_db_id_unique" UNIQUE("db_id")
);
--> statement-breakpoint
DROP TABLE "edge";--> statement-breakpoint
DROP TABLE "node";--> statement-breakpoint
DROP TABLE "workspace";--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE varchar(191);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "database" ADD CONSTRAINT "database_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_db_db_id" ON "database" USING btree ("db_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_clerkId_unique" UNIQUE("clerk_id");