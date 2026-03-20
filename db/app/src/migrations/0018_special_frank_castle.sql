CREATE TABLE "lightfast_workspace_api_keys" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lightfast_workspace_api_keys_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"public_id" varchar(191) NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"clerk_org_id" varchar(191) NOT NULL,
	"created_by_user_id" varchar(191) NOT NULL,
	"name" varchar(100) NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" varchar(20) NOT NULL,
	"key_suffix" varchar(4) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_used_from_ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "lightfast_workspace_api_keys_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_api_keys" ADD CONSTRAINT "lightfast_workspace_api_keys_workspace_id_lightfast_org_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_org_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ws_api_key_workspace_id_idx" ON "lightfast_workspace_api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ws_api_key_clerk_org_id_idx" ON "lightfast_workspace_api_keys" USING btree ("clerk_org_id");--> statement-breakpoint
CREATE INDEX "ws_api_key_hash_idx" ON "lightfast_workspace_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "ws_api_key_is_active_idx" ON "lightfast_workspace_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "ws_api_key_workspace_active_idx" ON "lightfast_workspace_api_keys" USING btree ("workspace_id","is_active");