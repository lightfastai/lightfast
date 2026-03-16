/**
 * @repo/console-reserved-names
 *
 * Reserved workspace and organization names for Lightfast Console
 * to prevent URL routing conflicts.
 *
 * Uses Set-based O(1) lookups for optimal performance.
 *
 * @example
 * ```typescript
 * import reservedNames from '@repo/console-reserved-names';
 * import { workspace, organization } from '@repo/console-reserved-names';
 *
 * // Workspace validation (O(1))
 * workspace.check('settings'); // => true
 * workspace.all;              // => ['300', '302', '400', ...]
 *
 * // Organization validation (O(1))
 * organization.check('admin'); // => true
 * organization.all;           // => ['admin', 'api', ...]
 * ```
 */

// Default export
export { default } from "./main";
export { default as organization } from "./organization";
export { default as workspace } from "./workspace";
