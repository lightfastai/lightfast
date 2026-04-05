/**
 * @repo/app-reserved-names
 *
 * Reserved organization names for Lightfast Console
 * to prevent URL routing conflicts.
 *
 * Uses Set-based O(1) lookups for optimal performance.
 *
 * @example
 * ```typescript
 * import reservedNames from '@repo/app-reserved-names';
 * import { organization } from '@repo/app-reserved-names';
 *
 * // Organization validation (O(1))
 * organization.check('admin'); // => true
 * organization.all;           // => ['admin', 'api', ...]
 * ```
 */

// Default export
export { default } from "./main";
export { default as organization } from "./organization";
