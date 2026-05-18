CREATE TABLE "org_lightfast_tasks" (
	"org_id" text NOT NULL,
	"task_key" text NOT NULL,
	"cleared_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_lightfast_tasks_org_id_task_key_pk" PRIMARY KEY("org_id","task_key")
);
--> statement-breakpoint
CREATE INDEX "org_lightfast_tasks_org_idx" ON "org_lightfast_tasks" USING btree ("org_id");