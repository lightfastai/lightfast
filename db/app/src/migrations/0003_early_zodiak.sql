ALTER TABLE "lightfast_workspace_workflow_runs" DROP CONSTRAINT "lightfast_workspace_workflow_runs_store_id_lightfast_workspace_stores_id_fk";
--> statement-breakpoint
ALTER TABLE "lightfast_workspace_user_activities" ALTER COLUMN "metadata" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_workspace_workflow_runs" ADD CONSTRAINT "lightfast_workspace_workflow_runs_store_id_lightfast_workspace_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_workspace_stores"("id") ON DELETE cascade ON UPDATE no action;