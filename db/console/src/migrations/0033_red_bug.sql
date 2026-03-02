CREATE TABLE "lightfast_gw_backfill_runs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"installation_id" varchar(191) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"since" timestamp with time zone NOT NULL,
	"depth" integer NOT NULL,
	"status" varchar(50) NOT NULL,
	"pages_processed" integer DEFAULT 0 NOT NULL,
	"events_produced" integer DEFAULT 0 NOT NULL,
	"events_dispatched" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_gw_backfill_runs" ADD CONSTRAINT "lightfast_gw_backfill_runs_installation_id_lightfast_gw_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."lightfast_gw_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gw_br_installation_entity_idx" ON "lightfast_gw_backfill_runs" USING btree ("installation_id","entity_type");--> statement-breakpoint
CREATE INDEX "gw_br_installation_idx" ON "lightfast_gw_backfill_runs" USING btree ("installation_id");