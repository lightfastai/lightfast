CREATE TABLE "lightfast_org_source_control_bindings" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_org_source_control_bindings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"clerk_org_id" varchar(191) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_account_id" varchar(191),
	"provider_account_login" varchar(191),
	"provider_installation_id" varchar(191),
	"status" varchar(50) NOT NULL,
	"connected_by_user_id" varchar(191) NOT NULL,
	"connected_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"revoked_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "org_source_control_bindings_active_per_org_uq" ON "lightfast_org_source_control_bindings" USING btree ("clerk_org_id") WHERE "lightfast_org_source_control_bindings"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "org_source_control_bindings_installation_uq" ON "lightfast_org_source_control_bindings" USING btree ("provider_installation_id") WHERE "lightfast_org_source_control_bindings"."provider_installation_id" is not null;--> statement-breakpoint
CREATE INDEX "org_source_control_bindings_org_status_idx" ON "lightfast_org_source_control_bindings" USING btree ("clerk_org_id","status");--> statement-breakpoint
CREATE INDEX "org_source_control_bindings_provider_account_idx" ON "lightfast_org_source_control_bindings" USING btree ("provider","provider_account_id");