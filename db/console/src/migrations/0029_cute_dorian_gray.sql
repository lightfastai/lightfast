CREATE TABLE "lightfast_gw_installations" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"external_id" varchar(191) NOT NULL,
	"account_login" varchar(191),
	"connected_by" varchar(191) NOT NULL,
	"org_id" varchar(191) NOT NULL,
	"status" varchar(50) NOT NULL,
	"webhook_secret" text,
	"metadata" jsonb,
	"provider_account_info" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gw_resources" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"provider_resource_id" varchar(191) NOT NULL,
	"resource_name" varchar(500),
	"status" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gw_tokens" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"token_type" varchar(50),
	"scope" text,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lightfast_gw_webhook_deliveries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"provider" varchar(50) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"event_type" varchar(191) NOT NULL,
	"installation_id" varchar(191),
	"status" varchar(50) NOT NULL,
	"payload" text,
	"received_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ALTER COLUMN "user_source_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_user_sources" ADD COLUMN "gateway_installation_id" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "installation_id" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "provider" varchar(50);--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD COLUMN "gateway_installation_id" varchar(191);--> statement-breakpoint
ALTER TABLE "lightfast_gw_resources" ADD CONSTRAINT "lightfast_gw_resources_installation_id_lightfast_gw_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gw_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_gw_tokens" ADD CONSTRAINT "lightfast_gw_tokens_installation_id_lightfast_gw_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gw_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gw_inst_provider_external_idx" ON "lightfast_gw_installations" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "gw_inst_org_id_idx" ON "lightfast_gw_installations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "gw_inst_org_provider_idx" ON "lightfast_gw_installations" USING btree ("org_id","provider");--> statement-breakpoint
CREATE INDEX "gw_inst_connected_by_idx" ON "lightfast_gw_installations" USING btree ("connected_by");--> statement-breakpoint
CREATE INDEX "gw_res_installation_id_idx" ON "lightfast_gw_resources" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "gw_res_provider_resource_idx" ON "lightfast_gw_resources" USING btree ("installation_id","provider_resource_id");--> statement-breakpoint
CREATE INDEX "gw_tok_installation_id_idx" ON "lightfast_gw_tokens" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "gw_wd_provider_delivery_idx" ON "lightfast_gw_webhook_deliveries" USING btree ("provider","delivery_id");--> statement-breakpoint
CREATE INDEX "gw_wd_status_idx" ON "lightfast_gw_webhook_deliveries" USING btree ("status");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_integrations" ADD CONSTRAINT "lightfast_workspace_integrations_installation_id_lightfast_gw_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gw_installations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_source_installation_id_idx" ON "lightfast_workspace_integrations" USING btree ("installation_id");