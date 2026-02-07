import { evalEnv } from "../env";
import type { EvalInfraConfig } from "../types";
import { evalInfraConfigSchema } from "../schemas";

/**
 * Load eval infrastructure config from validated environment variables.
 * All EVAL_* env vars have already been validated by evalEnv.
 * Zod schema provides runtime shape validation as a second layer.
 */
export function loadEvalInfraConfig(): EvalInfraConfig {
  const raw = {
    db: {
      host: evalEnv.EVAL_DATABASE_HOST,
      username: evalEnv.EVAL_DATABASE_USERNAME,
      password: evalEnv.EVAL_DATABASE_PASSWORD,
    },
    pinecone: {
      apiKey: evalEnv.EVAL_PINECONE_API_KEY,
    },
    cohere: {
      apiKey: evalEnv.EVAL_COHERE_API_KEY,
    },
    braintrust: evalEnv.EVAL_BRAINTRUST_API_KEY
      ? { apiKey: evalEnv.EVAL_BRAINTRUST_API_KEY }
      : undefined,
  };
  return evalInfraConfigSchema.parse(raw);
}
