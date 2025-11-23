import type { Options } from "@nosecone/next";
import { composeCspOptions, createClerkCspDirectives } from "./csp/index";

/**
 * Nosecone options configured for Clerk authentication
 * Extends default security headers with Clerk-specific CSP directives
 *
 * Based on Clerk's CSP requirements:
 * https://clerk.com/docs/security/clerk-csp
 *
 * @deprecated Use `composeCspOptions(createClerkCspDirectives(), ...)` instead for better composability
 * @returns Nosecone options with Clerk CSP configuration
 *
 * @example Migration
 * ```ts
 * // Old way (deprecated)
 * const options = createClerkNoseconeOptions();
 *
 * // New way (recommended)
 * import { composeCspOptions, createClerkCspDirectives, createAnalyticsCspDirectives } from "@vendor/security";
 * const options = composeCspOptions(
 *   createClerkCspDirectives(),
 *   createAnalyticsCspDirectives(), // Add as needed
 * );
 * ```
 */
export function createClerkNoseconeOptions(): Options {
  return composeCspOptions(createClerkCspDirectives());
}
