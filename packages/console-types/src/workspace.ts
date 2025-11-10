import { z } from "zod";

/**
 * Workspace settings schema
 *
 * Phase 1: Empty settings object
 * Phase 2: Repository-level configuration, defaults, and feature flags
 */
export const workspaceSettingsSchema = z.object({
  repositories: z
    .record(
      z.object({
        enabled: z.boolean(),
      }),
    )
    .optional(),
  defaults: z
    .object({
      patterns: z.array(z.string()).optional(),
      ignore: z.array(z.string()).optional(),
    })
    .optional(),
  features: z
    .object({
      codeIndexing: z.boolean().optional(),
      multiLanguage: z.boolean().optional(),
    })
    .optional(),
});

export type WorkspaceSettings = z.infer<typeof workspaceSettingsSchema>;
