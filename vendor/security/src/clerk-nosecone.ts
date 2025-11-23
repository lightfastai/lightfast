import { defaults, type Options } from "@nosecone/next";
import type { Source } from "nosecone";
import { getClerkFrontendApi } from "@vendor/clerk/env";

/**
 * Nosecone options configured for Clerk authentication
 * Extends default security headers with Clerk-specific CSP directives
 *
 * Based on Clerk's CSP requirements:
 * https://clerk.com/docs/security/clerk-csp
 *
 * @returns Nosecone options with Clerk CSP configuration
 */
export function createClerkNoseconeOptions(): Options {
  const clerkFrontendApi = getClerkFrontendApi();
  const defaultDirectives = defaults.contentSecurityPolicy?.directives;

  return {
    ...defaults,
    contentSecurityPolicy: {
      directives: {
        // Scripts: extend defaults (includes nonce for Next.js inline scripts) + Clerk + Cloudflare
        scriptSrc: [
          ...Array.from(defaultDirectives?.scriptSrc ?? []),
          // TypeScript can't verify runtime string matches Source pattern at compile time
          clerkFrontendApi as Source,
          "https://challenges.cloudflare.com",
        ],
        // Connections: extend defaults + Clerk API
        connectSrc: [
          ...Array.from(defaultDirectives?.connectSrc ?? []),
          clerkFrontendApi as Source,
        ],
        // Images: extend defaults + Clerk CDN
        imgSrc: [
          ...Array.from(defaultDirectives?.imgSrc ?? []),
          "https://img.clerk.com",
        ],
        // Workers: extend defaults + blob for Clerk
        workerSrc: [
          ...Array.from(defaultDirectives?.workerSrc ?? []),
          "blob:",
        ],
        // Frames: extend defaults + Cloudflare bot protection
        frameSrc: [
          ...Array.from(defaultDirectives?.frameSrc ?? []),
          "https://challenges.cloudflare.com",
        ],
        // Keep other directives from defaults (includes styleSrc with unsafe-inline)
        baseUri: defaultDirectives?.baseUri,
        childSrc: defaultDirectives?.childSrc,
        defaultSrc: defaultDirectives?.defaultSrc,
        fontSrc: defaultDirectives?.fontSrc,
        formAction: defaultDirectives?.formAction,
        frameAncestors: defaultDirectives?.frameAncestors,
        manifestSrc: defaultDirectives?.manifestSrc,
        mediaSrc: defaultDirectives?.mediaSrc,
        objectSrc: defaultDirectives?.objectSrc,
        styleSrc: defaultDirectives?.styleSrc,
      },
    },
  };
}
