/**
 * Workspace Reserved Names
 *
 * Provides O(1) validation for workspace names to prevent URL routing conflicts.
 * URL pattern: /{orgSlug}/{workspaceName}
 */

import workspaceNames from '../data/workspace-names.json' with { type: 'json' };

/**
 * All reserved workspace names (sorted alphabetically)
 * Total: 400+ names including HTTP status codes, routes, resources, etc.
 */
export const all: ReadonlyArray<string> = workspaceNames;

/**
 * Set of reserved workspace names for O(1) lookup performance
 * @internal
 */
const reservedSet = new Set(workspaceNames.map(name => name.toLowerCase()));

/**
 * Check if a workspace name is reserved (case-insensitive)
 *
 * Time Complexity: O(1)
 *
 * @param name - Workspace name to check
 * @returns true if the name is reserved, false otherwise
 *
 * @example
 * ```typescript
 * check('settings'); // => true
 * check('Settings'); // => true (case-insensitive)
 * check('404');      // => true (HTTP status code)
 * check('my-project'); // => false
 * ```
 */
export function check(name: string): boolean {
  if (!name) return false;
  return reservedSet.has(name.toLowerCase());
}

/**
 * Default export with all workspace reserved name utilities
 */
export default {
  all,
  check,
} as const;
