CREATE TABLE "lightfast_org_actor_identities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_actor_identities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clerk_org_id" varchar(191) NOT NULL,
	"canonical_actor_id" varchar(191) NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"source_username" varchar(255),
	"source_email" varchar(255),
	"avatar_url" text,
	"clerk_user_id" varchar(191),
	"mapping_method" varchar(50) NOT NULL,
	"confidence_score" real NOT NULL,
	"mapped_by" varchar(191),
	"mapped_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "org_actor_identity_unique_idx" ON "lightfast_org_actor_identities" USING btree ("clerk_org_id","source","source_id");--> statement-breakpoint
CREATE INDEX "org_actor_identity_canonical_idx" ON "lightfast_org_actor_identities" USING btree ("clerk_org_id","canonical_actor_id");--> statement-breakpoint
CREATE INDEX "org_actor_identity_clerk_user_idx" ON "lightfast_org_actor_identities" USING btree ("clerk_org_id","clerk_user_id");--> statement-breakpoint
CREATE INDEX "org_actor_identity_username_idx" ON "lightfast_org_actor_identities" USING btree ("clerk_org_id","source_username");