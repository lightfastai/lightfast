CREATE TABLE "lightfast_store_repositories" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"github_repo_id" varchar(191) NOT NULL,
	"repo_full_name" varchar(512) NOT NULL,
	"linked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lightfast_store_repositories" ADD CONSTRAINT "lightfast_store_repositories_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_store_repo_store" ON "lightfast_store_repositories" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_store_repo_repo" ON "lightfast_store_repositories" USING btree ("github_repo_id");--> statement-breakpoint
ALTER TABLE "lightfast_connected_repository" ADD CONSTRAINT "lightfast_connected_repository_organization_id_lightfast_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."lightfast_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_connected_repository" ADD CONSTRAINT "lightfast_connected_repository_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_docs_documents" ADD CONSTRAINT "lightfast_docs_documents_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_ingestion_commits" ADD CONSTRAINT "lightfast_ingestion_commits_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD CONSTRAINT "lightfast_stores_workspace_id_lightfast_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."lightfast_workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" ADD CONSTRAINT "lightfast_vector_entries_store_id_lightfast_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."lightfast_stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" ADD CONSTRAINT "lightfast_vector_entries_doc_id_lightfast_docs_documents_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."lightfast_docs_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" ADD CONSTRAINT "lightfast_workspaces_organization_id_lightfast_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."lightfast_organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lightfast_vector_entries" DROP COLUMN "index_name";--> statement-breakpoint
ALTER TABLE "lightfast_workspaces" DROP COLUMN "pinecone_index";