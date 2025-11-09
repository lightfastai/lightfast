ALTER TABLE "lightfast_deus_connected_repository" RENAME TO "lightfast_connected_repository";--> statement-breakpoint
ALTER TABLE "lf_docs_documents" RENAME TO "lightfast_docs_documents";--> statement-breakpoint
ALTER TABLE "lf_ingestion_commits" RENAME TO "lightfast_ingestion_commits";--> statement-breakpoint
ALTER TABLE "lightfast_deus_organizations" RENAME TO "lightfast_organizations";--> statement-breakpoint
ALTER TABLE "lf_stores" RENAME TO "lightfast_stores";--> statement-breakpoint
ALTER TABLE "lf_vector_entries" RENAME TO "lightfast_vector_entries";--> statement-breakpoint
ALTER TABLE "lightfast_connected_repository" DROP CONSTRAINT "lightfast_deus_connected_repository_github_repo_id_unique";--> statement-breakpoint
ALTER TABLE "lightfast_organizations" DROP CONSTRAINT "lightfast_deus_organizations_github_org_id_unique";--> statement-breakpoint
ALTER TABLE "lightfast_organizations" DROP CONSTRAINT "lightfast_deus_organizations_clerk_org_id_unique";--> statement-breakpoint
ALTER TABLE "lightfast_connected_repository" ADD CONSTRAINT "lightfast_connected_repository_github_repo_id_unique" UNIQUE("github_repo_id");--> statement-breakpoint
ALTER TABLE "lightfast_organizations" ADD CONSTRAINT "lightfast_organizations_github_org_id_unique" UNIQUE("github_org_id");--> statement-breakpoint
ALTER TABLE "lightfast_organizations" ADD CONSTRAINT "lightfast_organizations_clerk_org_id_unique" UNIQUE("clerk_org_id");