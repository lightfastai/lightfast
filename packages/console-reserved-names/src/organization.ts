/**
 * Organization Reserved Names
 *
 * Provides O(1) validation for organization slugs to prevent URL routing conflicts.
 * URL pattern: /{orgSlug}
 */

import organizationNames from '../data/organization-names.json' with { type: 'json' };

/**
 * All reserved organization names (sorted alphabetically)
 */
export const all: ReadonlyArray<string> = organizationNames;

/**
 * Set of reserved organization names for O(1) lookup performance
 * @internal
 */
const reservedSet = new Set(organizationNames.map(name => name.toLowerCase()));

/**
 * Check if an organization slug is reserved (case-insensitive)
 *
 * Time Complexity: O(1)
 *
 * @param slug - Organization slug to check
 * @returns true if the slug is reserved, false otherwise
 *
 * @example
 * ```typescript
 * check('admin'); // => true
 * check('Admin'); // => true (case-insensitive)
 * check('my-company'); // => false
 * ```
 */
export function check(slug: string): boolean {
  if (!slug) return false;
  return reservedSet.has(slug.toLowerCase());
}

/**
 * Default export with all organization reserved name utilities
 */
export default {
  all,
  check,
} as const;
