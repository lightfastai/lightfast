ALTER TABLE "lightfast_workspace_actor_identities" RENAME COLUMN "actor_id" TO "canonical_actor_id";--> statement-breakpoint
DROP INDEX "actor_identity_actor_idx";--> statement-breakpoint
CREATE INDEX "actor_identity_canonical_actor_idx" ON "lightfast_workspace_actor_identities" USING btree ("workspace_id","canonical_actor_id");