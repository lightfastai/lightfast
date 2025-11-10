/**
 * Zod schemas for lightfast.yml validation
 *
 * @see docs/architecture/phase1/dx-configuration.md
 */

import { z } from "zod";

/**
 * Zod schema for lightfast.yml configuration
 *
 * @example
 * ```yaml
 * version: 1
 * workspace: ws_123
 * store: docs-site
 * include:
 *   - apps/docs/src/content/docs/**\/*.mdx
 *   - apps/docs/src/content/api/**\/*.mdx
 * ```
 */
export const LightfastConfigSchema = z.object({
  /**
   * Configuration version (currently only version 1 is supported)
   */
  version: z.literal(1),

  /**
   * Workspace identifier (optional - will be resolved from environment if omitted)
   * @example "ws_123" or "myorg/myrepo"
   */
  workspace: z.string().optional(),

  /**
   * Human-readable store name (unique per workspace)
   * Used as the store key in the system
   * @example "docs-site"
   */
  store: z.string().min(1, "Store name must not be empty"),

  /**
   * Array of glob patterns (repo-relative) for files to include in ingestion
   * Must contain at least one pattern
   * @example ["apps/docs/src/content/**\/*.mdx"]
   */
  include: z
    .array(z.string().min(1, "Glob pattern must not be empty"))
    .min(1, "At least one include pattern is required"),
});

/**
 * TypeScript type inferred from LightfastConfigSchema
 */
export type LightfastConfig = z.infer<typeof LightfastConfigSchema>;
