/**
 * @vendor/vercel-flags
 *
 * Vendor abstraction for Vercel Flags Core SDK
 *
 * Provides a standalone wrapper around @vercel/flags-core for
 * server-side feature flag evaluation with streaming + polling.
 *
 * @example
 * ```typescript
 * import { evaluateFlag } from "@vendor/vercel-flags";
 *
 * const enabled = await evaluateFlag("my-flag", true, {
 *   webhook: { provider: "github" },
 * });
 * ```
 */

export { evaluateFlag } from "./client";
