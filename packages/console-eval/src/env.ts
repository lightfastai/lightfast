import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Environment configuration for AI Evaluation Pipeline.
 *
 * All eval-specific variables use the EVAL_ prefix to prevent
 * accidental use of production credentials.
 *
 * Required for in-process eval execution:
 * - EVAL_DATABASE_HOST: PlanetScale Postgres endpoint (horizon.psdb.cloud)
 * - EVAL_DATABASE_USERNAME: Branch-scoped credential ({role}.{branch_id})
 * - EVAL_DATABASE_PASSWORD: Branch-scoped password (pscale_pw_...)
 * - EVAL_PINECONE_API_KEY: Pinecone API key (namespace isolation is per-call)
 * - EVAL_COHERE_API_KEY: Cohere API key for embeddings + reranking
 *
 * Optional:
 * - EVAL_BRAINTRUST_API_KEY: Braintrust for experiment tracking
 * - EVAL_PINECONE_NAMESPACE: Override namespace (default: eval:{runId})
 * - EVAL_SEARCH_MODE: Default search mode (default: balanced)
 * - EVAL_RUN_ID: Unique run identifier (default: local-{timestamp})
 */
export const evalEnv = createEnv({
  server: {
    // Database — PlanetScale eval branch via PgBouncer
    EVAL_DATABASE_HOST: z.string().min(1),
    EVAL_DATABASE_USERNAME: z.string().min(1),
    EVAL_DATABASE_PASSWORD: z.string().min(1),

    // Pinecone — same API key, namespace isolation per-call
    EVAL_PINECONE_API_KEY: z.string().min(1),

    // Cohere — embeddings and reranking
    EVAL_COHERE_API_KEY: z.string().min(1),

    // Braintrust — optional experiment tracking
    EVAL_BRAINTRUST_API_KEY: z.string().min(1).optional(),

    // Eval configuration overrides
    EVAL_PINECONE_NAMESPACE: z.string().min(1).optional(),
    EVAL_SEARCH_MODE: z.enum(["fast", "balanced", "thorough"]).default("balanced"),
    EVAL_RUN_ID: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
