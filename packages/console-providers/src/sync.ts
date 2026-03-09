import { z } from "zod";

/**
 * Shared sync settings schema for provider configs.
 * Used by all providers' providerConfigSchema definitions.
 */
export const syncSchema = z.object({
  branches: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  events: z.array(z.string()).optional(),
  autoSync: z.boolean(),
});
