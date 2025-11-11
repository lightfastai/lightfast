ALTER TABLE "lightfast_stores" ADD COLUMN "pinecone_metric" varchar(20) DEFAULT 'cosine' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "pinecone_cloud" varchar(20) DEFAULT 'aws' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "pinecone_region" varchar(50) DEFAULT 'us-west-2' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "chunk_max_tokens" integer DEFAULT 512 NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "chunk_overlap" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "embedding_model" varchar(100) DEFAULT 'char-hash-1536' NOT NULL;--> statement-breakpoint
ALTER TABLE "lightfast_stores" ADD COLUMN "embedding_provider" varchar(50) DEFAULT 'charHash' NOT NULL;