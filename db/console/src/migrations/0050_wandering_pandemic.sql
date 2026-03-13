DROP INDEX "activity_actor_idx";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_events" DROP COLUMN "actor";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_events" DROP COLUMN "actor_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_user_activities" DROP COLUMN "actor_type";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_user_activities" DROP COLUMN "actor_user_id";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_user_activities" DROP COLUMN "actor_email";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_user_activities" DROP COLUMN "actor_ip";