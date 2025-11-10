/**
 * Workspace and store resolution utilities
 *
 * @see docs/architecture/phase1/dx-configuration.md
 */

import { Result, ok, err } from "neverthrow";
import type { LightfastConfig } from "./schema";

/**
 * Error type for workspace resolution failures
 */
export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_WORKSPACE" | "INVALID_WORKSPACE",
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

/**
 * Resolve workspace identifier from config or environment
 *
 * Resolution order:
 * 1. If config.workspace is provided, use it
 * 2. Otherwise, try LIGHTFAST_WORKSPACE environment variable
 * 3. If neither exists, return error
 *
 * @param config - Parsed Lightfast configuration
 * @returns Result containing workspace ID or error
 *
 * @example
 * ```typescript
 * const result = resolveWorkspace(config);
 * result.match(
 *   (workspace) => console.log("Workspace:", workspace),
 *   (error) => console.error("Failed to resolve workspace:", error.message)
 * );
 * ```
 */
export function resolveWorkspace(
  config: LightfastConfig,
): Result<string, WorkspaceError> {
  // 1. Check config.workspace
  if (config.workspace) {
    if (config.workspace.trim().length === 0) {
      return err(
        new WorkspaceError(
          "Workspace identifier in config is empty",
          "INVALID_WORKSPACE",
        ),
      );
    }
    return ok(config.workspace);
  }

  // 2. Check environment variable
  const envWorkspace = process.env.LIGHTFAST_WORKSPACE;
  if (envWorkspace) {
    if (envWorkspace.trim().length === 0) {
      return err(
        new WorkspaceError(
          "LIGHTFAST_WORKSPACE environment variable is empty",
          "INVALID_WORKSPACE",
        ),
      );
    }
    return ok(envWorkspace);
  }

  // 3. Neither exists
  return err(
    new WorkspaceError(
      "Workspace identifier not found. Either set 'workspace' in lightfast.yml or set LIGHTFAST_WORKSPACE environment variable",
      "MISSING_WORKSPACE",
    ),
  );
}
