import type { Source } from "nosecone";
import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Next.js specific requirements
 *
 * Includes hashes for inline scripts that cannot use nonces,
 * such as those injected by Next.js, Vercel Analytics, or other integrations.
 *
 * @returns Partial CSP directives for Next.js integration
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createNextjsCspDirectives(),
 *   createClerkCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createNextjsCspDirectives(): PartialCspDirectives {
  return {
    // Scripts: Allow specific inline scripts via hash
    // This hash is for inline scripts that cannot use nonces (e.g., Vercel Analytics)
    scriptSrc: [
      // Hash for Vercel Analytics inline script
      "'sha256-OBTN3RiyCV4Bq7dFqZ5a2pAXjnCcCYeTJMO2I/LYKeo='" as Source,
    ],
  };
}
