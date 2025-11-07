/**
 * @repo/console-config
 *
 * Parse and validate lightfast.yml configuration files
 *
 * @packageDocumentation
 */

// Export schema and types
export { LightfastConfigSchema, type LightfastConfig } from "./schema";

// Export parsing functions and errors
export { loadConfig, validateConfig, ConfigError } from "./parse";

// Export resolution functions and errors
export { resolveWorkspace, WorkspaceError } from "./resolve";

// Export glob utilities
export {
  matchFiles,
  validateGlobPatterns,
  matchesGlobs,
} from "./glob";
