ALTER TABLE "user" ADD COLUMN "email_address" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "user_id" varchar(191) NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_emailAddress_unique" UNIQUE("email_address");