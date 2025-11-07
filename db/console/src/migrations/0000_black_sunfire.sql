CREATE TABLE "lf_stores" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"workspace_id" varchar(191) NOT NULL,
	"name" varchar(191) NOT NULL,
	"index_name" varchar(191) NOT NULL,
	"embedding_dim" integer DEFAULT 1536 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lf_docs_documents" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"path" varchar(512) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"title" varchar(256),
	"description" text,
	"content_hash" varchar(64) NOT NULL,
	"commit_sha" varchar(64) NOT NULL,
	"committed_at" timestamp DEFAULT now() NOT NULL,
	"frontmatter" jsonb,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lf_vector_entries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"doc_id" varchar(191) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"index_name" varchar(191) NOT NULL,
	"upserted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lf_ingestion_commits" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"store_id" varchar(191) NOT NULL,
	"before_sha" varchar(64) NOT NULL,
	"after_sha" varchar(64) NOT NULL,
	"delivery_id" varchar(191) NOT NULL,
	"status" varchar(16) DEFAULT 'processed' NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_stores_ws" ON "lf_stores" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ws_name" ON "lf_stores" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE INDEX "idx_docs_store" ON "lf_docs_documents" USING btree ("store_id");--> statement-breakpoint
CREATE INDEX "idx_docs_store_slug" ON "lf_docs_documents" USING btree ("store_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_docs_store_path" ON "lf_docs_documents" USING btree ("store_id","path");--> statement-breakpoint
CREATE INDEX "idx_vec_store_doc" ON "lf_vector_entries" USING btree ("store_id","doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_vec_unique" ON "lf_vector_entries" USING btree ("store_id","doc_id","chunk_index","content_hash");--> statement-breakpoint
CREATE INDEX "idx_commits_store" ON "lf_ingestion_commits" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_commit_after" ON "lf_ingestion_commits" USING btree ("store_id","after_sha");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_commit_delivery" ON "lf_ingestion_commits" USING btree ("store_id","delivery_id");