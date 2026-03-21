DROP INDEX "actor_profile_clerk_user_idx";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "avatar_url";--> statement-breakpoint
ALTER TABLE "lightfast_workspace_actor_profiles" DROP COLUMN "clerk_user_id";