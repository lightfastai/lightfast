ALTER TABLE "lightfast_organizations" DROP CONSTRAINT "lightfast_organizations_clerk_org_id_unique";--> statement-breakpoint
DROP INDEX "org_slug_idx";--> statement-breakpoint
DROP INDEX "org_clerk_org_idx";--> statement-breakpoint
ALTER TABLE "lightfast_organizations" ALTER COLUMN "clerk_org_slug" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "org_github_slug_idx" ON "lightfast_organizations" USING btree ("github_org_slug");--> statement-breakpoint
CREATE INDEX "org_clerk_slug_idx" ON "lightfast_organizations" USING btree ("clerk_org_slug");--> statement-breakpoint
ALTER TABLE "lightfast_organizations" DROP COLUMN "clerk_org_id";