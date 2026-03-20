DROP INDEX "actor_identity_email_idx";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" ADD COLUMN "clerk_user_id" varchar(191);--> statement-breakpoint
CREATE INDEX "actor_profile_clerk_user_idx" ON "lightfast_workspace_actor_profiles" USING btree ("workspace_id","clerk_user_id");--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "expertise_domains";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "contribution_types";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "active_hours";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "frequent_collaborators";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "profile_embedding_id";