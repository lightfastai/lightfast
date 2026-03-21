ALTER TABLE "lightfast_user_sources" RENAME COLUMN "provider" TO "source_type";--> statement-breakpoint
DROP INDEX "user_source_provider_idx";--> statement-breakpoint
DROP INDEX "user_source_user_provider_idx";--> statement-breakpoint
CREATE INDEX "user_source_source_type_idx" ON "lightfast_user_sources" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "user_source_user_source_type_idx" ON "lightfast_user_sources" USING btree ("user_id","source_type");