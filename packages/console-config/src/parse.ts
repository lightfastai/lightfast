/**
 * Config file parsing utilities
 *
 * @see docs/architecture/phase1/dx-configuration.md
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Result} from "neverthrow";
import { ok, err } from "neverthrow";
import { parse as parseYAML } from "yaml";
import type { ZodError } from "zod";
import { LightfastConfigSchema  } from "./schema";
import type {LightfastConfig} from "./schema";

/**
 * Error types for configuration loading and parsing
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "FILE_NOT_FOUND"
      | "INVALID_YAML"
      | "VALIDATION_ERROR"
      | "READ_ERROR",
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Load and parse lightfast.yml configuration from a repository path
 *
 * @param repoPath - Absolute path to the repository root
 * @returns Result containing parsed config or error
 *
 * @example
 * ```typescript
 * const result = await loadConfig("/path/to/repo");
 * result.match(
 *   (config) => console.log("Loaded config:", config),
 *   (error) => console.error("Failed to load config:", error.message)
 * );
 * ```
 */
export async function loadConfig(
  repoPath: string,
): Promise<Result<LightfastConfig, ConfigError>> {
  const configPath = join(repoPath, "lightfast.yml");

  // Read the file
  let fileContent: string;
  try {
    fileContent = await readFile(configPath, "utf-8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return err(
        new ConfigError(
          `Configuration file not found: ${configPath}`,
          "FILE_NOT_FOUND",
          error,
        ),
      );
    }
    return err(
      new ConfigError(
        `Failed to read configuration file: ${configPath}`,
        "READ_ERROR",
        error,
      ),
    );
  }

  // Parse YAML
  let parsedYAML: unknown;
  try {
    parsedYAML = parseYAML(fileContent);
  } catch (error) {
    return err(
      new ConfigError(
        `Invalid YAML syntax in ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
        "INVALID_YAML",
        error,
      ),
    );
  }

  // Validate against schema
  return validateConfig(parsedYAML);
}

/**
 * Validate configuration structure against Zod schema
 *
 * @param config - Parsed YAML configuration (unknown type)
 * @returns Result containing validated config or error
 *
 * @example
 * ```typescript
 * const result = validateConfig({ version: 1, store: "docs", include: ["*.md"] });
 * ```
 */
export function validateConfig(
  config: unknown,
): Result<LightfastConfig, ConfigError> {
  const parseResult = LightfastConfigSchema.safeParse(config);

  if (!parseResult.success) {
    const zodError = parseResult.error as ZodError;
    const errorMessages = zodError.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");

    return err(
      new ConfigError(
        `Configuration validation failed: ${errorMessages}`,
        "VALIDATION_ERROR",
        zodError,
      ),
    );
  }

  return ok(parseResult.data);
}
