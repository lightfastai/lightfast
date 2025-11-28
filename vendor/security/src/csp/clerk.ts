import type { Source } from "nosecone";
import { getClerkFrontendApi } from "@vendor/clerk/env";
import type { PartialCspDirectives } from "./types";

/**
 * Create CSP directives for Clerk authentication
 *
 * Based on Clerk's CSP requirements:
 * https://clerk.com/docs/security/clerk-csp
 *
 * Includes:
 * - Primary Clerk Frontend API (from publishable key)
 * - Satellite domain (clerk.lightfast.ai) for cross-domain sessions
 * - Cloudflare bot protection
 *
 * @returns Partial CSP directives for Clerk integration
 *
 * @example
 * ```ts
 * const options = composeCspOptions(
 *   createClerkCspDirectives(),
 *   // ... other CSP configs
 * );
 * ```
 */
export function createClerkCspDirectives(): PartialCspDirectives {
  const clerkFrontendApi = getClerkFrontendApi();

  return {
    // Scripts: Clerk Frontend API + Satellite + Cloudflare bot protection
    scriptSrc: [
      clerkFrontendApi as Source,
      "https://clerk.lightfast.ai", // Satellite domain for cross-domain sessions
      "https://challenges.cloudflare.com",
    ],

    // Connections: Clerk API for authentication
    connectSrc: [
      clerkFrontendApi as Source,
      "https://clerk.lightfast.ai", // Satellite domain for cross-domain sessions
    ],

    // Images: Clerk CDN for user avatars and assets
    imgSrc: [
      "https://img.clerk.com",
    ],

    // Workers: Allow blob URLs for Clerk's internal workers
    workerSrc: [
      "blob:",
    ],

    // Frames: Cloudflare bot protection challenges
    frameSrc: [
      "https://challenges.cloudflare.com",
    ],
  };
}
