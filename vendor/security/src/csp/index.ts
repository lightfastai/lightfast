/**
 * Composable Content Security Policy (CSP) configuration
 *
 * This module provides a composable approach to building CSP configurations.
 * Each service (Clerk, Analytics, Sentry) provides its own CSP directives,
 * which can be composed together using the `composeCspOptions()` function.
 *
 * @example Basic usage
 * ```ts
 * import { composeCspOptions, createClerkCspDirectives, createAnalyticsCspDirectives } from "@vendor/security/csp";
 * import { securityMiddleware } from "@vendor/security/middleware";
 *
 * const options = composeCspOptions(
 *   createClerkCspDirectives(),
 *   createAnalyticsCspDirectives()
 * );
 *
 * const securityHeaders = securityMiddleware(options);
 * ```
 *
 * @example Custom directives
 * ```ts
 * const customDirectives = {
 *   scriptSrc: ["https://custom-cdn.example.com"],
 *   imgSrc: ["https://images.example.com"]
 * };
 *
 * const options = composeCspOptions(
 *   createClerkCspDirectives(),
 *   customDirectives
 * );
 * ```
 */

export { composeCspDirectives, composeCspOptions } from "./compose";
export { createClerkCspDirectives } from "./clerk";
export { createAnalyticsCspDirectives } from "./analytics";
export { createSentryCspDirectives } from "./sentry";
export type { CspDirective, CspDirectives, PartialCspDirectives } from "./types";
