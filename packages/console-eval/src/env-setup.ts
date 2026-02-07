import type { EvalInfraConfig } from "./types";

/**
 * Configure Pinecone environment before dynamic import.
 * Used by seeder and cleanup which only need Pinecone access.
 *
 * For full pipeline env setup (DB + Pinecone + Cohere + Braintrust),
 * use configureEvalEnvironment() in runner/entry.ts instead.
 */
export function configurePineconeEnvironment(infra: EvalInfraConfig): void {
  process.env.PINECONE_API_KEY = infra.pinecone.apiKey;
  process.env.SKIP_ENV_VALIDATION = "true";
}

/**
 * Dynamically import PineconeClient after env is configured.
 * Ensures the singleton reads the correct API key.
 */
export async function createEvalPineconeClient() {
  const { PineconeClient } = await import("@vendor/pinecone");
  return new PineconeClient();
}
