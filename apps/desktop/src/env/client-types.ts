import { z } from "zod";

/**
 * Zod schema definition for client-side environment variables.
 * We define it separately to easily infer the TS type.
 */
export const clientSchemaDefinition = {
  VITE_PUBLIC_LIGHTFAST_API_URL: z.string().url(),
  // Add other client-side variables here (e.g., VITE_PUBLIC_FEATURE_FLAG: z.boolean().default(false))
};

/**
 * Zod schema object built from the definition.
 */
export const $EnvClient = z.object(clientSchemaDefinition);

/**
 * TypeScript type inferred from the Zod schema $EnvClient.
 */
export type EnvClient = z.infer<typeof $EnvClient>;
